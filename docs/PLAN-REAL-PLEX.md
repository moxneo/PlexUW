# PLAN — Real Plex content in the PlexUW desktop app (plan only)

**Status:** plan; nothing has been built yet.
**Baseline:** PlexUW 0.1.0 (Tauri v2, mock data), which Scott installed on his PC and confirmed working.
**Target server:** any Plex server (generic). No specific host is hardcoded; examples use `plex.example.com`.

See `SETTINGS-RESEARCH.md` for the server-side settings we read and honour.

## 1. Sign-in: plex.tv PIN flow (the app never handles a password)
1. `POST https://plex.tv/api/v2/pins?strong=true` with headers `X-Plex-Product: PlexUW`, `X-Plex-Client-Identifier: <uuid>`, `X-Plex-Version`, `X-Plex-Platform`, `X-Plex-Device-Name`. The response gives `{id, code}`.
2. Open the system browser (not the webview) at `https://app.plex.tv/auth#?clientID=<uuid>&code=<code>&context[device][product]=PlexUW`. Scott signs in there with password, 2FA or SSO; PlexUW never sees the credentials.
3. Rust polls `GET https://plex.tv/api/v2/pins/<id>` every 1 s (backing off on 429/errors, per L1) until the PIN's `expiresAt` or until cancelled. Once `authToken` arrives it goes straight into the keychain and never touches JS.
4. Fallback for headless or other-device sign-in: show `plex.tv/link` with the 4-character code (non-strong PIN).

## 2. Server discovery and selection
- `GET https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=<setting>` lists devices that `provides=server`, each with `accessToken` and `connections[] {uri, local, relay, protocol}`.
- Picker: server name, owned/shared, online state, and Plex Pass features. Remember the choice by `clientIdentifier` (machineIdentifier), not by URL.
- Any user-entered host: support it both as a discovered resource and as a **manual server** entry (`https://plex.example.com[:port]`). Probe it with an unauthenticated `GET /identity` first. The server token is sent only after the `machineIdentifier` matches (§6a H2).
- **Connection choice** (re-run on startup, network change and playback failure):
  1. Race all `local` https `*.plex.direct` URIs, then the remote https URIs, then the manual URL, then **relay** as a last resort. Use `GET /identity` with a 3 s timeout, in parallel, and the first success wins.
  2. Label the result *Local*, *Remote* or *Relay*. Relay is capped at about 2 Mbps (1 Mbps for non-Pass users), so the UI says so and lowers the quality default.
  3. Use plain `http://` only if "Allow insecure connections = Local only" is set and the connected socket's peer IP is RFC1918, with an IP literal or `.local` name only (§6a M6). The default is never.
- Show (read-only, under Server › Status) the remote-access state, upload limit and **remote stream bitrate cap** from the server. These come from the resources response and `/:/prefs` when the account is the owner. The cap clamps "Remote quality".

## 3. Library browsing
| Area | Endpoints (PMS) | Notes |
|---|---|---|
| Sections | `/library/sections` | Movies, TV, Music, plus Other types hidden in M1 |
| Home hubs | `/hubs/continueWatching`, `/hubs/home/onDeck`, `/hubs/promoted`, `/hubs/sections/<id>` | maps to the existing Continue Watching / Next Up / Recently Added rows; server-side CW settings (weeks, max items, premieres) apply automatically |
| Grid | `/library/sections/<id>/all?type=&sort=&X-Plex-Container-Start=&Size=` | paged at 100, virtualised grid, blurhash or low-res placeholders |
| Filters | `/library/sections/<id>/{genre,studio,year,collection}` | feeds the existing facet bar and Categories tab |
| Collections | `/library/sections/<id>/collections`, `/library/collections/<id>/children` | sidebar Collections |
| TV | `/library/metadata/<show>/children` → seasons → episodes | unwatched badges from `viewedLeafCount` |
| Music | artists → albums → tracks; `/playlists` | uses loudness data if analysed |
| Details | `/library/metadata/<id>?includeChapters=1&includeMarkers=1` | chapters → right panel; **intro/credits markers → Skip pills + autoplay trigger** |
| Images | `/photo/:/transcode?width=&height=&url=` | sized per DPR; cached on disk (no token in the cache key) |
| Search | `/hubs/search?query=` | used by the Ctrl-K palette |

