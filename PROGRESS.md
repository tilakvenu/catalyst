## Next if interrupted

On branch `versionC67.2` (do not move `versionC67` or `main`). §R is done. Next is Expo foundation in `mobile/`, then the Reanimated launch. No squash, no rebase, no force-push.

## Log

- 2026-09-19: `7a6d835` C67 WIP Desk/Record nav, target picker, impact semantics. Tagged `c67-checkpoint-0`.
- 2026-09-19: `3516ce1` trading calendar, lock revisions, DEFERRED.md.
- 2026-09-19: A0 — ported c67.test.ts to vitest (25 passed); pre-event re-lock + final scored-version tests.
- 2026-09-19: A1–A9 four tabs Catalyst/Calendar/Tape/Record, launch table, calendar dots+heat, tape vol+violet, A9 43 tests. | next: browser QA.
- 2026-09-19: QA pass. Observed-move only after the name has no upcoming event; wrong-if copy not auto-judged on Record. | next: none.
- 2026-09-23: c67.2 §R — tag C67 at 2258330; branch versionC67.2; versionC5 branch+tag removed after all three refs matched ced85b4 (tag C5 kept); experiment tags moved to archive/* at the same commits. VERSIONS.md + AGENTS.md name versionC67.2 and mobile/. | next: Expo foundation in mobile/.