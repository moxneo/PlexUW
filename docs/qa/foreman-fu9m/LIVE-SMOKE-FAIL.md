# LIVE smoke FAIL — fu9m @ 07e369e

**Time:** 2026-10-24 ~10:49 PM America/New_York  
**SHA:** `07e369e4b9d38d898c2b34fd440299203b7400a9`  
**About:** Build `07e369e4b9d3` · Frontend `6b26c745c7eadc37` — match  
**Title played:** Chompy & the Girls (2021) · MoxBox MKV HEVC 1080p (CW row shifted; not X-Men; still valid HEVC probe)

## Results
| Check | Result |
|-------|--------|
| KEEP1 Music rail | PASS — Movies + TV Shows only (`00-start.png`) |
| About | PASS — 0.1.0 / `07e369e4b9d3` / `6b26c745c7eadc37` (`01-about.png`) |
| MUST3 Real Play | **FAIL** — real title (not Neon); toast `Could not start playback` **no** `(NNN)`; timeline `00:00:00` / `00:00:10`; no advance (`02-play.png`) |
| MUST3 Escape | **FAIL** — after leave: blank blurred ambient (dark red/olive); no sidebar/header/detail; stuck (`04-stuck.png`; `03` still player after ineffective xdotool Escape) |

## Evidence
`/workspace/perf-fu9m/smoke/` 00–04

## RCA → fu9n
1. **Play (preflight Ok → JS fatal code 0):** No status in toast ⇒ `play_start` returned **Ok** (start.m3u8 preflight passed) then hls.js / `<video>` errored with **code 0** (`showErr(..., 0)` or hls fatal without `response.code`). Segment/opaque_get/decode path after playlist still broken — not a decision/preflight miss. Fix: surface MEDIA_ERR / hls detail as status-class; emit absolute `/hls/<32hex>` (not bare relative) in `rewrite_m3u8` for WebKit loader; prove first media playlist + first segment via `opaque_get` before/with attach; HTPC-align universal query if needed (`videoCodecs`/product) so WebKit can decode the forced transcode.
2. **Fake `00:00:10` chrome:** Not `mediaDur` returning 10 — HTML `#tdur` default is literally `00:00:10` (sample stub). On play fail, `ontimeupdate` never runs ⇒ stub stays. Fix: default `#tdur` → `--:--:--`; paint `#tdur` immediately from `durationMs` / `--:--:--` on `stashDur` / `showErr` / enter `#player/plex`.
3. **Escape blank blur:** `goBackFromPlayer` → `returnHash` runs, but restore leaves `#pxcollage`/`#pxbdstack` (fixed full-bleed blur) with empty/hidden `#pxView` content (same-hash reveal insufficient / view emptied by swap). Fix: on leave player always unhide `#home` + hide `#player` + strip amb; hide collage/stack while `!pxroute`/on player; after `returnHash`, if `#pxView` has no real browse nodes force rebuild; Escape must restore sidebar+header+detail, never blank blur.

## Next
tip(**fu9n**) from `07e369e` — HLS-after-preflight + tdur seed paint + Escape restore browse UI → Linux LIVE → READY dual. **Win HELD.**
