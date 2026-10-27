//! PlexUW desktop shell: frameless window, borderless fullscreen, monitor-aware
//! window-state persistence, media keys, and (M1) Plex sign-in / server picker.
//! The demo library still needs no network; Plex traffic goes only through
//! `plex::egress` and tokens never reach the webview.
pub mod plex;
mod commands;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent};

#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct WinState {
    monitor: Option<String>,
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    maximized: bool,
    fullscreen: bool,
}

struct Saved(Mutex<WinState>);

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("window-state.json"))
}

fn load(app: &AppHandle) -> Option<WinState> {
    let s = fs::read_to_string(state_path(app)?).ok()?;
    serde_json::from_str(&s).ok()
}

fn persist(app: &AppHandle, st: &WinState) {
    if let Some(p) = state_path(app) {
        let _ = fs::create_dir_all(p.parent().unwrap());
        let _ = fs::write(p, serde_json::to_string_pretty(st).unwrap_or_default());
    }
}

/// Capture current geometry. Size/position are only taken from the "normal" (not
/// maximized / fullscreen) window so restoring un-maximizes to the right place.
fn capture(win: &WebviewWindow, prev: &WinState) -> WinState {
    let maximized = win.is_maximized().unwrap_or(false);
    let fullscreen = win.is_fullscreen().unwrap_or(false);
    let mut st = prev.clone();
    st.maximized = maximized;
    st.fullscreen = fullscreen;
    if let Ok(Some(m)) = win.current_monitor() {
        st.monitor = m.name().cloned();
    }
    if !maximized && !fullscreen && !win.is_minimized().unwrap_or(false) {
        if let (Ok(p), Ok(s)) = (win.outer_position(), win.outer_size()) {
            st.x = p.x; st.y = p.y; st.w = s.width; st.h = s.height;
        }
    }
    st
}

/// Restore on the saved monitor if it is still connected and the saved rect
/// intersects it; otherwise centre on the primary monitor.
fn restore(win: &WebviewWindow, st: &WinState) {
    let monitors = win.available_monitors().unwrap_or_default();
    let target = st.monitor.as_ref().and_then(|n| monitors.iter().find(|m| m.name() == Some(n)));
    let fits = |m: &tauri::Monitor| {
        let (p, s) = (m.position(), m.size());
        st.w > 0 && st.x < p.x + s.width as i32 && st.x + st.w as i32 > p.x
            && st.y < p.y + s.height as i32 && st.y + st.h as i32 > p.y
    };
    match target {
        Some(m) if fits(m) => {
            let s = m.size();
            let w = st.w.min(s.width).max(960);
            let h = st.h.min(s.height).max(600);
            let _ = win.set_size(PhysicalSize::new(w, h));
            let _ = win.set_position(PhysicalPosition::new(st.x, st.y));
        }
        _ => {
            // monitor gone (or first run): primary monitor, centred
            if let Ok(Some(pm)) = win.primary_monitor() {
                let (p, s) = (pm.position(), pm.size());
                let w = if st.w > 0 { st.w.min(s.width) } else { (s.width as f64 * 0.8) as u32 };
                let h = if st.h > 0 { st.h.min(s.height) } else { (s.height as f64 * 0.8) as u32 };
                let _ = win.set_size(PhysicalSize::new(w, h));
                let _ = win.set_position(PhysicalPosition::new(
                    p.x + (s.width as i32 - w as i32) / 2,
                    p.y + (s.height as i32 - h as i32) / 2,
                ));
            }
        }
    }
    if st.maximized { let _ = win.maximize(); }
    if st.fullscreen { let _ = win.set_fullscreen(true); }
}

/// Sentinel INFO-2: window-control failures return one fixed category; the
/// platform error text is never passed to the UI.
pub const WIN_ERR: &str = "window-unavailable";
fn win_err<E>(_: E) -> String { WIN_ERR.to_string() }

fn main_win(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main").ok_or_else(|| WIN_ERR.to_string())
}

#[tauri::command]
fn win_minimize(app: AppHandle) -> Result<(), String> { main_win(&app)?.minimize().map_err(win_err) }

