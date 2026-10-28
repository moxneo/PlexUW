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
    if st.maximized {
        // Undecorated OS maximize uses the full monitor and slides under the taskbar.
        // Windowed mode fills the work area; fullscreen still uses rcMonitor.
        #[cfg(windows)]
        { fill_work_area(win); }
        #[cfg(not(windows))]
        { let _ = win.maximize(); }
    } else {
        fit_work_area(win);
    }
    if st.fullscreen {
        let _ = win.set_fullscreen(true);
        cover_taskbar(win, true);
    }
}

/// Windows undecorated fullscreen is sized to the work area and keeps WS_THICKFRAME,
/// which leaves a black strip where the taskbar sits. Cover the full monitor rect.
#[cfg(windows)]
fn cover_taskbar(win: &WebviewWindow, enter: bool) {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows_sys::Win32::Foundation::HWND;
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_STYLE, HWND_TOP,
        SWP_FRAMECHANGED, SWP_NOMOVE, SWP_NOSIZE, SWP_SHOWWINDOW,
        WS_BORDER, WS_CAPTION, WS_DLGFRAME, WS_THICKFRAME,
    };
    static BUSY: AtomicBool = AtomicBool::new(false);
    static SAVED: Mutex<Option<isize>> = Mutex::new(None);
    if BUSY.swap(true, Ordering::SeqCst) { return; }
    let Ok(handle) = win.window_handle() else { BUSY.store(false, Ordering::SeqCst); return; };
    let RawWindowHandle::Win32(raw) = handle.as_raw() else { BUSY.store(false, Ordering::SeqCst); return; };
    let hwnd = raw.hwnd.get() as HWND;
    let mask = (WS_CAPTION | WS_THICKFRAME | WS_BORDER | WS_DLGFRAME) as isize;
    unsafe {
        if enter {
            let style = GetWindowLongPtrW(hwnd, GWL_STYLE);
            let mut saved = SAVED.lock().unwrap_or_else(|e| e.into_inner());
            if saved.is_none() { *saved = Some(style); }
            let base = (*saved).unwrap_or(style);
            drop(saved);
            SetWindowLongPtrW(hwnd, GWL_STYLE, base & !mask);
            let mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
            let mut mi: MONITORINFO = std::mem::zeroed();
            mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
            if GetMonitorInfoW(mon, &mut mi) != 0 {
                let r = mi.rcMonitor;
                SetWindowPos(hwnd, HWND_TOP, r.left, r.top, r.right - r.left, r.bottom - r.top, SWP_FRAMECHANGED | SWP_SHOWWINDOW);
            }
        } else if let Some(style) = SAVED.lock().unwrap_or_else(|e| e.into_inner()).take() {
            SetWindowLongPtrW(hwnd, GWL_STYLE, style);
            SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED);
        }
    }
    BUSY.store(false, Ordering::SeqCst);
}

#[cfg(not(windows))]
fn cover_taskbar(_win: &WebviewWindow, _enter: bool) {}

/// Keep a windowed (not fullscreen) frame inside the monitor work area so the
/// bottom player bar sits above the taskbar. Fullscreen stays on `rcMonitor`
/// inside `cover_taskbar` and must not call this.
#[cfg(windows)]
fn win_hwnd(win: &WebviewWindow) -> Option<windows_sys::Win32::Foundation::HWND> {
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};
    let handle = win.window_handle().ok()?;
    let RawWindowHandle::Win32(raw) = handle.as_raw() else { return None };
    Some(raw.hwnd.get() as windows_sys::Win32::Foundation::HWND)
}

#[cfg(windows)]
fn read_work(hwnd: windows_sys::Win32::Foundation::HWND) -> Option<(i32, i32, i32, i32)> {
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    unsafe {
        let mon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(mon, &mut mi) == 0 { return None; }
        let r = mi.rcWork;
        Some((r.left, r.top, r.right, r.bottom))
    }
}

#[cfg(windows)]
fn place_work(win: &WebviewWindow, fill: bool) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowRect, SetWindowPos, HWND_TOP, SWP_SHOWWINDOW};
    static BUSY: AtomicBool = AtomicBool::new(false);
    if win.is_fullscreen().unwrap_or(false) { return; }
    if BUSY.swap(true, Ordering::SeqCst) { return; }
    let Some(hwnd) = win_hwnd(win) else { BUSY.store(false, Ordering::SeqCst); return; };
    let Some((l, t, r, b)) = read_work(hwnd) else { BUSY.store(false, Ordering::SeqCst); return; };
    unsafe {
        let mut wr: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut wr) == 0 { BUSY.store(false, Ordering::SeqCst); return; }
        let max_w = (r - l).max(960);
        let max_h = (b - t).max(600);
        let (x, y, w, h) = if fill {
            (l, t, max_w, max_h)
        } else {
            let mut w = (wr.right - wr.left).clamp(960, max_w);
            let mut h = (wr.bottom - wr.top).clamp(600, max_h);
            let mut x = wr.left;
            let mut y = wr.top;
            if x < l { x = l; }
            if y < t { y = t; }
            if x + w > r { x = r - w; }
            if y + h > b { y = b - h; }
            if x < l { x = l; }
            if y < t { y = t; }
            (x, y, w, h)
        };
        let near = |a: i32, b: i32| (a - b).abs() <= 2;
        if !(near(x, wr.left) && near(y, wr.top) && near(w, wr.right - wr.left) && near(h, wr.bottom - wr.top)) {
            SetWindowPos(hwnd, HWND_TOP, x, y, w, h, SWP_SHOWWINDOW);
        }
    }
    BUSY.store(false, Ordering::SeqCst);
}

