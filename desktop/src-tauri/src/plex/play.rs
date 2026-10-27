//! Real playback (direct when the WebView can decode it, otherwise universal HLS).
//! Tokens stay on the egress header. Playlists that reach JS contain only absolute
//! `/hls/<32 hex>` paths — never a host, a token, or a relative media URI.
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use url::Url;

pub const HLS_PREFIX: &str = "/hls/";

/// WebView-native containers and codecs (WebKitGTK / WebView2). HEVC, MKV and
/// non-AAC surround fall through to a forced H.264/AAC HLS transcode.
pub fn webview_native(container: &str, video: &str, audio: &str) -> bool {
    let c = container.trim().to_ascii_lowercase();
    let v = video.trim().to_ascii_lowercase();
    let a = audio.trim().to_ascii_lowercase();
    let cont = matches!(c.as_str(), "mp4" | "m4v" | "mov" | "webm");
    let vid = matches!(v.as_str(), "h264" | "avc" | "avc1" | "vp8" | "vp9" | "av1" | "av01");
    let aud = matches!(a.as_str(), "" | "aac" | "mp3" | "mp4a" | "opus" | "vorbis" | "flac");
    cont && vid && aud
}

pub fn looks_like_m3u8(body: &[u8]) -> bool {
    let s = std::str::from_utf8(body).unwrap_or("");
    let t = s.trim_start_matches(|c: char| c == '\u{feff}' || c.is_whitespace());
    t.starts_with("#EXTM3U")
}

/// Negative decision codes and non-playlist error documents are hard failures.
/// `None` means the HTTP status was 2xx and the body is not an error document.
pub fn decision_failed(status: u16, body: &[u8]) -> Option<u16> {
    if !(200..300).contains(&status) {
        return Some(status);
    }
    let s = std::str::from_utf8(body).unwrap_or("");
    let t = s.trim_start();
    if t.len() >= 5 && (t[..5].eq_ignore_ascii_case("<html") || t.starts_with("<!DOC") || t.starts_with("<!doc")) {
        return Some(502);
    }
    if let Ok(v) = serde_json::from_slice::<serde_json::Value>(body) {
        if v.get("error").is_some() || v.get("errors").is_some() {
            return Some(400);
        }
        if let Some(c) = v.pointer("/MediaContainer/generalDecisionCode").and_then(|x| x.as_i64()) {
            if c < 0 {
                return Some(409);
            }
        }
    }
    None
}

pub fn opaque_id(mid: &str, upstream: &str) -> String {
    let d = Sha256::digest(format!("{mid}\n{upstream}").as_bytes());
    d.iter().take(16).map(|b| format!("{b:02x}")).collect()
}

pub fn b64_encode(data: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    let mut i = 0;
    while i + 3 <= data.len() {
        let n = ((data[i] as u32) << 16) | ((data[i + 1] as u32) << 8) | data[i + 2] as u32;
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(T[((n >> 6) & 63) as usize] as char);
        out.push(T[(n & 63) as usize] as char);
        i += 3;
    }
    if i < data.len() {
        let b0 = data[i] as u32;
        let b1 = if i + 1 < data.len() { data[i + 1] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8);
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        if i + 1 < data.len() {
            out.push(T[((n >> 6) & 63) as usize] as char);
            out.push('=');
        } else {
            out.push('=');
            out.push('=');
        }
    }
    out
}

/// Cap a single media Range to an 8 MiB window. Open-ended ranges (`bytes=N-`)
/// are closed so a WebView that asks for the rest of a file cannot pull it all.
pub fn bound_range(raw: Option<&str>) -> Option<String> {
    let raw = raw?.trim();
    let rest = raw.strip_prefix("bytes=")?;
    if rest.contains(',') {
        return None;
    }
    let (a, b) = rest.split_once('-')?;
    if a.is_empty() || a.len() > 12 || !a.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let start: u64 = a.parse().ok()?;
    let end = if b.is_empty() {
        start.saturating_add(8 * 1024 * 1024 - 1)
    } else {
        if b.len() > 12 || !b.bytes().all(|c| c.is_ascii_digit()) {
            return None;
        }
        let e: u64 = b.parse().ok()?;
        if e < start {
            return None;
        }
        start.saturating_add((e - start).min(8 * 1024 * 1024 - 1))
    };
    Some(format!("bytes={start}-{end}"))
}

