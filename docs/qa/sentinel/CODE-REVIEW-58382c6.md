# CODE REVIEW — Note 5 tip @ `58382c6`

**Verdict: PASS** (0 HIGH / 0 MED / 4 LOW + 5 INFO)  
**Date:** 2026-10-24 ~17:45 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `58382c63109c249881c2e3ae79e1c2a103b93920`  
**Prior PASS tip:** `023a81d` (CODE-REVIEW-023a81d.md — 0H/0M/4L; MED-XSS-1 closed; servers_warm clean)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/58382c6/` (+ FOREMAN-NOTE5.md map only) — release-only; **MOCK strings 0**  
**Commit:** `Note 5 tip: Available-on full union across connected servers`  
**Replaces `023a81d` for Win gate.** **Not** Win/merge — da Vinci LIVE still held.

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
| Notes 1–4 | **Untouched** this tip (`desktop.css` / hero CSS delta empty) |
| Note-5 replan | **Clean** — parallel warm, Reachable bool, stagger timing only, ERR_TTL, sources seed via `friendly_name`, static pending/search copy |

---

## 2. Delta (exact)

```
vs 023a81d (6 files, +60/-18):
  desktop/shim/desktop.js
  desktop/shim/plex-browse.js
  desktop/shim/test/ar-video-confirm.test.mjs
  desktop/src-tauri/src/commands.rs
  desktop/src-tauri/src/commands/mx.rs
  desktop/src-tauri/src/plex/api.rs

app.js / desktop.css / capabilities / permissions : ZERO
```

FOREMAN-NOTE5.md used as claimed-surface map only; all claims verified in code.

---

## 3. MED-XSS-1 + Notes 1–4

| Check | Result |
|---|---|
| `git diff 023a81d..58382c6 -- app.js` | **Empty** |
| Source sink `app.js:171` | Still `${esc(n)}` / `${esc(s)}` |
| Notes 1–4 CSS/layout | **No files** in this tip |
| Regression test MED-XSS-1 | Still green |

**Still CLOSED / not reopened.**

---

## 4. Note-5 depth

### 4.1 Parallel `servers_warm`

| Check | Result |
|---|---|
| Args from JS | Still **none** |
| Targets | Still `mx::ranked` (online account resources, ≤16) |
| Connect | Still `conn_for` → `api::race` / Cred::None identity + machine_id match |
| Change | Sequential → `join_all` parallel |
| Capability | Unchanged (`allow-servers-warm` already present) |
| Amplification | Concurrent races capped at MAX_SERVERS — intentional product warm, not a new host class |

### 4.2 Manage Reachable

| Check | Result |
|---|---|
| New field | `ServerView.reachable: bool` — cached conn or current preferred |
| Leak | No URLs, tokens, machineIds, IPs |
| UI | `el()` textContent tags (“Reachable” / “In library”); awaits `servers_warm` before `servers_list` |

### 4.3 `stagger_conn`

| Check | Result |
|---|---|
| Effect | Timing only: non-`.plex.direct` Remote → stagger 0 |
| Host set / Cred | Unchanged — still resources `s.conns` https only |
| SSRF / open-redirect | **None** |

### 4.4 `ERR_TTL` 8s

| Check | Result |
|---|---|
| Effect | Failed fan-out cache (`None`) expires in 8s vs success TTL 60s |
| Security | Reduces stale-empty poison; expired → `pending` + re-gather |
| Egress allowlist | Untouched |

### 4.5 Detail `sources` ∪ `available` + pending + search copy

| Surface | Sink | Filter |
|---|---|---|
| `it.sources = sources_of(available…)` | Watch-from / availNames (pre-existing `el` / textContent) | `available` via `avail_of`→`friendly_name`; `sources_of` also `friendly_name` (empty if &lt;2 names — product) |
| “Checking other servers…” | Static `el('span',…)` | N/A |
| Search empty hint | `pkHint` → `el(..., textContent)`; multi → static “across your servers”; single still `server` name as text | textContent |

No new HTML-parsing sinks; lint-shim ok. version_pick / opaque ids unchanged.

**Note-5 risk summary: CLEAN** for MUST / Discover / SSRF / XSS.

---

## 5. MUST / Discover

| Gate | Status |
|---|---|
| MUST 1–8 | **8/8** — egress/avatar/user path untouched |
| ACCOUNT_HOSTS | Unchanged |
| Cred::Discover | Intact (spot-check) |
| Capabilities tip | None (no new commands) |

---

## 6. Breadth

| Class | Result |
|---|---|
| Secrets / X-Plex-Token | Clean in tip |
| eval / shell / new Function | None |
| New Cred / host allowlist | None |
| Lockfiles | Untouched |
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
| **INFO-SRV** | INFO | Manage-servers `ServerView.name` still raw `take(120)` via textContent (carry; Reachable is bool-only). |

---

## 8. Tests / artifacts

| Suite | Result |
|---|---|
| `ar-video-confirm.test.mjs` | **11/11 pass** (Reachable / across your servers / Checking…) |
| `push3-6-9.test.mjs` | **4/4 pass** |
| `lint-shim.sh` | ok |
| Artifacts `58382c6` | SHA256SUMS **OK**; MOCK files **0**; MOCK strings **0** |

---

## 9. 3-line Master summary

1. **PASS** Note 5 tip @ `58382c6` — **0 HIGH / 0 MED / 4 LOW**; MUST **8/8** + Discover intact; MED-XSS-1 still closed (`app.js:171`).  
2. Note-5 **clean** — parallel warm (no JS URL), Reachable bool, stagger timing only, ERR_TTL 8s, sources←available via friendly_name, pending/search textContent.  
3. Report: `/workspace/plexuw-account-profile-plan/CODE-REVIEW-58382c6.md` — replaces `023a81d` for Win gate; **Win held** for da Vinci LIVE.
