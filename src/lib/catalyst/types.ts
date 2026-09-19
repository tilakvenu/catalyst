export const SEED_VERSION = 8;

export type Direction = "up" | "down" | "flat";
export type Sentiment = "bullish" | "bearish" | "none";
export type EventKind = "earnings" | "macro" | "product";
export type Session = "bmo" | "amc" | "intraday";
export type ImpactTag = "high-vol" | "sector" | "implied-move" | "after-close";
export type ThemePref = "light" | "dark" | "system";
export type TabId = "now" | "record";
export type WatchFilter = "all" | "held" | "macro";
export type SparkRange = "1D" | "1M" | "6M" | "1Y";
export type PastFilter = "all" | "earnings" | "notes";
export type NotifyLead = "24h" | "1h" | "both";
export type MacroSeriesId = "cpi" | "fomc" | "nfp" | "ppi" | "gdp" | "ism";
export type NewsKind = "target" | "announcement" | "filing" | "coverage";
export type NewsImpact = "high" | "medium" | "low";
export type NewsFilter = "all" | "high" | "target" | "announcement" | "today";
export type JournalEntryState = "unresolvable";

export interface Ticker {
  id: string;
  symbol: string;
  company: string;
  held: boolean;
  muted: boolean;
  lastPrice: number;
  change: number;
  changePct: number;
  kind: "equity";
}

export interface MacroItem {
  id: string;
  name: string;
  shortName: string;
  series: string;
  muted: boolean;
  kind: "macro";
}

export interface CompanyProfile {
  tickerId: string;
  sector: string;
  industry: string;
  description: string;
  fetchedAt: string;
}

export interface MetricRow {
  metric: string;
  consensus: string;
  prior: string;
}

export interface EarningsPrint {
  period: string;
  actual: number | null;
  estimate: number | null;
  surprisePct: number | null;
}

export interface Recommendation {
  buy: number;
  hold: number;
  sell: number;
  period: string;
}

export interface TapeMetrics {
  tickerId: string;
  marketCap?: number;
  pe?: number;
  week52High?: number;
  week52Low?: number;
  target?: number;
  fetchedAt: string;
}

export interface MacroPrint {
  macroId: string;
  value: string;
  prior?: string;
  asOf: string;
  source: string;
}

export interface CalendarHit {
  symbol: string;
  date: string;
  hour: Session;
  epsEstimate?: number | null;
  confirmed: boolean;
}

export interface CatalystEvent {
  id: string;
  kind: EventKind;
  title: string;
  tickerId?: string;
  macroId?: string;
  startsAt: string;
  confirmed: boolean;
  session: Session;
  description: string;
  impact: ImpactTag[];
  consensus?: MetricRow[];
  consensusSource?: string;
  notify: boolean;
  /** Realized next-session move, used to auto-score a complete call. */
  printMovePct?: number;
}

export interface Headline {
  id: string;
  tickerId?: string;
  macroId?: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  summary?: string;
  kind?: NewsKind;
  impact?: NewsImpact;
  /** One-line why this would (or would not) move the name. */
  why?: string;
  scoredBy?: "heuristic" | "grok" | "fixture";
  origin?: "fixture" | "live";
  /** First time this item entered the local store. Never overwrite on refetch. */
  firstSeenAt?: string;
}

export interface JournalEntry {
  id: string;
  eventId: string;
  /** Quick-note body and/or full reasoning. Same model. */
  text: string | null;
  sentiment: Sentiment | null;
  direction: Direction | null;
  conviction: 1 | 2 | 3 | 4 | 5 | null;
  reasoning: string | null;
  invalidation: string | null;
  updatedAt: string;
  actualDirection?: Direction;
  actualMovePct?: number;
  actualMoveDate?: string;
  actualFigure?: string;
  lockedAt?: string;
  /** Ticker id the macro call is scored against. Required to lock a macro event. */
  callTarget?: string;
  /** Packed headline snapshots visible on the call sheet at lock. See evidence.ts. */
  evidenceSnapshot?: string[];
  scoringRuleVersion?: number;
  state?: JournalEntryState;
}

export interface QuoteCache {
  tickerId: string;
  lastPrice: number;
  change: number;
  changePct: number;
  fetchedAt: string;
  dayHigh?: number;
  dayLow?: number;
  dayOpen?: number;
  prevClose?: number;
}

export type Followable =
  | { type: "ticker"; id: string }
  | { type: "macro"; id: string };

export type Screen =
  | { name: "tab"; tab: TabId }
  | { name: "ticker"; id: string }
  | { name: "event"; id: string }
  | { name: "settings" }
  | { name: "news" }
  | { name: "names" }
  | { name: "simulation" };

export type Sheet =
  | { name: "journal"; eventId: string }
  | { name: "note"; eventId: string }
  | { name: "headlines"; tickerId?: string; macroId?: string }
  | { name: "article"; id: string }
  | { name: "add" }
  | { name: "csv" }
  | { name: "macro" }
  | { name: "search" };

export function isEntryComplete(e: JournalEntry): boolean {
  return (
    e.direction !== null &&
    e.conviction !== null &&
    Boolean(e.reasoning && e.reasoning.trim()) &&
    Boolean(e.invalidation && e.invalidation.trim())
  );
}

export function missingFields(e: JournalEntry): string[] {
  const missing: string[] = [];
  if (!e.direction) missing.push("direction");
  if (!e.conviction) missing.push("conviction");
  if (!e.reasoning?.trim()) missing.push("reasoning");
  if (!e.invalidation?.trim()) missing.push("invalidation");
  return missing;
}

export interface SearchHit {
  symbol: string;
  company: string;
  type: "equity" | "etf";
}

export interface AppSnapshot {
  seedVersion: number;
  demoMode: boolean;
  emptySeed: boolean;
  theme: ThemePref;
  notifyLead: NotifyLead;
  dataSource: "fixture" | "live";
  liveKeys: { finnhub: string; alphaVantage: string; newsapi: string };
  tickers: Ticker[];
  macros: MacroItem[];
  profiles: CompanyProfile[];
  events: CatalystEvent[];
  headlines: Headline[];
  entries: JournalEntry[];
  quotes: QuoteCache[];
  sparks: Record<string, Record<SparkRange, number[]>>;
  earningsHistory: Record<string, EarningsPrint[]>;
  recommendations: Record<string, Recommendation>;
  tape: Record<string, TapeMetrics>;
  macroPrints: Record<string, MacroPrint>;
  newsFetchedAt?: string;
}
