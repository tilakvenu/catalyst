import { currentDraft, scoredVersion } from "./lock";
import { dayHeading, hoursUntil, inNextWeek, inThisWeek, startOfNyDay } from "./format";
import { classifyMove, isPending, isScored, typicalSessionPct } from "./scoring";
import { isResolvableAt } from "./session";
import {
  isEntryComplete,
  missingFields,
  type CatalystEvent,
  type Headline,
  type JournalEntry,
  type MacroItem,
  type SparkRange,
  type Ticker,
} from "./types";

export interface StoreSlice {
  tickers: Ticker[];
  macros: MacroItem[];
  events: CatalystEvent[];
  entries: JournalEntry[];
  now: number;
  sparks?: Record<string, Record<SparkRange, number[]>>;
}

export function tickerById(s: StoreSlice, id?: string) {
  return s.tickers.find((t) => t.id === id);
}

export function macroById(s: StoreSlice, id?: string) {
  return s.macros.find((m) => m.id === id);
}

export function isFollowedEvent(s: StoreSlice, e: CatalystEvent): boolean {
  if (e.tickerId) return s.tickers.some((t) => t.id === e.tickerId);
  if (e.macroId) return s.macros.some((m) => m.id === e.macroId);
  return false;
}

export function eventLabel(s: StoreSlice, e: CatalystEvent): { kicker: string; name: string } {
  if (e.tickerId) {
    const t = tickerById(s, e.tickerId);
    return { kicker: t?.symbol ?? "—", name: t?.company ?? "Unknown" };
  }
  const m = macroById(s, e.macroId);
  return { kicker: m?.shortName ?? "MACRO", name: m?.name ?? "Macro" };
}

export function kindLabel(e: CatalystEvent): string {
  if (e.kind === "earnings") return "Earnings";
  if (e.kind === "macro") return "Macro";
  return "Event";
}

export function upcomingFollowed(s: StoreSlice): CatalystEvent[] {
  return s.events
    .filter((e) => isFollowedEvent(s, e) && new Date(e.startsAt).getTime() >= s.now - 30 * 60000)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
}

export function pastFollowed(s: StoreSlice): CatalystEvent[] {
  return s.events
    .filter((e) => isFollowedEvent(s, e) && new Date(e.startsAt).getTime() < s.now - 30 * 60000)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
}

export function thisWeek(s: StoreSlice): CatalystEvent[] {
  return upcomingFollowed(s).filter((e) => inThisWeek(e.startsAt, s.now));
}

export function nextWeek(s: StoreSlice): CatalystEvent[] {
  return upcomingFollowed(s).filter((e) => inNextWeek(e.startsAt, s.now));
}

export function nearest(s: StoreSlice): CatalystEvent | undefined {
  return upcomingFollowed(s)[0];
}

export function needsCall(s: StoreSlice): CatalystEvent[] {
  return upcomingFollowed(s).filter((e) => {
    const h = hoursUntil(e.startsAt, s.now);
    if (h > 7 * 24) return false;
    const note = entryFor(s, e.id);
    return !note || !isEntryComplete(note) || !note.lockedAt;
  });
}

export function entriesFor(s: StoreSlice, eventId: string) {
  return s.entries.filter((e) => e.eventId === eventId);
}

export function entryFor(s: StoreSlice, eventId: string) {
  const event = s.events.find((e) => e.id === eventId);
  if (event) return scoredVersion(s.entries, event) ?? currentDraft(s.entries, eventId);
  return currentDraft(s.entries, eventId);
}

export function isUrgent(iso: string, now: number) {
  const h = hoursUntil(iso, now);
  return h >= -1 && h <= 48;
}

export function upcomingGrouped(
  s: StoreSlice,
): { key: string; label: string; events: CatalystEvent[] }[] {
  const list = upcomingFollowed(s);
  const map = new Map<string, CatalystEvent[]>();
  const order: string[] = [];
  for (const e of list) {
    const key = startOfNyDay(e.startsAt);
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(e);
  }
  return order.map((key) => ({
    key,
    label: dayHeading(map.get(key)![0]!.startsAt, s.now),
    events: map.get(key)!,
  }));
}

export function typicalForTicker(s: StoreSlice, tickerId?: string): number | null {
  if (!tickerId || !s.sparks) return null;
  const dates = s.events.filter((e) => e.tickerId === tickerId).map((e) => e.startsAt);
  return typicalSessionPct(s.sparks[tickerId]?.["1M"] ?? [], dates, s.now);
}

export function typicalFor(s: StoreSlice, event: CatalystEvent, callTarget?: string): number | null {
  return typicalForTicker(s, event.tickerId ?? callTarget);
}

export function followedEquityTypicals(s: StoreSlice): number[] {
  const out: number[] = [];
  for (const t of s.tickers) {
    const v = typicalForTicker(s, t.id);
    if (v != null) out.push(v);
  }
  return out;
}

