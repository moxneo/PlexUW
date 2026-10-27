# Settings research: Plex + Jellyfin → PlexUW (2026-10-22)

**Sources** (official docs, fetched 2026-10-22):
- Plex server: support.plex.tv articles *Transcoder* (200250347), *Library* (200289526), *Remote Access* (200289506), *Languages* (200250357)
- Plex client: support.plex.tv *HTPC – Settings*, *Auto-Sync Subtitles*, Plex for Windows/Mac/Linux "Configuration and Usage Options"
- Jellyfin: jellyfin.org/docs *Transcoding*, *Codec Support*, *Web Configuration (config.json)*. User-settings rows (Playback/Subtitles/Display/Home) are taken from Jellyfin Web's settings screens because the docs list them only partly. Those rows are marked †.

**Scope:** none of Scott's servers were accessed, and no tokens were used.

**Verdict:**
- **Required**: PlexUW must have this for milestone "real Plex".
- **Useful**: should come later.
- **Skip**: out of scope (admin-only, a feature we don't have, or the server's job).

**Ownership:**
- *Client*: PlexUW stores the setting itself.
- *Server-read*: PlexUW reads the setting from PMS or plex.tv and shows it read-only (or links to Plex Web).
- *Account*: lives on the plex.tv account; PlexUW reads it and may write it back.

