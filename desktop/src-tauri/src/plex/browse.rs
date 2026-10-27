//! M2 browsing (§3): typed requests only. JS names *what* it wants (a section id,
//! a rating key, a search string); Rust builds the path, checks it against the
//! egress allowlist, attaches the server token per §6a H2, and returns token-free
//! views. Server strings are control-char stripped and length-capped (§6a M1).
//! Image paths from server metadata are registered here and exposed to JS only as
//! opaque `plexuw` ids (§6a H1, M5).
use super::egress::{image_path_ok, Cred, Egress};
use super::api::{ApiError, Conn};
use super::transport::Method;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

/// Typed request. Each variant maps to exactly one allowlisted path (§6a N2).
#[derive(Debug, Clone, PartialEq)]
pub enum Api {
    Sections,
    ContinueWatching,
    OnDeck,
    Promoted,
    SectionHubs(u32),
    SectionAll { id: u32, start: u32, size: u32, sort: Sort, filter: Filter },
    FirstCharacter { id: u32, filter: Filter },
    SectionFacet { id: u32, facet: Facet },
    SectionCollections(u32),
    CollectionChildren(u64),
    Metadata(u64),
    Children(u64),
    Search(String),
    /// FU7 version fan-out: one validated plex:// GUID (merge::queryable_guid), max 4 hits.
    /// `type_id` is the Plex library type (1 movie, 2 show, 3 season, 4 episode). 0 omits it.
    ByGuid { guid: String, type_id: u8 },
    /// fu7e person page: `/library/people/<key>` (bio, photo). Key = numeric tag id or
    /// the person's tagKey (hex, the same on every server) — see `person_key`.
    Person(String),
    /// fu7e filmography: `/library/people/<key>/media`, first 200 items.
    PersonMedia(String),
    /// fu7e Related row: `/library/metadata/<id>/related` hubs.
    Related(u64),
}

/// fu7e: a person key usable in a `/library/people/<key>` path: the tagKey (16-32 lowercase
/// hex, identical across servers) or else the numeric tag id. Anything else is refused.
pub fn person_key(tag_key: &str, tag_id: &str) -> Option<String> {
    let k = tag_key.trim();
    if (16..=32).contains(&k.len()) && k.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) { return Some(k.to_string()); }
    (!tag_id.is_empty() && tag_id.len() <= 12 && tag_id.bytes().all(|b| b.is_ascii_digit())).then(|| tag_id.to_string())
}
/// True for a tagKey-shaped key (cross-server); numeric tag ids are per server.
pub fn person_key_global(k: &str) -> bool { k.len() >= 16 && !k.bytes().all(|b| b.is_ascii_digit()) }
/// Discover people biographies are addressed by exactly 24 lowercase hex characters.
pub fn discover_person_key(k: &str) -> bool { super::egress::discover_person_path(&format!("/library/people/{k}")) }

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Sort { Title, Added, Year, Rating }
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Facet { Genre, Studio, Year }
/// One typed library filter (Jellyfin-style filter bar / genre and studio tiles).
/// Genre is a numeric tag id, Year a number, Studio a cleaned title (Plex filters
/// studios by name). Each becomes exactly one form-encoded query pair.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum Filter { #[default] None, Genre(u64), Year(u32), Studio(String) }
impl Filter {
    pub fn parse(kind: &str, value: &str) -> Option<Filter> {
        let num = |v: &str| (!v.is_empty() && v.len() <= 12 && v.bytes().all(|b| b.is_ascii_digit())).then(|| v.parse::<u64>().ok()).flatten();
        match kind {
            "" | "none" => Some(Filter::None),
            "genre" => num(value).map(Filter::Genre),
            "year" => num(value).filter(|y| (1800..=2200).contains(y)).map(|y| Filter::Year(y as u32)),
            "studio" => { let c = clean(value.trim(), 120); (!c.is_empty()).then_some(Filter::Studio(c)) }
            _ => None,
        }
    }
    fn pair(&self) -> Option<(&'static str, String)> {
        match self { Filter::None => None, Filter::Genre(g) => Some(("genre", g.to_string())), Filter::Year(y) => Some(("year", y.to_string())), Filter::Studio(s) => Some(("studio", s.clone())) }
    }
}

pub const PAGE: u32 = 100;

