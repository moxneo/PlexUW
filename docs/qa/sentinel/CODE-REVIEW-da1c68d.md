# CODE REVIEW — Note 5b tip @ `da1c68d`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~18:05 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `da1c68d427e6961ca8590a54d608d6e3e7cf2918`  
**Prior PASS tip:** `58382c6` (CODE-REVIEW-58382c6.md — 0H/0M/4L; MED-XSS-1 closed; note-5 clean)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/da1c68d/` (+ FOREMAN-NOTE5.md map only) — release-only; **MOCK strings 0**  
**Commit:** `fix(fu8f): note-5 Available-on detail fan-out merge (Guid[]/RK/Media)`  
**Replaces `58382c6` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

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
| Notes 1–4 | **Untouched** this tip (no JS/CSS delta) |
| Note-5b | **Clean** — Guid[]→queryable_guid only; RK numeric bounds; reachable-first reorder; includeGuids static; presence stub clean(); show+Related same filters |

---

## 2. Delta (exact)

```
vs 58382c6 (5 files, +142/-14) — Rust only:
  desktop/src-tauri/src/commands.rs
  desktop/src-tauri/src/commands/mx.rs
  desktop/src-tauri/src/plex/browse.rs
  desktop/src-tauri/src/plex/fixture.rs
  desktop/src-tauri/src/plex/merge.rs

app.js / desktop.css / desktop.js / plex-browse.js /
capabilities / permissions / lockfiles : ZERO
```

FOREMAN-NOTE5.md used as map only; claims verified in code.

---

## 3. MED-XSS-1 + Notes 1–4

| Check | Result |
|---|---|
| `git diff 58382c6..da1c68d -- app.js` | **Empty** |
| Source sink `app.js:171` | Still `${esc(n)}` / `${esc(s)}` |
| Notes 1–4 CSS/layout | **No files** in this tip |
| Shim / ar-video / push3-6-9 | Green; lint-shim ok |

**Still CLOSED / not reopened.**

---

## 4. Note-5b depth

### 4.1 `item_queryable_guid` / `raw_has_guid` / `raw_rating_key`

| Check | Result |
|---|---|
| Guid source | Primary `guid`, else `Guid[].id` (take 8) — **only** via existing `queryable_guid` |
| `queryable_guid` | Still `plex://{movie\|show\|episode\|season}/` + alnum id ≤32 |
| Egress gate | `server_path("/library/all")` still requires `queryable_guid(v)` on the single `guid=` pair |
| Encoding | `enc()` = `form_urlencoded` — no raw injection into query |
| `raw_has_guid` | Equality match vs already-validated guid (primary or Guid[]) |
| `raw_rating_key` | u64/i64 in `1..=999_999_999_999` or digit string ≤12 — no path injection |

### 4.2 `fanout_others` (reachable-first)

| Check | Result |
|---|---|
| Server set | Still `mx::ranked` minus current mid — **no new hosts** |
| Effect | Sort only: warm/current first, then name |
| SSRF / open-redirect | **None** |
| Amplification | Same MAX_SERVERS / take(4) caps; soft deadline unchanged |

### 4.3 `includeGuids=1`

| Check | Result |
|---|---|
| Where | Static query on `Api::Metadata` only |
| Path allowlist | `/library/metadata/[0-9]{1,12}` unchanged |
| Cred | Still `Cred::Server(mid)` via `browse::get` / `fetch_on` |

### 4.4 `versions_or_presence`

| Check | Result |
|---|---|
| Behavior | Prefer `versions_of(Media[])`; else one presence stub (media index 0) |
| Server label | `clean(server, 60)` — control strip + cap (same as versions_of) |
| Id | Opaque `slots.mint_if` Target::Version — no raw RK to JS |
| UI | Available/sources still via `avail_of` → `friendly_name` / `sources_of` |

### 4.5 Show + Related

| Surface | Change | Risk |
|---|---|---|
| Show Available-on | `item_queryable_guid` + `raw_has_guid` + `fanout_others` | Same filters as movie/episode |
| `related` | `item_queryable_guid` + `raw_has_guid` + `raw_rating_key`; Related path uses u64 | Same rules; others still ranked (not reachable-first — product only) |

**Note-5b risk summary: CLEAN** for MUST / Discover / SSRF / XSS / injection.

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 | **8/8** — egress/avatar/user path untouched |
| ACCOUNT_HOSTS | Unchanged |
| Cred::Discover | Intact (spot-check) |
| New commands / capabilities | **None** |

---

## 6. Breadth

| Class | Result |
|---|---|
| Secrets / X-Plex-Token | Clean in tip |
| eval / shell / new Function | None |
| New Cred / host allowlist | None |
| Lockfiles / npm / crates | Untouched |
| Fixture mockplex only | `byguid_live_shape` behind `#[cfg(feature = "mockplex")]` tests |
| Artifacts | SHA256SUMS OK; MOCK **0** |

---

## 7. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior avatar charset — untouched. |
| **LOW-O1** | LOW | Prior Demo `data-person` — untouched. |
| **LOW-R1** | LOW | Prior node CSS fails — untouched. |
| **LOW-MUS** | LOW | `musicServerName` unbound `server` — untouched. |
| **INFO-OOS** | INFO | Dead `.pxpmenu` (carry). |
| **INFO-COL** | INFO | Collage no ORIGIN/HEX re-validate (carry). |
| **INFO-RH** | INFO | `returnHash` not `/^#/`-gated (carry). |
| **INFO-ESC** | INFO | `esc()` text-only (carry). |
| **INFO-SRV** | INFO | Manage-servers `ServerView.name` raw `take(120)` via textContent (carry). |

No new HIGH/MED/LOW from note-5b.

---

## 8. Tests / artifacts

| Suite | Result |
|---|---|
| `ar-video-confirm.test.mjs` | **11/11 pass** |
| `push3-6-9.test.mjs` | **4/4 pass** |
| `lint-shim.sh` | ok |
| Artifacts `da1c68d` | SHA256SUMS **OK**; MOCK files **0**; MOCK strings **0** |

---

## 9. 3-line Master summary

1. **PASS** Note 5b tip @ `da1c68d` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Note-5b **clean** — Guid[] only via queryable_guid; RK numeric bounds; fanout reorder only; includeGuids static; presence stub cleaned; show+Related same rules.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-da1c68d.md` — replaces `58382c6` for Win gate; **Win held** for da Vinci LIVE.
