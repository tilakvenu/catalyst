# Catalyst — session recovery

If this session is interrupted, say: **“session got interrupted, continue from PROGRESS.md”**.

## Git

- Branch `versionC67` (do not rewrite C5).
- C5 frozen at `ced85b4cbf70fe48949b2e8fbe7b2ca213d7d4e4` (tag `C5` / `versionC5`).
- Checkpoint 0: tag `c67-checkpoint-0` = `7a6d835` — WIP before trading-calendar.
- After that: trading calendar + remaining P0 (this file’s “Next”).

## P0 audit (read from disk at checkpoint-0 / 7a6d835)

| Item | Status | Proof |
|------|--------|-------|
| §0b five-field schema | DONE | `types.ts` Headline.firstSeenAt:129; JournalEntry lockedAt/callTarget/evidenceSnapshot/scoringRuleVersion/state:147–154. Diff vs C5 is those plus TabId/Screen/SEED_VERSION. |
| §5 two tabs, no badges | DONE | `app.tsx:218–219` Desk + Record only; TabBar has no `badge`. |
| §13 evidence freeze | DONE | `evidence.ts` pack/unpack; `event.tsx:343` “Known when you called”; snapshot JSON in the string so tape rollover cannot empty it. |
| §14 lock integrity | PARTIAL at checkpoint-0 | `lock.ts` lockedAt + revision **after event start** only; pre-event re-lock overwrote. **Fixed after checkpoint-0:** re-lock always creates a revision. |
| §16b FLAT_BAND_MULTIPLE | DONE | `scoring.ts:5` `= 1.0`; shown in `journal.tsx:163` and `now.tsx:339` before lock. |
| §16c typical session | DONE | option **a** — drop known event dates from the 1M spark (`scoring.ts:74–77, 85–93`). |
| §17 macro callTarget | DONE | `lock.ts:41–43` `macro-target`; picker in `journal.tsx:168–198`. |
| §20b session-aware resolve | PARTIAL at checkpoint-0 | weekday skip only, comment “ignores exchange holidays”; fixtures used `at(now, 6.2)` so CPI could land Saturday. **This drop:** `calendar.ts` + holiday list; AMC → next **trading** session close. |
| §21 Record calibration | DONE | `review.tsx:88–117`; `CALIBRATION_MIN_OVERALL = 15`, `CALIBRATION_MIN_BAND = 8` in `scoring.ts:177–178`. |
| §34 acceptance tests | PARTIAL at checkpoint-0 | `c67.test.ts` is **node:test**, not vitest; was not in `package.json` test script. **This drop:** script includes it. |
| DEFERRED.md | NOT STARTED at checkpoint-0 | **This drop:** added. |

## Next if interrupted

1. Amendment A: four tabs Catalyst / Calendar / Tape / Record. Watch is a push.
2. A0 closed: vitest 25 passed; pre-event re-lock tests added.
3. Next: A1–A9 (nav, Catalyst rename, launch table, calendar tab, tape tab, impact violet+vol, remaining P1).
4. Commit cadence: WIP every ~10 min on `versionC67`. No squash, no rebase, no publish.

## Log

- 2026-09-19: `7a6d835` C67 WIP Desk/Record nav, target picker, impact semantics. Tagged `c67-checkpoint-0`.
- 2026-09-19: `3516ce1` trading calendar, lock revisions, DEFERRED.md.
- 2026-09-19: A0 — ported c67.test.ts to vitest (25 passed); pre-event re-lock + final scored-version tests. | next: A1 four tabs.