impl Api {
    pub fn path_query(&self) -> (String, String) {
        let enc = |pairs: &[(&str, String)]| { let mut s = url::form_urlencoded::Serializer::new(String::new()); for (k, v) in pairs { s.append_pair(k, v); } s.finish() };
        match self {
            Api::Sections => ("/library/sections".into(), String::new()),
            Api::ContinueWatching => ("/hubs/continueWatching".into(), String::new()),
            Api::OnDeck => ("/hubs/home/onDeck".into(), String::new()),
            Api::Promoted => ("/hubs/promoted".into(), enc(&[("count", "20".into())])),
            Api::SectionHubs(id) => (format!("/hubs/sections/{id}"), enc(&[("count", "20".into())])),
            Api::SectionAll { id, start, size, sort, filter } => {
                let mut q = vec![("sort", match sort { Sort::Title => "titleSort", Sort::Added => "addedAt:desc", Sort::Year => "year:desc", Sort::Rating => "audienceRating:desc" }.to_string())];
                q.extend(filter.pair());
                q.push(("X-Plex-Container-Start", start.to_string())); q.push(("X-Plex-Container-Size", (*size).min(PAGE).to_string()));
                (format!("/library/sections/{id}/all"), enc(&q))
            }
            Api::FirstCharacter { id, filter } => (format!("/library/sections/{id}/firstCharacter"), enc(&filter.pair().into_iter().collect::<Vec<_>>())),
            Api::SectionFacet { id, facet } => (format!("/library/sections/{id}/{}", match facet { Facet::Genre => "genre", Facet::Studio => "studio", Facet::Year => "year" }), String::new()),
            Api::SectionCollections(id) => (format!("/library/sections/{id}/collections"), String::new()),
            Api::CollectionChildren(id) => (format!("/library/collections/{id}/children"), String::new()),
            Api::ByGuid { guid, type_id } => {
                let mut pairs = vec![("guid", guid.clone()), ("X-Plex-Container-Start", "0".into()), ("X-Plex-Container-Size", "4".into())];
                // PMS ignores a guid filter on some builds unless `type` is set. Only the four library types.
                if (1..=4).contains(type_id) { pairs.insert(1, ("type", type_id.to_string())); }
                ("/library/all".into(), enc(&pairs))
            }
            Api::Metadata(id) => (format!("/library/metadata/{id}"), enc(&[("includeChapters", "1".into()), ("includeMarkers", "1".into())])),
            Api::Children(id) => (format!("/library/metadata/{id}/children"), String::new()),
            Api::Person(k) => (format!("/library/people/{k}"), String::new()),
            Api::PersonMedia(k) => (format!("/library/people/{k}/media"), enc(&[("X-Plex-Container-Start", "0".into()), ("X-Plex-Container-Size", "200".into())])),
            Api::Related(id) => (format!("/library/metadata/{id}/related"), enc(&[("count", "20".into())])),
            Api::Search(q) => ("/hubs/search".into(), enc(&[("query", q.clone()), ("limit", "20".into())])),
        }
    }
}

/// Server text: strip control characters and cap length (§6a M1). Rendered with textContent in JS.
pub fn clean(s: &str, max: usize) -> String {
    s.chars().filter(|c| !c.is_control() || *c == '\n').take(max).collect()
}

/// Opaque image ids. The id → server-relative path map lives only in Rust.
/// Reserved (not alphanumeric-only, so never a real machine id) owner of plex.tv-CDN photos.
pub const PUBLIC_MID: &str = "@plextv-cdn";

/// LOW-13: ids are HMAC-SHA256 (32 hex) under a random per-process key that rotates with
/// the server/version slots (sign-out, resources refresh); old ids stop resolving.
/// LOW-12: merged/fan-out loads register into a `fork()` and `commit()` only if the
/// key epoch is unchanged, so a stale load never registers images under the new key.
pub struct Images { inner: Mutex<ImgInner> }
struct ImgInner { key: [u8; 32], epoch: u64, map: HashMap<String, (String, String)> }
impl Default for Images { fn default() -> Self { Images { inner: Mutex::new(ImgInner { key: super::merge::fresh_key(), epoch: 0, map: HashMap::new() }) } } }

fn mac32(key: &[u8; 32], msg: &str) -> String {
    use hmac::{Hmac, Mac};
    let mut m = <Hmac<sha2::Sha256> as Mac>::new_from_slice(key).expect("hmac key");
    m.update(msg.as_bytes());
    m.finalize().into_bytes().iter().take(16).map(|b| format!("{b:02x}")).collect()
}

/// Collapse an absolute thumb or a photo-transcode wrapper to a server-relative
/// library image path. One `url=` decode only; the original host is dropped.
fn canonical_image_path(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.starts_with("//") || raw.contains('\\') || raw.contains('@') { return None; }
    let (base, query) = match raw.split_once('?') {
        Some((b, q)) => (b, Some(q.split('#').next().unwrap_or(q))),
        None => (raw.split('#').next().unwrap_or(raw), None),
    };
    let path = path_only(base)?;
    if path == "/photo/:/transcode" {
        let q = query?;
        let url = url::form_urlencoded::parse(q.as_bytes()).find(|(k, _)| k == "url").map(|(_, v)| v.into_owned())?;
        return plain_library_path(&url);
    }
    if image_path_ok(path) { Some(path.to_string()) } else { None }
}

fn path_only(base: &str) -> Option<&str> {
    if let Some(rest) = base.strip_prefix("https://").or_else(|| base.strip_prefix("http://")) {
        let idx = rest.find('/')?;
        if rest[..idx].is_empty() { return None; }
        Some(&rest[idx..])
    } else if base.starts_with('/') {
        Some(base)
    } else {
        None
    }
}

