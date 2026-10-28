//! plex.tv Universal Watchlist via Discover. Account token stays in the header.
//! Paths are the paired allowlist in `egress` (list GET, add/remove PUT).
//! `/library/metadata/*` on Discover is not used.
use super::mx;
use super::Plex;
use crate::plex::browse::{self, Api};
use crate::plex::egress::{self, Cred};
use crate::plex::merge;
use crate::plex::transport::Method;
use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};
use url::Url;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WatchCard {
    pub rating_key: String,
    pub kind: String,
    pub title: String,
    pub year: Option<u32>,
    pub summary: String,
    pub thumb: Option<String>,
    pub art: Option<String>,
    pub poster: Option<String>,
    /// Opaque library id when a connected server owns the title.
    pub play_id: Option<String>,
    /// True after a GUID search finished. Streaming-only titles stay without `playId`.
    pub searched: bool,
    /// plex:// id used for the library scan. Not sent to the page.
    #[serde(skip)]
    search_guid: String,
}

pub async fn list(p: &Arc<Plex>) -> Result<Vec<WatchCard>, String> {
    let mut cards = fetch_all(p).await?;
    if p.current().is_ok() { attach_library(p, &mut cards).await; }
    Ok(cards)
}

pub async fn add(p: &Arc<Plex>, id: &str) -> Result<(), String> {
    let (mid, rk) = mx::item_target(p, id).map_err(|_| "watchlist".to_string())?;
    let v = mx::fetch_on(p, &mid, &Api::Metadata(rk)).await.map_err(|_| "watchlist".to_string())?;
    let raw = v.get("Metadata").and_then(|m| m.get(0)).cloned().unwrap_or(Value::Null);
    let key = browse::watch_key_of(&raw);
    if !egress::watch_rating_key_ok(&key) { return Err("watchlist".into()); }
    action(p, egress::WATCHLIST_ADD_PATH, &key).await
}

pub async fn remove(p: &Arc<Plex>, rating_key: &str) -> Result<(), String> {
    if !egress::watch_rating_key_ok(rating_key) { return Err("watchlist".into()); }
    action(p, egress::WATCHLIST_REMOVE_PATH, rating_key).await
}

async fn action(p: &Plex, path: &str, key: &str) -> Result<(), String> {
    let mut url = discover_url(path)?;
    url.set_query(Some(&format!("ratingKey={key}")));
    let r = p.egress.send(Method::Put, url, Cred::Discover, Duration::from_secs(15)).await.map_err(|_| "watchlist".to_string())?;
    if !(200..300).contains(&r.status) { return Err("watchlist".into()); }
    Ok(())
}

fn discover_url(path: &str) -> Result<Url, String> {
    Url::parse(&format!("https://{}{path}", egress::DISCOVER_HOST)).map_err(|_| "watchlist".to_string())
}

async fn fetch_all(p: &Plex) -> Result<Vec<WatchCard>, String> {
    let mut out = Vec::new();
    let mut start = 0u32;
    for _ in 0..2 {
        let page = fetch_page(p, start).await?;
        let total = page.0;
        let empty = page.1.is_empty();
        out.extend(page.1);
        if out.len() as u32 >= total || empty || out.len() >= 100 { break; }
        start = out.len() as u32;
    }
    Ok(out)
}

async fn fetch_page(p: &Plex, start: u32) -> Result<(u32, Vec<WatchCard>), String> {
    let mut url = discover_url(egress::WATCHLIST_LIST_PATH)?;
    let size = 50u32;
    url.set_query(Some(&format!("X-Plex-Container-Start={start}&X-Plex-Container-Size={size}")));
    let r = p.egress.send(Method::Get, url, Cred::Discover, Duration::from_secs(15)).await.map_err(|_| "watchlist".to_string())?;
    if !(200..300).contains(&r.status) { return Err("watchlist".into()); }
    let v: Value = serde_json::from_slice(&r.body).map_err(|_| "watchlist".to_string())?;
    let mc = v.get("MediaContainer").unwrap_or(&v);
    let total = mc.get("totalSize").and_then(|n| n.as_u64()).unwrap_or(0).min(10_000) as u32;
    let items = mc.get("Metadata").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut cards = Vec::new();
    for raw in items.into_iter().take(50) {
        if let Some(c) = card_of(&raw, &p.images) { cards.push(c); }
    }
    Ok((total, cards))
}

