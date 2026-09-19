# CLAUDE.md

You are continuing **Catalyst**, an iPhone earnings/macro trading journal. Read this file fully before writing Swift or changing the visual system.

This repo is the class handoff from Grok Build (Linux, no Xcode). The **web iPhone simulation is the visual source of truth**. Native stubs in `native/` have **not been compiled**.

Also read:

1. `CLAUDE_HANDOFF.md` — screens, features, gates
2. `DECISIONS.md` — why the theme and data model look like this
3. `native/README.md` — how to drop files into Xcode
4. `src/lib/catalyst/types.ts` + `fixtures.ts` — SwiftData 1:1
5. `src/styles.css` — Graphite + system blue tokens
6. `attachments/Pasted Text.txt` — original spec

## Hard rules

- Do **not** redesign into a generic dashboard.
- Do **not** add related-tickers or a backend / accounts.
- Do **not** bring back navy + amber. Theme is Apple HIG: true black / iOS grouped gray, system-blue tint (`#007AFF` / `#0A84FF`), semantic green/red, orange only for estimated/incomplete.
- Liquid Glass on **chrome only** (tab bar, island, sheets). Content cards stay solid.
- Radii concentric: device 54, screen 44, cards 22, sheets 44 top.
- Journal completion is **derived** from field presence, never a stored flag. Incomplete calls never enter the accuracy %.

## What to build on a Mac

Create a new iOS App (SwiftUI, SwiftData, iOS 17+, product name **Catalyst**). Drop `native/Catalyst/*.swift` into the target. Copy `Secrets.example.swift` → `Secrets.swift` (gitignored). Port fixtures/types 1:1.

Gate:

```
xcodebuild -scheme Catalyst -destination 'platform=iOS Simulator,name=iPhone 16' build
```

Until that passes, say so. Do not claim a Simulator launch if you could not run one.

## Product loop

Watch tickers/macros → see catalysts → write a call → score it the session after.

Screens: Now, Names, News, Record (tabs). Settings is a push. Ticker, Event, Journal.

Launch overlay analog: SwiftUI overlay on the root — black, mark, then zoom into the tint bead. Do not unmount the app behind a storyboard splash.

## Live data

Views never call vendors. Rotate on 429:

- quote: Finnhub → Alpha Vantage → Stooq
- news tape (no key): Yahoo RSS → Google News RSS → Nasdaq RSS → Seeking Alpha → FreeNewsAPI → Finnhub company-news → NewsAPI → AV NEWS_SENTIMENT
- impact rank: keyword heuristic, then optional user-initiated Rank with Grok
- earnings + calendar: Finnhub → AV
- metrics: Finnhub → AV OVERVIEW
- macro: Finnhub economic calendar → AV series → NY Fed EFFR / BLS

Keys stay on device. Free tier only.
