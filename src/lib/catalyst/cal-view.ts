import { isTradingDay, nyDateKey, nyParts } from "./calendar.ts";
import { isEntryComplete, type CatalystEvent, type JournalEntry } from "./types.ts";

export type DateDotState = "needs-call" | "handled" | "called" | "missed" | "pending";

/** Five exhaustive states for a calendar dot. */
export function dateDotState(args: {
  event: CatalystEvent;
  entry?: JournalEntry;
  now: number;
}): DateDotState {
  const { event, entry, now } = args;
  const started = now >= new Date(event.startsAt).getTime();
  const complete = Boolean(entry && isEntryComplete(entry));
  const locked = Boolean(entry?.lockedAt);
  const unres = entry?.state === "unresolvable";
  const scored =
    complete &&
    locked &&
    !unres &&
    entry?.actualDirection != null &&
    entry.actualMovePct != null;

  if (scored) {
    return entry!.direction === entry!.actualDirection ? "called" : "missed";
  }
  if (started) return "pending";
  if (locked && complete) return "handled";
  return "needs-call";
}

export const DOT_COLOR: Record<DateDotState, string> = {
  "needs-call": "var(--color-accent)",
  handled: "var(--fg-muted)",
  called: "var(--color-positive)",
  missed: "var(--color-negative)",
  pending: "var(--color-warn)",
};

export const HEAT_ALPHA = [0, 0.05, 0.1, 0.16, 0.22] as const;

export function heatAlpha(count: number, trading: boolean): number {
  if (!trading || count <= 0) return 0;
  if (count === 1) return HEAT_ALPHA[1];
  if (count === 2) return HEAT_ALPHA[2];
  if (count === 3) return HEAT_ALPHA[3];
  return HEAT_ALPHA[4];
}

export function eventsOnDay(events: CatalystEvent[], dayMs: number): CatalystEvent[] {
  const key = nyDateKey(dayMs);
  return events.filter((e) => nyDateKey(new Date(e.startsAt).getTime()) === key);
}

export function monthGrid(year: number, month: number): { ms: number; inMonth: boolean }[] {
  const first = new Date(Date.UTC(year, month - 1, 1, 16, 0, 0));
  const startWeekday = first.getUTCDay();
  const cells: { ms: number; inMonth: boolean }[] = [];
  const start = new Date(Date.UTC(year, month - 1, 1 - startWeekday, 16, 0, 0));
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const noonGuess = Date.UTC(y, m - 1, day, 16);
    cells.push({
      ms: noonGuess,
      inMonth: y === year && m === month,
    });
  }
  return cells;
}

export function weekStrip(selectedMs: number): number[] {
  const p = nyParts(selectedMs);
  const utc = Date.UTC(p.year, p.month - 1, p.day, 16);
  const wd = new Date(utc).getUTCDay();
  const start = utc - wd * 86400000;
  return Array.from({ length: 7 }, (_, i) => start + i * 86400000);
}

export function sessionCode(session: CatalystEvent["session"]): string {
  if (session === "bmo") return "BMO";
  if (session === "amc") return "AMC";
  return "Intraday";
}

export function callStateLabel(args: {
  event: CatalystEvent;
  entry?: JournalEntry;
  now: number;
}): string {
  const dot = dateDotState(args);
  const { entry } = args;
  if (dot === "needs-call") return "Needs a call";
  if (dot === "handled") {
    const dir = entry?.direction === "up" ? "Up" : entry?.direction === "down" ? "Down" : entry?.direction === "flat" ? "Flat" : "";
    const conv = entry?.conviction;
    if (dir && conv) return `Locked · ${dir} · ${conv}`;
    if (dir) return `Locked · ${dir}`;
    return "Locked";
  }
  const pct = entry?.actualMovePct;
  const move = pct == null ? "" : ` ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  if (dot === "called") return `Called it${move}`;
  if (dot === "missed") return `Missed${move}`;
  return "Pending";
}

export { isTradingDay, nyDateKey, nyParts };