fn plain_library_path(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() || raw.starts_with("//") || raw.contains('\\') || raw.contains('@') { return None; }
    let base = raw.split(['?', '#']).next().unwrap_or(raw);
    let path = path_only(base)?;
    if path == "/photo/:/transcode" { return None; }
    if image_path_ok(path) { Some(path.to_string()) } else { None }
}

impl Images {
    fn put(&self, mid: &str, path: String) -> String {
        let mut g = self.inner.lock().unwrap();
        let id = mac32(&g.key, &format!("{mid}\n{path}"));
        if g.map.len() > 50_000 { g.map.clear(); }
        g.map.insert(id.clone(), (mid.to_string(), path));
        id
    }
    /// Register `path` (from server metadata) for machine `mid`; returns the opaque id.
    /// Absolute and `/photo/:/transcode?url=` forms collapse to the server-relative
    /// library path. The host is never stored or fetched.
    pub fn register(&self, mid: &str, path: &str) -> Option<String> {
        let path = canonical_image_path(path)?;
        Some(self.put(mid, path))
    }
    /// Register a plex.tv-CDN cast photo (validated by `egress::parse_public_image`).
    /// Stored under the reserved machine id `PUBLIC_MID`; JS only ever sees the opaque id.
    pub fn register_public(&self, raw: &str) -> Option<String> {
        let u = crate::plex::egress::parse_public_image(raw)?;
        Some(self.put(PUBLIC_MID, u.to_string()))
    }
    pub fn get(&self, id: &str) -> Option<(String, String)> { self.inner.lock().unwrap().map.get(id).cloned() }
    pub fn clear(&self) { self.inner.lock().unwrap().map.clear(); }
    /// New key + empty map (with Slots::rotate).
    pub fn rotate(&self) { let mut g = self.inner.lock().unwrap(); g.key = super::merge::fresh_key(); g.epoch += 1; g.map.clear(); }
    pub fn epoch(&self) -> u64 { self.inner.lock().unwrap().epoch }
    pub fn len(&self) -> usize { self.inner.lock().unwrap().map.len() }
    /// Scratch registry with the same key and epoch (ids identical to the real ones).
    pub fn fork(&self) -> Images { let g = self.inner.lock().unwrap(); Images { inner: Mutex::new(ImgInner { key: g.key, epoch: g.epoch, map: HashMap::new() }) } }
    /// Move a fork's entries in, only if no rotation happened since `fork()`.
    pub fn commit(&self, f: Images) -> bool {
        let f = f.inner.into_inner().unwrap();
        let mut g = self.inner.lock().unwrap();
        if g.epoch != f.epoch { return false; }
        if g.map.len() + f.map.len() > 50_000 { g.map.clear(); }
        g.map.extend(f.map);
        true
    }
}

pub fn hex16(s: &str) -> String {
    use sha2::{Digest, Sha256};
    let d = Sha256::digest(s.as_bytes());
    d.iter().take(16).map(|b| format!("{b:02x}")).collect()
}

#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Chapter { pub title: String, pub start_ms: u64 }
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Marker { pub kind: String, pub start_ms: u64, pub end_ms: u64 }
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub name: String, pub role: String, pub thumb: Option<String>,
    /// fu7e: opaque person-page id (Target::Person), minted by `merge::seal`; None when the
    /// server gave no usable tag id / tagKey (the chip is then not a link).
    pub id: Option<String>,
    #[serde(skip)] pub key: String,
    #[serde(skip)] pub mid: String,
}

/// fu7e person page view. Token-free; ids opaque; strings cleaned.
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersonView { pub name: String, pub thumb: Option<String>, pub bio: String, pub born: String, pub birthplace: String, pub items: Vec<Item>, pub sources: Vec<String>, pub pending: bool }

fn person_dir(mc: &Value) -> Option<&Value> {
    mc.get("Directory").and_then(|a| a.get(0)).or_else(|| mc.get("Metadata").and_then(|a| a.get(0)))
}
/// Biography text only. Empty when the server (or Discover) sent none.
pub fn person_summary(mc: &Value) -> String { person_dir(mc).map(|d| s(d, "summary", 4000)).unwrap_or_default() }
/// Name/photo/bio from a `/library/people/<key>` reply (Directory or Metadata entry).
pub fn person_detail(mc: &Value, mid: &str, img: &Images) -> Option<(String, Option<String>, String, String, String)> {
    let d = person_dir(mc)?;
    let name = { let t = s(d, "tag", 80); if t.is_empty() { s(d, "title", 80) } else { t } };
    let thumb = d.get("thumb").and_then(Value::as_str).and_then(|p| if p.starts_with('/') { img.register(mid, p) } else { img.register_public(p) });
    let born = { let b = s(d, "birthDate", 10); if b.len() == 10 && b.bytes().all(|c| c.is_ascii_digit() || c == b'-') { b } else { String::new() } };
    Some((name, thumb, person_summary(mc), born, s(d, "birthPlace", 120)))
}
/// File format for the Info panel. Deliberately no Part.file (server filesystem path)
/// and no Part.key (a server URL path).
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo { pub container: String, pub video_codec: String, pub video_resolution: String, pub audio_codec: String, pub audio_channels: Option<u32>, pub bitrate_kbps: Option<u32>, pub size_bytes: Option<u64> }
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Letter { pub key: String, pub count: u32 }

