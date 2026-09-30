// Server rows (cloud/src/dto.ts) -> the shared C67 types the screens already use.
// ids are Parse objectIds, so C67's tickerId / macroId / eventId hold objectIds.
import type { CallDTO, EventDTO, HeadlineDTO, MacroSeriesDTO, TickerDTO, WatchItemDTO } from "../../../cloud/src/dto.ts";
import type { CatalystEvent, Headline, JournalEntry, MacroItem, Ticker } from "../../../src/lib/catalyst/types.ts";
import type { Draft } from "./cache.ts";

/** No quotes on the server yet (live data is deferred), so price fields are 0. */
export const toTicker = (t: TickerDTO, w?: WatchItemDTO): Ticker => ({
  id: t.id,
  symbol: t.symbol,
  company: t.company,
  held: w?.held ?? false,
  muted: w?.muted ?? false,
  lastPrice: 0,
  change: 0,
  changePct: 0,
  kind: "equity",
});

export const toMacro = (m: MacroSeriesDTO, w?: WatchItemDTO): MacroItem => ({
  id: m.id,
  name: m.name,
  shortName: m.shortName,
  series: m.series,
  muted: w?.muted ?? false,
  kind: "macro",
});

export const toEvent = (e: EventDTO): CatalystEvent => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  tickerId: e.tickerId,
  macroId: e.macroId,
  startsAt: e.startsAt,
  confirmed: e.confirmed,
  session: e.session,
  description: "",
  impact: [],
  consensus: e.consensus,
  consensusSource: e.consensusSource,
  notify: false,
  printMovePct: e.printMovePct,
});

export const toHeadline = (h: HeadlineDTO): Headline => ({
  id: h.id,
  tickerId: h.tickerId,
  macroId: h.macroId,
  title: h.title,
  source: h.source,
  publishedAt: h.publishedAt,
  url: h.url,
  kind: h.kind,
  impact: h.impact,
  why: h.why,
  scoredBy: h.scoredBy === "grok" || h.scoredBy === "heuristic" || h.scoredBy === "fixture" ? h.scoredBy : undefined,
  origin: "live",
  firstSeenAt: h.firstSeenAt,
});

/**
 * A locked call as a C67 JournalEntry. evidenceSnapshot carries the headline ids only (the server stores
 * ids); C67 unpackEvidence reads an id-only row as { id, title: id }. Use getEvidence for titles.
 */
export const toEntry = (c: CallDTO): JournalEntry => ({
  id: c.id,
  eventId: c.eventId,
  text: c.reasoning,
  sentiment: null,
  direction: c.direction,
  conviction: c.conviction,
  reasoning: c.reasoning,
  invalidation: c.wrongIf,
  updatedAt: c.updatedAt,
  lockedAt: c.lockedAt,
  callTarget: c.callTargetId,
  evidenceSnapshot: c.evidenceIds,
  scoringRuleVersion: c.scoringRuleVersion,
  state: c.state,
  actualDirection: c.outcome?.actualDirection,
  actualMovePct: c.outcome?.actualMovePct,
  actualMoveDate: c.outcome?.resolvedAt,
});

/** A local draft as an unlocked C67 JournalEntry (no lockedAt). */
export const draftToEntry = (d: Draft): JournalEntry => ({
  id: `draft:${d.eventId}`,
  eventId: d.eventId,
  text: d.reasoning,
  sentiment: null,
  direction: d.direction,
  conviction: d.conviction,
  reasoning: d.reasoning,
  invalidation: d.wrongIf,
  updatedAt: d.updatedAt,
  callTarget: d.callTargetId,
});
