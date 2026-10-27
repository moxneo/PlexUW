# CODE REVIEW — tip @ `98dd345`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~19:29 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat; authorized TTGDevX/PlexUW only)  
**SHA:** `98dd3456e39ba86a1175977831545bc4bed9336d`  
**Prior PASS tip:** `eefc9c0904e89807f227bc0938b683968b645ab8` (CODE-REVIEW-eefc9c0.md — 0H/0M/4L; MED-XSS-1 closed)  
**Worktree:** `/workspace/plexuw-fu7i` @ HEAD `98dd3456e39ba86a1175977831545bc4bed9336d`  
**Artifacts:** `/home/box/plexuw-artifacts/98dd345/` — About Build **98dd3456e39b**; release-only; **MOCK strings 0**  
**Commit:** `tip(fu9b): A–D startup single-flight + bio overflow More/Less + Credits hover scale + Music server checks`  
**Replaces `eefc9c0` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

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
| Delta | **Clean** — CSS + plex-browse single-flight / bio overflow / Music checkmarks; no Rust/egress/lockfile/host widen; no new unsanitized HTML sinks |

---

## 2. Delta (exact)

```
vs eefc9c0904e8 (2 files, +95/-15):
  desktop/shim/desktop.css     (Credits hover/focus scale; person gap/bio; filmography wrap; Music checkmark styles)
  desktop/shim/plex-browse.js  (browseHomeShared single-flight + soft retry; person More/Less overflow; musicPage checkmarks)

app.js / desktop.js / commands / egress / capabilities /
permissions / host allowlists / Cargo.lock / package-lock.json / CI : ZERO
```

Master-stated focus after breadth:
1. `browseHomeShared` single-flight + navState + soft retry — **JS only**; still `invoke('browse_home')`; srcGen-gated
2. Person bio More/Less overflow — **textContent** via `el()` + class toggle; CSS clamp
3. Credits circle hover/focus — **CSS only** (`a.pxcred` scale / focus ring on `i`)
4. Music `pxMusicServers` checkmarks on `#px/music` — **`el()` + textContent**; localStorage prefs only

Keep MED-XSS-1 closed. Gate-B MOCK 0. **Both hold.**

---

## 3. MED-XSS-1

| Check | Result |
|---|---|
| `git diff eefc9c0904e8..98dd3456e39b -- app.js` | **Empty** |
| Source sink `app.js:171` | Still `` `${esc(n)}` `` / `` `${esc(s)}` `` |
| `ar-video-confirm.test.mjs` MED-XSS-1 subtest | **Green** (12/12 suite) |
| lint-shim.sh | **ok** (plex-browse.js still has zero HTML sinks) |

**Still CLOSED / not reopened.**

---

## 4. Depth (Master deltas)

### 4.1 browseHomeShared (A) — race / TOCTOU / retry / egress

