# CODE REVIEW — fu7u account-profile Push 2 avatar fix @ `4b42b6b`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW)  
**Date:** 2026-10-24 ~10:50 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only)  
**SHA:** `4b42b6bacf875ee16b6918d95a7eb2296871278b`  
**Parent:** `1637946` (prior PASS — real profile MUST 1–8)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/4b42b6b/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Claimed delta:** `egress.rs` only — `parse_account_avatar` upgrades `http→https` then allowlists; fetch stays https-only `Cred::PublicImage`.  
**Replaces 1637946 for Win gate.** Not merge / Win approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 prior residual; LOW-O1 + LOW-R1 prior open) |
| MUST 1–8 | **8/8 still PASS** (re-confirmed) |
| Watch items (redirect / host rewrite / query / SSRF / token) | **Clean** |

Delta is a one-file parse harden for live plex.tv thumbs that return `http://…/avatar`. Upgrade happens **before** `account_avatar_ok`; raw http remains unfetchable at `check`/`account_avatar_ok`. Soft-fail letter path unchanged.

---

## 2. Delta (exact)

```
parse_account_avatar:
  + if scheme == "http" { set_scheme("https") }
  + set_query(None)   (unchanged order relative to allowlist)
  + account_avatar_ok(&clean)  — still requires https + host plex.tv + path + no query/fragment
tests:
  + http://plex.tv/users/<id>/avatar?c=99 → parse → https URL, query gone
  + account_avatar_ok(http…) == false; check(http…) → Deny::Scheme
  − raw http removed from parse-refusal list (now upgraded, not refused at parse)
```

No changes to `proxy_public`, `Cred::PublicImage` token=`None`, `load_account_profile`, IPC, JS, Discover, or `account_user_ok`.

---

## 3. MUST compliance matrix (8) — re-confirm

| # | MUST | Status | Notes vs 1637946 / this tip |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII; no email fallback; no body log | **PASS** | Untouched. Thumb still only after `parse_account_avatar` → opaque id. Soft-fail letter intact when parse fails. |
| 2 | Avatar allowlist plex.tv `/users/<id>/avatar`; query strip; token-less PublicImage; CT/redirect/size | **PASS** | Query strip retained. **New:** http thumbs upgraded then allowlisted. Fetch URL always https (`account_avatar_ok` / `check`). PublicImage still token-less; CT/5MB/redirects-off unchanged. |
| 3 | Exact `plex.tv` × `/api/v2/user` only | **PASS** | Untouched. |
| 4 | GET; no query/fragment; header token; redirects off; never PMS | **PASS** | Untouched for user GET. Avatar: still no account token; redirects `Policy::none()`. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | Avatar matrix extended (http upgrade + Deny::Scheme on raw http). Mock/demo gates untouched. |
| 6 | Once + gen-cancel; soft-fail placeholder; Demo/mock unchanged | **PASS** | Untouched. Missing/failed thumb → letter (claimed soft-fail intact). |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched. |
| 8 | Scott implement approval | **PASS** | Prior; this tip is product fix under same approval surface. |

---

## 4. Breadth → depth on watch items

| Watch | Result |
|---|---|
| Open redirect via upgrade | **No.** Local scheme rewrite only; not following 3xx. Egress redirects still off. Fetch target = post-allowlist https URL only. |
| Arbitrary hosts after http→https | **No.** `account_avatar_ok` requires `host_str == Some("plex.tv")` exact. Probe: `evil.plex.tv`, `plex.tv.evil`, `127.0.0.1`, `[::1]`, `169.254.169.254` → host fail after upgrade. |
| Non-443 ports | **Denied.** `http://plex.tv:8080/…` keeps `:8080` → `port().is_some()` → fail. `:80`/`:443` on http normalize to default https:443 (url crate) — still exact host+default port; acceptable. |
| Query strip completeness | **Yes.** `set_query(None)` after upgrade; `?c=`, `?token=`, `?X-Plex-Token=` all stripped before store/fetch. `#` / `@` / `%` / `\` refused pre-parse. |
| SSRF | **No.** Host allowlist exact `plex.tv`; no IP literal accepted; path regex `/users/<id>/avatar` only. |
| Token leak on avatar fetch | **No.** `Cred::PublicImage` → token `None` (`egress.rs` send). Even if thumb query carried a token, strip removes it before fetch. Account/Server creds on avatar URL still Deny. |
| Case / IDN | `HTTP://` and `Plex.TV` normalize via url crate to https://plex.tv — allowlist still exact. ftp/other schemes not upgraded → fail scheme. |
| Discover / account_path | Untouched this tip. |

---

## 5. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior: avatar id charset `[0-9a-fA-F-]{8,64}` non-UUID residual — unchanged. |
| **LOW-O1** | LOW | Prior open: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior open: 3 node CSS fails — untouched. |
| INFO | — | `http://plex.tv:80` / `:443` normalize to default https after `set_scheme` (url crate); still host-exact + default 443. |
| INFO | — | Upgrade is parse-only convenience for live plex.tv http thumbs; raw http never passes `check`/`account_avatar_ok`. |

**No HIGH/MED.**

---

## 6. Tests run

| Suite | Result |
|---|---|
| `lint-shim` | ok |
| `cargo test --offline --lib` | **95 passed** |
| `cargo test --offline --lib --features mockplex` | **103 passed** |
| `shot_id.toml` | **deleted** |
| Artifacts | release-only; strings clean of mock markers; no MOCK sibling |

---

## 7. 3-line Master summary

1. **PASS** avatar fix @ `4b42b6b` (replaces `1637946` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; **8/8 MUSTs** still hold.  
2. Delta = `parse_account_avatar` http→https upgrade **then** allowlist; fetch stays https-only token-less PublicImage; no open-redirect/host-widen/SSRF/token-leak.  
3. mockplex **103** ok; shot_id deleted; **not** Win/merge approval.
