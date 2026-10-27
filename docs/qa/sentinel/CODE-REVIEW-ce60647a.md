# CODE REVIEW — tip @ `ce60647a`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~18:34 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `ce60647a21d81376dc5f2ae87c1f457c72d370f9`  
**Prior PASS tip:** `da1c68d` (CODE-REVIEW-da1c68d.md — 0H/0M/4L; MED-XSS-1 closed; note-5b clean)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/ce60647/` — About Build **ce60647a21d8**; release-only; **MOCK strings 0**  
**Commit:** `tip: drop Available-on UI; hydrate ByGuid Media; pill action strip; hero fanart above CW collage`  
**Replaces `da1c68d` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **4** (P1 / O1 / R1 / MUS carry) |
| INFO | **5** (`.pxpmenu`; collage ORIGIN; returnHash; esc text-only; ServerView raw names) |
| Account-profile MUST 1–8 | **8/8 still PASS** |
| Cred::Discover host×path | **Intact** |
| MED-XSS-1 | **Still CLOSED** — `app.js:171` `${esc(n)}` / `${esc(s)}` (app.js **untouched**) |
| Delta | **Clean** — Metadata/{rk} hydrate; Available-on UI removed; Versions opaque/el(); pills textContent; hero CSS/z only |

---

## 2. Delta (exact)

```
vs da1c68d (6 files, +97/-101):
  desktop/shim/desktop.css
  desktop/shim/desktop.js          (copy: Available-on → Versions)
  desktop/shim/plex-browse.js
  desktop/shim/test/ar-video-confirm.test.mjs
  desktop/src-tauri/src/commands.rs
  desktop/src-tauri/src/plex/merge.rs  (comment only)

app.js / capabilities / permissions / egress / lockfiles : ZERO
```

---

## 3. MED-XSS-1

| Check | Result |
|---|---|
| `git diff da1c68d..ce60647 -- app.js` | **Empty** |
| Source sink `app.js:171` | Still `${esc(n)}` / `${esc(s)}` |
| ar-video MED-XSS-1 subtest | Green |

**Still CLOSED / not reopened.**

---

## 4. Depth

### 4.1 ByGuid → Metadata/{rk} hydrate

| Check | Result |
|---|---|
| Trigger | Remote ByGuid hits missing non-empty `Media[]` |
| Call | `mx::fetch_on(…, Api::Metadata(hrk))` |
| RK | `merge::raw_rating_key` — u64 `1..=999_999_999_999` / digit string ≤12 |
| Path | `/library/metadata/{id}` + static `includeGuids=1` — matches `server_path` `[0-9]{1,12}` |
| Cred | **Cred::Server(mid)** via `browse::get` / `fetch_on` |
| Host set | Same `fanout_others` / ranked servers — **no new hosts** |
| Fallback | Hydrate fail → original ByGuid body → `versions_or_presence` stub |
| Amplification | Extra GETs ≤ take(4)×servers; HARD timeout; same host class — not speculative DoS HIGH |
| SSRF / open-redirect | **None** |

### 4.2 Available-on UI removed; Versions kept

| Check | Result |
|---|---|
| UI string `"Available on"` | **Gone** from plex-browse.js |
| Detail picker | `Versions` heading + `versionsList(it)` + pending copy |
| `versionsList` | `el()` **textContent** for label/codec/server; opaque `v.id` → `version_pick` |
| Backend `available`/`sources` | Still filled for Play/Watch-from union (`availNames`) — not HTML sinks |
| desktop.js chip copy | Text-only: “Versions / Watch from” |

### 4.3 Pill strip (Watchlist + ⋯)

| Check | Result |
|---|---|
| Construction | `el()` / `textContent`; static feature-menu labels |
| `watchBtn` | `lab.textContent = st.label`; localStorage mock list only |
| `makeFeat` | Static ⋯ menu (Watch together / Audio / CC) — no server strings into HTML |
| New innerHTML / unsafe URL | **None** (lint-shim ok) |

### 4.4 Hero / collage / z-index

| Check | Result |
|---|---|
| CSS | `.pxbdstack{z-index:1}`; case shrink; wash/blur opacity — **no sinks** |
| `pastCw` | Defers collage paint until past Continue Watching — product only |
| Fanart `img()` | Still HEX-gated → `ORIGIN/img/…` |
| Collage URLs | From poster `currentSrc`/`src` via `JSON.stringify` in `url(…)` — **INFO-COL carry** (no ORIGIN re-validate) |

**Delta risk summary: CLEAN** for MUST / Discover / SSRF / XSS / injection.

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 | **8/8** — egress untouched |
| Cred::Discover | Intact |
| New commands / capabilities | **None** |

---

## 6. Breadth

| Class | Result |
|---|---|
| Secrets / tokens | Clean in tip (binary About short-sha adjacent to unrelated string const — not a leak) |
| eval / shell / new Function | None |
| New Cred / host allowlist | None |
| Lockfiles | Untouched |
| Artifacts | SHA256SUMS OK; MOCK **0**; Build **ce60647a21d8** present |

---

## 7. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS / test drift — `push3-6-9` #6 still asserts `blur(14\|18)px` but tip uses **16px** (product wash; not a security defect). |
| **LOW-MUS** | LOW | `musicServerName` unbound — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` text-only (carry). |
| **INFO-SRV** | INFO | Manage-servers raw names via textContent (carry). |

No new HIGH/MED from this tip.

---

## 8. Tests / artifacts

| Suite | Result |
|---|---|
| `ar-video-confirm.test.mjs` | **11/11 pass** |
| `lint-shim.sh` | ok |
| `push3-6-9.test.mjs` | **3/4** — #6 fails on blur px regex only (LOW-R1) |
| Artifacts `ce60647` | SHA256SUMS **OK**; MOCK **0**; About Build **ce60647a21d8** |

---

## 9. 3-line Master summary

1. **PASS** tip @ `ce60647a` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Delta **clean** — Metadata/{rk} hydrate Cred::Server + RK bounds; Available-on UI gone; Versions/pills textContent; hero CSS/z only.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-ce60647a.md` — replaces `da1c68d` for Win gate; **Win held** for da Vinci LIVE.