export function observedMoveForHeadline(s: StoreSlice, h: Headline): number | null {
  const related = s.events.filter(
    (e) => (h.tickerId && e.tickerId === h.tickerId) || (h.macroId && e.macroId === h.macroId),
  );
  if (related.some((e) => new Date(e.startsAt).getTime() > s.now)) return null;
  for (const e of related) {
    const note = entryFor(s, e.id);
    if (note?.actualMovePct != null) return note.actualMovePct;
    if (e.printMovePct != null && s.now >= new Date(e.startsAt).getTime()) return e.printMovePct;
  }
  return null;
}

export function suggestedPrint(
  s: StoreSlice,
  event: CatalystEvent,
): { movePct: number; direction: "up" | "down" | "flat"; typical: number | null } | null {
  const entry = entryFor(s, event.id);
  if (!entry || !isEntryComplete(entry) || !entry.lockedAt) return null;
  if (entry.actualDirection != null && entry.actualMovePct != null) return null;
  if (!isResolvableAt(event.startsAt, event.session, s.now)) return null;
  const move =
    event.printMovePct ??
    (event.tickerId
      ? tickerById(s, event.tickerId)?.changePct
      : entry.callTarget
        ? tickerById(s, entry.callTarget)?.changePct
        : undefined);
  if (move == null) return null;
  const typical = typicalFor(s, event, entry.callTarget);
  const direction = typical != null ? classifyMove(move, typical) : move > 0 ? "up" : move < 0 ? "down" : "flat";
  return { movePct: move, direction, typical };
}

export function readyToScore(s: StoreSlice): CatalystEvent[] {
  return s.events.filter((e) => isFollowedEvent(s, e) && suggestedPrint(s, e));
}

export function deskReadyToScore(s: StoreSlice): CatalystEvent[] {
  return readyToScore(s).filter((e) => isResolvableAt(e.startsAt, e.session, s.now));
}

export type DeskHero =
  | { kind: "result"; event: CatalystEvent }
  | { kind: "call"; event: CatalystEvent }
  | { kind: "quiet" };

export function deskHero(s: StoreSlice): DeskHero {
  const ready = deskReadyToScore(s)[0];
  if (ready) return { kind: "result", event: ready };
  const next = needsCall(s)[0];
  if (next) return { kind: "call", event: next };
  return { kind: "quiet" };
}

export function oldestIncomplete(s: StoreSlice): JournalEntry | undefined {
  return s.entries
    .filter((e) => isPending(e, s.now) && missingFields(e).length > 0)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())[0];
}

export function pendingCount(s: StoreSlice): number {
  return s.entries.filter((e) => isPending(e, s.now)).length;
}

export function unresolvableCount(s: StoreSlice): number {
  return s.entries.filter((e) => e.state === "unresolvable").length;
}

export function inboxCount(s: StoreSlice): number {
  const readyIds = new Set(readyToScore(s).map((e) => e.id));
  return readyToScore(s).length + needsCall(s).filter((e) => !readyIds.has(e.id)).length;
}

export function recordSummary(s: StoreSlice): {
  pct: number | null;
  hits: number;
  scored: number;
  pending: number;
} {
  const scored = s.entries.filter((e) => isScored(e, s.now));
  const hits = scored.filter(
    (e) => e.direction && e.actualDirection && e.direction === e.actualDirection,
  ).length;
  return {
    pct: scored.length ? Math.round((hits / scored.length) * 100) : null,
    hits,
    scored: scored.length,
    pending: pendingCount(s),
  };
}

export function lastSimilarEvent(s: StoreSlice, event: CatalystEvent): CatalystEvent | undefined {
  return pastFollowed(s).find((e) => {
    if (e.id === event.id) return false;
    if (event.tickerId) return e.tickerId === event.tickerId;
    if (event.macroId) return e.macroId === event.macroId;
    return false;
  });
}

export function setupHeadline(headlines: Headline[], event: CatalystEvent): Headline | undefined {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return headlines
    .filter((h) =>
      event.tickerId
        ? h.tickerId === event.tickerId
        : Boolean(event.macroId && h.macroId === event.macroId),
    )
    .sort((a, b) => {
      const d = (rank[a.impact ?? "low"] ?? 2) - (rank[b.impact ?? "low"] ?? 2);
      if (d !== 0) return d;
      return +new Date(b.publishedAt) - +new Date(a.publishedAt);
    })[0];
}

export function materialChangeCount(headlines: Headline[], tickerId?: string, macroId?: string): number {
  return headlines.filter(
    (h) =>
      h.impact === "high" &&
      ((tickerId && h.tickerId === tickerId) || (macroId && h.macroId === macroId)),
  ).length;
}

export { isEntryComplete, isPending, isScored, missingFields };
