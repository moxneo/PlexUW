# CODE REVIEW — fu7u avatar paint (one CDN hop) @ `f25bdde`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW)  
**Date:** 2026-10-24 ~11:15 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only; white-hat)  
**SHA:** `f25bdde751b04c81e0dc17af0fd49b63a6193616`  
**Parent:** `4b42b6b` (prior PASS — avatar http→https parse harden)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/f25bdde/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** mock sibling)  
**Claimed delta:** `commands.rs`, `egress.rs`, `fixture.rs`, `transport.rs` — account avatars may follow **one** re-validated hop to `assets.plex.tv`; cast PublicImage redirects still refused.  
**Replaces 4b42b6b for Win gate.** Not merge / Win approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 prior residual; LOW-O1 + LOW-R1 prior open) |
| MUST 1–8 | **8/8 still PASS** (re-confirmed; MUST-2 spirit retained with narrow CDN hop) |
| Watch items (open-redirect / host-widen / SSRF / token / Location IPC) | **Clean** |

Delta implements live plex.tv avatar 302 → `assets.plex.tv/avatars/<40-hex>.` by following **at most one** hop after `parse_account_avatar_cdn` / `account_avatar_cdn_ok`. Cast path and multiplex `send`/`send_capped` still refuse all 3xx. `ACCOUNT_HOSTS` unchanged. IPC/store stays opaque plex.tv avatar URL; CDN resolve only at fetch. Token never on avatar or CDN hop. Location never logged / never to JS.

---

## 2. Delta (exact)

```
Files (vs 4b42b6b): commands.rs, egress.rs, fixture.rs, transport.rs
  150 insertions(+), 17 deletions(-)
Cargo.lock / Cargo.toml: unchanged (dependency N/A vs prior)

transport.rs:
  + Resp.location: Option<String> — captured only on 3xx, chars().take(400)
  + never Content-Type-adjacent for 2xx; other headers still dropped
  + redirects still Policy::none(); https_only unchanged

egress.rs:
  + ACCOUNT_AVATAR_CDN_HOST = "assets.plex.tv" (NOT in ACCOUNT_HOSTS)
  + account_avatar_cdn_ok: https:443, exact host, path ^/avatars/[0-9a-f]{40}\.$,
    no userinfo/query/fragment/dot-segments; port default only
  + parse_account_avatar_cdn: strip query; http→https upgrade then allowlist;
    refuse \ @ # ; refuse % outside query (base path literal)
  + parse_account_avatar: same % rule (query may contain %; base refuses %)
  + Cred::PublicImage check: also account_avatar_cdn_ok; CDN host → Path else Host
  + send_public_image (new): token=None; cast → single GET, any 3xx → Redirect;
    avatar (account_avatar_ok) may follow ONE 301|302|307|308 after
    parse_account_avatar_cdn + check(PublicImage); second hop 3xx → Redirect
  + send / send_capped: still Redirect on any 3xx (unchanged multiplex)

commands.rs:
  + proxy_public uses send_public_image (was send_capped PublicImage)

fixture.rs:
  + plex.tv avatar fixture → 302 Location live-shaped CDN URL (with ?cachebust)
  + assets.plex.tv GET → 200 jpeg for matching /avatars/<40-hex>.
  + Resp.location wired on all fixture Resp constructors
```

No changes to Discover, account_user_ok, IPC ProfileIpc shape, or JS.

---

## 3. MUST compliance matrix (8) — re-confirm

| # | MUST | Status | Notes vs 4b42b6b / this tip |
|---|---|---|---|
| 1 | IPC name + opaque thumb; strip PII; no email fallback; no body log | **PASS** | Untouched shape. `ProfileIpc { name, thumb }`; thumb opaque 32-hex; store/IPC bare `https://plex.tv/users/<id>/avatar`. Soft-fail letter intact. Location never in ProxyResp/IPC. |
| 2 | Avatar allowlist + token-less PublicImage; CT/size; **new** one re-validated CDN hop | **PASS** | plex.tv `/users/<id>/avatar` query-stripped retained. **New:** one hop only if Location passes `parse_account_avatar_cdn` → exact `assets.plex.tv` `/avatars/<40-hex>.` (trailing `.` live key). Cast redirects still refused. Token still None. CT jpeg/png/webp + 5MB unchanged. Spirit of MUST-2 held (narrow; no arbitrary plex.tv images; no token on avatar/CDN). |
| 3 | Exact `plex.tv` × `/api/v2/user` only | **PASS** | Untouched. Home paths still Deny. |
| 4 | GET; no query/fragment on user; header token; redirects off for user; never PMS | **PASS** | User GET still via `send` → Redirect on 3xx. Avatar/CDN: token None; redirects off except the one validated hop. |
| 5 | Deny matrix + demo/mock zero user calls | **PASS** | CDN matrix + Account/Server on assets → Deny::Host. mockplex auto-fetch early-return untouched. Demo gate untouched. |
| 6 | Once + gen-cancel; soft-fail placeholder; Demo/mock unchanged | **PASS** | Untouched. Fixture now 302→CDN; e2e proxy still 200 jpeg. Soft-fail letter when thumb missing/fail. |
| 7 | `/api/v2/home/*` Deny | **PASS** | Untouched; tests still assert Deny::Path. |
| 8 | Scott implement approval | **PASS** | Prior; this tip under same account-profile surface. |

