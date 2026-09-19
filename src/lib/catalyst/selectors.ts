import { dayHeading, hoursUntil, inNextWeek, inThisWeek, startOfNyDay } from "./format";
import { isPending, isScored } from "./scoring";
import { isEntryComplete, missingFields, type CatalystEvent, type JournalEntry, type MacroItem, type Ticker } from "./types";

export interface StoreSlice {
  tickers: Ticker[];
  macros: MacroItem[];
  events: CatalystEvent[];
  entries: JournalEntry[];
  now: number;
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

/** Upcoming prints in the next week that still need a complete call. */
export function needsCall(s: StoreSlice): CatalystEvent[] {
  return upcomingFollowed(s).filter((e) => {
    const h = hoursUntil(e.startsAt, s.now);
    if (h > 7 * 24) return false;
    const note = entryFor(s, e.id);
    return !note || !isEntryComplete(note);
  });
}

export function entryFor(s: StoreSlice, eventId: string) {
  return s.entries.find((e) => e.eventId === eventId);
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

export function suggestedPrint(
  s: StoreSlice,
  event: CatalystEvent,
): { movePct: number; direction: "up" | "down" | "flat" } | null {
  const entry = entryFor(s, event.id);
  if (!entry || !isEntryComplete(entry)) return null;
  if (entry.actualDirection != null && entry.actualMovePct != null) return null;
  if (new Date(event.startsAt).getTime() > s.now - 16 * 3600000) return null;
  const move =
    event.printMovePct ??
    (event.tickerId ? tickerById(s, event.tickerId)?.changePct : undefined);
  if (move == null) return null;
  const direction = move > 0.4 ? "up" : move < -0.4 ? "down" : "flat";
  return { movePct: move, direction };
}

export function readyToScore(s: StoreSlice): CatalystEvent[] {
  return s.events.filter((e) => isFollowedEvent(s, e) && suggestedPrint(s, e));
}

/** Prints that belong on the desk — last two sessions, not last week's leftovers. */
export function deskReadyToScore(s: StoreSlice): CatalystEvent[] {
  return readyToScore(s).filter((e) => s.now - new Date(e.startsAt).getTime() <= 48 * 3600000);
}

export function pendingCount(s: StoreSlice): number {
  return s.entries.filter((e) => isPending(e, s.now)).length;
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

export { isEntryComplete, isPending, isScored, missingFields };
