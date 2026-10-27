//! FU7 merged servers (PLAN-FU7-MERGED-SERVERS.md, Sentinel MUST-1/2/3).
//! - `Slots`: opaque HMAC ids for servers and versions. The key lives only here
//!   (Rust memory), is random per process, and rotates on sign-out and on every
//!   resources refresh; ids minted under an old key no longer resolve (404).
//! - Dedupe keys from Plex GUIDs (plex://, external imdb/tmdb/tvdb, legacy agents).
//! - Version ordering: owned before shared FIRST (MUST-2), then resolution,
//!   bitrate, HDR, connection kind, server name.
//! - `Sticky`: the user's version pick (guid -> machineId) is Rust-side only (MUST-1).
use super::api::ConnKind;
use hmac::{Hmac, Mac};
use serde::Serialize;
use serde_json::Value;
use sha2::Sha256;
use std::collections::HashMap;
use std::sync::Mutex;

pub(crate) fn fresh_key() -> [u8; 32] {
    let mut k = [0u8; 32];
    k[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    k[16..].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    k
}

#[derive(Clone, Debug, PartialEq)]
pub enum Target {
    Server(String),
    Version { mid: String, rating_key: u64, media: usize, guid: String },
    /// fu7b: an item (movie/show/season/episode/collection) on one server.
    Item { mid: String, rk: u64 },
    /// fu7b: a merged per-type library ("movie" | "show") across every server.
    Lib(String),
    /// fu7b: one server's own section (music, photos: not merged).
    Section { mid: String, id: u32 },
    /// fu7b: opaque paging cursor into a Rust-side merged view.
    Cursor { view: String, start: u32 },
    /// fu7e: a person page. `key` is a validated `browse::person_key` (tagKey or tag id),
    /// `mid` the server the credit came from. Never serialised.
    Person { mid: String, key: String },
}

/// Opaque-id registry. Never serialised; ids are 24 hex chars of HMAC-SHA256.
pub struct Slots { inner: Mutex<(([u8; 32], u64), HashMap<String, Target>)> }
impl Default for Slots { fn default() -> Self { Slots { inner: Mutex::new(((fresh_key(), 0), HashMap::new())) } } }
impl Slots {
    fn mac(key: &[u8; 32], msg: &str) -> String {
        let mut m = <Hmac<Sha256> as Mac>::new_from_slice(key).expect("hmac key");
        m.update(msg.as_bytes());
        m.finalize().into_bytes().iter().take(12).map(|b| format!("{b:02x}")).collect()
    }
    pub fn mint(&self, t: Target) -> String {
        let mut g = self.inner.lock().unwrap();
        Self::mint_locked(&mut g, t)
    }
    fn mint_locked(g: &mut (([u8; 32], u64), HashMap<String, Target>), t: Target) -> String {
        let msg = match &t {
            Target::Server(m) => format!("s\0{m}"),
            Target::Version { mid, rating_key, media, .. } => format!("v\0{mid}\0{rating_key}\0{media}"),
            Target::Item { mid, rk } => format!("i\0{mid}\0{rk}"),
            Target::Lib(k) => format!("l\0{k}"),
            Target::Section { mid, id } => format!("c\0{mid}\0{id}"),
            Target::Cursor { view, start } => format!("k\0{view}\0{start}"),
            Target::Person { mid, key } => format!("p\0{mid}\0{key}"),
        };
        let id = Self::mac(&g.0 .0, &msg);
        if g.1.len() > 400_000 { g.1.retain(|_, v| matches!(v, Target::Server(_) | Target::Lib(_) | Target::Section { .. })); }
        g.1.insert(id.clone(), t);
        id
    }
    /// LOW-12: mint only if the key epoch is still `ep` (checked under the same lock),
    /// so a sign-out/refresh that lands mid-load never gets ids minted under the new key.
    pub fn mint_if(&self, ep: u64, t: Target) -> Option<String> {
        let mut g = self.inner.lock().unwrap();
        if g.0 .1 != ep { return None; }
        Some(Self::mint_locked(&mut g, t))
    }
    /// Keyed (rotating) hex MAC for other registries (LOW-13 image ids).
    pub fn keyed(&self, msg: &str) -> (u64, String) { let g = self.inner.lock().unwrap(); (g.0 .1, Self::mac(&g.0 .0, msg)) }
    pub fn server(&self, mid: &str) -> String { self.mint(Target::Server(mid.to_string())) }
    pub fn resolve(&self, id: &str) -> Option<Target> {
        if id.len() != 24 || !id.bytes().all(|b| b.is_ascii_hexdigit()) { return None; }
        self.inner.lock().unwrap().1.get(id).cloned()
    }
    pub fn resolve_server(&self, id: &str) -> Option<String> { match self.resolve(id)? { Target::Server(m) => Some(m), _ => None } }
    /// MUST-3: new key, all slots dropped. Called on sign-out and resources refresh.
    pub fn rotate(&self) { let mut g = self.inner.lock().unwrap(); g.0 = (fresh_key(), g.0 .1 + 1); g.1.clear(); }
    pub fn epoch(&self) -> u64 { self.inner.lock().unwrap().0 .1 }
    pub fn len(&self) -> usize { self.inner.lock().unwrap().1.len() }
}

/// MUST-1: sticky version choice, guid -> machineId. Rust-only; never returned to JS.
#[derive(Default)]
pub struct Sticky(Mutex<HashMap<String, String>>);
impl Sticky {
    pub fn set(&self, guid: &str, mid: &str) { let mut m = self.0.lock().unwrap(); if m.len() > 5000 { m.clear(); } m.insert(guid.to_string(), mid.to_string()); }
    pub fn get(&self, guid: &str) -> Option<String> { self.0.lock().unwrap().get(guid).cloned() }
    pub fn clear(&self) { self.0.lock().unwrap().clear(); }
}

/// Normalised dedupe keys for one item. Empty = never merged (local://, none://, personal media).
pub fn dedupe_keys(kind: &str, guid: &str, ext: &[&str]) -> Vec<String> {
    let mut out = vec![];
    let g = guid.trim();
    if let Some(rest) = g.strip_prefix("plex://") {
        if rest.starts_with(&format!("{kind}/")) && rest.len() < 80 { out.push(format!("plex:{rest}")); }
        return out; // plex GUID is authoritative (conflict rule §5)
    }
    let mut add = |s: &str| if let Some(k) = norm_ext(kind, s) { if !out.contains(&k) { out.push(k); } };
    for e in ext { add(e); }
    add(g);
    out
}
fn norm_ext(kind: &str, s: &str) -> Option<String> {
    let s = s.split('?').next()?.trim();
    let (scheme, id) = s.split_once("://")?;
    let scheme = match scheme {
        "imdb" | "com.plexapp.agents.imdb" => "imdb",
        "tmdb" | "com.plexapp.agents.themoviedb" => "tmdb",
        "tvdb" | "com.plexapp.agents.thetvdb" => "tvdb",
        _ => return None,
    };
    let id = id.split('/').next()?;
    if id.is_empty() || id.len() > 24 || !id.bytes().all(|b| b.is_ascii_alphanumeric()) { return None; }
    Some(format!("{kind}:{scheme}:{id}"))
}

/// Groups items (by index) whose dedupe keys intersect and whose plex keys do not conflict.
pub fn group(items: &[(String, Vec<String>)]) -> Vec<Vec<usize>> {
    let mut groups: Vec<(Vec<usize>, Vec<String>)> = vec![];
    for (i, (_kind, keys)) in items.iter().enumerate() {
        let plex = keys.iter().find(|k| k.starts_with("plex:"));
        let hit = if keys.is_empty() { None } else { groups.iter().position(|(_, gk)| {
            let gp = gk.iter().find(|k| k.starts_with("plex:"));
            match (plex, gp) { (Some(a), Some(b)) => a == b, (Some(_), None) | (None, Some(_)) => false, (None, None) => keys.iter().any(|k| gk.contains(k)) }
        }) };
        match hit { Some(g) => { groups[g].0.push(i); for k in keys { if !groups[g].1.contains(k) { groups[g].1.push(k.clone()); } } } None => groups.push((vec![i], keys.clone())) }
    }
    groups.into_iter().map(|g| g.0).collect()
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Version {
    /// Opaque (Slots); maps to (machineId, ratingKey, media index) only in Rust.
    pub id: String,
    /// Display only, text-rendered.
    pub server: String,
    pub owned: bool,
    pub height: u32,
    pub label: String,
    pub bitrate_kbps: u32,
    pub hdr: bool,
    pub codec: String,
    pub connection: ConnKind,
    pub current: bool,
    pub picked: bool,
}

pub fn height(res: &str) -> u32 {
    match res.to_ascii_lowercase().as_str() { "4k" | "2160" => 2160, "1080" | "1080p" => 1080, "720" | "720p" => 720, "576" => 576, "480" | "sd" => 480, r => r.trim_end_matches('p').parse().unwrap_or(0) }
}
fn tier(h: u32) -> u8 { match h { h if h >= 2160 => 4, h if h >= 1080 => 3, h if h >= 720 => 2, h if h > 0 => 1, _ => 0 } }
fn conn_rank(c: ConnKind) -> u8 { match c { ConnKind::Local => 0, ConnKind::Manual => 1, ConnKind::Remote => 2, ConnKind::Relay => 3 } }
pub fn label(h: u32) -> String { match tier(h) { 4 => "4K".into(), 3 => "1080p".into(), 2 => "720p".into(), 1 => "SD".into(), _ => "Unknown".into() } }

/// MUST-2: owned before shared first, then quality.
/// fu7c (da Vinci SHOULD-3, Scott's spec): the Versions LIST is ordered purely by
/// quality (4K, 1080p, 720p, SD, unknown) regardless of owned/shared.
pub fn tier_of(h: u32) -> u32 { tier(h) as u32 }
pub fn sort_versions(v: &mut [Version]) {
    v.sort_by(|a, b| tier(b.height).cmp(&tier(a.height))
        .then(b.bitrate_kbps.cmp(&a.bitrate_kbps))
        .then(b.hdr.cmp(&a.hdr))
        .then(b.owned.cmp(&a.owned))
        .then(conn_rank(a.connection).cmp(&conn_rank(b.connection)))
        .then(a.server.to_lowercase().cmp(&b.server.to_lowercase())));
}

/// Sentinel MUST-2 (allowed alternative): the copy that supplies card art, metadata and
/// the default Play version is the best OWNED copy when one exists: owned, then quality.
pub fn best_version(v: &[Version]) -> Option<usize> {
    (0..v.len()).min_by(|&i, &j| rank_cmp(&v[i], &v[j]))
}
fn rank_cmp(a: &Version, b: &Version) -> Ordering {
    b.owned.cmp(&a.owned)
        .then(tier(b.height).cmp(&tier(a.height)))
        .then(b.bitrate_kbps.cmp(&a.bitrate_kbps))
        .then(b.hdr.cmp(&a.hdr))
        .then(conn_rank(a.connection).cmp(&conn_rank(b.connection)))
        .then(a.server.to_lowercase().cmp(&b.server.to_lowercase()))
}

/// Versions from one server's raw metadata item. Bounded: at most 8 media per item.
pub fn versions_of(slots: &Slots, ep: u64, guid: &str, mid: &str, server: &str, owned: bool, conn: ConnKind, rating_key: u64, raw: &Value) -> Vec<Version> {
    let clean = |s: &str, n: usize| -> String { s.chars().filter(|c| !c.is_control()).take(n).collect() };
    raw.get("Media").and_then(Value::as_array).map(|a| a.iter().take(8).enumerate().filter_map(|(i, m)| {
        let id = slots.mint_if(ep, Target::Version { mid: mid.to_string(), rating_key, media: i, guid: guid.to_string() })?;
        let h = height(m.get("videoResolution").and_then(Value::as_str).unwrap_or(""));
        let dr = m.get("videoDynamicRange").and_then(Value::as_str).unwrap_or("");
        Some(Version {
            id,
            server: clean(server, 60), owned, height: h, label: label(h),
            bitrate_kbps: m.get("bitrate").and_then(Value::as_u64).unwrap_or(0).min(1_000_000) as u32,
            hdr: dr.to_ascii_uppercase().contains("HDR") || dr.to_ascii_uppercase().contains("DOLBY"),
            codec: clean(&m.get("videoCodec").and_then(Value::as_str).unwrap_or("").to_ascii_uppercase(), 12),
            connection: conn, current: false, picked: false,
        })
    }).collect()).unwrap_or_default()
}

/// A server that has the title but did not send a Media array still lists as a copy.
pub fn version_fallback(slots: &Slots, ep: u64, guid: &str, mid: &str, server: &str, owned: bool, conn: ConnKind, rating_key: u64) -> Option<Version> {
    let id = slots.mint_if(ep, Target::Version { mid: mid.to_string(), rating_key, media: 0, guid: guid.to_string() })?;
    let server: String = server.chars().filter(|c| !c.is_control()).take(60).collect();
    Some(Version { id, server, owned, height: 0, label: label(0), bitrate_kbps: 0, hdr: false, codec: String::new(), connection: conn, current: false, picked: false })
}

/// Validated plex GUID usable as a `/library/all?guid=` query (plex:// only).
pub fn queryable_guid(g: &str) -> Option<String> {
    let rest = g.strip_prefix("plex://")?;
    let (k, id) = rest.split_once('/')?;
    (["movie", "show", "episode", "season"].contains(&k) && !id.is_empty() && id.len() <= 32 && id.bytes().all(|b| b.is_ascii_alphanumeric())).then(|| g.to_string())
}

/// The plex:// id to search: the primary `guid` when it is plex://, else the first `Guid` tag that is.
/// A legacy agent guid (`imdb://`, `com.plexapp.agents.*`) must not skip the other-server scan.
pub fn queryable_guid_of(raw: &Value) -> Option<String> {
    if let Some(g) = raw.get("guid").and_then(Value::as_str).and_then(queryable_guid) { return Some(g); }
    raw.get("Guid").and_then(Value::as_array).into_iter().flatten().take(12)
        .find_map(|g| g.get("id").and_then(Value::as_str).and_then(queryable_guid))
}

// ---- fu7b merged rows: Home rows, hubs, search and library paging (pure, testable).

use super::browse::{Images, Item, Sort};
use std::cmp::Ordering;

/// One item from one server, ids already opaque (Target::Item), plus the Rust-only
/// fields the merge needs. Never serialised.
#[derive(Clone, Debug)]
pub struct Row { pub server: String, pub item: Item, pub keys: Vec<String>, pub added: u64, pub viewed: u64, pub owned: bool, pub rank: usize, pub height: u32, pub tkey: String, pub year: u32, pub rating: f64 }

/// Replace every ratingKey-shaped id on `it` with an opaque Target::Item id minted under
/// epoch `ep`. None if the key rotated meanwhile (LOW-12) or an id is malformed.
pub fn seal(it: &mut Item, mid: &str, slots: &Slots, ep: u64) -> Option<()> {
    for f in [&mut it.id, &mut it.parent_id, &mut it.grandparent_id] {
        if f.is_empty() { continue; }
        let rk: u64 = f.parse().ok()?;
        *f = slots.mint_if(ep, Target::Item { mid: mid.to_string(), rk })?;
    }
    // fu7e: cast chips link to the person page through an opaque id only.
    for c in it.cast.iter_mut() {
        c.id = None;
        if c.key.is_empty() { continue; }
        let m = if c.mid.is_empty() { mid } else { c.mid.as_str() };
        c.id = Some(slots.mint_if(ep, Target::Person { mid: m.to_string(), key: c.key.clone() })?);
    }
    Some(())
}

pub fn title_key(raw: &Value) -> String {
    let t = raw.get("titleSort").or_else(|| raw.get("title")).and_then(Value::as_str).unwrap_or("");
    let t: String = t.chars().take(120).collect::<String>().to_lowercase();
    t.strip_prefix("the ").map(str::to_string).unwrap_or(t)
}

pub fn row(raw: &Value, mid: &str, owned: bool, rank: usize, img: &Images, slots: &Slots, ep: u64) -> Option<Row> {
    let mut item = super::browse::item(raw, mid, img)?;
    seal(&mut item, mid, slots, ep)?;
    let guid = raw.get("guid").and_then(Value::as_str).unwrap_or("");
    let ext: Vec<&str> = raw.get("Guid").and_then(Value::as_array).map(|a| a.iter().take(8).filter_map(|g| g.get("id").and_then(Value::as_str)).collect()).unwrap_or_default();
    let keys = dedupe_keys(&item.kind, guid, &ext);
    let n = |k: &str| raw.get(k).and_then(|x| x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0);
    let height = raw.get("Media").and_then(|m| m.get(0)).and_then(|m| m.get("videoResolution")).and_then(Value::as_str).map(height).unwrap_or(0);
    let mut keys = keys;
    if keys.is_empty() && item.kind == "episode" { if let Some(k) = episode_key(raw) { keys.push(k); } }
    Some(Row { server: String::new(), keys, added: n("addedAt"), viewed: n("lastViewedAt"), owned, rank, height, tkey: title_key(raw),
        year: n("year").min(3000) as u32, rating: raw.get("audienceRating").and_then(Value::as_f64).unwrap_or(0.0), item })
}

/// fu7c: fallback dedupe key for an episode with no guid: show (its plex guid, else its
/// normalised title) + season index + episode index. None when any part is missing.
pub fn episode_key(raw: &Value) -> Option<String> {
    let n = |k: &str| raw.get(k).and_then(|x| x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok())));
    let (s, e) = (n("parentIndex")?, n("index")?);
    let gg = raw.get("grandparentGuid").and_then(Value::as_str).unwrap_or("").trim();
    let show = if let Some(r) = gg.strip_prefix("plex://show/") { if r.is_empty() || r.len() > 64 { return None; } format!("g:{r}") } else {
        let t: String = raw.get("grandparentTitle").and_then(Value::as_str)?.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).take(80).collect();
        if t.is_empty() { return None; } format!("t:{t}") };
    Some(format!("ep:{show}:{s}:{e}"))
}

