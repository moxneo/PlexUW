//! DataSource (§5): the UI talks only to this. `MockSource` = the bundled demo
//! library (zero network calls); `PlexSource` = a signed-in, connected server.
//! M1 carries identity/status only; browsing methods arrive in M2.
use super::api::ConnKind;
use serde::Serialize;

#[derive(Serialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SourceView {
    /// `reason`: "first-run" | "chosen" | "offline"
    Demo { reason: &'static str },
    Plex { server: String, connection: ConnKind, owned: bool },
}

pub trait DataSource: Send + Sync {
    fn view(&self) -> SourceView;
    fn makes_network_calls(&self) -> bool;
    /// (machineId, selected connection) when connected to a real server.
    fn plex(&self) -> Option<(String, super::api::Conn)> { None }
}

pub struct MockSource { pub reason: &'static str }
impl DataSource for MockSource {
    fn view(&self) -> SourceView { SourceView::Demo { reason: self.reason } }
    fn makes_network_calls(&self) -> bool { false }
}

pub struct PlexSource { pub machine_id: String, pub name: String, pub owned: bool, pub conn: super::api::Conn }
impl DataSource for PlexSource {
    fn view(&self) -> SourceView {
        SourceView::Plex { server: self.name.chars().take(120).collect(), connection: self.conn.kind, owned: self.owned }
    }
    fn makes_network_calls(&self) -> bool { true }
    fn plex(&self) -> Option<(String, super::api::Conn)> { Some((self.machine_id.clone(), self.conn.clone())) }
}
