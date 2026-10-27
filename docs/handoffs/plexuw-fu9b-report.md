# PlexUW tip A–D report (Foreman executor → Master)

**Full SHA:** `98dd3456e39ba86a1175977831545bc4bed9336d`
**Base:** `eefc9c0904e89807f227bc0938b683968b645ab8`
**About Build:** `98dd3456e39b` (embedded; clean, not dirty)
**Win:** HELD (no Win build)

## What changed

### A — Startup Libraries/Home race
- **Files:** `desktop/shim/plex-browse.js`
- `browseHomeShared(sg)` single-flight promise for `browse_home`
- `home()` owns first paint; `loadSections()` + empty-`section()` join same promise (no second IPC)
- `navState` (`loading`/`ok`/`fail`) synced in one place inside shared flight
- Soft one-shot retry (~350ms) on first fail before Libraries/Home error UI
- `srcGen` bump clears flight; stale replies still dropped
- plex-merge-fill path unchanged

### B — Person bio
- **Files:** `desktop/shim/desktop.css` (`.pxperson`/`.pxpav`/`.pxptext`/`.pxbio`), `desktop/shim/plex-browse.js` `personInto`
- Tightened headshot↔bio gap (`gap` + bio/title margins)
- More/Less when `scrollHeight > clientHeight` (default clamped); labels **More** / **Less**
- **SHOULD film-row:** folded cheap CSS — `.pxfilm .pxcard .meta .t` 2-line clamp

### C — Credits circles
- **Files:** `desktop/shim/desktop.css` (`a.pxcred`)
- Hover + `:focus-visible` scale 1.05 on `.pxcred i`; `prefers-reduced-motion: reduce` → no scale
- Focus ring on the **circle** (`i`), not whole card outline
- Kept fu9a MUST-3 Credits-under-Versions stack / z-index

### D — Music tab server checkmarks
- **Files:** `desktop/shim/plex-browse.js` (`musicPage`/`writeMusicPrefs`), `desktop/shim/desktop.css` (`.pxmusicsrvs`/`.pxmusicchk`)
- `#px/music` shows server rows with checkmarks; libs list under checked servers
- Default `all:true`; writes `pxMusicServers` + `pxmusicprefs` (Settings sync)
- Empty state: “No music libraries for the selected servers.” (not Settings-primary)
- Auto-redirect only when truly one artist lib exists (not filter-down-to-one)

## KEEP (not regressed in tip)
Versions-only / Available-on gone · BLACKBOX Media hydrate · pick-up fanart · MED-XSS-1 Source esc · fu9a Credits stack + hero shrink + CW titles · Cred::Discover / profile egress (untouched)

## Artifacts
`/home/box/plexuw-artifacts/98dd345/`
- `plexuw` sha256 `eb85656334a4329b3de6575c76c671ef51e233988f6a708d867a63b2fd4e9485`
- `PlexUW_0.1.0_amd64.deb` sha256 `b958984b09120498d2cdd56cf2a38e7ff6050af2177ee2578423097698dc60da`
- `PlexUW_0.1.0_amd64.AppImage` sha256 `46232236b97e67fc5c3b85b30d33eea804ec64bc4960481b7b1e52afcbda5233`
- `SHA256SUMS` present

## MOCK evidence (Gate-B)
| artifact | mock_string_hits | shot_id |
|----------|------------------|---------|
| plexuw | 0 | 0 |
| AppImage | 0 | 0 |
| deb | 0 | 0 |

`PLEXUW_MOCK=false` RELEASE; lint-shim ok; no push/merge/reset --hard; no Cursor cloud.

## OOS UX flags
- Film-row title chop: addressed with cheap 2-line CSS (above); if da Vinci still sees mid-word chop on non-film rows, still SHOULD elsewhere.
- Pre-existing shim tests: 11 fail / 131 pass (clock/sidebar/logo/collage assertions) — unrelated to A–D; same class of failures as prior tips.

## Blockers
None for Linux READY. Win not built (held).