fn val_ok(key: &str, v: &str) -> bool {
    if v.len() > 80 {
        return false;
    }
    match key {
        "path" => v.len() <= 40 && v.starts_with("/library/metadata/") && v[18..].bytes().all(|b| b.is_ascii_digit()) && !v[18..].is_empty(),
        "directPlay" | "directStream" | "directStreamAudio" | "copyts" | "fastSeek" | "hasMDE" | "download" | "autoAdjustQuality" => v == "0" || v == "1",
        "protocol" => v == "hls",
        "location" => v == "lan" || v == "wan",
        "subtitles" => matches!(v, "none" | "auto" | "burn" | "sidecar"),
        "session" | "X-Plex-Session-Identifier" => v.len() == 32 && v.bytes().all(|b| b.is_ascii_hexdigit()),
        "videoResolution" => {
            let Some((w, h)) = v.split_once('x') else { return false };
            !w.is_empty() && !h.is_empty() && w.len() <= 4 && h.len() <= 4 && w.bytes().all(|b| b.is_ascii_digit()) && h.bytes().all(|b| b.is_ascii_digit())
        }
        "mediaIndex" | "partIndex" | "subtitleSize" | "audioBoost" | "mediaBufferSize" | "videoQuality" | "maxVideoBitrate" | "offset" => {
            !v.is_empty() && v.len() <= 8 && v.bytes().all(|b| b.is_ascii_digit())
        }
        "videoCodec" | "audioCodec" => v.bytes().all(|b| b.is_ascii_alphanumeric()),
        "X-Plex-Client-Identifier" => v.len() == 36 && v.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-'),
        "X-Plex-Product" | "X-Plex-Device" | "X-Plex-Device-Name" | "X-Plex-Client-Profile-Name" | "X-Plex-Platform" | "X-Plex-Platform-Version" | "X-Plex-Model" | "X-Plex-Language" | "X-Plex-Version" | "Accept-Language" => {
            !v.is_empty() && v.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b' ' | b'.' | b'_' | b'-'))
        }
        _ => false,
    }
}

fn known_key(k: &str) -> bool {
    matches!(
        k,
        "hasMDE"
            | "path"
            | "mediaIndex"
            | "partIndex"
            | "protocol"
            | "fastSeek"
            | "directPlay"
            | "directStream"
            | "directStreamAudio"
            | "subtitleSize"
            | "audioBoost"
            | "location"
            | "session"
            | "subtitles"
            | "autoAdjustQuality"
            | "mediaBufferSize"
            | "videoQuality"
            | "maxVideoBitrate"
            | "videoResolution"
            | "videoCodec"
            | "audioCodec"
            | "copyts"
            | "offset"
            | "download"
            | "X-Plex-Product"
            | "X-Plex-Platform"
            | "X-Plex-Device"
            | "X-Plex-Device-Name"
            | "X-Plex-Client-Identifier"
            | "X-Plex-Version"
            | "X-Plex-Session-Identifier"
            | "X-Plex-Client-Profile-Name"
            | "X-Plex-Language"
            | "X-Plex-Platform-Version"
            | "X-Plex-Model"
            | "Accept-Language"
    )
}

