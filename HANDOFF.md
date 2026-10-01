# Catalyst handoff

Read this first, then PROGRESS.md, DEFERRED.md, CLAUDE.md, and git log.

## Repo
- github.com/tilakvenu/catalyst (public)
- Active branch: c67.3-backend. Default branch: versionC67.2.
- Tags: C5, C67, archive/*.
- Source of truth: PROGRESS.md, DEFERRED.md, CLAUDE.md, this file.

## What Catalyst is
An iPhone app (Expo SDK 57, Expo Router, Reanimated) for a web app
development class. Users log a call before an earnings or macro event
(direction, conviction 1-5, why, wrong-if). The server locks it, then
scores it after the event. Record shows calibration by conviction band.

## Built so far
- mobile/: Expo app, launch animation, all C67 screens ported (Phase 7).
- cloud/: Back4App backend (Parse Server 7.5.2, Cloud Code Node 19.9).
  8 classes, owner-only permissions. The server is the referee: it
  stamps lockedAt, blocks edits after event start, writes CallRevision,
  and only it writes outcomes. Functions: bootstrap, getCalendar,
  getEvidence, deleteAccount. One daily job "tick" scheduled 22:30 UTC.
  Deployed with cloud/deploy.ts using App ID \+ Master Key only. No MCP,
  no account key.
- Tests: cheat 13/13, privacy 8/8, smoke 13/13, app-layer 15/15,
  vitest 53/53.
- Budget: about 5 requests per session, about 5,000 sessions/month on
  the free plan.
- Demo account demo@catalyst.example seeded with 20 scored calls.

## Rules
- One Back4App account, one app named catalyst.
- Keys never go in chat. They live in gitignored mobile/.env and
  cloud/.env. The master key never goes in the app.
- Claude Code does all building, one session per phase. A separate
  Claude chat reviews and writes the prompts.

## Goal
The app must look and work like a published App Store app running in
Expo Go (professor's requirement). Not a demo. App Store submission
itself is out of scope.

## Current step
Phase 8: hide dev tools, live data from a free vendor inside the tick
job, automatic scoring, ticker search, password reset and email
verification, new-user experience, icon/splash/disclaimer, remove
"(demo)" from visible titles.

## Working rules
- SHORT REVIEW LOOPS. Every phase, and every prompt written for Claude
  Code, must end with a SHORT REPORT in this exact format, no longer
  than about 30 lines:
    1\. Done: what changed, with commit hashes
    2\. Tests: pass counts
    3\. Not done or partial, and why
    4\. Decisions needed from Tilak
    5\. Phone check: what to tap and what should appear
    6\. Next step
  Tilak sends the reviewer chat only this report, not full transcripts.
- Update this file at the end of every phase: "Built so far" and
  "Current step" must always be current.

## Tilak's preferences
Plain language, define technical terms, direct critique, no em dashes,
state the date first, end with five suggestions.