---

## 4. Breadth → depth on watch items

| Watch | Result |
|---|---|
| Open redirect via Location | **No.** Follow only if `is_avatar && 301\|302\|307\|308` and `parse_account_avatar_cdn(loc)` succeeds; then `check(PublicImage)`. Second hop any 3xx → Redirect. Cast (`!is_avatar`) any 3xx → Redirect. Evil hosts (`evil.plex.tv`, `assets.plex.tv.evil`, `plex.tv/avatars`, metadata-static, IPs, short hash, missing trailing `.`, `../`, uppercase hex, `%` in path) → parse None → Redirect; no fetch. |
| Relative Location bypass | **No.** `Url::parse` on relative `/avatars/…` and protocol-relative `//host/…` → RelativeUrlWithoutBase → None. **No** join against request URL. FAIL-if-broken item clean. |
| Host-widen / ACCOUNT_HOSTS | **No.** `ACCOUNT_HOSTS == ["plex.tv","clients.plex.tv"]` unchanged. `assets.plex.tv` not an account host. Cred::Account/Server on CDN → Deny::Host. CDN only via PublicImage. |
| SSRF | **No.** Exact host string; no IP literals; no port overrides (`port().is_none()`); no userinfo (`@` refused + username empty); path regex exact incl. trailing `.`. |
| Token on avatar / CDN hop | **No.** `send_public_image` always `token: None`. Fixture returns 401 if tok present on either host. |
| Location logged / IPC | **No.** No log of location. `ProxyResp` = status/content_type/body only. IPC thumb is opaque id; stored URL remains plex.tv avatar. |
| Multiplex `send` / non-public-image | **Clean.** `send_capped` still `if (300..400) { Redirect }` with no Location follow. Transport still `Policy::none()`. |
| Query / `%` | **OK.** Live `?c=…%…` strips on plex.tv and CDN parse; `%` in base (path/host) refused. |
| Case / FQDN trailing dot | Host lowercased by url crate → exact match. `assets.plex.tv.` (trailing host dot) ≠ allowlist → refuse. |

---

## 5. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Prior: avatar id charset `[0-9a-fA-F-]{8,64}` non-UUID residual — unchanged. |
| **LOW-O1** | LOW | Prior open: Demo `data-person` esc — untouched. |
| **LOW-R1** | LOW | Prior open: 3 node CSS fails — untouched. |
| INFO | — | Relative / protocol-relative Location fail at `Url::parse` (no base join) → Redirect. Intentional; safe. |
| INFO | — | CDN path regex lowercase `[0-9a-f]{40}` only (matches live object keys). |
| INFO | — | Cargo.lock unchanged this tip — dependency advisory N/A vs prior tip. |

**No HIGH/MED.**

---

## 6. Tests run

| Suite | Result |
|---|---|
| `desktop/shim/lint-shim.sh` | ok |
| `cargo test --offline --lib` | **96 passed** (+1 CDN allowlist vs 4b42b6b’s 95) |
| `cargo test --offline --lib --features mockplex` | **104 passed** (+1 vs prior 103) |
| `account_profile_ipc_and_avatar_proxy` (mockplex) | **ok** — proxy 200 jpeg after fixture 302→CDN hop |
| `account_avatar_cdn_allowlist_and_live_shaped_query` | **ok** |
| `shot_id.toml` | still deleted |
| Artifacts | SHA256SUMS verify OK; release-only; **no** `*-MOCK-DO-NOT-SHIP` sibling; strings: no `MOCK-DO-NOT-SHIP` / no `mockplex` |
| Dependency | N/A (Cargo.lock not in tip) |

---

## 7. 3-line Master summary

1. **PASS** avatar CDN one-hop @ `f25bdde` (replaces `4b42b6b` for Win gate) — **0 HIGH / 0 MED / 3 LOW**; **8/8 MUSTs** still hold.  
2. Delta = `send_public_image` follows **one** re-validated Location to `assets.plex.tv/avatars/<40-hex>.` only; cast + multiplex still refuse all 3xx; ACCOUNT_HOSTS unchanged; no open-redirect/host-widen/SSRF/token/Location-IPC leak.  
3. lib **96** / mockplex **104** ok; artifacts release-only clean; **not** Win/merge approval.