## 4. Playback
### Engine decision
**WebView2 `<video>`** (Chromium/Edge) plays H.264/AAC/VP9/AV1 in MP4 and WebM. HEVC works only if Windows has the HEVC extension. It cannot play MKV, DTS, TrueHD, PGS/VobSub subtitles, HDR passthrough control, or audio passthrough, so most real libraries would transcode or direct-stream heavily.
**libmpv** plays nearly everything, including HDR, passthrough, ASS/PGS subtitles, exclusive audio and refresh-rate matching. It is what Plex HTPC and Jellyfin Media Player use.

**Recommendation:** ship M2 on `<video>`, using HLS via the server's universal transcoder (hls.js bundled locally, no CDN) so real playback works quickly. Then do a libmpv spike (M5), rendering into a native child window under a transparent webview, which is the proven Tauri/JMP pattern. The engine is chosen behind a `Player` interface, so the UI does not change. On macOS libmpv also works (Metal/GL). Note that libmpv is LGPL/GPL-licensed: dynamic linking of the LGPL build is OK, and no VLC code is used.

### Decision: direct play, direct stream or transcode
- The client sends a **profile** of what the active engine supports: containers, codecs, max resolution and bitrate (from the quality setting, local vs remote), and the subtitle formats it can render.
- Call `/video/:/transcode/universal/decision` with `directPlay`, `directStream` (honouring Allow Direct Play/Stream), `maxVideoBitrate`, `videoResolution` and `subtitles=auto|burn|sidecar`.
- The server's answer decides:
  - **Direct play**: `/library/parts/<id>/file`, with an HTTP Range request.
  - **Direct stream**: remux to HLS.
  - **Transcode**: HLS at the target bitrate.
- Show the result in the Info panel as "Direct Play · 4K HEVC" / "Transcoding · 8 Mbps", with the reason.
- Server settings that are read and surfaced:
  - "Disable video stream transcoding": if set, warn that the item may not play.
  - HDR tone mapping off: warn that HDR transcodes will look washed out.

### Tracks
- Audio and subtitle streams come from the `Media/Part/Stream` metadata. The default pick follows the **account** language and subtitle mode, with the client "remember per series" setting layered on top.
- To switch a track, send `PUT /library/parts/<partId>?audioStreamID=&subtitleStreamID=`, which the server persists, then restart the stream at the current time if transcoding.
- Burn-in is needed for image subtitles on the `<video>` engine; it is not needed on libmpv.
- Auto-sync subtitles is shown only when the server has voice-activity data.

### Resume, timeline and watched state
- On start, seek to `viewOffset` and offer "Resume at 42:10" or "Start over".
- Report `/:/timeline?ratingKey=&key=&state=playing|paused|stopped&time=&duration=` every 10 s and on every state change, plus `/:/scrobble` / `/:/unscrobble` for manual marking.
- The **watched threshold and credits-marker completion are decided by the server**: we report, we don't decide.
- If the network drops, queue the latest timeline in memory, retry, and flush on stop or close.

## 5. Demo mode stays
- The bundled mock library remains. It loads on first run (before sign-in), when "Demo mode" is chosen in Server settings, or when no server is reachable ("Offline — showing demo library" banner).
- Demo mode makes zero network calls.
- A `DataSource` trait has two implementations, `MockSource` and `PlexSource`, and the UI only talks to the trait.

## 6. SECURITY (for Sentinel review)
**Token acquisition:** only the PIN flow above. PlexUW never takes or stores a username or password, and Plex.tv sign-in happens in the system browser.

**Token types:**
- *plex.tv account token*: used only for `/api/v2/resources`, account prefs and Home users.
- *server access tokens*: per server, taken from resources.

All of them live **only in the OS keychain**, through the Rust `keyring` crate:
- Windows Credential Manager (generic credential `PlexUW/<clientId>/account`, `PlexUW/<clientId>/server/<machineId>`)
- macOS Keychain
- Linux Secret Service

Tokens are never written to files, settings JSON, localStorage, logs, crash dumps, git or screenshots, and never pasted into issues.

**Tokens stay in Rust:**
- All PMS and plex.tv HTTP goes through a Rust `reqwest` client that attaches `X-Plex-Token` as a **header**. JS calls commands like `plex_get(path)` and gets JSON back with no token in it.
- Media and image URLs that `<video>` and `<img>` need are served through a local **`plexuw://` custom protocol handler** in Rust, which follows the contract in §6a H1 (the host is chosen in Rust, paths are allowlisted, and the header is added only per H2). That way no URL visible to the webview carries a token.
- Direct play under libmpv passes the header with mpv's `http-header-fields`.
- If a query-string token is ever unavoidable (some HLS sub-requests), it exists only inside Rust's proxy and is redacted in logs.

