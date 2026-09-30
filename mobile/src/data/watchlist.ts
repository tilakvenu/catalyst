// Watchlist writes. Each is exactly one request; the cache is updated from the saved row, no re-sync.
import { useMemo } from "react";
import type { WatchItemDTO } from "../../../cloud/src/dto.ts";
import type { MacroItem, Ticker } from "../../../src/lib/catalyst/types.ts";
import { getCache, updateCache, upsert, useCache, without } from "./cache.ts";
import { toMacro, toTicker } from "./map.ts";
import { Parse } from "./parse.ts";

const toWatchDTO = (o: Parse.Object): WatchItemDTO => ({
  id: o.id!,
  tickerId: (o.get("ticker") as Parse.Object | undefined)?.id,
  macroId: (o.get("macro") as Parse.Object | undefined)?.id,
  held: !!o.get("held"),
  muted: !!o.get("muted"),
  updatedAt: (o.updatedAt ?? new Date()).toISOString(),
});

export type WatchTarget = { tickerId: string } | { macroId: string };

export async function addWatch(target: WatchTarget): Promise<WatchItemDTO> {
  const item = new Parse.Object("WatchItem");
  if ("tickerId" in target) item.set("ticker", Parse.Object.fromJSON({ className: "Ticker", objectId: target.tickerId, __type: "Pointer" }));
  else item.set("macro", Parse.Object.fromJSON({ className: "MacroSeries", objectId: target.macroId, __type: "Pointer" }));
  item.set("held", false);
  item.set("muted", false);
  await item.save();
  const dto = toWatchDTO(item);
  updateCache((s) => ({ ...s, watchItems: upsert(s.watchItems, [dto]) }));
  return dto;
}

export async function removeWatch(watchItemId: string): Promise<void> {
  const prev = getCache().watchItems[watchItemId];
  updateCache((s) => ({ ...s, watchItems: without(s.watchItems, [watchItemId]) }));
  try {
    await Parse.Object.fromJSON({ className: "WatchItem", objectId: watchItemId }).destroy();
  } catch (e) {
    if (prev) updateCache((s) => ({ ...s, watchItems: upsert(s.watchItems, [prev]) }));
    throw e;
  }
}

async function patchWatch(watchItemId: string, field: "held" | "muted", value: boolean) {
  const prev = getCache().watchItems[watchItemId];
  if (!prev) throw new Error("That watch item is not on this device. Pull to refresh.");
  updateCache((s) => ({ ...s, watchItems: upsert(s.watchItems, [{ ...prev, [field]: value }]) }));
  try {
    const o = Parse.Object.fromJSON({ className: "WatchItem", objectId: watchItemId });
    o.set(field, value);
    await o.save();
    updateCache((s) => ({ ...s, watchItems: upsert(s.watchItems, [{ ...prev, [field]: value, updatedAt: (o.updatedAt ?? new Date()).toISOString() }]) }));
  } catch (e) {
    updateCache((s) => ({ ...s, watchItems: upsert(s.watchItems, [prev]) }));
    throw e;
  }
}

/** Per-user: held/muted live on WatchItem, not on the shared Ticker. */
export const setHeld = (watchItemId: string, held: boolean) => patchWatch(watchItemId, "held", held);
export const setMuted = (watchItemId: string, muted: boolean) => patchWatch(watchItemId, "muted", muted);

export interface Watchlist {
  /** Watched tickers with this user's held/muted. */
  tickers: (Ticker & { watchItemId: string })[];
  macros: (MacroItem & { watchItemId: string })[];
  /** Everything that can be added (seeded reference data). */
  universe: { tickers: Ticker[]; macros: MacroItem[] };
}

/** Cache only. Zero requests. */
export function useWatchlist(): Watchlist {
  const s = useCache();
  return useMemo(() => {
    const tickers: Watchlist["tickers"] = [];
    const macros: Watchlist["macros"] = [];
    for (const w of Object.values(s.watchItems)) {
      if (w.tickerId && s.tickers[w.tickerId]) tickers.push({ ...toTicker(s.tickers[w.tickerId], w), watchItemId: w.id });
      if (w.macroId && s.macroSeries[w.macroId]) macros.push({ ...toMacro(s.macroSeries[w.macroId], w), watchItemId: w.id });
    }
    tickers.sort((a, b) => a.symbol.localeCompare(b.symbol));
    macros.sort((a, b) => a.shortName.localeCompare(b.shortName));
    return {
      tickers,
      macros,
      universe: {
        tickers: Object.values(s.tickers).map((t) => toTicker(t)).sort((a, b) => a.symbol.localeCompare(b.symbol)),
        macros: Object.values(s.macroSeries).map((m) => toMacro(m)).sort((a, b) => a.shortName.localeCompare(b.shortName)),
      },
    };
  }, [s.watchItems, s.tickers, s.macroSeries]);
}
