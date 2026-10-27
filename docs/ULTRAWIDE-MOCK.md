> **Historical / mock only.** This note describes an old mock fixture (`PLEXUW_MOCK_TWO_SERVERS`, “Static Bloom”). It is not the current Rust/Tauri product. The live app is the desktop client in the root `README.md`.

# Ultrawide details — mock (fu6, Scott 2026-10-22 21:34)

Before/after, mock fixture "Static Bloom" (no real data), PLEXUW_MOCK_TWO_SERVERS=1:
- shots-fu6/ultrawide-mock-before-{2560x1080,3440x1440,5120x1440}.png
- shots-fu6/ultrawide-mock-after-{2560x1080,3440x1440,5120x1440}.png
- shots-fu6/details-1920-unchanged.png (normal screen check)

Proposal (implemented in desktop.css, CSS only):
- Poster: full 2:3 box, `object-fit: contain` (letterboxed when the art is not 2:3) — never cropped, all sizes.
- Trigger: width ≥ 2560px, or aspect ≥ 21:9 and width ≥ 1800px. Below that nothing changes.
- Scale for distance viewing: poster clamp(320–480px), title clamp(3–4.6rem), body 17–22px, 48px action buttons, 60px round buttons, larger padding.
- Credits move into a column beside the info (auto-fill grid of larger headshots) instead of a row below.
- Extras/related on the right: not done — needs new queries (M3). Only data we already have is used.
- Side panels: when the left (cast, file info) or right (chapters, Up Next) panel is open, the page falls back to the stacked layout so the panel rule holds.