/// Server names for a group's card, only when the title spans more than one server.
pub fn sources_of<'a>(names: impl Iterator<Item = &'a str>) -> Vec<String> {
    let mut v: Vec<String> = vec![];
    for n in names { if !n.is_empty() && !v.iter().any(|x| x == n) { v.push(n.to_string()); } }
    if v.len() > 1 { v.truncate(8); v } else { vec![] }
}

/// Card choice inside a duplicate group: best OWNED copy (owned, then quality tier,
/// then server rank) — MUST-2 / LOW-14.
fn card_cmp(a: &Row, b: &Row) -> Ordering { b.owned.cmp(&a.owned).then(tier(b.height).cmp(&tier(a.height))).then(a.rank.cmp(&b.rank)) }

/// Collapse duplicates (same GUID keys) to one card. `recent`: progress (offset, watched,
/// last viewed) comes from the most recently viewed copy and rows sort newest first.
pub fn dedupe(rows: Vec<Row>, recent: bool) -> Vec<Row> {
    let keyed: Vec<(String, Vec<String>)> = rows.iter().map(|r| (r.item.kind.clone(), r.keys.clone())).collect();
    let mut slots: Vec<Option<Row>> = rows.into_iter().map(Some).collect();
    let mut out = vec![];
    for g in group(&keyed) {
        let mut m: Vec<Row> = g.iter().filter_map(|&i| slots[i].take()).collect();
        if m.is_empty() { continue; }
        let best = (0..m.len()).min_by(|&a, &b| card_cmp(&m[a], &m[b])).unwrap();
        // Same lastViewedAt: keep the copy that actually has progress. A later server
        // with no offset must not wipe the in-progress copy (Continue Watching hero).
        let newest = (0..m.len()).max_by(|&a, &b| m[a].viewed.cmp(&m[b].viewed)
            .then(m[a].item.view_offset_ms.unwrap_or(0).cmp(&m[b].item.view_offset_ms.unwrap_or(0)))
            .then(b.cmp(&a))).unwrap();
        let stamp = m[newest].viewed;
        let vo = m[newest].item.view_offset_ms.or_else(|| m.iter().filter(|r| r.viewed == stamp).find_map(|r| r.item.view_offset_ms));
        let (w, vd) = (m[newest].item.watched, m[newest].viewed);
        let dur = m.iter().find_map(|r| r.item.duration_ms);
        let poster = m.iter().find_map(|r| r.item.poster.clone());
        let src = sources_of(m.iter().map(|r| r.server.as_str()));
        let mut card = m.swap_remove(best);
        card.item.sources = src;
        if card.item.poster.is_none() { card.item.poster = poster; }
        if card.item.duration_ms.is_none() { card.item.duration_ms = dur; }
        if recent { card.item.view_offset_ms = vo; card.item.watched = w; card.viewed = vd; }
        out.push(card);
    }
    if recent { out.sort_by(|a, b| b.viewed.cmp(&a.viewed)); }
    out
}

