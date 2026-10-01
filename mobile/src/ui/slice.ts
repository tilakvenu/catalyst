// Screens' view of the data layer: the cache (read-only, zero requests) shaped as the C67 StoreSlice so the
// web app's selectors (src/lib/catalyst/selectors.ts) run unchanged. Writes still go through src/data.
import { useEffect, useMemo, useState } from "react";
import type { StoreSlice } from "../../../src/lib/catalyst/selectors.ts";
import type { CatalystEvent, Headline, MacroItem, Ticker } from "../../../src/lib/catalyst/types.ts";
import { useCache } from "../data/cache";
import { draftToEntry, toEntry, toEvent, toHeadline, toMacro, toTicker } from "../data/map";

export interface Slice extends StoreSlice {
  /** Watched tickers / macros (C67 "followed") with per-user held & muted. */
  tickers: (Ticker & { watchItemId: string })[];
  macros: (MacroItem & { watchItemId: string })[];
  headlines: Headline[];
  /** Every ticker / macro the server knows (labels, search, call targets). */
  allTickers: Record<string, Ticker>;
  allMacros: Record<string, MacroItem & { key: string }>;
  eventById: Record<string, CatalystEvent>;
  /** Locked call id per event id (server rows). */
  callIdByEvent: Record<string, string>;
  hasDraft: Record<string, boolean>;
}

/** Re-render clock for countdowns. A UI timer only; it never fetches. */
export function useNow(intervalMs = 30000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useSlice(): Slice {
  const s = useCache();
  const now = useNow();
  const base = useMemo(() => {
    const watchByName = new Map(Object.values(s.watchItems).map((w) => [w.tickerId ?? w.macroId ?? "", w]));
    const allTickers = Object.fromEntries(Object.values(s.tickers).map((t) => [t.id, toTicker(t, watchByName.get(t.id))]));
    const allMacros = Object.fromEntries(
      Object.values(s.macroSeries).map((m) => [m.id, { ...toMacro(m, watchByName.get(m.id)), key: m.key as string }]),
    );
    const tickers = Object.values(s.watchItems)
      .filter((w) => w.tickerId && allTickers[w.tickerId])
      .map((w) => ({ ...allTickers[w.tickerId!], watchItemId: w.id }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    const macros = Object.values(s.watchItems)
      .filter((w) => w.macroId && allMacros[w.macroId])
      .map((w) => ({ ...allMacros[w.macroId!], watchItemId: w.id }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName));
    const events = Object.values(s.events).map(toEvent);
    const calls = Object.values(s.calls);
    const entries = [...calls.map(toEntry), ...Object.values(s.drafts).map(draftToEntry)];
    return {
      tickers,
      macros,
      events,
      entries,
      headlines: Object.values(s.headlines).map(toHeadline),
      allTickers,
      allMacros,
      eventById: Object.fromEntries(events.map((e) => [e.id, e])),
      callIdByEvent: Object.fromEntries(calls.map((c) => [c.eventId, c.id])),
      hasDraft: Object.fromEntries(Object.keys(s.drafts).map((k) => [k, true])),
    };
  }, [s.watchItems, s.tickers, s.macroSeries, s.events, s.calls, s.drafts, s.headlines]);
  return useMemo(() => ({ ...base, now }), [base, now]);
}

/** Kicker for any event, followed or not (C67 eventLabel only knows followed names). */
export function labelOf(s: Slice, e: CatalystEvent): { kicker: string; name: string } {
  if (e.tickerId) {
    const t = s.allTickers[e.tickerId];
    return { kicker: t?.symbol ?? "—", name: t?.company ?? "Unknown" };
  }
  const m = e.macroId ? s.allMacros[e.macroId] : undefined;
  return { kicker: m?.shortName ?? "MACRO", name: m?.name ?? "Macro" };
}

/** Macro call targets: followed tickers plus SPY and QQQ (C67 MACRO_TARGET_FALLBACKS), by server id. */
export function macroTargets(s: Slice): Ticker[] {
  const out = new Map(s.tickers.map((t) => [t.id, t as Ticker]));
  for (const t of Object.values(s.allTickers)) if (t.symbol === "SPY" || t.symbol === "QQQ") out.set(t.id, t);
  return [...out.values()];
}
