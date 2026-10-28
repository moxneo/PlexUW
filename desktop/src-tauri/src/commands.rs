//! IPC commands for M1. Every result/event is token-free (§6a L2); error strings
//! pass through `redact`. Commands are declared in build.rs (AppManifest) and
//! granted to the main window only in capabilities/default.json (§6a M3).
use crate::plex::{
    api::{self, ApiError, Conn, Server, ServerView},
    browse::{self, Api, Facet, Images, Sort},
    merge::{self, Target},
    proxy::{self, HlsMap, ProxyReq},
    egress::Egress,
    prefs::Prefs,
    secrets::{self, SecretStore, StoreError},
    source::{DataSource, MockSource, PlexSource, SourceView},
    transport::Transport,
};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};
use url::Url;

mod mx;
mod play;
mod watchlist;
pub use mx::HomeView;

/// Latest playback clock for `/:/timeline`. Lives on `Plex` so tests don't share a process static.
#[derive(Clone)]
struct PlayClock {
    mid: String,
    rk: u64,
    duration_ms: u64,
    time_ms: u64,
    state: String,
    pending: bool,
}
impl Default for PlayClock {
    fn default() -> Self {
        Self { mid: String::new(), rk: 0, duration_ms: 0, time_ms: 0, state: "stopped".into(), pending: false }
    }
}

pub struct Plex {
    egress: Arc<Egress>,
    servers: Mutex<Vec<Server>>,
    source: Mutex<Box<dyn DataSource>>,
    manual: Mutex<Option<(Url, String)>>,
    /// Manual host awaiting the user's "send your server token?" answer (MED-1).
    manual_ask: Mutex<Option<(Url, String)>>,
    trust: Mutex<api::Trust>,
    trust_path: PathBuf,
    ai_migrate_failed: bool,
    gen: AtomicU64,
    prefs: Mutex<Prefs>,
    prefs_path: PathBuf,
    images: Images,
    hls: HlsMap,
    /// Server-switch generation: a cancelled or superseded connect never commits (round 5 LOW).
    conn_gen: AtomicU64,
    cache_dir: PathBuf,
    /// FU7: opaque server/version ids (MUST-3), sticky version picks (MUST-1),
    /// and per-server winning connections for the version fan-out.
    slots: merge::Slots,
    sticky: merge::Sticky,
    conns: Mutex<std::collections::HashMap<String, Conn>>,
    /// fu7b merged-servers engine (fan-out cache, library cursors, fill-in events).
    mx: mx::Mx,
    /// Playing version's server + rating key. JS sends state and time only.
    timeline: Mutex<PlayClock>,
}
type P<'a> = State<'a, Arc<Plex>>;

impl Plex {
    fn signed_in(&self) -> Result<bool, StoreError> {
        Ok(self.egress.store.get(&secrets::account_key(&self.egress.client_id))?.is_some())
    }
    /// Cold start. The source is still the first-run placeholder until reconnect finishes.
    /// A keychain account token for this client id is a session anyway: report signed-in
    /// and reconnect the saved server. `use_demo` is not consulted (init clears it).
    fn hydrate(&self) -> Hydrate {
        let (signed_in, keychain) = match self.signed_in() {
            Ok(b) => (b, "ok"),
            Err(StoreError::Unavailable) => (false, "unavailable"),
            Err(_) => (false, "error"),
        };
        let reconnect = if signed_in {
            self.prefs.lock().unwrap().selected_server.clone().filter(|s| !s.is_empty())
        } else {
            None
        };
        Hydrate { signed_in, keychain, reconnect }
    }
    fn set_source(&self, s: Box<dyn DataSource>) -> SourceView {
        let v = s.view();
        *self.source.lock().unwrap() = s;
        v
    }
    fn save(&self) { let _ = self.prefs.lock().unwrap().save(&self.prefs_path); }
    /// Resources refresh: new server list, MUST-3 key rotation, connection cache dropped.
    fn set_servers(&self, s: Vec<Server>) {
        *self.servers.lock().unwrap() = s;
        self.slots.rotate();
        // LOW-13: image ids are keyed too and die with the same rotation.
        self.images.rotate();
        self.mx.reset();
        self.conns.lock().unwrap().clear();
    }
    fn current(&self) -> Result<(String, Conn), String> {
        self.source.lock().unwrap().plex().ok_or_else(|| "not connected to a Plex server".to_string())
    }
    /// L3: in-memory maps + the on-disk image cache. The webview never caches
    /// plexuw responses (Cache-Control: no-store), so there is no webview cache to clear.
    fn clear_caches(&self) {
        self.images.clear();
        self.hls.clear();
        let _ = std::fs::remove_dir_all(&self.cache_dir);
    }
    /// Remember which copy is playing so timeline posts stay on that server.
    pub fn arm_timeline(&self, mid: &str, rk: u64, duration_ms: u64, time_ms: u64) {
        if rk == 0 || mid.is_empty() { return; }
        let mut c = self.timeline.lock().unwrap();
        c.mid = mid.to_string();
        c.rk = rk;
        c.duration_ms = duration_ms;
        c.time_ms = if duration_ms > 0 { time_ms.min(duration_ms) } else { time_ms };
        c.state = "playing".into();
        c.pending = true;
    }
}

fn backend() -> (Arc<dyn Transport>, Arc<dyn SecretStore>) {
    #[cfg(feature = "mockplex")]
    {
        use crate::plex::{fixture::FixtureTransport, secrets::MemStore};
        let unavailable = std::env::var_os("PLEXUW_MOCK_KEYCHAIN_FAIL").is_some();
        let second_online = std::env::var_os("PLEXUW_MOCK_ONE_SERVER").is_none(); // FU7: MoxBox + Slowpoke + BLACKBOX by default
        let slow_ms = std::env::var("PLEXUW_MOCK_SLOW_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
        return (Arc::new(FixtureTransport { second_online, slow_ms, ..Default::default() }), Arc::new(MemStore { unavailable, ..Default::default() }));
    }
    #[allow(unreachable_code)]
    (Arc::new(crate::plex::transport::Reqwest::new()), Arc::new(secrets::keyring_store()))
}

pub fn init(app: &AppHandle) {
    let prefs_path = app.path().app_config_dir().map(|d| d.join("settings.json")).unwrap_or_else(|_| "settings.json".into());
    let prefs = Prefs::load(&prefs_path);
    let trust_path = prefs_path.with_file_name("manual-hosts.json");
    let (t, store) = backend();
    let egress = Arc::new(Egress::new(t, store, prefs.client_id.clone()));
    // L2: move AI keys from the M1 name (PlexUW/ai/<p>) to PlexUW/<clientId>/ai/<p>.
    // LOW-3: a failure is remembered so the UI can tell the user.
    let ai_migrate_failed = secrets::migrate_ai_keys(&*egress.store, &prefs.client_id).is_err();
    let cache_dir = app.path().app_local_data_dir().map(|d| d.join("imgcache")).unwrap_or_else(|_| std::env::temp_dir().join("plexuw-imgcache"));
    let p = Arc::new(Plex {
        egress,
        servers: Mutex::new(vec![]),
        source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
        manual: Mutex::new(None),
        manual_ask: Mutex::new(None),
        trust: Mutex::new(api::Trust::load(&trust_path)),
        trust_path,
        ai_migrate_failed,
        gen: AtomicU64::new(0),
        prefs: Mutex::new(prefs),
        prefs_path,
        images: Images::default(),
        hls: HlsMap::default(), conn_gen: AtomicU64::new(0),
        cache_dir,
        slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
    });
    {
        let app2 = app.clone();
        *p.mx.notify.lock().unwrap() = Some(Arc::new(move || { let _ = app2.emit("plex-merge-fill", ()); }));
    }
    app.manage(p.clone());
    // Startup: a leftover useDemo flag must not open a mock library or block hydrate.
    {
        let mut pr = p.prefs.lock().unwrap();
        if pr.use_demo {
            pr.use_demo = false;
            let _ = pr.save(&p.prefs_path);
        }
    }
    // Keychain account token + saved server: reconnect in the background. The UI
    // reads hydrate().signed_in and must not raise Connect while this is in flight.
    if let Some(mid) = p.hydrate().reconnect {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let v = reconnect(&p, &mid).await;
            let _ = app.emit("plex-source", v);
        });
    }
}

struct Hydrate {
    signed_in: bool,
    keychain: &'static str,
    reconnect: Option<String>,
}

async fn reconnect(p: &Arc<Plex>, mid: &str) -> SourceView {
    if p.servers.lock().unwrap().is_empty() {
        if let Ok(s) = api::load_resources(&p.egress).await { p.set_servers(s); }
    }
    // Re-verify the saved manual URL (unauthenticated identity probe) so the race can use it.
    let host = p.prefs.lock().unwrap().manual_host.clone();
    if let Some(u) = api::parse_manual(&host) {
        let servers = p.servers.lock().unwrap().clone();
        let trust = p.trust.lock().unwrap().clone();
        // Startup never asks: only a listed host or a remembered "yes" is used.
        if let Ok(api::Manual::Bound(m)) = api::probe_manual(&p.egress, &u, &servers, &trust).await {
            *p.manual.lock().unwrap() = Some((u, m));
        }
    }
    match connect(p, mid).await {
        Ok(v) => v,
        Err(_) => p.set_source(Box::new(MockSource { reason: "offline" })),
    }
}

async fn connect(p: &Arc<Plex>, mid: &str) -> Result<SourceView, String> {
    let my = p.conn_gen.fetch_add(1, Ordering::SeqCst) + 1;
    connect_as(p, mid, my).await
}

