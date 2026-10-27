# CODE REVIEW — Push 3 #6–#9 dual-gate tip @ `974e343`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW + 2 INFO)  
**Date:** 2026-10-24 ~13:55 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `974e343f6eef2174b378175e30c1771f9ae6a264`  
**Prior PASS tip:** `4e6459c` (CODE-REVIEW-4e6459c.md)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/974e343/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Commits:** `8d4de1c`…`974e343` (profile tip gate, hero/CW polish, scrollport pad, collage, Watch-from, in-player audio/CC)  
**Scott-APPROVED 9-item next push — final SHA.** Replaces `4e6459c` for Win gate. **Not** Win/merge approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 / LOW-O1 / LOW-R1 prior residuals, untouched) |
| INFO | **2** (dead `.pxpmenu` CSS + mock `fu7kmenu`; collage trusts already-rendered poster `src` without re-HEX/ORIGIN check) |
| Account-profile MUST 1–8 | **8/8 still PASS** (zero Rust/egress delta) |
| Cred::Discover host×path | **Intact** (PASS-WITH-ACCEPTED-RESIDUAL product residual unchanged) |
| Claimed UI/JS-only | **Proven** — 9 files; `desktop/src-tauri/**` empty vs `4e6459c` |

No new hosts, Creds, PublicImage widen, ACCOUNT_HOSTS change, or account/PMS token exposure to JS. Picker uses pre-existing `version_pick(id)` (opaque slot). Collage + covers via opaque `img()` / proxy. Track menu is **static HTML stub** (no MediaStream fetch). Server/track labels via `textContent` / `el(…,txt)`.

---

## 2. Delta (exact)

```
Files (vs 4e6459c):
  app.js                               |  17 +++-
  desktop/shim/desktop.css             |  46 ++++++++---
  desktop/shim/plex-browse.js          | 145 +++++++++++++++++++++++++++++++----
  desktop/shim/test/fu7i-art.test.mjs  |   2 +-
  desktop/shim/test/fu7j.test.mjs      |   2 +-
  desktop/shim/test/fu7p.test.mjs      |  15 ++--
  desktop/shim/test/push3-6-9.test.mjs |  47 ++++++++++++
  index.html                           |  16 +++-
  styles.css                           |   6 +-
  9 files changed, 258 insertions(+), 38 deletions(-)

desktop/src-tauri/** : ZERO
Cargo.lock/toml      : ZERO
```