/// Query allowlist for universal-transcode and part URLs. `X-Plex-Token` is never
/// legal here (header only). `directStream=1` stays allowed so an older playlist
/// can still be fetched; the builder itself always sends `0`.
pub fn query_ok(path: &str, query: Option<&str>) -> bool {
    let q = query.unwrap_or("");
    if q.len() > 4000 {
        return false;
    }
    if q.is_empty() {
        return !path.ends_with("/decision") && !path.ends_with("start.m3u8");
    }
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(q.as_bytes()).into_owned().collect();
    if pairs.is_empty() {
        return false;
    }
    let mut seen = HashMap::<String, ()>::new();
    for (k, v) in &pairs {
        if k.eq_ignore_ascii_case("X-Plex-Token") || !known_key(k) || !val_ok(k, v) || seen.insert(k.clone(), ()).is_some() {
            return false;
        }
    }
    if path.ends_with("/decision") || path.ends_with("start.m3u8") {
        for req in ["path", "session", "directPlay", "directStream", "protocol", "videoQuality"] {
            if !pairs.iter().any(|(k, _)| k == req) {
                return false;
            }
        }
    }
    true
}

pub fn path_shape_ok(path: &str) -> bool {
    if path.contains("..") || path.contains('\\') || path.contains("//") {
        return false;
    }
    if path == "/video/:/transcode/universal/decision" || path == "/video/:/transcode/universal/start.m3u8" {
        return true;
    }
    if let Some(rest) = path.strip_prefix("/video/:/transcode/universal/session/") {
        let seg: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();
        if seg.len() < 2 || seg.len() > 6 {
            return false;
        }
        let sid = seg[0];
        if !(8..=80).contains(&sid.len()) || !sid.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') {
            return false;
        }
        // Intermediate pieces are variant indexes (`0`), not files. Only the last
        // segment must carry a media extension.
        return seg[1..seg.len() - 1].iter().all(|s| seg_name_ok(s)) && seg_file_ok(seg[seg.len() - 1]);
    }
    if let Some(rest) = path.strip_prefix("/library/parts/") {
        let seg: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();
        if seg.len() < 2 || seg.len() > 4 {
            return false;
        }
        let id = seg[0];
        if id.is_empty() || id.len() > 12 || !id.bytes().all(|b| b.is_ascii_digit()) {
            return false;
        }
        return seg[1..seg.len() - 1].iter().all(|s| seg_name_ok(s)) && seg_file_ok(seg[seg.len() - 1]);
    }
    false
}

fn seg_name_ok(s: &str) -> bool {
    !s.is_empty() && s.len() <= 80 && s != "." && s != ".." && s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'))
}

fn seg_file_ok(s: &str) -> bool {
    if s.is_empty() || s.len() > 80 || s == "." || s == ".." {
        return false;
    }
    if !s.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-')) {
        return false;
    }
    let ext = s.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase());
    matches!(ext.as_deref(), Some("m3u8" | "ts" | "mp4" | "m4s" | "m4v" | "mov" | "webm" | "mkv" | "aac" | "vtt" | "key"))
}

pub fn playback_path_ok(path: &str, query: Option<&str>) -> bool {
    path_shape_ok(path) && query_ok(path, query)
}

/// Profile PMS matches from the **header**, not the query. `Generic` is the
/// documented name for a custom client. The extra replaces the streaming
/// target with HLS MPEG-TS H.264/AAC so the WebView never receives HEVC or MKV.
pub const HLS_PROFILE_NAME: &str = "Generic";
pub const HLS_PROFILE_EXTRA: &str = "add-transcode-target(type=videoProfile&context=streaming&protocol=hls&container=mpegts&videoCodec=h264&audioCodec=aac&replace=true)";

pub fn playback_profile_headers() -> [(&'static str, &'static str); 2] {
    [("X-Plex-Client-Profile-Name", HLS_PROFILE_NAME), ("X-Plex-Client-Profile-Extra", HLS_PROFILE_EXTRA)]
}

