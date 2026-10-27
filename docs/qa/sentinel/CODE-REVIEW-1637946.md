# CODE REVIEW — fu7u account profile Push 2 @ `1637946`

**Verdict: PASS** (0 HIGH / 0 MED / 3 LOW)  
**Date:** 2026-10-24 ~10:40 America/New_York (EDT)  
**Reviewer:** Sentinel (code delta; read-only)  
**SHA:** `1637946bc59f27eea3fa078242742bece0ae04e6`  
**Parent:** `1e3a6ca` (Discover-bio — already PASSed; **separate** stream)  
**Worktree:** `/workspace/plexuw-fu7i`  
**Artifacts:** `/home/box/plexuw-artifacts/1637946/` (plexuw, AppImage, deb, SHA256SUMS — release-only; **no** nested mock; **no** `1637946-MOCK-DO-NOT-SHIP` sibling)  
**Plan:** `/workspace/plexuw-account-profile-plan/REPORT.md` — Scott approved implement under 8 MUSTs  
**Scope:** Real account profile (name + avatar) only. Discover-bio egress **untouched** (RES-3).  
**Not** merge / Win approval.

---

## 1. Verdict

| | |
|---|---|
| Verdict | **PASS** |
| HIGH / MED | **0 / 0** |
| LOW | **3** (LOW-P1 new residual; LOW-O1 + LOW-R1 prior open) |
| MUST 1–8 | **8/8 PASS** |
| RES-3 Discover | **PASS** (untouched logic; additive Deny::Host test only) |
| Windows / merge | **Not** this gate |

Implement satisfies the 8 MUSTs. IPC strip, avatar PublicImage allowlist, paired `plex.tv`×`/api/v2/user`, GET/no-query, Deny matrix + mock zero-call, once+gen-cancel+soft-fail, home Deny, and Scott implement approval (MUST-8) are present. Foreman claim `cargo mockplex` 103 ok — **verified**.

---

## 2. MUST compliance matrix (8)

