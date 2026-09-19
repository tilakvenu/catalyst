# Catalyst — session recovery

If this session is interrupted, say: **“session got interrupted, continue from PROGRESS.md”**.

## Git

- Branch `versionC67` (do not rewrite C5).
- C5 frozen at `ced85b4cbf70fe48949b2e8fbe7b2ca213d7d4e4` (tag `C5` / `versionC5`).
- Checkpoint 0: tag `c67-checkpoint-0` = `7a6d835` — WIP before trading-calendar.

## P0 audit (read from disk at checkpoint-0 / 7a6d835)

| Item | Status | Proof |
|------|--------|-------|
| §0b five-field schema | DONE | `types.ts` Headline.firstSeenAt:129; JournalEntry lockedAt/callTarget/evidenceSnapshot/scoringRuleVersion/state:147–154. Diff vs C5 is those plus TabId/Screen/SEED_VERSION. |
| §5 two tabs, no badges | SUPERSEDED by A1 | Four tabs Catalyst / Calendar / Tape / Record. Watch is a push. No badges. |
| §13 evidence freeze | DONE | `evidence.ts` pack/unpack; `event.tsx` “Known when you called”. |
| §14 lock integrity | DONE | Re-lock always creates a revision. Tests: pre-event re-lock + final scored version. |
| §16b FLAT_BAND_MULTIPLE | DONE | `scoring.ts:5` `= 1.0`. |
| §16c typical session | DONE | option **a** — drop known event dates from the 1M spark. |
| §17 macro callTarget | DONE | `lock.ts` `macro-target`; picker in `journal.tsx`. |
| §20b session-aware resolve | DONE | `calendar.ts` + holiday list; AMC → next **trading** session close. |
| §21 Record calibration | DONE | `CALIBRATION_MIN_OVERALL = 15`, `CALIBRATION_MIN_BAND = 8`. |
| §34 / A0 tests | DONE | vitest, wired into `npm test`. |
| DEFERRED.md | DONE | Includes empirical-impact-from-historical-prints. |

## Amendment A

| Item | Status | Proof |
|------|--------|-------|
| A0 vitest + lock tests | DONE | 43 tests in `c67.test.ts` under vitest. |
| A1 four tabs | DONE | `nav.ts` TAB_BAR_ITEMS; `tab-bar.tsx` TabBarView; Watch is not a tab. |
| A2 Desk → Catalyst | DONE | `now.tsx` large title "Catalyst". |
| A3 launch table | DONE | `app.tsx` LaunchOverlay; `cat-launch` key; 2100ms / 400ms reduce / webdriver skip. |
| A4 calendar | DONE | `calendar-tab.tsx` + `cal-view.ts` five dots, heat, legend once. |
| A5 tape as tab | DONE | `NewsScreen` on tab `tape`; followed only; grouped; pb-28. |
| A6 impact vol + violet | DONE | `adjustImpactForVol`; `--impact-high` / `--impact-med` only new tokens. |
| A7 remaining P1 | DONE | Watch toolbar push; Event freeze/wrong-if displayed not judged; pending neutral; Day-1 density already on call sheet. |
| A9 acceptance | DONE | Navigation, calendar, impact, invariants tests. |

## Next if interrupted

1. Browser QA of four tabs + launch (`?launch=1`) + calendar dots.
2. Keep committing on `versionC67`. No squash, no rebase, no publish.

## Log

- 2026-09-19: `7a6d835` C67 WIP Desk/Record nav, target picker, impact semantics. Tagged `c67-checkpoint-0`.
- 2026-09-19: `3516ce1` trading calendar, lock revisions, DEFERRED.md.
- 2026-09-19: A0 — ported c67.test.ts to vitest (25 passed); pre-event re-lock + final scored-version tests.
- 2026-09-19: A1–A9 four tabs Catalyst/Calendar/Tape/Record, launch table, calendar dots+heat, tape vol+violet, A9 43 tests. | next: browser QA.
