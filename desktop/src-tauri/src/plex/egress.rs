//! The single egress function (§6a H2). Every outbound request goes through
//! `Egress::send`, which enforces:
//! - https only, no userinfo, no redirects (3xx is an error, never followed);
//! - the account token goes only to plex.tv / clients.plex.tv;
//! - a server token for machine M goes only to hosts bound to M (exact host:port
//!   from M's resources connections, or a manual host that proved it is M);
//! - unauthenticated requests: PIN endpoints on plex.tv, and `/identity` on bound
//!   hosts or on the one manual host currently being probed;
//! - a per-credential path allowlist (grows in M2).
use super::secrets::{account_key, server_key, SecretStore};
use super::transport::{Method, Req, Resp, Transport};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use url::Url;

pub const ACCOUNT_HOSTS: &[&str] = &["plex.tv", "clients.plex.tv"];

#[derive(Clone, Debug, PartialEq)]
/// `PublicImage`: token-less fetch of a cast photo from the plex.tv CDN (Sentinel, round 5).
pub enum Cred { None, Account, Server(String), PublicImage }

/// The only external image host. Exact match, https, port 443.
pub const PUBLIC_IMAGE_HOST: &str = "metadata-static.plex.tv";

/// Cast-photo URL allowlist: exact host, https:443, no userinfo/query/fragment,
/// path of safe segments ending .jpg/.png/.webp, no dot-segments.
pub fn public_image_ok(u: &Url) -> bool {
    use std::sync::OnceLock;
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex::Regex::new(r"^(/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,99}){1,8}\.(jpg|png|webp)$").unwrap());
    u.scheme() == "https" && u.username().is_empty() && u.password().is_none()
        && u.host_str() == Some(PUBLIC_IMAGE_HOST) && u.port().is_none() && u.port_or_known_default() == Some(443)
        && u.query().is_none() && u.fragment().is_none()
        && u.path().len() <= 300 && re.is_match(u.path()) && !u.path().split('/').any(|s| s == ".." || s == ".")
}

/// Parse a raw metadata string as a cast-photo URL; refuses anything the URL parser
/// would normalise (so what we validate is byte-for-byte what we fetch).
pub fn parse_public_image(raw: &str) -> Option<Url> {
    if raw.len() > 400 || raw.contains(['\\', '%', '@', '?', '#']) { return None; }
    let u = Url::parse(raw).ok()?;
    (u.as_str() == raw && public_image_ok(&u)).then_some(u)
}

#[derive(Default, Debug)]
pub struct Bindings {
    /// machineId -> allowed "host:port"
    pub servers: HashMap<String, HashSet<String>>,
    /// manual host currently being probed unauthenticated ("host:port")
    pub manual_pending: Option<String>,
}

#[derive(Debug, PartialEq)]
pub enum Deny { Scheme, UserInfo, Host, Path }

pub fn host_port(u: &Url) -> Option<String> {
    Some(format!("{}:{}", u.host_str()?.to_ascii_lowercase(), u.port_or_known_default()?))
}

fn is_account_host(u: &Url) -> bool {
    u.port_or_known_default() == Some(443)
        && u.host_str().map(|h| ACCOUNT_HOSTS.contains(&h.to_ascii_lowercase().as_str())).unwrap_or(false)
}

fn pin_path(p: &str) -> bool {
    p == "/api/v2/pins" || p.strip_prefix("/api/v2/pins/").map(|id| !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit())).unwrap_or(false)
}

fn account_path(p: &str) -> bool { p == "/api/v2/resources" || p == "/api/v2/user" || pin_path(p) }

/// Mark watched / unwatched. Exactly two pairs: a metadata key and the library identifier.
/// No token, no free-form path, no extra keys.
pub fn scrobble_query_ok(q: Option<&str>) -> bool {
    let pairs: Vec<(String, String)> = url::form_urlencoded::parse(q.unwrap_or("").as_bytes()).into_owned().collect();
    if pairs.len() != 2 { return false; }
    let key = pairs.iter().find(|(k, _)| k == "key").map(|(_, v)| v.as_str());
    let idn = pairs.iter().find(|(k, _)| k == "identifier").map(|(_, v)| v.as_str());
    let key_ok = key.and_then(|k| k.strip_prefix("/library/metadata/")).map(|n| !n.is_empty() && n.len() <= 12 && n.bytes().all(|b| b.is_ascii_digit())).unwrap_or(false);
    idn == Some("com.plexapp.plugins.library") && key_ok
}