| Check | Result |
|---|---|
| Single-flight | `homeP` + `homeSg === sg` share one in-flight `browse_home` across `loadSections` / `home` / section warm / musicPage |
| Cancelled nav | `take` and callers gate on `sg !== srcGen` / `g !== gen` before applying `sections` or painting |
| setSource clear | `srcGen++; homeP = null; homeSg = -1` before reload; old promise `finally` only clears when `homeSg === sg` (won't wipe the new flight) |
| Soft retry | One 350 ms delay + one re-`invoke('browse_home')` on first fail; same command; **no** new hosts, paths, or Cred |
| Capability / host allowlist | Unchanged Rust `browse_home` + egress; retry cannot bypass allowlists |
| Amplification | At most 2× `browse_home` on failure path (session-restore soft retry) — not a security defect |
| XSS / injection | None — no HTML sinks; navState UI via `el()` / textContent |

### 4.2 Person bio More/Less (B)

| Check | Result |
|---|---|
| Bio into DOM | `el('p', 'pxsum pxbio clamp', pb.bio)` → **textContent** (`plex-browse.js:321`) |
| `personBio()` | String trim of bio/summary/tagline/about only; no HTML parse |
| More/Less | Overflow detect (`scrollHeight > clientHeight`); button via `el()`; `classList.toggle('clamp')`; `insertAdjacentElement` (element node, **not** `insertAdjacentHTML`) |
| CSS | `.pxbio.clamp` line-clamp only |
| New `innerHTML` from server/user | **None** |

### 4.3 Credits hover/focus (C)

| Check | Result |
|---|---|
| Change class | CSS: scale(1.05) on `a.pxcred:hover/focus-visible i`; focus ring moved onto `i`; `prefers-reduced-motion` disable |
| JS / Credits sinks | **Untouched** — no plex-browse Credits hunk; cast/Versions still prior `el()` path |
| XSS / injection | **None** — CSS-only |

### 4.4 Music pxMusicServers checkmarks on `#px/music` (D)

| Check | Result |
|---|---|
| Server names in UI | `el('span', null, n)` → **textContent**; `cb.dataset.srv = n` (DOMString attr, not HTML parse) |
| Prefs | `localStorage` `{all}` / `{servers}` filter of already-loaded `sections`; emits `pxmusicprefs` |
| Network / host | **No** new fetch, host, or Cred; filter is client-side only |
| Auto-open | Only when `allArtist.length === 1 && list.length === 1` (not filter-left-one) — UX; no security impact |
| LOW-MUS carry | `musicServerName` still title-` · `-parse / `server` fallback — unchanged class |

**Delta risk summary: CLEAN** for MUST / Discover / SSRF / XSS / injection / host widen. Soft retry is same-command bounded re-invoke under srcGen gates.

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 (account profile) | **8/8** — `egress.rs` / profile IPC / avatar allowlists **untouched** vs `eefc9c0` |
| Cred::Discover host×path | **Intact** — `discover_people_url` + session gates unchanged (no Rust delta) |
| New commands / capabilities | **None** |
| Discover residual | Scott-accepted — technical MUSTs hold → not a FAIL; no new residual this tip |

---

## 6. Breadth (whole tip vs eefc9c0)

| Class | Result |
|---|---|
| Secrets / tokens (rg classic patterns) | Clean in tip surface; **gitleaks / TruffleHog not installed** (skipped by name) |
| eval / shell / new Function (prod paths) | No new in delta; lint-shim blocks indirect eval/`new Function` in shim |
| New Cred / host allowlist / CORS widen | **None** (zero Rust/CI) |
| Unsanitized HTML sinks from server/user | **None new**; plex-browse still zero `innerHTML`/`insertAdjacentHTML`/`outerHTML`/`document.write`; bio/Music via `el()` textContent |
| Lockfiles / deps | **Identical** — npm audit / OSV **N/A** for this tip (`osv-scanner` not installed) |
| CI workflows | Untouched |
| Artifacts | SHA256SUMS **OK** (3/3); literal `MOCK` in `plexuw` binary **0**; About Build **98dd3456e39b**; no `98dd345-MOCK-DO-NOT-SHIP` sibling |

---

## 7. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS / test drift (blur px) — untouched this tip. |
| **LOW-MUS** | LOW | `musicServerName` unbound title parse — untouched; new Music checkmarks reuse same helper safely via textContent. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` text-only (carry). |
| **INFO-SRV** | INFO | Manage-servers raw names via textContent (carry). |

No new HIGH/MED from this tip.  
**OOS:** none new beyond carry INFO / product test drift (LOW-R1). CSS-only Credits + layout gap/filmography wrap — no invented findings.

---

## 8. Tests / artifacts

| Suite | Result |
|---|---|
| `lint-shim.sh` | **ok** |
| `ar-video-confirm.test.mjs` | **12/12 pass** (incl. MED-XSS-1 + fu9a MUST-3) |
| Artifacts `98dd345` | SHA256SUMS **OK**; MOCK **0**; Build **98dd3456e39b** present |

---

## 9. Tools (by name)

| Tool | Status |
|---|---|
| ripgrep | Used — secrets patterns, HTML sinks, Cred/egress, eval |
| lint-shim.sh | ok — enforces no HTML sinks in plex-browse.js |
| gitleaks | **Not installed** — skipped |
| TruffleHog | **Not installed** — skipped |
| npm audit / OSV-Scanner | **N/A** (lockfiles unchanged); osv-scanner not installed |

---

## 10. 3-line Master summary

1. **PASS** tip @ `98dd345` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Delta **clean** — browseHomeShared single-flight/srcGen + soft same-command retry; bio More/Less textContent; Credits CSS hover; Music checkmarks `el()`/localStorage only; MOCK **0**.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-98dd345.md` — replaces `eefc9c0` for Win gate; **Win held** for da Vinci LIVE.