/// Hubs from several servers merged by identifier (rank order), each deduped; the
/// "recently added" hubs are re-sorted by addedAt across servers. `cap` items per hub.
pub fn merge_hubs(per: Vec<Vec<(String, String, Vec<Row>)>>, cap: usize) -> Vec<super::browse::Hub> {
    let mut acc: Vec<(String, String, Vec<Row>)> = vec![];
    for hubs in per { for (title, ident, rows) in hubs {
        let k = if ident.is_empty() { title.to_lowercase() } else { ident.clone() };
        match acc.iter_mut().find(|(_, i, _)| *i == k) { Some(h) => h.2.extend(rows), None => acc.push((title, k, rows)) }
    } }
    acc.into_iter().map(|(title, ident, mut rows)| {
        if ident.to_ascii_lowercase().contains("recentlyadded") { rows.sort_by(|a, b| b.added.cmp(&a.added)); }
        let items = dedupe(rows, false).into_iter().take(cap).map(|r| r.item).collect();
        super::browse::Hub { title, ident, items }
    }).filter(|h| !h.items.is_empty()).take(40).collect()
}

/// fu7e person page: one filmography across servers. Movies and shows only, duplicates
/// collapsed with the same GUID rules (best owned card, `sources` when on >1 server),
/// newest first (unknown year last), then title. Capped at 200.
pub fn filmography(rows: Vec<Row>) -> Vec<Item> {
    let rows: Vec<Row> = rows.into_iter().filter(|r| r.item.kind == "movie" || r.item.kind == "show").collect();
    let mut out = dedupe(rows, false);
    out.sort_by(|a, b| b.year.cmp(&a.year).then(a.tkey.cmp(&b.tkey)));
    out.into_iter().take(200).map(|r| r.item).collect()
}

