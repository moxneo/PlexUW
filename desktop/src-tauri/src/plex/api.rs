//! plex.tv PIN sign-in (§1, §6a L1), resources (§2), connection race and manual
//! host probe (§2, §6a H2). Tokens never leave Rust: views returned to JS carry none.
use super::egress::{host_port, Cred, Egress, EgressError};
use super::secrets::{self, SecretStore, StoreError};
use super::transport::Method;
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use url::Url;

const PLEX_TV: &str = "https://plex.tv";
const CLIENTS: &str = "https://clients.plex.tv";

#[derive(Deserialize)]
struct PinJson {
    id: u64,
    code: String,
    #[serde(rename = "expiresIn")]
    expires_in: Option<u64>,
    #[serde(rename = "authToken")]
    auth_token: Option<String>,
}

pub struct Pin {
    pub id: u64,
    pub code: String,
    pub expires_in: u64,
    pub strong: bool,
    pub deadline: Instant,
}

#[derive(Debug)]
pub enum ApiError { Egress(EgressError), Parse, Keychain(StoreError), NotOnAccount, Expired, Cancelled, Unreachable, Failed(&'static str) }

/// Fixed connection-failure categories shown to the user (Sentinel follow-up).
/// JS maps each one to fixed text; no raw error text, host, IP, URL or token ever crosses.
pub const CATEGORIES: [&str; 13] = ["unreachable", "timeout", "tls", "not-on-account", "signed-out", "blocked", "keychain",
    "keychain-unavailable", "keychain-toolong", "keychain-timeout", "keychain-stale", "keychain-missing", "signout-incomplete"];

impl ApiError {
    pub fn category(&self) -> &'static str {
        use crate::plex::transport::{E_TIMEOUT, E_TLS};
        match self {
            ApiError::Failed(c) => c,
            ApiError::Egress(EgressError::Net(s)) if s == E_TIMEOUT => "timeout",
            ApiError::Egress(EgressError::Net(s)) if s == E_TLS => "tls",
            ApiError::Egress(EgressError::Net(_)) => "unreachable",
            ApiError::Egress(EgressError::Redirect) | ApiError::Egress(EgressError::Denied(_)) | ApiError::Parse => "blocked",
            ApiError::Egress(EgressError::Status(401)) | ApiError::Egress(EgressError::NoToken) | ApiError::Expired | ApiError::Cancelled => "signed-out",
            ApiError::Egress(EgressError::Status(_)) => "blocked",
            ApiError::Egress(EgressError::Store(e)) | ApiError::Keychain(e) => secrets::category(e),
            ApiError::NotOnAccount => "not-on-account",
            ApiError::Unreachable => "unreachable",
        }
    }
    /// How informative a category is when several race attempts fail.
    fn rank(c: &str) -> u8 { match c { "tls" => 4, "blocked" => 3, "timeout" => 2, _ => 1 } }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::Egress(e) => write!(f, "{e}"),
            ApiError::Parse => write!(f, "unexpected response"),
            ApiError::Keychain(StoreError::Unavailable) => write!(f, "keychain unavailable"),
            ApiError::Keychain(e) => write!(f, "keychain: {e:?}"),
            ApiError::NotOnAccount => write!(f, "that server is not on your Plex account"),
            ApiError::Expired => write!(f, "code expired"),
            ApiError::Cancelled => write!(f, "cancelled"),
            ApiError::Unreachable => write!(f, "no connection to this server answered"),
            ApiError::Failed(c) => write!(f, "{c}"),
        }
    }
}
impl From<EgressError> for ApiError { fn from(e: EgressError) -> Self { ApiError::Egress(e) } }

fn ok_json<T: for<'de> Deserialize<'de>>(r: super::transport::Resp) -> Result<T, ApiError> {
    if !(200..300).contains(&r.status) { return Err(ApiError::Egress(EgressError::Status(r.status))); }
    serde_json::from_slice(&r.body).map_err(|_| ApiError::Parse)
}

