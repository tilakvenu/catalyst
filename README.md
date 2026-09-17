# Catalyst

Calls. Catalysts. Score.

A single-user journal for the events that actually move a name — earnings, CPI, FOMC — and a scoreboard that only counts **complete** calls.

**Repo:** [tilakvenu/catalyst](https://github.com/tilakvenu/catalyst) (private). Open this in Claude Design / Xcode from `CLAUDE.md`.

## What this repo is

The environment that built it had **no macOS and no Xcode**. The product that runs in the Grok preview is a high-fidelity **iPhone simulation** (iOS 26 Liquid Glass) so the class can demo every screen without a Mac.

Native SwiftUI sources for Claude Design / Xcode live in [`native/`](native/). They have **not been compiled**. Start there with [`CLAUDE.md`](CLAUDE.md).

## Demo

Opens on the Timeline, populated. Demo mode is on by default. No network, no API keys.

| Tab | What to try |
|-----|-------------|
| Timeline | Day groups, session clock, **Ready to score** on a complete print, empty state via Settings → Reset to empty |
| Watchlist | Search, All/Held/Macro, swipe Mute/Remove, CSV import, last CPI/FFR print, prints-this-week |
| News | Watchlist tape, impact flags (High / Med / Low), Targets / Company / Today filters, **Rank with Grok** |
| Ticker | Day range, mkt cap / P/E / 52w, typical-session vol, spark, next-event, flagged headlines |
| Event | Your call first, consensus, headlines, Continue journal |
| Journal | Direction, conviction, reasoning, invalidation. Incomplete stays Pending |
| Review | Accuracy, conviction bands (1–2 / 3 / 4–5), Pending with Score vs Complete, tab badge |
| Settings | Demo toggle, live keys, theme, seed reset, **Fire a notification now** |

First open of the phone: step-mark + **Catalyst** launch overlay, then the tab.

## APIs

News tape works **without keys**. Rotation with a 429 cooloff. One dead source does not blank the tape.

| Action | Order | Key? |
|--------|--------|------|
| Quote | Finnhub → Alpha Vantage → Stooq | Stooq is free |
| News tape | Yahoo Finance RSS → Google News RSS → Nasdaq RSS → Seeking Alpha → FreeNewsAPI → Finnhub company-news → NewsAPI → AV NEWS_SENTIMENT | First five: none |
| Impact rank | Heuristic keywords, then optional **Rank with Grok** | Grok uses the app's xAI key, user-initiated |
| Earnings + calendar | Finnhub → Alpha Vantage | yes |
| Metrics | Finnhub metric/profile2 → AV OVERVIEW | yes |
| Macro prints | Finnhub economic calendar → AV series → NY Fed EFFR / BLS | NY Fed / BLS free |

Vendor keys (optional) are entered in Settings and stored on-device. Native uses `native/Catalyst/Secrets.example.swift`.

## Stack

Web: TanStack Start, React 19, Tailwind v4, Zustand, Recharts. Auth off. No database.

Native target: SwiftUI, iOS 17, SwiftData, Swift Charts, UNUserNotificationCenter. Zero third-party packages.

## Claude Design

Load this repo. Read `CLAUDE.md` first. Visual truth is the web sim (`src/components/catalyst/`, `src/styles.css`). Data truth is `src/lib/catalyst/`. Do not add related-tickers or a backend.
