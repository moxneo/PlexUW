# CODE REVIEW — tip @ `9385cf2`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~19:45 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat; authorized TTGDevX/PlexUW only)  
**SHA:** `9385cf2653c4e1922c94205fda32c2939afd36da`  
**Prior PASS tip:** `98dd3456e39ba86a1175977831545bc4bed9336d` (CODE-REVIEW-98dd345.md — 0H/0M/4L; MED-XSS-1 closed)  
**Worktree:** `/workspace/plexuw-fu7i` @ HEAD `9385cf2653c4e1922c94205fda32c2939afd36da`  
**Artifacts:** `/home/box/plexuw-artifacts/9385cf2/` — About Build **9385cf2653c4**; release-only; **MOCK strings 0**  
**Commit:** `tip(fu9c): person bio More/Less via unclamp height measure + length fallback`  
**Replaces `98dd345` for next Win candidate.** **Not** Win/merge this kick — da Vinci LIVE still held (Master: no Win).

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
| Delta | **Clean** — personInto unclamp height measure + length/newline fallback; textContent/`el()`/`insertAdjacentElement` only; zero CSS/Rust/egress/lockfile/host widen; no new unsanitized HTML sinks |

---

## 2. Delta (exact)

```
vs 98dd3456e39b (2 files, +47/-8):
  desktop/shim/plex-browse.js              (personInto More/Less: unclamp measure + length fallback)
  desktop/shim/test/fu9c-bio-more.test.mjs (new — fu9c MUST-2 + KEEP asserts)

app.js / desktop.js / desktop.css / commands / egress / capabilities /
permissions / host allowlists / Cargo.lock / package-lock.json / CI : ZERO
```

Master-stated focus after breadth:
1. `desktop/shim/plex-browse.js` `personInto` overflow path — **JS only**; measure + length fallback; no HTML sinks
2. Any CSS touch — **None** this tip (`.pxbio` / Credits / Music CSS from `98dd345` kept)
3. build/Gate-B MOCK 0 — **Confirmed**
4. MED-XSS-1 still closed — **Yes** (`app.js:171`)
5. No new secrets/egress/XSS — **Confirmed**

---

## 3. MED-XSS-1

| Check | Result |
|---|---|
| `git diff 98dd3456e39b..9385cf2653c4 -- app.js` | **Empty** (0 bytes) |
| Source sink `app.js:171` | Still `` `${esc(n)}` `` / `` `${esc(s)}` `` |
| `ar-video-confirm.test.mjs` MED-XSS-1 subtest | **Green** (suite 14/14 with fu9c) |
| lint-shim.sh | **ok** (plex-browse.js still has zero HTML sinks) |

**Still CLOSED / not reopened.** Proof line:

```
app.js:171 — return list.map(([n,s,on],k)=>`... <b>${esc(n)}</b>...<span class="muted small">${esc(s)}</span> ...`)
```

---

## 4. Depth (personInto unclamp + length fallback)

### 4.1 Bio into DOM — XSS

| Check | Result |
|---|---|
| Bio into DOM | `el('p', 'pxsum pxbio clamp', pb.bio)` → **textContent** (`plex-browse.js:321` `el`; `:1259`) |
| `personBio()` | String trim of bio/summary/tagline/about only (`:184–190`); no HTML parse |
| More/Less button | `el('button', 'pxlink', 'More')` → textContent; `m.textContent = c ? 'More' : 'Less'` |
| Insert | `insertAdjacentElement('afterend', m)` — element node, **not** `insertAdjacentHTML` |
| Duplicate guard | `nextElementSibling.classList.contains('pxlink')` — classList only |
| New `innerHTML` / `insertAdjacentHTML` / `outerHTML` / `document.write` from server/user | **None** (whole plex-browse.js: **zero** such sinks) |

### 4.2 Measure-only DOM ops