| Product | Scope | Setting | What it does | Verdict | PlexUW section | PlexUW default | Owner |
|---|---|---|---|---|---|---|---|
| Plex | Server › Transcoder | Transcoder quality (Auto/speed/quality/CPU hurt) | x264 effort for transcodes | Skip | Server (info) | — | Server-read |
| Plex | Server › Transcoder | Use hardware acceleration | HW decode/encode on PMS (Pass) | Useful | Server (info) | — | Server-read |
| Plex | Server › Transcoder | Max simultaneous video transcodes | Cap on concurrent transcodes | Useful | Server (info) | — | Server-read |
| Plex | Server › Transcoder | Transcoder temp dir | Scratch location | Skip | — | — | Server |
| Plex | Server › Transcoder | Downloads temp dir | Downloads scratch | Skip | — | — | Server |
| Plex | Server › Transcoder | Throttle buffer | Seconds buffered before throttling | Skip | — | — | Server |
| Plex | Server › Transcoder | Background x264 preset | Optimizer/Downloads preset | Skip | — | — | Server |
| Plex | Server › Transcoder | HDR tone mapping | Transcoded HDR→SDR not washed out | Required | Server (info) + Quality warning | — | Server-read |
| Plex | Server › Transcoder | Disable video stream transcoding | Video never transcodes; may fail playback | Required | Server (info) | — | Server-read (drives the decision UI) |
| Plex | Server › Transcoder | HW-accelerated encoding | HW encode as well as decode | Skip | — | — | Server |
| Plex | Server › Transcoder | Hardware transcoding device | Choose GPU | Skip | — | — | Server |
| Plex | Server › Transcoder | HEVC encoding (exp.) | Transcode to HEVC when the client supports it | Useful | Quality (advertise HEVC) | advertise if engine supports | Server + client profile |
| Plex | Server › Transcoder | HEVC optimization | HEVC for Optimizer | Skip | — | — | Server |
| Plex | Server › Remote Access | Enable remote access / manual port | Reachability outside the LAN | Required | Server (status) | — | Server-read (via plex.tv resources) |
| Plex | Server › Remote Access | Internet upload speed | Total upload budget | Useful | Server (info) | — | Server-read |
| Plex | Server › Remote Access | Limit remote stream bitrate | Per-stream remote cap | Required | Quality (show cap) | — | Server-read; clamps the client remote quality |
| Plex | Server › Library | Scan automatically / periodically / interval | Library refresh | Skip | — | — | Server |
| Plex | Server › Library | Empty trash after scan | Remove deleted items | Skip | — | — | Server |
| Plex | Server › Library | Video preview thumbnails (BIF) | Scrub thumbnails | Required | Player (use if present) | on if available | Server-read |
| Plex | Server › Library | Generate intro markers | Feeds Skip Intro | Required | Player › Skip | — | Server-read (markers per item) |
| Plex | Server › Library | Generate credits markers | Feeds Skip Credits / autoplay trigger | Required | Player › Skip | — | Server-read |
| Plex | Server › Library | Generate ad markers | DVR commercial skip | Skip | — | — | Server |
| Plex | Server › Library | Voice activity data | Enables subtitle auto-sync | Useful | Subtitles | — | Server-read |
| Plex | Server › Library | Chapter thumbnails | Chapter images | Required | Player › Chapters panel | — | Server-read |
| Plex | Server › Library | Loudness analysis | Enables leveling / smart transitions | Useful | Audio (music) | — | Server-read |
| Plex | Server › Library | Sonic analysis | Sonically similar, mixes | Skip | — | — | Server |
| Plex | Server › Library | Location visibility | Photo geodata visibility | Skip | — | — | Server |
| Plex | Server › Library | Partial scan | Scan only the changed folder | Skip | — | — | Server |
| Plex | Server › Library | Allow media deletion | Owner can delete files from apps | Skip (never offer delete in M1) | — | — | Server |
| Plex | Server › Library | Weeks for Continue Watching | CW window | Useful | Home (info) | — | Server-read (hub results) |
| Plex | Server › Library | Max Continue Watching items | CW size | Useful | Home | — | Server-read |
| Plex | Server › Library | Season premieres in CW | Show new season E1 | Useful | Home | — | Server-read |
| Plex | Server › Library | Video played threshold (90%) | When an item becomes "watched" | Required | Playback (info) | — | Server-read (server decides from the timeline) |
| Plex | Server › Library | Play completion behavior (threshold/credits marker) | Watched via credits marker | Required | Playback (info) | — | Server-read |
| Plex | Server › Library | Smart shuffle | Weighted shuffle | Skip | — | — | Server |
| Plex | Server › Library | Group albums by type | EP/Single grouping | Useful | Music | — | Server-read |
| Plex | Server › Library | Marker source (online/local) | Where markers come from | Skip | — | — | Server |
| Plex | Server › Library | DB cache size | Perf | Skip | — | — | Server |
| Plex | Server › Languages / Account | Preferred audio language | Default audio track pick | Required | Audio & Subtitles | account value | Account (read; optional write) |
| Plex | Server › Languages / Account | Auto-select subtitle mode (manual / shown with foreign audio / always) | Default subtitle behaviour | Required | Audio & Subtitles | account value | Account |
| Plex | Server › Languages / Account | Preferred subtitle language | Default subtitle track | Required | Audio & Subtitles | account value | Account |
| Plex | Server › Languages / Account | Include SDH / forced only | Track preference filters | Useful | Audio & Subtitles | account value | Account |
| Plex | Client › HTPC/Desktop Audio | Normalize | Avoid clipping when downmixing | Useful | Audio | on | Client |
| Plex | Client › HTPC/Desktop Audio | Exclusive audio | Bypass the OS mixer (WASAPI exclusive) | Useful (libmpv only) | Audio | off | Client |
| Plex | Client › HTPC/Desktop Audio | Audio device | Output device | Useful (libmpv only) | Audio | system default | Client |
| Plex | Client › HTPC Audio | Passthrough (AC3/DTS/TrueHD/E-AC3) | Bitstream to an AVR | Useful (libmpv only) | Audio | off | Client |
| Plex | Client › HTPC Audio | Fixed audio offset | A/V sync offset | Useful | Audio | 0 ms | Client |
| Plex | Client › HTPC Video | Quality suggestions | Auto up/downgrade prompts | Useful | Server & Streaming | on | Client |
| Plex | Client › HTPC/Desktop Video | Local quality | Quality on the LAN | Required | Server & Streaming | Original | Client |
| Plex | Client › HTPC/Desktop Video | Maximum remote quality | Quality off the LAN | Required | Server & Streaming | 8 Mbps 1080p (clamped by server cap) | Client |
| Plex | Client › HTPC/Desktop | Allow Direct Play | Permit untouched file | Required | Quality › Advanced | on | Client |
| Plex | Client › HTPC/Desktop | Allow Direct Stream | Permit remux/audio-only transcode | Required | Quality › Advanced | on | Client |
| Plex | Client › HTPC | Force Direct Play | Never ask for a transcode | Useful | Quality › Advanced | off | Client |
| Plex | Client › HTPC/Desktop | Use hardware decoding | GPU decode | Required (both engines; libmpv `hwdec`, WebView2 GPU flag under `<video>`) | Player › Advanced | Auto | Client |
| Plex | Client › HTPC | Zoom | Fit/zoom modes | Required (PlexUW: aspect modes) | Ultrawide | Auto | Client |
| Plex | Client › HTPC | Refresh rate switching + delay | Match display Hz | Useful | Player | off; delay 2 s | Client |
| Plex | Client › HTPC/Desktop | Video playback quality (image processing) | mpv scaler profile | Useful (libmpv) | Player › Advanced | default | Client |
| Plex | Client › Web/Desktop | Play smaller videos at original quality | Avoid upscaled transcodes | Useful | Server & Streaming | on | Client |
| Plex | Client › HTPC/Desktop | Subtitle size / color / position / background | Text subtitle styling | Required | Audio & Subtitles | medium, white, bottom, none | Client |
| Plex | Client › Web/players | Auto-sync subtitles | Shift via voice activity (Pass) | Useful | Audio & Subtitles | on if available | Client toggle + server data |
| Plex | Client › HTPC | Streaming services | Which streaming services Plex should show content availability for | Skip | — | — | — |
| Plex | Client › HTPC | Manual servers (IP:port) | Connect without plex.tv discovery | Useful | Server & Streaming | none | Client |
| Plex | Client › HTPC | Allow insecure connections | Permit http:// to PMS | Required | Server › Advanced | Never (local-only option later) | Client |
| Plex | Client › HTPC | Prefer insecure connections | Prefer http under some conditions | Skip | — | — | — |
| Plex | Client › HTPC | Include IPv6 connections | Try IPv6 URIs | Useful | Server › Advanced | off | Client |
| Plex | Client › HTPC | Console log overlay | Playback debug overlay | Useful | Advanced (Diagnostics) | off | Client |
| Plex | Client › HTPC | Log to Media Server | Ship app logs to PMS | Skip | — | — | — |
| Plex | Client › HTPC | Logging level | Log verbosity | Useful | Advanced | info (redacted) | Client |
| Plex | Client › HTPC | UI resolution | Render scale | Useful (PlexUW: UI scale) | Appearance & Window | Auto | Client |
| Plex | Client › HTPC | Reset app | Default everything + sign out | Required | Advanced | — | Client |
| Plex | Client › Web/players | Autoplay next episode / countdown | Post-play behaviour | Required | Player | on, 10 s | Client (per profile) |
| Plex | Client › Web/players | Skip intro / credits automatically | Auto-skip vs button | Required | Player › Skip | button (no auto) | Client |
| Plex | Client › Web/players | Theme music | Play the show theme on the details page | Useful | Player | off | Client |
| Plex | Client › Web | Home screen / pinned libraries / hubs | Choose and order the home rows and sidebar libraries | Required | Library & Home | all libs, default order | Client (Plex also syncs these per account) |
| Plex | Client › players | Step back / step forward | Seek increments | Required | Keys & Remote | 10 s / 30 s | Client |
| Plex | Client › Web | Burn subtitles (auto/always/never) | Force subtitle burn-in | Useful | Audio & Subtitles › Advanced | auto | Client |
| Plex | Account | Plex Home user / PIN switch | Multi-profile | Useful | General & Account | — | Account |
| Plex | Account | Sign out (this device) + Sign out all devices | Session control | Required (both rows in plan) | General & Account | — | Account |
| Plex | Account | Privacy / playback data sharing | Telemetry opt-outs on plex.tv | Skip (PlexUW sends no telemetry) | Privacy (note) | — | Account |
| Jellyfin | Server › Dashboard Playback | Hardware acceleration (QSV/NVENC/VAAPI/AMF/VT/RKMPP) | HW transcode | Skip | — | — | Server |
| Jellyfin | Server › Playback | Thread count | Transcode threads | Skip | — | — | Server |
| Jellyfin | Server › Playback | Tone mapping (HDR→SDR) | Same as Plex | Skip (Plex only) | — | — | Server |
| Jellyfin | Server › Playback | Allow/limit transcoding per user (policy) | User can transcode / remux | Skip | — | — | Server |
| Jellyfin | Server › Users | Internet streaming bitrate limit | Per-user remote cap | Skip (= Plex remote cap) | — | — | Server |
| Jellyfin | Server › Networking | Remote access / known proxies / LAN networks | LAN vs WAN classification | Skip | — | — | Server |
| Jellyfin | Server › Libraries | Intro/credit segments (Media Segments, 10.10+) | Feeds Skip Intro | Skip (Plex markers instead) | — | — | Server |
| Jellyfin | Server › Libraries | Chapter image extraction / trickplay | Chapter + scrub images | Skip (Plex equivalents above) | — | — | Server |
| Jellyfin | Web config.json | menuLinks | Custom sidebar links | Skip | — | — | — |
| Jellyfin | Web config.json | Chromecast / YouTube trailer plugins | Remote Google / YouTube loads | Skip (both break offline/CSP) | — | — | — |
| Jellyfin | Client › Playback † | Max streaming bitrate (home / internet) | Split LAN / WAN quality | Required (same as Plex local/remote) | Server & Streaming | Original / 8 Mbps | Client |
| Jellyfin | Client › Playback † | Max allowed video resolution / audio channels | Client caps | Useful | Quality › Advanced | Auto / Auto | Client |
| Jellyfin | Client › Playback † | Prefer fMP4-HLS / codec preferences (HEVC, AV1) | Capabilities advertised | Useful | Quality › Advanced | auto from engine | Client |
| Jellyfin | Client › Playback † | Play next episode automatically | Autoplay | Required (exists) | Player | on | Client |
| Jellyfin | Client › Playback † | Remember audio / subtitle selections from previous item | Sticky track choice per series | Required | Audio & Subtitles | on | Client |
| Jellyfin | Client › Playback † | Play default audio track regardless of language | Honour the file's default flag | Useful | Audio & Subtitles | off | Client |
| Jellyfin | Client › Playback † | Skip forward / back length | Seek steps | Required (= Plex row) | Keys & Remote | 30 / 10 s | Client |
| Jellyfin | Client › Playback † | Enable cinema mode / intros (trailers before film) | Pre-roll | Skip | — | — | — |
| Jellyfin | Client › Playback † | Media segment actions (Skip / Ask / None per type: intro, recap, preview, credits) | Per-segment behaviour | Required (better than an on/off toggle) | Player › Skip | Intro: Show button; Recap: Show button; Credits: Show button → Up Next (Jellyfin "Ask" = Show button) | Client |
| Jellyfin | Client › Playback † | Enable next-video info overlay / "Still watching" | Post-play UI | Required | Player | on, after 3 eps | Client |
| Jellyfin | Client › Subtitles † | Subtitle mode (Default/Smart/Always/Only forced/None) | Selection policy | Required (merge with the Plex auto-select row) | Audio & Subtitles | Smart (foreign audio only) | Client (seed from account) |
| Jellyfin | Client › Subtitles † | Burn-in (auto/all complex/all) | When to burn | Useful | Audio & Subtitles › Advanced | auto | Client |
| Jellyfin | Client › Subtitles † | Text size / weight / font / color / drop shadow / vertical position | Styling + live preview | Required | Audio & Subtitles | medium, normal, system, white, drop shadow, 10% | Client |
| Jellyfin | Client › Subtitles † | Experimental PGS rendering | Client-side image subs | Useful (libmpv does natively) | — | on | Client |
| Jellyfin | Client › Display † | Theme / dashboard theme | Colour theme | Useful | Appearance & Window | Dark | Client |
| Jellyfin | Client › Display † | Screensaver + timeout | Idle screensaver | Useful | Appearance & Window | off | Client |
| Jellyfin | Client › Display † | Backdrops / theme songs / theme videos | Ambient media on details | Useful | Appearance & Window | backdrops on; songs off | Client |
| Jellyfin | Client › Display † | Display language / date format | i18n | Useful | Appearance & Window | system | Client |
| Jellyfin | Client › Display † | Library page size, fast fade-in, blurhash | Grid perf | Useful | Appearance › Advanced | 100, on, on | Client |
| Jellyfin | Client › Display † | Display missing episodes / specials in seasons | Library content | Useful | Library | off | Client |
| Jellyfin | Client › Home † | Home sections order (Continue, Next Up, Latest…) | Home rows | Required | Library & Home | CW, Next Up, Next Up·TV, Recently Added | Client |
| Jellyfin | Client › Home † | Hide watched from Latest / Next Up max age / rewatching in Next Up | Row filtering | Useful | Library & Home | hide watched; 365 d; off | Client |
| Jellyfin | Client › Controls † | Enable gamepad / TV remote nav / swipe gestures | Input modes | Useful | Keys & Remote | auto | Client |
| Jellyfin | Client › Quick Connect | Code login | Device-code sign-in | Skip (Plex PIN flow is the equivalent) | — | — | — |
| Jellyfin | Client › Desktop (JMP) | Fullscreen on start / window state / layout TV vs desktop | Shell behaviour | Required (exists in PlexUW) | Appearance & Window | restore last; desktop layout | Client |
| Jellyfin | Client › Desktop (JMP) | mpv.conf passthrough / audio device | Engine tuning | Useful (libmpv) | Advanced | none | Client |
