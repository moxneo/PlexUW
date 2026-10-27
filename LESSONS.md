# Lessons
- Inline SVG data-URIs inside a `style="..."` attribute must not use double quotes; use `url('…')` and percent-encode `'`.
- Escape `&`/`<` in titles placed into SVG `<text>`, or the whole image silently fails to render.
- Video shift = min(panelWidth/2, pillarWidth): centres video in remaining space and can never push it offscreen. With both panels open the shifts cancel.
- When pillar < panelWidth/2 (e.g. 16:9) switch to overlay mode with a dimmed scrim instead of shifting.
- Glass panels blur their own static poster layer (`.art` + `backdrop-filter`) so the live video is never blurred.
- Top controls must reflow (`left/right: var(--pw)`) when panels open or the panel covers them.

## v4 QA fail (d1e6ce72, da Vinci 8/9) — ultrawide scaling
- What went wrong: at 5120x1440 (and partly 3440) the whole UI rendered at fixed 1920-sized px — headings ~16px, card text 12px, 160px poster cards in long rows with dead space, sidebar/bars tiny. Evidence: /workspace/plexuw-qa-v4/home-5120x1440.png, nav-_music_albums-5120x1440.png.
- What we did wrong: we only eyeballed layout at 3440 and never designed for scaling. Everything was hard-coded px, grids used fixed `minmax(160px,1fr)` with auto-fill, and JS read `--pw` assuming px. Screenshots "looked fine" because downscaled previews hide tiny type.
- Do instead: fluid root font (clamp), rem for type/spacing/bars, vw-tied card minimums with auto-fit, and MEASURE computed heading px + card width at 1920/3440/5120 every round instead of judging thumbnails. Read panel width from the DOM, not from a CSS var string.

## v5 M1-M3 notes
- `scrollIntoView()` on an element inside an `overflow:hidden` stage scrolls the STAGE sideways (panel was off-screen) — the whole player shifted left. Use `focus({preventScroll:true})` + set the panel's own `scrollTop`, and reset `#stage.scrollLeft/Top` in layout().
- `const` helpers used by code that runs during the first route() hit the TDZ ("Cannot access 'apOn' before initialization") and blanked the player. Use function declarations / `var` for anything render paths call.
- Headless tests must move the pointer off handles before pausing: dwell timers fire as soon as the bar appears, so an old hover opened Info and made later key checks look broken.

## v7 (S1–S4)
- A-Z jump test assumed the target row reaches the top of the viewport; on 3440/5120 the grid is too short to scroll that far. Assert "target card in viewport + focused" instead.
- Rail headers: `.small` beat `nav .navh{font-size:0}` once headers carried utility classes; collapsed headers need an explicit override.
- Hero backdrop art carries baked-in title text; fade it with a mask instead of a bg-colour gradient (gradient left a hard edge).

## windows-app — SHOULD fix (a) end card, round 1 FAIL
- What went wrong: verifier first showed no end card at all (seek silently snapped to 0), then with the card visible it still overlapped the scaled picture at 1920x1080 by ~48k px² (card 596px wide, freed right strip only 288px).
- What we did wrong: (1) served the proto with `python -m http.server`, which has no HTTP Range support, so `<video>` seeks fail; always use the startup.sh node server (Range/206) for player tests. (2) Assumed transform-origin alone frees enough room; at 16:9 the freed space is a 15vw strip on the right + 15vh at the bottom, narrower than the horizontal card.
- Do instead: while `.apon`, stack the card vertically and size it to the freed right strip (≤ 15vw), and measure overlap against the *rendered picture rect* (object-fit aware), not just the element box.

## windows-app — Linux shell screenshots, round 1 FAIL
- What went wrong: under bare Xvfb the "splash" frame was all black, the 4s "window" frame was an empty dark rect, and F11 did nothing (window stayed windowed).
- What we did wrong: assumed WebKitGTK paints within a fixed sleep on a cold start, and ran with no window manager — X11 fullscreen (_NET_WM_STATE_FULLSCREEN) is a WM protocol, so with no WM it is a no-op. Not an app bug.
- Do instead: run openbox under Xvfb, use an ultrawide 5120x1440 screen, wait for the window to paint (longer, staged waits), keep the splash up with `?splash=hold`-style control only in a test build, and assert fullscreen via window geometry (xdotool getwindowgeometry), not by eye.