#[cfg(windows)]
fn fit_work_area(win: &WebviewWindow) { place_work(win, false); }

#[cfg(windows)]
fn fill_work_area(win: &WebviewWindow) { place_work(win, true); }

#[cfg(windows)]
fn work_filled(win: &WebviewWindow) -> bool {
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetWindowRect;
    let Some(hwnd) = win_hwnd(win) else { return false; };
    let Some((l, t, r, b)) = read_work(hwnd) else { return false; };
    unsafe {
        let mut wr: RECT = std::mem::zeroed();
        if GetWindowRect(hwnd, &mut wr) == 0 { return false; }
        (wr.left - l).abs() <= 8 && (wr.top - t).abs() <= 8 && (wr.right - r).abs() <= 8 && (wr.bottom - b).abs() <= 8
    }
}

#[cfg(not(windows))]
fn fit_work_area(_win: &WebviewWindow) {}
#[cfg(not(windows))]
#[allow(dead_code)]
fn fill_work_area(_win: &WebviewWindow) {}

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
    if w.is_fullscreen().unwrap_or(false) { return Ok(true); }
    #[cfg(windows)]
    {
        // OS maximize on an undecorated window covers the taskbar. Toggle the work area instead.
        if w.is_maximized().unwrap_or(false) { let _ = w.unmaximize(); }
        if work_filled(&w) {
            if let Some(hwnd) = win_hwnd(&w) {
                if let Some((l, t, r, b)) = read_work(hwnd) {
                    let ww = ((r - l) as f64 * 0.8) as i32;
                    let hh = ((b - t) as f64 * 0.8) as i32;
                    let _ = w.set_size(PhysicalSize::new(ww.max(960) as u32, hh.max(600) as u32));
                    let _ = w.set_position(PhysicalPosition::new(l + (r - l - ww.max(960)) / 2, t + (b - t - hh.max(600)) / 2));
                }
            }
            fit_work_area(&w);
            return Ok(false);
        }
        fill_work_area(&w);
        return Ok(true);
    }
    #[cfg(not(windows))]
    {
        let m = w.is_maximized().map_err(win_err)?;
        if m { w.unmaximize() } else { w.maximize() }.map_err(win_err)?;
        Ok(!m)
    }
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
    if !f { cover_taskbar(&w, false); }
    w.set_fullscreen(f).map_err(win_err)?;
    if f { cover_taskbar(&w, true); }
    else { fit_work_area(&w); }
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
            commands::browse_search, commands::play_start, commands::opaque_get, commands::playback_stop, commands::playback_timeline, commands::playback_thumb, commands::manual_confirm, commands::ai_migration_failed, commands::browse_letters,
            commands::account_me, commands::mark_watched, commands::watchlist_list, commands::watchlist_add, commands::watchlist_remove
        ] }; }
#[cfg(feature = "mockplex")]
macro_rules! handlers { () => { tauri::generate_handler![
            win_minimize, win_toggle_maximize, win_close, win_toggle_fullscreen, win_is_fullscreen, win_state,
            commands::source_get, commands::auth_start, commands::auth_cancel, commands::servers_list,
            commands::server_connect, commands::server_connect_cancel, commands::manual_probe, commands::sign_out,
            commands::prefs_get, commands::prefs_set, commands::ai_key_set, commands::ai_key_has,
            commands::browse_home, commands::browse_section, commands::browse_section_hubs, commands::browse_facet,
            commands::browse_collections, commands::browse_collection, commands::browse_item, commands::version_pick, commands::browse_children, commands::browse_person, commands::browse_related,
            commands::browse_search, commands::play_start, commands::opaque_get, commands::playback_stop, commands::playback_timeline, commands::playback_thumb, commands::manual_confirm, commands::ai_migration_failed, commands::browse_letters, commands::shot_id,
            commands::account_me, commands::mark_watched, commands::watchlist_list, commands::watchlist_add, commands::watchlist_remove
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
            win.on_window_event(move |e| {
                if matches!(e, WindowEvent::Resized(_)) && w2.is_fullscreen().unwrap_or(false) {
                    cover_taskbar(&w2, true);
                } else if matches!(e, WindowEvent::Resized(_) | WindowEvent::Moved(_)) && !w2.is_fullscreen().unwrap_or(false) {
                    fit_work_area(&w2);
                }
                match e {
                WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. } => {
                    let app = w2.app_handle();
                    let saved = app.state::<Saved>();
                    let mut g = saved.0.lock().unwrap();
                    *g = capture(&w2, &g);
                    persist(app, &g);
                }
                _ => {}
            }});
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

    #[test]
    fn fullscreen_covers_the_monitor() {
        let src = include_str!("lib.rs");
        let start = src.find("fn cover_taskbar(").expect("cover_taskbar");
        let end = src.find("fn cover_taskbar(_win").expect("stub");
        let body = &src[start..end];
        assert!(body.contains("rcMonitor"), "fullscreen must use the full monitor rect");
        assert!(!body.contains(concat!("rc", "Work")), "fullscreen must not size to the work area");
        assert!(src.contains("WS_THICKFRAME"));
        assert!(src.contains("fn fit_work_area"));
        assert!(src.contains(concat!("rc", "Work")), "windowed mode clamps to the work area");
    }
}