#[tauri::command]
fn win_toggle_maximize(app: AppHandle) -> Result<bool, String> {
    let w = main_win(&app)?;
    let m = w.is_maximized().map_err(win_err)?;
    if m { w.unmaximize() } else { w.maximize() }.map_err(win_err)?;
    Ok(!m)
}

#[tauri::command]
fn win_close(app: AppHandle) -> Result<(), String> { main_win(&app)?.close().map_err(win_err) }

/// Borderless fullscreen: on Windows tao's set_fullscreen(true) uses a
/// borderless popup sized to the *current* monitor's full rect, so it fills
/// 32:9 / 21:9 ultrawides with no taskbar or frame.
#[tauri::command]
fn win_toggle_fullscreen(app: AppHandle) -> Result<bool, String> {
    let w = main_win(&app)?;
    let f = !w.is_fullscreen().map_err(win_err)?;
    w.set_fullscreen(f).map_err(win_err)?;
    Ok(f)
}

#[tauri::command]
fn win_is_fullscreen(app: AppHandle) -> Result<bool, String> { main_win(&app)?.is_fullscreen().map_err(win_err) }

#[tauri::command]
fn win_state(app: AppHandle) -> WinState { app.state::<Saved>().0.lock().unwrap().clone() }

// Sentinel LOW-16: `shot_id` exists (command, manifest entry, permission) only in the
// mockplex fixture build; release builds never register it.
#[cfg(not(feature = "mockplex"))]
macro_rules! handlers { () => { tauri::generate_handler![
            win_minimize, win_toggle_maximize, win_close, win_toggle_fullscreen, win_is_fullscreen, win_state,
            commands::source_get, commands::auth_start, commands::auth_cancel, commands::servers_list,
            commands::server_connect, commands::server_connect_cancel, commands::manual_probe, commands::sign_out,
            commands::prefs_get, commands::prefs_set, commands::ai_key_set, commands::ai_key_has,
            commands::browse_home, commands::browse_section, commands::browse_section_hubs, commands::browse_facet,
            commands::browse_collections, commands::browse_collection, commands::browse_item, commands::version_pick, commands::browse_children, commands::browse_person, commands::browse_related,
            commands::browse_search, commands::play_start, commands::opaque_get, commands::playback_stop, commands::manual_confirm, commands::ai_migration_failed, commands::browse_letters,
            commands::account_me, commands::mark_watched
        ] }; }
