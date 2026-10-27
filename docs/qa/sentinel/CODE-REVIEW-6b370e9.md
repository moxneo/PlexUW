# CODE REVIEW — tip @ `6b370e9`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~20:52 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat; authorized TTGDevX/PlexUW only)  
**SHA:** `6b370e9ae0d5383e306a58b2e1dd0adf5a1fad78`  
**Prior PASS tip:** `9385cf2653c4e1922c94205fda32c2939afd36da` (CODE-REVIEW-9385cf2.md — 0H/0M/4L; MED-XSS-1 closed)  
**Parent (Master):** `dabe3f1` — tip is +1 commit (`fu9g`); breadth also covers `9385cf2`→`6b370e9` (fu9d–fu9g)  
**Worktree:** `/workspace/plexuw-fu7i` @ HEAD `6b370e9ae0d5383e306a58b2e1dd0adf5a1fad78`  
**Artifacts:** `/home/box/plexuw-artifacts/6b370e9/` — About Build **6b370e9ae0d5** · Frontend **363f552d72956b08**; release-only; **MOCK strings 0**  
**Commit:** `tip(fu9g): hard-visible More on clamped person bio`  
**Replaces `9385cf2` for next Win candidate.** **Not** Win/merge this kick — Master: no Win.

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
| MED-XSS-1 | **Still CLOSED** — `app.js:171` `${esc(n)}` / `${esc(s)}` (app.js **untouched**; dist/app.js **identical**) |
| Delta | **Clean** — `buildPersonBioBlock` always sync More via `createElement`/`textContent`/`appendChild` (`.pxbiowrap` + `.pxbiomore`); CSS hard-visible More only; zero Rust/egress/lockfile/host widen; no unsafe bio HTML |

---

## 2. Delta (exact)

```
vs 9385cf2653c4 (4 files, +97/-50):
  desktop/shim/desktop.css                 (+.pxbiowrap / +.pxbiomore; .pxperson flex-direction:row)
  desktop/shim/plex-browse.js              (export buildPersonBioBlock; personInto always appendChild wrap)
  desktop/shim/test/fu9c-bio-more.test.mjs (removed — superseded)
  desktop/shim/test/fu9g-bio-more.test.mjs (new — fu9g MUST-2 + KEEP + jsdom DOM)

vs dabe3f1 (parent; 4 files, +97/-55): same surface (fu9f test → fu9g test; plex-browse + CSS)

app.js / desktop.js / commands / egress / capabilities /
permissions / host allowlists / Cargo.lock / package-lock.json / CI : ZERO
```

Commits in breadth window `9385cf2`→`6b370e9`:
- `f784cb4` tip(fu9d): sync More/Less for long person bios (>160)
- `c5d199b` tip(fu9e): always More/Less when person bio is clamped
- `dabe3f1` tip(fu9f): keep More on clamped bio; drop polish remove
- `6b370e9` tip(fu9g): hard-visible More on clamped person bio

Master-stated focus after breadth:
1. person bio DOM: appendChild `.pxbiomore` / `.pxbiowrap` — **no unsafe HTML** — **PASS**
2. Discover Cred pairing still intact — **PASS**
3. No new egress — **PASS**
4. No XSS in bio/More path — **PASS**
5. KEEP #1/#3/#4 + prior MED-XSS-1 closed in dist — **PASS**

---

## 3. MED-XSS-1

| Check | Result |
|---|---|
| `git diff 9385cf2..6b370e9 -- app.js` | **Empty** (0 bytes) |
| Source sink `app.js:171` | Still `` `${esc(n)}` `` / `` `${esc(s)}` `` |
| `desktop/dist/app.js` vs root `app.js` | **Identical** (`cmp`); same line 171 |
| Frontend hash About | **363f552d72956b08** = first 16 of dist-tree SHA-256 `363f552d72956b0802b2e7f6b9a3557878c17e7dc9be7bb59b6d18affe8e2e81` (matches binary `PLEXUW_DIST_SHA256`) |
| `ar-video-confirm.test.mjs` MED-XSS-1 subtest | **Green** (suite **15/15** with fu9g) |
| lint-shim.sh | **ok** (plex-browse.js still has zero HTML sinks) |

