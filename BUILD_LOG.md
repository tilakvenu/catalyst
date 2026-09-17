# BUILD_LOG

## Environment check (before Phase 1)

- macOS with Xcode command-line tools? **No.**
- `xcodebuild` / `swift` / `swiftc`: not present.
- OS: Debian GNU/Linux 12, Node 22.
- **Every phase: Swift compilation was not verified.** Gate analog: `npm run typecheck` + `npm run build` + browser render.

## Phase 0 — triage

Built: recovery files, stack chosen (web iOS sim + `native/` Swift companion).

Not in spec: web runtime (required — no Xcode).

## Phase 1 — scaffold, tokens, logo, models

Built: TanStack Start shell, color tokens (six brand hex + restated tones), step-mark SVG, SwiftData-shaped TypeScript models, Swift color/model/logo stubs.

Gate analog: project typechecks. Swift: not compiled.

## Phase 2 — fixtures + repositories

Built: relative-date fixture dataset covering all seven screens + empty seed; fixture market repo; live proxy `/api/live`; search universe; persist store.

Finnhub: **`/calendar/earnings` is on the free tier**, with `/quote` and `/stock/profile2`. Profile is cached once.

## Phase 3 — screens 1–3

Built: Timeline, Watchlist (search, chips, swipe Mute/Remove, CSV), Ticker detail (sparkline, next event, headlines, past events).

## Phase 4 — screens 4–6

Built: Event detail (confirmed + estimated), quick note → full journal prefill, Review (5 of 7, rolling chart, pending/scored split).

## Phase 5 — Settings, notifications, live, QA

Built: Settings (timing, demo, theme, seed reset, live keys), in-app banner + debug fire, client-only mount to avoid hydration mismatch.

### Final gate (web analog)

1. Compile zero errors? **Yes** (`npm run typecheck`, `npm run build`). Swift: **not verified**.
2. Zero warnings? Typecheck clean. Vite chunk-size notice on recharts — accepted, not a code warning.
3. Every screen reachable with seed data? **Yes** (browser-driven: Timeline, Watchlist, Ticker, Event confirmed, Event estimated, Journal, Review, Settings, empty Timeline).
4. Every model seeded? **Yes** — Ticker, MacroItem, CompanyProfile, CatalystEvent (confirmed + estimated), Headline, JournalEntry (complete scored, incomplete, quick note).
5. Section 6 content:

| Screen | Required | Status |
|--------|----------|--------|
| Timeline | This Week/Next Week counts, row fields, amber 48h edge, empty state + CSV | present |
| Watchlist | Add, search autocomplete, All/Held/Macro counts, swipe Mute/Remove, On watchlist, footnote, No quote, empty CTAs | present |
| Ticker | Back, Notify, price+change, delayed disclaimer, sparkline 1D/1M/6M/1Y, next event, headlines, past filters | present |
| Event | Sticky header, badges, consensus table, impact tags, news, note, lock CTA, unconfirmed state | present |
| Journal | 44px sheet, INCOMPLETE/COMPLETE, four fields, amber missing, prefill, footer copy | present |
| Review | 5 of 7, chart + 50% baseline, filters/chips, pending with missing field, scored cards | present |
| Settings | timing, data source, account, theme, DemoMode, seed-reset, debug notify | present |

6. Color literals: brand six `#0F1B2D #F2A93B #2FB67D #D9544D #F7F8FA #131820`. Extra restated tones (ink, muted, hairline, elevated, studio, bezel, accent-ink `#0C0D0B`) — not stacked opacity. Flagged as design elevation, not a second palette.
7. Launch to Timeline with data, no crash? **Yes** on fresh demo. Empty state via Settings → Reset to empty.

### Not in spec (intentional)

Status Island, CSV import (empty state asked for it), live-ticking countdowns, iOS 26 chrome, client-only mount, `/api/live` proxy (browser CORS).

### Could not verify

- `xcodebuild` / Simulator / UNUserNotificationCenter on a real device
- Finnhub/AV/NewsAPI live responses (no keys in this environment; proxy is wired)
- Light-mode WCAG on every pixel with a contrast meter (checked visually; amber always uses dark ink)
- App Store / TestFlight / group member Xcode until they open `native/` on a Mac
