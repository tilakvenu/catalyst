# Catalyst — native SwiftUI companion

This folder is the **Xcode / Claude Design** handoff. The running demo in this repo is the web iPhone simulation (no macOS here, so Swift was never compiled).

## Open in Xcode

1. Create a new iOS App (SwiftUI, SwiftData, iOS 17+, product name **Catalyst**).
2. Drop every file in `Catalyst/` into the target.
3. Copy `Secrets.example.swift` to `Secrets.swift` and add it to `.gitignore`.
4. Add the step-mark PDF/SVG to the asset catalog as `Logo` and an app-icon set (the web `public/favicon.svg` is the same geometry).
5. Build. **This tree has not been compiled** — treat first `xcodebuild` as the real gate.

## Mapping

| Spec | Swift | Web analog |
|------|--------|------------|
| SwiftData `@Model` | `Models.swift` | Zustand + localStorage |
| Color enum | `Color+Catalyst.swift` | `src/styles.css` `@theme` |
| Demo fixtures | Port `src/lib/catalyst/fixtures.ts` | already running |
| UNUserNotificationCenter | Schedule on event add; debug fire from Settings | in-app banner |
| Finnhub / AV / NewsAPI | Protocol + `FixtureMarket` / `LiveMarket` | `src/lib/catalyst/live.ts` |

Finnhub **free tier includes** `/calendar/earnings` and `/quote`. Fetch company profile **once**, persist, never on screen load.

## Claude Design

Point Claude at this folder plus `../CLAUDE_HANDOFF.md` and `../src/lib/catalyst/` (fixtures, types, selectors). The web app is the visual source of truth — match Liquid Glass chrome, not a dashboard.