#[cfg(feature = "mockplex")]
macro_rules! handlers { () => { tauri::generate_handler![
            win_minimize, win_toggle_maximize, win_close, win_toggle_fullscreen, win_is_fullscreen, win_state,
            commands::source_get, commands::auth_start, commands::auth_cancel, commands::servers_list,
            commands::server_connect, commands::server_connect_cancel, commands::manual_probe, commands::sign_out,
            commands::prefs_get, commands::prefs_set, commands::ai_key_set, commands::ai_key_has,
            commands::browse_home, commands::browse_section, commands::browse_section_hubs, commands::browse_facet,
            commands::browse_collections, commands::browse_collection, commands::browse_item, commands::version_pick, commands::browse_children, commands::browse_person, commands::browse_related,
            commands::browse_search, commands::play_start, commands::opaque_get, commands::playback_stop, commands::manual_confirm, commands::ai_migration_failed, commands::browse_letters, commands::shot_id,
            commands::account_me, commands::mark_watched
        ] }; }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Shortcut, ShortcutState};
    let media = [
        (Code::MediaPlayPause, "MediaPlayPause"),
        (Code::MediaTrackNext, "MediaNextTrack"),
        (Code::MediaTrackPrevious, "MediaPreviousTrack"),
        (Code::MediaStop, "MediaStop"),
    ];
    plex::redact::install_panic_hook();
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, ev| {
                    if ev.state() != ShortcutState::Pressed { return; }
                    // Only forward when our window is NOT focused; when focused the
                    // webview already receives the key as a DOM keydown.
                    if let Some(w) = app.get_webview_window("main") {
                        if w.is_focused().unwrap_or(false) { return; }
                        for (c, name) in media.iter() {
                            if sc.key == *c { let _ = w.emit("media-key", *name); }
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(handlers!())
        // plexuw protocol (§6a H1): http://plexuw.localhost on Windows, plexuw://localhost elsewhere.
        .register_asynchronous_uri_scheme_protocol("plexuw", |ctx, req, responder| {
            let app = ctx.app_handle().clone();
            let method = req.method().as_str().to_string();
            let uri = req.uri().to_string();
            let hv = |n: &str| req.headers().get(n).and_then(|v| v.to_str().ok()).map(str::to_string);
            let (origin, referer, range) = (hv("origin"), hv("referer"), hv("range"));
            tauri::async_runtime::spawn(async move {
                let p = app.state::<std::sync::Arc<commands::Plex>>().inner().clone();
                let r = commands::proxy_request(&p, &method, &uri, origin.as_deref(), referer.as_deref(), range.as_deref()).await;
                #[cfg(feature = "mockplex")]
                if std::env::var_os("PLEXUW_PROXY_DEBUG").is_some() {
                    // Fixture build only: status + header presence, never the URI.
                    eprintln!("plexuw proxy: status={} origin_present={} referer_present={}", r.status, origin.is_some(), referer.is_some());
                }
                let mut b = tauri::http::Response::builder().status(r.status)
                    .header("Cache-Control", "no-store")
                    .header("Content-Length", r.body.len().to_string());
                if let Some(ct) = r.content_type { b = b.header("Content-Type", ct); }
                if let Some(cr) = r.content_range.as_deref() { b = b.header("Content-Range", cr); }
                if r.content_type.is_some_and(|c| c.starts_with("video/")) { b = b.header("Accept-Ranges", "bytes"); }
                responder.respond(b.body(r.body).unwrap());
            });
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            let win = app.get_webview_window("main").expect("main window");
            // LOW-16: the fixture-only shot_id permission is granted at runtime, and only in
            // mockplex builds; release builds have neither the command nor the permission.
            #[cfg(feature = "mockplex")]
            app.add_capability(r#"{"identifier":"mock-shot","windows":["main"],"permissions":["allow-shot-id"]}"#)?;
            commands::init(&handle);
            #[cfg(feature = "mockplex")]
            if let Ok(scene) = std::env::var("PLEXUW_SHOT") {
                // Screenshot driver for the fixture build only.
                let scene: String = scene.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
                let w = win.clone();
                std::thread::spawn(move || {
                    // Retry until the page has loaded; the shim runs the scene once.
                    for _ in 0..90 {
                        std::thread::sleep(std::time::Duration::from_millis(1000));
                        let _ = w.eval(&format!("window.__plexShot&&window.__plexShot('{scene}')"));
                    }
                });
            }
            let st = load(&handle).unwrap_or_default();
            restore(&win, &st);
            app.manage(Saved(Mutex::new(st)));
            let _ = win.show();
            // Media keys while unfocused (best effort: another player may own them).
            // Registered off the main thread: on Linux/X11 registration round-trips
            // through the event loop and can deadlock if done inside setup().
            if std::env::var_os("PLEXUW_NO_GLOBAL_MEDIA").is_none() {
                let h2 = handle.clone();
                std::thread::spawn(move || {
                    for (c, _) in media.iter() {
                        let _ = h2.global_shortcut().register(Shortcut::new(None, *c));
                    }
                });
            }
            let w2 = win.clone();
            win.on_window_event(move |e| match e {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. } => {
                    let app = w2.app_handle();
                    let saved = app.state::<Saved>();
                    let mut g = saved.0.lock().unwrap();
                    *g = capture(&w2, &g);
                    persist(app, &g);
                }
                _ => {}
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PlexUW");
}

#[cfg(test)]
mod win_err_tests {
    #[test]
    fn info2_window_errors_are_fixed_category() {
        let e = super::win_err("Os error 1400: invalid window handle C:\\Users\\x");
        assert_eq!(e, "window-unavailable");
        assert!(!e.contains("1400") && !e.contains("Users"));
        let src = include_str!("lib.rs");
        let body = &src[src.find("fn win_minimize").unwrap()..src.find("fn win_state").unwrap()];
        assert!(!body.contains(concat!("e.to_", "string()")), "window commands must not forward raw error text");
    }
}
