# PLAN — PlexUW Settings (plan only)

Input: the code inventory (prototype `app.js`/`index.html` + desktop shell), `SETTINGS-RESEARCH.md` (115 Plex/Jellyfin settings: 37 Required, 44 Useful, 34 Skip), and `APPLE-POLISH-SPEC-v1.md` (M3, M4, S1).

## 1. Inventory: what exists today
| Setting | Where | Storage now | Values / default | Surfaced in UI? |
|---|---|---|---|---|
| AI provider | Settings › AI Provider | localStorage `plexuw.ai.provider` | xai / openai / openrouter / self; xai | yes |
| AI API key (per provider) | same | localStorage `plexuw.ai.key:<p>` | — | yes (masked, eye, Clear, Test is a mock) |
| AI model (per provider) | same | `plexuw.ai.model:<p>` | grok-4 / gpt-4o-mini / openrouter/auto / llama3.1 | yes |
| AI base URL (self-hosted) | same | `plexuw.ai.base` | `http://localhost:11434/v1` placeholder | yes, only for self |
| Voice mode (three-way) | Settings › Voice | `plexuw.voice.mode` | pause (default) / duck 20% / none | yes |
| Autoplay next episode | Settings › Playback + Up Next toggle + palette | `plexuw.profile.default.autoplay` | on | yes |
| "Still watching?" streak | runtime | sessionStorage `plexuw.apstreak` | fixed at 3 | no |
| Autoplay countdown | code | — | 10 s fixed | no |
| Sidebar collapsed | sidebar button / palette | `plexuw.navc` | off | implicit |
| Edge-handle first-run hint | player | `plexuw.edgehint` | shown once | no |
| Aspect / zoom mode | player menu | runtime only | Auto · fit / zoom / smart crop / stretch | player only |
| Smart-crop bias | player menu | runtime | −15…15, 0 | player only |
| Panels (Info left, Up Next/Chapters right) | player | runtime | closed; both allowed ≥3440 | no |
| Library sort / facet | library bar | runtime | title; genre | inline |
| Window state (monitor, rect, maximized, fullscreen) | desktop shell | `<config>/window-state.json` | restore last; 80% centred on primary at first run | no |
| Media keys (global when unfocused) | desktop shell | env `PLEXUW_NO_GLOBAL_MEDIA` | on | no |
| Debug URL params | `?mode= ambient= pinui hint nohint voice vq ask pal` | URL | — | dev only |

**Findings:**
- The AI key is in **localStorage**. It must move to the keychain in the desktop app.
- The Test button and Base URL are blocked by the CSP today (expected while this is a mock).

## 2. Proposed settings: 9 categories, defaults, ownership
Every row carries a source label, shown in the UI as small grey text under the value:
- **From your Plex account**: lives on plex.tv; changing it here also changes it in other Plex apps.
- **From your server**: read-only, with an "Open in Plex Web" link.
- **PlexUW only**: stored on this PC.

Skip vocabulary, used the same way everywhere (plan, UI, research mapping): **Show button / Skip automatically / Do nothing**.

**1. General & Account** *(all PlexUW only unless noted)*
- Signed-in account and avatar *(From your Plex account)*
- Plex Home user switch *(From your Plex account)*
- Demo mode: default on until signed in
- **Sign out** (this device): clears the keychain and caches
- **Sign out all devices**: revokes all sessions for the account on plex.tv. Needs a typed confirmation ("SIGN OUT"), after which this device is signed out too. *(From your Plex account)*

**2. Server & Streaming** *(merges Server + Quality, so the cap and remote quality are on one page)*

| Setting | Default | Source |
|---|---|---|
| Active server | last used | PlexUW only |
| Connection | Auto (Auto / Prefer local / Prefer remote) | PlexUW only |
| Manual server URL | none | PlexUW only |
| Status card: Local/Remote/Relay, remote access, upload limit, **remote stream cap**, Plex Pass, markers, HW transcoding, HDR tone mapping, "video transcoding disabled" warning | — | From your server |
| Local quality | Original | PlexUW only |
| Remote quality (the cap is shown right under it) | 8 Mbps 1080p, clamped to the cap | PlexUW only |
| Relay quality | 2 Mbps 720p, with a "Why?" link explaining the relay limit | PlexUW only |
| Quality suggestions | on | PlexUW only |
| Play smaller videos at original quality | on | PlexUW only |
| *Advanced:* Allow Direct Play / Allow Direct Stream | on / on | PlexUW only |
| *Advanced:* Force Direct Play | off | PlexUW only |
| *Advanced:* Max resolution / Audio channels | Auto / Auto | PlexUW only |
| *Advanced:* Advertise HEVC / AV1 | Auto from engine | PlexUW only |
| *Advanced:* Allow insecure connections | Never (Never / Local only) | PlexUW only |
| *Advanced:* Include IPv6 | off | PlexUW only |

**3. Player**

