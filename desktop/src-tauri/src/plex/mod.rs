//! Real-Plex milestone M1: egress control, secrets, PIN sign-in, resources,
//! server picker and connection race. No library browsing yet (M2).
pub mod redact;
pub mod secrets;
pub mod egress;
pub mod transport;
pub mod api;
pub mod source;
pub mod prefs;
pub mod browse;
pub mod play;
pub mod proxy;
pub mod merge;
#[cfg(any(test, feature = "mockplex"))]
pub mod fixture;
