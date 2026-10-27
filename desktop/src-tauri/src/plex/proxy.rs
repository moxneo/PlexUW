//! `plexuw` protocol proxy (§6a H1, Sentinel N1/N2).
//! - URL form: `<plexuw origin>/<kind>/<opaque>`; kind ∈ {img, media, hls}. The
//!   upstream host is the connection currently selected in Rust, never the URL.
//! - Typed allowlist (N2): `img/<32-hex id>/<w>x<h>` only in M2. The id maps (in
//!   Rust) to a server-relative `/library/metadata/<id>/(thumb|art)` path taken
//!   from server metadata (§6a M5); Rust builds `/photo/:/transcode` itself.
//!   `media` and `hls` are parsed and rejected until playback (M3); the HLS
//!   id→upstream map exists now and is cleared on stop/sign-out.
//! - Own origin only (N1): Origin, if sent, must equal the app origin; Referer, if
//!   sent, must be under it; a request carrying neither is rejected.
//! - Upstream request built from scratch (no webview headers, cookies, Origin).
//!   Response carries only Content-Type (image allowlist), Content-Length and
//!   Cache-Control: no-store (the image cache lives in Rust, §6a L3/L4).
use std::collections::HashMap;
use std::sync::Mutex;

pub const APP_ORIGINS: &[&str] = &["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

#[derive(Debug, PartialEq, Clone)]
pub enum ProxyReq { Img { id: String, w: u32, h: u32 }, Hls { id: String }, Media { id: String } }

#[derive(Debug, PartialEq)]
pub enum Reject { Method, BadChars, Traversal, Encoded, Shape, Kind, NotYet, Origin, Referer, NoOrigin }

impl Reject {
    pub fn status(&self) -> u16 { match self { Reject::Method => 405, Reject::Origin | Reject::Referer | Reject::NoOrigin => 403, Reject::NotYet => 501, _ => 400 } }
}

fn is_hex32(s: &str) -> bool { s.len() == 32 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) }

/// Validate the raw request (method, URI, Origin, Referer) without touching any map.
pub fn parse(method: &str, uri: &str, origin: Option<&str>, referer: Option<&str>) -> Result<ProxyReq, Reject> {
    if method != "GET" { return Err(Reject::Method); }
    // N1 (Sentinel M2 ruling): a header that is present must be ours. Both absent
    // is tolerated ONLY for GET img (WebKitGTK sends neither on <img> loads);
    // media/hls never get that exception (checked at the kind match below).
    let no_headers = origin.is_none() && referer.is_none();
    if let Some(o) = origin { if !APP_ORIGINS.contains(&o) { return Err(Reject::Origin); } }
    if let Some(r) = referer { if !APP_ORIGINS.iter().any(|o| r.starts_with(&format!("{o}/"))) { return Err(Reject::Referer); } }
    // H1 rejected input, checked on the raw string before any parsing/decoding.
    if uri.bytes().any(|b| b < 0x20 || b == 0x7f || b == b'\\') { return Err(Reject::BadChars); }
    let lower = uri.to_ascii_lowercase();
    for bad in ["%2f", "%5c", "%00", "%0d", "%0a", "%2e"] { if lower.contains(bad) { return Err(Reject::Encoded); } }
    let rest = if let Some(r) = uri.strip_prefix("plexuw://localhost") { r }
        else if let Some(r) = uri.strip_prefix("http://plexuw.localhost") { r }
        else if let Some(r) = uri.strip_prefix("https://plexuw.localhost") { r }
        else { return Err(Reject::Shape); };
    if !rest.starts_with('/') || rest.contains("//") || rest.contains("..") || rest.contains('#') { return Err(Reject::Traversal); }
    if rest.contains('?') || rest.contains('%') || rest.contains(':') || rest.contains('@') { return Err(Reject::Shape); }
    let seg: Vec<&str> = rest[1..].split('/').collect();
    match seg.as_slice() {
        ["img", id, wh] => {
            if !is_hex32(id) { return Err(Reject::Shape); }
            let (w, h) = wh.split_once('x').ok_or(Reject::Shape)?;
            let ok = |s: &str| (1..=4).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_digit());
            if !ok(w) || !ok(h) { return Err(Reject::Shape); }
            let (w, h): (u32, u32) = (w.parse().unwrap(), h.parse().unwrap());
            if !(16..=4096).contains(&w) || !(16..=4096).contains(&h) { return Err(Reject::Shape); }
            Ok(ProxyReq::Img { id: id.to_string(), w, h })
        }
        ["img", ..] => Err(Reject::Shape),
        // Media is loaded by <video> (WebKit often sends neither Origin nor Referer), same as images.
        // HLS playlists and segments are fetched with invoke(`opaque_get`); a protocol GET still
        // requires our origin so a page cannot XHR `plexuw://` with no headers.
        ["media", id] if is_hex32(id) => Ok(ProxyReq::Media { id: (*id).to_string() }),
        ["hls", id] if is_hex32(id) => {
            if no_headers { return Err(Reject::NoOrigin); }
            Ok(ProxyReq::Hls { id: (*id).to_string() })
        }
        ["media", ..] | ["hls", ..] => Err(Reject::Shape),
        _ => Err(Reject::Kind),
    }
}