fn discover_poster(raw: &Value, img: &browse::Images) -> Option<String> {
    let take = |s: &str| img.register_public(s);
    for k in ["thumb", "art"] {
        if let Some(id) = raw.get(k).and_then(Value::as_str).and_then(take) { return Some(id); }
    }
    raw.get("Image").and_then(Value::as_array).into_iter().flatten().take(4)
        .find_map(|im| im.get("url").and_then(Value::as_str).and_then(take))
}

fn card_of(raw: &Value, img: &browse::Images) -> Option<WatchCard> {
    let kind = raw.get("type").and_then(Value::as_str).unwrap_or("");
    if kind != "movie" && kind != "show" { return None; }
    let key = raw.get("ratingKey").and_then(Value::as_str).unwrap_or("");
    let key = if egress::watch_rating_key_ok(key) { key.to_string() } else {
        browse::watch_key_of(raw)
    };
    if !egress::watch_rating_key_ok(&key) { return None; }
    let title: String = raw.get("title").and_then(Value::as_str).unwrap_or("Untitled").chars().filter(|c| !c.is_control()).take(200).collect();
    let summary: String = raw.get("summary").and_then(Value::as_str).unwrap_or("").chars().filter(|c| !c.is_control()).take(500).collect();
    let year = raw.get("year").and_then(|n| n.as_u64().or_else(|| n.as_str().and_then(|s| s.parse().ok()))).map(|n| n as u32).filter(|y| (1800..3000).contains(y));
    let search_guid = raw.get("guid").and_then(Value::as_str).and_then(merge::queryable_guid)
        .unwrap_or_else(|| format!("plex://{kind}/{key}"));
    let poster = discover_poster(raw, img);
    Some(WatchCard { rating_key: key, kind: kind.into(), title, year, summary, thumb: poster.clone(), art: None, poster, play_id: None, searched: false, search_guid })
}

fn meta_hit(v: &Value, guid: &str) -> Option<Value> {
    v.get("Metadata").and_then(Value::as_array).into_iter().flatten().find(|x| browse::guid_matches(x, guid)).cloned()
}

/// One server at a time, connected server first. A guid scan that is still in flight
/// is not "not in your library" — `gather` returns at the 1.5s soft deadline while
/// `/library/all?guid=` is allowed 16s.
async fn find_copy(p: &Arc<Plex>, guid: &str, kind: &str) -> (bool, Option<(String, Value)>) {
    let srv = mx::ranked(p);
    if srv.is_empty() || merge::queryable_guid(guid).is_none() { return (false, None); }
    let api = Api::ByGuid { guid: guid.to_string(), type_id: browse::plex_type(kind) };
    let start = Instant::now();
    for s in &srv {
        let key = format!("wl\0{guid}\0{}", s.machine_id);
        let one = [s.clone()];
        loop {
            if start.elapsed() >= mx::VERSION_BUDGET { return (false, None); }
            let g = match mx::gather(p, &key, api.clone(), &one).await {
                Ok(g) => g,
                Err(_) => return (false, None),
            };
            if let Some(raw) = g.got.iter().find_map(|(_, _, v)| meta_hit(v, guid)) {
                return (true, Some((s.machine_id.clone(), raw)));
            }
            if !g.pending { break; }
            tokio::time::sleep(Duration::from_millis(200)).await;
        }
    }
    (true, None)
}

async fn attach_library(p: &Arc<Plex>, cards: &mut [WatchCard]) {
    let mut jobs = tokio::task::JoinSet::new();
    for (i, c) in cards.iter().take(40).enumerate() {
        let guid = c.search_guid.clone();
        let kind = c.kind.clone();
        let p2 = p.clone();
        jobs.spawn(async move {
            let (searched, hit) = find_copy(&p2, &guid, &kind).await;
            (i, searched, hit)
        });
    }
    let mut found: Vec<(usize, bool, Option<(String, Value)>)> = Vec::new();
    while let Some(Ok(x)) = jobs.join_next().await { found.push(x); }
    let ep = p.slots.epoch();
    let img = p.images.fork();
    for (i, searched, hit) in found {
        if i >= cards.len() { continue; }
        cards[i].searched = searched;
        let Some((mid, raw)) = hit else { continue };
        let Some(mut it) = browse::item(&raw, &mid, &img) else { continue };
        if merge::seal(&mut it, &mid, &p.slots, ep).is_none() { continue; }
        cards[i].play_id = Some(it.id);
        if it.thumb.is_some() { cards[i].thumb = it.thumb; }
        if it.poster.is_some() { cards[i].poster = it.poster; }
        if it.art.is_some() { cards[i].art = it.art; }
    }
    if p.slots.epoch() != ep || !p.images.commit(img) {
        for c in cards.iter_mut() { c.play_id = None; c.thumb = None; c.poster = None; c.art = None; }
    }
}

