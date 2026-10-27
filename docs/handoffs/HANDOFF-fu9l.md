# LINUX_READY_SMOKE_HANDOFF — fu9l HTPC-ref force-transcode + Escape returnHash + real duration

**Status:** LINUX_READY_SMOKE_HANDOFF (not READY — Foreman LIVE smoke next)
**Time:** 2026-10-24 ~10:30 PM America/New_York
**Worktree:** `/workspace/plexuw-fu7i` (detached local tip; no push/merge/main/Win)

## Tip
| | |
|---|---|
| Full SHA | `28cb8e156fbc8310651d66b7ff01284b4ef56a69` |
| Short | `28cb8e1` |
| Parent | `93cdcf03a435cb300d9caa81d13fa056df064501` (fu9k; required) |
| Subject | `tip(fu9l): HTPC-ref force-transcode HLS + Escape returnHash + real duration` |
| Abandoned tip | `f887f41` **not** on ancestry |

## Binding (Master GO + HTPC addendum)
1. **MUST3 force-transcode:** Non-native Linux WebView (HEVC/MKV) → universal HLS with `directPlay=0&directStream=0` + shared `session` on `/decision` then `start.m3u8` (Plex HTPC baseline). Keep `opaque_get` / `PlexuwHlsLoader`.
2. **MUST3 duration chrome:** Real title duration (PMS `durationMs` / `__pxPlayDur`); never sample 10s stub. `clearVid()` before `play_start` on plex path.
3. **MUST3 Escape/back:** HTPC-like exit → `goBackFromPlayer` → `returnHash` `#px/…`; parked same-hash reveal (no blank stuck); never Neon `#player/0`.
4. **KEEP MUST1** Music-gone + **KEEP MUST2** cast hover.
5. OOS parked. Prefer LIVE HEVC success path. No push/merge/main/Win. Win HELD. No LIVE GUI this tip (Foreman).

## RCA → fix (fu9k LIVE FAIL → fu9l)
| | Verdict | Evidence |
|---|---|---|
| **HEVC HLS fail** (`directStream=1`) | **FIXED** | `build_hls_universal_query` forces `directStream=0`; `build_hls_pair` one session for `/decision` + `start.m3u8`; `play_start_inner` fires decision then stores start. |
| **Sample 10s chrome** | **FIXED** | `mediaDur()` plex-first (`px.durationMs` / `__pxPlayDur`); never `vid.duration` when `plexId`. `clearVid()` before `play_start`. Chrome `--:--:--` until real ms. |
| **Escape blank / Neon** | **FIXED** | `goBackFromPlayer` → `#px/` returnHash; `#bX` + Escape wired. `plex-browse` parked same-hash short-circuit reveals nodes (no blank rebuild). Never `#player/0`. |
| **opaque_get loader** | **KEPT** | Unchanged invoke loader path from fu9k. |

## Files
- `desktop/src-tauri/src/commands.rs` — `build_hls_universal_query` / `build_hls_pair` / decision-then-start; `fu9l_hls_start_force_transcode_direct_stream_0`
- `desktop/src-tauri/src/plex/egress.rs` — allowlist test covers `directStream=0` + session/bitrate/resolution (+ legacy `directStream=1` still allowed)
- `app.js` — plex-first `mediaDur`; hardened `goBackFromPlayer`; `#bX`/Escape → goBack
- `desktop/shim/desktop.js` — `clearVid` before `play_start`; status-class `showErr`; strip sample on plex path
- `desktop/shim/plex-browse.js` — parked same-hash Escape reveal
- `desktop/shim/test/fu9l-force-transcode-escape.test.mjs` — MUST3 + KEEP

## Dist / About
- Dist SHA-256 (build.rs / files): `d2ea1c80105441b50b7de4051b39cf54267ac451a92a94824152a091c8eb5429`
- About Frontend prefix: `d2ea1c80105441b5`
- About Build short-12: `28cb8e156fbc`

## Artifacts `/home/box/plexuw-artifacts/28cb8e1/`
| File | sha256 |
|---|---|
| plexuw | `7651dfdff0c38b3d0fcb8b61bcd7f0c1684624a57511f610494e5decbe8951d5` |
| PlexUW_0.1.0_amd64.deb | `dab84c509f31380e72675f807f2aa69797888b4c0e41690ce813cb324e9173fc` |
| PlexUW_0.1.0_amd64.AppImage | `5d9ac91a7a249c6960a43341b15bf650570d07b505832a5990f2e3dae29205aa` |

**AppImage:** `/home/box/plexuw-artifacts/28cb8e1/PlexUW_0.1.0_amd64.AppImage`  
Also mirrored under `/workspace/dist-fu9l-out/`. Build log: `/workspace/perf-fu9l/build-linux-release.log`.

## Gates
- PLEXUW_MOCK unset/`false` Linux RELEASE **PASS**
- Gate-B MOCK = **0** (bin + AppImage + deb) — `shot_id|__plexShot|__PLEXUW_MOCK__|mockplex`
- JS tests fu9g + fu9i + fu9k + fu9l **19/19 PASS**
- Rust `cargo test --features mockplex --lib` **111 PASS** (includes `fu9l_hls_start_force_transcode_direct_stream_0`, `fu9k_opaque_get_hls_playlist`, `fu9j_play_start_hls_rewrite_and_version_fallback`)
- Sidecar SHA matches AppDir bin
- Parent = `93cdcf0`; `f887f41` not on ancestry
- KEEP MUST1/MUST2 still green

## LIVE smoke = Foreman (READY gate)
1. KEEP: no Music rail / Settings Music
2. KEEP: Credits hover on cast chips (`scale(1.12)`)
3. **MUST3 HEVC/MKV:** Play real MoxBox HEVC → force-transcode HLS (`directStream=0`) → advancing media; chrome shows real title duration (not `00:00:10`); Escape/back returns via `returnHash` to library/details (no blank, no Neon `#player/0`). Failed start → status-class error, no sample stub.

## Gaps / notes
- No full LIVE GUI this tip (Foreman does LIVE → READY).
- Win HELD. No push/merge/main/reset --hard.
- Productive warning: `build_hls_start_stored` unused in non-mock release (test-only helper); `proxy_request` pre-existing dead_code.
- HTPC refs consulted: `/workspace/plexuw-research/htpc-ref/` + PLAN-REAL-PLEX notes (force transcode when engine cannot remux HEVC).
- OOS parked untouched.

## Report line
`LINUX_READY_SMOKE_HANDOFF tip=28cb8e1 parent=93cdcf0 force-transcode=directStream=0+decision session Escape=returnHash mediaDur=plex-first About=28cb8e156fbc/d2ea1c80105441b5 Gate-B=0 AppImage=/home/box/plexuw-artifacts/28cb8e1/PlexUW_0.1.0_amd64.AppImage`
