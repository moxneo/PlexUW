# CODE REVIEW — MED-XSS-1 replan tip @ `a94deec`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 4 INFO)  
**Date:** 2026-10-24 ~15:04 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `a94deec287f3586b19dc22c042113f0602dfbcb4`  
**Prior FAIL tip:** `4082a5b` (CODE-REVIEW-4082a5b.md — 0H/1M MED-XSS-1)  
**Prior PASS (pre-FAIL Win candidate):** `78882df` (CODE-REVIEW-78882df.md — 0H/0M/3L)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/a94deec/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **MOCK strings 0**)  
**Commit:** `MED-XSS-1 + B/Q page-snap + G logo: Sentinel/da Vinci replan tip`  
**Replaces `78882df` and `4082a5b` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **4** (P1 / O1 / R1 carry + LOW-MUS) |
| INFO | **4** (dead `.pxpmenu`; collage ORIGIN; returnHash; esc() text-only) |
| Account-profile MUST 1–8 | **8/8 still PASS** (zero Rust/egress) |
| Cred::Discover host×path | **Intact** |
| MED-XSS-1 | **CLOSED** — `app.js:171` `${esc(n)}` / `${esc(s)}` |
| UI/JS-only tip | **Proven** — 5 files; `src-tauri` empty vs `4082a5b` and vs `78882df` |

---

## 2. Delta (exact)

```
vs 4082a5b:
  app.js                                      |  2 +-
  desktop/shim/desktop.css                    |  2 +-
  desktop/shim/desktop.js                     | 31 +++++++++++++---
  desktop/shim/plex-browse.js                 | 55 +++++++++++++++++++++--------
  desktop/shim/test/ar-video-confirm.test.mjs | 18 ++++++++++
  5 files changed, 88 insertions(+), 20 deletions(-)

desktop/src-tauri/** : ZERO (also empty vs 78882df)
```

| Area | Change |
|---|---|
| MED-XSS-1 | Source button labels → `esc(n)` / `esc(s)` before `innerHTML` |
| B/Q | `fitPage` / `cardUnit` — viewport width = N full posters |
| G | Logo always toggles under pxsb2; tip Expand-only when collapsed |
| Tests | Page-snap + MED-XSS-1 regression guards |

---

## 3. MED-XSS-1 closure (FAIL blocker from 4082a5b)

| Check | Result |
|---|---|
| Sink | `app.js` `renderPanels` Source map @ **line 171** |
| Before | `<b>${n}</b>…${s}…` unescaped into `#detailsBody` `innerHTML` |
| After | `<b>${esc(n)}</b><span class="muted small">${esc(s)}</span>` |
| `esc()` | `app.js:3` — `String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")` (HTML text-safe; closes tag injection) |
| Attribute | `data-server` still quote-escapes `"` (not the XSS path) |
| Other `pxPlayCtx.servers` HTML sinks | None — title/crumb use `textContent` |
| Regression test | `ar-video-confirm` asserts `esc(n)`/`esc(s)` and rejects raw `${n}`/`${s}` |

**Closed.** No remaining MED/HIGH from this path.

---

## 4. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 (plex.tv `/api/v2/user`, avatar allowlist, CDN one-hop `assets.plex.tv/avatars/[0-9a-f]{40}.`, token-less images, no home-user, Cred::Account boundaries, no host widen/open-redirect/SSRF) | **8/8** |
| ACCOUNT_HOSTS | `plex.tv`, `clients.plex.tv` |
| Cred::Discover | Paired `discover.provider.plex.tv` GET `/library/people/[0-9a-f]{24}` — **intact** |
| `account_user_ok` / `account_avatar_cdn_ok` | Spot-checked present |

**Proof:** `git diff 78882df..a94deec -- desktop/src-tauri/` empty; same vs `4082a5b`.

---

## 5. Breadth (whole surface) then depth on tip

| Class | Result |
|---|---|
| Secrets / X-Plex-Token in tip | Clean |
| eval / new Function / shell | None in tip; desktop splash/titlebar `innerHTML` static only |
| New CORS / credentialed fetch | None |
| New Tauri invoke / IPC | None — `version_pick({ id })` opaque still |
| Watch-from / Available on | Opaque; feature menu `el()`/`textContent` |
| Art / PublicImage / CDN | Untouched; collage still opaque `img` + CSS `url(JSON.stringify)` |
| Music toggles | localStorage + `browse_home` names; no new hosts; no token in DOM |
| B/Q page-snap / G logo | Layout/CSS/a11y only — no network |
| Dependency tip delta | None (no lockfile change) |
| Release artifacts | SHA256SUMS OK; MOCK sibling **0**; binary MOCK strings **0** |

Cast/Crew in same `renderPanels` still interpolate demo `CAST` constants without `esc` — **not** Plex-derived; pre-existing demo surface; not tip-introduced MED (INFO-CAST below).

---

## 6. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS fails — untouched. |
| **LOW-MUS** | LOW | `musicServerName` unbound `server` when title lacks ` · ` (`plex-browse.js:481`) — product ReferenceError risk. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` + menu gate (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` escapes `&`/`<` only (app-wide); sufficient for text nodes; do not use in attributes without quote handling. |

---

## 7. Tests / artifacts

| Suite | Result |
|---|---|
| Tip / zero Rust | Proven |
| `ar-video-confirm.test.mjs` | **9/9 pass** (incl. MED-XSS-1 + B/Q) |
| `push3-6-9.test.mjs` | **4/4 pass** |
| `lint-shim.sh` | ok |
| Artifacts `a94deec` | SHA256SUMS **OK** (plexuw, deb, AppImage); MOCK files **0**; MOCK strings in `plexuw` **0** |

---

## 8. 3-line Master summary

1. **PASS** replan tip @ `a94deec` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; zero Rust.  
2. **MED-XSS-1 CLOSED** at `app.js:171` via `esc(n)`/`esc(s)` on Source labels from `pxPlayCtx.servers`; regression test green.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-a94deec.md` — replaces `78882df`/`4082a5b` for Win gate; **Win held** for da Vinci LIVE.
