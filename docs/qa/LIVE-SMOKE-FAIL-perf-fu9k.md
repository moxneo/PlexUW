# LIVE smoke FAIL — fu9k @ 93cdcf0

**Time:** 2026-10-24 ~10:20 PM America/New_York
**SHA:** `93cdcf03a435cb300d9caa81d13fa056df064501`
**About:** Build `93cdcf03a435` · Frontend `b0799d1735eefb54` — match

## Results
| Check | Result |
|-------|--------|
| KEEP1 Music rail | PASS |
| MUST3 Real Play | **FAIL** |
| Escape/back | **FAIL** (blank stuck; not Neon) |

## Evidence
- `02-xmen-error.png` — Could not start playback; 00:00:00/00:00:10; title X-Men·MoxBox
- `03`/`04` — Escape blank blurred stuck

## RCA → fu9l
1. `mediaDur` prefers `vid.duration` before plex `durationMs` → sample 10s wins
2. HLS `directStream=1` likely fails HEVC → need force transcode
3. Escape ≠ returnHash recovery
