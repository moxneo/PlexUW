//! Real playback. `play_start` awaits `/decision`, preflights `start.m3u8`, and
//! proves the first playlist plus the first media byte before anything is
//! inserted. `opaque_get` serves those bytes to the webview loader. Tokens stay
//! on the egress header; playlists contain only absolute `/hls/<32 hex>` paths.
use crate::plex::{
    api::{Conn, ConnKind},
    browse,
    egress::{Cred, EgressError},
    merge::Target,
    play,
    proxy::HlsEnt,
    transport::Resp,
};
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use url::Url;

use super::Plex;

const DECISION_MAX: usize = 1024 * 1024;
const PLAYLIST_MAX: usize = 2 * 1024 * 1024;
const SEGMENT_MAX: usize = 32 * 1024 * 1024;
const DIRECT_PREFLIGHT: usize = 2 * 1024 * 1024;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PlayOut {
    pub kind: String,
    pub url: String,
    pub duration_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpaqueOut {
    pub ok: bool,
    pub status: u16,
    pub content_type: String,
    pub body_b64: String,
}

fn fail_status(status: u16) -> String {
    if status == 413 {
        return "playback (413)".into();
    }
    if (100..600).contains(&status) { format!("playback ({status})") } else { "playback".into() }
}

/// stderr line for the next live run. No tokens, no query strings.
fn play_note(step: &str, status: u16, detail: &str) {
    eprintln!("plexuw play: step={step} status={status} {detail}");
}

fn body_class(body: &[u8]) -> &'static str {
    if play::looks_like_m3u8(body) {
        "m3u8"
    } else if body.first().is_some_and(|b| *b == b'{' || *b == b'[') {
        "json"
    } else {
        "bytes"
    }
}

fn redact_excerpt(body: &[u8]) -> String {
    let raw: String = String::from_utf8_lossy(&body[..body.len().min(240)]).chars().map(|c| if c.is_control() { ' ' } else { c }).collect();
    let chars: Vec<char> = raw.chars().collect();
    let lower: Vec<char> = raw.to_ascii_lowercase().chars().collect();
    let keys: [&str; 3] = ["x-plex-token=", "x-plex-token\":\"", "token="];
    let mut s = String::new();
    let mut i = 0;
    while i < chars.len() && s.len() < 140 {
        let rest: String = lower[i..].iter().collect();
        if let Some(k) = keys.iter().copied().find(|k| rest.starts_with(k)) {
            s.push_str(k);
            s.push_str("REDACTED");
            i += k.chars().count();
            while i < chars.len() && !matches!(chars[i], '&' | '"' | ' ' | ',' | '}') {
                i += 1;
            }
            continue;
        }
        s.push(chars[i]);
        i += 1;
    }
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn map_net(e: EgressError) -> String {
    match e {
        EgressError::Net(s) if s.contains("too large") => "playback (413)".into(),
        EgressError::Denied(_) => "playback (denied)".into(),
        EgressError::Redirect => "playback (redirect)".into(),
        EgressError::Net(_) => "playback (network)".into(),
        EgressError::NoToken => "playback (auth)".into(),
        _ => "playback".into(),
    }
}

pub(crate) fn conn_for(p: &Plex, mid: &str) -> Result<Conn, String> {
    let (cur, conn) = p.current().map_err(|_| "playback".to_string())?;
    if cur == mid {
        return Ok(conn);
    }
    p.conns.lock().unwrap().get(mid).cloned().ok_or_else(|| "playback".into())
}

fn location(k: ConnKind) -> &'static str {
    if k == ConnKind::Local { "lan" } else { "wan" }
}

fn offset_sec(offset_ms: u64, duration_ms: u64) -> u64 {
    let mut s = offset_ms / 1000;
    if duration_ms > 0 {
        let cap = duration_ms / 1000;
        if s > cap {
            s = cap;
        }
    }
    if s > 24 * 3600 {
        s = 24 * 3600;
    }
    s
}