/// One item as JS sees it. No token, no host, no server URL (§6a L2/M3).
#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub parent_title: String,
    pub grandparent_title: String,
    pub parent_id: String,
    pub year: Option<u32>,
    pub index: Option<u32>,
    pub parent_index: Option<u32>,
    pub summary: String,
    pub tagline: String,
    pub content_rating: String,
    pub rating: Option<f64>,
    pub studio: String,
    pub genres: Vec<String>,
    pub duration_ms: Option<u64>,
    pub view_offset_ms: Option<u64>,
    pub watched: bool,
    pub leaf_count: Option<u32>,
    pub viewed_leaf_count: Option<u32>,
    pub child_count: Option<u32>,
    /// Opaque image ids; JS builds `<plexuw origin>/img/<id>/<w>x<h>`.
    pub thumb: Option<String>,
    pub art: Option<String>,
    /// Official 2:3 poster only. Episodes use the show or season poster, never the episode still.
    /// Movies and shows use `thumb`, never wide fanart.
    pub poster: Option<String>,
    pub chapters: Vec<Chapter>,
    pub markers: Vec<Marker>,
    pub cast: Vec<Person>,
    pub directors: Vec<String>,
    pub writers: Vec<String>,
    pub critic_rating: Option<f64>,
    pub audience_rating: Option<f64>,
    /// The show of an episode (for inherited credits).
    pub grandparent_id: String,
    /// YYYY-MM-DD air/release date.
    pub aired: String,
    pub media: Vec<MediaInfo>,
    /// FU7: this title on every connected server, owned-first then quality (MUST-2).
    pub versions: Vec<super::merge::Version>,
    /// fu7b INFO: some servers had not answered by the 1.5 s soft deadline; a
    /// `plex-merge-fill` event follows when they do.
    pub versions_pending: bool,
    /// fu7b: opaque id of the version Play would use (sticky pick, else best owned).
    pub default_version: Option<String>,
    /// fu7c: server names holding this title; set only when it is on MORE than one server.
    pub sources: Vec<String>,
    /// Audio and subtitle labels from this copy's MediaPart. Display text only:
    /// no stream id, key, decision, or URI.
    pub tracks: Vec<AvTrack>,
    #[serde(skip)]
    pub server_hint: String,
}

/// One audio or subtitle row for the play-card More menu.
#[derive(Serialize, Debug, Clone, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AvTrack {
    /// `audio` or `sub`.
    pub kind: String,
    pub label: String,
    pub selected: bool,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Hub { pub title: String, pub ident: String, pub items: Vec<Item> }

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Section { pub id: u32, pub title: String, pub kind: String }

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Page { pub items: Vec<Item>, pub start: u32, pub total: u32, pub cursor: Option<String>, pub partial: bool }

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FacetValue { pub key: String, pub title: String }

fn s(v: &Value, k: &str, max: usize) -> String { v.get(k).and_then(Value::as_str).map(|x| clean(x, max)).unwrap_or_default() }
fn u(v: &Value, k: &str) -> Option<u64> {
    v.get(k).and_then(|x| x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok())))
}
fn digits(v: &Value, k: &str) -> String {
    let x = v.get(k).map(|x| x.as_str().map(str::to_string).unwrap_or_else(|| x.to_string())).unwrap_or_default();
    if !x.is_empty() && x.len() <= 12 && x.bytes().all(|b| b.is_ascii_digit()) { x } else { String::new() }
}
fn tags(v: &Value, k: &str, n: usize) -> Vec<String> {
    v.get(k).and_then(Value::as_array).map(|a| a.iter().take(n).map(|t| s(t, "tag", 80)).filter(|t| !t.is_empty()).collect()).unwrap_or_default()
}