/// `strong=false` is the opt-in short `plex.tv/link` code (§6a L1).
pub async fn create_pin(e: &Egress, strong: bool) -> Result<Pin, ApiError> {
    let url = Url::parse(&format!("{PLEX_TV}/api/v2/pins?strong={strong}")).unwrap();
    let p: PinJson = ok_json(e.send(Method::Post, url, Cred::None, Duration::from_secs(10)).await?)?;
    // LOW-11: the code goes into a URL and onto the screen; letters and digits only, 1-32.
    if !pin_code_ok(&p.code) { return Err(ApiError::Parse); }
    // Use the PIN's own expiry; fall back conservatively if the field is missing.
    let expires_in = p.expires_in.unwrap_or(if strong { 1800 } else { 300 }).min(1800);
    let expires_in = if strong { expires_in } else { expires_in.min(300) }; // short code stays short-lived
    Ok(Pin { id: p.id, code: p.code, expires_in, strong, deadline: Instant::now() + Duration::from_secs(expires_in) })
}

/// LOW-11: plex.tv PIN / link code shape: ASCII letters and digits only, 1-32 chars.
pub fn pin_code_ok(c: &str) -> bool { (1..=32).contains(&c.len()) && c.bytes().all(|b| b.is_ascii_alphanumeric()) }

/// Browser URL for the strong PIN. Built here; never logged (§6a L1).
pub fn auth_url(client_id: &str, code: &str) -> String {
    let mut u = Url::parse("https://app.plex.tv/auth").unwrap();
    let frag = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("clientID", client_id)
        .append_pair("code", code)
        .append_pair("context[device][product]", "PlexUW")
        .finish();
    u.set_fragment(Some(&format!("?{frag}")));
    u.to_string()
}

/// L1: plex.tv/link with the short code prefilled. URL form `https://plex.tv/link/?pin=<code>`
/// is from a third-party API description, not official Plex docs; the code stays on
/// screen as the fallback. Not logged.
pub fn link_url(code: &str) -> String {
    let mut u = Url::parse("https://plex.tv/link/").unwrap();
    u.query_pairs_mut().append_pair("pin", code);
    u.to_string()
}

/// Backoff: 1 unit normally; doubles on 429/errors up to 30 units (§6a L1).
pub fn next_delay(cur: u32, failed: bool) -> u32 {
    if failed { (cur.max(1) * 2).min(30) } else { 1 }
}

/// Poll until token, expiry or cancel. `gen` is bumped by cancel/sign-out/quit.
pub async fn poll_pin(e: &Egress, pin: &Pin, gen: &AtomicU64, my_gen: u64, unit: Duration) -> Result<SecretString, ApiError> {
    let url = Url::parse(&format!("{PLEX_TV}/api/v2/pins/{}", pin.id)).unwrap();
    let mut delay = 1u32;
    loop {
        if gen.load(Ordering::SeqCst) != my_gen { return Err(ApiError::Cancelled); }
        if Instant::now() >= pin.deadline { return Err(ApiError::Expired); }
        let failed = match e.send(Method::Get, url.clone(), Cred::None, Duration::from_secs(10)).await {
            Ok(r) if r.status == 200 => match serde_json::from_slice::<PinJson>(&r.body) {
                Ok(PinJson { auth_token: Some(t), .. }) if !t.is_empty() => return Ok(SecretString::from(t)),
                Ok(_) => false,
                Err(_) => true,
            },
            Ok(r) if r.status == 404 => return Err(ApiError::Expired),
            _ => true,
        };
        delay = next_delay(delay, failed);
        tokio::time::sleep(unit * delay).await;
    }
}

/// Store the account token (write + read-back). The PIN id is discarded by the caller.
/// fu7d: keychain I/O is synchronous (Credential Manager / Secret Service D-Bus), so run
/// it on the blocking pool, never on an async worker, under a hard deadline.
pub const KEYCHAIN_TIMEOUT: Duration = Duration::from_secs(20);
pub async fn keychain_blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, StoreError> + Send + 'static) -> Result<T, StoreError> {
    match tokio::time::timeout(KEYCHAIN_TIMEOUT, tokio::task::spawn_blocking(f)).await {
        Ok(Ok(r)) => r,
        Ok(Err(_)) => Err(StoreError::Other("keychain task failed".into())),
        Err(_) => Err(StoreError::Other(secrets::E_TIMEOUT.into())),
    }
}
pub async fn store_account_token_blocking(e: &Egress, t: SecretString) -> Result<(), ApiError> {
    let (st, k) = (e.store.clone(), secrets::account_key(&e.client_id));
    let ep = st.sync().epoch(); // H1: captured before the task can time out
    keychain_blocking(move || secrets::put_at(&*st, &k, &t, ep)).await.map_err(ApiError::Keychain)
}
pub fn store_account_token(e: &Egress, t: &SecretString) -> Result<(), ApiError> {
    secrets::put(&*e.store, &secrets::account_key(&e.client_id), t).map_err(ApiError::Keychain)
}

