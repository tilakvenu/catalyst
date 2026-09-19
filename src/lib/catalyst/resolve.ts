import { scoredVersion } from "./lock";
import { classifyMove, isUnresolvable, typicalSessionPct } from "./scoring";
import { isResolvableAt } from "./session";
import { isEntryComplete, type CatalystEvent, type JournalEntry, type SparkRange, type Ticker } from "./types";

const UNRESOLVABLE_GRACE_MS = 48 * 3600000;

export function typicalForEvent(
  event: CatalystEvent,
  sparks: Record<string, Record<SparkRange, number[]>>,
  events: CatalystEvent[],
  now: number,
  callTarget?: string,
): number | null {
  const tickerId = event.tickerId ?? callTarget;
  if (!tickerId) return null;
  const series = sparks[tickerId]?.["1M"] ?? [];
  const dates = events.filter((e) => e.tickerId === tickerId).map((e) => e.startsAt);
  return typicalSessionPct(series, dates, now);
}

export function resolvingMove(
  event: CatalystEvent,
  tickers: Ticker[],
  callTarget?: string,
): number | null {
  if (event.printMovePct != null) return event.printMovePct;
  const id = event.tickerId ?? callTarget;
  if (!id) return null;
  return tickers.find((t) => t.id === id)?.changePct ?? null;
}

export function tryResolve(args: {
  event: CatalystEvent;
  entries: JournalEntry[];
  tickers: Ticker[];
  sparks: Record<string, Record<SparkRange, number[]>>;
  events: CatalystEvent[];
  now: number;
}):
  | { action: "none" }
  | {
      action: "score";
      entryId: string;
      actualDirection: "up" | "down" | "flat";
      actualMovePct: number;
      typical: number;
      figure: string;
    }
  | { action: "unresolvable"; entryId: string; reason: string } {
  const entry = scoredVersion(args.entries, args.event);
  if (!entry || !isEntryComplete(entry) || !entry.lockedAt) return { action: "none" };
  if (entry.actualDirection != null || isUnresolvable(entry)) return { action: "none" };
  if (args.event.kind === "macro" && !entry.callTarget) {
    return { action: "unresolvable", entryId: entry.id, reason: "Macro call has no target." };
  }
  if (!isResolvableAt(args.event.startsAt, args.event.session, args.now)) return { action: "none" };

  const typical = typicalForEvent(args.event, args.sparks, args.events, args.now, entry.callTarget);
  const move = resolvingMove(args.event, args.tickers, entry.callTarget);
  if (move == null || typical == null) {
    const close = args.now - (/* already resolvable */ 0);
    void close;
    const started = new Date(args.event.startsAt).getTime();
    if (args.now - started > UNRESOLVABLE_GRACE_MS) {
      return {
        action: "unresolvable",
        entryId: entry.id,
        reason: typical == null ? "No typical session for this instrument." : "No resolving move available.",
      };
    }
    return { action: "none" };
  }

  const actualDirection = classifyMove(move, typical);
  const figure = `Observed next session ${move >= 0 ? "+" : ""}${move.toFixed(2)}% · ${actualDirection} vs typical ±${typical.toFixed(1)}% (${(move / typical).toFixed(2)}×). Catalyst scoring rule v1.`;
  return {
    action: "score",
    entryId: entry.id,
    actualDirection,
    actualMovePct: Number(move.toFixed(2)),
    typical,
    figure,
  };
}