pub fn item(v: &Value, mid: &str, img: &Images) -> Option<Item> {
    let id = digits(v, "ratingKey");
    if id.is_empty() { return None; }
    let kind = s(v, "type", 20);
    let kind = if ["movie", "show", "season", "episode", "artist", "album", "track", "collection", "clip"].contains(&kind.as_str()) { kind } else { "other".into() };
    let reg = |k: &str| v.get(k).and_then(Value::as_str).and_then(|p| img.register(mid, p));
    // Tall hero art is a poster. An episode `thumb` is a scene still; fanart is `art`.
    let poster = match kind.as_str() {
        "episode" => reg("grandparentThumb").or_else(|| reg("parentThumb")),
        "season" => reg("thumb").or_else(|| reg("parentThumb")),
        "movie" | "show" | "collection" => reg("thumb"),
        _ => None,
    };
    Some(Item { versions: vec![], versions_pending: false, default_version: None, sources: vec![], tracks: vec![], server_hint: String::new(),
        id, kind,
        title: s(v, "title", 200),
        parent_title: s(v, "parentTitle", 200),
        grandparent_title: s(v, "grandparentTitle", 200),
        parent_id: digits(v, "parentRatingKey"),
        year: u(v, "year").map(|x| x as u32),
        index: u(v, "index").map(|x| x as u32),
        parent_index: u(v, "parentIndex").map(|x| x as u32),
        summary: s(v, "summary", 2000),
        tagline: s(v, "tagline", 300),
        content_rating: s(v, "contentRating", 20),
        rating: v.get("audienceRating").or(v.get("rating")).and_then(Value::as_f64).map(|r| (r * 10.0).round() / 10.0),
        studio: s(v, "studio", 120),
        genres: tags(v, "Genre", 6),
        duration_ms: u(v, "duration"),
        view_offset_ms: u(v, "viewOffset"),
        watched: u(v, "viewCount").unwrap_or(0) > 0,
        leaf_count: u(v, "leafCount").map(|x| x as u32),
        viewed_leaf_count: u(v, "viewedLeafCount").map(|x| x as u32),
        child_count: u(v, "childCount").map(|x| x as u32),
        thumb: reg("thumb").or_else(|| reg("grandparentThumb")).or_else(|| reg("parentThumb")).or_else(|| reg("composite")),
        art: reg("art").or_else(|| reg("grandparentArt")),
        poster,
        chapters: v.get("Chapter").and_then(Value::as_array).map(|a| a.iter().take(200).map(|c| Chapter { title: s(c, "tag", 120), start_ms: u(c, "startTimeOffset").unwrap_or(0) }).collect()).unwrap_or_default(),
        markers: v.get("Marker").and_then(Value::as_array).map(|a| a.iter().take(20).filter_map(|m| {
            let k = s(m, "type", 20);
            ["intro", "credits", "commercial", "recap"].contains(&k.as_str()).then(|| Marker { kind: k, start_ms: u(m, "startTimeOffset").unwrap_or(0), end_ms: u(m, "endTimeOffset").unwrap_or(0) })
        }).collect()).unwrap_or_default(),
        // Person photos only via the image proxy: a server-relative path registers on the
        // server; a plex.tv-CDN URL registers only if it passes the narrow allowlist
        // (fetched token-less); anything else is dropped and the UI shows initials.
        cast: v.get("Role").and_then(Value::as_array).map(|a| a.iter().take(30).map(|r| Person {
            name: s(r, "tag", 80), role: s(r, "role", 80),
            key: person_key(&s(r, "tagKey", 40), &digits(r, "id")).unwrap_or_default(), mid: mid.to_string(), id: None,
            thumb: r.get("thumb").and_then(Value::as_str).and_then(|p| if p.starts_with('/') { img.register(mid, p) } else { img.register_public(p) }) }).collect()).unwrap_or_default(),
        writers: tags(v, "Writer", 5),
        critic_rating: v.get("rating").and_then(Value::as_f64).map(|r| (r * 10.0).round() / 10.0),
        audience_rating: v.get("audienceRating").and_then(Value::as_f64).map(|r| (r * 10.0).round() / 10.0),
        grandparent_id: digits(v, "grandparentRatingKey"),
        aired: { let d = s(v, "originallyAvailableAt", 10); if d.len() == 10 && d.bytes().all(|b| b.is_ascii_digit() || b == b'-') { d } else { String::new() } },
        directors: tags(v, "Director", 5),
        media: v.get("Media").and_then(Value::as_array).map(|a| a.iter().take(8).map(|m| MediaInfo {
            container: s(m, "container", 20), video_codec: s(m, "videoCodec", 20), video_resolution: s(m, "videoResolution", 20),
            audio_codec: s(m, "audioCodec", 20), audio_channels: u(m, "audioChannels").map(|x| x as u32), bitrate_kbps: u(m, "bitrate").map(|x| x as u32),
            size_bytes: m.get("Part").and_then(Value::as_array).and_then(|p| p.first()).and_then(|p| u(p, "size")),
        }).collect()).unwrap_or_default(),
    })
}

/// Labels for the opened copy's first part. Stream ids, keys, and URIs are dropped.
pub fn av_tracks(raw: &Value) -> Vec<AvTrack> {
    let streams = raw.get("Media").and_then(Value::as_array).and_then(|a| a.first())
        .and_then(|m| m.get("Part")).and_then(Value::as_array).and_then(|p| p.first())
        .and_then(|p| p.get("Stream")).and_then(Value::as_array);
    let Some(streams) = streams else { return vec![] };
    let mut out: Vec<AvTrack> = Vec::new();
    for st in streams.iter().take(32) {
        let kind = match u(st, "streamType").unwrap_or(0) { 2 => "audio", 3 => "sub", _ => continue };
        if out.iter().filter(|t| t.kind == kind).count() >= 8 { continue; }
        let label = track_label(st);
        if label.is_empty() { continue; }
        out.push(AvTrack { kind: kind.into(), label, selected: u(st, "selected").unwrap_or(0) == 1 });
    }
    out
}