**Still CLOSED / not reopened.** Proof line:

```
app.js:171 — return list.map(([n,s,on],k)=>`... <b>${esc(n)}</b>...<span class="muted small">${esc(s)}</span> ...`)
```

Dist/bundled frontend: `desktop/dist/app.js:171` same `${esc(n)}`/`${esc(s)}`; About Frontend **363f552d72956b08** verified against tip `desktop/dist` tree hash and artifact binary.

---

## 4. Depth (person bio More — fu9g)

### 4.1 Bio into DOM — XSS

| Check | Result |
|---|---|
| `buildPersonBioBlock(doc, bio)` | `createElement('div'/'p'/'button')` + **`textContent = String(bio ?? '')`** + **`appendChild`** for bio and More |
| Wrap / button classes | `.pxbiowrap` + `button.pxlink.pxbiomore` — static className strings |
| More label toggle | `m.textContent = c ? 'More' : 'Less'` — fixed literals only |
| `personInto` path | `tx.appendChild(buildPersonBioBlock(document, pb.bio))` — element node; **not** `innerHTML` / `insertAdjacentHTML` |
| `personBio()` | String trim of bio/summary/tagline/about only; no HTML parse |
| New `innerHTML` / `insertAdjacentHTML` / `outerHTML` / `document.write` from server/user bio | **None** (whole plex-browse.js: **zero** such sinks) |
| dist `desktop.js` | Same: `b.textContent = String(bio ?? "")` + `appendChild`; personInto calls `buildPersonBioBlock` |

**FAIL criteria not met** — bio server text never enters HTML-string sinks.

### 4.2 Measure / polish removed (intentional)

| Prior (9385cf2) | Tip (6b370e9) |
|---|---|
| Unclamp height measure + length/newline fallback + double-rAF | **Removed** — always sync hard-visible More when bio non-empty |
| `insertAdjacentElement('afterend', m)` | Replaced by wrap + `appendChild` |
| Length gate / bioPolish / btn.remove | **Absent** (fu9g test asserts) |

No security regression from always-showing More: still textContent-only; UX-only change.

### 4.3 CSS

| Check | Result |
|---|---|
| Tip CSS | `.pxbiowrap{display:block;min-width:0}` + `.pxbiomore{display:block!important;…}` hard-visible; `.pxperson` adds `flex-direction:row` |
| `.pxbio.clamp` | Unchanged line-clamp:6 — CSS-only |
| Credits / Music CSS | Untouched KEEP asserts green |
| `url()` / expression with user content | **None** |

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 (account profile) | **8/8** — `egress.rs` / profile IPC / avatar allowlists **untouched** (zero Rust delta vs `9385cf2`) |
| Cred::Discover host×path | **Intact** — `DISCOVER_HOST` + `discover_ok` + `discover_people_url` + `Cred::Discover` arm + session gates in `mx.rs` unchanged |
| New commands / capabilities | **None** |
| New egress / host widen | **None** (delta has zero host/CORS/allowlist hits) |
| Discover residual | Scott-accepted — technical MUSTs hold → not a FAIL; no new residual this tip |

---

## 6. KEEP surface

| Surface | Status |
|---|---|
| browseHomeShared single-flight (`homeP`/`homeSg`/`srcGen` + soft retry) | **OK** — present; tip did not touch |
| Credits hover/focus (`a.pxcred` scale(1.05) + reduced-motion) | **OK** — CSS intact |
| Music checks (`pxMusicServers` / `el()` / localStorage) | **OK** — intact |
| Versions-only (`version_pick` opaque) | **OK** — intact |
| Metadata hydrate (`Cred::Server` + GUID/RK bounds in Rust) | **OK** — zero Rust delta |

