# CODE REVIEW — tip @ `eefc9c0`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~18:49 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `eefc9c0904e89807f227bc0938b683968b645ab8`  
**Prior PASS tip:** `ce60647a` (CODE-REVIEW-ce60647a.md — 0H/0M/4L; MED-XSS-1 closed)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/eefc9c0/` — About Build **eefc9c0904e8**; release-only; **MOCK strings 0**  
**Commit:** `tip(fu9a): Credits stack under Versions/actions; smaller hero + CW wash`  
**Replaces `ce60647a` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

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
| Delta | **Clean** — CSS layout/z-index/contrast + test asserts only; no JS/Rust/egress/lockfile |

---

## 2. Delta (exact)

```
vs ce60647a21d8 (3 files, +36/-22):
  desktop/shim/desktop.css                 (Credits stack z/layout; .pxcase shrink; CW/strip contrast wash)
  desktop/shim/test/ar-video-confirm.test.mjs  (hero clamp + fu9a MUST-3 layout asserts)
  desktop/shim/test/fu7k-release.test.mjs      (RVS-3 → stack Credits under actions)

app.js / plex-browse.js / desktop.js / commands / egress / capabilities /
permissions / host allowlists / Cargo.lock / package-lock.json : ZERO
```

Master-stated focus after breadth:
1. Credits layout/z vs Versions + action strip — **CSS only** (`z-index` on `.pxround`/`.pxvers`/`.pxdbody`/`.pxheads`; 1280–2559 `flex-direction:column`; ultrawide grid kept)
2. `.pxcase` shrink — **CSS only** (`clamp(248px,15.5vw,280px)`; media 232px)
3. Fanart lower-band / CW title contrast — **CSS only** (mask/opacity; `.pxcw .meta` / `.pxsth` text-shadow + strip wash)

Keep MED-XSS-1 closed. Gate-B MOCK 0. **Both hold.**

---

## 3. MED-XSS-1

| Check | Result |
|---|---|
| `git diff ce60647a21d8..eefc9c0904e8 -- app.js` | **Empty** |
| Source sink `app.js:171` | Still `` `${esc(n)}` `` / `` `${esc(s)}` `` |
| ar-video MED-XSS-1 subtest | **Green** (12/12 suite) |

**Still CLOSED / not reopened.**

---

## 4. Depth (Master deltas)

### 4.1 Credits vs Versions + action strip

| Check | Result |
|---|---|
| JS sinks | **Untouched** — `versionsList` / `watchBtn` / `makeFeat` / Credits cast still `el()` + textContent; opaque `version_pick` |
| New `innerHTML` from server/user strings | **None** |
| Change class | Layout: wrap + `z-index:3` on strip/Versions; desktop 1280–2559 stacks detail column so cast no longer paints over Watchlist/⋯ |
| XSS / injection | **None** — z-index/stacking only |

### 4.2 `.pxcase` shrink

| Check | Result |
|---|---|
| Change | Width clamp 307/19.9vw/397 → 248/15.5vw/280 (+ sq + ≤1199 media) |
| Dynamic HTML / egress | **None** |

### 4.3 Fanart lower-band / CW contrast

| Check | Result |
|---|---|
| Fanart | Mask stop 58%→42%; opacity .68→.62 — CSS |
| CW titles | `.pxrow.pxcw .card .meta` white + text-shadow; `.pxsth`/`.pxstc` wash — CSS |
| New sinks / URL construction | **None** |

**Delta risk summary: CLEAN** for MUST / Discover / SSRF / XSS / injection / host widen.

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 (account profile) | **8/8** — `egress.rs` / profile IPC / avatar allowlists **untouched** vs `ce60647a` |
| Cred::Discover host×path | **Intact** — `discover_people_url` + session gates unchanged |
| New commands / capabilities | **None** |
| Discover residual | Scott-accepted — technical MUSTs hold → not a FAIL; no new residual this tip |

---

## 6. Breadth (whole tip vs ce60647a)

| Class | Result |
|---|---|
| Secrets / tokens (rg classic patterns) | Clean in tip; gitleaks **not installed** (skipped by name) |
| eval / shell / new Function (prod paths) | No new; existing test/`w.eval` / `tokio::spawn` / shot `w.eval` carry only |
| New Cred / host allowlist / CORS widen | **None** (no Rust/JS delta) |
| Unsanitized HTML sinks from server/user | **None new**; Credits/Versions remain `el()` |
| Lockfiles / deps | **Identical** — npm audit / OSV N/A for this tip |
| CI workflows | Untouched |
| Artifacts | SHA256SUMS **OK**; literal `MOCK` in `plexuw` binary **0**; About Build **eefc9c0904e8**; no `eefc9c0-MOCK-DO-NOT-SHIP` sibling |

---

## 7. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS / test drift — `push3-6-9` #6 still fails on `blur(14\|18)px` while tip uses **16px** (product wash; not a security defect). |
| **LOW-MUS** | LOW | `musicServerName` unbound — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` text-only (carry). |
| **INFO-SRV** | INFO | Manage-servers raw names via textContent (carry). |

No new HIGH/MED from this tip.  
**OOS note (not a security finding):** `fu7k-release` RVS-4 still asserts `body.desktop .pxclock{…right:162px` — pre-existing product/chrome drift; **not introduced** by fu9a CSS (RVS-4 file hunk untouched except adjacent RVS-3 rewrite).

---

## 8. Tests / artifacts

| Suite | Result |
|---|---|
| `ar-video-confirm.test.mjs` | **12/12 pass** (incl. MED-XSS-1 + fu9a MUST-3) |
| `lint-shim.sh` | ok |
| `fu7k-release.test.mjs` | **4/5** — RVS-4 clock px (OOS product drift; not security) |
| `push3-6-9.test.mjs` | **3/4** — #6 blur px regex only (LOW-R1) |
| Artifacts `eefc9c0` | SHA256SUMS **OK**; MOCK **0**; Build **eefc9c0904e8** present |

---

## 9. 3-line Master summary

1. **PASS** tip @ `eefc9c0` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Delta **clean** — CSS-only Credits stack/z + `.pxcase` shrink + CW/fanart contrast; Versions/pills/Credits sinks unchanged (`el()`/opaque `version_pick`); MOCK **0**.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-eefc9c0.md` — replaces `ce60647a` for Win gate; **Win held** for da Vinci LIVE.
