# PlexUW QA — release-binary renders (2026-10-23)

Source: **per Scott via Master Control, 2026-10-23**.

## Lesson

**fu7j** QA PASS was based on **mock-build** renders, not the shipped binary. That is no longer acceptable for a release sign-off.

## Standing rule (from fu7k onward)

- QA renders must come from the **release binary**, or be explicitly labelled **mock** or **release** in the review packet.
- The build **decodes the exe's embedded assets** and **fails** on any mismatch with **dist**.
- A **release-mode QA pass** is required before Scott is asked to test an installer.
- The **build id** must appear in **Settings > About**.
- **Installer delivery to BigBoy** must be verified (correct artifact, not a stale or mock-only path).

Product context: [../projects/plexuw/decisions.md](../projects/plexuw/decisions.md). Day index: [../changelog/2026-10-23.md](../changelog/2026-10-23.md).

Implementation status in TTGDevX is outside this doc; treat CI and on-box checks as **not verified** until confirmed in chat or CI.