/// Server-token path allowlist (M2 browsing, §3 / §6a M3). Exact shapes only:
/// numeric ids, no free-form segments. `/photo/:/transcode` additionally requires a
/// server-relative `url=/library/metadata/<id>/(thumb|art)[/<n>]` (§6a M5).
pub fn server_path(p: &str, q: Option<&str>) -> bool {
    use std::sync::OnceLock;
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    let re = RE.get_or_init(|| regex::Regex::new(concat!(
        r"^/(identity|library/sections|hubs/continueWatching|hubs/home/onDeck|hubs/promoted|hubs/search",
        r"|hubs/sections/[0-9]{1,9}",
        r"|library/sections/[0-9]{1,9}/(all|genre|studio|year|collections|firstCharacter)",
        r"|library/collections/[0-9]{1,12}/children|library/all",
        r"|library/metadata/[0-9]{1,12}(/children|/related)?",
        r"|library/people/([0-9]{1,12}|[0-9a-f]{16,32})(/media)?",
        r"|photo/:/transcode)$")).unwrap());
    if crate::plex::play::playback_path_ok(p, q) { return true; }
    if p == "/:/scrobble" || p == "/:/unscrobble" { return scrobble_query_ok(q); }
    if !re.is_match(p) { return false; }
    if p == "/photo/:/transcode" {
        let url = q.and_then(|q| url::form_urlencoded::parse(q.as_bytes()).find(|(k, _)| k == "url").map(|(_, v)| v.into_owned()));
        return url.map(|u| image_path_ok(&u)).unwrap_or(false);
    }
    // LOW-15: /library/all is only the version fan-out: exactly one plex:// guid filter plus
    // the container start/size pair; any other filter or key is refused.
    if p == "/library/all" {
        let pairs: Vec<(String, String)> = url::form_urlencoded::parse(q.unwrap_or("").as_bytes()).into_owned().collect();
        let n = |k: &str| pairs.iter().filter(|(x, _)| x == k).count();
        let num = |k: &str| pairs.iter().filter(|(x, _)| x == k).all(|(_, v)| !v.is_empty() && v.len() <= 4 && v.bytes().all(|b| b.is_ascii_digit()));
        let type_ok = pairs.iter().filter(|(k, _)| k == "type").all(|(_, v)| matches!(v.as_str(), "1" | "2" | "3" | "4"));
        return n("guid") == 1
            && pairs.iter().all(|(k, _)| ["guid", "type", "X-Plex-Container-Start", "X-Plex-Container-Size"].contains(&k.as_str()))
            && n("type") <= 1 && type_ok
            && n("X-Plex-Container-Start") <= 1 && n("X-Plex-Container-Size") <= 1 && num("X-Plex-Container-Start") && num("X-Plex-Container-Size")
            && pairs.iter().any(|(k, v)| k == "guid" && crate::plex::merge::queryable_guid(v).is_some());
    }
    true
}

/// §6a M5: an image source is a server-relative metadata thumb/art path, never absolute.
pub fn image_path_ok(u: &str) -> bool {
    use std::sync::OnceLock;
    static RE: OnceLock<regex::Regex> = OnceLock::new();
    RE.get_or_init(|| regex::Regex::new(r"^/library/(metadata|collections)/[0-9]{1,12}/(thumb|art|composite)(/[0-9]{1,12})?$").unwrap()).is_match(u)
}

pub fn check(u: &Url, cred: &Cred, b: &Bindings) -> Result<(), Deny> {
    if u.scheme() != "https" { return Err(Deny::Scheme); }
    if !u.username().is_empty() || u.password().is_some() { return Err(Deny::UserInfo); }
    let hp = host_port(u).ok_or(Deny::Host)?;
    let p = u.path();
    match cred {
        Cred::Account => {
            if !is_account_host(u) { return Err(Deny::Host); }
            if !account_path(p) { return Err(Deny::Path); }
            // /api/v2/user is the paired account card only: no query, no fragment, no home-user.
            if p == "/api/v2/user" && (u.query().is_some() || u.fragment().is_some()) { return Err(Deny::Path); }
        }
        Cred::Server(m) => {
            if !b.servers.get(m).map(|s| s.contains(&hp)).unwrap_or(false) { return Err(Deny::Host); }
            if !server_path(p, u.query()) { return Err(Deny::Path); }
        }
        Cred::PublicImage => {
            if u.host_str() != Some(PUBLIC_IMAGE_HOST) { return Err(Deny::Host); }
            if !public_image_ok(u) { return Err(Deny::Path); }
        }
        Cred::None => {
            if is_account_host(u) {
                if !pin_path(p) { return Err(Deny::Path); }
            } else {
                let bound = b.servers.values().any(|s| s.contains(&hp));
                let pending = b.manual_pending.as_deref() == Some(hp.as_str());
                if !(bound || pending) { return Err(Deny::Host); }
                if p != "/identity" || u.query().is_some() { return Err(Deny::Path); }
            }
        }
    }
    Ok(())
}