pub(crate) async fn fetch(p: &Plex, mid: &str, conn: &Conn, path_query: &str, accept: &str, timeout: Duration, max: usize, range: Option<&str>) -> Result<Resp, String> {
    let (path, query) = play::split_path_query(path_query).ok_or("playback")?;
    if !play::playback_path_ok(path, query) {
        return Err("playback (denied)".into());
    }
    let mut url = conn.url.join(path).map_err(|_| "playback".to_string())?;
    if let Some(q) = query {
        url.set_query(Some(q));
    }
    p.egress.send_playback(url, Cred::Server(mid.to_string()), timeout, max, accept, range).await.map_err(map_net)
}

fn upstream_url(conn: &Conn, path_query: &str) -> Result<Url, String> {
    let (path, query) = play::split_path_query(path_query).ok_or("playback")?;
    let mut url = conn.url.join(path).map_err(|_| "playback".to_string())?;
    if let Some(q) = query {
        url.set_query(Some(q));
    }
    Ok(url)
}

struct Slot {
    id: String,
    upstream: String,
    body: Option<Vec<u8>>,
    content_type: String,
}

fn remember(slots: &mut Vec<Slot>, mid: &str, upstream: &str) -> String {
    let id = play::opaque_id(mid, upstream);
    if !slots.iter().any(|s| s.id == id) {
        let path = upstream.split('?').next().unwrap_or("");
        let content_type = if path.ends_with(".m3u8") {
            "application/vnd.apple.mpegurl".into()
        } else if path.ends_with(".ts") {
            "video/mp2t".into()
        } else if path.ends_with(".mp4") || path.ends_with(".m4s") || path.ends_with(".m4v") {
            "video/mp4".into()
        } else if path.ends_with(".webm") {
            "video/webm".into()
        } else if path.ends_with(".vtt") {
            "text/vtt".into()
        } else {
            "application/octet-stream".into()
        };
        slots.push(Slot { id: id.clone(), upstream: upstream.to_string(), body: None, content_type });
    }
    id
}

fn is_playlist(upstream: &str) -> bool {
    upstream.split('?').next().unwrap_or("").ends_with(".m3u8")
}

fn commit(p: &Plex, mid: &str, slots: &[Slot]) {
    for s in slots {
        p.hls.insert(s.id.clone(), HlsEnt {
            mid: mid.to_string(),
            upstream: s.upstream.clone(),
            body: s.body.clone(),
            content_type: s.content_type.clone(),
        });
    }
}

struct Chosen {
    container: String,
    video: String,
    audio: String,
    duration_ms: u64,
    part: String,
    /// Index actually present on the metadata. An out-of-range version index
    /// falls back to the first media; PMS 400s if the query names a missing one.
    media_index: usize,
}

fn field(v: &serde_json::Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").trim().to_string()
}