#[derive(Deserialize)]
struct ConnJson { protocol: String, uri: String, #[serde(default)] local: bool, #[serde(default)] relay: bool }

#[derive(Deserialize)]
struct ResJson {
    name: String,
    #[serde(rename = "clientIdentifier")]
    client_identifier: String,
    #[serde(default)]
    provides: String,
    #[serde(default)]
    owned: bool,
    #[serde(default)]
    presence: bool,
    #[serde(rename = "accessToken")]
    access_token: Option<String>,
    #[serde(default)]
    connections: Vec<ConnJson>,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub enum ConnKind { Local, Remote, Manual, Relay }

#[derive(Clone, Debug)]
pub struct Conn { pub url: Url, pub kind: ConnKind }

#[derive(Clone, Debug)]
pub struct Server { pub machine_id: String, pub name: String, pub owned: bool, pub online: bool, pub conns: Vec<Conn> }

/// What JS sees. No token, no URIs, no IPs (§6a M3, L2).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerView { pub id: String, pub name: String, pub owned: bool, pub online: bool, pub connections: usize }

impl From<&Server> for ServerView {
    fn from(s: &Server) -> Self {
        ServerView { id: String::new(), name: s.name.chars().take(120).collect(), owned: s.owned, online: s.online, connections: s.conns.len() }
    }
}

/// Fetch resources, store each server token, bind each server's exact https hosts.
pub async fn load_resources(e: &Egress) -> Result<Vec<Server>, ApiError> {
    let url = Url::parse(&format!("{CLIENTS}/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=0")).unwrap();
    let list: Vec<ResJson> = ok_json(e.send(Method::Get, url, Cred::Account, Duration::from_secs(15)).await?)?;
    let mut out = vec![];
    for r in list.into_iter().filter(|r| r.provides.split(',').any(|p| p.trim() == "server")) {
        let mid = r.client_identifier;
        if mid.is_empty() || mid.len() > 64 || !mid.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { continue; }
        if let Some(t) = r.access_token.filter(|t| !t.is_empty()) {
            let (st, k, v) = (e.store.clone(), secrets::server_key(&e.client_id, &mid), SecretString::from(t));
            let ep = st.sync().epoch();
            keychain_blocking(move || secrets::put_at(&*st, &k, &v, ep)).await.map_err(ApiError::Keychain)?;
        }
        let mut conns = vec![];
        for c in r.connections {
            let Ok(u) = Url::parse(&c.uri) else { continue };
            if c.protocol != "https" || u.scheme() != "https" { continue; } // insecure: Never in M1
            let kind = if c.relay { ConnKind::Relay } else if c.local { ConnKind::Local } else { ConnKind::Remote };
            conns.push(Conn { url: u, kind });
        }
        {
            let mut b = e.bindings.lock().unwrap();
            let set = b.servers.entry(mid.clone()).or_default();
            for c in &conns { if let Some(hp) = host_port(&c.url) { set.insert(hp); } }
        }
        out.push(Server { machine_id: mid, name: r.name, owned: r.owned, online: r.presence, conns });
    }
    Ok(out)
}

#[derive(Deserialize)]
struct IdentityJson {
    #[serde(rename = "MediaContainer")]
    mc: IdentityMc,
}
#[derive(Deserialize)]
struct IdentityMc {
    #[serde(rename = "machineIdentifier")]
    machine_identifier: String,
}

/// Unauthenticated GET /identity; returns the machineIdentifier.
async fn identity(e: &Egress, base: &Url, timeout: Duration) -> Result<String, ApiError> {
    let url = base.join("/identity").map_err(|_| ApiError::Parse)?;
    let id: IdentityJson = ok_json(e.send(Method::Get, url, Cred::None, timeout).await?)?;
    Ok(id.mc.machine_identifier)
}

/// Staggered race (§2, fu7 fix for the auto-connect timeout): every candidate starts
/// on its own delay instead of waiting for the previous tier to time out.
/// Local + verified manual start at once, Remote after timeout/10, Relay after
/// 3*timeout/10. First connection whose identity matches wins. Worst case is
/// `timeout + 3*timeout/10` (6.5 s at 5 s) instead of the old sum of tiers (up to 20 s).
pub fn stagger(kind: ConnKind, timeout: Duration) -> Duration {
    match kind { ConnKind::Local | ConnKind::Manual => Duration::ZERO, ConnKind::Remote => timeout / 10, ConnKind::Relay => timeout * 3 / 10 }
}

pub async fn race(e: &Egress, s: &Server, manual: Option<&Url>, timeout: Duration) -> Result<Conn, ApiError> {
    let mut cands: Vec<Conn> = s.conns.clone();
    if let Some(u) = manual { cands.push(Conn { url: u.clone(), kind: ConnKind::Manual }); }
    let mut best: &'static str = "unreachable";
    let mut pending: futures::stream::FuturesUnordered<_> = cands.into_iter().map(|c| {
        Box::pin(async move {
            let d = stagger(c.kind, timeout);
            if !d.is_zero() { tokio::time::sleep(d).await; }
            match identity(e, &c.url, timeout).await {
                Ok(m) if m == s.machine_id => Ok(c),
                Ok(_) => Err("unreachable"),
                Err(x) => Err(x.category()),
            }
        })
    }).collect();
    // First match wins (no waiting for slow siblings); failures keep the most informative category.
    while let Some(r) = futures::StreamExt::next(&mut pending).await {
        match r { Ok(c) => return Ok(c), Err(c) => if ApiError::rank(c) > ApiError::rank(best) { best = c; } }
    }
    Err(ApiError::Failed(best))
}

/// Parse user input for the manual server: https only, host[:port], no path/userinfo.
pub fn parse_manual(input: &str) -> Option<Url> {
    let t = input.trim();
    if t.is_empty() || t.len() > 253 { return None; }
    let with = if t.contains("://") { t.to_string() } else { format!("https://{t}") };
    let u = Url::parse(&with).ok()?;
    if u.scheme() != "https" || !u.username().is_empty() || u.password().is_some() { return None; }
    if !(u.path() == "/" || u.path().is_empty()) || u.query().is_some() || u.fragment().is_some() { return None; }
    u.host_str()?;
    Some(u)
}

/// Result of an unauthenticated manual-host probe (§6a H2, Sentinel MED-1).
#[derive(Debug, Clone, PartialEq)]
pub enum Manual {
    /// The host is in that server's plex.tv connection list (or the user already
    /// allowed it for this machineId): it is bound and may receive the server token.
    Bound(String),
    /// The identity matched, but the host is not in the server's connection list.
    /// Nothing is bound; the user must confirm before any token goes there.
    NeedsConfirm(String),
}

/// Manual host: probe WITHOUT a token. Bind it to machine M only if its identity
/// matches a server on the account AND the host:port is in M's resources
/// connections, or the user previously allowed exactly (M, host:port).
/// A matching machineIdentifier alone is not proof: machine ids are not secret.
pub async fn probe_manual(e: &Egress, u: &Url, servers: &[Server], trust: &Trust) -> Result<Manual, ApiError> {
    let hp = host_port(u).ok_or(ApiError::Parse)?;
    e.bindings.lock().unwrap().manual_pending = Some(hp.clone());
    let r = identity(e, u, Duration::from_secs(5)).await;
    e.bindings.lock().unwrap().manual_pending = None;
    let mid = r?;
    let Some(s) = servers.iter().find(|s| s.machine_id == mid) else { return Err(ApiError::NotOnAccount) };
    let listed = s.conns.iter().any(|c| host_port(&c.url).as_deref() == Some(hp.as_str()));
    if listed || trust.get(&mid, &hp) == Some(true) {
        bind_manual(e, &mid, &hp);
        Ok(Manual::Bound(mid))
    } else {
        Ok(Manual::NeedsConfirm(mid))
    }
}

pub fn bind_manual(e: &Egress, mid: &str, hp: &str) {
    e.bindings.lock().unwrap().servers.entry(mid.to_string()).or_default().insert(hp.to_string());
}

/// The user's remembered answers to "send your server token to <host>?", keyed by
/// (machineId, host:port). Kept in its own file, not in settings.json, so prefs_set
/// (which JS can call) can never grant trust.
#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Trust { pub v: u32, pub answers: std::collections::BTreeMap<String, bool> }
impl Trust {
    fn key(mid: &str, hp: &str) -> String { format!("{mid} {hp}") }
    pub fn get(&self, mid: &str, hp: &str) -> Option<bool> { self.answers.get(&Self::key(mid, hp)).copied() }
    pub fn set(&mut self, mid: &str, hp: &str, allow: bool) {
        if self.answers.len() < 64 || self.answers.contains_key(&Self::key(mid, hp)) { self.answers.insert(Self::key(mid, hp), allow); }
    }
    pub fn load(p: &std::path::Path) -> Trust { std::fs::read_to_string(p).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default() }
    pub fn save(&self, p: &std::path::Path) -> std::io::Result<()> {
        if let Some(d) = p.parent() { std::fs::create_dir_all(d)?; }
        let tmp = p.with_extension("json.tmp");
        std::fs::write(&tmp, serde_json::to_vec_pretty(self).unwrap())?;
        std::fs::rename(tmp, p)
    }
}

/// fu7d-fl2 (H3): wipe failures are reported, never hidden. `known_mids` are the current
/// servers, deleted even when the index is unreadable or missed them (fu7c partial index).
pub fn sign_out(e: &Egress, store: &dyn SecretStore, known_mids: &[String]) -> Result<usize, StoreError> {
    *e.bindings.lock().unwrap() = Default::default();
    let mut known = vec![secrets::account_key(&e.client_id)];
    known.extend(known_mids.iter().map(|m| secrets::server_key(&e.client_id, m)));
    secrets::wipe_plex_known(store, &known)
}

#[cfg(test)]
mod t {
    use super::super::fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN, FIX_SERVER_TOKEN};
    use super::super::secrets::MemStore;
    use super::*;
    use std::sync::Arc;