/// Shared session for `/decision` and `start.m3u8`. Force-transcode:
/// `directPlay=0`, `directStream=0`, `directStreamAudio=0`, `videoQuality=100`,
/// H.264/AAC HLS. `copyts` is the HTTP/MKV flag and is omitted here — PMS
/// rejects that combination on an HLS decision. The WebView is not mpv, so
/// the target is 1080p / 20 Mbps even when the source is HEVC.
pub fn build_hls_universal_query(meta_path: &str, session: &str, media_index: usize, offset_sec: u64, location: &str, client_id: &str, platform: &str, version: &str) -> String {
    let mut s = url::form_urlencoded::Serializer::new(String::new());
    let pairs = [
        ("hasMDE", "1"),
        ("path", meta_path),
        ("mediaIndex", &media_index.to_string()),
        ("partIndex", "0"),
        ("protocol", "hls"),
        ("fastSeek", "1"),
        ("directPlay", "0"),
        ("directStream", "0"),
        ("directStreamAudio", "0"),
        ("subtitleSize", "100"),
        ("audioBoost", "100"),
        ("location", location),
        ("session", session),
        ("subtitles", "none"),
        ("autoAdjustQuality", "0"),
        ("mediaBufferSize", "102400"),
        ("videoQuality", "100"),
        ("maxVideoBitrate", "20000"),
        ("videoResolution", "1920x1080"),
        ("videoCodec", "h264"),
        ("audioCodec", "aac"),
        ("offset", &offset_sec.to_string()),
        ("X-Plex-Product", "PlexUW"),
        ("X-Plex-Platform", platform),
        ("X-Plex-Device", "PlexUW"),
        ("X-Plex-Device-Name", "PlexUW"),
        ("X-Plex-Client-Identifier", client_id),
        ("X-Plex-Version", version),
        ("X-Plex-Session-Identifier", session),
        ("X-Plex-Client-Profile-Name", HLS_PROFILE_NAME),
        ("X-Plex-Language", "en"),
    ];
    for (k, v) in pairs {
        s.append_pair(k, v);
    }
    s.finish()
}

pub struct HlsPair {
    pub session: String,
    pub decision: String,
    pub start: String,
}

pub fn build_hls_pair(rating_key: u64, media_index: usize, offset_sec: u64, location: &str, client_id: &str, platform: &str, version: &str) -> HlsPair {
    let session = uuid::Uuid::new_v4().simple().to_string();
    let q = build_hls_universal_query(&format!("/library/metadata/{rating_key}"), &session, media_index, offset_sec, location, client_id, platform, version);
    HlsPair {
        session,
        decision: format!("/video/:/transcode/universal/decision?{q}"),
        start: format!("/video/:/transcode/universal/start.m3u8?{q}"),
    }
}

/// Rewrite a playlist. Every media URI becomes an absolute `/hls/<32 hex>` path.
/// The callback stores the upstream path and returns that opaque id.
pub fn rewrite_m3u8(body: &str, base: &Url, mut store: impl FnMut(&str) -> String) -> Result<String, &'static str> {
    let mut out = String::with_capacity(body.len());
    for line in body.split_inclusive('\n') {
        let (raw, nl) = line.strip_suffix('\n').map(|l| (l, "\n")).unwrap_or((line, ""));
        let raw = raw.strip_suffix('\r').unwrap_or(raw);
        if raw.is_empty() {
            out.push_str(nl);
            continue;
        }
        if raw.starts_with('#') {
            // PMS puts subtitle renditions in the master even when we asked for
            // subtitles=none. Their URI is `/library/streams/…`, which this proxy
            // does not fetch. Failing the whole playlist there used to return a
            // bare `playback` error after decision and start.m3u8 had already
            // succeeded. Drop the rendition and keep the video variant.
            if subtitle_rendition(raw) {
                out.push_str(nl);
                continue;
            }
            match rewrite_tag(raw, base, &mut store) {
                Ok(line) => out.push_str(&line),
                Err(_) if alt_rendition(raw) => {}
                Err(e) => return Err(e),
            }
            out.push_str(nl);
            continue;
        }
        out.push_str(&map_uri(raw.trim(), base, &mut store)?);
        out.push_str(nl);
    }
    if !out.contains("#EXTM3U") {
        return Err("not m3u8");
    }
    Ok(out)
}

fn subtitle_rendition(line: &str) -> bool {
    let t = line.trim_start();
    t.len() >= 13 && t.as_bytes()[..13].eq_ignore_ascii_case(b"#EXT-X-MEDIA:") && t.to_ascii_uppercase().contains("TYPE=SUBTITLES")
}