/// fu7e Related row: every related hub of every server's copy flattened in server rank
/// order, the title itself dropped (by opaque id or shared GUID key), then deduped.
pub fn related(per: Vec<Vec<Row>>, self_ids: &[String], self_keys: &[String], cap: usize) -> Vec<Item> {
    let rows: Vec<Row> = per.into_iter().flatten()
        .filter(|r| !self_ids.contains(&r.item.id) && !r.keys.iter().any(|k| self_keys.contains(k)))
        .filter(|r| ["movie", "show"].contains(&r.item.kind.as_str()))
        .collect();
    dedupe(rows, false).into_iter().take(cap).map(|r| r.item).collect()
}

/// Library order across servers (the same order each server pages in), ties: owned
/// first, then server rank — so the card a duplicate keeps is the owned one.
pub fn lib_cmp(sort: Sort, a: &Row, b: &Row) -> Ordering {
    match sort {
        Sort::Title => a.tkey.cmp(&b.tkey),
        Sort::Added => b.added.cmp(&a.added),
        Sort::Year => b.year.cmp(&a.year),
        Sort::Rating => b.rating.partial_cmp(&a.rating).unwrap_or(Ordering::Equal),
    }.then(b.owned.cmp(&a.owned)).then(a.rank.cmp(&b.rank))
}