    fn eg(f: FixtureTransport) -> (Arc<FixtureTransport>, Egress) {
        let f = Arc::new(f);
        (f.clone(), Egress::new(f, Arc::new(MemStore::default()), "cid-test".into()))
    }

    #[tokio::test]
    async fn pin_flow_resources_race() {
        let (f, e) = eg(FixtureTransport::default());
        let pin = create_pin(&e, true).await.unwrap();
        assert_eq!(pin.expires_in, 900);
        let g = AtomicU64::new(1);
        let t = poll_pin(&e, &pin, &g, 1, Duration::from_millis(1)).await.unwrap();
        store_account_token(&e, &t).unwrap();
        let servers = load_resources(&e).await.unwrap();
        assert_eq!(servers.len(), 3);
        let home = servers.iter().find(|s| s.name == "MoxBox").unwrap();
        // local is dead in the fixture, remote answers
        let c = race(&e, home, None, Duration::from_millis(200)).await.unwrap();
        assert_eq!(c.kind, ConnKind::Remote);
        // no token was ever sent to a server in M1 (identity is unauthenticated)
        assert!(f.log().iter().filter(|l| l.contains("/identity")).all(|l| !l.contains("token=")));
        // the account token went only to plex.tv hosts
        assert!(f.log().iter().filter(|l| l.contains("token=acct")).all(|l| l.contains("plex.tv/")));
        // Plan P-1: no "local HTTP" tier. The fixture advertises http://10.0.0.2:32400 as a
        // local connection; it must never become a candidate nor be contacted.
        assert!(servers.iter().flat_map(|s| &s.conns).all(|c| c.url.scheme() == "https"));
        assert!(!f.log().iter().any(|l| l.contains("http://")));
    }

