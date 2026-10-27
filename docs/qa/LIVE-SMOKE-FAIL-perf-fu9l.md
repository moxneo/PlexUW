# LIVE smoke FAIL — fu9l @ 28cb8e1

**Time:** 2026-10-24 ~10:34 PM America/New_York
**SHA:** `28cb8e156fbc8310651d66b7ff01284b4ef56a69`
**About:** Build `28cb8e156fbc` · Frontend `d2ea1c80105441b5` — match

## Results
| Check | Result |
|-------|--------|
| KEEP1 Music rail | PASS |
| MUST3 Real Play | **FAIL** — Could not start playback; timeline 00:00:00/00:00:10; black; not Neon |
| MUST3 Escape | **FAIL** — blank blurred stuck (ambient chrome-hide, not returnHash) |

## Evidence
`/workspace/perf-fu9l/smoke/` 00–04

## RCA → fu9m
1. **Play:** `play_start` fires `/decision` fire-and-forget then returns HLS id even when start.m3u8/opaque_get will 502; force-transcode query still incomplete vs HTPC; no preflight of playlist.
2. **10s chrome:** `mediaDur` still `return 10` when plexId absent after clear; startTitlePlay does not seed `durationMs` from item.
3. **Escape:** app.js Escape prefers hide-UI (`vis()`) when `ui && !paused` over `goBackFromPlayer`; plex error leaves ambient blur = “blank stuck”. Must always leave `#player/plex` → returnHash.