**Redaction:** a log layer strips:
- `X-Plex-Token` header values
- `X-Plex-Token=…` query params
- `authToken`/`accessToken` JSON fields
- `*.plex.direct` hostnames (which embed the IP) are reduced to `<plexdirect>`
- server URLs appear as `server:<machineId-prefix>` at info level

There is a unit test for each pattern, and CI greps the test logs for 20+ character token-like strings.

**CSP changes** (exact). The webview talks only to `self`, `ipc:` and the plexuw protocol origin (`plexuw:` on macOS/Linux, `http://plexuw.localhost` on Windows; see §6a M2). All remote traffic goes through Rust, so the webview CSP **does not gain any remote host**:
```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';  # 'unsafe-inline' is planned for removal (§6a M2)
img-src 'self' data: blob: <P>; media-src 'self' blob: <P>;
connect-src ipc: http://ipc.localhost <P>; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'self'
# <P> = http://plexuw.localhost on Windows, plexuw: on macOS/Linux (§6a M2)
```
The Rust-side egress allowlist, enforced in the HTTP client:
- `plex.tv`, `clients.plex.tv`
- `*.plex.direct`, limited to the exact labels returned for each server (no bare wildcard; tokens bound per §6a H2)
- the user's manually entered server host (e.g. `plex.example.com`)
- relay hosts returned by resources (`*.plex.services` relay URIs only as returned)

`app.plex.tv` is opened only in the external browser. Everything else is refused.

**Data flow**

| Destination | What is sent | Why |
|---|---|---|
| plex.tv | Client identifier, product/version/platform/device name, PIN id; then the account token in headers | sign-in, resources, account language prefs, Home users |
| System browser → app.plex.tv | clientID + PIN code (no token) | user signs in |
| PMS (local / remote / relay) | Server token (header), client id, playback profile, timeline/scrobble, track selections | browsing and playback |
| Anything else | **Nothing.** No telemetry, crash upload, analytics, update ping or CDN | — |

Updates are manual in M1–M4. A future updater would be a separate review.

**Client identifier:**
- A random UUIDv4 created on first launch and stored in the app config (not secret).
- It is shown in Settings › Advanced and can be regenerated, which signs out.
- It is not derived from hardware or the user.

**Sign-out and wipe:**
- **Sign out** deletes the keychain entries, attempts remote session revocation as best effort (endpoint to be named, §6a L3), and clears the in-memory caches, the image disk cache, and the hls.js/WebView2 HTTP cache for the plexuw origin.
- **Reset app** also deletes the settings file and window state, and regenerates the client id.
- The uninstaller asks whether to remove settings. The keychain is always wiped on uninstall, through an NSIS hook that runs `plexuw.exe --wipe-secrets`, which removes every `PlexUW/*` entry by prefix (§6a M7, L7).

**Other:**
- TLS verification is always on, and `*.plex.direct` certificates are validated normally.
- No `dangerouslyDisableCertificateVerification`.
- Tauri capabilities stay minimal (no fs, shell or http plugins exposed to JS).
- Commands validate their paths against an allowlist (`/library/…`, `/hubs/…`, `/:/timeline`…).

## 6a. Sentinel round-1 controls (binding for M1–M6)

### H1 — `plexuw://` proxy contract
- **URL form:** only `plexuw://<kind>/<opaque-or-relative-path>`, where kind ∈ {`img`, `media`, `hls`}.
- **Host:** the upstream host is always the server/connection currently selected in Rust. It is never taken from the page or the URL.
- **Rejected input:** absolute URLs, schemes, `//`, `..`, percent-encoded `/` or `\`, CR/LF and NUL.
- **Path allowlist per kind:** `/library/parts/`, `/library/metadata/…/thumb|art`, `/photo/:/transcode`, `/video/:/transcode/universal/`.
- **Request headers:** the upstream request is built from scratch. Only `Range` (one `bytes=N-M` range, validated) and `Accept` are forwarded. Webview headers, `Cookie` and `Origin` are never forwarded.
- **Response headers:** only `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges` and `Cache-Control` are returned. Everything else, including `Set-Cookie` and `Location`, is dropped.
- **Redirects:** never followed inside the proxy (see H2).
- **HLS/DASH:** playlist and manifest bodies are rewritten in Rust. Every URI becomes `plexuw://hls/<id>` and every `X-Plex-Token` is stripped. The id→upstream map lives only in Rust.
- **Own origin only:** a request whose `Origin`/`Referer` is not the app origin is rejected. No other window exists.
- **Tests:** a unit test for every rejection case, plus a test that no proxied body or header ever contains a token.