    #[tokio::test]
    async fn low11_link_code_validated() {
        for (bad, strong) in [("", false), ("K7Q2/../x", false), ("K7 Q2", false), ("K7Q2?pin=1", false), ("Ab12".repeat(9).as_str(), true), ("ü7Q2", false)] {
            let (_f, e) = eg(FixtureTransport { pin_code: Some(bad.to_string()), ..Default::default() });
            assert!(matches!(create_pin(&e, strong).await, Err(ApiError::Parse)), "{bad:?} accepted");
        }
        for good in ["K", "K7Q2", &"a1".repeat(16)] {
            let (_f, e) = eg(FixtureTransport { pin_code: Some(good.to_string()), ..Default::default() });
            assert_eq!(create_pin(&e, false).await.unwrap().code, good);
        }
    }

    #[tokio::test]
    async fn relay_is_last_resort() {
        let (_f, e) = eg(FixtureTransport { remote_down: true, ..Default::default() });
        let p = create_pin(&e, true).await.unwrap();
        let t = poll_pin(&e, &p, &AtomicU64::new(1), 1, Duration::from_millis(1)).await.unwrap();
        store_account_token(&e, &t).unwrap();
        let s = load_resources(&e).await.unwrap();
        let c = race(&e, &s[0], None, Duration::from_millis(200)).await.unwrap();
        assert_eq!(c.kind, ConnKind::Relay);
    }

