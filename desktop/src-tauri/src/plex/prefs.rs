//! Non-secret settings (`settings.json`, versioned, atomic write; PLAN-SETTINGS §4).
//! Unknown keys are dropped on load/save. Secrets never live here.
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Prefs {
    pub v: u32,
    pub client_id: String,
    /// Preferred manual host, probed unauthenticated (§6a H2).
    pub manual_host: String,
    pub selected_server: Option<String>,
    pub use_demo: bool,
    /// Quality presets per connection type (like the Plex app). No PlexUW-side cap
    /// logic: server-side limits come from the Plex dashboard.
    pub local_quality: String,
    pub remote_quality: String,
    pub relay_quality: String,
    /// "skip-automatically" | "prompt" (Scott 2026-10-22)
    pub skip_intro: String,
    pub skip_recap: String,
    pub skip_credits: String,
    /// How long the manual Skip prompt stays visible, 10-20 s.
    pub skip_prompt_seconds: u32,
    pub close_quits: bool,
    /// Optional; off by default. UI/behaviour lands with its milestone.
    pub minimize_to_tray: bool,
    pub picture_in_picture: bool,
    pub plex_home: bool,
    pub music_playback: bool,
    pub language_source: String,
    pub show_mock_ai: bool,
    pub allow_insecure: String,
    /// Last Home JSON for a cold paint. Titles and opaque ids only. Never a token.
    pub home_snap: String,
}

impl Default for Prefs {
    fn default() -> Self {
        Prefs {
            v: 1,
            client_id: String::new(),
            manual_host: String::new(),
            selected_server: None,
            use_demo: false,
            local_quality: "original".into(),
            remote_quality: "original".into(),
            relay_quality: "2mbps-720p".into(),
            skip_intro: "prompt".into(),
            skip_recap: "prompt".into(),
            skip_credits: "prompt".into(),
            skip_prompt_seconds: 15,
            close_quits: true,
            minimize_to_tray: false,
            picture_in_picture: false,
            plex_home: false,
            music_playback: false,
            language_source: "plex-account".into(),
            show_mock_ai: true,
            allow_insecure: "never".into(),
            home_snap: String::new(),
        }
    }
}

/// Disk Home snapshot: bounded, and it must not carry a token, a host, or a password.
pub fn snap_ok(s: &str) -> bool {
    s.len() <= 400_000
        && !s.contains("X-Plex-Token")
        && !s.to_ascii_lowercase().contains("authtoken")
        && !s.to_ascii_lowercase().contains("accesstoken")
        && !s.to_ascii_lowercase().contains("plex.direct")
        && !s.to_ascii_lowercase().contains("password")
        && !s.contains("SecretString")
}

impl Prefs {
    pub fn load(p: &Path) -> Prefs {
        let mut pr: Prefs = fs::read_to_string(p).ok().and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
        if uuid::Uuid::parse_str(&pr.client_id).is_err() {
            pr.client_id = uuid::Uuid::new_v4().to_string();
            let _ = pr.save(p);
        }
        pr
    }
    pub fn save(&self, p: &Path) -> std::io::Result<()> {
        if let Some(d) = p.parent() { fs::create_dir_all(d)?; }
        let tmp = p.with_extension("json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(self).unwrap())?;
        fs::rename(tmp, p)
    }
    /// Apply a JS patch: only known keys with valid values; client id is not settable.
    pub fn apply(&mut self, patch: &serde_json::Value) {
        let keep_id = self.client_id.clone();
        let mut cur = serde_json::to_value(&*self).unwrap();
        if let (Some(c), Some(p)) = (cur.as_object_mut(), patch.as_object()) {
            for (k, v) in p {
                if c.contains_key(k) && k != "clientId" && k != "v" { c.insert(k.clone(), v.clone()); }
            }
        }
        if let Ok(mut n) = serde_json::from_value::<Prefs>(cur) {
            n.client_id = keep_id;
            if !snap_ok(&n.home_snap) { n.home_snap = self.home_snap.clone(); }
            n.skip_prompt_seconds = n.skip_prompt_seconds.clamp(10, 20);
            let ok = |s: &str, a: &[&str]| a.contains(&s);
            let skip = ["prompt", "skip-automatically"];
            let q = ["original", "20mbps-1080p", "12mbps-1080p", "8mbps-1080p", "4mbps-720p", "2mbps-720p", "1.5mbps-480p", "0.7mbps-328p"];
            if ok(&n.skip_intro, &skip) && ok(&n.skip_recap, &skip) && ok(&n.skip_credits, &skip)
                && ok(&n.allow_insecure, &["never"]) && ok(&n.language_source, &["plexuw-only", "plex-account"])
                && n.manual_host.len() <= 253 && ok(&n.remote_quality, &q) && ok(&n.local_quality, &q) && ok(&n.relay_quality, &q)
            {
                *self = n;
            }
        }
    }
}

#[cfg(test)]
mod t {
    use super::*;
    #[test]
    fn defaults_and_patch() {
        let mut p = Prefs::default();
        p.client_id = "11111111-1111-4111-8111-111111111111".into();
        assert_eq!(p.manual_host, "");
        assert_eq!((p.skip_intro.as_str(), p.skip_prompt_seconds), ("prompt", 15));
        assert_eq!(p.language_source, "plex-account");
        assert!(p.close_quits && !p.minimize_to_tray && !p.picture_in_picture && p.show_mock_ai);
        p.apply(&serde_json::json!({"skipIntro":"skip-automatically","clientId":"x","bogus":1}));
        assert_eq!(p.skip_intro, "skip-automatically");
        p.apply(&serde_json::json!({"skipPromptSeconds":25}));
        assert_eq!(p.skip_prompt_seconds, 20);
        p.apply(&serde_json::json!({"skipPromptSeconds":3}));
        assert_eq!(p.skip_prompt_seconds, 10);
        p.apply(&serde_json::json!({"relayQuality":"4mbps-720p","localQuality":"bogus"}));
        assert_eq!((p.relay_quality.as_str(), p.local_quality.as_str()), ("2mbps-720p", "original"));
        p.apply(&serde_json::json!({"relayQuality":"4mbps-720p"}));
        assert_eq!(p.relay_quality, "4mbps-720p");
        assert_eq!(p.client_id, "11111111-1111-4111-8111-111111111111");
        p.apply(&serde_json::json!({"skipIntro":"Ask"}));
        assert_eq!(p.skip_intro, "skip-automatically");
        p.apply(&serde_json::json!({"allowInsecure":"local-only"}));
        assert_eq!(p.allow_insecure, "never");
        p.apply(&serde_json::json!({"homeSnap":"{\"server\":\"Mox\",\"home\":{}}"}));
        assert!(p.home_snap.contains("Mox"));
        p.apply(&serde_json::json!({"homeSnap":"{\"X-Plex-Token\":\"sekrit\"}","skipIntro":"prompt"}));
        assert!(!p.home_snap.contains("sekrit"));
        assert_eq!(p.skip_intro, "prompt");
        assert!(!snap_ok("https://10-0-0-2.abc.plex.direct:32400"));
        assert!(snap_ok(""));
    }
}