| Area | Change |
|---|---|
| Collage (#6) | Scroll-linked blurred `.pxcollage` from strip poster `src`s; `JSON.stringify` into CSS `url()`; clear on leave home |
| Scroll (#7) | Pad-inside scrollport CSS only (no JS side-effects beyond prior arrows) |
| Watch-from (#8) | `availNames` ∪ versions; radio + Play server menu → `invoke('version_pick',{id})` only |
| Audio/CC (#9) | Static `#ccMenu` in `index.html`; app.js toggle/toast; keyboard `c` |
| Chrome | Profile tip only when nav compact; hero/CW dedupe/label/kicker size |

---

## 3. MUST compliance

### 3a. Account-profile MUST 1–8

| # | MUST | Status | Notes |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII | **PASS** | Zero Rust. `applyAccountProfile` untouched. Tip labels static / textContent. |
| 2 | Avatar allowlist + token-less PublicImage + CDN one-hop | **PASS** | Egress untouched. Collage/covers use existing opaque `/img/<id>/` only. |
| 3 | Exact `plex.tv` × `/api/v2/user` | **PASS** | ACCOUNT_HOSTS still `plex.tv`, `clients.plex.tv`. |
| 4 | GET; redirects off for user; header token; never PMS | **PASS** | Untouched. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | Untouched. |
| 6 | Once + soft-fail letter | **PASS** | Untouched. |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched. |
| 8 | Scott implement approval | **PASS** | This tip Scott-APPROVED 9-item push. |

**Proof:** `git diff 4e6459c..974e343 -- desktop/src-tauri/` empty.

### 3b. Cred::Discover (standing)

| Check | Status |
|---|---|
| `DISCOVER_HOST` + `Cred::Discover` paired GET `/library/people/[0-9a-f]{24}` | **Intact** (spot-check `egress.rs`) |
| Not an ACCOUNT_HOSTS append | **Intact** |
| Product residual | **PASS-WITH-ACCEPTED-RESIDUAL** unchanged (no tip change) |

---

## 4. Depth — new surfaces

### 4.1 Watch-from / `version_pick`

| Check | Result |
|---|---|
| IPC payload | `{ id: v.id }` only — opaque slot id (pre-existing command) |
| Rust handler | `slots.resolve` → `Target::Version { mid, guid }` → sticky; **no token to JS**; no new egress |
| Server names in DOM | `el('button'/'span', …, n)` → **textContent** |
| File line | `file.textContent = …` from label/codec/bitrate fields |
| Token in URL/query/DOM | **None** in tip |
| New hosts | **None** |

### 4.2 In-player audio/CC

| Check | Result |
|---|---|
| Track source | **Static** buttons in `index.html` (hardcoded EN/ES labels) — **not** live MediaStream/metadata yet |
| Network | **None** |
| XSS | Labels are authoring-time HTML; toast uses `b.textContent.trim()` from those buttons |
| Product note | When live tracks land, must keep textContent + authorized metadata only (no new hosts) |

### 4.3 Collage / blurred bg

| Check | Result |
|---|---|
| Asset path | Reuses `.pxcard .poster img` `currentSrc`/`src` — posters set only via `img()` → `${ORIGIN}/img/${HEX}/WxH` |
| CSS injection | `backgroundImage = 'url(' + JSON.stringify(u) + ')'` — quoted/escaped |
| PublicImage / CDN widen | **None** (zero Rust; no raw plex.tv/PMS in `src`) |
| INFO | Collage does **not** re-validate ORIGIN/HEX before paint — trusts already-rendered poster URLs (defense-in-depth residual; not FAIL) |

### 4.4 Scroll-strip CSS

CSS-only pad/overflow/chevron inset. No new fetch/IPC. JS collage bind is separate (#6).

---

## 5. Breadth scan (whole tip)

| Class | Result |
|---|---|
| Secrets / tokens in tip | Clean (no `X-Plex-Token` introduced) |
| `eval` / `Function` / `document.write` | None in tip |
| `innerHTML` | Pre-existing `aspectList` near tip context only — **not** tip-introduced; CC menu is static markup |
| New `fetch` / host strings | None |
| Lockfile / deps | N/A (unchanged) |
| CORS / new routes | N/A (no Rust) |

---

## 6. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior residual: avatar id charset — untouched. |
| **LOW-O1** | LOW | Prior open: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior open: 3 node CSS fails — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` CSS + mock `fu7kmenu` still present (carry). |
| **INFO-COL** | INFO | Collage paints poster `src` without re-HEX/ORIGIN gate; posters already `img()`-gated. Optional harden later. |

**No HIGH/MED.**

---

## 7. Tests run

| Suite | Result |
|---|---|
| Tip file set | **9 files**; **zero** `src-tauri` |
| `node desktop/shim/test/push3-6-9.test.mjs` | **4/4 pass** |
| `desktop/shim/lint-shim.sh` | ok |
| `cargo test` | **N/A** vs parent (zero Rust) |
| Artifacts | SHA256SUMS OK; no MOCK sibling; `MOCK-DO-NOT-SHIP` **0**; `mockplex` **0** |

---

## 8. 3-line Master summary

1. **PASS** dual-gate tip @ `974e343` (replaces `4e6459c` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; account MUST **8/8**; Discover pairing intact.  
2. Proven **zero** `src-tauri`/egress; Watch-from = opaque `version_pick(id)` only; collage/covers opaque proxy; CC menu static stub (no new network/XSS).  
3. Artifacts release-only, MOCK strings **0**; INFO collage re-validate + dead `.pxpmenu`; **not** Win/merge approval.
