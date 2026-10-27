# CODE REVIEW — Push 3 chrome polish @ `4e6459c`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW + 1 INFO OOS)  
**Date:** 2026-10-24 ~13:30 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `4e6459c0f52b1e6e871fc327f2214b39373de7c2`  
**Parent:** `f7f45d6` (prior PASS — Push 3 avatar chrome)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/4e6459c/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Claimed delta:** UI chrome — plain profile tip, bigger home hero, CW title dedupe when hero present, strip hover overflow escape.  
**Replaces f7f45d6 for Win gate.** Not merge / Win approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 / LOW-O1 / LOW-R1 prior residuals, untouched) |
| INFO | **1** (dead `.pxpmenu` CSS + stale mock `fu7kmenu` — OOS cleanup; flyout JS removed this tip) |
| MUST 1–8 | **8/8 still PASS** (zero Rust/egress delta) |
| Claimed UI-only | **Proven** — `git diff --name-only f7f45d6..4e6459c` = exactly 3 shim files |

No new hosts, paths, Creds, IPC, fetch URLs, or account API calls. Avatar still opaque id → proxy. Hero/CW titles via `el(…, text)` → `textContent`. Profile hover tip is static `data-label` (not username).

---

## 2. Delta (exact)

```
Files (vs f7f45d6):
  desktop/shim/desktop.css    | 54 +++---
  desktop/shim/desktop.js     | 37 +---
  desktop/shim/plex-browse.js | 17 ++-
  3 files changed, 57 insertions(+), 51 deletions(-)

desktop/src-tauri/** : ZERO
Cargo.lock/toml      : ZERO
```

| Area | Change |
|---|---|
| CSS | Larger `.pxcase` hero; `.pxhkick` kick; strip `overflow:visible` + hover z-index; profile tip via `::before content:attr(data-label)`; neutralize leftover `.pxphover*` |
| JS | Remove hover flyout/chip/menu entirely; static `dataset.label='profile and settings'`; click → settings; stub `__pxProfileMenu` |
| plex-browse | Hero kick “Pick up where you left off”; CW row title `''` when hero present (strip skips empty h2); aria-label fallback “row” |

---

## 3. MUST compliance matrix (8) — re-confirm

| # | MUST | Status | Notes |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII; no email fallback; no body log | **PASS** | No Rust/IPC change. `applyAccountProfile` untouched (`createTextNode` / opaque thumb). Hover tip no longer shows username — static label only. |
| 2 | Avatar allowlist + token-less PublicImage + CDN one-hop | **PASS** | Egress untouched. Img still `/^[0-9a-f]{32}$/` → `IMG_ORIGIN/img/<id>/64x64`. Hero cover via `img(id,…)` → same opaque proxy (`HEX` gate). |
| 3 | Exact `plex.tv` × `/api/v2/user` only | **PASS** | Zero `src-tauri`; ACCOUNT_HOSTS unchanged. |
| 4 | GET; redirects off for user; header token; never PMS | **PASS** | Untouched. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | Untouched. |
| 6 | Once + gen-cancel; soft-fail letter; Demo/mock unchanged | **PASS** | Untouched. |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched. |
| 8 | Scott implement approval | **PASS** | Prior; UI polish under same surface. |

**Proof:** `git diff f7f45d6..4e6459c -- desktop/src-tauri/` empty.

---

## 4. Breadth → depth on watch items

| Watch | Result |
|---|---|
| XSS hero / CW title / hover tip | **No.** Kick + strip titles use `el(tag,cls,text)` → `textContent`. Tip = static `dataset.label='profile and settings'` + CSS `attr(data-label)` (not profile name; not `innerHTML`). |
| Unsafe img/src | **No.** Cover `ci.src = img(cv.id,…)` — `img()` returns null unless HEX opaque id; URL is `${ORIGIN}/img/${id}/WxH` only. |
| New fetch / IPC / invoke | **No** in tip. Menu/flyout removed; click only `location.hash='#settings'`. |
| Open-redirect / SSRF | **N/A** — no new network surface. |
| Dead handlers / leftover flyout | Flyout DOM creation removed; `#pxProfileHover` removed if present; CSS forces `.pxphover*` `display:none`. Dead `.pxpmenu` CSS still present (INFO OOS). |
| Host / Cred / ACCOUNT_HOSTS widen | **None** — zero Rust. |
| Secrets in tip | **Clean.** |
| Artifacts | SHA256SUMS OK; no `4e6459c-MOCK-DO-NOT-SHIP`; `MOCK-DO-NOT-SHIP` strings **0**; `mockplex` strings **0**. |

---

## 5. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior residual: avatar id charset — untouched. |
| **LOW-O1** | LOW | Prior open: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior open: 3 node CSS fails — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` CSS + mock `fu7kmenu` still queries `.pxpmenu` / no-op `__pxProfileMenu.open`. Style-only; no PII handler. Foreman cleanup when convenient. |

**No HIGH/MED.**

---

## 6. Tests run

| Suite | Result |
|---|---|
| Tip file set | **3 shim files only** — proven |
| Rust / egress diff | **empty** |
| `desktop/shim/lint-shim.sh` | ok |
| `cargo test` | **N/A** vs parent (zero `src-tauri` / Cargo.lock) |
| Artifacts | release-only; SHA256SUMS OK; MOCK strings 0; no MOCK sibling |
| Dependency | N/A |

---

## 7. 3-line Master summary

1. **PASS** Push 3 polish @ `4e6459c` (replaces `f7f45d6` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; **8/8 MUSTs** still hold.  
2. Proven **UI-only** (css/js/plex-browse); **zero** `src-tauri`/egress change; tip/hero/CW titles safe (`textContent` / static `data-label`); avatar+covers still opaque proxy.  
3. Artifacts release-only, MOCK strings **0**; dead `.pxpmenu` = INFO OOS; **not** Win/merge approval.