    #[tokio::test]
    async fn fu7_manual_beats_relay_when_remote_dead() {
        // B2: the auto cascade spent its budget on dead tiers. Now a verified manual
        // host starts at t=0 and wins before the delayed relay.
        let (_f, e) = eg(FixtureTransport { remote_down: true, ..Default::default() });
        let p = create_pin(&e, true).await.unwrap();
        let t = poll_pin(&e, &p, &AtomicU64::new(1), 1, Duration::from_millis(1)).await.unwrap();
        store_account_token(&e, &t).unwrap();
        let s = load_resources(&e).await.unwrap();
        let home = s.iter().find(|x| x.machine_id == "fixturemachine0001").unwrap();
        let m = parse_manual("plex.example.com").unwrap();
        bind_manual(&e, &home.machine_id, &host_port(&m).unwrap());
        let c = race(&e, home, Some(&m), Duration::from_millis(400)).await.unwrap();
        assert_eq!(c.kind, ConnKind::Manual);
        let to = Duration::from_secs(5);
        assert!(stagger(ConnKind::Local, to).is_zero() && stagger(ConnKind::Manual, to).is_zero());
        assert!(stagger(ConnKind::Remote, to) < stagger(ConnKind::Relay, to));
        assert!(to + stagger(ConnKind::Relay, to) <= Duration::from_millis(6500));
    }

    #[tokio::test]
    async fn expiry_and_cancel() {
        let (_f, e) = eg(FixtureTransport { never_auth: true, short_expiry: true, ..Default::default() });
        let p = create_pin(&e, true).await.unwrap();
        assert!(matches!(poll_pin(&e, &p, &AtomicU64::new(1), 1, Duration::from_millis(5)).await, Err(ApiError::Expired)));
        let p = create_pin(&e, true).await.unwrap();
        let g = AtomicU64::new(2);
        assert!(matches!(poll_pin(&e, &p, &g, 1, Duration::from_millis(1)).await, Err(ApiError::Cancelled)));
    }

    #[test]
    fn backoff() {
        assert_eq!(next_delay(1, false), 1);
        assert_eq!(next_delay(1, true), 2);
        assert_eq!(next_delay(16, true), 30);
        assert_eq!(next_delay(30, false), 1);
    }

    #[tokio::test]
    async fn manual_host_probed_without_token_then_bound() {
        let (f, e) = eg(FixtureTransport::default());
        let p = create_pin(&e, true).await.unwrap();
        let t = poll_pin(&e, &p, &AtomicU64::new(1), 1, Duration::from_millis(1)).await.unwrap();
        store_account_token(&e, &t).unwrap();
        let s = load_resources(&e).await.unwrap();
        let good = parse_manual("plex.example.com").unwrap();
        let mut trust = Trust::default();
        // MED-1: identity matches, but the host is not in the server's connection list -> ask, bind nothing
        assert_eq!(probe_manual(&e, &good, &s, &trust).await.unwrap(), Manual::NeedsConfirm("fixturemachine0001".into()));
        assert!(!e.bindings.lock().unwrap().servers.values().any(|h| h.contains("plex.example.com:443")));
        let probe = f.log().into_iter().find(|l| l.contains("plex.example.com")).unwrap();
        assert!(!probe.contains("token="), "manual probe must be unauthenticated");
        // a remembered "no" still binds nothing
        trust.set("fixturemachine0001", "plex.example.com:443", false);
        assert!(matches!(probe_manual(&e, &good, &s, &trust).await.unwrap(), Manual::NeedsConfirm(_)));
        // remembered "yes" for this exact (machineId, host) binds; another machine id does not inherit it
        trust.set("fixturemachine0001", "plex.example.com:443", true);
        assert_eq!(probe_manual(&e, &good, &s, &trust).await.unwrap(), Manual::Bound("fixturemachine0001".into()));
        assert_eq!(trust.get("fixturemachine0002", "plex.example.com:443"), None);
        // a host that IS in the server's plex.tv connection list binds without asking
        let listed = parse_manual(&format!("https://203-0-113-9.{}.plex.direct:32400", super::super::fixture::HEX)).unwrap();
        assert!(matches!(probe_manual(&e, &listed, &s, &Trust::default()).await.unwrap(), Manual::Bound(_)));
        // impostor: answers with a machine id not on the account -> never bound
        let bad = parse_manual("impostor.example.com").unwrap();
        assert!(matches!(probe_manual(&e, &bad, &s, &trust).await, Err(ApiError::NotOnAccount)));
        assert!(!e.bindings.lock().unwrap().servers.values().any(|h| h.contains("impostor.example.com:443")));
    }

