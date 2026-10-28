//! HTTP transport. The real one is reqwest with redirects OFF (§6a H2), https only,
//! verified TLS (rustls + webpki roots), no cookies. Tests use a fixture transport.
use secrecy::{ExposeSecret, SecretString};
use std::{future::Future, pin::Pin, time::Duration};
use url::Url;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Method { Get, Post, Put }

pub struct Req {
    pub method: Method,
    pub url: Url,
    pub headers: Vec<(&'static str, String)>,
    pub token: Option<SecretString>,
    pub timeout: Duration,
    /// Body cap, enforced while streaming (Sentinel LOW-5): the read stops and the
    /// request fails as soon as more than this many bytes have arrived.
    pub max_body: usize,
}

pub const TOO_LARGE: &str = "response too large";

/// Append one chunk, failing the moment the running total would pass `max`.
pub fn push_capped(buf: &mut Vec<u8>, chunk: &[u8], max: usize) -> Result<(), String> {
    if buf.len().saturating_add(chunk.len()) > max { return Err(TOO_LARGE.into()); }
    buf.extend_from_slice(chunk);
    Ok(())
}

pub struct Resp {
    pub status: u16,
    pub body: Vec<u8>,
    /// Only Content-Type is kept from upstream, plus Content-Range for a media 206 (§6a H1).
    pub content_type: Option<String>,
    pub content_range: Option<String>,
    /// Location on a 3xx only. Callers must re-validate before any fetch. Never log it.
    pub location: Option<String>,
}

pub type Fut<'a> = Pin<Box<dyn Future<Output = Result<Resp, String>> + Send + 'a>>;

pub trait Transport: Send + Sync {
    fn send(&self, r: Req) -> Fut<'_>;
}

pub struct Reqwest(reqwest::Client);

/// Fixed error categories for the transport (Sentinel: never surface raw error text).
pub const E_TIMEOUT: &str = "timeout";
pub const E_TLS: &str = "tls";
pub const E_NET: &str = "net";

/// Reduce a reqwest error to a fixed category. Only the error *kind* survives;
/// the message (which can carry hosts, IPs or URLs) is dropped here.
fn classify(e: reqwest::Error) -> String {
    if e.is_timeout() { return E_TIMEOUT.into(); }
    let mut src: Option<&dyn std::error::Error> = Some(&e);
    while let Some(x) = src {
        let t = x.to_string().to_ascii_lowercase();
        if t.contains("certificate") || t.contains("tls") || t.contains("handshake") || t.contains("invalidcert") { return E_TLS.into(); }
        if t.contains("timed out") { return E_TIMEOUT.into(); }
        src = x.source();
    }
    E_NET.into()
}

impl Reqwest {
    pub fn new() -> Self {
        let c = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .use_rustls_tls()
            .connect_timeout(Duration::from_secs(5))
            .build()
            .expect("http client");
        Reqwest(c)
    }
}

impl Transport for Reqwest {
    fn send(&self, r: Req) -> Fut<'_> {
        Box::pin(async move {
            let mut b = match r.method {
                Method::Get => self.0.get(r.url),
                Method::Post => self.0.post(r.url),
                Method::Put => self.0.put(r.url),
            }
            .timeout(r.timeout);
            for (k, v) in r.headers { b = b.header(k, v); }
            if let Some(t) = &r.token { b = b.header("X-Plex-Token", t.expose_secret()); }
            // Errors carry the URL; callers pass them through `redact`.
            let resp = b.send().await.map_err(classify)?;
            let status = resp.status().as_u16();
            let location = if (300..400).contains(&status) {
                resp.headers().get(reqwest::header::LOCATION).and_then(|v| v.to_str().ok()).map(|s| s.chars().take(400).collect())
            } else { None };
            let content_type = resp.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).map(|s| s.chars().take(100).collect());
            let content_range = resp.headers().get(reqwest::header::CONTENT_RANGE).and_then(|v| v.to_str().ok()).and_then(|s| {
                let s: String = s.chars().take(80).filter(|c| c.is_ascii() && !c.is_control()).collect();
                s.starts_with("bytes ").then_some(s)
            });
            if resp.content_length().map(|n| n > r.max_body as u64).unwrap_or(false) { return Err(TOO_LARGE.into()); }
            let mut resp = resp;
            let mut body = Vec::new();
            while let Some(c) = resp.chunk().await.map_err(classify)? {
                push_capped(&mut body, &c, r.max_body)?;
            }
            Ok(Resp { status, body, content_type, content_range, location })
        })
    }
}

#[cfg(test)]
mod t {
    use super::*;
    #[test]
    fn cap_enforced_per_chunk() {
        let mut b = Vec::new();
        assert!(push_capped(&mut b, &[0; 10], 16).is_ok());
        assert!(push_capped(&mut b, &[0; 6], 16).is_ok());
        assert_eq!(push_capped(&mut b, &[0; 1], 16), Err(TOO_LARGE.to_string()));
        assert_eq!(b.len(), 16, "nothing past the cap is buffered");
    }
}
