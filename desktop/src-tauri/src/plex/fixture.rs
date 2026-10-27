//! Fixture plex.tv + servers (tests and the `mockplex` screenshot build).
//! Every value is fake. No network.
use super::transport::{Fut, Method, Req, Resp, Transport};
use secrecy::ExposeSecret;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

pub const FIX_ACCOUNT_TOKEN: &str = "acct-FIXTURE-not-a-real-token";
pub const FIX_SERVER_TOKEN: &str = "srv1-FIXTURE-not-a-real-token";
pub const HEX: &str = "0123456789abcdef0123456789abcdef";

#[derive(Default)]
pub struct FixtureTransport {
    pub remote_down: bool,
    pub never_auth: bool,
    pub short_expiry: bool,
    pub pins_redirect: bool,
    /// Makes "Friend's Server" reachable with its own, different library (two-server switch tests).
    pub second_online: bool,
    /// Overrides the PIN code plex.tv returns (LOW-11 validation tests).
    pub pin_code: Option<String>,
    /// fu7b: Slowpoke answers library requests after this many ms (soft/hard deadline tests).
    pub slow_ms: u64,
    /// fu7b: BLACKBOX rejects its server token (401 marks only that server offline).
    pub blackbox_401: bool,
    /// `/library/all` returns the row with no Media array (guid search on real PMS).
    pub guid_slim: bool,
    /// `/library/all` returns 500 so the version fan-out records a miss.
    pub guid_fail: bool,
    pub polls: AtomicU32,
    pub log: Mutex<Vec<String>>,
}

impl FixtureTransport {
    /// Request log; tokens appear only as their first 4 chars ("token=acct").
    pub fn log(&self) -> Vec<String> { self.log.lock().unwrap().clone() }
}

/// Redacted playback-profile note for the fixture log. Never includes the extra body.
fn profile_note(headers: &[(&str, String)]) -> &'static str {
    let name = headers.iter().find(|(k, _)| *k == "X-Plex-Client-Profile-Name").map(|(_, v)| v.as_str());
    let extra = headers.iter().find(|(k, _)| *k == "X-Plex-Client-Profile-Extra").map(|(_, v)| v.as_str());
    let generic = name == Some("Generic");
    let hls = extra.is_some_and(|v| {
        v.contains("protocol=hls") && v.contains("container=mpegts") && v.contains("videoCodec=h264") && v.contains("audioCodec=aac")
            && !v.to_ascii_lowercase().contains("hevc") && !v.contains("h265") && !v.contains("mkv") && !v.to_ascii_lowercase().contains("htpc")
    });
    match (generic, extra.is_some(), hls) {
        (true, true, true) => " profile=Generic extra=hls-h264",
        (true, true, false) => " profile=Generic extra=other",
        (true, false, _) => " profile=Generic",
        (false, _, _) if name.is_some() || extra.is_some() => " profile=other",
        _ => "",
    }
}

fn json(status: u16, s: String) -> Result<Resp, String> { Ok(Resp { status, body: s.into_bytes(), content_type: Some("application/json".into()), content_range: None }) }

