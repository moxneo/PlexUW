# LINUX_READY_SMOKE_HANDOFF — fu9j real Play via direct-or-universal HLS

**Status:** LINUX_READY_SMOKE_HANDOFF (not READY — Foreman LIVE smoke next)
**Time:** 2026-10-24 ~10:00 PM America/New_York
**Worktree:** `/workspace/plexuw-fu7i` (detached local tip; no push/merge/main/Win)

## Tip
| | |
|---|---|
| Full SHA | `56c5cdbe4b8994bfa6d9fdad028bf4236af89e40` |
| Short | `56c5cdb` |
| Parent | `887b9e2a915197eef6d698d428a288b1e2a4afd6` (fu9i; must stay) |
| Subject | `tip(fu9j): real Play via direct-or-universal HLS` |
| Abandoned tip | `f887f41` **not** on ancestry |

## Binding constraints
- **KEEP MUST1** Music-gone (unchanged this tip)
- **KEEP MUST2** cast hover (unchanged this tip)
- **MUST3 only:** no silent `sample.mp4` leave-in; surface `play_start`/decode errors on chrome; harden versionId→item fallback; Play on MoxBox library title must show real media advancing
- Prefer native-playable Part first; thin PMS transcoder/universal **only** when needed (HEVC/MKV in WebView)
- OOS parked (home flash, CW reorder, Versions shift, Escape modal+nav) — **not** fixed
- READY gate is Foreman’s LIVE later

## MUST3 Play approach
1. **Direct (preferred):** if container ∈ {mp4,m4v,mov,webm} AND videoCodec ∈ {h264,avc,avc1,vp8,vp9,av1} (+ safe audio) → opaque `plexuw://…/media/<32hex>` Part stream (Range/206).
2. **Else HLS:** register `/video/:/transcode/universal/start.m3u8?<allowlisted query>` → opaque `plexuw://…/hls/<32hex>`; proxy rewrites every playlist URI to a **relative** opaque id (no host, no `X-Plex-Token`); JS uses locally bundled `hls.js` light (`enableWorker:false`, no CDN).
3. **Errors:** on `play_start` fail / fatal HLS / `<video error>` → clear src (no sample leave-in), toast + `#pxPlayErr` banner “Could not start playback”.
4. **versionId:** resolve miss → fall back to item id (media 0), do not hard-fail Play.
5. Security: egress `universal_path_ok` + start/session query allowlists (tokens header-only); `media_map_path_ok`; map clear on stop/sign-out.

## Files
- `desktop/src-tauri/src/commands.rs` — PlayStart `{id,kind,durationMs?}`, `proxy_hls`, version fallback
- `desktop/src-tauri/src/plex/egress.rs` — universal allowlists + tests
- `desktop/src-tauri/src/plex/proxy.rs` — m3u8 rewrite / media types
- `desktop/src-tauri/src/plex/fixture.rs` — HEVC movie idx 5 + decision/start/session mock
- `desktop/shim/desktop.js` — bindRealPlay direct|hls + error chrome; `import Hls from 'hls.js/dist/hls.light.min.js'`
- `desktop/shim/desktop.css` — `.px-play-err`
- `desktop/shim/test/fu9i-music-cast-play.test.mjs` — fu9j MUST3 asserts
- `desktop/package.json` (+ lock) — `hls.js@^1.5.18` dependency

## Dist / About
- Dist SHA-256 (build.rs): `a5ded2153bc0ad5bdab4a673b1512d1ce3f45be93b2701b4f8294aa1f483f11d`
- About Frontend prefix: `a5ded2153bc0ad5b`
- About Build short-12: `56c5cdbe4b89`

## Artifacts `/home/box/plexuw-artifacts/56c5cdb/`
| File | sha256 |
|---|---|
| plexuw | `9cd35b3422041fb264ee9f538b5f83b9e6a401d453253625edb7d3453670a239` |
| PlexUW_0.1.0_amd64.deb | `64696dd0150d720a4cd95043009ae37a3c0582bcf21e6fdbb98d75e80e9a70ab` |
| PlexUW_0.1.0_amd64.AppImage | `e228a8371da0db3f0d5030645a77584362fcd9314ef17011e6d7139c5701f007` |

**AppImage:** `/home/box/plexuw-artifacts/56c5cdb/PlexUW_0.1.0_amd64.AppImage`

## Gates
- PLEXUW_MOCK unset Linux RELEASE **PASS**
- Gate-B MOCK = **0** (bin + AppImage + deb) — `shot_id|__plexShot|__PLEXUW_MOCK__|mockplex`
- JS tests fu9i+fu9j (+fu9g KEEP) **PASS**
- Rust `cargo test --features mockplex --lib` **109 PASS**
- KEEP MUST1/MUST2 verified by fu9i tests still green

## LIVE smoke = Foreman (READY gate)
1. KEEP: no Music rail / Settings Music
2. KEEP: Credits hover on cast chips
3. **MUST3:** Play a real MoxBox library title → real media advancing in chrome (not `00:00:00/00:00:10` stub, not Escape→Neon Meridian demo). HEVC/MKV titles should take HLS path; h264/mp4 direct.

## Notes
- Win HELD. No push/merge/main/reset --hard.
- OOS parked items untouched.