fn alt_rendition(line: &str) -> bool {
    let t = line.trim_start();
    t.len() >= 13 && t.as_bytes()[..13].eq_ignore_ascii_case(b"#EXT-X-MEDIA:")
}

fn rewrite_tag(line: &str, base: &Url, store: &mut impl FnMut(&str) -> String) -> Result<String, &'static str> {
    let Some(idx) = line.find("URI=\"") else { return Ok(line.to_string()) };
    let rest = &line[idx + 5..];
    let Some(end) = rest.find('"') else { return Err("bad uri"); };
    let uri = &rest[..end];
    let mapped = map_uri(uri, base, store)?;
    let mut s = String::with_capacity(line.len() + mapped.len());
    s.push_str(&line[..idx + 5]);
    s.push_str(&mapped);
    s.push('"');
    s.push_str(&rest[end + 1..]);
    if s[idx + 5 + mapped.len() + 1..].contains("URI=\"") {
        return rewrite_tag(&s, base, store);
    }
    Ok(s)
}

fn map_uri(raw: &str, base: &Url, store: &mut impl FnMut(&str) -> String) -> Result<String, &'static str> {
    if raw.starts_with("/hls/") && raw.len() == HLS_PREFIX.len() + 32 && raw[HLS_PREFIX.len()..].bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) {
        return Ok(raw.to_string());
    }
    let joined = base.join(raw).map_err(|_| "bad uri")?;
    let upstream = upstream_from_url(&joined).ok_or("blocked uri")?;
    let id = store(&upstream);
    if id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("bad id");
    }
    Ok(format!("{HLS_PREFIX}{id}"))
}

pub fn upstream_from_url(u: &Url) -> Option<String> {
    let path = u.path();
    if !path_shape_ok(path) {
        return None;
    }
    let filtered = filter_query(u.query())?;
    if !query_ok(path, if filtered.is_empty() { None } else { Some(filtered.as_str()) }) && !(filtered.is_empty() && query_ok(path, None)) {
        return None;
    }
    if filtered.is_empty() { Some(path.to_string()) } else { Some(format!("{path}?{filtered}")) }
}

/// Drop `X-Plex-Token` and any key outside the allowlist. Invalid values for a
/// known key drop that pair. What remains is safe to store and re-request.
fn filter_query(query: Option<&str>) -> Option<String> {
    let q = query.unwrap_or("");
    if q.is_empty() {
        return Some(String::new());
    }
    if q.len() > 8000 {
        return None;
    }
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(q.as_bytes()).into_owned().collect();
    let mut s = url::form_urlencoded::Serializer::new(String::new());
    let mut seen = HashMap::<String, ()>::new();
    for (k, v) in pairs {
        if k.eq_ignore_ascii_case("X-Plex-Token") || !known_key(&k) || !val_ok(&k, &v) || seen.insert(k.clone(), ()).is_some() {
            continue;
        }
        s.append_pair(&k, &v);
    }
    Some(s.finish())
}

pub fn split_path_query(pq: &str) -> Option<(&str, Option<&str>)> {
    if let Some((p, q)) = pq.split_once('?') { Some((p, Some(q))) } else { Some((pq, None)) }
}

