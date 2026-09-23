# Versions

Current working version: versionC67.2

Web app (design reference, frozen): repo root, tag C67

Mobile app (active development): mobile/

Do not start from `main`. It is still the C5 snapshot. Switch the GitHub default branch to `versionC67.2` in Settings → General → Default branch (a person has to do that in GitHub settings; git cannot).

SHAs below are the commits the ref points at (`^{commit}`). Annotated tags also have their own tag-object SHA; the commit is what the archive preserves.

| Ref | Commit | What it is |
|---|---|---|
| `versionC67.2` | `2258330ca320878b7940e6fe22012a7fcd2d8819` | Current working branch. Expo app lives on this branch under `mobile/`. |
| `versionC67` | `2258330ca320878b7940e6fe22012a7fcd2d8819` | Frozen branch for the C67 web app. Do not move it. |
| `main` | `ced85b4cbf70fe48949b2e8fbe7b2ca213d7d4e4` | Old default. C5 web app. Not current. |
| `C67` | `2258330ca320878b7940e6fe22012a7fcd2d8819` | Annotated tag. Frozen web design reference. |
| `C5` | `ced85b4cbf70fe48949b2e8fbe7b2ca213d7d4e4` | Tag for the C5 web app. Preserved when `versionC5` was removed. |
| `archive/c67-checkpoint-0` | `7a6d835cfe05828c89dd49b4d1aee842849e1892` | Archived tag. C67 WIP before the trading calendar. |
| `archive/consumer-redesign` | `0654102b67b6532daac1bf39b3eec02befdeac74` | Archived tag. Three-tab Now / Names / Record. |
| `archive/desk` | `714cfb07744ef55b21e516a5e24e533fc1147c45` | Archived tag. Desk with no tabs. |
| `archive/pre-C5` | `eb4950545f2f277c9c42cef6129eb02bfac61b83` | Archived tag. Launch whoosh, before the C5 tape pass. |
| `archive/pre-consumer-redesign` | `d2899693ddb1e8745654f565acfd7f22874189ff` | Archived tag. Five-tab layout before the consumer cut. |
| `archive/tabs-whoosh` | `eb4950545f2f277c9c42cef6129eb02bfac61b83` | Archived tag. Same commit as pre-C5. |
| `archive/three-tabs` | `0654102b67b6532daac1bf39b3eec02befdeac74` | Archived tag. Same commit as consumer-redesign. |
