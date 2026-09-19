# Handoff for Claude Design / the rest of the group

**Start here in Claude: [`CLAUDE.md`](CLAUDE.md).** This file is the longer checklist.

This project was built in Grok Build because there is no Xcode here. You can keep going in Claude. Repo: [tilakvenu/catalyst](https://github.com/tilakvenu/catalyst).

## What to load in Claude

1. **Visual source of truth** — the running web app (this repo). Match the iPhone chrome: floating glass tab bar, 44px sheet radius, iOS system blue as the tint (`#007AFF` / `#0A84FF`), never as a canvas wash. True black `#000000` dark mode, iOS grouped `#F2F2F7` light mode. Step-mark logo with a blue bead.
2. **Data source of truth** — `src/lib/catalyst/fixtures.ts` and `types.ts`. Port 1:1 into SwiftData.
3. **Native stubs** — `native/Catalyst/*.swift` (models, color enum, logo, Secrets.example).
4. Original spec — `attachments/Pasted Text.txt`.

Do **not** redesign into a generic dashboard. Do **not** add related-tickers. Do **not** add a backend.

## Gate Claude should run on a Mac

```
xcodebuild -scheme Catalyst -destination 'platform=iOS Simulator,name=iPhone 16' build
```

Until that passes, say so. Do not claim a Simulator launch if you could not run one.

## Screens already specified

Now (home), Names, Record. Tape and Settings are push screens. Ticker, Event, Journal. Fixtures populate all of them plus empty states (Settings → Reset to empty). News is a Yahoo-style tape with High / Med / Low impact flags, opened from Now. Prior five-tab IA: git tag `pre-consumer-redesign`.

## Design deltas from the original spec (intentional)

- iOS 26 Liquid Glass on **chrome only** (tab bar, nav, sheets, island). Content cards stay solid.
- Radii concentric (cards ~22, sheets 44 top), not 12px everywhere.
- SF Pro / system UI stack. Large titles 34pt bold. Review percentage is SF Display, not a serif.
- Status Island (next event countdown).
- Broker CSV import (the empty state already asked for it).

## Features added because the web build can ship them now

- Live-ticking countdowns
- In-app notification banner + debug fire (UNUserNotificationCenter analog)
- Spotlight-quality watchlist search over a US equity/ETF universe
- Theme: light / dark / system (true black / iOS grouped gray, system-blue tint)
- Seed reset for empty states
- Launch overlay: step-mark + wordmark, ~1.55s, then fades into the tab. Skip on reduced-motion. `sessionStorage` key `cat-launch`. Native analog: a SwiftUI overlay on the root, not a storyboard splash that unmounts the app.
- Day-grouped timeline + NYSE session clock (no API)
- Ready-to-score banner on Timeline when a complete call has a next-session print
- One-tap Score from print (`printMovePct` or last change)
- Last-four EPS surprise + analyst mix as one Tape card
- Day range, market cap / P/E / 52-week, typical-session vol from the 1M spark
- Conviction calibration on Review (hit rate at 1–2 / 3 / 4–5)
- Review tab badge = pending count
- Macro last print on Watchlist (CPI / FFR / NFP) instead of “No quote”
- Live rotation (429 cooloff): quote Finnhub → AV → Stooq; **news tape (no key)** Yahoo RSS → Google News RSS → Nasdaq RSS → Seeking Alpha → FreeNewsAPI, then Finnhub company-news → NewsAPI → AV NEWS_SENTIMENT; **Rank with Grok** is user-initiated; earnings Finnhub → AV; calendar Finnhub → AV; metrics Finnhub → AV OVERVIEW; macro Finnhub econ calendar → AV series → NY Fed EFFR / BLS
- Watchlist scan pulls the next earnings date for followed names and fills estimated events
- No related-tickers. No backend accounts.
