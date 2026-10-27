# LINUX_READY_SMOKE_HANDOFF — fu9m play_start m3u8 preflight + Escape always-leave + no 10s stub

**Status:** LINUX_READY_SMOKE_HANDOFF (not READY — Foreman LIVE smoke next)
**Time:** 2026-10-24 ~10:44 PM America/New_York
**Worktree:** `/workspace/plexuw-fu7i` (detached local tip; no push/merge/main/Win)

## Tip
| | |
|---|---|
| Full SHA | `07e369e4b9d38d898c2b34fd440299203b7400a9` |
| Short | `07e369e` |
| Parent | `28cb8e156fbc8310651d66b7ff01284b4ef56a69` (fu9l; required) |
| Subject | `tip(fu9m): play_start m3u8 preflight + Escape always-leave + no 10s stub` |
| Abandoned tip | `f887f41` **not** on ancestry |

## Binding (Master GO + HTPC player baseline)
1. **MUST3 preflight:** `play_start` must NOT return kind=hls until GET start.m3u8 is 200 + `looks_like_m3u8`; honor hard `/decision` failures; keep force-transcode `directPlay=0&directStream=0` + shared session + `videoQuality=100`; keep `opaque_get` / `PlexuwHlsLoader`.
2. **MUST3 duration chrome:** Remove hardcoded `return 10`; seed `durationMs` from item in `startTitlePlay`; plex hash/plexId → 0 / `--:--:--` until real ms; never sample.mp4 duration.
3. **MUST3 Escape/back:** On `#player/plex` / `pxPlayCtx.plexId`, Escape and `#bX`/`#back` ALWAYS `goBackFromPlayer` → `returnHash` `#px/…` — never hide-chrome `vis()` blank ambient blur. Parked same-hash reveal kept. Never Neon `#player/0`.
4. **KEEP MUST1** Music-gone + **KEEP MUST2** cast hover.
5. Toast/status class only e.g. `(502)` — no URLs/tokens. OOS parked. Win HELD. No LIVE GUI this tip (Foreman).

## RCA → fix (fu9l LIVE FAIL → fu9m)
| | Verdict | Evidence |
|---|---|---|
| **Play fake HLS success** (decision fire-and-forget → 502 later) | **FIXED** | `play_start_inner` awaits decision (hard fail → Err), then preflight GET start.m3u8; only then inserts opaque id + Ok kind=hls. Fixture rk 1007 → 502 covers fail path. |
| **Sample 10s chrome** | **FIXED** | `mediaDur` drops `return 10` (use 0); `#player/plex` or plexId never reads `vid.duration`; `startTitlePlay` seeds `durationMs` / `__pxPlayDur` from `it.durationMs`. |
| **Escape blank ambient blur** | **FIXED** | Escape on plex always `goBackFromPlayer()` before demo chrome-hide `vis()` branch; `#bX`/`#back` already wired; parked same-hash reveal kept. |
| **force-transcode + loader** | **KEPT** | `directStream=0` + shared session; added allowlisted `videoQuality=100`; opaque_get loader unchanged. |

## Files
- `desktop/src-tauri/src/commands.rs` — decision honor + start.m3u8 preflight; `videoQuality=100`; `fu9m_play_start_preflight_{success,fail}`
- `desktop/src-tauri/src/plex/fixture.rs` — HEVC rk 1007 start.m3u8 → 502
- `app.js` — Escape always-leave plex; mediaDur no-10 + `#player/plex` branch
- `desktop/shim/plex-browse.js` — seed `durationMs` in `startTitlePlay`
- `desktop/shim/desktop.js` — parse `(NNN)` status from play_start Err for toast
- `desktop/shim/test/fu9m-preflight-escape-duration.test.mjs` — MUST3 + KEEP

## Dist / About
- Dist SHA-256 (build.rs / files): `6b26c745c7eadc37935ea6d324a616ba25c12d439a82e7f0fbbb26ec6c2fd1cb`
- About Frontend prefix: `6b26c745c7eadc37`
- About Build short-12: `07e369e4b9d3`

## Artifacts `/home/box/plexuw-artifacts/07e369e/`
| File | sha256 |
|---|---|
| plexuw | `044ca34980d5c3b1a634ae6450b57c648ecc3d287bdba1f23a0dd41e5117efd7` |
| PlexUW_0.1.0_amd64.deb | `b786ef3a859f2f682bbdf2cfd2c13c9eb20c735e2574a33c4c63c2b7d78e7968` |
| PlexUW_0.1.0_amd64.AppImage | `c73a6c048230058f1990570b28f39b82b7563513c997d7cb4c8e6026a5bd9480` |

**AppImage:** `/home/box/plexuw-artifacts/07e369e/PlexUW_0.1.0_amd64.AppImage`  
Also mirrored under `/workspace/dist-fu9m-out/`. Build log: `/workspace/perf-fu9m/build-linux-release.log`.

## Gates
- PLEXUW_MOCK unset/`false` Linux RELEASE **PASS**
- Gate-B MOCK = **0** (bin + AppImage + deb) — `shot_id|__plexShot|__PLEXUW_MOCK__|mockplex`
- JS tests fu9g + fu9i + fu9k + fu9l + fu9m **24/24 PASS**
- Rust `cargo test --features mockplex --lib` **113 PASS** (includes `fu9m_play_start_preflight_success`, `fu9m_play_start_preflight_fail`)
- Sidecar SHA matches AppDir bin
- Parent = `28cb8e1`; `f887f41` not on ancestry
- KEEP MUST1/MUST2 still green

## LIVE smoke = Foreman (READY gate)
1. KEEP: no Music rail / Settings Music
2. KEEP: Credits hover on cast chips (`scale(1.12)`)
3. **MUST3 HEVC/MKV:** Play real MoxBox HEVC → preflighted force-transcode HLS → advancing media preferred; on failure status-class error e.g. `(502)` (no fake success), chrome shows real duration or `--:--:--` (never `00:00:10`); Escape/back always returns via `returnHash` to library/details with real sidebar/header (no blank ambient blur, no Neon `#player/0`).

## Gaps / notes
- No full LIVE GUI this tip (Foreman does LIVE → READY). Prefer LIVE advancing media on MoxBox HEVC; if PMS still 502s start.m3u8, UI must error + Escape-recover (A) with real duration chrome (B).
- Win HELD. No push/merge/main/reset --hard. No Cursor cloud.
- Productive warnings: `build_hls_start_stored` unused in non-mock release (test-only helper); `proxy_request` pre-existing dead_code.
- OOS parked untouched.

## Report line
`LINUX_READY_SMOKE_HANDOFF tip=07e369e parent=28cb8e1 preflight=start.m3u8 Escape=always-leave mediaDur=no-10+seed About=07e369e4b9d3/6b26c745c7eadc37 Gate-B=0 AppImage=/home/box/plexuw-artifacts/07e369e/PlexUW_0.1.0_amd64.AppImage`
