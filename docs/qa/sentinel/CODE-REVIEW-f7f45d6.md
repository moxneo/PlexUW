# CODE REVIEW — fu7u Push 3 avatar chrome @ `f7f45d6`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW + 1 INFO OOS)  
**Date:** 2026-10-24 ~12:45 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `f7f45d662a5539d7d15f253977a24cbe9287e043`  
**Parent:** `f25bdde` (prior PASS — avatar CDN one-hop)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/f7f45d6/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Claimed delta:** UI chrome only — gold avatar frame, remove click `.pxpmenu`, collapsed hover name+menu, label “profile and settings”, windowed clock under title buttons.  
**Replaces f25bdde for Win gate (UI tip; egress unchanged).** Not merge / Win approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 / LOW-O1 / LOW-R1 prior residuals, untouched) |
| INFO | **1** (dead `.pxpmenu` CSS + stale mock scene selector — OOS cleanup) |
| MUST 1–8 | **8/8 still PASS** (zero Rust/egress delta) |
| Claimed UI-only | **Proven** — `git diff --name-only f25bdde..f7f45d6` = exactly 3 shim/HTML files |

No new hosts, paths, Creds, IPC fields, fetch URLs, or account API calls. Avatar still opaque id → `proxy_public`. Username rendered via `textContent` / `createTextNode` only.

---

## 2. Delta (exact)

```
Files (vs f25bdde):
  desktop/shim/desktop.css  | 27 ++++++++++++++++++++-------
  desktop/shim/desktop.js   | 47 +++++++++++++++++++++++++++++------------------
  index.html                |  2 +-
  3 files changed, 50 insertions(+), 26 deletions(-)

desktop/src-tauri/**        : ZERO changes
Cargo.lock / Cargo.toml     : ZERO changes
```

| Area | Change |
|---|---|
| CSS | Gold `#E5A00D` 2px frame on `.profile .av`; new `.pxphover*` hover chrome; clock `right:24` (under wb) |
| JS | Remove click `.pxpmenu` DOM; avatar click → `#settings`; collapsed-rail hover flyout (name chip + profile / app settings); `PLACE_SUB` label |
| HTML | Placeholder subtitle `Default profile` → `profile and settings` |

---

## 3. MUST compliance matrix (8) — re-confirm

| # | MUST | Status | Notes |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII; no email fallback; no body log | **PASS** | No Rust/IPC change. JS still `profile_get` / `plex-profile` → `{name, thumb}` only; `createTextNode` / `textContent`. |
| 2 | Avatar allowlist + token-less PublicImage + CDN one-hop | **PASS** | Egress/CDN/PublicImage untouched. Img src still `IMG_ORIGIN+'/img/'+th+'/64x64'` only if `/^[0-9a-f]{32}$/`. No raw CDN/plex.tv URL in `img.src`. |
| 3 | Exact `plex.tv` × `/api/v2/user` only | **PASS** | No Rust change; ACCOUNT_HOSTS still `plex.tv`, `clients.plex.tv`. |
| 4 | GET; redirects off for user; header token; never PMS | **PASS** | Untouched. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | Untouched. Mock/demo still skip `applyAccountProfile`. |
| 6 | Once + gen-cancel; soft-fail letter; Demo/mock unchanged | **PASS** | Soft-fail letter path unchanged; placeholder label text only. |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched. |
| 8 | Scott implement approval | **PASS** | Prior; UI chrome under same surface. |

**Proof of no egress widen:** `git diff f25bdde..f7f45d6 -- desktop/src-tauri/` empty; tip names only the three UI files.

---

## 4. Breadth → depth on watch items

| Watch | Result |
|---|---|
| New fetch / open-redirect / `javascript:` | **No.** Tip adds no `fetch`, no `location=` to untrusted, no remote script. Menu actions = `location.hash='#settings'` only. |
| Avatar src bypass proxy | **No.** `applyAccountProfile` unchanged: opaque 32-hex → `plexuw://…/img/<id>/64x64` (or http plexuw.localhost). |
| New IPC pulling email/authToken/home | **No.** No new `invoke`. Hover/menu does not call account APIs. |
| XSS via username in hover | **No.** `syncHoverName` reads text node from `.pn` and sets `nameChip.textContent=name`. Profile name applied with `createTextNode`. Menu labels `textContent`. |
| Dead `.pxpmenu` leftover | **INFO OOS.** CSS rules for `.pxpmenu` remain (lines ~692–697) but JS no longer creates that DOM. No clickable leftover / no PII surface. Mock scene `fu7kmenu` still queries `.pxpmenu:not([hidden])` (mock-only; will report false for open menu — screenshot driver, not production). |
| SSRF / host widen | **N/A** — no network surface in tip. |
| Secrets in tip | **Clean.** |
| Artifacts | SHA256SUMS OK; no `f7f45d6-MOCK-DO-NOT-SHIP`; strings clean of `MOCK-DO-NOT-SHIP` / `mockplex`. |

---

## 5. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior residual: avatar id charset — untouched (Rust). |
| **LOW-O1** | LOW | Prior open: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior open: 3 node CSS fails — untouched; not re-failed here. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` CSS (+ stale mock `fu7kmenu` selector / `fu7k-nav.test.mjs` still expects old `mItem('pxMenuSettings'…)`). Style-only; no handler/PII. Foreman cleanup when convenient. |

**No HIGH/MED.**

---

## 6. Tests run

| Suite | Result |
|---|---|
| Tip file set | **3 UI files only** — proven |
| Rust / egress diff | **empty** |
| `desktop/shim/lint-shim.sh` | ok |
| `cargo test` | **N/A** vs parent (zero `src-tauri` / Cargo.lock change; prior tip 96 / mockplex 104 still apply) |
| Artifacts | release-only; SHA256SUMS verify OK; no MOCK sibling |
| Dependency | N/A (no Cargo.lock in tip) |

---

## 7. 3-line Master summary

1. **PASS** Push 3 avatar chrome @ `f7f45d6` (replaces `f25bdde` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; **8/8 MUSTs** still hold.  
2. Proven **UI-only** (css/js/html); **zero** `src-tauri`/egress/Cred/ACCOUNT_HOSTS change; avatar still opaque id → proxy; name via `textContent`; no new IPC/fetch/XSS.  
3. Dead `.pxpmenu` CSS = INFO OOS cleanup; artifacts release-only clean; **not** Win/merge approval.