fn choose(mc: &serde_json::Value, media_index: usize) -> Result<Chosen, String> {
    let meta = mc.get("Metadata").and_then(|a| a.get(0)).ok_or("playback")?;
    let kind = field(meta, "type");
    if kind != "movie" && kind != "episode" {
        return Err("playback".into());
    }
    let duration_ms = meta.get("duration").and_then(|x| x.as_u64().or_else(|| x.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0);
    let medias = meta.get("Media").and_then(|m| m.as_array()).ok_or("playback")?;
    if medias.is_empty() {
        return Err("playback".into());
    }
    let idx = if media_index < medias.len() { media_index } else { 0 };
    let m = &medias[idx];
    let part = m.get("Part").and_then(|p| p.as_array()).and_then(|a| a.first()).and_then(|p| p.get("key")).and_then(|k| k.as_str()).unwrap_or("").to_string();
    Ok(Chosen { container: field(m, "container"), video: field(m, "videoCodec"), audio: field(m, "audioCodec"), duration_ms, part, media_index: idx })
}

fn part_ok(part: &str) -> bool {
    !part.contains('?') && !part.contains("://") && part.starts_with("/library/parts/") && play::path_shape_ok(part)
}

async fn try_direct(p: &Plex, mid: &str, conn: &Conn, part: &str) -> Result<(), String> {
    let resp = fetch(p, mid, conn, part, "*/*", Duration::from_secs(30), DIRECT_PREFLIGHT, Some("bytes=0-2047")).await?;
    if resp.status != 200 && resp.status != 206 {
        return Err(fail_status(resp.status));
    }
    let ct = resp.content_type.as_deref().unwrap_or("").to_ascii_lowercase();
    if ct.contains("html") || ct.contains("json") || ct.contains("mpegurl") || resp.body.is_empty() {
        return Err("playback".into());
    }
    Ok(())
}

async fn prove_hls(p: &Plex, mid: &str, conn: &Conn, slots: &mut Vec<Slot>) -> Result<(), String> {
    for _ in 0..4 {
        let next = slots.iter().position(|s| s.body.is_none() && is_playlist(&s.upstream));
        let Some(i) = next else { break };
        let up = slots[i].upstream.clone();
        let resp = fetch(p, mid, conn, &up, "*/*", Duration::from_secs(30), PLAYLIST_MAX, None).await.map_err(|e| {
            play_note("media-playlist", 0, &format!("err={e}"));
            e
        })?;
        play_note("media-playlist", resp.status, &format!("m3u8={} bytes={}", play::looks_like_m3u8(&resp.body), resp.body.len()));
        if resp.status != 200 || !play::looks_like_m3u8(&resp.body) {
            return Err(if resp.status == 200 { "playback (502)".into() } else { fail_status(resp.status) });
        }
        let text = String::from_utf8_lossy(&resp.body).into_owned();
        let base = upstream_url(conn, &up)?;
        let rewritten = match play::rewrite_m3u8(&text, &base, |u| remember(slots, mid, u)) {
            Ok(s) => s,
            Err(e) => {
                play_note("rewrite", 0, &format!("err={e} where=media-playlist"));
                return Err("playback (rewrite)".into());
            }
        };
        slots[i].body = Some(rewritten.into_bytes());
        slots[i].content_type = "application/vnd.apple.mpegurl".into();
    }
    let seg = match slots.iter().find(|s| !is_playlist(&s.upstream)) {
        Some(s) => s,
        None => {
            play_note("segment", 0, "err=no-segment");
            return Err("playback (segment)".into());
        }
    };
    let up = seg.upstream.clone();
    let resp = fetch(p, mid, conn, &up, "*/*", Duration::from_secs(60), SEGMENT_MAX, None).await.map_err(|e| {
        play_note("segment", 0, &format!("err={e}"));
        e
    })?;
    let head = resp.body.first().copied().unwrap_or(0);
    play_note("segment", resp.status, &format!("bytes={} head={head:02x}", resp.body.len()));
    if !(200..300).contains(&resp.status) || resp.body.is_empty() {
        return Err(if (200..300).contains(&resp.status) { "playback (502)".into() } else { fail_status(resp.status) });
    }
    Ok(())
}

async fn start_hls(p: &Plex, mid: &str, conn: &Conn, rk: u64, media_index: usize, off: u64, subtitle_stream: Option<u64>) -> Result<String, String> {
    let platform = if cfg!(windows) { "Windows" } else if cfg!(target_os = "macos") { "macOS" } else { "Linux" };
    let pair = play::build_hls_pair(rk, media_index, off, location(conn.kind), &p.egress.client_id, platform, env!("CARGO_PKG_VERSION"), subtitle_stream);
    let dec = fetch(p, mid, conn, &pair.decision, "application/json", Duration::from_secs(30), DECISION_MAX, None).await.map_err(|e| {
        play_note("decision", 0, &format!("err={e}"));
        e
    })?;
    play_note("decision", dec.status, &format!("class={} excerpt={}", body_class(&dec.body), redact_excerpt(&dec.body)));
    if let Some(code) = play::decision_failed(dec.status, &dec.body) {
        return Err(fail_status(code));
    }
    let start = fetch(p, mid, conn, &pair.start, "*/*", Duration::from_secs(30), PLAYLIST_MAX, None).await.map_err(|e| {
        play_note("start.m3u8", 0, &format!("err={e}"));
        e
    })?;
    play_note("start.m3u8", start.status, &format!("m3u8={} bytes={}", play::looks_like_m3u8(&start.body), start.body.len()));
    if start.status != 200 || !play::looks_like_m3u8(&start.body) {
        return Err(if start.status == 200 { "playback (502)".into() } else { fail_status(start.status) });
    }
    let mut slots = Vec::new();
    let master_id = remember(&mut slots, mid, &pair.start);
    let text = String::from_utf8_lossy(&start.body).into_owned();
    let base = upstream_url(conn, &pair.start)?;
    let rewritten = match play::rewrite_m3u8(&text, &base, |u| remember(&mut slots, mid, u)) {
        Ok(s) => s,
        Err(e) => {
            play_note("rewrite", 0, &format!("err={e} where=start.m3u8"));
            return Err("playback (rewrite)".into());
        }
    };
    if let Some(s) = slots.iter_mut().find(|s| s.id == master_id) {
        s.body = Some(rewritten.into_bytes());
        s.content_type = "application/vnd.apple.mpegurl".into();
    }
    prove_hls(p, mid, conn, &mut slots).await?;
    commit(p, mid, &slots);
    play_note("ok", 200, &format!("kind=hls url=/hls/{master_id}"));
    Ok(format!("/hls/{master_id}"))
}

pub async fn start(p: &Arc<Plex>, id: &str, version_id: Option<&str>, offset_ms: u64, subtitle_index: Option<u32>) -> Result<PlayOut, String> {
    p.hls.clear();
    let (mut mid, mut rk) = super::mx::item_target(p, id).map_err(|_| "playback".to_string())?;
    let mut media_index = 0usize;
    if let Some(vid) = version_id {
        if let Some(Target::Version { mid: vm, rating_key, media, .. }) = p.slots.resolve(vid) {
            mid = vm;
            rk = rating_key;
            media_index = media;
        }
    }
    let mc = super::mx::fetch_on(p, &mid, &browse::Api::Metadata(rk)).await.map_err(|_| "playback".to_string())?;
    let chosen = choose(&mc, media_index)?;
    let conn = conn_for(p, &mid)?;
    let off = offset_sec(offset_ms, chosen.duration_ms);
    // Subtitle index is the Nth streamType=3 on the playing media. Burn needs HLS;
    // a direct play cannot carry PGS or SRT, so a chosen track skips the direct path.
    let sub_id = subtitle_index.and_then(|i| nth_subtitle_id(&mc, chosen.media_index, i));
    if sub_id.is_none() && play::webview_native(&chosen.container, &chosen.video, &chosen.audio) && part_ok(&chosen.part) && try_direct(p, &mid, &conn, &chosen.part).await.is_ok() {
        let id = play::opaque_id(&mid, &chosen.part);
        p.hls.insert(id.clone(), HlsEnt { mid: mid.clone(), upstream: chosen.part, body: None, content_type: "video/mp4".into() });
        p.arm_timeline(&mid, rk, chosen.duration_ms, offset_ms);
        return Ok(PlayOut { kind: "direct".into(), url: format!("/media/{id}"), duration_ms: chosen.duration_ms });
    }
    let url = start_hls(p, &mid, &conn, rk, chosen.media_index, off, sub_id).await?;
    p.arm_timeline(&mid, rk, chosen.duration_ms, offset_ms);
    Ok(PlayOut { kind: "hls".into(), url, duration_ms: chosen.duration_ms })
}

/// Same ordinal `av_tracks` shows the UI: streamType 3, skipping streams with no label, cap 8.
fn nth_subtitle_id(mc: &serde_json::Value, media_index: usize, index: u32) -> Option<u64> {
    if index > 7 { return None; }
    let meta = mc.get("Metadata")?.get(0)?;
    let medias = meta.get("Media")?.as_array()?;
    let idx = if media_index < medias.len() { media_index } else { 0 };
    let streams = medias.get(idx)?.get("Part")?.as_array()?.first()?.get("Stream")?.as_array()?;
    let mut n = 0u32;
    for st in streams {
        if st.get("streamType").and_then(|x| x.as_u64()).unwrap_or(0) != 3 { continue; }
        let disp = st.get("displayTitle").and_then(|x| x.as_str()).unwrap_or("");
        let lang = st.get("language").and_then(|x| x.as_str()).unwrap_or("");
        let codec = st.get("codec").and_then(|x| x.as_str()).unwrap_or("");
        if disp.is_empty() && lang.is_empty() && codec.is_empty() { continue; }
        let low = disp.to_ascii_lowercase();
        if disp.contains(['/', '\\']) || low.contains("://") || low.contains("token") { continue; }
        if n == index {
            let id = st.get("id").and_then(|x| x.as_u64())?;
            if id == 0 || id > 999_999_999_999 { return None; }
            return Some(id);
        }
        n += 1;
        if n >= 8 { break; }
    }
    None
}

fn opaque_bad(status: u16) -> OpaqueOut {
    OpaqueOut { ok: false, status, content_type: String::new(), body_b64: String::new() }
}

pub async fn opaque(p: &Arc<Plex>, kind: &str, id: &str) -> OpaqueOut {
    if kind != "hls" && kind != "media" {
        return opaque_bad(400);
    }
    if id.len() != 32 || !id.bytes().all(|b| b.is_ascii_hexdigit()) {
        return opaque_bad(400);
    }
    let Some(ent) = p.hls.get(id) else { return opaque_bad(404) };
    if let Some(body) = ent.body.clone() {
        return OpaqueOut { ok: true, status: 200, content_type: ent.content_type, body_b64: play::b64_encode(&body) };
    }
    let Ok(conn) = conn_for(p, &ent.mid) else { return opaque_bad(404) };
    let resp = match fetch(p, &ent.mid, &conn, &ent.upstream, "*/*", Duration::from_secs(60), SEGMENT_MAX, None).await {
        Ok(r) => r,
        Err(e) => return opaque_bad(if e.contains("413") { 413 } else { 502 }),
    };
    if resp.status != 200 && resp.status != 206 {
        return opaque_bad(if resp.status == 0 { 502 } else { resp.status });
    }
    if play::looks_like_m3u8(&resp.body) {
        let Ok(base) = upstream_url(&conn, &ent.upstream) else { return opaque_bad(502) };
        let text = String::from_utf8_lossy(&resp.body).into_owned();
        let mut slots = Vec::new();
        let rewritten = match play::rewrite_m3u8(&text, &base, |u| remember(&mut slots, &ent.mid, u)) {
            Ok(s) => s,
            Err(_) => return opaque_bad(502),
        };
        commit(p, &ent.mid, &slots);
        let bytes = rewritten.into_bytes();
        p.hls.insert(id.to_string(), HlsEnt { mid: ent.mid, upstream: ent.upstream, body: Some(bytes.clone()), content_type: "application/vnd.apple.mpegurl".into() });
        return OpaqueOut { ok: true, status: 200, content_type: "application/vnd.apple.mpegurl".into(), body_b64: play::b64_encode(&bytes) };
    }
    let ct = resp.content_type.clone().unwrap_or(ent.content_type);
    OpaqueOut { ok: true, status: resp.status, content_type: ct, body_b64: play::b64_encode(&resp.body) }
}

/// Protocol GET for a registered `/media/<id>` or `/hls/<id>`.
pub async fn proxy_bytes(p: &Arc<Plex>, id: &str, range: Option<&str>) -> super::ProxyResp {
    let Some(ent) = p.hls.get(id) else { return super::ProxyResp::deny(404) };
    if let Some(body) = ent.body.clone() {
        return super::ProxyResp { status: 200, content_type: Some(play::static_type(&ent.content_type)), body, content_range: None };
    }
    let bounded = if let Some(raw) = range {
        match play::bound_range(Some(raw)) {
            Some(r) => Some(r),
            None => return super::ProxyResp::deny(416),
        }
    } else {
        None
    };
    let Ok(conn) = conn_for(p, &ent.mid) else { return super::ProxyResp::deny(404) };
    let max = if bounded.is_some() { 8 * 1024 * 1024 } else { SEGMENT_MAX };
    let resp = match fetch(p, &ent.mid, &conn, &ent.upstream, "*/*", Duration::from_secs(60), max, bounded.as_deref()).await {
        Ok(r) => r,
        Err(e) => return super::ProxyResp::deny(if e.contains("413") { 413 } else { 502 }),
    };
    if resp.status != 200 && resp.status != 206 {
        return super::ProxyResp::deny(if resp.status == 0 { 502 } else { resp.status });
    }
    if play::looks_like_m3u8(&resp.body) {
        let Ok(base) = upstream_url(&conn, &ent.upstream) else { return super::ProxyResp::deny(502) };
        let text = String::from_utf8_lossy(&resp.body).into_owned();
        let mut slots = Vec::new();
        let Ok(rewritten) = play::rewrite_m3u8(&text, &base, |u| remember(&mut slots, &ent.mid, u)) else { return super::ProxyResp::deny(502) };
        commit(p, &ent.mid, &slots);
        let body = rewritten.into_bytes();
        p.hls.insert(id.to_string(), HlsEnt { mid: ent.mid, upstream: ent.upstream, body: Some(body.clone()), content_type: "application/vnd.apple.mpegurl".into() });
        return super::ProxyResp { status: 200, content_type: Some("application/vnd.apple.mpegurl"), body, content_range: None };
    }
    let ct = play::static_type(resp.content_type.as_deref().unwrap_or(&ent.content_type));
    super::ProxyResp { status: resp.status, content_type: Some(ct), body: resp.body, content_range: resp.content_range }
}

#[cfg(test)]
mod t {
    use super::*;

    #[test]
    fn nth_subtitle_matches_ui_ordinal() {
        let mc = serde_json::json!({"Metadata":[{"Media":[{"Part":[{"Stream":[
            {"id":1,"streamType":2,"displayTitle":"English"},
            {"id":11,"streamType":3,"displayTitle":"English"},
            {"id":12,"streamType":3,"displayTitle":"English (SDH)"},
            {"id":13,"streamType":3,"codec":"srt","language":"Italiano"},
            {"id":14,"streamType":3,"displayTitle":"Italiano"},
            {"id":99,"streamType":3,"displayTitle":"https://evil.example/a?token=sekrit"}
        ]}]}]}]});
        assert_eq!(nth_subtitle_id(&mc, 0, 0), Some(11));
        assert_eq!(nth_subtitle_id(&mc, 0, 3), Some(14));
        assert_eq!(nth_subtitle_id(&mc, 0, 4), None);
    }

    #[test]
    fn choose_uses_present_media_index() {
        let mc = serde_json::json!({"Metadata":[{"type":"movie","duration":6000,"Media":[
            {"container":"mkv","videoCodec":"hevc","audioCodec":"eac3","Part":[{"key":"/library/parts/1/file.mkv"}]},
            {"container":"mp4","videoCodec":"h264","audioCodec":"aac","Part":[{"key":"/library/parts/2/file.mp4"}]}
        ]}]});
        let first = choose(&mc, 9).unwrap();
        assert_eq!(first.media_index, 0);
        assert_eq!(first.container, "mkv");
        assert_eq!(first.video, "hevc");
        let second = choose(&mc, 1).unwrap();
        assert_eq!(second.media_index, 1);
        assert_eq!(second.container, "mp4");
        assert!(choose(&serde_json::json!({"Metadata":[{"type":"movie","Media":[]}]}), 0).is_err());
    }

    #[test]
    fn excerpt_drops_tokens() {
        let body = br#"{"MediaContainer":{"generalDecisionCode":1001},"X-Plex-Token":"srv1-SECRET"}"#;
        let s = redact_excerpt(body);
        assert!(s.contains("generalDecisionCode"));
        assert!(!s.contains("SECRET") && !s.contains("srv1"));
        let q = b"#EXTM3U\nseg.ts?X-Plex-Token=srv1-SECRET&foo=1\n";
        let s = redact_excerpt(q);
        assert!(s.contains("#EXTM3U"));
        assert!(!s.to_ascii_lowercase().contains("secret"));
    }
}