    #[tokio::test]
    async fn redirect_refused() {
        let (_f, e) = eg(FixtureTransport { pins_redirect: true, ..Default::default() });
        assert!(matches!(create_pin(&e, true).await, Err(ApiError::Egress(EgressError::Redirect))));
    }

    #[test]
    fn manual_parse() {
        assert!(parse_manual("plex.example.com").is_some());
        assert!(parse_manual("https://plex.example.com:32400").is_some());
        assert!(parse_manual("http://plex.example.com").is_none());
        assert!(parse_manual("https://u:p@plex.example.com").is_none());
        assert!(parse_manual("https://plex.example.com/x").is_none());
    }

    /// L2: nothing serialised for JS contains a token.
    #[tokio::test]
    async fn views_carry_no_token() {
        let (_f, e) = eg(FixtureTransport::default());
        let p = create_pin(&e, true).await.unwrap();
        let t = poll_pin(&e, &p, &AtomicU64::new(1), 1, Duration::from_millis(1)).await.unwrap();
        store_account_token(&e, &t).unwrap();
        let s = load_resources(&e).await.unwrap();
        let views: Vec<ServerView> = s.iter().map(ServerView::from).collect();
        let j = serde_json::to_string(&views).unwrap();
        assert!(!j.contains(FIX_ACCOUNT_TOKEN) && !j.contains(FIX_SERVER_TOKEN) && !j.contains("plex.direct"));
    }
}

#[cfg(test)]
mod category_tests {
    use super::*;
    use crate::plex::transport::{E_NET, E_TIMEOUT, E_TLS};
    #[test]
    fn failures_map_to_fixed_categories_only() {
        let cases: Vec<(ApiError, &str)> = vec![
            (ApiError::Egress(EgressError::Net(E_TIMEOUT.into())), "timeout"),
            (ApiError::Egress(EgressError::Net(E_TLS.into())), "tls"),
            (ApiError::Egress(EgressError::Net(E_NET.into())), "unreachable"),
            (ApiError::Egress(EgressError::Net("dns error: plex.example.com 203.0.113.9".into())), "unreachable"),
            (ApiError::Egress(EgressError::Redirect), "blocked"),
            (ApiError::Egress(EgressError::Status(403)), "blocked"),
            (ApiError::Parse, "blocked"),
            (ApiError::Egress(EgressError::Status(401)), "signed-out"),
            (ApiError::Egress(EgressError::NoToken), "signed-out"),
            (ApiError::Keychain(StoreError::Unavailable), "keychain-unavailable"),
            // SHOULD-7: each keychain failure has its own fixed category.
            (ApiError::Keychain(StoreError::Other(secrets::E_TOOLONG.into())), "keychain-toolong"),
            (ApiError::Keychain(StoreError::Other(secrets::E_TIMEOUT.into())), "keychain-timeout"),
            (ApiError::Keychain(StoreError::Other(secrets::E_BUSY.into())), "keychain-timeout"),
            (ApiError::Keychain(StoreError::Other(secrets::E_STALE.into())), "keychain-stale"),
            (ApiError::Egress(EgressError::Store(StoreError::Other(secrets::E_MISSING.into()))), "keychain-missing"),
            (ApiError::Keychain(StoreError::Other("weird Element not found 0x490".into())), "keychain"),
            (ApiError::NotOnAccount, "not-on-account"),
            (ApiError::Unreachable, "unreachable"),
        ];
        for (e, want) in cases {
            assert_eq!(e.category(), want);
            assert!(CATEGORIES.contains(&e.category()));
        }
        assert!(ApiError::rank("tls") > ApiError::rank("timeout") && ApiError::rank("timeout") > ApiError::rank("unreachable"));
    }
}