impl Transport for FixtureTransport {
    fn send(&self, r: Req) -> Fut<'_> {
        Box::pin(async move {
            let tok = r.token.as_ref().map(|t| t.expose_secret().chars().take(4).collect::<String>());
            self.log.lock().unwrap().push(format!(
                "{:?} {} {}{}",
                r.method,
                r.url,
                tok.as_ref().map(|t| format!("token={t}")).unwrap_or_default(),
                profile_note(&r.headers)
            ));
            let host = r.url.host_str().unwrap_or("").to_string();
            let path = r.url.path().to_string();
            let strong = r.url.query().map(|q| q.contains("strong=true")).unwrap_or(false);
            match (r.method, host.as_str(), path.as_str()) {
                (Method::Post, "plex.tv", "/api/v2/pins") => {
                    if self.pins_redirect { return Ok(Resp { status: 302, body: vec![], content_type: None, content_range: None }); }
                    let code = self.pin_code.clone().unwrap_or_else(|| (if strong { "fxcode7k2q9w4m8r1t6y3u0p5" } else { "K7Q2" }).into());
                    let code = serde_json::to_string(&code).unwrap();
                    let code = code.trim_matches('"');
                    let exp = if self.short_expiry { 0 } else { 900 };
                    json(201, format!(r#"{{"id":4242,"code":"{code}","expiresIn":{exp},"authToken":null}}"#))
                }
                (Method::Get, "plex.tv", "/api/v2/pins/4242") => {
                    let n = self.polls.fetch_add(1, Ordering::SeqCst);
                    if self.never_auth || n < 2 {
                        json(200, r#"{"id":4242,"code":"x","authToken":null}"#.into())
                    } else {
                        json(200, format!(r#"{{"id":4242,"code":"x","authToken":"{FIX_ACCOUNT_TOKEN}"}}"#))
                    }
                }
                (Method::Get, "clients.plex.tv", "/api/v2/resources") => {
                    if tok.as_deref() != Some("acct") { return json(401, "{}".into()); }
                    let p2 = self.second_online;
                    json(200, format!(r#"[
 {{"name":"MoxBox","clientIdentifier":"fixturemachine0001","provides":"server","owned":true,"presence":true,
   "accessToken":"{FIX_SERVER_TOKEN}","connections":[
   {{"protocol":"https","uri":"https://10-0-0-2.{HEX}.plex.direct:32400","local":true,"relay":false}},
   {{"protocol":"https","uri":"https://203-0-113-9.{HEX}.plex.direct:32400","local":false,"relay":false}},
   {{"protocol":"http","uri":"http://10.0.0.2:32400","local":true,"relay":false}},
   {{"protocol":"https","uri":"https://198-51-100-7.{HEX}.plex.direct:8443","local":false,"relay":true}}]}},
 {{"name":"Slowpoke","clientIdentifier":"fixturemachine0002","provides":"server","owned":false,"presence":{p2},
   "accessToken":"srv2-FIXTURE-not-a-real-token","connections":[
   {{"protocol":"https","uri":"https://192-0-2-4.{HEX}.plex.direct:32400","local":false,"relay":false}}]}},
 {{"name":"BLACKBOX","clientIdentifier":"fixturemachine0004","provides":"server","owned":true,"presence":true,
   "accessToken":"srv4-FIXTURE-not-a-real-token","connections":[
   {{"protocol":"https","uri":"https://198-51-100-44.{HEX}.plex.direct:32400","local":false,"relay":false}}]}},
 {{"name":"Living Room TV","clientIdentifier":"fixtureplayer0003","provides":"player","owned":true,"presence":true,"connections":[]}}
]"#))
                }
                (Method::Get, h, "/identity") => {
                    let ok = |m: &str| json(200, format!(r#"{{"MediaContainer":{{"machineIdentifier":"{m}","version":"1.41.0"}}}}"#));
                    if h.starts_with("198-51-100-44.") {
                        ok("fixturemachine0004")
                    } else if self.second_online && h.starts_with("192-0-2-4.") {
                        ok("fixturemachine0002")
                    } else if h.starts_with("10-0-0-2.") || h.starts_with("192-0-2-4.") {
                        tokio::time::sleep(std::time::Duration::from_millis(30)).await;
                        Err("connect timeout".into())
                    } else if h.starts_with("203-0-113-9.") {
                        if self.remote_down { Err("connection refused".into()) } else { ok("fixturemachine0001") }
                    } else if h.starts_with("198-51-100-7.") || h == "plex.example.com" {
                        ok("fixturemachine0001")
                    } else if h == "impostor.example.com" {
                        ok("not-on-account-9999")
                    } else {
                        Err("dns error".into())
                    }
                }
                // plex.tv CDN cast photos: must arrive token-less (Sentinel, round 5).
                (Method::Get, "metadata-static.plex.tv", p) => {
                    if tok.is_some() { return json(401, "{}".into()); }
                    let img = |ct: &str, n: usize| Ok(Resp { status: 200, body: vec![0xFF; n], content_type: Some(ct.into()), content_range: None });
                    match p {
                        "/people/fixture.jpg" => img("image/jpeg", 64),
                        "/people/redirect.jpg" => Ok(Resp { status: 302, body: vec![], content_type: None, content_range: None }),
                        "/people/html.jpg" => img("text/html", 64),
                        "/people/anim.png" => img("image/gif", 64),
                        "/people/svg.png" => img("image/svg+xml", 64),
                        "/people/big.jpg" => img("image/jpeg", 5 * 1024 * 1024 + 1),
                        "/users/moxneo.jpg" => img("image/jpeg", 64),
                        _ => json(404, "{}".into()),
                    }
                }
                (Method::Get, "plex.tv", "/api/v2/user") => {
                    if tok.as_deref() != Some("acct") { return json(401, "{}".into()); }
                    if r.url.query().is_some() { return json(400, "{}".into()); }
                    json(200, r#"{"id":7,"uuid":"not-for-js","email":"not-for-js@example.com","username":"moxneo","title":"Moxneo","friendlyName":"Mox","subscription":{"active":true},"thumb":"https://metadata-static.plex.tv/users/moxneo.jpg"}"#.into())
                }
                (Method::Get, _, p) if super::egress::server_path(p, r.url.query()) || p == "/photo/:/transcode" => {
                    let q = r.url.query().unwrap_or("");
                    if self.slow_ms > 0 && host.starts_with("192-0-2-4.") { tokio::time::sleep(std::time::Duration::from_millis(self.slow_ms)).await; }
                    if self.blackbox_401 && host.starts_with("198-51-100-44.") { return json(401, "{}".into()); }
                    let res = match tok.as_deref() {
                        Some("srv1") if !host.starts_with("192-0-2-4.") && !host.starts_with("198-51-100-44.") => lib::serve(p, q),
                        Some("srv4") if host.starts_with("198-51-100-44.") => lib::serve3(p, q),
                        Some("srv2") if self.second_online && host.starts_with("192-0-2-4.") => lib::serve2(p, q),
                        _ => return json(401, "{}".into()),
                    };
                    match res {
                        Some(Ok((ct, body))) => {
                            if p == "/library/all" && self.guid_fail { return json(500, "{}".into()); }
                            let body = if p == "/library/all" && self.guid_slim { strip_media_arrays(&body) } else { body };
                            Ok(Resp { status: 200, body, content_type: Some(ct.into()), content_range: None })
                        }
                        Some(Err(code)) => json(code, "{}".into()),
                        None => json(404, "{}".into()),
                    }
                }
                _ => json(404, "{}".into()),
            }
        })
    }
}

fn strip_media_arrays(body: &[u8]) -> Vec<u8> {
    let Ok(mut v) = serde_json::from_slice::<serde_json::Value>(body) else { return body.to_vec() };
    fn walk(v: &mut serde_json::Value) {
        match v {
            serde_json::Value::Object(o) => {
                if o.contains_key("ratingKey") { o.remove("Media"); }
                for x in o.values_mut() { walk(x); }
            }
            serde_json::Value::Array(a) => { for x in a { walk(x); } }
            _ => {}
        }
    }
    walk(&mut v);
    v.to_string().into_bytes()
}

/// Fake server library (fictional titles; every value invented).
pub mod lib {
    use serde_json::{json, Value};
    pub const MOVIES: &[&str] = &["Neon Meridian","The Quiet Orbit","Saltwater Kings","Paper Lanterns","Glass Harbor","Iron Prairie","Last Signal",
        "Velvet District","Northbound","Cinder Falls","The Lattice","Hollow Crown Inn","Moth & Mirror","Static Bloom","Arctic Relay","Brass Tide",
        "Echo Valley","Solar Drift","Midnight Ledger","Copper Moon","The Long Fold","Driftwood","Parallax","Low Tide Club",
        "Amber Circuit","Ghost Freight","Lantern Row","Orchid Protocol","Red Dune Motel","Silver Ash"];
    pub const SHOWS: &[&str] = &["Harbor Lights","Night Ferry","Quartz City","Second Sun","Winter Relay","Fable Street"];
    const GENRES: &[&str] = &["Sci-Fi","Drama","Comedy","Thriller","Adventure","Mystery"];
    /// Hostile string used to prove server text is never parsed as HTML.
    pub const HOSTILE: &str = "<img src=x onerror=alert(1)> Tag & \"Quote\"";

    /// fu7e fixture cast (all invented): name, role, thumb ("" = no photo).
    pub const CAST: &[(&str, &str, &str)] = &[
        ("Avery Lane", "Captain Imre Sol", "/library/metadata/1001/thumb/1700000000"),
        ("Jun Okafor", "Navigator Teo", "/library/metadata/1002/thumb/1700000000"),
        ("Mara Voss", "Chief Engineer", "https://metadata-static.plex.tv/people/fixture.jpg"),
        ("Dev Ramaswamy", "Dr. Hale", "/library/metadata/1004/thumb/1700000000"),
        ("Ines Calloway", "Ambassador Rook", ""),
        ("Theo Brandt", "Pilot Ash", "/library/metadata/1006/thumb/1700000000")];
    /// Plex-style 24-hex person tagKey, identical on every fixture server.
    pub fn tag_key(j: usize) -> String { format!("5d7768{:018x}", 0xa0 + j) }
    /// 30 base titles x 8 = 240 movies, so paging and grid virtualisation are exercised.
    pub const N_MOVIES: usize = 240;
    fn mtitle(i: usize) -> String { let b = MOVIES[i % MOVIES.len()]; if i < MOVIES.len() { b.into() } else { format!("{b} {}", ["II","III","IV","V","VI","VII","VIII"][i / MOVIES.len() - 1]) } }
    fn movie(i: usize) -> Value {
        let id = 1000 + i;
        let mut v = json!({"ratingKey": id.to_string(), "key": format!("/library/metadata/{id}"), "type":"movie",
            "title": mtitle(i), "year": 1994 + (i * 7 % 30), "duration": (88 + i * 3 % 50) * 60000,
            "summary": format!("A fictional fixture film about {}. No real data.", mtitle(i).to_lowercase()),
            "contentRating": (["PG","PG-13","R","TV-14"][i % 4]), "audienceRating": 5.5 + (i % 9) as f64 * 0.5,
            "thumb": format!("/library/metadata/{id}/thumb/1700000000"), "art": format!("/library/metadata/{id}/art/1700000000"),
            "Genre": [{"tag": GENRES[i % 6]}, {"tag": GENRES[(i + 2) % 6]}], "addedAt": 1700000000 + i * 1000,
            "studio": (["Northlight Pictures","Harbor & Pine","Kestrel Films"][i % 3]),
            "guid": format!("plex://movie/5d77{:020x}", i), "Guid": [{"id": format!("imdb://tt{:07}", 9000000 + i)}]});
        if i % 5 == 1 { v["viewOffset"] = json!((20 + i) * 60000); }
        if i % 4 == 0 { v["viewCount"] = json!(1); }
        if i == 13 { v["tagline"] = json!(HOSTILE); }
        v["Media"] = json!([{"container":"mkv","videoCodec":"hevc","videoResolution": if i % 3 == 0 { "4k" } else { "1080" },"audioCodec":"eac3","audioChannels":6,"bitrate":18000 + i * 10,
            "Part":[{"size": 9_000_000_000u64 + i as u64 * 1000, "file": "/fixture/not-sent/to-js.mkv", "key": "/library/parts/1/file.mkv",
                "Stream":[
                    {"streamType":1,"codec":"hevc","displayTitle":"HEVC"},
                    {"streamType":2,"codec":"eac3","channels":6,"language":"English","displayTitle":"English · E-AC3 5.1","selected":1},
                    {"streamType":2,"codec":"aac","channels":2,"language":"English","displayTitle":"English · AAC stereo"},
                    {"streamType":3,"codec":"srt","language":"English","displayTitle":"English (SRT)"},
                    {"streamType":3,"codec":"pgs","language":"English","displayTitle":"English (PGS)"}
                ]}]}]);
        v
    }
    fn show(i: usize) -> Value {
        let id = 2000 + i * 100;
        json!({"ratingKey": id.to_string(), "type":"show", "title": SHOWS[i], "guid": format!("plex://show/5d78{:020x}", i), "year": 2012 + i, "childCount": 2, "leafCount": 12, "viewedLeafCount": (i * 3) % 12,
            "summary": format!("A fictional fixture series: {}.", SHOWS[i]), "thumb": format!("/library/metadata/{id}/thumb/1700000000"),
            "art": format!("/library/metadata/{id}/art/1700000000"), "contentRating": "TV-14", "Genre": [{"tag": GENRES[i % 6]}]})
    }
    fn season(si: usize, n: usize) -> Value {
        let sid = 2000 + si * 100; let id = sid + n;
        json!({"ratingKey": id.to_string(), "type":"season", "title": format!("Season {n}"), "index": n, "parentRatingKey": sid.to_string(),
            "parentTitle": SHOWS[si], "leafCount": 6, "viewedLeafCount": if n == 1 { 6 } else { 2 }, "thumb": format!("/library/metadata/{sid}/thumb/1700000000")})
    }
    fn episode(si: usize, n: usize, e: usize) -> Value {
        let sid = 2000 + si * 100; let id = sid + n * 10 + e;
        let mut v = json!({"ratingKey": id.to_string(), "type":"episode", "title": format!("Chapter {}", ["One","Two","Three","Four","Five","Six"][e - 1]),
            "index": e, "parentIndex": n, "grandparentTitle": SHOWS[si], "parentRatingKey": (sid + n).to_string(), "grandparentRatingKey": sid.to_string(),
            "duration": 2_700_000, "summary": "Fixture episode synopsis.",
            "thumb": format!("/library/metadata/{id}/thumb/1700000000"),
            "grandparentThumb": format!("/library/metadata/{sid}/thumb/1700000000"),
            "art": format!("/library/metadata/{sid}/art/1700000000")});
        if n == 1 || e <= 2 { v["viewCount"] = json!(1); }
        if n == 2 && e == 3 { v["viewOffset"] = json!(900_000); }
        v
    }
    fn artist(i: usize) -> Value {
        let id = 3000 + i;
        json!({"ratingKey": id.to_string(), "type":"artist", "title": (["Copper Choir","The Low Tides","Static Bloom","Juniper Hollow"][i]), "thumb": format!("/library/metadata/{id}/thumb/1700000000")})
    }
    fn mc(items: Vec<Value>, extra: Value) -> Value {
        let mut m = json!({"size": items.len(), "Metadata": items});
        if let Value::Object(o) = extra { for (k, v) in o { m[k] = v; } }
        json!({"MediaContainer": m})
    }
    fn hub(title: &str, ident: &str, items: Vec<Value>) -> Value {
        json!({"title": title, "hubIdentifier": ident, "type": items.first().and_then(|v| v["type"].as_str()).unwrap_or("movie"), "size": items.len(), "Metadata": items})
    }
    fn q<'a>(query: &'a str, k: &str) -> Option<String> {
        url::form_urlencoded::parse(query.as_bytes()).find(|(a, _)| a == k).map(|(_, v)| v.into_owned())
    }
    /// HLS decision/start must be a forced H.264/AAC transcode under the Generic
    /// profile. `copyts=1` is the HTTP/MKV flag and is a 400 on this path.
    fn hls_force_bad(query: &str) -> bool {
        let profile = q(query, "X-Plex-Client-Profile-Name").unwrap_or_default();
        let video = q(query, "videoCodec").unwrap_or_default();
        let audio = q(query, "audioCodec").unwrap_or_default();
        !query.contains("directPlay=0")
            || !query.contains("directStream=0")
            || query.contains("X-Plex-Token")
            || query.contains("copyts=1")
            || profile != "Generic"
            || video != "h264"
            || audio != "aac"
            || profile.to_ascii_lowercase().contains("htpc")
            || video.to_ascii_lowercase().contains("hevc")
            || video.to_ascii_lowercase().contains("h265")
    }
    fn ok(v: Value) -> Option<Result<(&'static str, Vec<u8>), u16>> { Some(Ok(("application/json", v.to_string().into_bytes()))) }

    /// Second fixture server: different section ids, titles and genres. Other paths reuse
    /// the first library with ids remapped (7 -> 1, 8 -> 2); ids 1-3 do not exist here.
    pub const GENRES2: &[&str] = &["Documentary", "Western", "Noir"];
    pub fn serve2(p: &str, query: &str) -> Option<Result<(&'static str, Vec<u8>), u16>> {
        let seg: Vec<&str> = p.trim_start_matches('/').split('/').collect();
        match seg.as_slice() {
            ["library", "sections"] => ok(json!({"MediaContainer": {"size": 2, "Directory": [
                {"key":"7","type":"movie","title":"Friend Films"},{"key":"8","type":"show","title":"Friend Series"}]}})),
            ["library", "sections", "7" | "8", "genre"] => ok(json!({"MediaContainer": {"Directory":
                GENRES2.iter().enumerate().map(|(i, g)| json!({"key": (40 + i).to_string(), "title": g})).collect::<Vec<_>>()}})),
            ["library", "sections", id, rest @ ..] => {
                let id = match *id { "7" => "1", "8" => "2", _ => return Some(Err(404)) };
                let q = query.replace("genre=4", "genre=1");
                serve(&format!("/library/sections/{id}/{}", rest.join("/")), &q)
            }
            _ => serve(p, query),
        }
    }
    /// Third fixture server (BLACKBOX, owned): one movie library holding every 3rd
    /// movie of the first library at 1080p only, so titles duplicate across servers.
    pub fn serve3(p: &str, query: &str) -> Option<Result<(&'static str, Vec<u8>), u16>> {
        if p == "/library/sections" { return ok(json!({"MediaContainer": {"size": 1, "Directory": [{"key":"1","type":"movie","title":"BLACKBOX Films"}]}})); }
        if p.starts_with("/library/sections/") && !p.starts_with("/library/sections/1/") { return Some(Err(404)); }
        if p == "/hubs/home/onDeck" { return ok(mc(vec![], json!({}))); }
        if let Some(n) = p.strip_prefix("/library/metadata/").and_then(|r| r.split('/').next()).and_then(|n| n.parse::<usize>().ok()) {
            if !(1000..1000 + N_MOVIES).contains(&n) || (n - 1000) % 3 != 0 || p.ends_with("/children") { return Some(Err(404)); }
        }
        let all = p == "/library/sections/1/all";
        let qq = if all { query.split('&').filter(|kv| !kv.starts_with("X-Plex-Container-")).collect::<Vec<_>>().join("&") + "&X-Plex-Container-Start=0&X-Plex-Container-Size=100000" } else { query.to_string() };
        let Ok((_, body)) = serve(p, &qq)? else { return Some(Err(404)) };
        let mut v: Value = serde_json::from_slice(&body).ok()?;
        fn keep3(v: &mut Value) {
            match v {
                Value::Object(o) => {
                    if let Some(Value::Array(a)) = o.get_mut("Metadata") {
                        a.retain(|m| m["type"] == "movie" && m["ratingKey"].as_str().and_then(|r| r.parse::<usize>().ok()).map(|r| (r - 1000) % 3 == 0).unwrap_or(false));
                        for m in a.iter_mut() {
                            m["Media"][0]["videoResolution"] = json!("1080"); m["Media"][0]["bitrate"] = json!(9000);
                            if let Some(off) = m.get("viewOffset").and_then(Value::as_u64) {
                                m["viewOffset"] = json!(off + 60_000);
                                m["lastViewedAt"] = json!(1_800_000_000u64 + m["ratingKey"].as_str().unwrap().parse::<u64>().unwrap());
                            }
                        }
                    }
                    for (_, x) in o.iter_mut() { keep3(x); }
                }
                Value::Array(a) => for x in a { keep3(x) },
                _ => {}
            }
        }
        keep3(&mut v);
        if let Some(Value::Array(h)) = v["MediaContainer"].get_mut("Hub") { h.retain(|x| x["Metadata"].as_array().map(|a| !a.is_empty()).unwrap_or(false)); }
        if all {
            let start: usize = q(query, "X-Plex-Container-Start").and_then(|v| v.parse().ok()).unwrap_or(0);
            let size: usize = q(query, "X-Plex-Container-Size").and_then(|v| v.parse().ok()).unwrap_or(100);
            let items: Vec<Value> = v["MediaContainer"]["Metadata"].as_array().cloned().unwrap_or_default();
            let total = items.len();
            return ok(mc(items.into_iter().skip(start).take(size).collect(), json!({"totalSize": total, "offset": start})));
        }
        ok(v)
    }
    pub fn serve(p: &str, query: &str) -> Option<Result<(&'static str, Vec<u8>), u16>> {
        if p == "/:/scrobble" || p == "/:/unscrobble" { return ok(json!({"MediaContainer":{"size":0}})); }
        let seg: Vec<&str> = p.trim_start_matches('/').split('/').collect();
        let movies: Vec<Value> = (0..N_MOVIES).map(movie).collect();
        if p == "/library/all" {
            let g = q(query, "guid")?;
            return ok(mc(movies.into_iter().filter(|m| m["guid"].as_str() == Some(&g)).collect(), json!({})));
        }
        let shows: Vec<Value> = (0..SHOWS.len()).map(show).collect();
        match seg.as_slice() {
            ["library", "sections"] => ok(json!({"MediaContainer": {"size": 3, "Directory": [
                {"key":"1","type":"movie","title":"Movies"},{"key":"2","type":"show","title":"TV Shows"},{"key":"3","type":"artist","title":"Music"}]}})),
            ["hubs", "continueWatching"] => ok(json!({"MediaContainer": {"Hub": [hub("Continue Watching", "home.continue",
                movies.iter().filter(|m| m.get("viewOffset").is_some()).cloned().chain([episode(1, 2, 3)]).collect())]}})),
            ["hubs", "home", "onDeck"] => ok(mc(vec![episode(1, 2, 3), episode(3, 2, 3)], json!({}))),
            ["hubs", "promoted"] => ok(json!({"MediaContainer": {"Hub": [
                hub("Recently Added Movies", "movie.recentlyadded", movies.iter().rev().take(14).cloned().collect()),
                hub("Recently Added TV", "tv.recentlyadded", shows.clone()),
                hub("Top Rated", "movie.toprated", movies.iter().step_by(3).cloned().collect())]}})),
            ["hubs", "sections", id] => {
                let body = if *id == "2" {
                    json!({"MediaContainer": {"Hub": [
                        hub("Continue Watching", "home.continue", vec![episode(1, 2, 3), episode(0, 1, 2), episode(2, 1, 1)]),
                        hub("Recently Added", "tv.recentlyadded", shows.clone()),
                    ]}})
                } else {
                    let cw: Vec<Value> = movies.iter().filter(|m| m.get("viewOffset").is_some()).take(12).cloned().collect();
                    let scifi: Vec<Value> = movies.iter().filter(|m| m["Genre"].as_array().map(|a| a.iter().any(|t| t["tag"] == "Sci-Fi")).unwrap_or(false)).take(12).cloned().collect();
                    json!({"MediaContainer": {"Hub": [
                        hub("Continue Watching", "home.continue", cw),
                        hub("Recently Added", "movie.recentlyadded", movies.iter().rev().take(16).cloned().collect()),
                        hub("Top Rated", "movie.toprated", movies.iter().step_by(3).take(12).cloned().collect()),
                        hub("Sci-Fi", "library.genre", scifi),
                    ]}})
                };
                ok(body)
            },
            ["library", "sections", id, "all"] | ["library", "sections", id, "firstCharacter"] => {
                let mut all: Vec<Value> = match *id { "1" => movies, "2" => shows, "3" => (0..4).map(artist).collect(), _ => return Some(Err(404)) };
                let gname = |k: &str| k.parse::<usize>().ok().and_then(|k| GENRES.get(k.wrapping_sub(10))).copied();
                if let Some(g) = q(query, "genre") { let g = gname(&g); all.retain(|v| v["Genre"].as_array().map(|a| a.iter().any(|t| t["tag"].as_str() == g)).unwrap_or(false)); }
                if let Some(y) = q(query, "year") { all.retain(|v| v["year"].to_string() == y); }
                if let Some(st) = q(query, "studio") { all.retain(|v| v["studio"].as_str() == Some(st.as_str())); }
                let key = |v: &Value| v["title"].as_str().unwrap_or("").trim_start_matches("The ").to_string();
                match q(query, "sort").as_deref() {
                    Some("year:desc") => all.sort_by_key(|v| std::cmp::Reverse(v["year"].as_u64())),
                    Some("addedAt:desc") => all.sort_by_key(|v| std::cmp::Reverse(v["addedAt"].as_u64())),
                    Some("audienceRating:desc") => all.sort_by(|a, b| b["audienceRating"].as_f64().partial_cmp(&a["audienceRating"].as_f64()).unwrap()),
                    _ => all.sort_by_key(key),
                }
                if seg[3] == "firstCharacter" {
                    all.sort_by_key(key);
                    let mut d: Vec<(String, u32)> = vec![];
                    for v in &all { let c = key(v).chars().next().unwrap_or('#').to_ascii_uppercase(); let c = if c.is_ascii_uppercase() { c.to_string() } else { "#".into() };
                        match d.last_mut() { Some((k, n)) if *k == c => *n += 1, _ => d.push((c, 1)) } }
                    return ok(json!({"MediaContainer": {"Directory": d.into_iter().map(|(k, n)| json!({"key": k, "title": k, "size": n})).collect::<Vec<_>>()}}));
                }
                let start: usize = q(query, "X-Plex-Container-Start").and_then(|v| v.parse().ok()).unwrap_or(0);
                let size: usize = q(query, "X-Plex-Container-Size").and_then(|v| v.parse().ok()).unwrap_or(100);
                let total = all.len();
                let page: Vec<Value> = all.into_iter().skip(start).take(size).collect();
                ok(mc(page, json!({"totalSize": total, "offset": start})))
            }
            ["library", "sections", _, "collections"] => ok(mc(vec![json!({"ratingKey":"9001","type":"collection","title":"Meridian Saga","childCount":3,"thumb":"/library/collections/9001/composite/1700000000"})], json!({}))),
            ["library", "sections", _, f] => ok(json!({"MediaContainer": {"Directory": match *f {
                "genre" => GENRES.iter().enumerate().map(|(i, g)| json!({"key": (10 + i).to_string(), "title": g})).collect::<Vec<_>>(),
                "year" => (1994..2024).rev().map(|y| json!({"key": y.to_string(), "title": y.to_string()})).collect(),
                _ => vec![json!({"key":"1","title":"Northlight Pictures"}), json!({"key":"2","title":"Harbor & Pine"})] }}})),
            ["library", "collections", _, "children"] => ok(mc(vec![movie(0), movie(24), movie(23)], json!({}))),
            ["library", "metadata", id, "children"] => {
                let n: usize = id.parse().ok()?;
                if (2000..2600).contains(&n) && n % 100 == 0 { let si = (n - 2000) / 100; return ok(mc(vec![season(si, 1), season(si, 2)], json!({}))); }
                if (2000..2600).contains(&n) { let si = (n - 2000) / 100; let s = n % 100; return ok(mc((1..=6).map(|e| episode(si, s, e)).collect(), json!({}))); }
                Some(Err(404))
            }
            ["library", "metadata", id] => {
                let n: usize = id.parse().ok()?;
                let mut v = if (1000..1000 + N_MOVIES).contains(&n) { movie(n - 1000) }
                    else if (2000..2600).contains(&n) && n % 100 == 0 { show((n - 2000) / 100) }
                    else if (2000..2600).contains(&n) && n % 100 < 10 { season((n - 2000) / 100, n % 100) }
                    else if (2000..2600).contains(&n) { episode((n - 2000) / 100, (n % 100) / 10, n % 10) }
                    else { return Some(Err(404)) };
                if query.contains("includeChapters=1") && v["type"] != "show" && v["type"] != "season" {
                    v["Chapter"] = json!([{"tag":"Opening","startTimeOffset":0},{"tag":"The Signal","startTimeOffset":600000},{"tag":"Crossing","startTimeOffset":1800000},{"tag":"Landfall","startTimeOffset":3600000}]);
                }
                if query.contains("includeMarkers=1") && v["type"] == "episode" {
                    v["Marker"] = json!([{"type":"intro","startTimeOffset":30000,"endTimeOffset":95000},{"type":"credits","startTimeOffset":2580000,"endTimeOffset":2700000}]);
                }
                if v["type"] == "episode" { v["Media"] = json!([{"container":"mp4","videoCodec":"h264","videoResolution":"1080","audioCodec":"aac","audioChannels":2,"bitrate":6000,"Part":[{"size":1_400_000_000u64,"file":"/fixture/x.mp4","key":"/library/parts/77/file.mp4"}]}]); }
                // Realistic credits: movies and shows carry the main cast (some with server-hosted
                // photos, one with a plex.tv-CDN URL fetched token-less via the allowlist), directors, writers
                // and both ratings; seasons carry none (inherit); episodes carry crew + a guest.
                let cast = Value::Array(CAST.iter().enumerate().map(|(j, (n, r, t))| {
                    let mut c = json!({"tag": n, "role": r, "id": 501 + j, "tagKey": tag_key(j)});
                    if !t.is_empty() { c["thumb"] = json!(t); }
                    c }).collect());
                match v["type"].as_str() {
                    Some("movie") | Some("show") => {
                        v["Role"] = cast;
                        v["Director"] = json!([{"tag":"R. Calder"},{"tag":"S. Imani"}]);
                        v["Writer"] = json!([{"tag":"L. Okonkwo"},{"tag":"P. Marsh"}]);
                        v["rating"] = json!(8.1); v["audienceRating"] = json!(8.7);
                        v["studio"] = json!("Fixture Pictures"); v["contentRating"] = json!("TV-14");
                        v["Genre"] = json!([{"tag":"Science Fiction"},{"tag":"Drama"}]);
                        if v["type"] == "show" { v["year"] = json!(2019); }
                    }
                    Some("episode") => {
                        v["Director"] = json!([{"tag":"K. Brennan"}]);
                        v["Writer"] = json!([{"tag":"L. Okonkwo"}]);
                        v["Role"] = json!([{"tag":"Nadia Ferro","role":"Guest: Harbor Master"}]);
                        v["audienceRating"] = json!(7.9); v["year"] = json!(2021); v["originallyAvailableAt"] = json!("2021-03-14");
                    }
                    _ => {}
                }
                ok(mc(vec![v], json!({})))
            }
            // fu7e person endpoints: by numeric tag id (this server only) or by tagKey (global).
            ["library", "people", k] | ["library", "people", k, "media"] => {
                let j = CAST.iter().enumerate().position(|(j, _)| *k == (501 + j).to_string() || *k == tag_key(j))?;
                let (name, _, thumb) = CAST[j];
                if seg.len() == 4 {
                    let mut m: Vec<Value> = movies.into_iter().enumerate().filter(|(i, _)| (i + j) % 4 == 0).map(|(_, v)| v).take(40).collect();
                    if j % 2 == 0 { m.push(show(j % SHOWS.len())); }
                    return ok(mc(m, json!({})));
                }
                let mut d = json!({"tag": name, "id": 501 + j, "summary": format!("{name} is a fictional fixture performer. Every credit on this page is invented test data; no real person is described."),
                    "birthDate": format!("19{}-0{}-1{}", 60 + j * 4, 1 + j, j), "birthPlace": (["Port Ellis, Fixtureland","Kestrel Bay","Northlight","Harbor City","Pine Hollow","Static Point"][j])});
                if !thumb.is_empty() { d["thumb"] = json!(thumb); }
                ok(json!({"MediaContainer": {"size": 1, "Directory": [d]}}))
            }
            // fu7e related hubs: include the title itself and overlapping titles so the client
            // must drop self and dedupe across hubs and servers.
            ["library", "metadata", id, "related"] => {
                let n: usize = id.parse().ok()?;
                let pick: Vec<usize> = if (1000..1000 + N_MOVIES).contains(&n) { (0..N_MOVIES).collect() } else if (2000..2600).contains(&n) && n % 100 == 0 { vec![] } else { return Some(Err(404)) };
                let base = if pick.is_empty() { 0 } else { n - 1000 };
                let near: Vec<Value> = [0usize, 1, 2, 3, 4, 5, 6].iter().map(|d| movie((base + d * 3) % N_MOVIES)).collect();
                let more: Vec<Value> = [3usize, 6, 9, 10, 11, 12].iter().map(|d| movie((base + d) % N_MOVIES)).chain((0..3).map(show)).collect();
                ok(json!({"MediaContainer": {"Hub": [hub("More Like This", "movie.similar", near), hub("More from Fixture Pictures", "movie.studio", more)]}}))
            }
            ["hubs", "search"] => {
                let needle = q(query, "query").unwrap_or_default().to_lowercase();
                let m: Vec<Value> = movies.into_iter().filter(|v| v["title"].as_str().unwrap().to_lowercase().contains(&needle)).collect();
                let s: Vec<Value> = shows.into_iter().filter(|v| v["title"].as_str().unwrap().to_lowercase().contains(&needle)).collect();
                ok(json!({"MediaContainer": {"Hub": [hub("Movies", "movie", m), hub("Shows", "show", s)]}}))
            }
            ["video", ":", "transcode", "universal", "decision"] => {
                let path = q(query, "path").unwrap_or_default();
                if path.ends_with("/1008") { return Some(Err(502)); }
                if hls_force_bad(query) {
                    return Some(Err(400));
                }
                ok(json!({"MediaContainer":{"generalDecisionCode":1001,"transcodeDecisionCode":1000}}))
            }
            ["video", ":", "transcode", "universal", "start.m3u8"] => {
                let path = q(query, "path").unwrap_or_default();
                if path.ends_with("/1007") { return Some(Err(502)); }
                if !query.contains("videoQuality=100") || hls_force_bad(query) {
                    return Some(Err(400));
                }
                let sid = q(query, "session").unwrap_or_default();
                if sid.len() != 32 || !sid.bytes().all(|b| b.is_ascii_hexdigit()) { return Some(Err(400)); }
                let body = format!("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"English\",DEFAULT=YES,URI=\"/library/streams/4481\"\n#EXT-X-STREAM-INF:BANDWIDTH=5000000,CODECS=\"avc1.640028,mp4a.40.2\",RESOLUTION=1920x1080\n/video/:/transcode/universal/session/{sid}/0/index.m3u8?X-Plex-Token=srv1-FIXTURE-not-a-real-token\n");
                Some(Ok(("application/vnd.apple.mpegurl", body.into_bytes())))
            }
            ["video", ":", "transcode", "universal", "session", sid, variant, file] if *file == "index.m3u8" => {
                if sid.len() < 8 { return Some(Err(400)); }
                let body = format!("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MAP:URI=\"init.mp4?X-Plex-Token=srv1-FIXTURE-not-a-real-token\"\n#EXTINF:4.000,\n00000.ts?X-Plex-Token=srv1-FIXTURE-not-a-real-token\n#EXT-X-ENDLIST\n");
                let _ = variant;
                Some(Ok(("application/vnd.apple.mpegurl", body.into_bytes())))
            }
            ["video", ":", "transcode", "universal", "session", _, _, file] if file.ends_with(".ts") || *file == "init.mp4" => {
                let ct = if file.ends_with(".ts") { "video/mp2t" } else { "video/mp4" };
                Some(Ok((ct, b"\x47fixture-seg".to_vec())))
            }
            ["library", "parts", _, "file.mp4"] | ["library", "parts", _, "file.mkv"] => {
                Some(Ok(("video/mp4", b"\0\0\0\x18ftypmp42plexuw-fixture".to_vec())))
            }
            ["photo", ":", "transcode"] => {
                let src = q(query, "url").unwrap_or_default();
                let w: u32 = q(query, "width").and_then(|v| v.parse().ok()).unwrap_or(300);
                let h: u32 = q(query, "height").and_then(|v| v.parse().ok()).unwrap_or(450);
                let id: usize = src.split('/').nth(3).and_then(|x| x.parse().ok()).unwrap_or(0);
                let title = if (1000..2000).contains(&id) { MOVIES[(id - 1000) % MOVIES.len()] } else if (2000..2600).contains(&id) { SHOWS[(id - 2000) / 100 % SHOWS.len()] } else { "PlexUW" };
                let hue = (id * 47) % 360;
                let art = src.contains("/art/");
                let svg = format!(r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl({hue},45%,38%)"/><stop offset="1" stop-color="hsl({h2},55%,14%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="hsla({h2},70%,70%,.18)"/>{label}</svg>"##,
                    h2 = (hue + 60) % 360, cx = w * 7 / 10, cy = h * 3 / 10, r = w.min(h) / 3,
                    label = if art { String::new() } else { format!(r##"<text x="8%" y="88%" font-family="sans-serif" font-weight="700" font-size="{}" fill="#fff">{}</text>"##, w / 11, title.replace('&', "&amp;")) });
                Some(Ok(("image/svg+xml", svg.into_bytes())))
            }
            _ => None,
        }
    }
}