fn track_label(st: &Value) -> String {
    let disp = s(st, "displayTitle", 80);
    let lab = if !disp.is_empty() { disp } else {
        let lang = s(st, "language", 40);
        let codec = s(st, "codec", 12).to_ascii_uppercase();
        let ch = match u(st, "channels") {
            Some(6) => "5.1".into(), Some(8) => "7.1".into(), Some(2) => "stereo".into(), Some(1) => "mono".into(),
            Some(n) if (1..32).contains(&n) => format!("{n} ch"),
            _ => String::new(),
        };
        [lang, codec, ch].into_iter().filter(|x| !x.is_empty()).collect::<Vec<_>>().join(" · ")
    };
    let low = lab.to_ascii_lowercase();
    if lab.contains(['/', '\\']) || low.contains("://") || low.contains("token") || low.contains("plex.") { return String::new(); }
    lab
}

fn items(mc: &Value, mid: &str, img: &Images) -> Vec<Item> {
    mc.get("Metadata").and_then(Value::as_array).map(|a| a.iter().take(500).filter_map(|v| item(v, mid, img)).collect()).unwrap_or_default()
}

fn hubs(mc: &Value, mid: &str, img: &Images) -> Vec<Hub> {
    mc.get("Hub").and_then(Value::as_array).map(|a| a.iter().take(40).map(|h| Hub {
        title: s(h, "title", 120), ident: s(h, "hubIdentifier", 80), items: items(h, mid, img),
    }).filter(|h| !h.items.is_empty()).collect()).unwrap_or_default()
}

/// Fetch one typed request from the connected server.
pub async fn get(e: &Egress, conn: &Conn, mid: &str, api: &Api) -> Result<Value, ApiError> {
    let (p, q) = api.path_query();
    let mut url = conn.url.join(&p).map_err(|_| ApiError::Parse)?;
    url.set_query(if q.is_empty() { None } else { Some(&q) });
    let r = e.send(Method::Get, url, Cred::Server(mid.to_string()), Duration::from_secs(15)).await?;
    if !(200..300).contains(&r.status) { return Err(ApiError::Egress(super::egress::EgressError::Status(r.status))); }
    let v: Value = serde_json::from_slice(&r.body).map_err(|_| ApiError::Parse)?;
    Ok(v.get("MediaContainer").cloned().unwrap_or(Value::Null))
}

pub fn sections(mc: &Value) -> Vec<Section> {
    mc.get("Directory").and_then(Value::as_array).map(|a| a.iter().filter_map(|d| {
        let id: u32 = digits(d, "key").parse().ok()?;
        let kind = s(d, "type", 20);
        ["movie", "show", "artist", "photo"].contains(&kind.as_str()).then(|| Section { id, title: s(d, "title", 120), kind })
    }).collect()).unwrap_or_default()
}

pub fn facets(mc: &Value) -> Vec<FacetValue> {
    mc.get("Directory").and_then(Value::as_array).map(|a| a.iter().take(500).map(|d| FacetValue { key: digits(d, "key"), title: s(d, "title", 120) }).collect()).unwrap_or_default()
}

pub fn page(mc: &Value, mid: &str, img: &Images) -> Page {
    let it = items(mc, mid, img);
    Page { start: u(mc, "offset").unwrap_or(0) as u32, total: u(mc, "totalSize").map(|x| x as u32).unwrap_or(it.len() as u32), items: it, cursor: None, partial: false }
}

/// A–Z rail counts. Keys are a single A–Z letter or '#'; anything else is dropped.
pub fn letters(mc: &Value) -> Vec<Letter> {
    mc.get("Directory").and_then(Value::as_array).map(|a| a.iter().take(64).filter_map(|d| {
        let k = s(d, "title", 4).to_ascii_uppercase();
        let k = if k.len() == 1 && k.as_bytes()[0].is_ascii_uppercase() { k } else if k == "#" || (k.len() == 1 && k.as_bytes()[0].is_ascii_digit()) { "#".into() } else { return None };
        Some(Letter { key: k, count: u(d, "size").unwrap_or(0).min(1_000_000) as u32 })
    }).collect()).unwrap_or_default()
}

pub fn hub_list(mc: &Value, mid: &str, img: &Images) -> Vec<Hub> { hubs(mc, mid, img) }
pub fn item_list(mc: &Value, mid: &str, img: &Images) -> Vec<Item> { items(mc, mid, img) }

/// Plex library type for `/library/all?type=`. 0 means "don't send type".
pub fn plex_type(kind: &str) -> u8 {
    match kind { "movie" => 1, "show" => 2, "season" => 3, "episode" => 4, _ => 0 }
}

/// Rating key from a metadata row. PMS JSON uses a string; some replies use a number.
pub fn rating_key_value(v: &Value) -> Option<u64> {
    let r = v.get("ratingKey")?;
    let s = if let Some(s) = r.as_str() { s.to_string() } else if let Some(n) = r.as_u64() { n.to_string() } else { return None };
    if s.is_empty() || s.len() > 12 || !s.bytes().all(|b| b.is_ascii_digit()) { return None; }
    s.parse().ok().filter(|&n| n > 0)
}