| Check | Result |
|---|---|
| Unclamp | `b.classList.remove('clamp')` → read `scrollHeight` → `classList.add('clamp')` → read `clientHeight` |
| Compare | `fullH > clampH + 1` then `addMoreLess()` |
| Length fallback | `pb.bio` string: `t.length > 280` OR newline count `>= 7` — no DOM HTML, no network |
| Double rAF | `requestAnimationFrame(() => requestAnimationFrame(measureOverflow))` — layout settle only |
| Toggle | `classList.toggle('clamp')` + fixed label textContent — no sink |

**No invented findings** on measure/unclamp/length-fallback with textContent-only path.

### 4.3 CSS

| Check | Result |
|---|---|
| Tip CSS diff | **Empty** |
| Kept `.pxbio` clamp | `.pxbio.clamp` line-clamp:6 (from prior tip) — CSS-only |
| Credits / Music CSS | Untouched; KEEP asserts green |

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 (account profile) | **8/8** — `egress.rs` / profile IPC / avatar allowlists **untouched** (zero Rust delta vs `98dd345`) |
| Cred::Discover host×path | **Intact** — `discover_people_url` + session gates unchanged |
| New commands / capabilities | **None** |
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

**KEEP surface: OK** (none regressed).

---

## 7. Breadth (whole tip vs 98dd345)

| Class | Result |
|---|---|
| Secrets / tokens (rg classic patterns on tip surface) | Clean; **gitleaks / TruffleHog not installed** (skipped by name) |
| eval / shell / new Function (prod paths) | No new in delta; lint-shim blocks indirect eval/`new Function` in shim |
| New Cred / host allowlist / CORS widen | **None** (zero Rust/CI) |
| Unsanitized HTML sinks from server/user | **None new**; plex-browse still zero `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`; bio via `el()` textContent |
| Lockfiles / deps | **Identical** — npm audit / OSV **N/A** for this tip (`osv-scanner` not installed) |
| CI workflows | Untouched |
| Artifacts | SHA256SUMS **OK** (3/3); literal `MOCK` in `plexuw` binary **0**; About Build shortsha **9385cf2653c4** present; no `9385cf2-MOCK-DO-NOT-SHIP` sibling |

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
**OOS:** none new beyond carry INFO / product test drift (LOW-R1). Measure/unclamp/length-fallback with textContent only — no invented findings.

---

## 9. Tests / artifacts

| Suite | Result |
|---|---|
| `lint-shim.sh` | **ok** |
| `ar-video-confirm.test.mjs` + `fu9c-bio-more.test.mjs` | **14/14 pass** (incl. MED-XSS-1 + fu9c MUST-2 + KEEP) |
| Artifacts `9385cf2` | SHA256SUMS **OK**; MOCK **0**; Build **9385cf2653c4** present |

---

## 10. Tools (by name)

| Tool | Status |
|---|---|
| ripgrep | Used — secrets patterns, HTML sinks, Cred/egress, eval, KEEP symbols |
| lint-shim.sh | ok — enforces no HTML sinks in plex-browse.js |
| node:test | 14/14 (ar-video-confirm + fu9c-bio-more) |
| gitleaks | **Not installed** — skipped |
| TruffleHog | **Not installed** — skipped |
| npm audit / OSV-Scanner | **N/A** (lockfiles unchanged); osv-scanner not installed |

---

## 11. Delta risk summary

**CLEAN** for MUST / Discover / SSRF / XSS / injection / host widen / secrets / egress. Tip only changes personInto overflow detection (temporary unclamp for height measure + string length/newline fallback) and adds a source-structure test; bio and More/Less remain `el()`/textContent/`insertAdjacentElement`; no CSS/Rust/app.js/lockfile delta; MED-XSS-1 remains closed at `app.js:171`; Gate-B MOCK 0.

---

## 12. 3-line Master summary

1. **PASS** tip @ `9385cf2` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Delta **clean** — personInto unclamp height measure + length fallback; textContent/`el()` only; CSS/Rust/egress untouched; KEEP surface OK; MOCK **0**.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-9385cf2.md` — replaces `98dd345` for next Win candidate; **Win held** (Master: no Win/merge this kick; da Vinci LIVE).