| Setting | Default | Source |
|---|---|---|
| Autoplay next episode (per profile) | on | PlexUW only |
| Countdown | 10 s (5 / 10 / 15 / 30) | PlexUW only |
| "Still watching?" after | 3 episodes (2 / 3 / 5 / never) | PlexUW only |
| Resume | Ask (Ask / Always resume / Always start over) | PlexUW only |
| Skip intro | Show button | PlexUW only |
| Skip recap | Show button | PlexUW only |
| Skip credits | Show button (also shows the Up Next card) | PlexUW only |
| Skip ads | Do nothing | PlexUW only |
| Markers available | — ("No markers on this server" when there are none) | From your server |
| Watched threshold / completion rule | e.g. 90% or first credits marker | From your server |
| Seek back / forward | 10 s / 30 s | PlexUW only |
| *Advanced:* **Use hardware decoding** | Auto (Auto / On / Off) | PlexUW only |
| *Advanced:* Video playback quality (scaler profile) | Default | PlexUW only |
| *Advanced:* Refresh-rate switching + delay | off; 2 s | PlexUW only |

The hardware-decoding row exists on both engines. Under `<video>` it maps to the WebView2 GPU flag and needs a restart; under libmpv it maps to `hwdec`. Scaler and refresh-rate rows are libmpv-only and are hidden under `<video>`.

**4. Audio & Subtitles**

| Setting | Default | Source |
|---|---|---|
| Preferred audio language | account value | From your Plex account |
| Subtitle mode (Off / Foreign audio only / Always / Forced only) | account value, falling back to Foreign audio only | From your Plex account |
| Preferred subtitle language | account value | From your Plex account |
| Remember track choices per series | on | PlexUW only |
| Play the file's default audio regardless of language | off | PlexUW only |
| Subtitle size / colour / background / edge | M / white / none / drop shadow | PlexUW only |
| Subtitle position | 10% from bottom, inside the picture | PlexUW only |
| Auto-sync subtitles | on when available | PlexUW only (needs server data) |
| Burn-in (`<video>` only) | Auto | PlexUW only |
| Normalise / A/V offset | on / 0 ms | PlexUW only |
| Audio device, passthrough, exclusive mode | system / off / off | PlexUW only, libmpv only (hidden under `<video>`) |

Footnote shown under `<video>`: "More audio options are available with the advanced player."

**5. Ultrawide** *(user choices only; layout constants live in the design spec)*
- Default aspect mode: Auto
- Smart-crop bias: 0
- Panels: Auto (Auto / Always overlay / Always shift video)
- Allow both panels open on wide screens: on
- Keep subtitles inside the picture: on

**6. Library & Home**
- Row order and visibility: CW, Next Up, Next Up·TV, Recently Added
- Pinned libraries and collections in the sidebar: all
- Sidebar collapsed: off (migrates `plexuw.navc`)
- Hide watched in Recently Added: on
- Show missing episodes: off
- Show specials in seasons: off

**7. Appearance & Window** *(merges Appearance + Window)*
- Theme: Dark
- Accent: Plex amber
- UI scale: Auto (90–150%)
- Reduce motion: follow system
- Blur materials: on
- Ambient backdrop tint: on
- Backdrops on details: on
- Theme music on details: off
- Hover previews: off
- Splash: on
- On launch: Restore last (Restore last / Windowed / Fullscreen)
- Preferred monitor: last used, falling back to primary
- Go fullscreen when playback starts: off
- Exit fullscreen on stop: on
- Keep display awake while playing: on

**8. Keys & Voice**
- Global media keys when unfocused: on
- Shortcut sheet: read-only
- Voice mode: Pause (Pause / Lower volume / Do nothing)
- AI provider, model, base URL
- **AI API key: stored in the keychain**
- Note: AI is mock, and Test makes no request.

**9. Privacy & Advanced**
- "PlexUW sends no telemetry"
- Logging level: info, always redacted
- Open logs folder
- Diagnostics overlay: off
- Client identifier, with Regenerate (signs out)
- Reset hints
- Reset app (wipes the keychain and config)
- About / licences

## 3. Settings UI sketch (matches APPLE-POLISH-SPEC-v1)
```
┌ Settings ───────────────────────────────────────────────────────────────┐
│ ⌕ Search settings    │  Player                                          │
│ ● General & Account  │  ┌───────────────────────────────────────────┐   │
│   Server & Streaming │  │ Autoplay next episode            [● on ]  │   │
│   Player             │  │ Countdown         [ 5 | 10 | 15 | 30 ]    │   │
│   Audio & Subtitles  │  └───────────────────────────────────────────┘   │
│   Ultrawide          │  Skip                                            │
│   Library & Home     │  ┌ Intro   [Show button|Skip automatically|Do nothing]
│   Appearance & Window│  │ Credits [Show button|Skip automatically|Do nothing]
│   Keys & Voice       │  └ ⓘ From your server: markers available       ┘   │
│   Privacy & Advanced │            ┌ live preview: 16:9 thumb + skip pill ┐ │
└───────────────────────────────────────────────────────────────────────────┘
```
**Layout:** a 240 px left category list with search; content max-width 720 px (layout constants come from the spec, not from settings).