**KEEP surface: OK** (none regressed). fu9g KEEP test green.

---

## 7. Breadth (whole tip vs 9385cf2)

| Class | Result |
|---|---|
| Secrets / tokens (rg classic patterns on tip surface) | Clean; **gitleaks / TruffleHog not installed** (skipped by name) |
| eval / shell / new Function (prod paths) | No new in delta; test-only `w.eval` in `fu7g-back.test.mjs` (carry, not tip); lint-shim blocks indirect eval/`new Function` in shim |
| New Cred / host allowlist / CORS widen | **None** (zero Rust/CI) |
| Unsanitized HTML sinks from server/user | **None new**; plex-browse still zero `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`; bio via `textContent`/`appendChild` |
| Lockfiles / deps | **Identical** — npm audit / OSV **N/A** for this tip (`osv-scanner` not installed) |
| CI workflows | Untouched |
| Artifacts | SHA256SUMS **OK** (3/3); literal `MOCK` in `plexuw` binary **0**; About Build shortsha **6b370e9ae0d5** + Frontend **363f552d72956b08** present; no `*-MOCK-DO-NOT-SHIP` sibling |

---

## 8. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS / test drift (blur px) — untouched this tip. |
| **LOW-MUS** | LOW | `musicServerName` unbound title parse — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` text-only (carry). |
| **INFO-SRV** | INFO | Manage-servers raw names via textContent (carry). |

No new HIGH/MED from this tip.  
**OOS:** none new beyond carry INFO / product test drift (LOW-R1). Always-sync More with textContent/`appendChild` only — no invented findings.

---

## 9. Tests / artifacts

| Suite | Result |
|---|---|
| `lint-shim.sh` | **ok** |
| `ar-video-confirm.test.mjs` + `fu9g-bio-more.test.mjs` | **15/15 pass** (incl. MED-XSS-1 + fu9g MUST-2 + jsdom DOM + KEEP) |
| Artifacts `6b370e9` | SHA256SUMS **OK**; MOCK **0**; Build **6b370e9ae0d5**; Frontend **363f552d72956b08** present |

---

## 10. Tools (by name)

| Tool | Status |
|---|---|
| ripgrep | Used — secrets patterns, HTML sinks, Cred/egress, eval, KEEP symbols |
| lint-shim.sh | ok — enforces no HTML sinks in plex-browse.js |
| node:test | 15/15 (ar-video-confirm + fu9g-bio-more) |
| sha256sum | Artifacts 3/3 OK; dist-tree hash matches About Frontend |
| gitleaks | **Not installed** — skipped |
| TruffleHog | **Not installed** — skipped |
| npm audit / OSV-Scanner | **N/A** (lockfiles unchanged); osv-scanner not installed |
| Semgrep / CodeQL | **Not installed** — skipped (manual sink review covered tip surface) |

---

## 11. Delta risk summary

**CLEAN** for MUST / Discover / SSRF / XSS / injection / host widen / secrets / egress. Tip replaces measure/length/polish path with always-sync `buildPersonBioBlock` (createElement + textContent + appendChild for `.pxbiowrap` / `.pxbiomore`) plus CSS hard-visible More; bio server text never enters HTML-string sinks; app.js/Rust/egress/lockfile untouched; MED-XSS-1 remains closed at `app.js:171` and in identical dist; Gate-B MOCK 0; About Build/Frontend hashes match artifact binary.

---

## 12. 3-line Master summary

1. **PASS** tip @ `6b370e9` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171` + dist identical; Frontend **363f552d72956b08**).  
2. Delta **clean** — `buildPersonBioBlock` appendChild/textContent only (no unsafe bio HTML); CSS hard-visible More; Rust/egress untouched; KEEP #1/#3/#4 OK; MOCK **0**.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-6b370e9.md` — replaces `9385cf2` for next Win candidate; **Win held** (Master: no Win/merge this kick).