### H2 — token-to-host binding and redirects
- One Rust egress function. Every request goes through it, and it is unit-tested.
- reqwest uses `redirect::Policy::none()`. If a redirect is ever needed, a custom policy re-validates every hop (allowlist + binding) and drops `X-Plex-Token` on any host change.
- **Account token:** sent only to `plex.tv` and `clients.plex.tv`.
- **Server token T for machineId M:** sent only to the `connections[].uri` hosts that resources returned for M (exact `*.plex.direct` labels; no bare wildcard), or to a manual host once it has proved it is M.
- **Manual host:** probed first with an unauthenticated `GET /identity` over verified TLS. The token is attached only after the returned `machineIdentifier` matches a server on the account.

### MED
- **M1:** server-sourced strings are rendered only through `textContent` or an escaping template helper. All 47 `innerHTML` sinks are converted before M2, a lint rule bans `innerHTML` with non-literal input, and server strings are length-capped.
- **M2:** exact CSP per platform. Windows: `img-src`/`media-src`/`connect-src` limited to `http://plexuw.localhost`. macOS/Linux: `plexuw:`. Planned removal of `style-src 'unsafe-inline'` (move to classes, or use a nonce/hash). No `unsafe-eval`, and hls.js is confirmed to run without it.
- **M3:** custom commands are declared in `build.rs` `AppManifest::commands` and granted per window in capabilities. `withGlobalTauri: false`, with the API imported instead. No remote URLs in capabilities. `plex_get` applies the H1 path allowlist and strips `authToken`, `accessToken` and token-bearing URLs (including from resources JSON) before anything reaches JS.
- **M4:**
  - A panic hook sends messages through the redactor.
  - Tokens use a `Secret` type with no Debug/Display (`secrecy::SecretString`).
  - WebView2/WER crash dumps are disabled or documented; no dumps are collected or uploaded.
  - reqwest/hyper tracing goes through the redaction layer at all levels.
  - RFC1918 and public IPs and `connections[].uri` are redacted.
  - "Open logs folder" only ever holds redacted logs.
- **M5:** Rust builds `/photo/:/transcode` itself. `url` must be a server-relative `/library/metadata/...` path taken from server metadata, never from JS. Absolute URLs are rejected.
- **M6:** the "Local only" insecure mode checks the connected socket's peer IP (or pins the resolved IP). Plain HTTP is allowed only to IP literals or `.local`, never to public names, and shows a persistent "insecure" badge. The default stays Never. For TLS, validated TLS plus the H2 binding is the rebinding control.
- **M7 (PLAN-SETTINGS §4):**
  - Keychain entries are named `PlexUW/<clientId>/ai/<provider>`.
  - Migration order: write → read back → compare → `removeItem` and overwrite.
  - Then WebView2 `ClearBrowsingData` (DOMStorage), or delete the old origin storage.
  - Reset and `--wipe-secrets` remove every `PlexUW/*` entry, enumerated by prefix, including entries under older clientIds.
  - The AI key is used only in Rust; JS sees only set/not set.
- **M8:** owner gating relies on the server's 403 as the real backstop (the `owned` flag is UI-only). Admin commands are never available to the AI assistant. Binding voice/AI guardrails:
  - sharing off by default;
  - only title, episode, a rounded timestamp and the screen type are sent;
  - metadata is capped and wrapped as data;
  - read and play actions only, with confirmation for changes;
  - no logs;
  - keys in the keychain;
  - HTTPS only;
  - kept local: token, server URLs and IPs, file paths, history and library, other profiles, device IDs.

### LOW
- **L1:**
  - Use the PIN's `expiresIn`/`expiresAt` instead of a fixed 10 min.
  - Back off on 429 or errors.
  - Discard the PIN id after use, and cancel polling on sign-out or quit.
  - The 4-character `plex.tv/link` fallback is opt-in and short-lived.
  - The auth URL (clientID and code) is never logged.