/// Upstream Content-Type allowlist for images. The fixture build also serves SVG
/// placeholders; real servers' SVG is refused.
pub fn image_type_ok(ct: &str) -> Option<&'static str> {
    let base = ct.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    match base.as_str() {
        "image/jpeg" => Some("image/jpeg"),
        "image/png" => Some("image/png"),
        "image/webp" => Some("image/webp"),
        "image/gif" => Some("image/gif"),
        #[cfg(any(test, feature = "mockplex"))]
        "image/svg+xml" => Some("image/svg+xml"),
        _ => None,
    }
}

/// One HLS playlist, segment, or direct-play part. `body` is set for playlists we
/// already rewrote (absolute `/hls/` ids). Segments keep only the upstream path
/// and are fetched on demand. Cleared on stop and sign-out.
#[derive(Clone, Debug)]
pub struct HlsEnt {
    pub mid: String,
    pub upstream: String,
    pub body: Option<Vec<u8>>,
    pub content_type: String,
}
#[derive(Default)]
pub struct HlsMap { map: Mutex<HashMap<String, HlsEnt>> }
impl HlsMap {
    pub fn insert(&self, id: String, ent: HlsEnt) { self.map.lock().unwrap().insert(id, ent); }
    pub fn get(&self, id: &str) -> Option<HlsEnt> { self.map.lock().unwrap().get(id).cloned() }
    pub fn clear(&self) { self.map.lock().unwrap().clear(); }
    pub fn len(&self) -> usize { self.map.lock().unwrap().len() }
}

/// Disk-cache file name: hash of (machine, server-relative path, size). No token,
/// host or IP in the key or path (§6a L4).
pub fn cache_name(mid: &str, path: &str, w: u32, h: u32) -> String {
    super::browse::hex16(&format!("{mid}\n{path}\n{w}x{h}"))
}

