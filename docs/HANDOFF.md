**TEST FIRST (da Vinci): categories/genres after picking AND switching servers.** Sign in → pick server A → open a library → Genres tab → open a genre (works). Then sidebar switcher → pick server B → sidebar shows ONLY B's libraries; open one → Genres lists B's genres → open a genre (works). Switch back to A and repeat. Mock: run with `PLEXUW_MOCK_TWO_SERVERS=1` (Fixture Home → Friend's Server). Automated: `cargo test --features mockplex categories_reload_on_pick_and_switch`; screenshot shots-fu2b/m2catswitch-1920.png shows PASS. ☐

# Handoff: windows-app follow-up 4 (categories fix + M3 split)

- Build: NSIS installer, portable exe, .deb, AppImage from the follow-up 4 commit (see LESSONS.md). M3 playback is NOT in this build; it lives on local branch `m3-playback-wip`.
- Then run docs/WINDOWS-TEST-CHECKLIST.md top to bottom.