#[cfg(test)]
mod t {
    use super::*;
    use super::super::{connect, wipe_session_disk, HlsMap, Images, MockSource, Plex, Prefs};
    use crate::plex::fixture::{FixtureTransport, FIX_ACCOUNT_TOKEN};
    use crate::plex::secrets::MemStore;
    use crate::plex::transport::Transport;
    use secrecy::SecretString;
    use std::sync::atomic::AtomicU64;
    use std::sync::{Arc, Mutex};

    fn gate_src(s: &str) {
        for m in ["shot_id", "__plexShot", "__PLEXUW_MOCK__", "mockplex"] {
            assert!(!s.contains(m), "{m}");
        }
    }

    #[test]
    fn w_mock_2_watchlist_module_has_no_gate_b_markers() {
        let src = include_str!("watchlist.rs");
        let prod = src.split("#[cfg(test)]").next().unwrap();
        assert!(src.contains("#[cfg(test)]"));
        gate_src(prod);
    }

    async fn harness(tag: &str, token: bool) -> (Arc<Plex>, Arc<FixtureTransport>, std::path::PathBuf) {
        open_harness(tag, token, FixtureTransport { second_online: true, ..Default::default() }).await
    }

    async fn open_harness(tag: &str, token: bool, transport: FixtureTransport) -> (Arc<Plex>, Arc<FixtureTransport>, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("plexuw-wl-{tag}-{}", std::process::id()));
        let ft = Arc::new(transport);
        let store: std::sync::Arc<dyn crate::plex::secrets::SecretStore> = std::sync::Arc::new(MemStore::default());
        let t: std::sync::Arc<dyn Transport> = ft.clone();
        let e = Arc::new(crate::plex::egress::Egress::new(t, store, "cid".into()));
        if token { crate::plex::api::store_account_token(&e, &SecretString::from(FIX_ACCOUNT_TOKEN.to_string())).unwrap(); }
        let p = Arc::new(Plex {
            egress: e.clone(), servers: Mutex::new(vec![]), manual: Mutex::new(None), gen: AtomicU64::new(0),
            manual_ask: Mutex::new(None), trust: Mutex::new(crate::plex::api::Trust::default()), trust_path: dir.join("t.json"), ai_migrate_failed: false,
            source: Mutex::new(Box::new(MockSource { reason: "first-run" })),
            prefs: Mutex::new(Prefs::default()), prefs_path: dir.join("s.json"),
            images: Images::default(), hls: HlsMap::default(), conn_gen: AtomicU64::new(0), cache_dir: dir.join("imgcache"),
            slots: Default::default(), sticky: Default::default(), conns: Default::default(), mx: Default::default(),
        });
        if token {
            p.set_servers(crate::plex::api::load_resources(&e).await.unwrap());
            connect(&p, "fixturemachine0001").await.unwrap();
        }
        (p, ft, dir)
    }

    /// W-MOCK-1: unsigned-in makes no Discover Watchlist HTTP call.
    #[tokio::test]
    async fn w_mock_1_unsigned_makes_no_discover_call() {
        let (p, ft, dir) = harness("unsigned", false).await;
        assert!(list(&p).await.is_err());
        assert!(add(&p, "aaaaaaaaaaaaaaaaaaaaaaaa").await.is_err());
        assert!(remove(&p, "5d7700000000000000000000").await.is_err());
        let log = ft.log();
        assert!(log.iter().all(|l| !l.contains("watchlist") && !l.contains("addToWatchlist")), "{log:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// List/add/remove hit only the locked Discover paths, with the account token header.
    #[tokio::test]
    async fn watchlist_roundtrip_header_token_and_library_play() {
        let (p, ft, dir) = harness("round", true).await;
        let empty = list(&p).await.unwrap();
        assert!(empty.is_empty());
        let h = mx::home(&p).await.unwrap();
        let movie = h.hubs.iter().flat_map(|hub| hub.items.iter()).find(|it| it.kind == "movie" && it.watch_key.len() == 24).expect("movie watch key");
        add(&p, &movie.id).await.unwrap();
        let cards = list(&p).await.unwrap();
        let card = cards.iter().find(|c| c.rating_key == movie.watch_key).expect("listed");
        assert_eq!(card.kind, "movie");
        assert!(card.searched && card.play_id.is_some(), "owned title maps to a library id");
        assert!(!card.title.is_empty());
        remove(&p, &movie.watch_key).await.unwrap();
        let after = list(&p).await.unwrap();
        assert!(after.iter().all(|c| c.rating_key != movie.watch_key));
        let log = ft.log();
        let wl: Vec<_> = log.iter().filter(|l| l.contains("discover.provider.plex.tv") && (l.contains("watchlist") || l.contains("Watchlist"))).collect();
        assert!(wl.iter().any(|l| l.contains("Get ") && l.contains("/library/sections/watchlist/all") && l.contains("token=acct")));
        assert!(wl.iter().any(|l| l.contains("Put ") && l.contains("/actions/addToWatchlist") && l.contains("token=acct") && !l.contains("X-Plex-Token=")));
        assert!(wl.iter().any(|l| l.contains("Put ") && l.contains("/actions/removeFromWatchlist") && l.contains("token=acct")));
        assert!(log.iter().all(|l| !l.contains("X-Plex-Token=")));
        let js = serde_json::to_string(&cards).unwrap();
        for bad in ["token", "plex.direct", "fixturemachine", "srv1"] { assert!(!js.to_ascii_lowercase().contains(bad), "{bad} in {js}"); }
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A rating key that is not in the fixture library stays without Play.
    #[tokio::test]
    async fn streaming_only_has_no_play_id() {
        let (p, ft, dir) = harness("stream", true).await;
        ft.watch.lock().unwrap().push("abcdefabcdefabcdefabcdef".into());
        let cards = list(&p).await.unwrap();
        let c = cards.iter().find(|c| c.rating_key == "abcdefabcdefabcdefabcdef").unwrap();
        assert!(c.searched && c.play_id.is_none());
        assert_eq!(c.title, "Streaming only");
        let poster = c.poster.as_deref().unwrap();
        assert_eq!(poster.len(), 32);
        assert!(poster.bytes().all(|b| b.is_ascii_hexdigit()));
        let js = serde_json::to_string(c).unwrap();
        assert!(!js.contains("metadata-static") && !js.contains("https://") && !js.contains("searchGuid"), "{js}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A library copy that answers after the 1.5s soft deadline still gets a poster.
    /// The old path marked that partial gather "not in your library".
    #[tokio::test]
    async fn slow_guid_scan_still_resolves_library_art() {
        let (p, _ft, dir) = open_harness("slowguid", true, FixtureTransport { second_online: true, guid_delay_ms: 1800, ..Default::default() }).await;
        let h = mx::home(&p).await.unwrap();
        let movie = h.hubs.iter().flat_map(|hub| hub.items.iter()).find(|it| it.kind == "movie" && it.watch_key.len() == 24).expect("movie watch key");
        add(&p, &movie.id).await.unwrap();
        let t0 = std::time::Instant::now();
        let cards = list(&p).await.unwrap();
        let card = cards.iter().find(|c| c.rating_key == movie.watch_key).expect("listed");
        assert!(t0.elapsed() >= Duration::from_millis(1600), "settled at the soft deadline: {:?}", t0.elapsed());
        assert!(card.searched && card.play_id.is_some(), "owned title stays unresolved when the guid scan is slow");
        let poster = card.poster.as_deref().unwrap_or("");
        assert_eq!(poster.len(), 32, "library poster id");
        assert!(!serde_json::to_string(card).unwrap().contains("https://"));
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// W-MOCK-3: the Discover watchlist fixture is not in the production crate.
    #[test]
    fn w_mock_3_fixture_is_test_or_mockplex_only() {
        let m = include_str!("../plex/mod.rs");
        assert!(m.contains("#[cfg(any(test, feature = \"mockplex\"))]"));
        assert!(m.contains("pub mod fixture;"));
    }

    /// W-MOCK-5: sign-out wipe drops the disk snapshot. Further list calls need a token.
    #[tokio::test]
    async fn w_mock_5_wipe_snapshot_and_stop() {
        let (p, ft, dir) = harness("wipe", true).await;
        p.prefs.lock().unwrap().home_snap = "{\"server\":\"Mox\",\"home\":{}}".into();
        wipe_session_disk(&p);
        assert!(p.prefs.lock().unwrap().home_snap.is_empty());
        // Drop the account token the way sign-out does, then prove Discover is not called.
        let _ = p.egress.store;
        crate::plex::secrets::remove(&*p.egress.store, &crate::plex::secrets::account_key(&p.egress.client_id)).unwrap();
        let before = ft.log().len();
        assert!(list(&p).await.is_err());
        let added: Vec<_> = ft.log().into_iter().skip(before).collect();
        assert!(added.iter().all(|l| !l.contains("watchlist")), "{added:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