**Grouped inset lists:**
- 12 px radius, chrome material, 1 px hairline, 44 px rows, 16 px padding, 4 px grid.
- Section captions are 12 px uppercase muted, and footnotes sit under each group.

**Controls:**
- iOS-style toggles
- segmented controls for 2–5 choices
- menus (select) for longer lists
- sliders with a value label (A/V offset, UI scale, bias)

**Server-read rows:** grey value + "Managed by server" + an "Open in Plex Web" link. That link opens the external browser; it is not shown when not signed in.

**Live preview:**
- Subtitles: a sample frame showing the chosen style.
- Ultrawide: a mini 32:9 frame showing the aspect mode and panel behaviour.
- Appearance: accent and UI scale applied immediately.

**Behaviour:**
- Changes apply instantly (no Save button); a toast offers *Undo*.
- Focus ring per M4. Keyboard: ↑/↓ moves between rows, ←/→ changes segmented controls.
- Reduced-motion respected.
- Ctrl-K palette entries deep-link into settings (`#settings/playback/autoplay`).

**Size behaviour:**
- At 1366 the category list becomes an icon rail.
- At 5120 the content stays 720 px and the preview pane docks to the right.

## 4. Storage
| Data | Where | Format |
|---|---|---|
| Non-secret settings | `<app_config_dir>/settings.json` (Windows `%APPDATA%\app.plexuw.desktop\`) via a Rust `settings_get/settings_set` command | versioned JSON `{ "v":1, "playback":{…}, … }`, schema-validated in Rust, unknown keys dropped, atomic write (tmp+rename) |
| Window state | `window-state.json` (exists) | unchanged |
| Per-profile values (autoplay etc.) | inside settings.json under `profiles.<plexUserId>` | — |
| Secrets (Plex tokens, AI keys) | OS keychain only (`keyring`) | never in JSON or localStorage |
| Account-owned prefs | plex.tv (read; optional write-back) | cached in memory only |
| Runtime (streak, hints) | sessionStorage, or settings.json `hints` | — |

**Migration:** on first desktop run, import the `plexuw.*` localStorage keys into settings.json. The AI key migration (Sentinel M7) runs in this order:
1. Write the key to keychain entry `PlexUW/<clientId>/ai/<provider>`.
2. Read it back and compare.
3. Only then `removeItem` it and overwrite it in localStorage.
4. Run WebView2 `ClearBrowsingData` (DOMStorage), or delete the old origin storage.

The AI key is used only in Rust; JS sees only set/not set. Reset and `--wipe-secrets` remove every `PlexUW/*` keychain entry, enumerated by prefix (including entries under older clientIds).

**Web/demo build (Sentinel L5):** it keeps a localStorage adapter, and it can never accept a real AI key. The key field is hidden or clearly labelled "mock".

## 5. Milestones
| # | Scope | Effort |
|---|---|---|
| S1 | Settings store (Rust, schema, migration, keychain move of AI key) + JS adapter | 2 d |
| S2 | Settings shell UI: sidebar, search, inset lists, toggle/segmented/slider components, deep links | 3 d |
| S3 | Wire existing options (autoplay, countdown, still-watching, voice, AI, sidebar, window, media keys) | 2 d |
| S4 | Playback/Skip/Ultrawide/Appearance options + live previews | 3–4 d |
| S5 | Server/Quality/Audio & Subs (depend on PLAN-REAL-PLEX M1/M4) incl. server-read rows | 3 d |
| S6 | Privacy/Advanced (reset, logs, client id), QA at 1366/1920/3440/5120 | 1–2 d |

## 6. Risks
- **Scope creep:** 37 Required rows, plus 44 Useful ones that are tempting. Hold the line on Skip.
- **Settings that depend on the engine:** passthrough, exclusive audio and the HW decoding options only work on libmpv. Hide them, rather than disable them, under `<video>`.
- **Server-read values** need owner permissions (`/:/prefs`). Shared users only see a subset, so show "Unknown" gracefully.
- **Two sources of truth** (account vs local) for language prefs could confuse users. Show clearly which one is in effect.
- **Live preview cost on 5120:** keep previews CSS-only.

## 7. Questions for Scott
1. Skip default: **button** (as in the spec), or auto-skip intros?
2. Remote quality default: 8 Mbps 1080p, or something else for your upload?
3. Should language/subtitle prefs follow your Plex account (shared with other Plex apps) or stay PlexUW-only?
4. Close button: quit, or minimize to tray?
5. Is a Light theme wanted at all?
6. Do the AI settings stay visible (mock) in the real-Plex build, or hide behind a flag?


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
