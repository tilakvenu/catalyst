// Wire contract between Cloud Code and the app (mobile/src/data imports this file).
// Every id is a Parse objectId. Dates are ISO strings. Rows are plain JSON, never Parse.Object.
import type { Direction, EventKind, MacroSeriesId, MetricRow, NewsImpact, NewsKind, Session } from "../../src/lib/catalyst/types.ts";

export type Iso = string;

export interface TickerDTO {
  id: string;
  symbol: string;
  company: string;
  kind: string;
  updatedAt: Iso;
}

export interface MacroSeriesDTO {
  id: string;
  key: MacroSeriesId;
  name: string;
  shortName: string;
  series: string;
  updatedAt: Iso;
}

export interface EventDTO {
  id: string;
  tickerId?: string;
  macroId?: string;
  kind: EventKind;
  title: string;
  startsAt: Iso;
  session: Session;
  confirmed: boolean;
  consensus: MetricRow[];
  consensusSource?: string;
  printMovePct?: number;
  typicalMovePct?: number;
  updatedAt: Iso;
}

export interface HeadlineDTO {
  id: string;
  tickerId?: string;
  macroId?: string;
  title: string;
  source: string;
  url?: string;
  publishedAt: Iso;
  firstSeenAt: Iso;
  kind?: NewsKind;
  impact?: NewsImpact;
  why?: string;
  scoredBy?: string;
  updatedAt: Iso;
}

export interface WatchItemDTO {
  id: string;
  tickerId?: string;
  macroId?: string;
  held: boolean;
  muted: boolean;
  updatedAt: Iso;
}

export interface CallOutcome {
  actualMovePct: number;
  actualDirection: Direction;
  result: "called" | "missed";
  typicalPct: number;
  resolvedAt: Iso;
}

export interface CallDTO {
  id: string;
  eventId: string;
  direction: Direction;
  conviction: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
  wrongIf: string;
  callTargetId?: string;
  lockedAt: Iso;
  evidenceIds: string[];
  scoringRuleVersion: number;
  state?: "unresolvable";
  outcome?: CallOutcome;
  updatedAt: Iso;
}

export interface BootstrapParams {
  /** serverTime from the previous bootstrap. Omit for a full sync. */
  since?: Iso;
}

export interface BootstrapResult {
  /** Use as `since` next time (server clock, not the phone's). */
  serverTime: Iso;
  full: boolean;
  tickers: TickerDTO[];
  macroSeries: MacroSeriesDTO[];
  /** Upcoming window plus every event one of the user's calls points at. */
  events: EventDTO[];
  /** Recent headlines for watched names (the desk). */
  headlines: HeadlineDTO[];
  watchItems: WatchItemDTO[];
  calls: CallDTO[];
  /** Delta sync only: every id the user still has, so the app can drop rows deleted elsewhere. */
  watchIds?: string[];
  callIds?: string[];
}

export interface CalendarParams {
  /** "YYYY-MM", New York time. */
  month: string;
}

export interface CalendarResult {
  month: string;
  events: EventDTO[];
}

export interface EvidenceParams {
  ids: string[];
}

export interface EvidenceResult {
  headlines: HeadlineDTO[];
}

export interface DeleteAccountResult {
  deleted: { callRevisions: number; calls: number; watchItems: number; sessions: number; user: number };
}

/** Window bootstrap covers, relative to server now. */
export const BOOTSTRAP_PAST_DAYS = 7;
export const BOOTSTRAP_AHEAD_DAYS = 42;
/** Desk headlines: this many days back, at most this many rows. */
export const DESK_HEADLINE_DAYS = 7;
export const DESK_HEADLINE_LIMIT = 300;
export const EVIDENCE_MAX_IDS = 200;