- **L2:** no command result, event payload, window title or deep link (`#settings/...`) ever carries a token. A test scans every IPC response for token patterns.
- **L3:** remote revocation on sign-out is best effort until the endpoint is named. Sign-out also clears the hls.js and WebView2 HTTP cache for the plexuw origin.
- **L4:** the image cache is under the app's local data folder. No token, server hostname or IP appears in cache keys or paths.
- **L5 (PLAN-SETTINGS §4):** the web/demo build can never accept a real AI key. The field is hidden or clearly labelled "mock".
- **L6:** Authenticode signing of the NSIS installer and the exe, with published checksums. Any future updater uses signed manifests (Tauri updater + minisign) over HTTPS and gets its own Sentinel review.
- **L7:** `--wipe-secrets` does only that, takes no other arguments, and never prints secrets.

## UX additions (review round 1)
- **PIN waiting screen:** the 4-character code shown large, "Opened in your browser", the fallback "or go to plex.tv/link and enter this code" on the same screen, Cancel, and when the PIN's own `expiresIn`/`expiresAt` passes, "Code expired" with Get a new code.
- **Connection chip:** Local / Remote / Relay is shown as a small chip in the player's info overlay as well as in Settings. The relay 2 Mbps warning has a "Why?" link explaining Plex relay limits.
- **Track switching:** when an audio or subtitle change restarts a transcode, keep the last frame dimmed with "Switching audio…" / "Switching subtitles…" and a spinner instead of a black hitch.
- **Linux keychain error:** "PlexUW couldn't save your sign-in securely. Your system has no keyring service running (for example GNOME Keyring or KWallet). Install or unlock one, then try again." Offer Retry. Never fall back to a plaintext token.
- **Demo badge:** a persistent "Demo data" badge in the sidebar footer, not a one-time toast.

## 7. Milestones (rough effort, one dev)
| # | Milestone | Effort |
|---|---|---|
| M1 | DataSource trait + Rust HTTP + keychain + PIN sign-in + resources + server picker + connection race; demo mode retained | 4–5 d |
| M2 | Browsing: home hubs, Movies/TV/Music grids, details, collections, search, image proxy + cache | 5–6 d |
| M3 | Playback on `<video>`+hls.js: decision API, resume, timeline/scrobble, markers → Skip/autoplay, chapters | 5–7 d |
| M4 | Tracks: audio/subtitle pick + persist, account language prefs, subtitle styling, burn-in path; quality local/remote | 3–4 d |
| M5 | libmpv spike → engine behind `Player` (Windows first), direct play of MKV/HEVC/HDR, passthrough | 8–12 d (risky) |
| M6 | Hardening: redaction tests, Sentinel review, offline/relay UX, uninstall wipe, Mac build check | 3 d |

## 8. Risks
- WebView2 codec gaps cause heavy transcoding of Scott's library until libmpv lands. The server load could be high, especially for 4K HDR.
- Embedding libmpv under the webview (window layering, DPI, fullscreen sync) is the hardest piece. It may need a native overlay strategy.
- Relay is slow, and a 2 Mbps cap is a poor experience.
- `plex.direct` and DNS-rebinding protection on some routers block local connections.
- Plex API changes are undocumented or unofficial, so endpoints could shift.
- Keychain behaviour differs across Linux desktops (Secret Service may be missing), so Linux needs an explicit "can't store a token" error.
- Licensing: libmpv must be built LGPL and dynamically linked.

## 9. Open questions for Scott
1. (Answered 2026-10-22: generic setting, see Scott decisions.) Is the user's custom host a reverse proxy to PMS (which port, and is it TLS-terminated) or a custom-connection URL set in PMS? Should PlexUW prefer it over `plex.direct`?
2. Is Remote Access enabled on the server, and is there a remote stream bitrate cap? Does the server have Plex Pass (markers, HW transcoding)?
3. Library codecs: mostly MKV/HEVC/DTS/4K HDR? This decides whether libmpv must move ahead of M3.
4. Plex Home users or managed profiles: needed in v1?
5. Is a local-only "allow insecure http" option acceptable?
6. Music: is playback in scope for v1, or only browsing?
7. Should PlexUW write the language/subtitle prefs back to the plex.tv account or keep them app-local?

