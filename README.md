# Catalyst

Calls. Catalysts. Score.

A single-user journal for the events that actually move a name — earnings, CPI, FOMC — and a scoreboard that only counts **complete** calls.

**Repo:** [tilakvenu/catalyst](https://github.com/tilakvenu/catalyst) (private). Open this in Claude Design / Xcode from `CLAUDE.md`.

## What this repo is

The environment that built it had **no macOS and no Xcode**. The product that runs in the Grok preview is a high-fidelity **iPhone simulation** (iOS 26 Liquid Glass) so the class can demo every screen without a Mac.

Native SwiftUI sources for Claude Design / Xcode live in [`native/`](native/). They have **not been compiled**. Start there with [`CLAUDE.md`](CLAUDE.md).

## Demo

Opens on the **desk**, populated. Demo mode is on by default. No network, no API keys.

| Surface | What to try |
|---------|-------------|
| Desk | One job: score a print if one is in, else lock the next call with Up / Down / Flat on the card. Ticker rail, high tape, later this week |
| Names | Search from the header. All/Held/Macro, swipe Mute/Remove, CSV |
| Record | Accuracy chip on the desk. Conviction bands, Pending with Score vs Complete |
| Tape | From desk → See all. Impact flags, Rank with Grok |
| Ticker | Quote, spark, next event, flagged headlines |
| Event | Your call first. Write / lock |
| Journal | Direction persists on tap, conviction 1–5, why, wrong-if. Drafts stay Pending |
| Settings | Gear on the desk. Demo, keys, theme, reset |

First open of the phone: step-mark + **Catalyst** launch overlay, then the desk.

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
