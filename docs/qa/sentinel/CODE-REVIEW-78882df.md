# CODE REVIEW — fu8a REPLAN tip @ `78882df`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW + 3 INFO)  
**Date:** 2026-10-24 ~14:09 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `78882df8cd984948bda42a43739155e7308d9013`  
**Prior CODE PASS:** `974e343` (CODE-REVIEW-974e343.md — 0H/0M/3L)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/78882df/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Commit:** `fu8a: Watch-from + Play opens player; CC reachable; stronger collage`  
**Replaces `974e343` for Win gate.** **Not** Win/merge approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 / LOW-O1 / LOW-R1 prior residuals, untouched) |
| INFO | **3** (dead `.pxpmenu`; collage no ORIGIN re-validate; `returnHash` not `/^#/`-gated) |
| Account-profile MUST 1–8 | **8/8 still PASS** (zero Rust/egress delta) |
| Cred::Discover host×path | **Intact** (spot-check; accepted residual unchanged) |
| Claimed surface | **Proven UI/JS-only** — 4 files; `src-tauri` empty vs `974e343` |

“Real Play” opens the **existing sample/mock player** (`#player/0` + `pxPlayCtx` chrome overlay). **No** new PMS stream/session IPC, **no** new hosts, **no** `X-Plex-Token` in webview URLs. Watch-from still opaque `version_pick(id)` only.

---

## 2. Delta (exact)

```
Files (vs 974e343):
  app.js                               |   6 +-
  desktop/shim/desktop.css             |  11 +--
  desktop/shim/plex-browse.js          | 163 ++++++++++++++++++++++++++---------
  desktop/shim/test/push3-6-9.test.mjs |  17 +++-
  4 files changed, 146 insertions(+), 51 deletions(-)

desktop/src-tauri/** : ZERO
Cargo.lock/toml      : ZERO
```

| Area | Change |
|---|---|
| P8 Play | `startTitlePlay` → `version_pick` (opaque) + `sessionStorage.pxPlayCtx` + `location.hash='#player/0'`; removes M3 stub on Play CTA |
| P8 Watch-from | `watchChoices` / `selectedWatch` / `rememberWatch`; labels via `el(…,textContent)` |
| P9 | CC menu reachable because player opens; app.js reads `pxPlayCtx` for title/crumb (`textContent`); back via `returnHash` |
| P6 | Collage blur 36→14px, more tiles (9); still `JSON.stringify` into CSS `url()` |

---

## 3. MUST compliance

### 3a. Account-profile MUST 1–8

| # | MUST | Status | Notes |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII | **PASS** | Zero Rust. Profile path untouched. |
| 2 | Avatar allowlist + token-less PublicImage + CDN one-hop | **PASS** | Untouched. Collage still poster→opaque `/img/`. |
| 3 | Exact `plex.tv` × `/api/v2/user` | **PASS** | ACCOUNT_HOSTS unchanged. |
| 4 | GET; redirects off; header token; never PMS | **PASS** | Untouched. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | Untouched. |
| 6 | Once + soft-fail | **PASS** | Untouched. |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched. |
| 8 | Scott approval | **PASS** | fu8a REPLAN under Master GO. |

**Proof:** `git diff 974e343..78882df -- desktop/src-tauri/` empty.

### 3b. Cred::Discover

| Check | Status |
|---|---|
| `DISCOVER_HOST` + `Cred::Discover` paired GET `/library/people/[0-9a-f]{24}` | **Intact** |
| Not ACCOUNT_HOSTS append | **Intact** |
| Product residual | **PASS-WITH-ACCEPTED-RESIDUAL** unchanged |

---

## 4. Depth — focus surfaces

### 4.1 Watch-from / `version_pick`

| Check | Result |
|---|---|
| IPC | `invoke('version_pick', { id: choice.versionId })` — opaque slot id only |
| Rust | Unchanged: resolve → sticky; no token to JS |
| DOM labels | `el('button', …, ch.label)` / note `textContent` |
| Token in DOM/logs/query | **None** |

### 4.2 “Real Play” / sample session

| Check | Result |
|---|---|
| Media path | `#player/0` → existing mock `ITEMS`/`D[0]` + local `<video>`; **no** new `playback_*` / stream invoke |
| Egress widen | **None** (zero Rust; no fetch to PMS/account) |
| `X-Plex-Token` in webview URL | **None** |
| Open redirect | `returnHash` assigned only to `location.hash` (same-document fragment; writer sets `location.hash`) — not `href`/`assign` to absolute URL |
| Overlay XSS | `ptitle`/`crumb` via **textContent**; stage art via pre-existing `art()` (demo hue SVG + `esc`/`encodeURIComponent`) — title overlay does not inject raw HTML |
| sessionStorage | Stores title/server/file/opaque `plexId`/`returnHash` — no tokens |

**Product clarity (not a FAIL):** Play is sample-player chrome with Watch-from sticky preference — **not** live Cred::Server media yet. When live streams land, must stay on allowlisted server paths with no token-in-query to webview.

### 4.3 Player / CC audio·sub

| Check | Result |
|---|---|
| Menu source | Still **static** `#ccMenu` HTML (unchanged this tip) |
| New network for menu | **None** |
| XSS | Static labels; toast `textContent` |

### 4.4 Collage (P6)

| Check | Result |
|---|---|
| Blur tighten | CSS-only (14px / higher opacity) |
| Asset path | Still poster `src` → `JSON.stringify` → CSS `url()` |
| ORIGIN/HEX re-validate | **Not added** — **INFO-COL carries** |

---

## 5. Breadth

| Class | Result |
|---|---|
| Secrets / tokens in tip | Clean |
| `eval` / `Function` | None |
| New `innerHTML` from Plex strings | None (ptitle/crumb textContent; chapters still demo+`esc`) |
| Lockfile / deps | N/A |
| New hosts / Cred / PublicImage | None |

---

## 6. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior: avatar id charset — untouched. |
| **LOW-O1** | LOW | Prior: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior: 3 node CSS fails — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` CSS + mock `fu7kmenu` (carry). |
| **INFO-COL** | INFO | Collage still no re-HEX/ORIGIN gate before paint (carry from 974e343). |
| **INFO-RH** | INFO | `goBackFromPlayer` applies `pxPlayCtx.returnHash` to `location.hash` without `/^#/` check. Hash assignment cannot open-redirect off-origin; optional harden. |

**No HIGH/MED.**

---

## 7. Tests run

| Suite | Result |
|---|---|
| Tip file set | **4 files**; **zero** `src-tauri` |
| `node …/push3-6-9.test.mjs` | **4/4 pass** |
| `lint-shim.sh` | ok |
| `cargo test` | **N/A** (zero Rust) |
| Artifacts | SHA256SUMS OK; no MOCK sibling; MOCK strings **0** / mockplex **0** |

---

## 8. 3-line Master summary

1. **PASS** fu8a REPLAN @ `78882df` (replaces `974e343` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; account MUST **8/8**; Discover pairing intact.  
2. Proven **zero** `src-tauri`/egress; Watch-from = opaque `version_pick(id)`; Play = sample `#player/0` + `pxPlayCtx` chrome (no token/stream widen); CC static; collage blur CSS-only.  
3. Artifacts release-only, MOCK **0**; INFO collage re-validate + returnHash `/^#/` + dead `.pxpmenu`; **not** Win/merge.