## Later (parked, not in this build)
- **Owner admin:** sessions and stopping streams, library scan/refresh/empty trash, butler tasks, server prefs, logs. Gate it on the `owned` flag from resources, with the server's 403 as the backstop. Read-only first; destructive actions need a typed confirmation.
- **Requests:** Overseerr is archived (Feb 2026) and was merged with Jellyseerr into **Seerr**. Integrate with Seerr via per-user Plex sign-in, and add only that host to the Rust egress allowlist.
- **Admin phasing (da Vinci, for later):** a separate "Server" sidebar destination, shown only to owners. Phase A is a read-only dashboard (sessions, transcode vs direct, bandwidth, scans, health). Phase B adds safe actions (scan or refresh a library, refresh metadata, stop a stream with confirmation). Phase C edits server prefs with a "Changes your server for everyone" footnote and Undo. Media is never deleted. Owner-token writes need Sentinel review and a write allowlist. The research's admin Skips would become "Admin phase C".
- **Requests UX (for later):** Scott runs **Seerr 3.4.1** (the successor to Overseerr/Jellyseerr; docs.seerr.dev), with 1,738 media items and 303 requests. Entry points are "Not in your library. Request it" in empty search, details pages for titles not in the library, and a Requested badge with pending/approved/available status. PlexUW has ONE setting, the Seerr URL. Users sign in to Seerr with their existing Plex login (Seerr's Plex auth, using the Plex token PlexUW already holds). End users never create a Seerr account or enter an API key. It is a new egress host, so it needs Sentinel and CSP review and must go through the Rust proxy. Requests are off by default for kids' profiles.
- **Owner-admin preconditions (Sentinel):**
  1. The UI is shown only when the `owned` flag is set AND a live owner probe (`GET /:/prefs` → 200) succeeds. 401/403 is final, and "is owner" is never cached across a server, user or Home switch.
  2. Separate `admin_*` Rust commands with their own allowlist. They are not reachable via `plex_get` and are not in any capability the AI tool layer can use.
  3. The AI gets no admin tools and cannot read prefs, logs or sessions.
  4. Destructive actions need a typed native confirmation, are rate-limited, and are logged with redaction.
  5. Server logs pass through the redactor.
- **Seerr preconditions (Sentinel):**
  - Re-review the product actually used (Seerr 3.4.1).
  - HTTPS with verified TLS only, and the cert/SPKI pinned for a LAN host.
  - Exactly that host in the Rust allowlist, bound to its own credential, with no redirects.
  - Least privilege (no admin-level credential).
  - The Seerr host, credentials and other users' requests stay out of the AI context, and assistant request actions need confirmation.
  - Seerr strings are rendered as text only (M1).
  - **Plex login reuse:** this sends Scott's Plex token to a third host (Seerr). It requires Scott's explicit approval plus a separate Sentinel sign-off, and the token is never sent before the host is pinned.
- **One-time admin config fields (later):** the Plex server URL (e.g. plex.example.com) and the Seerr URL. The Plex URL uses the same path as the manual host in §2/H2: an unauthenticated identity probe first, with the token only after the machineIdentifier matches.


## Scott decisions 2026-10-22

These are official and replace the earlier defaults.

1. The server URL setting is generic (any host, or a LAN IP). No specific host is hardcoded in code, defaults, placeholders or tests; examples use `https://plex.example.com`. M1 accepts https only, so a plain-http LAN IP needs the insecure-HTTP setting, which is still "Never".
2. Scott has Plex Pass (lifetime). Remote access and the bitrate cap are unanswered.
3. The library is mixed and the server does GPU transcoding, so the libmpv priority stays as planned.
4. v1 is Plex PIN login and works on any Plex server. Music playback is low priority; browsing is enough.
5. Audio and subtitle prefs sync with the Plex account (default `plex-account`, not PlexUW-only).
6. Quality uses selectable presets like the Plex app (default Original). There is no PlexUW-side cap logic; caps come from the Plex dashboard. Skip offers two options: "Skip automatically", or a prompt that stays visible for a configurable 10–20 s (default 15).
7. Close quits by default. Optional "Minimize to tray" and "Picture-in-picture" settings are added, both off by default. Mock AI settings stay visible (still mock, no network).
8. Seerr stays in Later.

## 6b. Sentinel M2 rulings (2026-10-22, PASS at 6eaee34)
- **N1 (proxy Origin/Referer):** a present Origin or Referer must be the app origin, otherwise 403. When BOTH are absent the request is allowed only for `GET /img/...` (WebKitGTK sends neither on `<img>` loads). `media` and `hls` get no exception, now or in M3: both absent means 403.
- **innerHTML (accepted for M2 with conditions):** `desktop/shim/lint-shim.sh` runs as a pre-commit hook (`scripts/pre-commit`; no CI script exists in this repo) and also fails if the shim touches any app.js renderer or global. No Plex data may reach app.js renderers. **The app.js innerHTML sinks must be converted to DOM/textContent or removed before M6.** This blocks M6.
- **MED-1 (manual host):** a manual host binds to machine M only if its host:port is in M's plex.tv connection list. Otherwise the app asks "Send your server token to <host>?" and stores the answer per (machineId, host:port) in `manual-hosts.json`, which prefs_set cannot write. Startup never asks; it uses only listed hosts or a remembered "yes".
- **LOW-5:** body caps are enforced while streaming (20 MB for images, 32 MB for API responses).
- **WebView2:** the cases in `docs/WINDOWS-TEST-CHECKLIST.md` are REQUIRED before any Windows release.

---

## Multi-server addendum (PLAN ONLY — no code until approved + Sentinel review)

**Goal.** One merged experience across every server on the account (owned + shared): merged Home hubs and libraries, a single item page per title, and play from the best copy. The current single-server mode stays the default until MS3 lands.

### 1. Merged home & libraries
- Libraries are grouped by kind (Movies / TV / Music). Each server's sections are listed under the merged view and remain individually browsable. A **source badge** (server name + colour dot, plus Local/Remote/Relay chip) sits on cards and item pages.
- Hubs: Continue Watching / On Deck are merged and sorted by `lastViewedAt`. Recently Added is merged by `addedAt`. Each list is capped (see §6).
- Server switcher (shipped in the follow-up) becomes "All servers" + per-server filter.

### 2. De-dup and best source
- Key: Plex GUID (`plex://movie/…`, `plex://episode/…`); fall back to external `Guid` ids (imdb/tmdb/tvdb) only when the plex GUID is absent. Never title-match.
- Best source ranking, per item: (a) connection type local > remote > relay; (b) the quality that fits the quality preset for that connection; (c) resolution/bitrate/HDR; (d) server online + latency from the race. Ties go to the owned server.
- **User override:** "Play from…" menu on the item page (the Info panel's "Available on" list). Optional per-item sticky choice stored in prefs (server machineId only, never tokens).
- Watch state: show the most-recent progress across copies; write timeline/scrobble only to the server actually playing.

### 3. Per-server tokens (H2)
- Each server's `accessToken` comes from plex.tv `/api/v2/resources` (already parsed). It is stored in the keychain under `server:<machineId>` and **bound to that server's own `connections[]` host set** (exact host+port+scheme from resources, plus the approved manual host for that machineId only).
- The egress layer picks the token by **machineId → host-set match**. A request to a host not in that server's set gets no token (H2 deny). The account token is never sent to any server.
- Shared-server tokens get the same treatment; no cross-server reuse.

### 4. Connection race
- Per server, race the candidate connections in parallel (local first, staggered 150 ms; 5 s per-attempt timeout, as now). Servers race independently and concurrently (bounded: max 4 servers in flight).
- **Partial failure:** a server that fails shows Offline/Unreachable in the switcher and badges; its content is omitted from merged views with a "1 server unavailable · Retry" note. Others keep working. Re-race on network change or on Retry.

### 5. Proxy routing from opaque item keys
- The renderer only ever sees opaque ids. The id becomes `<serverSlot>.<ratingKey>`, where serverSlot is a small integer from a Rust-side table (slot → machineId). No machineId, host or token in the renderer.
- The image/media proxy resolves the slot → server → chosen connection → that server's token. Unknown or stale slot → 404. The path allowlist is unchanged and applies per server.
- Slots are regenerated at sign-out and server-list refresh; old ids stop resolving.

### 6. Caching, sign-out, performance
- Caches (metadata, hubs, image LRU) are keyed by slot and dropped per server when a server goes offline or loses access.
- Sign-out: wipe all `server:*` tokens, the slot table, caches, PlaySession and manual hosts (as today, per server).
- Limits: ≤ 8 servers merged (others listed but not merged); hub fan-out ≤ 4 concurrent requests per server; merged hubs cap 50 items; de-dup in Rust (O(n) hash by GUID); first paint shows the fastest server and later ones stream in.

### 7. Milestones & effort (after M3–M6)
| MS | Scope | Effort |
|---|---|---|
| MS1 | Per-server token store + host binding + slot table; egress tests (H2) | 2–3 d |
| MS2 | Parallel race, per-server status, partial failure UI | 2 d |
| MS3 | Merged home/libraries + source badges | 3 d |
| MS4 | GUID de-dup, best-source ranking, "Play from…" override | 3 d |
| MS5 | Caching/sign-out hardening, perf limits, Sentinel review | 2 d |

### 8. Risks
- Shared servers with missing GUIDs (older agents) → duplicates; mitigated by falling back to external ids and showing both copies.
- Tokens from shared servers can be revoked silently → 401 handling per server (mark offline, refetch resources once).
- Fan-out load on weak servers; relay bandwidth limits; mismatched watch state across copies.
- Slot ids leaking into logs/screenshots are harmless only if the slot → machineId table stays in Rust.

### 9. Sentinel checklist — per-server token handling
- [ ] Each token is used only for hosts in its own server's resources/approved-manual set (H2), tested with a cross-server host swap.
- [ ] The account token is never sent to a media server; server tokens never sent to plex.tv beyond resources.
- [ ] No token, machineId or host in the renderer, logs, errors, screenshots or crash output.
- [ ] Slot table only in Rust; stale/unknown slot → 404; slots rotated on sign-out/refresh.
- [ ] Sign-out wipes every `server:*` keychain entry and all caches; verified by test.
- [ ] Revoked/401 token → that server only is marked offline; no retry storm, no fallback to another server's token.
- [ ] Manual address binds to exactly one machineId (identity check first, without a token).
- [ ] Prefs store only machineIds for overrides, never tokens or hosts.
- [ ] Per-server path allowlist unchanged; HLS rewrite keeps tokens out of playlists per server.

### 10. Inputs from research (plexuw-research/PLEX-MULTI-SERVER.md)
- **Account token never goes to a friend's server.** Each server, owned or shared, uses only its own `accessToken` from /resources. This is §3 and Sentinel item 2.
- **Race per server, cache the winner** per server + network. Order: local HTTPS, remote plex.direct HTTPS, then relay. **No local-HTTP tier** (Sentinel MED P-1, fixed before MS2): egress is https-only and a server token must never cross the LAN in cleartext; `load_resources` drops every non-https connection and a test proves the fixture's advertised `http://` local address is never contacted. Any future plain-HTTP option would be a separate, Sentinel-reviewed opt-in that sends no token. Re-race on a network change. On relay, show a badge and cap at 2 Mbps (choose transcode up front).
- **Each server loads independently** (§4): a slow or failed server never blocks the others.
- **"Available on" picker** on the item page (the Info panel), the same thing as the §2 override.
- **Remote playback entitlement (since 2025-04-29).** Remote personal video from a shared server needs one of: Plex Pass on the admin, Plex Pass on the viewer, or a Remote Watch Pass. Local playback, music and photos are exempt. A failed remote play on a shared server shows a clear message ("This server's owner or your account needs Plex Pass or a Remote Watch Pass for remote playback") with no retry loop. The exact plex.tv field or error code is unverified; confirm it in MS2.

## M3 — HTPC parity (not built in follow-up 3; PLAN ONLY)
PlexUW replaces Plex HTPC (refs: plexuw-research/htpc-ref/1–3). Built in follow-up 3: fanart hero (Home + detail), profile-first rail, round action row + resolution badge, circular credit headshots, Continue Watching progress, top-right clock. Deferred to M3+, each behind the frozen-plan gates and side-panel rule (RIGHT: chapters + Up Next; LEFT: cast, file info, servers):
- Top tab bar: Recommended / Library / Collections / Playlists / Categories.
- Watchlist (plex.tv discover API: new host, needs Sentinel).
- Live TV / DVR. Discover. Share.
- Ratings & reviews cards; Related row (`/related` hub: new query, allowlist review).
- Critic score source badges and "Directed by" header if they need extra API calls beyond /library/metadata/{id}.
- Play / Restart / Mark watched wiring (round buttons are disabled placeholders until the M3 player + scrobble land).
- Rail auto-collapse on scroll (currently collapses by width <1600px only).