/// Map an upstream Content-Type onto a static token-free response type.
pub fn static_type(ct: &str) -> &'static str {
    let base = ct.split(';').next().unwrap_or("").trim().to_ascii_lowercase();
    match base.as_str() {
        "application/vnd.apple.mpegurl" | "application/x-mpegurl" | "audio/mpegurl" | "application/mpegurl" => "application/vnd.apple.mpegurl",
        "video/mp2t" => "video/mp2t",
        "video/mp4" | "audio/mp4" => "video/mp4",
        "video/webm" | "audio/webm" => "video/webm",
        "text/vtt" => "text/vtt",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod t {
    use super::*;

    #[test]
    fn native_codec_matrix() {
        assert!(webview_native("mp4", "h264", "aac"));
        assert!(webview_native("MP4", "AVC", "mp4a"));
        assert!(webview_native("webm", "vp9", "opus"));
        assert!(!webview_native("mkv", "hevc", "eac3"));
        assert!(!webview_native("mp4", "hevc", "aac"));
        assert!(!webview_native("mkv", "h264", "aac"));
        assert!(!webview_native("mp4", "h264", "eac3"));
    }

    #[test]
    fn m3u8_sniff_and_decision_codes() {
        assert!(looks_like_m3u8(b"\n#EXTM3U\n"));
        assert!(!looks_like_m3u8(b"{\"MediaContainer\":{}}"));
        assert!(decision_failed(502, b"{}").is_some());
        assert!(decision_failed(200, br#"{"MediaContainer":{"generalDecisionCode":-4}}"#).is_some());
        assert!(decision_failed(200, b"<html>nope</html>").is_some());
        assert!(decision_failed(200, br#"{"MediaContainer":{"generalDecisionCode":1001}}"#).is_none());
    }

    #[test]
    fn universal_query_force_transcode_and_allowlist() {
        let q = build_hls_universal_query("/library/metadata/42", &"ab".repeat(16), 0, 0, "lan", "11111111-1111-4111-8111-111111111111", "Linux", "0.1.0");
        assert!(q.contains("directPlay=0"));
        assert!(q.contains("directStream=0"));
        assert!(q.contains("directStreamAudio=0"));
        assert!(q.contains("videoQuality=100"));
        assert!(q.contains("videoCodec=h264"));
        assert!(q.contains("audioCodec=aac"));
        assert!(q.contains("protocol=hls"));
        assert!(q.contains("X-Plex-Client-Profile-Name=Generic"));
        assert!(!q.contains("copyts"), "{q}");
        assert!(!q.contains("WebKit"), "{q}");
        assert!(!q.to_ascii_lowercase().contains("htpc"), "{q}");
        assert!(!q.to_ascii_lowercase().contains("hevc") && !q.to_ascii_lowercase().contains("h265"), "{q}");
        assert!(!q.to_ascii_lowercase().contains("token"));
        let headers = playback_profile_headers();
        assert_eq!(headers[0], ("X-Plex-Client-Profile-Name", "Generic"));
        let extra = headers[1].1;
        assert!(extra.contains("protocol=hls") && extra.contains("container=mpegts") && extra.contains("videoCodec=h264") && extra.contains("audioCodec=aac") && extra.contains("replace=true"), "{extra}");
        assert!(!extra.to_ascii_lowercase().contains("hevc") && !extra.contains("h265") && !extra.contains("mkv") && !extra.to_ascii_lowercase().contains("htpc"), "{extra}");
        assert!(extra.len() < 300, "{}", extra.len());
        let path = "/video/:/transcode/universal/start.m3u8";
        assert!(playback_path_ok(path, Some(&q)), "{q}");
        assert!(playback_path_ok("/video/:/transcode/universal/decision", Some(&q)));
        // legacy directStream=1 is still a legal query; the builder never emits it
        let legacy = q.replace("directStream=0", "directStream=1");
        assert!(playback_path_ok(path, Some(&legacy)));
        assert!(!playback_path_ok(path, Some(&format!("{q}&X-Plex-Token=sekrit"))));
        assert!(!playback_path_ok(path, Some("directPlay=0&directStream=0&protocol=hls&videoQuality=100&session=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&path=https%3A%2F%2Fevil.example")));
        assert!(!playback_path_ok("/library/parts/1/../../accounts", None));
        assert!(playback_path_ok("/library/parts/77/file.mp4", None));
        assert!(playback_path_ok("/video/:/transcode/universal/session/abcdef0123456789/0/00000.ts", None));
        assert!(!path_shape_ok("/video/:/transcode/universal/session/abc/0/../../x.ts"));
    }

    #[test]
    fn rewrite_emits_absolute_hls_paths_and_strips_token() {
        let base = Url::parse("https://plex.example.com/video/:/transcode/universal/session/abcdef0123456789/0/index.m3u8").unwrap();
        let raw = concat!(
            "#EXTM3U\n",
            "#EXT-X-STREAM-INF:BANDWIDTH=1\n",
            "/video/:/transcode/universal/session/abcdef0123456789/1/index.m3u8?X-Plex-Token=srv1-SECRET\n",
            "#EXTINF:4.0,\n",
            "00000.ts?X-Plex-Token=srv1-SECRET\n",
            "#EXT-X-MAP:URI=\"init.mp4?X-Plex-Token=srv1-SECRET\"\n",
        );
        let mut stored = vec![];
        let out = rewrite_m3u8(raw, &base, |up| {
            assert!(!up.to_ascii_lowercase().contains("token"), "{up}");
            assert!(!up.contains("plex.example"), "{up}");
            assert!(!up.contains("SECRET"), "{up}");
            stored.push(up.to_string());
            opaque_id("mid", up)
        })
        .unwrap();
        assert!(!out.contains("SECRET") && !out.contains("plex.example") && !out.contains("http"));
        for line in out.lines().filter(|l| !l.is_empty() && !l.starts_with('#')) {
            assert!(line.starts_with("/hls/") && line.len() == 5 + 32, "{line}");
            assert!(line.bytes().skip(5).all(|b| b.is_ascii_hexdigit()));
        }
        assert!(out.contains("URI=\"/hls/"));
        assert!(!out.lines().any(|l| l.ends_with(".ts") || l.contains("index.m3u8")));
        assert!(stored.iter().any(|u| u.contains("/session/abcdef0123456789/1/index.m3u8")));
        assert!(stored.iter().any(|u| u.contains("00000.ts")));
        assert!(stored.iter().any(|u| u.contains("init.mp4")));
    }

    #[test]
    fn subtitle_rendition_does_not_abort_video() {
        let base = Url::parse("https://10-0-0-2.0123456789abcdef0123456789abcdef.plex.direct:32400/video/:/transcode/universal/start.m3u8").unwrap();
        let raw = concat!(
            "#EXTM3U\n",
            "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"English\",DEFAULT=YES,URI=\"/library/streams/4481\"\n",
            "#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"aud\",NAME=\"English\",URI=\"https://evil.example/audio.m3u8\"\n",
            "#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS=\"avc1.640028,mp4a.40.2\"\n",
            "/video/:/transcode/universal/session/abcd0123abcd0123abcd0123abcd0123/base/index.m3u8?X-Plex-Token=sekrit\n",
        );
        let mut stored = vec![];
        let out = rewrite_m3u8(raw, &base, |u| {
            stored.push(u.to_string());
            "ab".repeat(16)
        })
        .expect("video variant survives a subtitle rendition");
        assert!(out.contains("#EXTM3U") && out.contains("/hls/abababababababababababababababab"));
        assert!(!out.contains("library/streams") && !out.contains("sekrit") && !out.contains("evil.example"));
        assert!(stored.iter().any(|u| u.contains("/session/abcd0123abcd0123abcd0123abcd0123/base/index.m3u8")));
        assert!(stored.iter().all(|u| !u.contains("streams") && !u.contains("evil")));
        let bad = "#EXTM3U\nhttps://evil.example/secret.ts\n";
        assert!(rewrite_m3u8(bad, &base, |_| "ab".repeat(16)).is_err());
    }

    #[test]
    fn b64_and_range() {
        assert_eq!(b64_encode(b"f"), "Zg==");
        assert_eq!(b64_encode(b"fo"), "Zm8=");
        assert_eq!(b64_encode(b"foo"), "Zm9v");
        assert_eq!(bound_range(Some("bytes=0-100")), Some("bytes=0-100".into()));
        let open = bound_range(Some("bytes=0-")).unwrap();
        assert!(open.starts_with("bytes=0-"));
        assert!(bound_range(Some("bytes=5-1")).is_none());
        assert!(bound_range(Some("bytes=0-1,2-3")).is_none());
    }
}
