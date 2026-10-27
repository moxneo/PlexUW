# PlexUW Windows desktop app — milestone 1 (branch `windows-app`)

Mock data only. No Plex token, no network: the web UI is bundled into the binary and a CSP blocks remote loads.
VLC / vlc-redesign stayed a visual reference only: no GPL code or assets were copied and no VLC-specific features were added.

## Framework: Tauri v2 (not Electron)
**Why:** Tauri cross-builds a Windows NSIS installer from this Linux box with no Windows machine:
`cargo-xwin` downloads the MSVC CRT/SDK, then `clang-cl`/`lld-link`/`llvm-rc` compile and link and `makensis` packages.
It worked on the first try. Electron would have needed wine for `electron-builder` NSIS/resource editing, so it was not easier.
Tauri also fits the roadmap (Tauri + libmpv), produces a ~3.6 MB installer instead of ~80 MB, and uses the OS webview (WebView2 on Windows, WKWebView on macOS).

## Layout
```
desktop/
  sync-web.sh              copies index.html/app.js/data.js/styles.css/assets/favicon/brand + shim into desktop/dist (gitignored)
  shim/desktop.js|.css     desktop-only glue, active only when window.__TAURI__ exists (the plain web build is unchanged)
  src-tauri/               Rust shell (lib.rs), tauri.conf.json, capabilities, icons (from the approved logo pack)
```
Logo pack (`/workspace/plexuw-logo/final`) was copied into the repo, so nothing references /workspace at runtime:
- `desktop/src-tauri/icons/plexuw.ico` is the app/exe and NSIS installer icon. The PNGs and `PlexUW.icns` cover Linux and macOS.
- `brand/plexuw-lockup-dark.svg` is the title-bar mark (rendered at 160 px wide, the pack's minimum) and the splash mark.
- `favicon/*` is the web UI favicon set, linked from index.html.

## Build
Prerequisites (Debian): `nsis clang lld llvm pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev`,
plus rustup stable with the `x86_64-pc-windows-msvc` target, `cargo install cargo-xwin tauri-cli --locked`.
```
cd desktop/src-tauri
cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis   # Windows installer
cargo tauri build --bundles deb,appimage                                               # Linux
```
Outputs:
- `target/x86_64-pc-windows-msvc/release/bundle/nsis/PlexUW_0.1.0_x64-setup.exe` (per-user installer)
- `target/x86_64-pc-windows-msvc/release/plexuw.exe` (portable exe; needs the WebView2 runtime, which ships with Windows 10/11)
- `target/release/bundle/{deb,appimage}/`

## Features
- **Frameless window** with our own title bar: lockup mark, a drag region, and minimize / maximize / close buttons wired to Rust commands.
  The player's own top bar also has working Minimize and Maximize buttons.
- **Borderless fullscreen** through F11 or the app's fullscreen button (`#bF`). It calls `set_fullscreen`, a borderless popup sized to the
  current monitor's full rect, so it fills 21:9 and 32:9 screens. The shell title bar hides while fullscreen and in the player.
- **Window state**: `<config>/app.plexuw.desktop/window-state.json` stores the monitor name, normal rect, maximized and fullscreen.
  It is saved on move, resize and close.
- **Multi-monitor restore**: if the saved monitor is still connected and the rect intersects it, the window restores there.
  Otherwise it centres on the primary monitor. Maximized and fullscreen are re-applied on the restored monitor.
- **Media keys**: MediaPlayPause, MediaNextTrack, MediaPreviousTrack and MediaStop are handled 1) as DOM keydown while the window is focused,
  2) through Rust global shortcuts (emitting `media-key`) while it is unfocused, and 3) through `navigator.mediaSession` handlers.
  Mapping: Play/Pause toggles the player; Next goes to the next episode; Previous restarts, or goes back if under 3 s; Stop pauses and returns home.
- **Splash**: lockup on #0B0D12 for about 1.1 s, then a fade.
- **Security**: the CSP has `default-src 'self'`, `connect-src ipc: http://ipc.localhost` only (no remote fetch/XHR/WebSocket), and
  `img/media 'self' data: blob:`. The capability grants only `core:default` + window dragging. There are no http, fs or shell plugins.

## Verified vs untested
Verified on Linux (Xvfb 5120x1440 + openbox): the window maps and shows the title-bar mark; F11 goes to 5120x1440 at 0,0 and back; a moved and resized
window is saved and then restored exactly on relaunch; a fake "gone" monitor falls back to centred on primary. Screenshots are in `shots-win/`.
The Windows installer and exe were cross-built and are valid PE files.

**Untested (needs real Windows):** running the exe and installer, WebView2 behaviour, real borderless fullscreen on a Windows ultrawide,
multi-monitor restore with real monitor names, DPI-scaled monitors, media keys (no media keys and no Windows here),
global media-key registration contention with other players, and whether the installer/exe icon shows correctly in Explorer.
CSP blocking of remote fetches is configured but was not exercised inside the running app.

## Known gaps
- The exe and installer are unsigned (SmartScreen will warn). Code signing needs a certificate.
- There is no snap-layouts hover on our maximize button (Windows 11). That needs a WM_NCHITTEST/HTMAXBUTTON hook.
- Resizing the frameless window uses OS edges; no custom resize grips were added.
- Media-key "Next/Previous" only makes sense for TV. Movies ignore Next.
- On headless Linux each launch blocks about 30 s on D-Bus/portal registration (an environment issue, see LESSONS.md).
- Not built for ARM64 Windows.

## Mac path
The same code builds on macOS: `cargo tauri build --bundles dmg,app` on a Mac (or a `macos-latest` GitHub runner); `icons/PlexUW.icns` is already listed.
To do: use `titleBarStyle: "Overlay"` + `hiddenTitle` to keep native traffic lights instead of our Windows-style buttons (switch on `navigator.platform`),
notarize with an Apple Developer ID, and check MPNowPlayingInfoCenter/media keys through the WKWebView mediaSession.
Cross-building a signed .app from Linux is not supported, so a Mac or macOS CI is required.
