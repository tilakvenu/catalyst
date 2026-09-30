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