| # | MUST | Status | Evidence |
|---|---|---|---|
| 1 | IPC = cleaned name + optional opaque thumb id; strip email/authToken/subscription/home/ids; never log body; never email as display fallback | **PASS** | `UserJson` only `title`/`username`/`thumb` (`api.rs:238-245`); email/authToken/subscription/home*/uuid/id never deserialized. Name = `title.or(username)` only (`:265`); comment forbids email/friendlyName. `ProfileIpc { name, thumb? }` (`commands.rs:97-101`); `profile_view` registers avatar → opaque id (`:86-90`). JS: `createTextNode(name)` + thumb `/^[0-9a-f]{32}$/` only (`desktop.js:147-167`). No `log!`/`println` of profile/body. Fixture PII stripped in unit test (`api.rs` `account_profile_strips_pii…`). |
| 2 | Avatar allowlist `https://plex.tv/users/<id>/avatar` (query strip/refuse); token-less PublicImage; cast CT/redirect/size | **PASS** | `account_avatar_ok` / `parse_account_avatar` (`egress.rs:59-82`): host `plex.tv`, https:443, path `/users/[0-9a-fA-F-]{8,64}/avatar`, query stripped, `%`/`@`/`#`/`\` refused. `Cred::PublicImage` widened only via `account_avatar_ok` (`:218-224`). `proxy_public` or_else parse (`commands.rs:779-780`); CT jpeg/png/webp + 5 MB + `send_capped` PublicImage (token `None` `:294`). Fixture avatar 401 if tok present (`fixture.rs:147`). Account cred on avatar → Deny::Path (matrix). |
| 3 | Exact pair host `plex.tv` + path `/api/v2/user` only; no `/api/v2/*`; no `clients.plex.tv` | **PASS** | `account_user_ok` paired (`egress.rs:85-92`); checked **before** `account_path` (`:203-204`). `account_path` still **only** resources + pins (`:142`) — no `/api/v2/user` append. `clients.plex.tv/api/v2/user` → Deny::Path (matrix `:342`). Path widens (trailing slash, `/users`, `/user/extra`, home) → Deny::Path. |
| 4 | GET only; no query/fragment; token header-only; redirects off; never to PMS | **PASS** | `account_user_ok` requires Get + no query/fragment; POST → Deny::Method; `?x=`/`#f` → Deny::Path (`:365-367`). URL built in Rust only (`api.rs:259`). Token via `Cred::Account` → header `X-Plex-Token` (`transport.rs:86`); redirects `Policy::none()` (`:67`). PMS/plex.direct → Deny::Host (`egress.rs:374`). |
| 5 | Flip intentional Deny::Path test; full Deny matrix; demo/mock zero `/api/v2/user` calls | **PASS** | Old Deny flipped to Ok (`:333-334`) + `account_profile_user_allowlist_matrix` + `account_avatar_allowlist_matrix`. `fetch_and_emit_profile`: `cfg!(mockplex)` early return + `use_demo` return (`commands.rs:177-179`). Test `account_profile_mock_builds_skip_auto_fetch` asserts zero log hits. JS `__PLEXUW_MOCK__` skips apply/cold-pull (`desktop.js:148,172`). |
| 6 | Once after successful sign-in (gen-cancel); soft-fail keeps placeholder; Demo/mock unchanged | **PASS** | `auth_start` → `fetch_and_emit_profile(&app,&p,my)` after resources (`:285`); gen bump on `sign_out` (`:403`) / `auth_cancel`; fetch checks gen before/after (`:180-186`). Soft-fail `_ => {}` leaves S/Scott. Cold-start/reconnect also one-shot fetch for sidebar (documented; not a poll). Demo/mock gates above. |
| 7 | `/api/v2/home/*` and home-user switch stay Deny | **PASS** | Matrix denies `/api/v2/home`, `/home/user`, `/home/users` (`:353-355`). No home-user IPC/UI in this delta. |
| 8 | Scott approval already given for implement | **PASS** | Plan REPORT + brief: Scott approved implement under 8 MUSTs; this review is re-PASS of the ship, not fresh implement gate. |

**RES-3:** Discover egress untouched by this commit’s allowlist logic. `discover_ok` / `DISCOVER_HOST` / `fu7u_discover_allowlist_matrix` intact. Diff on Discover surface = one additive `Cred::Discover`→`/api/v2/user` → Deny::Host assert + `mx.rs` test struct `profile: Mutex::new(None)` field only. **PASS.**

---

## 3. Breadth (HARD Scott) — surfaces checked

| Surface | Result |
|---|---|
| Egress widen | Paired `account_user_ok` only; `account_path` unchanged (no `/api/v2/*` open); clients.plex.tv user Denied |
| Token / Cred | Account token header-only on user GET; avatar `Cred::PublicImage` token-less; fixture enforces; never PMS |
| IPC | `ProfileIpc` name + optional hex-32 thumb; no email/token/subscription/home/ids |
| XSS | `textContent` / `createTextNode`; img src from opaque id + fixed IMG_ORIGIN path only |
| Auth / gen-cancel | sign_out / auth_cancel bump gen; profile cleared in `finish_sign_out`; soft-fail |
| Avatar proxy | Same CT allowlist + 5 MB + redirects-off as cast photos; query stripped before store/fetch |
| Home / switch profile | Still Deny; no UI |
| Demo / mock | Zero auto `/api/v2/user`; mock apply/cold-pull no-ops |
| Discover (RES-3) | Untouched; both Discover tests still green under mockplex |
| Mock shipping | Release artifacts only; no mock sibling; strings: no mockplex / `__PLEXUW_MOCK__` / `MOCK-DO-NOT` / `shot_id` |
| Release strings | `/api/v2/user` present (2× expected path constant); no mock markers |
| Prior LOW-O1 / LOW-R1 | Still open; unchanged by this delta |
| Path normalization | `user/../resources` → Ok as `/api/v2/resources` (pre-allowlisted); documented in test — not a user-path widen |

---

## 4. Findings

| ID | Sev | Detail |
|---|---|---|
| **LOW-P1** | LOW | Avatar id charset `^/users/[0-9a-fA-F-]{8,64}/avatar$` accepts non-UUID shapes (e.g. excess dashes). Still host/path-scoped + PublicImage + CT/size; residual tightness only. |
| **LOW-O1** | LOW | Prior open: Demo `data-person` incomplete `esc` in `desktop/dist/app.js` — untouched this tip. |
| **LOW-R1** | LOW | Prior open: 3 node CSS/test fails (`fu7f-modal`, `fu7i-smooth`, `fu7k-nav`) — quality debt; lint-shim ok. |
| INFO | — | Cold-start/reconnect also one-shot profile fetch (beyond strict “after token store”); gen-cancelled; needed for sidebar; not a poll. |
| INFO | — | If `title` empty and `username` is email-shaped, username is used — never the `email` field (MUST-1). Residual display hygiene. |
| INFO | — | `Url` normalisation `user/../resources` → allowlisted resources Ok — intentional; matrix documents it. |
| INFO | — | `AccountProfile: Debug` derive present; no log of body/profile in fetch path. |
| INFO | — | `Cred::PublicImage` still has no Method check (pre-existing cast-photo); `proxy_public` hardcodes GET. |

**No HIGH/MED.**

---

## 5. Tests run

| Suite | Result |
|---|---|
| `lint-shim` | ok |
| node shim tests | 126 / **123 pass / 3 fail** (LOW-R1 prior) |
| `cargo test --offline --lib` | **95 passed**; 0 failed (incl. account_profile_* + fu7u_discover_*) |
| `cargo test --offline --lib --features mockplex` | **103 passed**; 0 failed — **Foreman 103 claim verified** |
| `permissions/autogenerated/shot_id.toml` | **deleted** after mock tests |

---

## 6. 4-line Master summary

1. **PASS** fu7u account-profile Push 2 @ `1637946` — **0 HIGH / 0 MED / 3 LOW** (LOW-P1 avatar id charset residual; LOW-O1/R1 prior).  
2. **8/8 MUSTs** met: IPC strip + opaque thumb; avatar PublicImage allowlist; paired `plex.tv`×`/api/v2/user` GET; Deny matrix + mock zero-call; gen-cancel soft-fail; home Deny; Scott implement approval noted.  
3. **RES-3** Discover egress untouched; mockplex **103** ok (verified); shot_id deleted; release artifacts clean.  
4. **Not** merge/Win approval — code delta security only; separate from Discover-bio @ `1e3a6ca`.