#[cfg(test)]
mod t {
    use super::*;
    const ID: &str = "0123456789abcdef0123456789abcdef";
    const REF: Option<&str> = Some("tauri://localhost/index.html");
    fn p(u: &str) -> Result<ProxyReq, Reject> { parse("GET", u, None, REF) }
    #[test]
    fn accepts_img_on_both_platform_origins() {
        assert_eq!(p(&format!("plexuw://localhost/img/{ID}/300x450")), Ok(ProxyReq::Img { id: ID.into(), w: 300, h: 450 }));
        assert!(parse("GET", &format!("http://plexuw.localhost/img/{ID}/300x450"), Some("http://tauri.localhost"), Some("http://tauri.localhost/")).is_ok());
    }
    #[test]
    fn rejects_every_h1_case() {
        let cases = [
            ("plexuw://localhost/img/https://evil.example/x/1x1", Reject::Traversal),
            (&*format!("plexuw://localhost/img/{ID}/../../x"), Reject::Traversal),
            (&*format!("plexuw://localhost//img/{ID}/300x450"), Reject::Traversal),
            (&*format!("plexuw://localhost/img/{ID}%2f..%2fx/300x450"), Reject::Encoded),
            (&*format!("plexuw://localhost/img/{ID}%5Cx/300x450"), Reject::Encoded),
            (&*format!("plexuw://localhost/img/{ID}/300x450%0d%0aX:1"), Reject::Encoded),
            (&*format!("plexuw://localhost/img/{ID}/300x450\r\nX: 1"), Reject::BadChars),
            (&*format!("plexuw://localhost/img/{ID}/300x450\0"), Reject::BadChars),
            (&*format!("plexuw://localhost/img/{ID}\\x/300x450"), Reject::BadChars),
            (&*format!("plexuw://localhost/img/{ID}/300x450?url=/library/parts/1"), Reject::Shape),
            (&*format!("plexuw://evil.example/img/{ID}/300x450"), Reject::Shape),
            (&*format!("plexuw://localhost@evil/img/{ID}/300x450"), Reject::Traversal),
            ("plexuw://localhost/img/library/metadata/1/thumb", Reject::Shape),
            (&*format!("plexuw://localhost/img/{ID}/99999x1"), Reject::Shape),
            (&*format!("plexuw://localhost/img/{ID}/1x1"), Reject::Shape),
            (&*format!("plexuw://localhost/img/{}/300x450", ID.to_uppercase()), Reject::Shape),
            (&*format!("plexuw://localhost/library/{ID}/300x450"), Reject::Kind),
            (&*format!("plexuw://localhost/media/{ID}/extra"), Reject::Shape),
            (&*format!("plexuw://localhost/hls/not-an-id"), Reject::Shape),
        ];
        assert!(matches!(p(&format!("plexuw://localhost/hls/{ID}")), Ok(ProxyReq::Hls { .. })));
        assert!(matches!(parse("GET", &format!("plexuw://localhost/media/{ID}"), None, None), Ok(ProxyReq::Media { .. })));
        for (u, want) in cases { assert_eq!(p(u), Err(want), "{u:?}"); }
        assert_eq!(parse("POST", &format!("plexuw://localhost/img/{ID}/300x450"), None, REF), Err(Reject::Method));
    }
    #[test]
    fn n1_origin_and_referer() {
        let u = format!("plexuw://localhost/img/{ID}/300x450");
        // both absent: images only
        assert!(parse("GET", &u, None, None).is_ok());
        assert_eq!(parse("POST", &u, None, None), Err(Reject::Method));
        assert!(parse("GET", &format!("plexuw://localhost/media/{ID}"), None, None).is_ok());
        assert_eq!(parse("GET", &format!("plexuw://localhost/hls/{ID}"), None, None), Err(Reject::NoOrigin));
        assert_eq!(Reject::NoOrigin.status(), 403);
        assert_eq!(parse("GET", &u, Some("https://evil.example"), REF), Err(Reject::Origin));
        assert_eq!(parse("GET", &u, Some("null"), None), Err(Reject::Origin));
        assert_eq!(parse("GET", &u, None, Some("https://evil.example/tauri://localhost/")), Err(Reject::Referer));
        assert_eq!(parse("GET", &u, None, Some("tauri://localhost.evil/")), Err(Reject::Referer));
        assert_eq!(parse("GET", &u, Some("tauri://localhost"), Some("https://evil.example/")), Err(Reject::Referer));
        assert!(parse("GET", &u, Some("tauri://localhost"), None).is_ok());
    }
    #[test]
    fn hls_map_clears() {
        let m = HlsMap::default();
        m.insert(ID.into(), HlsEnt { mid: "m".into(), upstream: "/video/:/transcode/universal/session/abcdef0123456789/0/index.m3u8".into(), body: None, content_type: "application/vnd.apple.mpegurl".into() });
        assert_eq!(m.len(), 1);
        m.clear();
        assert!(m.get(ID).is_none());
    }
    #[test]
    fn image_types() {
        assert_eq!(image_type_ok("image/jpeg; charset=x"), Some("image/jpeg"));
        assert_eq!(image_type_ok("text/html"), None);
        assert_eq!(image_type_ok("application/json"), None);
    }
    #[test]
    fn cache_name_has_no_host_or_token() {
        let n = cache_name("fixturemachine0001", "/library/metadata/5/thumb/1", 300, 450);
        assert_eq!(n.len(), 32);
        assert!(n.bytes().all(|b| b.is_ascii_hexdigit()));
    }
}