## windows-app — Linux shell won't map its window, round 1 FAIL
- What went wrong: after the first successful Xvfb run, relaunches never mapped the main window (4 threads, no WebKit processes, no state file).
- What we did wrong: guessed the cause (global-shortcut registration in setup()) and rebuilt without first getting a stack trace; moving registration to a thread did not fix it.
- Do instead: capture a backtrace of the hung process (gdb) before changing code.
- Round 2 (with gdb): main thread was blocked in g_application_register -> g_dbus_proxy_new_sync, i.e. GTK waiting on the box's shared D-Bus session bus (busy with other agents' desktops). Environmental, not an app bug; the thread move for global-shortcut registration stays as harmless hardening. Fix: launch tests in a private bus (`dbus-run-session`).
- Round 3 (resolved): neither change was the fix. On this headless box every GTK launch blocks ~30s in D-Bus registration/portal activation (D-Bus default timeout) and then proceeds normally. Earlier "it works" runs were just ones we happened to look at after 30s. Fix for tests: poll for the window for up to 60s instead of fixed sleeps. Never conclude "hung" before the 25–30s D-Bus timeout has elapsed.

## Settings/Real-Plex plans — round 1 FAIL (da Vinci, 2026-10-22)
**What went wrong:** two Required rows in SETTINGS-RESEARCH ("Use hardware decoding", "Sign out all devices") never made it into PLAN-SETTINGS. The plan had 11 categories with overlap (Server vs Quality, Window vs Appearance). Ultrawide contained design tokens (panel clamp, 1800/2400 max width; the 2400 also contradicts the spec's 1800). Skip used three different vocabularies (plan / sketch / research). Language rows didn't say where their value comes from. PLAN-REAL-PLEX lacked UX for the PIN wait, the connection chip, the track-switch state and the Linux keychain error.
**What we did wrong:** wrote the research table and the plan separately and never cross-checked every Required row against the plan. Mixed spec constants with user settings. Drew the ASCII sketch with shorthand labels instead of reusing the plan's words. Left a risk ("two sources of truth") as prose instead of designing it into the UI.
**Fix:** cross-check Required rows, regroup to 9 categories, use one Skip vocabulary, add source labels, add the UX notes. Owner admin and requests stay parked (scope frozen).

### Same round 1: Sentinel paper review FAIL (2 HIGH, 8 MED, 7 LOW)
**What went wrong:** the plan stated security intent ("proxy adds the header", "egress allowlist") without controls. It had no proxy contract (an SSRF/open-proxy risk, and tokens in HLS playlists). Tokens were not bound to hosts, reqwest follows redirects with X-Plex-Token, and the manual host was probed WITH the token. The plan also missed: innerHTML with server data, the wrong CSP source on Windows, uncapped IPC commands and withGlobalTauri, redaction of panics and dumps, /photo/:/transcode SSRF, DNS rebinding on insecure-local, AI-key migration and wipe, and admin/AI guardrails.
**What we did wrong:** wrote security as bullet-point intent and assumed "Rust does it" was a control. We didn't threat-model each data path (webview→Rust→host, redirect, playlist body) or check platform specifics (WebView2 custom-protocol origin).
**Fix:** concrete contracts in PLAN-REAL-PLEX §6a (H1, H2, M1–M8, L1–L7) and preconditions in Later.

## M1 build (2026-10-22)
- Fix round 1: tests used `..Default::default()` on FixtureTransport, which had private fields, so it failed to compile (E0451). Made the fixture fields pub. All 20 tests passed after that.
- Screenshot driver: the Tauri window shows only after a D-Bus wait of about 30 s, so a one-shot `eval` fired before the page loaded. Fix: retry the eval every second with a run-once guard, and wait for an `--onlyvisible` window.
- Scott decisions arrived mid-milestone. The specific host was removed from code, docs and placeholders; the defaults now come from the settings.

## M1 fix-loop round 1 (da Vinci FAIL at 4a11411)
- MUST 1: the Scott decisions lived only in prefs.rs; there was no Settings UI and `prefs_set` was never called. Lesson: a decision isn't done until the user can see and change it.
- MUST 2: `withGlobalTauri: true` had been knowingly deferred, which contradicted binding Sentinel M3. Lesson: don't defer a binding control on my own call; the shim gets bundled instead.
- SHOULDs: a long strong-PIN code is useless to show; the manual URL was not reused after restart; the AI key is still in localStorage; the keychain copy is off-spec.

## M2 build (2026-10-22)
- Compile/test loop, 2 rounds (cap 3): `json!` cannot index an array literal (`["a","b"][i]`), so it must be wrapped in parens. Raw strings containing `"#` need `r##`. Two proxy-test expectations named the wrong Reject variant; the inputs were already rejected.
- Screenshot driver: lib.rs filters PLEXUW_SHOT to alphanumerics, so the scene `m2-home` arrived as `m2home` and silently did nothing. Lesson: read the sanitiser before naming the scenes.
- N1 found by testing, not reasoning: WebKitGTK sends **neither Origin nor Referer** on `plexuw://` image loads (34/34 requests). Under the strict rule every image gets a 403. The plan's "Origin/Referer is not the app origin → reject" does not say what happens when both are absent, so the rule stays strict and the question goes to Sentinel instead of being relaxed on my own call.
- innerHTML: app.js still has its demo sinks. The Plex UI is a separate textContent-only module (plex-browse.js) guarded by lint-shim.sh, so server strings never reach app.js. That is a deviation from "all sinks converted" and needs Sentinel sign-off.

## M2 fixes (Sentinel PASS-with-conditions at 6eaee34)
- Fix-loop rounds used: 0 of 3. Tests passed 35/36 on the first run; the lint finding was a product bug, not a loop.
- The new lint (shim must not reference app.js renderers) caught a real bug on its first run: plex-browse.js's sort `onchange` called `render()`, which is not defined in the module, so it resolved to **app.js's global render()**. Fixed to call the local `route()`. Lesson: a module boundary is not real until a check enforces it.
- MED-1: a matching machineIdentifier is not proof of identity, because machine ids are not secret. Trust comes from the account's connection list or from an explicit user "yes". The answer lives in a file that prefs_set cannot write.

## M2 fix-loop round 1 of 3 (da Vinci FAIL at 1d502dd)
- MUST 1-2: Scott's standing UI decisions (side panels, Jellyfin-style categories, Next Up) were skipped while the security items were being fixed. Lesson: re-read the standing decisions every milestone, not just the latest message.
- MUST 3: Ctrl-K kept going to the demo palette in Plex mode. Lesson: every global entry point (shortcuts, search, nav) has to be switched when the data source changes.
- MUST 4: I only took screenshots at 1920 and 5120, so the 1366 collapsed rail with an empty Plex nav was never seen. Lesson: always take screenshots at the smallest supported size too.

## M2 follow-up (Sentinel + da Vinci LOWs), 2026-10-22
- Errors cross the IPC boundary as one of 7 fixed category strings (plus bad-address); the UI owns all wording. Raw reqwest text never reaches JS.
- A race of several connections reports the "most informative" failure (tls > blocked > timeout > unreachable), not the first one.
- Lint now runs inside sync-web.sh, so every build is gated, not only commits with the hook installed.
- Fix-loop rounds used: 0 of 3 (all tests green first compile).

## 2026-10-22 follow-up round 2 (fix-loop 1/3)
- Screenshot scene branches must match every scene prefix (the m3 scenes silently never ran: regex only matched 'm2').
- Chromium 121+: setting `scrollbar-color` disables `::-webkit-scrollbar` styling; gate the standard properties behind `@supports not selector(::-webkit-scrollbar)`.
- Overlay panels via `position:fixed` take them out of the grid; collapse the grid to one column or the centre gets a 0 track (blank page at 1024px).
- On a server switch, reload sections every time (not only on first connect), and give the nav loading/Retry states.
- `cargo tauri build` can panic with EMFILE (inotify exhausted on the shared box); `cargo build --release --features …,tauri/custom-protocol` is equivalent for mock shots.

## Follow-up round 3 — HTPC reference (fix-loop 1/3)
Items derived from Scott's Plex HTPC screenshots (htpc-ref/1–3): (a) full-bleed dimmed fanart backdrop on Home (first Continue Watching item) and detail pages with title/year/runtime/rating/time-left pill/genres/synopsis; (b) rail order profile → server switcher → Search → Home → libraries; (c) round Play/Restart/Mark watched/More buttons + resolution badge (Play/Restart/Mark disabled until M3); (d) circular credit headshots with role names; (e) Continue Watching progress bars (already present, verified); (f) top-right clock.
- Lesson: a fixed full-bleed backdrop covers static siblings; the sidebar/topbar need position:relative + z-index.
- Lesson: the icon sprite lacks restart/check glyphs; use existing `rew` and a text glyph instead of adding art mid-round.

## Follow-up round 4: categories regression + M3 split (fix-loop 1/3)
- Cause 1 (introduced in round 3): the new credit-headshot CSS reused the class `.pxhead`, which is already the library/category page header. Every library, Genres and filter page header turned into a 128px centered column. Fixed by renaming the headshots to `.pxcred`. Lesson: grep for a class name before reusing it.
- Cause 2: `loadSections()` had no source guard, so a late `browse_home` reply from the previous server (or from before the pick) could overwrite the new server's library list, leaving category links on stale ids. Fixed with `srcGen`, bumped on every setSource; every sections write checks it.
- Proof: the Rust test `categories_reload_on_pick_and_switch` uses a two-server fixture (`second_online`, its own library 7/8 with its own genres and its own srv2 token). It covers pick → genres, switch → the new libraries and genres, the stale id failing on the new server, and switching back. UI scene `m2catswitch` (`PLEXUW_MOCK_TWO_SERVERS=1`) prints PASS. It is the first line of WINDOWS-TEST-CHECKLIST.md and HANDOFF.md.
- M3 playback WIP (play.rs, plex-player.js, HLS proxy, etc.) moved to local branch `m3-playback-wip`. windows-app is built and tested without it.
- 2026-10-22 follow-up 4: git reset --hard discarded an uncommitted edit to shots-v3/player-chapters-3440x1440.png. Lesson: never reset --hard with a dirty tree; move work with a branch commit or a copy first.

## 2026-10-22 follow-up 5: da Vinci + Sentinel round on 8767c0c (fix-loop cap 3; every item closed on attempt 1)
- **S1 (da Vinci).** `section()` swallowed the library-list load error and then said "That library isn't on this server", even when the server was unreachable. It now keeps the error and shows "Couldn't load your libraries." plus the fixed failure-category text (`missingLibraryText` with `hooks.why`). `fail()` and search errors no longer print raw error text either. Test: `desktop/shim/test/plex-browse.test.mjs` (`node --test desktop/shim/test`). Lesson: never let a catch that is "handled below" lose the reason; the fallback message has to be able to tell "missing" apart from "failed".
- **LOW (da Vinci): cancel a server switch.** The connecting screen now has a Cancel button that calls `server_connect_cancel`. Rust keeps a `conn_gen`. A connect commits the new source and prefs only if its generation is still the latest, and it checks and commits under the source lock. Cancel takes the same lock and returns the source view that is actually live, so the UI and Rust can't disagree. A cancelled connect never falls back to "offline". Test: `server_switch_cancel_keeps_current` (cancelled, superseded, and normal).
- **dist.** desktop/dist rebuilt with `sync-web.sh` (lint-shim green) before every build.
- **Sentinel: plex.tv CDN cast photos.** These now go through a narrow allowlist in the Rust proxy, not through `/photo/:/transcode`:
  - `Images::register_public` puts an opaque id under the reserved owner `@plextv-cdn`.
  - `egress::parse_public_image` and `public_image_ok` check, byte for byte with no normalisation: exact host `metadata-static.plex.tv`, https only, implicit port 443, no userinfo, query or fragment, no `%`, `\` or dot-segments, and safe segments ending `.jpg`, `.png` or `.webp`.
  - New `Cred::PublicImage` carries no token. The egress check refuses any other host or path.
  - Redirects are refused. Only `image/jpeg`, `image/png` and `image/webp` are accepted, with a 5 MB cap. The same disk cache is used.
  - Test: `cast_photo_public_allowlist`, which covers 19 bad URLs plus redirect, html, gif, svg, over 5 MB, 404, a wrong credential and a wrong host. The fixture CDN returns 401 if any token arrives.
  - Lesson: a new external fetch gets its own credential kind and its own allowlist; never widen an existing one.
- **LOW-10 (Sentinel).** `browse_item_inner` now runs its show lookup through `show_for(p, sk, mid)`, which drops the result if the reply came from a different server than the item. Test: in `server_switch_cancel_keeps_current` (same server merges; after a switch, dropped).
- **LOW-11 (Sentinel).** `create_pin` rejects a code that is not `[A-Za-z0-9]{1,32}` with `Parse`, so the error shows as "blocked". Test: `low11_link_code_validated`. The fixture now has a `pin_code` override.
- **MED P-1 (Sentinel, plan).** "Local HTTP (if allowed)" is removed from the race order in PLAN-REAL-PLEX.md §10. The code already dropped non-https connections; `pin_flow_resources_race` now asserts it, and checks that the fixture's advertised `http://10.0.0.2:32400` is never contacted.

## fu6 (2026-10-22) — nav polish, search overlay, icons, ultrawide details, da Vinci LOW, Sentinel INFO-2
- Scott's 5 points: "Ask your library" is a real accent button; one search overlay (grouped by type, ↑↓/Enter/Tab/Esc, focus restore); collapsed rail rebuilt as a 44px column with 24px icons; one name (bottom profile → connection settings) and one server switcher; one original stroke icon set (px-icons.js, #FF7A1A accent, no play triangles for Movies/TV, no GPL).
- Lesson: screenshot scenes must be in the mock-connect regex (fu6 scenes first rendered demo mode) and timed against the shot wait (1.5s + connect + delays must be < wait) — the search scene silently missed the window twice.
- Ultrawide details: poster object-fit contain (no crop); ≥2560px or 21:9 scales type/poster/buttons and moves Credits beside the info; mock first (docs/ULTRAWIDE-MOCK.md). Related/extras deferred to M3.
- da Vinci LOW: Home/Details/library errors share "Couldn’t load <what>. " + fixed failure text (loadErrorText); test asserts no raw text leaks.
- Sentinel INFO-2: window commands map every error to the fixed category "window-unavailable" (win_err); Rust test guards against raw e.to_string().
- Limitation: below 1600px the rail is collapsed by design, so 1024 "expanded" shots show the collapsed rail.

## fu6 fix-loop 1 (2026-10-22, after da Vinci FAIL of 739c250)
What went wrong:
- MUST: the Linux AppImage opened a blank window on a real desktop. It bundled the GStreamer libraries but not the plugins, AppRun overrode GST_PLUGIN_SYSTEM_PATH, appsink/autoaudiosink came back NULL, and WebKitWebProcess aborted (SIGABRT, exit 134).
- SHOULD: at ≤1920 the uncropped poster sat in a tall ~200x503 dark box, because the box stretched to the text column.
- LOW: the demo rail kept the old repeated app.js icons, and the collapse/expand tooltip did not flip.
What I did wrong:
- I saw the evidence and explained it away. My Xvfb AppImage shot was a 407-byte blank, and the log showed "autoaudiosink not found" plus GLib CRITICALs. I deleted the blank, called it a "screenshot script issue", and shipped. A blank render is a failed test, not a tooling quirk.
- I proved the UI with the mock dev binary and treated that as proof of the shipped artifact. Packaging (AppRun env, bundled libs) only exists in the artifact, so QA must run the artifact itself.
- I fixed the crop with object-fit:contain but never looked at the 1920 details shot critically. The dark letterbox was visible in my own details-1920-unchanged.png.
- I only checked plex mode, so demo mode kept the old icons. I also never hovered the toggle after a state change.
Rules from now on:
- Every Linux artifact gets a real-render gate before Windows is built: launch it under Xvfb, take a non-blank root-window capture, and confirm no SIGABRT or "not found" GStreamer errors in stderr. Launch the .deb binary the same way.
- A failed or blank capture blocks the round. Don't delete the evidence; keep it with the report.
- Fixes: bundle.linux.appimage.bundleMediaFramework=true; .pxposter aspect-ratio 2/3 + align-self:flex-start; the demo #nav icons are swapped to px-icons, with initials on collections/playlists; the toggle label tracks body.navc. Tests cover the poster CSS and the conf flag.

## fu7 (2026-10-22/23, overnight, merged-servers phase B)
- Fix-loop count: 0 of 3. No reviewer FAIL this round. Compile errors and test drift came from my own edits and were fixed in place.
- The fixture servers were renamed (MoxBox, Slowpoke, BLACKBOX), and 3 tests plus the desktop.js scenes still had the old names. Rule: when renaming fixture identities, `rg` the old names across Rust, JS and docs in the same edit.
- The keyring crate has no `NoDefaultStore` variant. I had guessed at the API. Rule: check a crate's error enum (docs.rs or the source) before mapping it.
- The first §9 test assumed only owned copies would show up, but the shared fixture also serves the GUID. Assert the invariant (owned before shared), not the fixture's incidental shape.

## fu7b (2026-10-23, merged home/libraries/search; Sentinel MUSTs; LOW-12 to LOW-15)
- Fix-loop count: 0 of 3. The only failure was a compile error (`HomeView` lacked `Debug` for `unwrap_err`). I fixed it by deriving Debug.
- Tauri v2 denies any command that isn't in the build.rs AppManifest and capabilities/default.json, even when it's registered in generate_handler. `version_pick` (added in fu7) was never in the manifest, so the Versions picker was silently denied at runtime. Rule: whenever a command is added to generate_handler, add it to build.rs and default.json too, then grep all three.
- Screenshot scenes hard-coded raw ratingKeys (`#px/item/1013`). Opaque ids made them show "Not found". The fixture-only `shot_id` command now maps legacy fixture routes to minted ids, and a real build refuses it. Rule: when an id format changes, rerun every scene that navigates by id, not just home.
- rendercheck.sh used `pkill -f <binary>`. The fu7b copy (/workspace/rendercheck-fu7b.sh) runs the app under setsid and kills only its own process group, on display :79.

## fu7c (2026-10-23): SHOULD-1..4, LOW-16, the single 5 s deadline, dead switcher
- Fix-loop count: 3 of 3 (at the cap).
  1. `fu7_s9` asserted owned-before-shared, which the new spec reverses. The list is now quality-only and the default/metadata copy is owned-first.
  2. A `//` comment placed inside a one-line arrow function swallowed the closing `)`. Use `/* */` mid-line.
  3. `AppManifest::commands` needs a `&'static [&str]`; a build-script `Vec` is leaked.
- Keep display order and trust order as two separate functions (`sort_versions` / `best_version`). One comparator that tried to serve both broke every time the spec changed.
- Gating a command behind a feature takes five places: the fn, `generate_handler`, the build.rs manifest, the permission grant, and the JS caller. The grant moved from default.json to a runtime `add_capability` under `cfg(feature="mockplex")`. Without it, mock renders showed "Not found" because shot_id was silently denied again.
- Prove the gate: `strings -a` on the release ELF and EXE shows 0 `shot_id`, and the mock debug build shows 4 (positive control). dist/ JS has no `shot_id` (esbuild `--define:__PLEXUW_MOCK__=false` plus syntax minify).
- Put the connect race and semaphore wait under the same `timeout()` as the request. A per-request timeout alone let a queued call wait well past 5 s.

## fu7d (2026-10-23): Windows "The system keychain didn't respond" after the link code
- Fix-loop count: 0 of 3.
- Root cause (from code + keyring 3.6.3 source; not reproduced on BigBoy): `windows-native` WAS enabled and there was NO keychain timeout. keyring's Windows backend rejects any password whose UTF-16 encoding exceeds CRED_MAX_CREDENTIAL_BLOB_SIZE (2560 bytes = 1280 units) with `Error::TooLong`. `PlexUW/index` lists every key ever written across all client ids (~92 units per `PlexUW/<uuid>/server/<40-hex>`), so about 13 entries overflow it. `TooLong` mapped to `StoreError::Other` -> category "keychain" -> the "didn't respond" copy. The UI wording ("didn't respond") pointed at a timeout that did not exist.
- Fix: `Chunked<S>` store splits values over 1000 UTF-16 units into `<key>#<i>` parts (header written last, stale parts removed, max 64 parts, delete removes parts). Keychain writes in sign-in run under `spawn_blocking` with a 20 s deadline. `TooLong` maps to a fixed string. MemStore can simulate the limit; the regression test proves the unchunked store fails and the chunked store round-trips and wipes 60 servers.
- Rule: when an error category's UI copy names a cause ("didn't respond"), check that every error mapped to it really is that cause. Rule: any keychain value that grows with data (lists, indexes) needs a size budget against the smallest platform limit (Windows 2560 bytes UTF-16).
- Limitation: Egress still reads tokens synchronously on the async worker (fast reads); moving them to spawn_blocking is a follow-up.

## fu7d-fl1 (2026-10-23, after Sentinel FAIL of 56f95c0: 1 HIGH, 2 MED, 1 LOW)
- Fix-loop count: 1 of 3.
- What went wrong: I added a timeout around a blocking write and called it done, but a timed-out task keeps running. A deadline does not cancel; anything that outlives its caller needs an epoch or a join. I also rewrote chunk parts in place under a live header (not atomic) and left the index read-modify-write unlocked.
- H1: `StoreSync` per store holds one mutex over put/remove/migrate/wipe and a sign-out epoch. Wipe bumps the epoch, then takes the lock. `put_at` checks the epoch the caller captured BEFORE spawn_blocking, under the lock. A stale write returns "keychain write discarded after sign-out" and writes nothing.
- M1/M2: parts live in two fixed slots (`<key>#a#i`, `<key>#b#i`). A write clears and fills the slot the header doesn't point at, then flips the header (`v2:<slot>:<n>`) in one write, then deletes the old slot. Any part or header failure rolls back the new slot. Index updates are serialized by the same lock.
- L1 + orphans: delete probes every possible part name (`#a#1..64`, `#b#1..64`, the fu7d v1 `#1..64`) whatever the header says. Because the slot names are fixed and few, wipe can find every orphan without platform enumeration.
- Egress: `Chunked` keeps an in-memory token cache (memory only, SecretString, never logged). It's filled only from real keychain reads, dropped on write and delete, and cleared on every wipe.
- Process: running the Linux and Windows `cargo tauri build` in parallel raced on desktop/dist (both run sync-web.sh, which does `rm -rf dist`). Rule: run bundle builds one after another; I rebuilt Windows after the race. rendercheck's `alive=` flag and cleanup are unreliable under setsid, and a lingering Xvfb on :79 made the next run fail with "Failed to initialize GTK". Rule: check `pgrep -af "Xvfb :79"` before each render and judge by the PNG and the log.

## fu7d-fl2 (fix loop 2 of 3)
- H3: read v1 (`plexuw-chunks:v1:<n>`, parts `#<i>`) and fu7c plain values. The next write migrates them to v2 A/B and deletes old parts. If wipe can't read the index, it falls back to known keys (account + server keys from p.servers) and probes every part name. sign_out returns `Err(signout-incomplete)` to the UI instead of using unwrap_or(0).
- H2: the token cache has a generation counter. Reads capture gen before touching the keychain, and the fill is dropped if any write, delete or wipe bumped it. Sign-out clears the cache under the same mutex and bumps gen.
- L2: a corrupt or unknown \u{1} header is treated as Corrupt. Writes go to slot a and probe-clean every other name, and the index is rebuilt.
- INFO: temporary split and join buffers are Zeroizing<String>.
- Lesson: every on-disk format a past build might have written (including failed partial writes) is a read and wipe input forever. Test with seeded legacy entries, not only fresh ones.
- da Vinci folded into fl2:
  - SHOULD-8: deletes are bounded by what the index and headers name. Sign-in writes do 0 deletes, a re-write deletes the old slot's n parts, and a wipe deletes keys + named parts + the index. The 3x64 probe runs only for a key whose header is corrupt or unreadable. The store lock is taken with try_lock and a 10 s deadline (E_BUSY). The sign_out command is async and runs the wipe in spawn_blocking under KEYCHAIN_TIMEOUT. Tests: fl2_should8_delete_counts_are_bounded, fl2_should8_lock_timeout.
  - SHOULD-7: secrets::category maps errors to fixed categories (keychain-toolong, -timeout (timeout or busy), -stale, -missing, -unavailable, signout-incomplete), each with its own JS copy.
  - LOW-9: a key whose delete fails stays in the index and the wipe returns E_PARTIAL_WIPE (fl2_low9_failed_delete_stays_indexed).
  - Trade-off: orphans left beside a *plain* header (a failed rollback after a failed write) are no longer probed on delete. The next chunked write to that slot overwrites them.
- Lesson: an orphan sweep needs a bound and a trigger. "Probe everything always" turned one sign-out into about 12k keychain calls.

## fu7e
- Mock scenes need `PLEXUW_MOCK=true` at bundle time (esbuild define). Without it shot_id is never called and every route shows "Not found". It looks like a data bug, but it isn't one.
- Infinite scroll: append slots, swap placeholders in place with replaceWith, and never replaceChildren. A node test pins tile identity across pages.
- Shot scripts kill only their own PIDs (setsid + kill -- -PGID); never pkill -f. Check pgrep before and after.
- After a box restore, re-check the toolchain (rustup default, msvc target, webkit/gtk dev, nsis, imagemagick, openbox, xdotool) before blaming the code.
- Fixture items need a guid, or merge dedupe can't collapse them (duplicate shows in the filmography).
- Never do two things at once inside an async loop: a helper `const` shadowed inside the same scope broke the module at import time. Run `node --check` or import it before the renders.

## fu7f
- Modal logic lives in a pure exported controller (`modalController`) with injected nodes, so node tests can check Esc, the X, the backdrop, focus trap, focus return and scroll preservation without a DOM library.
- Close the popover before navigating: route() resets scroll, and a stale dialog would otherwise survive the route change.
- Register the popover key handler before the global Esc handler on the same target (capture order = registration order); otherwise Esc closes the side panel underneath.
- Skeleton parity: fix the one varying height (card meta) with a shared CSS variable, rather than guessing a placeholder pixel height.
- Shot-only delays go through a hook that exists only when `__PLEXUW_MOCK__` is true, so the release bundle carries no test timing code.
- Removing dead CSS selectors can break regex-based CSS tests; update those tests in the same change.

### fu7f (round 2, Scott's video findings)
- A page-swap snapshot needs a safety timeout longer than the render harness's capture delay (~27 s), or the shot shows the already-faded state; 30 s is the net, route() ends it normally.
- A position:fixed overlay appended to body can sit under the app shell; mount it inside #main and copy the live view's box (top below the top bar, width, padding) so the held page looks identical.
- Credits without a person id must still be clickable: they open a local popover (name, role, photo) instead of silently being a div.
- Loading states are skeletons with aria-label only; tests grep the source for leftover 'Loading…' strings.

## fu7g
- MUST-1 root cause: two hashchange handlers. Legacy app.js (loaded first) reset #main.scrollTop to scrollMem[h]||0 before plex-browse route() ran sm.save(), so the saved value for the page you left was 0. Fix: app.js skips its scroll reset for #px/ routes (plex-browse owns that scroll). This is cleaner than dropping route()'s save, and it also keeps the leaving-page snapshot from jumping to the top.
- The fu7f unit tests used a stub instead of app.js, so they passed. fu7g-back.test.mjs runs the REAL data.js + app.js in node:vm with a permissive Proxy DOM, then asserts Back = 1800 and Forward = restored. It also proves that the 9e63b02 app.js gives 0. Lesson: integration tests must include every listener on the same event, in load order.
- Forward is disabled via scrollMemory.canForward (topI is truncated on new entries, like the browser).
- Backdrop mousedown: preventDefault, or the browser moves focus to <body> after close() returns it.
- Release strings check: the web assets are compressed in the binary, so the meaningful check is grep on the release dist/desktop.js (0). The mock binary shows __plexShot=1 (from the Rust eval string) as a positive control.

## fu7h (fu7g line, round 2 of 3)
- MUST-1b: a control that "works" can still be unreachable. The top-bar Back/Forward scrolled away with #main, and scrolling up to reach it saved 0. Now `body.plexmode #main>.topbar` is sticky; the negative margins + padding give 0 px layout shift. Lesson: test navigation through the real control at real coordinates. Programmatic .click() cannot catch occlusion or off-screen controls.
- Render scene fu7hclick does a real X11 click via /workspace/rendercheck-click.sh (xdotool at window-relative 315,90), and the badge requires isTrusted=true. It also asserts the Back rect is inside the viewport and hit-testable at 1800 px.
- The vm/proxy test was replaced by jsdom: the real index.html, data.js and app.js (real route()/sPost), plus the real bundled plex-browse mountPlexBrowse route(), clicking the real Back/Forward buttons. The regression runs twice: a git-free mutation (remove the #px/ guard → 0) and a git show 9e63b02 run that assert.fails without git.
- Incremental `cargo tauri build` did not re-embed a changed dist/ (the mock render showed the old JS). Touch src-tauri/src/lib.rs before every build after a sync-web.
- LOW-A': tauri-build never removes stale permissions/autogenerated/*.toml, so a mock build's shot_id.toml leaked allow-/deny-shot-id into release. Now build.rs deletes that one generated file when building without mockplex (rerun-if-changed on it). permissions/ is tracked; shot_id.toml is gitignored. Release binaries: shot-id/allow-shot-id = 0.
