# `src/data` — backend contract for screens

Everything a screen needs from the Back4App (Parse Server) backend comes through `import { … } from "../data"` (or `"../../data"` from `app/(tabs)`). Screens never import `parse`, never call `Parse.*`, and never talk to the network directly.

## The one rule

**Never fetch on focus.** No request on tab switch, screen focus, mount of a tab, or a timer. Screens read the local cache through the hooks below. The app talks to the server only:

| When | What runs | Requests |
|---|---|---|
| App open (after the stored session loads) | `bootstrap` delta | 1 |
| Back to foreground after ≥ 15 min (`FOREGROUND_RESYNC_MS`) | `bootstrap` delta | 1 |
| A write: lock, watchlist change | the write itself (no re-sync) | 1 |
| Pull-to-refresh | `refresh()` | 1 |
| Calendar paged outside the last sync window | `getCalendar(month)` once per month | 1 |
| Evidence panel with headlines not already cached | `getEvidence(ids)` | 0–1 |

Opening the app never costs a login request: the signed-in user comes from Parse's stored session.

Measured with `cloud/test/app-layer.ts` against the live backend: sign-up 2, each watchlist write 1, `saveDraft` 0, `lockCall` 1, re-lock 1, pull-to-refresh 1, Record 0, evidence from cache 0.

## Setup

`mobile/.env` (gitignored; copy `mobile/.env.example`) needs `EXPO_PUBLIC_PARSE_APP_ID`, `EXPO_PUBLIC_PARSE_JS_KEY`, `EXPO_PUBLIC_PARSE_SERVER_URL`. Restart `npx expo start` after editing it. The master key never goes in `mobile/`.

`_layout.tsx` wraps the navigator in `<DataRoot theme={theme}>`. It loads the stored session and cache before anything is decided (no flash of the wrong screen), then overlays the sign-in screen when nobody is signed in. The navigator stays mounted underneath.

## Accounts

| Export | In → out | Used by |
|---|---|---|
| `useSession()` | → `{ status: "loading" \| "unconfigured" \| "signedOut" }` or `{ status: "signedIn", user: { id, email } }` | `DataRoot`, About |
| `currentUser()` | → `{ id, email } \| null` from memory, no request | anywhere |
| `signUp(email, password)` | → `SessionUser`. 2 requests (sign-up + first sync). Username is the email. | `AuthScreen` |
| `signIn(email, password)` | → `SessionUser`. 2 requests (log-in + sync). | `AuthScreen` |
| `signOut()` | 1 request; clears this device's cache | About |
| `deleteAccount()` | → `{ deleted: { callRevisions, calls, watchItems, sessions, user } }`. 1 request. Server deletes everything, then the device forgets the user. | About |

## Watchlist

`held` and `muted` are per user (on `WatchItem`), not on the shared `Ticker`.

| Export | In → out | Used by |
|---|---|---|
| `useWatchlist()` | → `{ tickers: (Ticker & { watchItemId })[], macros: (MacroItem & { watchItemId })[], universe: { tickers, macros } }`. Cache only. | Names, add sheet, Settings |
| `addWatch({ tickerId } \| { macroId })` | → `WatchItemDTO`. 1 request. Duplicate → rejected by the server. | add sheet |
| `removeWatch(watchItemId)` | 1 request. Optimistic; restored if the server refuses. | Names |
| `setHeld(watchItemId, bool)` / `setMuted(watchItemId, bool)` | 1 request each. Optimistic with rollback. | Ticker, Names |

## Desk, calendar, record

| Export | In → out | Used by |
|---|---|---|
| `useDesk(now?)` | → `{ upcoming: CatalystEvent[] (next 14 days, watched & unmuted), headlines: Headline[] (newest first), callsByEvent, draftsByEvent }`. Cache only. | Catalyst (Now), Tape |
| `useCalendar("YYYY-MM")` | → `{ month, events: CatalystEvent[], status: "ready" \| "loading" \| "error", error? }`. Cache when the month is inside the last sync window (−7 to +42 days); otherwise one `getCalendar` request for that month, then cached. | Calendar |
| `useRecord(now?)` | → `{ entries, scored, pending, unresolvable, accuracy: { n, hits, pct }, rolling, bands, captured, calibration }`, computed from cached calls with C67 `scoring.ts`. Zero requests. Nothing is stored server-side. | Record |
| `computeRecord(calls, now)` | Same, as a plain function. | tests |
| `getEvidence(ids)` | → `Headline[]`. Cached headlines first; requests only missing ids (max 200). | Journal / evidence panel |

## Calls

Drafts live only on the phone. Every save to the server is a lock.

| Export | In → out | Used by |
|---|---|---|
| `saveDraft(eventId, { direction?, conviction?, reasoning?, wrongIf?, callTargetId? })` | → `Draft`. Local, works offline, 0 requests. Editing a locked call starts from the locked values. | Journal sheet |
| `discardDraft(eventId)` | Local. | Journal sheet |
| `lockCall(eventId)` | → `CallDTO`. 1 request. Checked on the phone first with the same C67 `canLock` the server uses, so an incomplete draft costs nothing. Throws `LockError` with `kind`: `"offline"` (draft kept; message says to lock when back online), `"incomplete"`, `"macro-target"` (macro calls need `callTargetId`, a ticker id), `"started"`, `"rejected"` (server said no; message from the server). Re-locking before the event updates the same call; the server keeps the old version in `CallRevision`. | Journal sheet |

The server, not the phone, sets `lockedAt`, `evidenceIds` (the event's headlines first seen at or before the lock), `scoringRuleVersion`, `outcome` and `state`. Anything the phone sends for those is ignored.

## Debug

`useSyncState()` → `{ syncing, error, requestCount, lastSyncAt, lastSyncReason, cursor, counts }`. `requestCount` counts every request the Parse SDK sent this session. Shown on **gear → About → Backend check** (`app/backend-check.tsx`).

`refresh()` is pull-to-refresh. Wire it to `RefreshControl` on list screens; nothing else should call it.

## Types and ids

Hooks return the shared C67 types (`src/lib/catalyst/types.ts`). Differences from the local C67 model:

- Every id (`Ticker.id`, `tickerId`, `macroId`, `eventId`) is a Parse objectId. A macro's C67 key (`"cpi"`) is `MacroSeriesDTO.key`.
- `Ticker.lastPrice / change / changePct` are `0`: there are no quotes on the server yet (live data is deferred).
- `CatalystEvent.description` is `""`, `impact` is `[]`, `notify` is `false` (not in the server schema).
- `JournalEntry.evidenceSnapshot` holds headline ids only; use `getEvidence` for titles. `actualDirection / actualMovePct / actualMoveDate` come from the server's `outcome`.
- Wire types are in `cloud/src/dto.ts`; mapping is `map.ts`.

## Files

`parse.ts` client + request counter · `crypto-shim.ts` (+ alias in `metro.config.js`: Parse 8's React Native build needs `crypto.randomUUID`, Parse-SDK-JS#2856/#3095; served by `expo-crypto`) · `cache.ts` AsyncStorage cache · `sync.ts` when to talk to the server · `auth.ts` · `watchlist.ts` · `calls.ts` · `hooks.ts` · `map.ts` · `DataRoot.tsx` · `AuthScreen.tsx` (minimal; restyle freely, keep `signIn`/`signUp`).

Headless test of this layer against the live backend (creates and deletes one `test-*` user): `cd cloud && node run-app.mjs test/app-layer.ts`.
