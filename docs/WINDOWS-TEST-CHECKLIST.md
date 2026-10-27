**TEST FIRST (da Vinci): categories/genres after picking AND switching servers.** Sign in → pick server A → open a library → Genres tab → open a genre (works). Then sidebar switcher → pick server B → sidebar shows ONLY B's libraries; open one → Genres lists B's genres → open a genre (works). Switch back to A and repeat. Mock: run with `PLEXUW_MOCK_TWO_SERVERS=1` (Fixture Home → Friend's Server). Automated: `cargo test --features mockplex categories_reload_on_pick_and_switch`; screenshot shots-fu2b/m2catswitch-1920.png shows PASS. ☐

# Windows / WebView2 test checklist. REQUIRED before the Windows release

These cases cannot run on the Linux build box (WebKitGTK). Each one must be run on Windows 10/11 with the NSIS build and a **fixture/mock** server (`--features mockplex`), never a real token. Record the result and the build SHA.

| # | Case | Expected | Result |
|---|------|----------|--------|
| W1 | Capture the Origin and Referer that WebView2 sends on `http://plexuw.localhost/img/...` poster loads (set `PLEXUW_PROXY_DEBUG=1`) | Logged. If present, they are `http(s)://tauri.localhost`; posters show | ☐ |
| W2 | Request with a mismatched Origin (e.g. from devtools `fetch` with a forged origin, or a test page) | 403 | ☐ |
| W3 | Mismatched Referer | 403 | ☐ |
| W4 | `media/` and `hls/` with both headers absent | 403 | ☐ |
| W5 | Sign out, then inspect `%LOCALAPPDATA%\app.plexuw.desktop\EBWebView\Default\Cache` (and the Service Worker cache) | No `plexuw.localhost` entries; responses carry `Cache-Control: no-store` | ☐ |
| W6 | Sign out, then check that the disk image cache (`imgcache`) is empty | Empty | ☐ |
| W7 | The CSP in `tauri.windows.conf.json` allows `http://plexuw.localhost` images and blocks other origins | Posters load; an external `<img>` is blocked | ☐ |
| W8 | Manual host not in the connection list | A confirm prompt appears; "Don't allow" sends no token (check with the fixture log) | ☐ |
| W9 | The AI key lands in Credential Manager; a legacy key over 512 bytes is removed and the notice is shown | As described | ☐ |

Release gate: all of W1–W9 ticked. Any failure blocks the Windows release.