#[derive(Debug)]
pub enum EgressError { Denied(Deny), Redirect, NoToken, Store(super::secrets::StoreError), Net(String), Status(u16) }

impl std::fmt::Display for EgressError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EgressError::Denied(d) => write!(f, "request blocked by egress policy ({d:?})"),
            EgressError::Redirect => write!(f, "server tried to redirect; redirects are not followed"),
            EgressError::NoToken => write!(f, "not signed in"),
            EgressError::Store(e) => write!(f, "keychain: {e:?}"),
            EgressError::Net(e) => write!(f, "network: {}", super::redact::redact(e)),
            EgressError::Status(s) => write!(f, "HTTP {s}"),
        }
    }
}

pub struct Egress {
    t: Arc<dyn Transport>,
    pub store: Arc<dyn SecretStore>,
    pub bindings: Mutex<Bindings>,
    pub client_id: String,
}

impl Egress {
    pub fn new(t: Arc<dyn Transport>, store: Arc<dyn SecretStore>, client_id: String) -> Self {
        Egress { t, store, bindings: Mutex::new(Bindings::default()), client_id }
    }

    pub fn plex_headers(&self) -> Vec<(&'static str, String)> {
        let platform = if cfg!(windows) { "Windows" } else if cfg!(target_os = "macos") { "macOS" } else { "Linux" };
        vec![
            ("Accept", "application/json".into()),
            ("X-Plex-Product", "PlexUW".into()),
            ("X-Plex-Version", env!("CARGO_PKG_VERSION").into()),
            ("X-Plex-Client-Identifier", self.client_id.clone()),
            ("X-Plex-Platform", platform.into()),
            // Generic name on purpose: no hostname/user leaks to plex.tv.
            ("X-Plex-Device-Name", "PlexUW desktop".into()),
        ]
    }

    /// Default body cap for API (JSON) responses.
    pub const MAX_API_BODY: usize = 32 * 1024 * 1024;
    pub async fn send(&self, method: Method, url: Url, cred: Cred, timeout: Duration) -> Result<Resp, EgressError> {
        self.send_capped(method, url, cred, timeout, Self::MAX_API_BODY).await
    }
    pub async fn send_capped(&self, method: Method, url: Url, cred: Cred, timeout: Duration, max_body: usize) -> Result<Resp, EgressError> {
        check(&url, &cred, &self.bindings.lock().unwrap()).map_err(EgressError::Denied)?;
        let token = match &cred {
            Cred::None | Cred::PublicImage => None,
            Cred::Account => Some(self.store.get(&account_key(&self.client_id)).map_err(EgressError::Store)?.ok_or(EgressError::NoToken)?),
            Cred::Server(m) => Some(self.store.get(&server_key(&self.client_id, m)).map_err(EgressError::Store)?.ok_or(EgressError::NoToken)?),
        };
        let r = self.t.send(Req { method, url, headers: self.plex_headers(), token, timeout, max_body }).await.map_err(EgressError::Net)?;
        // Transports must honour the cap; re-check so a buggy one cannot hand back more.
        if r.body.len() > max_body { return Err(EgressError::Net(crate::plex::transport::TOO_LARGE.into())); }
        if (300..400).contains(&r.status) { return Err(EgressError::Redirect); }
        Ok(r)
    }