/// The row is this plex:// title: primary `guid`, or a `Guid` tag (the search hit's primary guid can be legacy).
pub fn guid_matches(raw: &Value, guid: &str) -> bool {
    if guid.is_empty() { return false; }
    let eq = |s: &str| s.eq_ignore_ascii_case(guid);
    if raw.get("guid").and_then(Value::as_str).is_some_and(eq) { return true; }
    raw.get("Guid").and_then(Value::as_array).into_iter().flatten().take(12).any(|g| g.get("id").and_then(Value::as_str).is_some_and(eq))
}

#[cfg(test)]
mod t {
    use super::*;
    #[test]
    fn typed_paths_pass_the_egress_allowlist() {
        let all = [Api::Sections, Api::ContinueWatching, Api::OnDeck, Api::Promoted, Api::SectionHubs(1),
            Api::SectionAll { id: 1, start: 0, size: 500, sort: Sort::Title, filter: Filter::Studio("A&B/../x".into()) },
            Api::FirstCharacter { id: 1, filter: Filter::Genre(12) }, Api::SectionFacet { id: 1, facet: Facet::Genre },
            Api::SectionCollections(1), Api::CollectionChildren(9), Api::Metadata(7), Api::Children(7), Api::Search("a/../b?x#y".into()),
            Api::Person("42".into()), Api::Person("5d7768fe0000000000000001".into()), Api::PersonMedia("5d7768fe0000000000000001".into()), Api::Related(7),
            Api::ByGuid { guid: "plex://movie/5d776b59ad5437001f79c6f8".into(), type_id: 1 }];
        for a in all {
            let (p, q) = a.path_query();
            assert!(super::super::egress::server_path(&p, Some(&q)), "{a:?}");
        }
        let (_, q) = Api::SectionAll { id: 1, start: 0, size: 500, sort: Sort::Title, filter: Filter::None }.path_query();
        assert!(q.contains("X-Plex-Container-Size=100"));
        // filter values are one encoded pair; they cannot inject parameters
        let (_, q) = Api::SectionAll { id: 1, start: 0, size: 1, sort: Sort::Title, filter: Filter::Studio("x&X-Plex-Token=y".into()) }.path_query();
        assert!(q.contains("studio=x%26X-Plex-Token%3Dy&"), "{q}");
        assert_eq!(Filter::parse("genre", "12"), Some(Filter::Genre(12)));
        assert_eq!(Filter::parse("genre", "1 2"), None);
        assert_eq!(Filter::parse("year", "99"), None);
        assert_eq!(Filter::parse("path", "/x"), None);
        let (p, q) = Api::Search("x&X-Plex-Token=y".into()).path_query();
        assert_eq!(p, "/hubs/search");
        assert!(q.starts_with("query=x%26X-Plex-Token%3Dy&"), "{q}");
    }
    #[test]
    fn images_only_register_metadata_paths() {
        let i = Images::default();
        assert!(i.register("m", "/library/metadata/5/thumb/123").is_some());
        assert!(i.register("m", "https://evil.example/x.jpg").is_none());
        assert!(i.register("m", "//evil.example/x").is_none());
        assert!(i.register("m", "/library/metadata/5/thumb/../../x").is_none());
        assert!(i.register("m", "/library/parts/5/file.mkv").is_none());
        let id = i.register("m", "/library/metadata/5/thumb/123?X-Plex-Token=abc").unwrap();
        assert_eq!(i.get(&id).unwrap().1, "/library/metadata/5/thumb/123");
        assert_eq!(id.len(), 32);
        let abs = i.register("m", "http://192.168.1.8:32400/library/metadata/9/thumb/1?X-Plex-Token=sekrit").unwrap();
        let tr = i.register("m", "/photo/:/transcode?width=240&height=360&url=%2Flibrary%2Fmetadata%2F9%2Fthumb%2F1").unwrap();
        let wrapped = i.register("m", "http://192.168.1.8:32400/photo/:/transcode?url=http%3A%2F%2F127.0.0.1%3A32400%2Flibrary%2Fmetadata%2F9%2Fthumb%2F1").unwrap();
        assert_eq!(i.get(&abs).unwrap().1, "/library/metadata/9/thumb/1");
        assert_eq!(abs, tr);
        assert_eq!(tr, wrapped);
        assert!(i.register("m", "/photo/:/transcode?url=https://evil.example/x.jpg").is_none());
        assert!(i.register("m", "/photo/:/transcode?url=%2Flibrary%2Fmetadata%2F5%2Fthumb%2F..%2F..%2Fx").is_none());
        assert!(i.register("m", "http://user:pass@192.168.1.8:32400/library/metadata/9/thumb/1").is_none());
    }
    #[test]
    fn fu7e_person_key_is_strict() {
        assert_eq!(person_key("5d7768fe0000000000000001", "12").as_deref(), Some("5d7768fe0000000000000001"));
        assert_eq!(person_key("", "12").as_deref(), Some("12"));
        assert_eq!(person_key("../../x", "1/2"), None);
        assert_eq!(person_key("5D7768FE0000000000000001", ""), None, "uppercase/odd keys refused");
        assert_eq!(person_key("abc", "x"), None);
        assert!(person_key_global("5d7768fe0000000000000001") && !person_key_global("12"));
        assert!(discover_person_key("5d7768fe0000000000000001"));
        assert!(!discover_person_key("5d7768fe0000000000000001ff") && !discover_person_key("5D7768FE0000000000000001") && !discover_person_key("12"));
        assert_eq!(person_summary(&serde_json::json!({"Directory":[{"summary":"Bio text"}]})), "Bio text");
        assert_eq!(person_summary(&serde_json::json!({"Metadata":[{"title":"X"}]})), "");
        // the egress allowlist refuses anything but the two people shapes
        for bad in ["/library/people/../sections", "/library/people/x", "/library/people/12/media/1", "/library/metadata/1/relatedx"] {
            assert!(!super::super::egress::server_path(bad, None), "{bad}");
        }
    }
    #[test]
    fn clean_strips_controls_and_caps() {
        assert_eq!(clean("a\u{0}b\u{1b}[31mc", 100), "ab[31mc");
        assert_eq!(clean(&"x".repeat(5000), 10).len(), 10);
    }
    #[test]
    fn av_tracks_are_labels_only() {
        let raw = serde_json::json!({"Media":[{"Part":[{"key":"/library/parts/1/file.mkv","Stream":[
            {"id":9,"streamType":1,"key":"/library/streams/1","codec":"hevc"},
            {"id":10,"streamType":2,"codec":"eac3","channels":6,"language":"English","displayTitle":"English · E-AC3 5.1","selected":1,"key":"/library/streams/10"},
            {"streamType":2,"displayTitle":"https://evil.example/a?X-Plex-Token=sekrit"},
            {"streamType":3,"codec":"srt","language":"English","displayTitle":"English (SRT)","selected":0}
        ]}]}]});
        let t = av_tracks(&raw);
        assert_eq!(t.len(), 2);
        assert_eq!(t[0].kind, "audio");
        assert!(t[0].selected && t[0].label == "English · E-AC3 5.1");
        assert_eq!(t[1].kind, "sub");
        let js = serde_json::to_string(&t).unwrap();
        for bad in ["/library/", "streams", "sekrit", "evil.example", "token", "\"id\""] {
            assert!(!js.contains(bad), "{bad} in {js}");
        }
    }
    #[test]
    fn poster_is_cover_art_not_an_episode_still_or_fanart() {
        let img = Images::default();
        let ep = item(&serde_json::json!({
            "ratingKey": "9", "type": "episode", "title": "Thicker Than Water",
            "thumb": "/library/metadata/9/thumb/1",
            "art": "/library/metadata/8/art/1",
            "grandparentThumb": "/library/metadata/8/thumb/1",
            "parentThumb": "/library/metadata/7/thumb/1"
        }), "m", &img).unwrap();
        assert_eq!(img.get(ep.poster.as_ref().unwrap()).unwrap().1, "/library/metadata/8/thumb/1", "show poster");
        assert_eq!(img.get(ep.thumb.as_ref().unwrap()).unwrap().1, "/library/metadata/9/thumb/1", "row still stays on thumb");
        assert_ne!(ep.poster, ep.art);
        let mov = item(&serde_json::json!({
            "ratingKey": "3", "type": "movie", "title": "The Fix",
            "thumb": "/library/metadata/3/thumb/1", "art": "/library/metadata/3/art/1"
        }), "m", &img).unwrap();
        assert_eq!(img.get(mov.poster.as_ref().unwrap()).unwrap().1, "/library/metadata/3/thumb/1");
        assert_ne!(mov.poster, mov.art);
        let still_only = item(&serde_json::json!({
            "ratingKey": "4", "type": "episode", "title": "Scene",
            "thumb": "/library/metadata/4/thumb/1", "art": "/library/metadata/4/art/1"
        }), "m", &img).unwrap();
        assert!(still_only.poster.is_none(), "no poster field means no tall still");
    }
    #[test]
    fn guid_match_accepts_tag_and_numeric_rating_key() {
        let raw = serde_json::json!({"ratingKey": 1003, "guid": "com.plexapp.agents.imdb://tt1?lang=en", "Guid": [{"id": "plex://movie/abc"}]});
        assert!(guid_matches(&raw, "plex://movie/abc"));
        assert!(!guid_matches(&raw, "plex://movie/nope"));
        assert_eq!(rating_key_value(&raw), Some(1003));
        assert_eq!(rating_key_value(&serde_json::json!({"ratingKey": "42"})), Some(42));
        assert_eq!(plex_type("movie"), 1);
        assert_eq!(plex_type("episode"), 4);
    }
}
