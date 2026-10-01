# Deferred — Catalyst C67

Not in this drop. Do not implement on `versionC67` unless the brief is reopened.

- Yields / duration as a first-class call target (beyond SPY/QQQ/watchlist equities)
- Group / desk leaderboard
- New market-data or news vendors
- Auth, accounts, cloud sync
- Native iOS compile / Xcode Simulator verification (no macOS in this environment)
- Early-close calendar (day-before-holiday 1:00 p.m. ET) — full-day holidays only
- Implied-move from options (typical session remains spark stdev)
- Structured invalidation evaluator (wrong-if is displayed, not auto-judged FIRED/DID NOT FIRE)
- Push notification server (`UNUserNotificationCenter` analog stays local/debug)
- Related-tickers / sector recommendations (explicitly rejected)
- Empirical impact from historical prints: record impact class against the realized next-session move, then show the actual distribution per class once enough observations exist. Prototype has no history to train on.

## C67.3 backend (branch c67.3-backend)

- **`updatedAt` indexes for delta sync.** Parse Server 7.5.2's schema API validates index keys against Parse field names but passes them to MongoDB unchanged, and MongoDB stores `updatedAt` as `_updated_at`. So `{updatedAt: 1}` would index a column that does not exist and `{_updated_at: 1}` is rejected. Delta-sync queries are instead narrowed by `owner_1` (WatchItem), `owner_event` (Call), `startsAt_1` (CatalystEvent), and `ticker_/macro_firstSeenAt` (Headline); Ticker/MacroSeries are tiny. Real `_updated_at` indexes need direct MongoDB access (Back4App connection string), not the Parse API.
- **Database-level unique index on Call(owner, event).** Same limitation: the schema API only creates non-unique indexes. `beforeSave Call` enforces one Call per (owner, event) with a query, which leaves a narrow race if the same user creates the first Call for an event from two devices within the same instant. Closing it fully needs a unique index created directly in MongoDB.
- **Client class creation is still on.** Anyone holding the app's public JavaScript key can create a *new* class and add rows to it (verified live 2026-09-30 with a throwaway class, since removed). They cannot read, write or add fields to any existing class: every schema.ts class sets `addField: {}` and explicit CLPs. The "Allow class creation" toggle was not found in the current dashboard's App Settings (older docs place it under Server Settings → Core Settings → Edit details). Mitigation until it is off: `node cloud/check.ts` lists every class not defined in schema.ts so junk or sample classes are easy to spot.
- **Scoring needs recorded prints.** The server keeps no price history (live ingest is deferred), so `tick` scores a call only when its event has both `printMovePct` and `typicalMovePct` (schema v3). Until then the call stays pending; `tick` never marks it unresolvable, because that cannot be undone once prices arrive. C67's 48-hour unresolvable grace applies once a price source exists.
- **Drafts and quick notes stay on the phone.** Every client save of a `Call` is a lock (all four fields required). C67's quick-note `text` and `sentiment` have no server field; `saveDraft` keeps them local. Syncing drafts would need a separate class or fields.
- **Per-run limits.** `tick` scores up to 1000 due calls and prunes up to 10,000 old headlines per run; a lock records up to 200 evidence headlines. Ample for the free plan; revisit with real ingest.
- **`impact.ts` is not in the Cloud Code bundle.** Nothing ranks headlines server-side until live ingest exists; `seed.ts` uses the C67 fixtures, which are already ranked by `impact.ts`.

## C67.3 screens (Phase 7) — gaps between the C67 web screens and the data layer

- **No market data on the server yet.** Quotes, price change, sparklines, day range, market cap / P/E / 52-week, EPS surprise history, analyst recommendations, company profile and macro print values do not exist in the schema. Ticker shows "No quote yet" instead of the price block; Watch rows show "No quote" / "Macro"; the C67 TapeCard, typical-session and flat-band lines, and vol-adjusted impact (adjustImpactForVol) do not appear. They return once live data is ingested server-side.
- **Notifications.** The per-event Notify toggle (Event, Ticker) and "Fire a notification now" are not ported: there is no push backend. Alert timing in Settings is saved on the phone only, because the data layer has no setter for `_User.notifyLead`.
- **Theme preference is device-only** for the same reason (`_User.theme` has no data-layer setter).
- **Tape.** "Rank with Grok" is omitted (no LLM backend). "Refresh tape" is a normal sync; vendor news fetching belongs on the server with live ingest. Headline summaries are not in the schema, so Article shows the impact note but no summary.
- **Search universe** is the tickers the server has (seeded); the C67 static US list is not used because clients cannot create Ticker rows.
- **All-events read.** The data layer exposes no public "all cached events / event by id" hook, so screens read the cache read-only through `data/cache.useCache` and `data/map` (`ui/slice.ts`). No requests, no change to the data layer API; a `useEvents()` export would make this explicit.
- **Result ready** on the desk means "the server scored this call in the last 72 hours and this phone has not opened it yet" (device state), since scoring moved to the server's tick job.
- **Settings sections removed** as not meaningful with a backend: Demo mode, Live API keys (no vendor keys on the phone), Demo flows A/B/C, Synthetic model, Restore demo / Reset to empty. The web app's device frame, fake status bar with the island countdown, and in-app Banner are web-simulation chrome; the native OS status bar is used instead.