    /// Playback fetch: same credential rules, but `Accept` is replaced and an optional
    /// Range is forwarded. Used for decision JSON, HLS playlists/segments and part bytes.
    pub async fn send_playback(&self, url: Url, cred: Cred, timeout: Duration, max_body: usize, accept: &str, range: Option<&str>) -> Result<Resp, EgressError> {
        check(&url, &cred, &self.bindings.lock().unwrap()).map_err(EgressError::Denied)?;
        let token = match &cred {
            Cred::None | Cred::PublicImage => None,
            Cred::Account => Some(self.store.get(&account_key(&self.client_id)).map_err(EgressError::Store)?.ok_or(EgressError::NoToken)?),
            Cred::Server(m) => Some(self.store.get(&server_key(&self.client_id, m)).map_err(EgressError::Store)?.ok_or(EgressError::NoToken)?),
        };
        let mut headers = self.plex_headers();
        if let Some(h) = headers.iter_mut().find(|(k, _)| *k == "Accept") { h.1 = accept.to_string(); }
        if let Some(r) = range { headers.push(("Range", r.to_string())); }
        // PMS matches the client profile from these headers. A query-only
        // name is ignored and the decision comes back 400.
        for (k, v) in crate::plex::play::playback_profile_headers() {
            if !headers.iter().any(|(hk, _)| *hk == k) {
                headers.push((k, v.to_string()));
            }
        }
        let r = self.t.send(super::transport::Req { method: super::transport::Method::Get, url, headers, token, timeout, max_body }).await.map_err(EgressError::Net)?;
        if r.body.len() > max_body { return Err(EgressError::Net(crate::plex::transport::TOO_LARGE.into())); }
        if (300..400).contains(&r.status) { return Err(EgressError::Redirect); }
        Ok(r)
    }
}

