# CODE REVIEW — A–R Scott-GO tip @ `4082a5b`

**Verdict: FAIL** (0 HIGH / **1 MED** / 3 LOW + 4 INFO)  
**Date:** 2026-10-24 ~14:48 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `4082a5b3196e1888e4392815b9e3c46dc5795126`  
**Prior PASS tip:** `78882df` (CODE-REVIEW-78882df.md — 0H/0M/3L)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/4082a5b/` (release-only; MOCK strings 0)  
**Commit:** `A–R Scott-GO: RA arrows outside + left scroll; hero pick-up→Up Next fade`  
**Does not replace `78882df` for Win gate.** Not Win/merge.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **FAIL** |
| HIGH / MED | **0 / 1** |
| LOW | **3** (prior P1/O1/R1) + **1 new product LOW** (`musicServerName` unbound `server`) |
| INFO | **4** (dead `.pxpmenu`; collage ORIGIN; returnHash; carry) |
| Account-profile MUST 1–8 | **8/8 still PASS** (zero Rust/egress) |
| Cred::Discover host×path | **Intact** |
| UI/JS-only tip | **Proven** — 13 files; `src-tauri` empty vs `78882df` |

Zero Rust/egress widen. Blocker is **player Source panel HTML sink** for Plex-derived server/file strings.

---

## 2. Delta (exact)

```
Files (vs 78882df):
  app.js, desktop.css, desktop.js, plex-browse.js, index.html,
  test/ar-video-confirm.test.mjs (+ fu7* / push3-6-9 tweaks)
  13 files, +310/-66

desktop/src-tauri/** : ZERO
```

Scope: hero stack fade, RA arrows outside + page scroll, Music tab + settings toggles, Available-on label, detail feature menu, player Source from `pxPlayCtx.servers`, watch-together stub.

---

## 3. MUST / Discover

| Gate | Status |
|---|---|
| Account MUST 1–8 | **8/8** — egress untouched; avatar/profile path unchanged |
| ACCOUNT_HOSTS | Still `plex.tv`, `clients.plex.tv` |
| Cred::Discover pairing | **Intact** (spot-check `egress.rs`) |
| PublicImage / CDN one-hop | Untouched |
| version_pick | Still opaque `{ id }` only |

**Proof:** `git diff 78882df..4082a5b -- desktop/src-tauri/` empty.

---

## 4. Depth

### 4.1 MED-XSS-1 — FAIL blocker (player Source panel)

**Where:** `app.js` `renderPanels()` Source block (tip-introduced).

**Sink:** builds `#detailsBody` via `innerHTML` with:

```js
`<button … data-server="${String(n).replace(/"/g,'&quot;')}"><b>${n}</b>…${s}…`
```

**Source:** `pxPlayCtx.servers[]` written by `startTitlePlay` from `watchChoices` → `versions[].server` / `versionFileText` (label, **codec**, bitrate…).

**Why not mitigated by Rust:**
- `browse::clean` strips **controls only** — keeps `<`, `>`, `&`.
- `Version.server` uses `clean(server, 60)`, **not** `friendly_name`/`clean_name`.
- Codec path is cleaned the same way (fixture even uses `"<b>hevc</b>"` shape).
- Adjacent File/Cast fields in the same template correctly use `esc()`; Source does not.

**Impact:** HTML injection in Tauri webview from PMS-influenced strings (server name / media codec metadata). Webview can call existing `invoke` surface after script execution.

**Fix (Foreman):** `esc(n)` and `esc(s)` in the Source button template (helper already in `app.js`), or build buttons with `textContent` / DOM APIs. Prefer also routing display names through the same friendly-name filter used for Available-on.

### 4.2 Watch-from / Available on / version_pick

| Check | Result |
|---|---|
| IPC | Opaque `version_pick({ id })` only |
| Detail Available-on UI | `el(…)` / `textContent` — OK |
| Token leak | None |

### 4.3 Music toggles

| Check | Result |
|---|---|
| Hosts / fetch | None new — prefs in `localStorage`; section list from existing `browse_home` |
| XSS | Titles via `el`/`textContent` — OK |
| Token in DOM | None |
| LOW-MUS | `musicServerName` uses unbound `server` when title has no ` · ` → ReferenceError in strict module (product bug) |

### 4.4 Art / collage / hero

| Check | Result |
|---|---|
| Hero stack imgs | `img(backArt(it), …)` opaque proxy only |
| Collage | Still poster `src` + `JSON.stringify` → CSS `url()`; **no ORIGIN re-validate** (INFO-COL carry) |
| PublicImage widen | None |

### 4.5 Feature menu / watch-together / CC

Static labels via `el(…, lab)` / index.html; toast only; **no** new network or invite egress.

### 4.6 RA / scroll / hero CSS

CSS + scroll math only; no IPC/fetch.

---

## 5. Breadth

| Class | Result |
|---|---|
| Secrets / X-Plex-Token | Clean in tip |
| New Rust egress / Cred | None |
| Lockfile | N/A |
| eval / Function | None |

---

## 6. Findings

| ID | Sev | Detail |
|---|---|---|
| **MED-XSS-1** | **MED** | `app.js` Source panel: unescaped `${n}`/`${s}` from `pxPlayCtx.servers` into `innerHTML`. **FAIL blocker.** |
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS fails — untouched. |
| **LOW-MUS** | LOW | `musicServerName` unbound `server` fallback (product). |
| **INFO-OOS** | INFO | Dead `.pxpmenu` + `fu7kmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |

---

## 7. Tests run

| Suite | Result |
|---|---|
| Tip files / zero Rust | Proven |
| `ar-video-confirm.test.mjs` | **7/7 pass** |
| `push3-6-9.test.mjs` | **4/4 pass** |
| `lint-shim.sh` | ok (does not cover `app.js` sinks) |
| Artifacts | SHA256SUMS OK; MOCK sibling none; strings **0** |

---

## 8. 3-line Master summary

1. **FAIL** A–R tip @ `4082a5b` — **0 HIGH / 1 MED / 3+1 LOW**; MUST **8/8** + Discover intact; zero Rust.  
2. Blocker **MED-XSS-1**: player Source `innerHTML` interpolates Plex server/file/codec strings without `esc()` (path from `pxPlayCtx.servers`).  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-4082a5b.md` — does **not** replace `78882df` for Win; Foreman: esc Source labels.