#[cfg(test)]
mod t {
    use super::*;
    fn r(id: &str, guid: &str, owned: bool, rank: usize, h: u32, viewed: u64, off: u64) -> Row {
        let item = super::super::browse::Item { id: id.into(), kind: "movie".into(), title: id.into(), view_offset_ms: Some(off), ..Default::default() };
        Row { server: String::new(), item, keys: dedupe_keys("movie", guid, &[]), added: 0, viewed, owned, rank, height: h, tkey: id.into(), year: 0, rating: 0.0 }
    }
    #[test]
    fn fu7b_dedupe_best_owned_card_most_recent_progress() {
        let rows = vec![r("shared", "plex://movie/a", false, 0, 2160, 900, 9), r("own1080", "plex://movie/a", true, 1, 1080, 100, 1),
            r("own4k", "plex://movie/a", true, 2, 2160, 500, 5), r("other", "plex://movie/b", true, 0, 720, 950, 7)];
        let out = dedupe(rows, true);
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].item.id, "other", "newest first");
        assert_eq!((out[1].item.id.as_str(), out[1].item.view_offset_ms, out[1].viewed), ("own4k", Some(9), 900));
        let mut has = r("has", "plex://movie/z", true, 0, 2160, 0, 400_000);
        has.item.duration_ms = Some(1_020_000);
        let mut plain = r("plain", "plex://movie/z", false, 1, 1080, 0, 0);
        plain.item.view_offset_ms = None;
        plain.item.poster = Some("show-poster".into());
        let tied = dedupe(vec![has, plain], true);
        assert_eq!(tied[0].item.id, "has", "owned 4K stays the card");
        assert_eq!(tied[0].item.view_offset_ms, Some(400_000), "a tied copy with no offset does not wipe progress");
        assert_eq!(tied[0].item.poster.as_deref(), Some("show-poster"));
        assert_eq!(tied[0].item.duration_ms, Some(1_020_000));
        let mut s = Slots::default();
        let _ = &mut s;
        let ep = s.epoch();
        let mut it = super::super::browse::Item { id: "12".into(), parent_id: "x".into(), ..Default::default() };
        assert!(seal(&mut it, "m", &s, ep).is_none(), "non-numeric parent id refused");
        let mut it = super::super::browse::Item { id: "12".into(), ..Default::default() };
        s.rotate();
        assert!(seal(&mut it, "m", &s, ep).is_none(), "LOW-12: stale epoch mints nothing");
        assert_eq!(s.len(), 0);
    }

    #[test]
    fn fu7e_person_filmography_dedupes_across_servers() {
        let mut a = r("own-a", "plex://movie/a", true, 0, 1080, 0, 0); a.server = "MoxBox".into(); a.year = 2001;
        let mut a2 = r("bb-a", "plex://movie/a", true, 2, 2160, 0, 0); a2.server = "BLACKBOX".into(); a2.year = 2001;
        let mut a3 = r("sh-a", "plex://movie/a", false, 1, 2160, 0, 0); a3.server = "Slowpoke".into(); a3.year = 2001;
        let mut b = r("b", "plex://movie/b", false, 1, 720, 0, 0); b.server = "Slowpoke".into(); b.year = 2010;
        let mut ep = r("ep", "", true, 0, 0, 0, 0); ep.item.kind = "episode".into();
        let mut l1 = r("local1", "local://1", true, 0, 0, 0, 0); l1.year = 1990;
        let mut l2 = r("local2", "local://1", true, 1, 0, 0, 0); l2.year = 1990;
        let out = filmography(vec![a, b, a2, ep, a3, l1, l2]);
        let ids: Vec<_> = out.iter().map(|i| i.id.as_str()).collect();
        // one card per title; owned 4K wins; newest first; episodes dropped; local never merged
        assert_eq!(ids, vec!["b", "bb-a", "local1", "local2"]);
        assert_eq!(out[1].sources, vec!["MoxBox".to_string(), "BLACKBOX".into(), "Slowpoke".into()]);
        assert_eq!(out[1].sources.len(), 3);
        assert!(out[0].sources.is_empty(), "single-server title has no source list");
    }

    #[test]
    fn fu7e_related_dedupes_and_drops_self() {
        let mut x = r("x1", "plex://movie/x", true, 0, 1080, 0, 0); x.server = "MoxBox".into();
        let mut x2 = r("x2", "plex://movie/x", true, 1, 2160, 0, 0); x2.server = "BLACKBOX".into();
        let me = r("self", "plex://movie/me", true, 0, 1080, 0, 0);
        let me_other_server = r("self-bb", "plex://movie/me", true, 1, 1080, 0, 0);
        let y = r("y", "plex://movie/y", true, 0, 1080, 0, 0);
        let mut coll = r("c", "", true, 0, 0, 0, 0); coll.item.kind = "collection".into();
        let out = related(vec![vec![x, me, y.clone(), coll], vec![x2, me_other_server, y]], &["self".to_string()], &dedupe_keys("movie", "plex://movie/me", &[]), 12);
        let ids: Vec<_> = out.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["x2", "y"], "self (both copies) dropped, x merged to the 4K owned copy, y once");
        assert_eq!(out[0].sources.len(), 2);
        assert_eq!(related(vec![vec![r("a", "plex://movie/a", true, 0, 0, 0, 0), r("b", "plex://movie/b", true, 0, 0, 0, 0)]], &[], &[], 1).len(), 1, "cap");
    }

    #[test]
    fn fu7e_cast_person_ids_are_opaque_and_rotate() {
        let s = Slots::default();
        let mut it = super::super::browse::Item { id: "12".into(), cast: vec![
            super::super::browse::Person { name: "A".into(), key: "5d7768fe0000000000000001".into(), mid: "fixturemachine0004".into(), ..Default::default() },
            super::super::browse::Person { name: "B".into(), ..Default::default() }], ..Default::default() };
        seal(&mut it, "fixturemachine0001", &s, s.epoch()).unwrap();
        let pid = it.cast[0].id.clone().unwrap();
        assert_eq!(pid.len(), 24);
        assert_eq!(s.resolve(&pid), Some(Target::Person { mid: "fixturemachine0004".into(), key: "5d7768fe0000000000000001".into() }));
        assert!(it.cast[1].id.is_none(), "no key, no link");
        let j = serde_json::to_string(&it).unwrap();
        assert!(!j.contains("5d7768fe") && !j.contains("fixturemachine"), "{j}");
        s.rotate();
        assert_eq!(s.resolve(&pid), None);
    }

    #[test]
    fn must3_old_ids_404_after_rotation() {
        let s = Slots::default();
        let a = s.server("fixturemachine0001");
        let v = s.mint(Target::Version { mid: "fixturemachine0001".into(), rating_key: 1000, media: 0, guid: String::new() });
        assert_eq!(s.resolve_server(&a).as_deref(), Some("fixturemachine0001"));
        assert!(matches!(s.resolve(&v), Some(Target::Version { rating_key: 1000, .. })));
        assert!(!a.contains("fixture") && a.len() == 24);
        s.rotate();
        assert_eq!(s.resolve(&a), None, "old server id must 404 after rotation");
        assert_eq!(s.resolve(&v), None, "old version id must 404 after rotation");
        assert_ne!(s.server("fixturemachine0001"), a, "new key gives new ids");
        assert_eq!(s.resolve("../../etc"), None);
    }

    #[test]
    fn dedupe_keys_cover_modern_legacy_local() {
        assert_eq!(dedupe_keys("movie", "plex://movie/5d776b59ad5437001f79c6f8", &["imdb://tt0111161"]), vec!["plex:movie/5d776b59ad5437001f79c6f8"]);
        assert_eq!(dedupe_keys("movie", "com.plexapp.agents.imdb://tt0111161?lang=en", &[]), vec!["movie:imdb:tt0111161"]);
        assert_eq!(dedupe_keys("movie", "com.plexapp.agents.themoviedb://278?lang=en", &[]), vec!["movie:tmdb:278"]);
        assert!(dedupe_keys("movie", "local://123", &[]).is_empty());
        assert!(dedupe_keys("movie", "", &[]).is_empty());
        // kind mismatch on a plex guid is rejected
        assert!(dedupe_keys("show", "plex://movie/abc", &[]).is_empty());
    }

    #[test]
    fn group_merges_on_keys_never_on_conflicts_or_local() {
        let it = |k: &str, keys: &[&str]| (k.to_string(), keys.iter().map(|s| s.to_string()).collect::<Vec<_>>());
        let items = vec![
            it("movie", &["plex:movie/a"]), it("movie", &["plex:movie/a"]),          // same plex guid -> merge
            it("movie", &["movie:imdb:tt1"]), it("movie", &["movie:imdb:tt1", "movie:tmdb:9"]), // legacy, ext match -> merge
            it("movie", &["plex:movie/b"]),                                            // conflict: other plex guid -> separate
            it("movie", &[]), it("movie", &[]),                                        // local -> never merged
        ];
        let g = group(&items);
        assert_eq!(g, vec![vec![0, 1], vec![2, 3], vec![4], vec![5], vec![6]]);
    }

    fn v(server: &str, owned: bool, h: u32, br: u32, c: ConnKind) -> Version {
        Version { id: String::new(), server: server.into(), owned, height: h, label: label(h), bitrate_kbps: br, hdr: false, codec: String::new(), connection: c, current: false, picked: false }
    }
    #[test]
    fn should3_list_by_quality_must2_best_owned_for_default() {
        let mut l = vec![v("MoxBox", true, 1080, 8000, ConnKind::Remote), v("Slowpoke", false, 2160, 60000, ConnKind::Local), v("Odd", true, 0, 0, ConnKind::Local), v("BLACKBOX", true, 720, 4000, ConnKind::Relay)];
        sort_versions(&mut l);
        let names: Vec<_> = l.iter().map(|x| (x.server.as_str(), x.height)).collect();
        // LIST: pure quality, shared 4K first, unknown last.
        assert_eq!(names, vec![("Slowpoke", 2160), ("MoxBox", 1080), ("BLACKBOX", 720), ("Odd", 0)]);
        // DEFAULT / card source: best OWNED copy, not the shared 4K at the top of the list.
        assert_eq!(l[best_version(&l).unwrap()].server, "MoxBox");
        // No owned copy at all: the best copy overall.
        let only_shared = vec![v("A", false, 1080, 1, ConnKind::Local), v("B", false, 2160, 1, ConnKind::Local)];
        assert_eq!(only_shared[best_version(&only_shared).unwrap()].server, "B");
    }

    #[test]
    fn fu7c_episode_fallback_key_and_sources() {
        let a = serde_json::json!({"grandparentTitle": "Night Ferry", "parentIndex": 2, "index": 3});
        let b = serde_json::json!({"grandparentTitle": "night  ferry!", "parentIndex": "2", "index": "3"});
        let c = serde_json::json!({"grandparentTitle": "Night Ferry", "parentIndex": 2, "index": 4});
        assert_eq!(episode_key(&a), episode_key(&b));
        assert_ne!(episode_key(&a), episode_key(&c));
        assert!(episode_key(&serde_json::json!({"grandparentTitle": "X", "index": 1})).is_none());
        assert_eq!(episode_key(&serde_json::json!({"grandparentGuid": "plex://show/abc", "grandparentTitle": "X", "parentIndex": 1, "index": 1})).unwrap(), "ep:g:abc:1:1");
        assert!(sources_of(["MoxBox", "MoxBox"].into_iter()).is_empty(), "one server: no source");
        assert_eq!(sources_of(["MoxBox", "Slowpoke", "MoxBox"].into_iter()), vec!["MoxBox", "Slowpoke"]);
    }

    #[test]
    fn versions_are_text_and_opaque() {
        let s = Slots::default();
        let raw = serde_json::json!({"Media": [{"videoResolution": "4k", "bitrate": 40000, "videoCodec": "<b>hevc</b>", "videoDynamicRange": "HDR10"}]});
        let out = versions_of(&s, 0, "plex://movie/a", "fixturemachine0001", "Mox\u{7}Box", true, ConnKind::Local, 1000, &raw);
        let j = serde_json::to_string(&out).unwrap();
        assert!(!j.contains("fixturemachine") && !j.contains("1000") && !j.contains('\u{7}'));
        assert!(out[0].hdr && out[0].label == "4K");
    }

    #[test]
    fn must1_sticky_is_rust_only() {
        // Version (the only thing JS sees) has no machineId/guid field; Sticky has no Serialize.
        let st = Sticky::default();
        st.set("plex://movie/a", "fixturemachine0004");
        assert_eq!(st.get("plex://movie/a").as_deref(), Some("fixturemachine0004"));
        let j = serde_json::to_string(&v("BLACKBOX", true, 1080, 1, ConnKind::Local)).unwrap();
        assert!(!j.contains("machine") && !j.contains("guid"));
    }

    #[test]
    fn queryable_guid_is_strict() {
        assert!(queryable_guid("plex://movie/5d776b59ad5437001f79c6f8").is_some());
        assert!(queryable_guid("plex://movie/a&b=c").is_none());
        assert!(queryable_guid("imdb://tt1").is_none());
        let legacy = serde_json::json!({"guid": "com.plexapp.agents.imdb://tt0133093?lang=en", "Guid": [{"id": "imdb://tt0133093"}, {"id": "plex://movie/5d776b59ad5437001f79c6f8"}]});
        assert_eq!(queryable_guid_of(&legacy).as_deref(), Some("plex://movie/5d776b59ad5437001f79c6f8"));
        assert!(queryable_guid_of(&serde_json::json!({"guid": "imdb://tt1"})).is_none());
        assert_eq!(queryable_guid_of(&serde_json::json!({"guid": "plex://movie/abc"})).as_deref(), Some("plex://movie/abc"));
    }
}