#[cfg(test)]
mod t {
    use super::*;
    #[test]
    fn low15_library_all_only_guid_and_paging() {
        let g = "guid=plex%3A%2F%2Fmovie%2F5d77000000000000000000000003";
        assert!(server_path("/library/all", Some(g)));
        assert!(server_path("/library/all", Some(&format!("{g}&X-Plex-Container-Start=0&X-Plex-Container-Size=4"))));
        assert!(server_path("/library/all", Some(&format!("{g}&type=1&X-Plex-Container-Start=0&X-Plex-Container-Size=4"))));
        assert!(server_path("/library/all", Some(&format!("{g}&type=4"))));
        for bad in [None, Some(""), Some("type=1"), Some(&format!("{g}&type=5") as &str), Some(&format!("{g}&type=1&type=2") as &str), Some(&format!("{g}&type=movie") as &str), Some(&format!("{g}&{g}") as &str), Some(&format!("{g}&sort=titleSort") as &str),
            Some(&format!("{g}&X-Plex-Container-Size=99999") as &str), Some(&format!("{g}&X-Plex-Container-Size=4&X-Plex-Container-Size=4") as &str),
            Some(&format!("{g}&X-Plex-Container-Start=-1") as &str), Some("guid=imdb%3A%2F%2Ftt1"), Some(&format!("{g}&title=a") as &str)] {
            assert!(!server_path("/library/all", bad), "{bad:?}");
        }
    }
    fn u(s: &str) -> Url { Url::parse(s).unwrap() }
    fn b() -> Bindings {
        let mut b = Bindings::default();
        b.servers.insert("M".into(), ["10-0-0-2.aaaa.plex.direct:32400".to_string()].into_iter().collect());
        b.servers.insert("N".into(), ["other.example:443".to_string()].into_iter().collect());
        b
    }
    #[test]
    fn account_token_only_to_plex_tv() {
        assert_eq!(check(&u("https://clients.plex.tv/api/v2/resources"), &Cred::Account, &b()), Ok(()));
        assert_eq!(check(&u("https://evil.plex.tv.example/api/v2/resources"), &Cred::Account, &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://plex.tv:8443/api/v2/resources"), &Cred::Account, &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://10-0-0-2.aaaa.plex.direct:32400/identity"), &Cred::Account, &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://plex.tv/api/v2/user"), &Cred::Account, &b()), Ok(()));
        assert_eq!(check(&u("https://plex.tv/api/v2/user?includeSubscriptions=1"), &Cred::Account, &b()), Err(Deny::Path));
        assert_eq!(check(&u("https://plex.tv/api/v2/user#frag"), &Cred::Account, &b()), Err(Deny::Path));
        assert_eq!(check(&u("https://plex.tv/api/v2/home/users"), &Cred::Account, &b()), Err(Deny::Path));
        assert_eq!(check(&u("https://plex.tv/api/v2/user/sharing"), &Cred::Account, &b()), Err(Deny::Path));
        assert!(server_path("/:/scrobble", Some("identifier=com.plexapp.plugins.library&key=%2Flibrary%2Fmetadata%2F1003")));
        assert!(server_path("/:/unscrobble", Some("identifier=com.plexapp.plugins.library&key=%2Flibrary%2Fmetadata%2F1003")));
        assert!(!server_path("/:/scrobble", Some("identifier=com.plexapp.plugins.library&key=%2Flibrary%2Fmetadata%2F1003&X-Plex-Token=sekrit")));
        assert!(!server_path("/:/scrobble", Some("identifier=com.plexapp.plugins.library&key=https%3A%2F%2Fevil.example")));
        assert!(!server_path("/:/scrobble", None));
    }
    #[test]
    fn server_token_bound_to_its_own_hosts() {
        assert_eq!(check(&u("https://10-0-0-2.aaaa.plex.direct:32400/identity"), &Cred::Server("M".into()), &b()), Ok(()));
        // another server's host, a different port, an unlisted plex.direct name
        assert_eq!(check(&u("https://other.example/identity"), &Cred::Server("M".into()), &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://10-0-0-2.aaaa.plex.direct:32401/identity"), &Cred::Server("M".into()), &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://anything.bbbb.plex.direct:32400/identity"), &Cred::Server("M".into()), &b()), Err(Deny::Host));
        assert_eq!(check(&u("https://10-0-0-2.aaaa.plex.direct:32400/library/sections"), &Cred::Server("M".into()), &b()), Ok(()));
        assert_eq!(check(&u("https://10-0-0-2.aaaa.plex.direct:32400/accounts"), &Cred::Server("M".into()), &b()), Err(Deny::Path));
    }
    #[test]
    fn scheme_userinfo() {
        assert_eq!(check(&u("http://plex.tv/api/v2/pins"), &Cred::None, &b()), Err(Deny::Scheme));
        assert_eq!(check(&u("https://x:y@plex.tv/api/v2/pins"), &Cred::None, &b()), Err(Deny::UserInfo));
    }
    #[test]
    fn unauthenticated_manual_probe_only_identity() {
        let mut bb = b();
        assert_eq!(check(&u("https://plex.example.com/identity"), &Cred::None, &bb), Err(Deny::Host));
        bb.manual_pending = Some("plex.example.com:443".into());
        assert_eq!(check(&u("https://plex.example.com/identity"), &Cred::None, &bb), Ok(()));
        assert_eq!(check(&u("https://plex.example.com/library/sections"), &Cred::None, &bb), Err(Deny::Path));
        assert_eq!(check(&u("https://plex.example.com/identity"), &Cred::Server("M".into()), &bb), Err(Deny::Host));
    }
    #[test]
    fn pin_paths() {
        assert_eq!(check(&u("https://plex.tv/api/v2/pins/123"), &Cred::None, &b()), Ok(()));
        assert_eq!(check(&u("https://plex.tv/api/v2/pins/../user"), &Cred::None, &b()), Err(Deny::Path));
        assert_eq!(check(&u("https://plex.tv/api/v2/resources"), &Cred::None, &b()), Err(Deny::Path));
    }
    #[test]
    fn m2_server_path_allowlist() {
        let ok = ["/library/sections","/library/sections/3/all","/library/sections/3/genre","/hubs/sections/3","/hubs/continueWatching",
            "/hubs/home/onDeck","/hubs/promoted","/hubs/search","/library/metadata/77","/library/metadata/77/children","/library/collections/9/children"];
        for p in ok { assert!(server_path(p, None), "{p}"); }
        let bad = ["/library/sections/x/all","/library/metadata/1/../../accounts","/library/parts/1/../../accounts","/library/parts/nope/file.mp4","/:/prefs","/library/sections/3/refresh",
            "/library/metadata/77/thumb","/system","/hubs/search/../x","/library/sections/","//library/sections"];
        for p in bad { assert!(!server_path(p, None), "{p}"); }
        assert!(server_path("/library/parts/77/file.mp4", None));
        assert!(server_path("/video/:/transcode/universal/session/abcdef0123456789/0/00000.ts", None));
        assert!(server_path("/photo/:/transcode", Some("width=300&height=450&url=%2Flibrary%2Fmetadata%2F77%2Fthumb%2F1700000000")));
        assert!(!server_path("/photo/:/transcode", Some("width=300&url=https%3A%2F%2Fevil.example%2Fx.jpg")));
        assert!(!server_path("/photo/:/transcode", Some("width=300&url=%2F%2Fevil.example%2Fx")));
        assert!(!server_path("/photo/:/transcode", Some("width=300&url=%2Flibrary%2Fmetadata%2F77%2Fthumb%2F..%2F..%2Fx")));
        assert!(!server_path("/photo/:/transcode", Some("width=300")));
    }
}