/// Connect, committing the new source only if `my` is still the latest switch request.
async fn connect_as(p: &Arc<Plex>, mid: &str, my: u64) -> Result<SourceView, String> {
    let server = p.servers.lock().unwrap().iter().find(|s| s.machine_id == mid).cloned().ok_or("not-on-account")?;
    let manual = p.manual.lock().unwrap().clone().filter(|(_, m)| m == mid).map(|(u, _)| u);
    let conn: Conn = api::race(&p.egress, &server, manual.as_ref(), Duration::from_secs(5)).await.map_err(|e| e.category().to_string())?;
    // Check + commit under the source lock; `server_connect_cancel` takes the same lock,
    // so a cancel lands either before the check (nothing changes) or after the commit
    // (and then reports the new server, so the UI never disagrees with Rust).
    let mut src = p.source.lock().unwrap();
    if p.conn_gen.load(Ordering::SeqCst) != my { return Err(CANCELLED.into()); }
    {
        let mut pr = p.prefs.lock().unwrap();
        pr.selected_server = Some(mid.to_string());
        pr.use_demo = false;
        let _ = pr.save(&p.prefs_path);
    }
    let s: Box<dyn DataSource> = Box::new(PlexSource { machine_id: server.machine_id.clone(), name: server.name.clone(), owned: server.owned, conn });
    let v = s.view();
    *src = s;
    Ok(v)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Status { source: SourceView, signed_in: bool, keychain: &'static str }

#[tauri::command]
pub fn source_get(p: P<'_>) -> Status {
    let h = p.hydrate();
    Status { source: p.source.lock().unwrap().view(), signed_in: h.signed_in, keychain: h.keychain }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PinView { code: String, expires_in: u64, strong: bool, browser_opened: bool }

#[derive(Serialize, Clone)]
struct AuthEvent { state: &'static str, message: Option<String> }

#[tauri::command]
pub async fn auth_start(app: AppHandle, p: P<'_>, strong: bool) -> Result<PinView, String> {
    let p = p.inner().clone();
    let my = p.gen.fetch_add(1, Ordering::SeqCst) + 1;
    let pin = api::create_pin(&p.egress, strong).await.map_err(|e| e.category().to_string())?;
    let mut browser_opened = false;
    if !cfg!(feature = "mockplex") {
        // System browser, never the webview. URL is not logged (§6a L1).
        // Short code: plex.tv/link with the code prefilled; the code stays on screen as fallback.
        let url = if strong { api::auth_url(&p.egress.client_id, &pin.code) } else { api::link_url(&pin.code) };
        browser_opened = open::that_detached(url).is_ok();
    }
    let view = PinView { code: pin.code.clone(), expires_in: pin.expires_in, strong, browser_opened };
    tauri::async_runtime::spawn(async move {
        let ev = |state: &'static str, message: Option<String>| { let _ = app.emit("plex-auth", AuthEvent { state, message }); };
        match api::poll_pin(&p.egress, &pin, &p.gen, my, Duration::from_secs(1)).await {
            Ok(tok) => {
                drop(pin); // PIN id discarded after use
                match api::store_account_token_blocking(&p.egress, tok).await {
                    Err(ApiError::Keychain(StoreError::Unavailable)) => ev("keychain-unavailable", None),
                    Err(e) => ev("error", Some(e.category().to_string())),
                    Ok(()) => match api::load_resources(&p.egress).await {
                        Ok(s) => { p.set_servers(s); ev("signed-in", None) }
                        Err(ApiError::Keychain(StoreError::Unavailable)) => ev("keychain-unavailable", None),
                        Err(e) => ev("error", Some(e.category().to_string())),
                    },
                }
            }
            Err(ApiError::Expired) => ev("expired", None),
            Err(ApiError::Cancelled) => {}
            Err(e) => ev("error", Some(e.category().to_string())),
        }
    });
    Ok(view)
}

#[tauri::command]
pub fn auth_cancel(p: P<'_>) { p.gen.fetch_add(1, Ordering::SeqCst); }

#[tauri::command]
pub async fn servers_list(p: P<'_>) -> Result<Vec<ServerView>, String> {
    let p = p.inner().clone();
    if p.servers.lock().unwrap().is_empty() {
        let s = api::load_resources(&p.egress).await.map_err(|e| e.category().to_string())?;
        p.set_servers(s);
    }
    // §9: JS gets an opaque slot id, never the machineId.
    let v = p.servers.lock().unwrap().iter().map(|s| { let mut v = ServerView::from(s); v.id = p.slots.server(&s.machine_id); v }).collect();
    Ok(v)
}

#[tauri::command]
pub async fn server_connect(p: P<'_>, id: String) -> Result<SourceView, String> {
    let p = p.inner().clone();
    let machine_id = p.slots.resolve_server(&id).ok_or("not-on-account")?;
    let my = p.conn_gen.fetch_add(1, Ordering::SeqCst) + 1;
    match connect_as(&p, &machine_id, my).await {
        Ok(v) => Ok(v),
        // Cancelled/superseded: leave the current server exactly as it was.
        Err(e) if e == CANCELLED || p.conn_gen.load(Ordering::SeqCst) != my => Err(CANCELLED.into()),
        Err(e) => { p.set_source(Box::new(MockSource { reason: "offline" })); Err(e) }
    }
}

const CANCELLED: &str = "cancelled";

/// Round 5 LOW: cancel a server switch that is still connecting. The current server stays.
#[tauri::command]
pub fn server_connect_cancel(p: P<'_>) -> SourceView { cancel_connect(p.inner()) }
fn cancel_connect(p: &Arc<Plex>) -> SourceView {
    let src = p.source.lock().unwrap();
    p.conn_gen.fetch_add(1, Ordering::SeqCst);
    src.view()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualView { id: String, name: String, needs_confirm: bool, host: String }

#[tauri::command]
pub async fn manual_probe(p: P<'_>, host: String) -> Result<ManualView, String> {
    let p = p.inner().clone();
    let u = api::parse_manual(&host).ok_or("bad-address")?;
    if p.servers.lock().unwrap().is_empty() {
        let s = api::load_resources(&p.egress).await.map_err(|e| e.category().to_string())?;
        p.set_servers(s);
    }
    let servers = p.servers.lock().unwrap().clone();
    let trust = p.trust.lock().unwrap().clone();
    let r = api::probe_manual(&p.egress, &u, &servers, &trust).await.map_err(|e| e.category().to_string())?;
    let hp = crate::plex::egress::host_port(&u).unwrap_or_default();
    let (mid, needs_confirm) = match r {
        api::Manual::Bound(m) => {
            *p.manual.lock().unwrap() = Some((u, m.clone()));
            p.prefs.lock().unwrap().manual_host = host.trim().to_string();
            p.save();
            (m, false)
        }
        api::Manual::NeedsConfirm(m) => { *p.manual_ask.lock().unwrap() = Some((u, m.clone())); (m, true) }
    };
    let name = servers.iter().find(|s| s.machine_id == mid).map(|s| s.name.clone()).unwrap_or_default();
    // host is what the user typed (normalised host:port), shown in the confirmation.
    Ok(ManualView { id: p.slots.server(&mid), name, needs_confirm, host: hp })
}

/// MED-1: the user's answer to "send your server token to <host>?" for the host
/// manual_probe just asked about. Remembered per (machineId, host:port).
#[tauri::command]
pub fn manual_confirm(p: P<'_>, allow: bool) -> Result<bool, String> {
    let (u, mid) = p.manual_ask.lock().unwrap().take().ok_or("nothing to confirm")?;
    let hp = crate::plex::egress::host_port(&u).ok_or("invalid host")?;
    {
        let mut t = p.trust.lock().unwrap();
        t.set(&mid, &hp, allow);
        let _ = t.save(&p.trust_path);
    }
    if allow {
        api::bind_manual(&p.egress, &mid, &hp);
        p.prefs.lock().unwrap().manual_host = u.host_str().map(|h| match u.port() { Some(pt) => format!("https://{h}:{pt}"), None => format!("https://{h}") }).unwrap_or_default();
        *p.manual.lock().unwrap() = Some((u, mid));
        p.save();
    }
    Ok(allow)
}

/// Sign-out: local wipe of every indexed PlexUW/* keychain entry. Remote session
/// revocation is best effort and not attempted in M1 (no documented endpoint; §6a L3).
#[tauri::command]
pub async fn sign_out(p: P<'_>) -> Result<SourceView, String> {
    // SHOULD-8: the keychain wipe runs on the blocking pool under KEYCHAIN_TIMEOUT, never on
    // the UI thread; the store lock itself is taken with LOCK_TIMEOUT.
    let p: Arc<Plex> = p.inner().clone();
    p.gen.fetch_add(1, Ordering::SeqCst);
    let mids: Vec<String> = p.servers.lock().unwrap().iter().map(|s| s.machine_id.clone()).collect();
    let p2 = p.clone();
    let wiped = api::keychain_blocking(move || api::sign_out(&p2.egress, &*p2.egress.store, &mids)).await;
    finish_sign_out(&p, wiped)
}

/// Everything in memory is cleared either way; if the keychain wipe was incomplete the
/// caller gets "signout-incomplete" (fixed category) instead of a false "signed out".
#[cfg(all(test, feature = "mockplex"))]
fn sign_out_inner(p: &Plex) -> Result<SourceView, String> {
    p.gen.fetch_add(1, Ordering::SeqCst);
    let mids: Vec<String> = p.servers.lock().unwrap().iter().map(|s| s.machine_id.clone()).collect();
    let wiped = api::sign_out(&p.egress, &*p.egress.store, &mids);
    finish_sign_out(p, wiped)
}

fn finish_sign_out(p: &Plex, wiped: Result<usize, StoreError>) -> Result<SourceView, String> {
    p.clear_caches();
    p.servers.lock().unwrap().clear();
    // MUST-3: every opaque id dies with the session; picks and connections too.
    p.slots.rotate();
    p.images.rotate();
    p.mx.reset();
    p.sticky.clear();
    p.conns.lock().unwrap().clear();
    *p.manual.lock().unwrap() = None;
    *p.manual_ask.lock().unwrap() = None;
    // LOW-7: a later account starts with no remembered "send token to <host>" answers.
    *p.trust.lock().unwrap() = api::Trust::default();
    let _ = std::fs::remove_file(&p.trust_path);
    p.prefs.lock().unwrap().manual_host.clear();
    p.prefs.lock().unwrap().selected_server = None;
    wipe_session_disk(p);
    p.save();
    let v = p.set_source(Box::new(MockSource { reason: "first-run" }));
    match wiped {
        Ok(_) => Ok(v),
        Err(e @ StoreError::Other(_)) if secrets::category(&e) == "keychain-timeout" => Err("keychain-timeout".into()),
        Err(_) => Err("signout-incomplete".into()),
    }
}

/// AI key: write-only from JS. Stored in the keychain; never returned.
#[tauri::command]
pub fn ai_key_set(p: P<'_>, provider: String, key: String) -> Result<(), String> {
    if !secrets::AI_PROVIDERS.contains(&provider.as_str()) || key.len() > 512 { return Err("invalid".into()); }
    let k = secrets::ai_key(&p.egress.client_id, &provider);
    let r = if key.trim().is_empty() { secrets::remove(&*p.egress.store, &k) }
            else { secrets::put(&*p.egress.store, &k, &secrecy::SecretString::from(key.trim().to_string())) };
    r.map_err(|e| match e { StoreError::Unavailable => "keychain-unavailable".to_string(), _ => "keychain error".to_string() })
}

/// LOW-3: true when moving a saved AI key into the keychain failed at startup.
#[tauri::command]
pub fn ai_migration_failed(p: P<'_>) -> bool { p.ai_migrate_failed }

#[tauri::command]
pub fn ai_key_has(p: P<'_>, provider: String) -> bool {
    if !secrets::AI_PROVIDERS.contains(&provider.as_str()) { return false; }
    matches!(p.egress.store.get(&secrets::ai_key(&p.egress.client_id, &provider)), Ok(Some(_)))
}

// ---- M2 browsing: typed requests only (JS never sends a path or URL).

fn err(e: ApiError) -> String { e.category().to_string() }

#[cfg_attr(not(test), allow(dead_code))]
async fn fetch(p: &Arc<Plex>, api: Api) -> Result<(String, serde_json::Value), String> {
    let (mid, conn) = p.current()?;
    let v = browse::get(&p.egress, &conn, &mid, &api).await.map_err(err)?;
    Ok((mid, v))
}

fn rating_key(id: &str) -> Result<u64, String> {
    if id.is_empty() || id.len() > 12 || !id.bytes().all(|b| b.is_ascii_digit()) { return Err("invalid id".into()); }
    id.parse().map_err(|_| "invalid id".into())
}

#[tauri::command]
pub async fn browse_home(p: P<'_>) -> Result<HomeView, String> {
    let p = p.inner().clone();
    mx::home(&p).await
}

/// fu7b: `id` is an opaque library id (merged Movies / TV Shows, or one server's section).
/// Sorting and paging run in Rust; `cursor` (opaque) continues where the last page ended.
#[tauri::command]
pub async fn browse_section(p: P<'_>, id: String, start: u32, cursor: Option<String>, sort: String, fkind: Option<String>, fvalue: Option<String>) -> Result<browse::Page, String> {
    let p = p.inner().clone();
    mx::section_page(&p, &id, start, cursor.as_deref(), &sort, fkind.as_deref().unwrap_or(""), fvalue.as_deref().unwrap_or("")).await
}

/// A–Z rail: per-letter counts summed over the library's sources (approximate when merged).
#[tauri::command]
pub async fn browse_letters(p: P<'_>, id: String, fkind: Option<String>, fvalue: Option<String>) -> Result<Vec<browse::Letter>, String> {
    let p = p.inner().clone();
    mx::letters(&p, &id, fkind.as_deref().unwrap_or(""), fvalue.as_deref().unwrap_or("")).await
}

#[tauri::command]
pub async fn browse_section_hubs(p: P<'_>, id: String) -> Result<Vec<browse::Hub>, String> {
    let p = p.inner().clone();
    mx::section_hubs(&p, &id).await
}

#[tauri::command]
pub async fn browse_facet(p: P<'_>, id: String, facet: String) -> Result<Vec<browse::FacetValue>, String> {
    let p = p.inner().clone();
    let facet = match facet.as_str() { "genre" => Facet::Genre, "studio" => Facet::Studio, "year" => Facet::Year, _ => return Err("invalid facet".into()) };
    mx::facets(&p, &id, facet).await
}

#[tauri::command]
pub async fn browse_collections(p: P<'_>, id: String) -> Result<Vec<browse::Item>, String> {
    let p = p.inner().clone();
    mx::collections(&p, &id).await
}

#[tauri::command]
pub async fn browse_collection(p: P<'_>, id: String) -> Result<Vec<browse::Item>, String> {
    let p = p.inner().clone();
    let ep = p.slots.epoch();
    let (mid, rk) = mx::item_target(&p, &id)?;
    let v = mx::fetch_on(&p, &mid, &Api::CollectionChildren(rk)).await?;
    mx::sealed_items(&p, &v, &mid, ep)
}

/// MUST-1: remember the user's version pick Rust-side (guid -> machineId). JS sends
/// only the opaque version id; nothing about the pick is ever returned to JS.
#[tauri::command]
pub fn version_pick(p: P<'_>, id: String) -> Result<(), String> { version_pick_inner(p.inner(), &id) }
fn version_pick_inner(p: &Arc<Plex>, id: &str) -> Result<(), String> {
    match p.slots.resolve(id) { Some(Target::Version { mid, guid, .. }) if !guid.is_empty() => { p.sticky.set(&guid, &mid); Ok(()) } _ => Err("not found".into()) }
}

#[tauri::command]
pub async fn browse_item(p: P<'_>, id: String) -> Result<browse::Item, String> {
    let p = p.inner().clone();
    browse_item_inner(&p, &id).await
}

/// The parent show of a season/episode, from the item's OWN server (LOW-10: never merged
/// across servers). Unsealed: only its credits are copied.
async fn show_for(p: &Arc<Plex>, sk: u64, mid: &str) -> Option<browse::Item> {
    let sv = mx::fetch_on(p, mid, &Api::Metadata(sk)).await.ok()?;
    let img = p.images.fork();
    let it = browse::item_list(&sv, mid, &img).into_iter().next();
    p.images.commit(img).then_some(it).flatten()
}

/// A winning connection for `s`: cached, else a fresh staggered race (5 s budget).
async fn conn_for(p: &Arc<Plex>, s: &Server) -> Option<Conn> {
    if let Some(c) = p.conns.lock().unwrap().get(&s.machine_id).cloned() { return Some(c); }
    let ep = p.slots.epoch();
    let c = tokio::time::timeout(Duration::from_secs(7), api::race(&p.egress, s, None, Duration::from_secs(5))).await.ok()?.ok()?;
    if p.slots.epoch() == ep { p.conns.lock().unwrap().insert(s.machine_id.clone(), c.clone()); }
    Some(c)
}

/// Guid search often returns the row without `Media`. Fetch the metadata record so the
/// copy still gets a quality label. A miss keeps the slim row; the caller lists a fallback.
async fn other_copy(p: &Arc<Plex>, s: &Server, h: serde_json::Value) -> (u64, serde_json::Value) {
    let Some(hrk) = browse::rating_key_value(&h) else { return (0, serde_json::Value::Null) };
    let has_media = |v: &serde_json::Value| v.get("Media").and_then(|m| m.as_array()).map(|a| !a.is_empty()).unwrap_or(false);
    if has_media(&h) { return (hrk, h); }
    if let Ok(full) = mx::fetch_on(p, &s.machine_id, &Api::Metadata(hrk)).await {
        if let Some(m) = full.get("Metadata").and_then(|a| a.as_array()).and_then(|a| a.first()).cloned() {
            return (hrk, m);
        }
    }
    (hrk, h)
}

async fn browse_item_inner(p: &Arc<Plex>, id: &str) -> Result<browse::Item, String> {
    // LOW-12: everything below is minted/registered under this epoch or not at all.
    let ep = p.slots.epoch();
    let (mid, rk) = mx::item_target(p, id)?;
    let v = mx::fetch_on(p, &mid, &Api::Metadata(rk)).await?;
    let img = p.images.fork();
    let mut it = browse::item_list(&v, &mid, &img).into_iter().next().ok_or("not found")?;
    let raw = v.get("Metadata").and_then(|m| m.get(0)).cloned().unwrap_or_default();
    it.tracks = browse::av_tracks(&raw);
    let (cur_name, cur_owned, cur_conn) = {
        let ss = p.servers.lock().unwrap();
        let s = ss.iter().find(|s| s.machine_id == mid);
        (s.map(|s| s.name.clone()).unwrap_or_default(), s.map_or(true, |s| s.owned), p.conns.lock().unwrap().get(&mid).map(|c| c.kind).or_else(|| p.current().ok().filter(|(m, _)| *m == mid).map(|(_, c)| c.kind)).unwrap_or(api::ConnKind::Remote))
    };
    let show = match it.kind.as_str() { "season" => it.parent_id.clone(), "episode" => it.grandparent_id.clone(), _ => String::new() };
    if ["movie", "episode"].contains(&it.kind.as_str()) {
        let guid = merge::queryable_guid_of(&raw).unwrap_or_default();
        let mut vs: Vec<merge::Version> = merge::versions_of(&p.slots, ep, &guid, &mid, &cur_name, cur_owned, cur_conn, rk, &raw).into_iter().map(|mut x| { x.current = true; x }).collect();
        let mut hits: Vec<(String, Server, serde_json::Value)> = vec![];
        if !guid.is_empty() {
            // INFO: other servers via the soft-deadline fan-out; late ones fill in.
            let others: Vec<Server> = mx::ranked(p).into_iter().filter(|s| s.machine_id != mid).collect();
            let type_id = browse::plex_type(&it.kind);
            let g = mx::gather(p, &format!("guid\0{type_id}\0{guid}"), Api::ByGuid { guid: guid.clone(), type_id }, &others).await?;
            it.versions_pending = g.pending;
            for (_, s, mc) in g.got {
                let found: Vec<serde_json::Value> = mc.get("Metadata").and_then(|m| m.as_array()).map(|a| a.iter().take(4).filter(|x| browse::guid_matches(x, &guid)).cloned().collect()).unwrap_or_default();
                for h in found {
                    let (hrk, raw_h) = other_copy(p, &s, h).await;
                    if hrk == 0 { continue; }
                    let c = p.conns.lock().unwrap().get(&s.machine_id).map(|c| c.kind).unwrap_or(api::ConnKind::Remote);
                    let mut made = merge::versions_of(&p.slots, ep, &guid, &s.machine_id, &s.name, s.owned, c, hrk, &raw_h);
                    if made.is_empty() {
                        if let Some(v) = merge::version_fallback(&p.slots, ep, &guid, &s.machine_id, &s.name, s.owned, c, hrk) { made.push(v); }
                    }
                    for x in made { hits.push((x.id.clone(), s.clone(), raw_h.clone())); vs.push(x); }
                }
            }
            let sticky = p.sticky.get(&guid);
            for x in vs.iter_mut() { if let (Some(Target::Version { mid: m, .. }), Some(sm)) = (p.slots.resolve(&x.id), sticky.as_ref()) { x.picked = &m == sm; } }
        }
        // fu7c split (plan §9a): the LIST is ordered purely by quality (SHOULD-3), while
        // card art, metadata and the default version come from the best OWNED copy
        // (Sentinel MUST-2, allowed alternative) via merge::best_version.
        merge::sort_versions(&mut vs);
        let top = merge::best_version(&vs);
        if !cur_owned {
            let best = top.filter(|&i| vs[i].owned).and_then(|i| hits.iter().find(|(id, _, _)| *id == vs[i].id));
            if let Some((_, s, h)) = best {
                let wrap = serde_json::json!({"Metadata": [h]});
                if let Some(o) = browse::item_list(&wrap, &s.machine_id, &img).into_iter().next() {
                    it.title = o.title; it.summary = o.summary; it.tagline = o.tagline; it.genres = o.genres; it.year = o.year;
                    it.content_rating = o.content_rating; it.studio = o.studio; it.thumb = o.thumb; it.art = o.art; it.poster = o.poster;
                    it.critic_rating = o.critic_rating; it.audience_rating = o.audience_rating; it.rating = o.rating;
                    if !o.cast.is_empty() { it.cast = o.cast; }
                    it.tracks = browse::av_tracks(h);
                }
            }
        }
        // Default Play target (Play itself is M3): the sticky pick, else the best owned copy.
        it.default_version = vs.iter().find(|x| x.picked).or(top.map(|i| &vs[i])).map(|x| x.id.clone());
        // One copy still lists: the play card shows Versions even when there is a single server.
        it.versions = vs;
    }
    if let Ok(sk) = rating_key(&show) {
        if let Some(s) = show_for(p, sk, &mid).await {
            let guests = std::mem::take(&mut it.cast);
            it.cast = s.cast;
            for g in guests { if !it.cast.iter().any(|c| c.name == g.name) { it.cast.push(g); } }
            if it.directors.is_empty() { it.directors = s.directors; }
            if it.writers.is_empty() { it.writers = s.writers; }
            if it.genres.is_empty() { it.genres = s.genres; }
            if it.studio.is_empty() { it.studio = s.studio; }
            if it.content_rating.is_empty() { it.content_rating = s.content_rating; }
            if it.critic_rating.is_none() && it.kind == "season" { it.critic_rating = s.critic_rating; }
            if it.audience_rating.is_none() && it.kind == "season" { it.audience_rating = s.audience_rating; }
            if it.year.is_none() { it.year = s.year; }
        }
    }
    merge::seal(&mut it, &mid, &p.slots, ep).ok_or("stale")?;
    if p.slots.epoch() != ep || !p.images.commit(img) { return Err("stale".into()); }
    Ok(it)
}

#[tauri::command]
pub async fn browse_children(p: P<'_>, id: String) -> Result<Vec<browse::Item>, String> {
    let p = p.inner().clone();
    let ep = p.slots.epoch();
    let (mid, rk) = mx::item_target(&p, &id)?;
    let v = mx::fetch_on(&p, &mid, &Api::Children(rk)).await?;
    mx::sealed_items(&p, &v, &mid, ep)
}

/// fu7e: person page (photo, bio, filmography merged across servers).
#[tauri::command]
pub async fn browse_person(p: P<'_>, id: String) -> Result<browse::PersonView, String> {
    let p = p.inner().clone();
    mx::person(&p, &id).await
}

/// fu7e: Related row at the bottom of a movie/show page (merged, deduped).
#[tauri::command]
pub async fn browse_related(p: P<'_>, id: String) -> Result<Vec<browse::Item>, String> {
    let p = p.inner().clone();
    mx::related(&p, &id).await
}

#[tauri::command]
pub async fn browse_search(p: P<'_>, query: String) -> Result<Vec<browse::Hub>, String> {
    let p = p.inner().clone();
    let q: String = browse::clean(query.trim(), 100);
    if q.is_empty() { return Ok(vec![]); }
    mx::search(&p, q).await
}

/// Start real playback for an opaque library item. `version_id`, when it resolves,
/// selects that copy; a miss falls back to the item. Errors are `playback` or
/// `playback (status)` — never a URL, host or token.
#[tauri::command]
pub async fn play_start(p: P<'_>, id: String, version_id: Option<String>, offset_ms: Option<u64>, subtitle_index: Option<u32>) -> Result<play::PlayOut, String> {
    play::start(p.inner(), &id, version_id.as_deref(), offset_ms.unwrap_or(0), subtitle_index).await
}

/// Account card for the rail. plex.tv `/api/v2/user` only. JS receives a display
/// name and an opaque thumb id — never email, id, uuid, token, or subscription.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountCard { pub name: String, pub thumb: Option<String> }

fn account_name(v: &serde_json::Value) -> String {
    for k in ["username", "title", "friendlyName"] {
        let s = v.get(k).and_then(|x| x.as_str()).map(|s| browse::clean(s, 80)).unwrap_or_default();
        if s.is_empty() || s.contains('@') || s.contains("://") || s.contains('/') { continue; }
        return s;
    }
    String::new()
}

pub fn account_card(v: &serde_json::Value, img: &Images) -> AccountCard {
    let thumb = v.get("thumb").and_then(|x| x.as_str()).and_then(|t| img.register_public(t));
    AccountCard { name: account_name(v), thumb }
}

#[tauri::command]
pub async fn account_me(p: P<'_>) -> Result<AccountCard, String> {
    let p = p.inner().clone();
    let url = Url::parse("https://plex.tv/api/v2/user").map_err(|_| "account".to_string())?;
    let r = p.egress.send(crate::plex::transport::Method::Get, url, crate::plex::egress::Cred::Account, Duration::from_secs(15)).await.map_err(|_| "account".to_string())?;
    if !(200..300).contains(&r.status) { return Err("account".into()); }
    let v: serde_json::Value = serde_json::from_slice(&r.body).map_err(|_| "account".to_string())?;
    Ok(account_card(&v, &p.images))
}

/// Mark the opened copy watched or unwatched. JS sends the opaque item id only.
#[tauri::command]
pub async fn mark_watched(p: P<'_>, id: String, watched: bool) -> Result<(), String> {
    let p = p.inner().clone();
    mark_watched_inner(&p, &id, watched).await
}

async fn mark_watched_inner(p: &Arc<Plex>, id: &str, watched: bool) -> Result<(), String> {
    let (mid, rk) = mx::item_target(p, id).map_err(|_| "mark".to_string())?;
    if rk == 0 || rk > 999_999_999_999 { return Err("mark".into()); }
    let server = p.servers.lock().unwrap().iter().find(|s| s.machine_id == mid).cloned().ok_or_else(|| "mark".to_string())?;
    let conn = conn_for(p, &server).await.ok_or_else(|| "mark".to_string())?;
    let path = if watched { "/:/scrobble" } else { "/:/unscrobble" };
    let mut url = conn.url.join(path).map_err(|_| "mark".to_string())?;
    let q = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("identifier", "com.plexapp.plugins.library")
        .append_pair("key", &format!("/library/metadata/{rk}"))
        .finish();
    url.set_query(Some(&q));
    let r = p.egress.send(crate::plex::transport::Method::Get, url, crate::plex::egress::Cred::Server(mid), Duration::from_secs(15)).await.map_err(|_| "mark".to_string())?;
    if !(200..300).contains(&r.status) { return Err("mark".into()); }
    p.mx.drop_home_rows();
    Ok(())
}

/// Webview HLS loader fetch. Playlists and segments are returned as base64 so the
/// page never XHRs `plexuw://`.
#[tauri::command]
pub async fn opaque_get(p: P<'_>, kind: String, id: String) -> Result<play::OpaqueOut, String> {
    Ok(play::opaque(p.inner(), &kind, &id).await)
}

/// N2: playback stop clears the HLS id map. Home/Continue Watching rows are stale after a play.
/// The latest timeline sample is flushed as `stopped` even mid-interval.
#[tauri::command]
pub fn playback_stop(p: P<'_>) {
    let arc = p.inner().clone();
    {
        let mut c = arc.timeline.lock().unwrap();
        if c.rk != 0 {
            c.state = "stopped".into();
            c.pending = true;
        }
    }
    let flush = arc.clone();
    tauri::async_runtime::spawn(async move { let _ = flush_timeline(&flush).await; });
    arc.hls.clear();
    arc.mx.drop_home_rows();
}

/// Progress report. JS sends `state` and `timeMs` only; rating key and server come from the play clock.
#[tauri::command]
pub async fn playback_timeline(p: P<'_>, state: String, time_ms: u64) -> Result<(), String> {
    if !matches!(state.as_str(), "playing" | "paused" | "stopped") { return Err("timeline".into()); }
    if time_ms > 48 * 60 * 60 * 1000 { return Err("timeline".into()); }
    let arc = p.inner().clone();
    {
        let mut c = arc.timeline.lock().unwrap();
        if c.rk == 0 || c.mid.is_empty() { return Ok(()); }
        c.time_ms = if c.duration_ms > 0 { time_ms.min(c.duration_ms) } else { time_ms };
        c.state = state;
        c.pending = true;
    }
    if !flush_timeline(&arc).await {
        let retry = arc.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_secs(2)).await;
            if retry.timeline.lock().unwrap().pending { let _ = flush_timeline(&retry).await; }
        });
    }
    Ok(())
}

/// Opaque id for a PMS time thumb (`/library/metadata/{rk}/thumb/{ms}`). No host or token reaches JS.
#[tauri::command]
pub async fn playback_thumb(p: P<'_>, at_ms: u64) -> Result<Option<String>, String> {
    if at_ms > 48 * 60 * 60 * 1000 { return Ok(None); }
    let arc = p.inner().clone();
    let (mid, rk) = { let c = arc.timeline.lock().unwrap(); (c.mid.clone(), c.rk) };
    if rk == 0 || mid.is_empty() { return Ok(None); }
    Ok(arc.images.register(&mid, &format!("/library/metadata/{rk}/thumb/{at_ms}")))
}

async fn flush_timeline(p: &Arc<Plex>) -> bool {
    let snap = p.timeline.lock().unwrap().clone();
    if snap.rk == 0 || snap.mid.is_empty() || !matches!(snap.state.as_str(), "playing" | "paused" | "stopped") {
        return true;
    }
    let server = match p.servers.lock().unwrap().iter().find(|s| s.machine_id == snap.mid).cloned() {
        Some(s) => s,
        None => { p.timeline.lock().unwrap().pending = true; return false; }
    };
    let Some(conn) = conn_for(p, &server).await else {
        p.timeline.lock().unwrap().pending = true;
        return false;
    };
    let path = "/:/timeline";
    let mut url = match conn.url.join(path) {
        Ok(u) => u,
        Err(_) => { p.timeline.lock().unwrap().pending = true; return false; }
    };
    let key = format!("/library/metadata/{}", snap.rk);
    let q = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("ratingKey", &snap.rk.to_string())
        .append_pair("key", &key)
        .append_pair("state", &snap.state)
        .append_pair("time", &snap.time_ms.to_string())
        .append_pair("duration", &snap.duration_ms.to_string())
        .finish();
    url.set_query(Some(&q));
    let sent = p.egress.send(crate::plex::transport::Method::Get, url, crate::plex::egress::Cred::Server(snap.mid.clone()), Duration::from_secs(15)).await;
    let ok = sent.as_ref().map(|r| (200..300).contains(&r.status)).unwrap_or(false);
    let mut c = p.timeline.lock().unwrap();
    if ok && c.time_ms == snap.time_ms && c.state == snap.state {
        c.pending = false;
    } else {
        c.pending = true;
    }
    ok
}

/// Sign-out and server-epoch wipes. The Home disk snapshot is titles and opaque ids only.
pub(crate) fn wipe_session_disk(p: &Plex) {
    p.prefs.lock().unwrap().home_snap.clear();
    p.mx.drop_home_rows();
}

#[tauri::command]
pub async fn watchlist_list(p: P<'_>) -> Result<Vec<watchlist::WatchCard>, String> {
    watchlist::list(&p.inner().clone()).await
}

#[tauri::command]
pub async fn watchlist_add(p: P<'_>, id: String) -> Result<(), String> {
    watchlist::add(&p.inner().clone(), &id).await
}

#[tauri::command]
pub async fn watchlist_remove(p: P<'_>, rating_key: String) -> Result<(), String> {
    watchlist::remove(&p.inner().clone(), &rating_key).await
}

pub struct ProxyResp { pub status: u16, pub content_type: Option<&'static str>, pub body: Vec<u8>, pub content_range: Option<String> }
impl ProxyResp { fn deny(status: u16) -> Self { ProxyResp { status, content_type: None, body: vec![], content_range: None } } }

/// `plexuw` protocol handler body (§6a H1, N1, N2, M5, L4). Pure inputs so it is testable.
pub async fn proxy_request(p: &Arc<Plex>, method: &str, uri: &str, origin: Option<&str>, referer: Option<&str>, range: Option<&str>) -> ProxyResp {
    let req = match proxy::parse(method, uri, origin, referer) { Ok(r) => r, Err(e) => return ProxyResp::deny(e.status()) };
    let (id, w, h) = match req {
        ProxyReq::Hls { id } | ProxyReq::Media { id } => return play::proxy_bytes(p, &id, range).await,
        ProxyReq::Img { id, w, h } => (id, w, h),
    };
    let Some((mid, path)) = p.images.get(&id) else { return ProxyResp::deny(404) };
    if mid == browse::PUBLIC_MID { return proxy_public(p, &path).await; }
    let Ok((cur, conn)) = p.current() else { return ProxyResp::deny(404) };
    // FU7 §7: an image registered for another server uses only THAT server's own
    // winning connection (egress then binds its own token to its own hosts).
    let conn = if cur == mid { conn } else { match p.conns.lock().unwrap().get(&mid).cloned() { Some(c) => c, None => return ProxyResp::deny(404) } };
    let name = proxy::cache_name(&mid, &path, w, h);
    let file = p.cache_dir.join(&name);
    if let Ok(b) = std::fs::read(&file) {
        if let Some((ct, body)) = b.split_first().and_then(|(t, rest)| proxy::image_type_ok(match t { 1 => "image/jpeg", 2 => "image/png", 3 => "image/webp", 4 => "image/gif", 5 => "image/svg+xml", _ => "" }).map(|c| (c, rest.to_vec()))) {
            return ProxyResp { status: 200, content_type: Some(ct), body, content_range: None };
        }
    }
    let Ok(mut url) = conn.url.join("/photo/:/transcode") else { return ProxyResp::deny(500) };
    url.query_pairs_mut().append_pair("width", &w.to_string()).append_pair("height", &h.to_string())
        .append_pair("minSize", "1").append_pair("upscale", "1").append_pair("url", &path);
    // LOW-5: 20 MB cap enforced while streaming (transport stops reading past it).
    let r = match p.egress.send_capped(crate::plex::transport::Method::Get, url, crate::plex::egress::Cred::Server(mid), Duration::from_secs(20), 20 * 1024 * 1024).await {
        Ok(r) if r.status == 200 => r,
        Ok(_) | Err(_) => return ProxyResp::deny(502),
    };
    let Some(ct) = r.content_type.as_deref().and_then(proxy::image_type_ok) else { return ProxyResp::deny(502) };
    let tag: u8 = match ct { "image/jpeg" => 1, "image/png" => 2, "image/webp" => 3, "image/gif" => 4, _ => 5 };
    let _ = std::fs::create_dir_all(&p.cache_dir);
    let mut buf = Vec::with_capacity(r.body.len() + 1);
    buf.push(tag); buf.extend_from_slice(&r.body);
    let _ = std::fs::write(&file, buf);
    ProxyResp { status: 200, content_type: Some(ct), body: r.body, content_range: None }
}

/// Cast photo or account avatar: no token, allowlisted host, https:443,
/// jpeg/png/webp only, 5 MB cap. Cast photos refuse redirects. An account avatar
/// may take one re-validated hop (`send_public_image`). JS only had the opaque id.
pub const PUBLIC_IMAGE_MAX: usize = 5 * 1024 * 1024;
async fn proxy_public(p: &Arc<Plex>, raw: &str) -> ProxyResp {
    let Some(url) = crate::plex::egress::parse_public_image(raw) else { return ProxyResp::deny(404) };
    let name = proxy::cache_name(browse::PUBLIC_MID, raw, 0, 0);
    let file = p.cache_dir.join(&name);
    let ct_of = |t: u8| match t { 1 => Some("image/jpeg"), 2 => Some("image/png"), 3 => Some("image/webp"), _ => None };
    if let Ok(b) = std::fs::read(&file) {
        if let Some((ct, body)) = b.split_first().and_then(|(t, rest)| ct_of(*t).map(|c| (c, rest.to_vec()))) {
            return ProxyResp { status: 200, content_type: Some(ct), body, content_range: None };
        }
    }
    let r = match p.egress.send_public_image(url, Duration::from_secs(15), PUBLIC_IMAGE_MAX).await {
        Ok(r) if r.status == 200 => r,
        Ok(_) | Err(_) => return ProxyResp::deny(502),
    };
    let tag: u8 = match r.content_type.as_deref().and_then(proxy::image_type_ok) {
        Some("image/jpeg") => 1, Some("image/png") => 2, Some("image/webp") => 3,
        _ => return ProxyResp::deny(502),
    };
    let _ = std::fs::create_dir_all(&p.cache_dir);
    let mut buf = Vec::with_capacity(r.body.len() + 1);
    buf.push(tag); buf.extend_from_slice(&r.body);
    let _ = std::fs::write(&file, buf);
    ProxyResp { status: 200, content_type: ct_of(tag), body: r.body, content_range: None }
}

#[tauri::command]
pub fn prefs_get(p: P<'_>) -> serde_json::Value {
    let mut v = serde_json::to_value(&*p.prefs.lock().unwrap()).unwrap();
    // not needed by JS; selectedServer is a machineId (fu7b: never crosses to JS)
    if let Some(o) = v.as_object_mut() { o.remove("clientId"); o.remove("selectedServer"); }
    v
}

#[tauri::command]
pub fn prefs_set(p: P<'_>, patch: serde_json::Value) -> serde_json::Value {
    p.prefs.lock().unwrap().apply(&patch);
    p.save();
    prefs_get(p)
}

#[cfg(test)]
mod t {
    use super::*;
    use crate::plex::api::ConnKind;
    #[test]
    fn source_views_are_token_free() {
        let c = Conn { url: Url::parse("https://10-0-0-2.0123456789abcdef0123456789abcdef.plex.direct:32400").unwrap(), kind: ConnKind::Local };
        let v = PlexSource { machine_id: "m".into(), name: "Home".into(), owned: true, conn: c }.view();
        let j = serde_json::to_string(&v).unwrap();
        assert!(!j.contains("plex.direct") && !j.contains("10-0-0-2"), "{j}");
    }

    #[test]
    fn account_card_is_name_and_opaque_thumb_only() {
        let img = Images::default();
        let v = serde_json::json!({"email":"a@b.c","id":9,"uuid":"u","username":"moxneo","thumb":"https://metadata-static.plex.tv/users/moxneo.jpg","subscription":{"plan":"plexpass"}});
        let c = account_card(&v, &img);
        assert_eq!(c.name, "moxneo");
        assert_eq!(c.thumb.as_ref().unwrap().len(), 32);
        let js = serde_json::to_string(&c).unwrap();
        assert!(!js.contains("email") && !js.contains('@') && !js.contains("plexpass") && !js.contains("uuid") && !js.contains("metadata-static"));
        assert_eq!(account_card(&serde_json::json!({"username":"a@b.c","title":"ok"}), &img).name, "ok");
        assert_eq!(account_card(&serde_json::json!({"username":"https://evil.example/a","friendlyName":"no/slash"}), &img).name, "");
        let av = account_card(&serde_json::json!({"username":"moxneo","thumb":"https://plex.tv/users/abc/avatar?c=1"}), &img);
        assert_eq!(av.thumb.as_ref().unwrap().len(), 32);
        let aj = serde_json::to_string(&av).unwrap();
        assert!(!aj.contains("plex.tv") && !aj.contains("avatar") && !aj.contains('?'));
        assert!(account_card(&serde_json::json!({"username":"moxneo","thumb":"https://plex.tv/users/abc/avatar?c=1&x=2"}), &img).thumb.is_none());
        assert!(account_card(&serde_json::json!({"username":"moxneo","thumb":"https://evil.example/users/abc/avatar"}), &img).thumb.is_none());
    }

    fn iid(p: &Plex, rk: u64) -> String { p.slots.mint(Target::Item { mid: "fixturemachine0001".into(), rk }) }

    #[cfg(feature = "mockplex")]
    fn fixture_plex(dir: &std::path::Path) -> Arc<Plex> {
        use crate::plex::fixture::FixtureTransport;
        fixture_with(dir, Arc::new(FixtureTransport::default()))
    }

    #[cfg(feature = "mockplex")]
    fn fixture_with(dir: &std::path::Path, ft: Arc<crate::plex::fixture::FixtureTransport>) -> Arc<Plex> {
        use crate::plex::{api::ConnKind, fixture::FIX_SERVER_TOKEN, secrets::MemStore};
        use secrecy::SecretString;
        const CID: &str = "11111111-1111-4111-8111-111111111111";
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        secrets::put(&*store, &secrets::server_key(CID, "fixturemachine0001"), &SecretString::from(FIX_SERVER_TOKEN.to_string())).unwrap();
        let e = Arc::new(Egress::new(ft, store, CID.into()));
        let conn = Conn { url: Url::parse("https://plex.example.com:443").unwrap(), kind: ConnKind::Remote };
        e.bindings.lock().unwrap().servers.insert("fixturemachine0001".into(), ["plex.example.com:443".to_string()].into_iter().collect());
        Arc::new(Plex {
            egress: e, servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(PlexSource { machine_id: "fixturemachine0001".into(), name: "MoxBox".into(), owned: true, conn })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"), slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
        })
    }

    /// Sentinel round 5: plex.tv-CDN cast photos via a narrow, token-less allowlist.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn cast_photo_public_allowlist() {
        let dir = std::env::temp_dir().join(format!("plexuw-cdn-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let ft = std::sync::Arc::new(crate::plex::fixture::FixtureTransport::default());
        let p = fixture_with(&dir, ft.clone());
        let get = |id: String| { let p = p.clone(); async move { proxy_request(&p, "GET", &format!("plexuw://localhost/img/{id}/120x120"), Some("tauri://localhost"), None, None).await } };
        let ok = p.images.register_public("https://metadata-static.plex.tv/people/fixture.jpg").expect("allowlisted");
        assert!(ok.len() == 32 && ok.bytes().all(|b| b.is_ascii_hexdigit()));
        let r = get(ok.clone()).await;
        // 200 proves no token was sent: the fixture CDN answers 401 to any token.
        assert_eq!((r.status, r.content_type), (200, Some("image/jpeg")));
        // Works regardless of the current server (it is not server data) and is cached.
        assert_eq!(get(ok).await.status, 200);
        let av = p.images.register_public("https://plex.tv/users/abc/avatar?c=1").expect("avatar");
        assert_eq!(av.len(), 32);
        assert_eq!(get(av).await.status, 200);
        let bare = p.images.register_public("https://plex.tv/users/abc/avatar").expect("bare avatar");
        assert_eq!(get(bare).await.status, 200);
        let asset = p.images.register_public("https://plex.tv/users/asset/avatar").expect("asset avatar");
        assert_eq!(get(asset).await.status, 200);
        for id in ["evil", "badd", "loop", "qevil", "qmore"] {
            let hid = p.images.register_public(&format!("https://plex.tv/users/{id}/avatar")).unwrap();
            assert_eq!(get(hid).await.status, 502, "{id}");
        }
        let log = ft.log();
        assert!(log.iter().all(|l| !l.contains("evil.example") && !l.contains("i0.wp.com") && !l.contains("secure.gravatar.com") && !l.contains("?x=1") && !l.contains("&x=1")), "{log:?}");
        assert!(log.iter().any(|l| l.contains("https://plex.tv/avatars/F18052/31/3") && !l.contains("token=")));
        assert!(log.iter().any(|l| l.contains("assets.plex.tv/avatars/938d380c8717c545a056e515cf709d254a02a698.?1668821705") && !l.contains("token=")));
        // Registration refuses everything outside the allowlist.
        for bad in [
            "http://metadata-static.plex.tv/people/a.jpg",
            "https://metadata-static.plex.tv:8443/people/a.jpg",
            "https://metadata-static.plex.tv:443/people/a.jpg",
            "https://plex.tv/people/a.jpg",
            "https://plex.tv/api/v2/user",
            "https://plex.tv/users/abc/avatar?c=1&x=2",
            "https://plex.tv/users/abc/avatar?c=1&X-Plex-Token=sekrit",
            "https://plex.tv/users/abc/../avatar",
            "https://plex.tv/users/abc/avatar?c=",
            "https://plex.tv/users/%2e%2e/avatar",
            "http://plex.tv/users/abc/avatar",
            "https://plex.tv:8443/users/abc/avatar",
            "https://plex.tv:443/users/abc/avatar",
            "https://user@plex.tv/users/abc/avatar",
            "https://evil.example/users/abc/avatar",
            "https://metadata-static.plex.tv.evil.example/people/a.jpg",
            "https://evil.example/metadata-static.plex.tv/a.jpg",
            "https://METADATA-STATIC.plex.tv/people/a.jpg",
            "https://user@metadata-static.plex.tv/people/a.jpg",
            "https://metadata-static.plex.tv/people/a.jpg?w=1",
            "https://metadata-static.plex.tv/people/a.jpg#x",
            "https://metadata-static.plex.tv/people/a.gif",
            "https://metadata-static.plex.tv/people/a.svg",
            "https://metadata-static.plex.tv/people/a.jpg.html",
            "https://metadata-static.plex.tv/people/../a.jpg",
            "https://metadata-static.plex.tv/people/%2e%2e/a.jpg",
            "https://metadata-static.plex.tv/people\\a.jpg",
            "https://metadata-static.plex.tv/.jpg",
            "//metadata-static.plex.tv/people/a.jpg",
            "data:image/png;base64,AAAA",
        ] { assert!(p.images.register_public(bad).is_none(), "{bad}"); }
        // Fetch-side negatives: redirect, wrong content type (html, gif, svg), over 5 MB, 404.
        for path in ["redirect.jpg", "html.jpg", "anim.png", "svg.png", "big.jpg", "missing.webp"] {
            let id = p.images.register_public(&format!("https://metadata-static.plex.tv/people/{path}")).unwrap();
            assert_eq!(get(id).await.status, 502, "{path}");
        }
        // Egress refuses a server credential or any other host for this class of request.
        use crate::plex::egress::{check, Cred, Deny};
        let b = p.egress.bindings.lock().unwrap();
        assert_eq!(check(&Url::parse("https://plex.example.com/people/a.jpg").unwrap(), &Cred::PublicImage, &b), Err(Deny::Host));
        assert_eq!(check(&Url::parse("https://metadata-static.plex.tv/library/sections").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert_eq!(check(&Url::parse("https://metadata-static.plex.tv/people/a.jpg").unwrap(), &Cred::Server("fixturemachine0001".into()), &b), Err(Deny::Host));
        assert!(check(&Url::parse("https://plex.tv/users/abc/avatar?c=1").unwrap(), &Cred::PublicImage, &b).is_ok());
        assert_eq!(check(&Url::parse("https://plex.tv/people/a.jpg").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert_eq!(check(&Url::parse("https://plex.tv/api/v2/user").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert_eq!(check(&Url::parse("https://plex.tv/users/abc/avatar?c=1&x=2").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert!(check(&Url::parse("https://plex.tv/avatars/F18052/31/3").unwrap(), &Cred::PublicImage, &b).is_ok());
        assert!(check(&Url::parse("https://assets.plex.tv/avatars/0123456789abcdef0123456789abcdef01234567.").unwrap(), &Cred::PublicImage, &b).is_ok());
        assert!(check(&Url::parse("https://assets.plex.tv/avatars/938d380c8717c545a056e515cf709d254a02a698.?1668821705").unwrap(), &Cred::PublicImage, &b).is_ok());
        assert_eq!(check(&Url::parse("https://assets.plex.tv/avatars/938d380c8717c545a056e515cf709d254a02a698.?x=1").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert_eq!(check(&Url::parse("https://assets.plex.tv/avatars/938d380c8717c545a056e515cf709d254a02a698.?1668821705&x=1").unwrap(), &Cred::PublicImage, &b), Err(Deny::Path));
        assert_eq!(check(&Url::parse("https://secure.gravatar.com/avatar/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef").unwrap(), &Cred::PublicImage, &b), Err(Deny::Host));
        assert_eq!(check(&Url::parse("https://assets.plex.tv/avatars/0123456789abcdef0123456789abcdef01234567.").unwrap(), &Cred::Account, &b), Err(Deny::Host));
    }

    #[cfg(feature = "mockplex")]
    #[test]
    fn low7_sign_out_clears_manual_host_answers() {
        let dir = std::env::temp_dir().join(format!("plexuw-low7-{}", std::process::id()));
        let p = fixture_plex(&dir);
        { let mut t = p.trust.lock().unwrap(); t.set("fixturemachine0001", "plex.example.com:443", true); t.save(&p.trust_path).unwrap(); }
        p.prefs.lock().unwrap().manual_host = "plex.example.com".into();
        assert!(p.trust_path.exists());
        sign_out_inner(&p).unwrap();
        assert!(p.trust.lock().unwrap().answers.is_empty());
        assert!(!p.trust_path.exists());
        assert!(p.prefs.lock().unwrap().manual_host.is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn m2_browse_views_token_free_and_proxy_end_to_end() {
        let dir = std::env::temp_dir().join(format!("plexuw-m2-{}", std::process::id()));
        let p = fixture_plex(&dir);
        let mid = "fixturemachine0001";
        let mut all = String::new();
        let (_, v) = fetch(&p, Api::Sections).await.unwrap();
        all += &serde_json::to_string(&browse::sections(&v)).unwrap();
        let (_, v) = fetch(&p, Api::SectionAll { id: 1, start: 0, size: browse::PAGE, sort: Sort::Title, filter: browse::Filter::None }).await.unwrap();
        let page = browse::page(&v, mid, &p.images);
        all += &serde_json::to_string(&page).unwrap();
        assert_eq!(page.items.len(), 100);
        // filters narrow the set; the A-Z rail counts add up to the filtered total
        let g = browse::Filter::Genre(12);
        let (_, v) = fetch(&p, Api::SectionAll { id: 1, start: 0, size: browse::PAGE, sort: Sort::Title, filter: g.clone() }).await.unwrap();
        let gp = browse::page(&v, mid, &p.images);
        assert!(gp.total > 0 && gp.total < page.total, "{} {}", gp.total, page.total);
        let (_, v) = fetch(&p, Api::FirstCharacter { id: 1, filter: g }).await.unwrap();
        let l = browse::letters(&v);
        assert_eq!(l.iter().map(|x| x.count).sum::<u32>(), gp.total);
        assert!(l.iter().all(|x| x.key.len() == 1));
        let (_, v) = fetch(&p, Api::Metadata(1003)).await.unwrap();
        let it = browse::item_list(&v, mid, &p.images);
        assert_eq!(it[0].media[0].container, "mkv");
        let js = serde_json::to_string(&it).unwrap();
        assert!(!js.contains("not-sent") && !js.contains("/library/parts"), "media leaked a path");
        for api in [Api::Promoted, Api::ContinueWatching, Api::Search("the".into()), Api::Metadata(1013), Api::Children(2000)] {
            let (_, v) = fetch(&p, api).await.unwrap();
            all += &serde_json::to_string(&browse::item_list(&v, mid, &p.images)).unwrap();
            all += &serde_json::to_string(&browse::hub_list(&v, mid, &p.images)).unwrap();
        }
        for bad in ["srv1", "FIXTURE", "X-Plex-Token", "plex.example.com", "/library/", "fixturemachine"] {
            assert!(!all.contains(bad), "view leaked {bad}");
        }
        // proxy: a registered opaque id renders; wrong origin, unknown id, foreign mid do not.
        let id = page.items[0].thumb.clone().expect("thumb id");
        let uri = format!("plexuw://localhost/img/{id}/300x450");
        let r = proxy_request(&p, "GET", &uri, Some("tauri://localhost"), None, None).await;
        assert_eq!(r.status, 200);
        assert_eq!(r.content_type, Some("image/svg+xml"));
        let cached = std::fs::read_dir(&dir.join("imgcache")).unwrap().count();
        assert_eq!(cached, 1);
        for n in std::fs::read_dir(&dir.join("imgcache")).unwrap() {
            let name = n.unwrap().file_name().into_string().unwrap();
            assert!(!name.contains("fixture") && !name.contains("example") && !name.contains("library"), "{name}");
        }
        assert_eq!(proxy_request(&p, "GET", &uri, Some("https://evil.example"), None, None).await.status, 403);
        // N1: both headers absent -> 200 for images. Media is accepted (video element
        // sends neither) and 404s until play_start registers the id. HLS stays 403.
        assert_eq!(proxy_request(&p, "GET", &uri, None, None, None).await.status, 200);
        assert_eq!(proxy_request(&p, "GET", &format!("plexuw://localhost/media/{}", "a".repeat(32)), None, None, None).await.status, 404);
        assert_eq!(proxy_request(&p, "GET", &format!("plexuw://localhost/hls/{}", "a".repeat(32)), None, None, None).await.status, 403);
        assert_eq!(proxy_request(&p, "GET", &uri, None, Some("https://evil.example/"), None).await.status, 403);
        let unk = format!("plexuw://localhost/img/{}/300x450", "0".repeat(32));
        assert_eq!(proxy_request(&p, "GET", &unk, Some("tauri://localhost"), None, None).await.status, 404);
        // L3: sign-out-style clear drops ids and the disk cache
        p.clear_caches();
        assert!(!dir.join("imgcache").exists());
        assert_eq!(proxy_request(&p, "GET", &uri, Some("tauri://localhost"), None, None).await.status, 404);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn details_full_credits_and_inheritance() {
        let dir = std::env::temp_dir().join(format!("plexuw-cr-{}", std::process::id()));
        let p = fixture_plex(&dir);
        let m = browse_item_inner(&p, &iid(&p, 1013)).await.unwrap();
        assert_eq!(m.cast.len(), 6);
        assert_eq!(m.cast.iter().filter(|c| c.thumb.is_some()).count(), 5, "allowlisted CDN photo registers, missing stays None");
        assert!(m.cast.iter().all(|c| c.thumb.as_deref().map_or(true, |t| t.len() == 32 && t.bytes().all(|b| b.is_ascii_hexdigit()))));
        assert_eq!((m.directors.len(), m.writers.len(), m.critic_rating, m.audience_rating), (2, 2, Some(8.1), Some(8.7)));
        let season = browse_item_inner(&p, &iid(&p, 2001)).await.unwrap();
        assert_eq!((season.cast.len(), season.content_rating.as_str(), season.studio.as_str()), (6, "TV-14", "Fixture Pictures"));
        let ep = browse_item_inner(&p, &iid(&p, 2013)).await.unwrap();
        assert_eq!(ep.cast.len(), 7, "show cast + guest");
        assert_eq!(ep.cast.last().unwrap().name, "Nadia Ferro");
        assert_eq!((ep.directors[0].as_str(), ep.writers[0].as_str(), ep.genres.len()), ("K. Brennan", "L. Okonkwo", 2));
        let j = serde_json::to_string(&ep).unwrap();
        assert!(!j.contains("http") && !j.contains("/library/") && !j.contains("token"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Round 5 LOW: a cancelled (or superseded) server switch never commits; the current
    /// server, its prefs and its data stay as they were.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn server_switch_cancel_keeps_current() {
        use crate::plex::{fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN}, secrets::MemStore};
        use secrecy::SecretString;
        let dir = std::env::temp_dir().join(format!("plexuw-cx-{}", std::process::id()));
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        let e = Arc::new(Egress::new(Arc::new(FixtureTransport { second_online: true, ..Default::default() }), store, "cid".into()));
        api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"), slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
        });
        *p.servers.lock().unwrap() = api::load_resources(&e).await.unwrap();
        connect(&p, "fixturemachine0001").await.unwrap();
        // Switch to server 2 starts (my), then the user cancels before it commits.
        let my = p.conn_gen.fetch_add(1, Ordering::SeqCst) + 1;
        let v = cancel_connect(&p);
        assert!(matches!(v, SourceView::Plex { ref server, .. } if server == "MoxBox"));
        assert_eq!(connect_as(&p, "fixturemachine0002", my).await.unwrap_err(), "cancelled");
        assert_eq!(p.current().unwrap().0, "fixturemachine0001");
        assert_eq!(p.prefs.lock().unwrap().selected_server.as_deref(), Some("fixturemachine0001"));
        // A superseded switch (a newer pick started) also never commits.
        let old = p.conn_gen.fetch_add(1, Ordering::SeqCst) + 1;
        let _newer = p.conn_gen.fetch_add(1, Ordering::SeqCst);
        assert!(connect_as(&p, "fixturemachine0002", old).await.is_err());
        assert_eq!(p.current().unwrap().0, "fixturemachine0001");
        // An uncancelled switch still works.
        connect(&p, "fixturemachine0002").await.unwrap();
        assert_eq!(p.current().unwrap().0, "fixturemachine0002");
        // LOW-10: a show lookup for an item from server 1 that completes after the switch
        // to server 2 is dropped instead of merged.
        // fu7b: show_for always asks the item's OWN server (opaque ids carry it), so a
        // switch in between can never merge another server's show.
        let own = show_for(&p, 2000, "fixturemachine0001").await.expect("own server answers");
        assert!(own.cast.iter().all(|c| !c.name.is_empty()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Regression (categories after picking / switching servers): the initial pick and a
    /// switch to a second server must both yield that server's own libraries and genres,
    /// and the old server's section ids must not resolve on the new one.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn categories_reload_on_pick_and_switch() {
        use crate::plex::{fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN}, secrets::MemStore};
        use secrecy::SecretString;
        let dir = std::env::temp_dir().join(format!("plexuw-sw-{}", std::process::id()));
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        let e = Arc::new(Egress::new(Arc::new(FixtureTransport { second_online: true, ..Default::default() }), store, "cid".into()));
        api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"), slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
        });
        *p.servers.lock().unwrap() = api::load_resources(&e).await.unwrap();
        let genres = |v: &serde_json::Value| browse::facets(v).into_iter().map(|f| f.title).collect::<Vec<_>>();
        // 1) initial pick
        connect(&p, "fixturemachine0001").await.unwrap();
        let (_, v) = fetch(&p, Api::Sections).await.unwrap();
        let s1: Vec<_> = browse::sections(&v).into_iter().map(|s| (s.id, s.title)).collect();
        assert_eq!(s1[0], (1, "Movies".to_string()));
        let (_, g) = fetch(&p, Api::SectionFacet { id: 1, facet: Facet::Genre }).await.unwrap();
        assert!(genres(&g).contains(&"Sci-Fi".to_string()));
        // 2) switch to the second server
        let sv = connect(&p, "fixturemachine0002").await.unwrap();
        assert!(serde_json::to_string(&sv).unwrap().contains("Slowpoke"));
        let (_, v) = fetch(&p, Api::Sections).await.unwrap();
        let s2: Vec<_> = browse::sections(&v).into_iter().map(|s| (s.id, s.title)).collect();
        assert_eq!(s2, vec![(7, "Friend Films".to_string()), (8, "Friend Series".to_string())]);
        let (_, g) = fetch(&p, Api::SectionFacet { id: 7, facet: Facet::Genre }).await.unwrap();
        assert_eq!(genres(&g), vec!["Documentary", "Western", "Noir"]);
        assert!(fetch(&p, Api::SectionFacet { id: 1, facet: Facet::Genre }).await.is_err(), "stale section id from server 1");
        // 3) and back again
        connect(&p, "fixturemachine0001").await.unwrap();
        let (_, g) = fetch(&p, Api::SectionFacet { id: 1, facet: Facet::Genre }).await.unwrap();
        assert!(genres(&g).contains(&"Sci-Fi".to_string()));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// FU7 §9: versions fan-out over MoxBox + Slowpoke + BLACKBOX. The serialized views
    /// carry no token, machineId or host; ids are opaque and die on rotation (MUST-3);
    /// a version pick stays Rust-side (MUST-1); a server's token never rides another's host.
    #[tokio::test]
    async fn fu7e_person_and_related_merged_opaque() {
        use crate::plex::{fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN}, secrets::MemStore};
        use secrecy::SecretString;
        let dir = std::env::temp_dir().join(format!("plexuw-fu7e-{}", std::process::id()));
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        let ft = Arc::new(FixtureTransport { second_online: true, ..Default::default() });
        let e = Arc::new(Egress::new(ft.clone(), store, "cid".into()));
        api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"), slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
        });
        p.set_servers(api::load_resources(&e).await.unwrap());
        assert_eq!(p.servers.lock().unwrap().len(), 3);
        // https only, everywhere
        for s in p.servers.lock().unwrap().iter() { for c in &s.conns { assert_eq!(c.url.scheme(), "https", "{}", s.name); } }
        connect(&p, "fixturemachine0001").await.unwrap();
        let it = browse_item_inner(&p, &iid(&p, 1002)).await.unwrap();
        let pid = it.cast[0].id.clone().expect("cast chip has an opaque person id");
        assert_eq!(pid.len(), 24);
        let pv = mx::person(&p, &pid).await.unwrap();
        assert_eq!(pv.name, "Avery Lane");
        assert!(pv.bio.contains("biography lives on Discover") && pv.bio.contains("fictional"), "{}", pv.bio);
        assert!(pv.born.len() == 10 && pv.thumb.as_ref().map(|t| t.len()) == Some(32));
        let pid2 = it.cast[1].id.clone().expect("second cast chip");
        let pv2 = mx::person(&p, &pid2).await.unwrap();
        assert_eq!(pv2.name, "Jun Okafor");
        assert!(pv2.bio.contains("fictional fixture performer") && !pv2.bio.contains("biography lives on Discover") && !pv2.bio.contains("DISCOVER-ONLY"), "{}", pv2.bio);
        let disc: Vec<_> = ft.log().into_iter().filter(|l| l.contains("discover.provider.plex.tv")).collect();
        assert_eq!(disc.len(), 1, "one Discover read, and only for the empty PMS summary: {disc:?}");
        assert!(disc[0].contains("token=acct") && !disc[0].contains('?'), "header-only: {disc:?}");
        assert!(pv.sources.len() >= 2, "tagKey fans out across servers: {:?}", pv.sources);
        let mut seen = std::collections::HashSet::new();
        for i in &pv.items { assert!(seen.insert(i.title.clone()), "dupe {} in filmography", i.title); assert!(["movie", "show"].contains(&i.kind.as_str())); }
        assert!(pv.items.iter().any(|i| i.sources.len() >= 2), "cross-server titles merged into one card");
        let rel = mx::related(&p, &iid(&p, 1002)).await.unwrap();
        assert!(!rel.is_empty() && rel.len() <= 24);
        assert!(rel.iter().all(|r| r.title != it.title), "self excluded");
        let mut seen = std::collections::HashSet::new();
        for r in &rel { assert!(seen.insert(r.title.clone()), "dupe {} in related", r.title); }
        let js = serde_json::to_string(&(&pv, &rel, &it.cast)).unwrap();
        for bad in ["fixturemachine", "5d7768", "\"501\"", "/library/", "X-Plex-Token", "plex.direct", ":32400", "metadata-static"] {
            assert!(!js.contains(bad), "leak {bad}");
        }
        // forged / foreign ids are refused
        assert!(mx::person(&p, &iid(&p, 1002)).await.is_err());
        assert!(mx::person(&p, "0123456789abcdef01234567").await.is_err());
        p.slots.rotate();
        assert!(mx::person(&p, &pid).await.is_err(), "person ids die with the epoch");
    }

    #[tokio::test]
    async fn fu7_s9_versions_fanout_opaque_and_bound() {
        use crate::plex::{fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN}, secrets::MemStore};
        use secrecy::SecretString;
        let dir = std::env::temp_dir().join(format!("plexuw-fu7-{}", std::process::id()));
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        let e = Arc::new(Egress::new(Arc::new(FixtureTransport { second_online: true, ..Default::default() }), store, "cid".into()));
        api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"), slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(), timeline: Default::default(),
        });
        p.set_servers(api::load_resources(&e).await.unwrap());
        assert_eq!(p.servers.lock().unwrap().len(), 3);
        // https only, everywhere
        for s in p.servers.lock().unwrap().iter() { for c in &s.conns { assert_eq!(c.url.scheme(), "https", "{}", s.name); } }
        connect(&p, "fixturemachine0001").await.unwrap();
        let it = browse_item_inner(&p, &iid(&p, 1000)).await.unwrap();
        let names: Vec<_> = it.versions.iter().map(|v| v.server.as_str()).collect();
        assert!(names.contains(&"MoxBox") && names.contains(&"BLACKBOX"), "{names:?}");
        // fu7c §9a split. LIST: pure quality order (SHOULD-3), owned/shared irrelevant.
        let tiers: Vec<u32> = it.versions.iter().map(|v| merge::tier_of(v.height)).collect();
        assert!(tiers.windows(2).all(|w| w[0] >= w[1]), "{names:?}");
        // DEFAULT: best OWNED copy (MUST-2 allowed alternative), not merely the list top.
        let dv = it.default_version.clone().unwrap();
        let d = it.versions.iter().find(|v| v.id == dv).unwrap();
        assert!(d.owned, "{names:?}");
        assert!(it.versions.iter().filter(|v| v.owned).all(|v| merge::tier_of(v.height) <= merge::tier_of(d.height)));
        assert_eq!(it.versions.iter().filter(|v| v.current).count(), 1);
        let js = serde_json::to_string(&it).unwrap();
        for bad in ["fixturemachine", "srv1", "srv4", "FIXTURE", "X-Plex-Token", "plex.direct", "198-51-100", "plex.example.com", ":32400"] {
            assert!(!js.contains(bad), "leak {bad}: {js}");
        }
        // MUST-1: picking stays Rust-side; JS only ever sees `picked: true`
        let bb = it.versions.iter().find(|v| v.server == "BLACKBOX").unwrap().id.clone();
        version_pick_inner(&p, &bb).unwrap();
        let it2 = browse_item_inner(&p, &iid(&p, 1000)).await.unwrap();
        assert!(it2.versions.iter().any(|v| v.server == "BLACKBOX" && v.picked));
        assert!(!serde_json::to_string(&it2).unwrap().contains("fixturemachine0004"));
        // host swap across 3 servers: each server token is bound to its own hosts only
        let conns = p.conns.lock().unwrap().clone();
        let (cur, mox) = p.current().unwrap();
        assert_eq!(cur, "fixturemachine0001");
        let bbc = conns.get("fixturemachine0004").expect("BLACKBOX conn cached").clone();
        for (mid, c) in [("fixturemachine0004", &mox), ("fixturemachine0001", &bbc), ("fixturemachine0002", &bbc), ("fixturemachine0002", &mox)] {
            assert!(browse::get(&e, c, mid, &Api::Sections).await.is_err(), "{mid} token on foreign host");
        }
        assert!(browse::get(&e, &bbc, "fixturemachine0004", &Api::Sections).await.is_ok(), "control");
        // MUST-3: after sign-out/refresh rotation, every old id is a 404
        let old_server = p.slots.server("fixturemachine0002");
        p.set_servers(api::load_resources(&e).await.unwrap());
        assert!(version_pick_inner(&p, &bb).is_err());
        assert!(p.slots.resolve_server(&old_server).is_none());
        assert!(p.conns.lock().unwrap().is_empty());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[cfg(feature = "mockplex")]
    fn b64dec(s: &str) -> Vec<u8> {
        fn v(c: u8) -> u8 { match c { b'A'..=b'Z' => c - b'A', b'a'..=b'z' => c - b'a' + 26, b'0'..=b'9' => c - b'0' + 52, b'+' => 62, b'/' => 63, _ => 0 } }
        let bytes = s.as_bytes();
        let mut out = Vec::new();
        let mut i = 0;
        while i + 4 <= bytes.len() {
            let n = ((v(bytes[i]) as u32) << 18) | ((v(bytes[i + 1]) as u32) << 12) | ((v(bytes[i + 2]) as u32) << 6) | v(bytes[i + 3]) as u32;
            out.push((n >> 16) as u8);
            if bytes[i + 2] != b'=' { out.push((n >> 8) as u8); }
            if bytes[i + 3] != b'=' { out.push(n as u8); }
            i += 4;
        }
        out
    }

    #[cfg(feature = "mockplex")]
    fn hls_ids(body: &str) -> Vec<String> {
        let mut ids = vec![];
        for tok in body.split(|c: char| !c.is_ascii_hexdigit() && c != '/') {
            if let Some(id) = tok.strip_prefix("/hls/") {
                if id.len() == 32 { ids.push(id.to_string()); }
            }
        }
        // also bare /hls/ ids that split kept together
        let mut i = 0;
        while let Some(at) = body[i..].find("/hls/") {
            let s = i + at + 5;
            let id = &body[s..s + 32.min(body.len().saturating_sub(s))];
            if id.len() == 32 && id.bytes().all(|b| b.is_ascii_hexdigit()) && !ids.contains(&id.to_string()) {
                ids.push(id.to_string());
            }
            i = s;
        }
        ids
    }

    /// HEVC/MKV goes through universal HLS: decision, preflight, absolute `/hls/` rewrite, segment prove.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn play_start_hls_preflight_absolute_and_segment() {
        use crate::plex::fixture::FixtureTransport;
        let dir = std::env::temp_dir().join(format!("plexuw-play-hls-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let ft = Arc::new(FixtureTransport::default());
        let p = fixture_with(&dir, ft.clone());
        let id = iid(&p, 1001);
        let out = play::start(&p, &id, None, 0, None).await.expect("hls play");
        assert_eq!(out.kind, "hls");
        assert_eq!(out.duration_ms, 5_460_000);
        assert!(out.url.starts_with("/hls/") && out.url.len() == 5 + 32, "{}", out.url);
        let logs = ft.log();
        assert!(logs.iter().any(|l| l.contains("/video/:/transcode/universal/decision")));
        assert!(logs.iter().any(|l| l.contains("/video/:/transcode/universal/start.m3u8")));
        assert!(logs.iter().any(|l| l.contains("directPlay=0") && l.contains("directStream=0") && l.contains("videoQuality=100")));
        let dec = logs.iter().find(|l| l.contains("/decision")).expect("decision");
        assert!(dec.contains("X-Plex-Client-Profile-Name=Generic"), "{dec}");
        assert!(dec.contains("profile=Generic extra=hls-h264"), "{dec}");
        assert!(dec.contains("videoCodec=h264") && dec.contains("audioCodec=aac"), "{dec}");
        assert!(!dec.contains("copyts") && !dec.contains("WebKit") && !dec.to_ascii_lowercase().contains("htpc"), "{dec}");
        for line in &logs {
            assert!(!line.contains("X-Plex-Token") && !line.contains("FIXTURE"), "{line}");
        }
        let master = out.url.trim_start_matches("/hls/");
        let got = play::opaque(&p, "hls", master).await;
        assert!(got.ok && got.status == 200, "{} {}", got.ok, got.status);
        let body = String::from_utf8(b64dec(&got.body_b64)).unwrap();
        assert!(body.contains("#EXTM3U"));
        assert!(!body.contains("FIXTURE") && !body.contains("http") && !body.contains("plex.example") && !body.contains("X-Plex-Token") && !body.contains("library/streams"), "{body}");
        for line in body.lines().filter(|l| !l.is_empty() && !l.starts_with('#')) {
            assert!(line.starts_with("/hls/") && line.len() == 5 + 32, "{line}");
        }
        let mut ids = hls_ids(&body);
        let mut saw_ts = false;
        let mut guard = 0;
        while let Some(hid) = ids.pop() {
            guard += 1;
            assert!(guard < 16, "playlist walk ran away");
            let g = play::opaque(&p, "hls", &hid).await;
            assert!(g.ok, "opaque {}", g.status);
            let raw = b64dec(&g.body_b64);
            if raw.first() == Some(&0x47) { saw_ts = true; break; }
            if g.content_type.contains("mpegurl") {
                let nested = String::from_utf8_lossy(&raw);
                assert!(nested.starts_with("#EXTM3U") || nested.contains("#EXTM3U"));
                assert!(!nested.contains("FIXTURE") && !nested.contains("http"));
                for line in nested.lines().filter(|l| !l.is_empty() && !l.starts_with('#')) {
                    assert!(line.starts_with("/hls/"), "{line}");
                }
                ids.extend(hls_ids(&nested));
            }
        }
        assert!(saw_ts, "first media byte was not proved");
        assert!(p.hls.len() > 1);
        let kept = master.to_string();
        p.hls.clear();
        let gone = play::opaque(&p, "hls", &kept).await;
        assert!(!gone.ok && gone.status == 404);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Rating key 1007: decision is fine, start.m3u8 is 502, map stays empty.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn play_start_preflight_502_inserts_nothing() {
        use crate::plex::fixture::FixtureTransport;
        let dir = std::env::temp_dir().join(format!("plexuw-play-1007-{}", std::process::id()));
        let ft = Arc::new(FixtureTransport::default());
        let p = fixture_with(&dir, ft.clone());
        let err = play::start(&p, &iid(&p, 1007), None, 0, None).await.unwrap_err();
        assert_eq!(err, "playback (502)");
        assert_eq!(p.hls.len(), 0);
        let logs = ft.log();
        assert!(logs.iter().any(|l| l.contains("start.m3u8")));
        for line in &logs { assert!(!line.contains("X-Plex-Token") && !line.contains("FIXTURE"), "{line}"); }
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Rating key 1008: decision 502. start.m3u8 is never requested.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn play_start_decision_502_skips_playlist() {
        use crate::plex::fixture::FixtureTransport;
        let dir = std::env::temp_dir().join(format!("plexuw-play-1008-{}", std::process::id()));
        let ft = Arc::new(FixtureTransport::default());
        let p = fixture_with(&dir, ft.clone());
        let err = play::start(&p, &iid(&p, 1008), None, 0, None).await.unwrap_err();
        assert_eq!(err, "playback (502)");
        assert_eq!(p.hls.len(), 0);
        let logs = ft.log();
        assert!(logs.iter().any(|l| l.contains("/decision")));
        assert!(!logs.iter().any(|l| l.contains("start.m3u8")), "{logs:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// h264/mp4/aac episode direct-plays. No decision request. Unknown version id falls back.
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn play_start_direct_episode_and_version_fallback() {
        use crate::plex::fixture::FixtureTransport;
        use crate::plex::merge::Target;
        let dir = std::env::temp_dir().join(format!("plexuw-play-direct-{}", std::process::id()));
        let ft = Arc::new(FixtureTransport::default());
        let p = fixture_with(&dir, ft.clone());
        let id = iid(&p, 2011);
        let out = play::start(&p, &id, Some("not-a-version"), 0, None).await.expect("direct");
        assert_eq!(out.kind, "direct");
        assert_eq!(out.duration_ms, 2_700_000);
        assert!(out.url.starts_with("/media/") && out.url.len() == 7 + 32, "{}", out.url);
        let logs = ft.log();
        assert!(!logs.iter().any(|l| l.contains("/decision")), "{logs:?}");
        for line in &logs { assert!(!line.contains("X-Plex-Token") && !line.contains("FIXTURE"), "{line}"); }
        let mid = out.url.trim_start_matches("/media/");
        let r = proxy_request(&p, "GET", &format!("plexuw://localhost/media/{mid}"), None, None, None).await;
        assert_eq!(r.status, 200);
        assert!(r.body.windows(4).any(|w| w == b"ftyp"), "direct body {:?}", r.body);
        // A resolved version id is honored (1007 fails preflight) instead of the item.
        let ver = p.slots.mint(Target::Version { mid: "fixturemachine0001".into(), rating_key: 1007, media: 0, guid: "plex://movie/x".into() });
        let err = play::start(&p, &id, Some(&ver), 0, None).await.unwrap_err();
        assert_eq!(err, "playback (502)");
        assert_eq!(p.hls.len(), 0);
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// fu9p: an existing keychain account token is signed-in while the source is still
    /// the first-run placeholder. That is the cold-start race the Connect card must ignore.
    /// A chunked token round-trips. A different client id does not see it. No token means
    /// no reconnect. The fixture token still reconnects the saved server (no new OAuth).
    #[cfg(feature = "mockplex")]
    #[tokio::test]
    async fn fu9p_keychain_hydrate_signed_in_before_reconnect() {
        use crate::plex::fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN};
        use crate::plex::secrets::{self, MemStore};
        use secrecy::{ExposeSecret, SecretString};
        let dir = std::env::temp_dir().join(format!("plexuw-hyd-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let cid = "85b07b60-1111-4111-8111-111111111111";
        let other = "00000000-0000-4000-8000-000000000000";
        let shell = |store: Arc<dyn SecretStore>, id: &str, server: Option<&str>| {
            let mut prefs = Prefs::default();
            prefs.client_id = id.into();
            prefs.selected_server = server.map(str::to_string);
            prefs.use_demo = true;
            prefs.manual_host = "https://moxneo.example".into();
            Arc::new(Plex {
                egress: Arc::new(Egress::new(Arc::new(FixtureTransport { second_online: true, ..Default::default() }), store, id.into())),
                servers: Mutex::new(vec![]),
                source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
                manual: Mutex::new(None),
                manual_ask: Mutex::new(None),
                trust: Mutex::new(api::Trust::default()),
                trust_path: dir.join("t.json"),
                ai_migrate_failed: false,
                gen: AtomicU64::new(0),
                prefs: Mutex::new(prefs),
                prefs_path: dir.join("s.json"),
                images: Images::default(),
                hls: HlsMap::default(),
                conn_gen: AtomicU64::new(0),
                cache_dir: dir.join("imgcache"),
                slots: Default::default(),
                sticky: Default::default(),
                conns: Default::default(),
                mx: Default::default(), timeline: Default::default(),
            })
        };
        let chunked: Arc<dyn SecretStore> = Arc::new(secrets::Chunked::new(MemStore { max_units: Some(1000), ..MemStore::default() }));
        let long = "k".repeat(2500);
        secrets::put(&*chunked, &secrets::account_key(cid), &SecretString::from(long.clone())).unwrap();
        assert_eq!(chunked.get(&secrets::account_key(cid)).unwrap().unwrap().expose_secret(), &long);
        let pc = shell(chunked, cid, Some("fixturemachine0001"));
        let h = pc.hydrate();
        assert!(h.signed_in && h.keychain == "ok", "chunked token is a session");
        assert_eq!(h.reconnect.as_deref(), Some("fixturemachine0001"));
        assert!(pc.prefs.lock().unwrap().use_demo, "use_demo does not block hydrate");
        assert!(matches!(pc.source.lock().unwrap().view(), SourceView::Demo { reason: "first-run" }));
        let miss = shell(Arc::new(MemStore::default()), cid, Some("fixturemachine0001"));
        let m = miss.hydrate();
        assert!(!m.signed_in && m.reconnect.is_none() && m.keychain == "ok");
        let down = shell(Arc::new(MemStore { unavailable: true, ..MemStore::default() }), cid, Some("fixturemachine0001"));
        let u = down.hydrate();
        assert!(!u.signed_in && u.keychain == "unavailable" && u.reconnect.is_none());
        let store: Arc<dyn SecretStore> = Arc::new(MemStore::default());
        secrets::put(&*store, &secrets::account_key(cid), &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap();
        let p = shell(store.clone(), cid, Some("fixturemachine0001"));
        let foreign = shell(store.clone(), other, Some("fixturemachine0001"));
        assert!(p.hydrate().signed_in);
        assert!(!foreign.hydrate().signed_in, "token is bound to the settings client id");
        assert!(foreign.hydrate().reconnect.is_none());
        let v = reconnect(&p, "fixturemachine0001").await;
        match v {
            SourceView::Plex { ref server, .. } => assert_eq!(server, "MoxBox"),
            other => panic!("expected live server, got {other:?}"),
        }
        assert!(p.signed_in().unwrap());
        secrets::remove(&*store, &secrets::account_key(cid)).unwrap();
        let gone = p.hydrate();
        assert!(!gone.signed_in && gone.reconnect.is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}

/// Screenshot driver only: maps a legacy fixture route segment (raw MoxBox ratingKey / section
/// number) to its opaque id. Compiled, registered and permitted only in the mockplex
/// fixture build (Sentinel LOW-16).
#[cfg(feature = "mockplex")]
#[tauri::command]
pub fn shot_id(p: P<'_>, kind: String, n: u32) -> Result<String, String> {
    use crate::plex::merge::Target;
    let m = "fixturemachine0001".to_string();
    Ok(match (kind.as_str(), n) {
        ("item", _) => p.slots.mint(Target::Item { mid: m, rk: n as u64 }),
        ("sec", 1) => p.slots.mint(Target::Lib("movie".into())),
        ("sec", 2) => p.slots.mint(Target::Lib("show".into())),
        ("sec", _) => p.slots.mint(Target::Section { mid: m, id: n }),
        _ => return Err("bad".into()),
    })
}
