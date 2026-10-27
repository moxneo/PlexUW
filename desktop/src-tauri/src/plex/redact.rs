//! Log/error redaction (PLAN §6 Redaction, §6a M4). Every string that leaves Rust
//! as an error, event or log line goes through `redact`.
use regex::Regex;
use std::sync::OnceLock;

fn rules() -> &'static [(Regex, &'static str)] {
    static R: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    R.get_or_init(|| {
        vec![
            (Regex::new(r"(?i)(x-plex-token\s*[:=]\s*)[^\s&,;\x22']+").unwrap(), "${1}<redacted>"),
            (Regex::new(r#"(?i)("(?:authToken|accessToken|token)"\s*:\s*")[^"]*""#).unwrap(), "${1}<redacted>\""),
            (Regex::new(r"(?i)\b[a-z0-9-]+\.[a-f0-9]{32}\.plex\.direct\b").unwrap(), "<plexdirect>"),
            (Regex::new(r"(?i)\b[a-z0-9.-]*\.plex\.direct\b").unwrap(), "<plexdirect>"),
            (Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b").unwrap(), "<ip>"),
            (Regex::new(r"(?i)\b(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}\b").unwrap(), "<ip>"),
            (Regex::new(r"(?i)(https?://)[^/\s\x22']+").unwrap(), "${1}<host>"),
        ]
    })
}

pub fn redact(s: &str) -> String {
    let mut out = s.to_string();
    for (re, rep) in rules() {
        out = re.replace_all(&out, *rep).into_owned();
    }
    out
}

/// Panics go through the redactor too (§6a M4).
pub fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let msg = redact(&info.to_string());
        eprintln!("PlexUW panic: {msg}");
    }));
}

#[cfg(test)]
mod t {
    use super::redact;
    #[test]
    fn header_and_query() {
        assert!(!redact("X-Plex-Token: abcDEF123456789xyz").contains("abcDEF"));
        assert!(!redact("GET /x?X-Plex-Token=abcDEF123456789xyz&a=1").contains("abcDEF"));
    }
    #[test]
    fn json_fields() {
        let r = redact(r#"{"authToken":"SECRETSECRET","accessToken":"S2S2S2"}"#);
        assert!(!r.contains("SECRET") && !r.contains("S2S2"));
    }
    #[test]
    fn hosts_and_ips() {
        let r = redact("https://192-168-1-5.0123456789abcdef0123456789abcdef.plex.direct:32400/identity 10.0.0.7");
        assert!(!r.contains("192-168") && !r.contains("10.0.0.7"), "{r}");
        assert!(!redact("error sending request for url (https://plex.example.com/identity)").contains("plex.example.com"));
    }
}
