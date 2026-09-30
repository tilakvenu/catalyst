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

C67 web QA is done. Active branch is `versionC67.2`. Do not move `versionC67` or `main`.
§R, §E, and §A are committed. Expo web is the active app. No squash, no rebase, no force-push.

## Log

- 2026-09-19: `7a6d835` C67 WIP Desk/Record nav, target picker, impact semantics. Tagged `c67-checkpoint-0`.
- 2026-09-19: `3516ce1` trading calendar, lock revisions, DEFERRED.md.
- 2026-09-19: A0 — ported c67.test.ts to vitest (25 passed); pre-event re-lock + final scored-version tests.
- 2026-09-19: A1–A9 four tabs Catalyst/Calendar/Tape/Record, launch table, calendar dots+heat, tape vol+violet, A9 43 tests. | next: browser QA.
- 2026-09-19: QA pass. Observed-move only after the name has no upcoming event; wrong-if copy not auto-judged on Record. | next: none.

- 2026-09-23: c67.2 §R — tag C67 at 2258330; branch versionC67.2; versionC5 branch+tag removed after all three refs matched ced85b4 (tag C5 kept); experiment tags moved to archive/* at the same commits. VERSIONS.md + AGENTS.md name versionC67.2 and mobile/. | next: Expo foundation in mobile/.
- 2026-09-23: c67.2 §E — Expo SDK 57.0.24, Reanimated 4.5.1, react-native-worklets 0.10.1, react-native-svg 15.15.4. Four tabs Catalyst/Calendar/Tape/Record, no badges. Theme tokens match C67. Pure modules imported from src/lib/catalyst via Metro watchFolders (not an npm workspace, so SDK 57 does not auto-wire the root). Existing vitest: 43 passed. | next: launch animation.
- 2026-09-23: c67.2 §A — Reanimated launch (gravitational collapse) driven only by mobile/src/launch/launch-spec.ts. Frames at 300/900/1500/1850/2100. Reduced motion, cold-launch flag, Replay from About. | next: none.
- 2026-09-23: C67.3 browser-bound modules still in src/lib/catalyst (do not import into mobile yet): store.ts uses zustand persist (localStorage) and window.Notification; live.ts calls fetch("/api/live"); news-fetch.ts calls fetch against vendor URLs (AbortController, string markup parsing, no DOMParser).
- 2026-09-29: c67.3 §1 — branch c67.3-backend from versionC67.2 @ e518290. macOS 26.6 arm64, Node 24.2.0 (SDK 57 min 22.13), npm 11.3.0. mobile npm ci ok; expo-doctor 17/18 (4 patch mismatches: expo, expo-constants, expo-linking, expo-router); mobile tsc: 1 error (launch-spec.test.ts imports vitest, not a mobile dep). Root: vitest 53/53, strip-types 55/55, scripts/*.test.mjs 178/195 (17 fail on Grok-only files .grok/ and public/__grok/, gitignored). | next: Tilak confirms launch on phone, then §2 Back4App.
- 2026-09-29: c67.3 §2 — Tilak confirmed launch animation on phone (§1 done). Added mobile/.env.example (EXPO_PUBLIC_PARSE_APP_ID/JS_KEY/SERVER_URL) and cloud/.env.example (PARSE_APP_ID/JS_KEY/MASTER_KEY/SERVER_URL), blank values; .gitignore allows !.env.example, real .env still ignored. | next: Tilak creates app and fills .env.
- 2026-09-30: c67.3 §2 — CLAUDE.md updated for C67.3 architecture (Expo mobile/, Back4App cloud/, server as referee, app keys in gitignored .env, master key server-side only, no vendor keys on phone); all other rules kept. | next: §2 connection check.
- 2026-09-30: c67.3 §2 done — backend work uses only cloud/.env via local scripts. cloud/check.ts: env set/empty + /serverInfo -> connected, Parse Server 7.5.2. cloud/deploy.ts: Cloud Code deploy with App ID + Master Key via parsecli.back4app.com GET/POST /deploy + POST /scripts (same endpoints as Back4App npm package v0.1.9 fileDeployment.ts); tested with a master-only runtime probe (release v1): Cloud Code runs Node v19.9.0 -> esbuild target node19. | next: §3 schema script cloud/schema.ts.
- 2026-09-30: c67.3 §3 — cloud/schema.ts v1 applied (idempotent; --check verifies): _User+theme/notifyLead; Ticker, MacroSeries, CatalystEvent, Headline read signed-in/no client writes; WatchItem, Call signed-in CRUD (owner ACL set in beforeSave, §4); CallRevision signed-in read/no client writes; addField none everywhere; _User find/count/delete none. Indexes: Ticker symbol, MacroSeries key, CatalystEvent startsAt, Headline ticker+firstSeenAt and macro+firstSeenAt, WatchItem owner, Call owner+event, CallRevision call. updatedAt and unique indexes not possible via Parse schema API -> DEFERRED.md. Found client class creation ON (JS key created a class; probe class removed) -> Tilak must turn off Allow class creation. cloud/scan-keys.ts guards commits. | next: §4 Cloud Code bundle + triggers.
- 2026-09-30: c67.3 §3 schema v2 applied, --check clean. _User protectedFields "*": [email, authData]; WatchItem, Call, CallRevision read only via readUserFields ["owner"] (find/get/count {} so pointer perms actually apply; requiresAuthentication short-circuits them in 7.5.2); CallRevision + owner pointer + owner_1 index. cloud/test/privacy.ts 8/8 PASS (v1 baseline: email already hidden by Parse default, WatchItem leaked without ACL). check.ts lists classes not in schema.ts (none; B4aVehicle gone). Client class creation stays on -> DEFERRED.md. | next: §4 Cloud Code.
- 2026-09-30: c67.3 §4 wip — cloud/ is an npm package (esbuild 0.28.2, tsc). src/referee.ts = pure rules reusing C67 lock/session/resolve/scoring/calendar/build/types; src/main.ts = triggers (Call lock/relock+CallRevision, WatchItem owner/dupes, read-only reference+CallRevision, _User theme/notifyLead), functions bootstrap/getCalendar/getEvidence/deleteAccount/health(master), job tick. src/dto.ts = wire contract for mobile. Every client Call save is a lock (drafts local-only). Schema v3: CatalystEvent.typicalMovePct (server has no price history; tick leaves calls pending until print+typical exist, never marks unresolvable). Found Back4App Node 19.9 ICU 72.1 lacks en-CA (01/02/2026): src/intl-shim.ts restores YYYY-MM-DD server-side; health confirms holidays correct. Unit 15/15. Deployed release v3. | next: seed.ts, live smoke of lock/relock/tick.
