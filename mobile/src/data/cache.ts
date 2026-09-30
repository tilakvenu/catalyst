// The local cache every screen reads from. In memory for rendering, persisted to AsyncStorage per user.
// Reading the cache never touches the network.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { CallDTO, EventDTO, HeadlineDTO, MacroSeriesDTO, TickerDTO, WatchItemDTO } from "../../../cloud/src/dto.ts";
import type { Direction } from "../../../src/lib/catalyst/types.ts";

/** A call being written on this phone. Local only; lockCall sends it. */
export interface Draft {
  eventId: string;
  direction: Direction | null;
  conviction: 1 | 2 | 3 | 4 | 5 | null;
  reasoning: string | null;
  wrongIf: string | null;
  callTargetId?: string;
  updatedAt: string;
}

export type SyncReason = "open" | "foreground" | "pull" | "sign-in";

export interface CacheState {
  version: 1;
  userId: string | null;
  /** serverTime of the last bootstrap: the `since` for the next one. */
  cursor?: string;
  /** Phone clock at the last successful bootstrap, for the 15-minute foreground rule. */
  lastSyncAt?: number;
  lastSyncReason?: SyncReason;
  tickers: Record<string, TickerDTO>;
  macroSeries: Record<string, MacroSeriesDTO>;
  events: Record<string, EventDTO>;
  headlines: Record<string, HeadlineDTO>;
  watchItems: Record<string, WatchItemDTO>;
  calls: Record<string, CallDTO>;
  /** "YYYY-MM" months fetched with getCalendar (outside the bootstrap window). */
  calendarMonths: Record<string, string>;
  drafts: Record<string, Draft>;
}

export const emptyCache = (userId: string | null = null): CacheState => ({
  version: 1,
  userId,
  tickers: {},
  macroSeries: {},
  events: {},
  headlines: {},
  watchItems: {},
  calls: {},
  calendarMonths: {},
  drafts: {},
});

const storageKey = (userId: string) => `catalyst.cache.v1:${userId}`;

let state: CacheState = emptyCache();
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const getCache = () => state;

export function subscribeCache(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Replace state immutably, notify, and persist shortly after. */
export function updateCache(fn: (s: CacheState) => CacheState) {
  state = fn(state);
  listeners.forEach((l) => l());
  if (state.userId) schedulePersist();
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (!state.userId) return;
    AsyncStorage.setItem(storageKey(state.userId), JSON.stringify(state)).catch(() => {
      // Storage full or unavailable: the in-memory cache still works for this session.
    });
  }, 250);
}

export async function loadCache(userId: string) {
  let next = emptyCache(userId);
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as CacheState;
      if (parsed.version === 1 && parsed.userId === userId) next = { ...emptyCache(userId), ...parsed };
    }
  } catch {
    // Corrupt or unreadable cache: start empty; the next bootstrap refills it.
  }
  state = next;
  listeners.forEach((l) => l());
}

/** Sign-out / account deletion: forget this user's cache on this device. */
export async function clearCache() {
  const userId = state.userId;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  state = emptyCache();
  listeners.forEach((l) => l());
  if (userId) await AsyncStorage.removeItem(storageKey(userId)).catch(() => {});
}

/** Whole-cache subscription. Derive with useMemo on the returned state. */
export function useCache(): CacheState {
  return useSyncExternalStore(subscribeCache, getCache, getCache);
}

export const upsert = <T extends { id: string }>(table: Record<string, T>, rows: T[]) => {
  if (!rows.length) return table;
  const next = { ...table };
  for (const r of rows) next[r.id] = r;
  return next;
};

export const without = <T,>(table: Record<string, T>, ids: string[]) => {
  const next = { ...table };
  for (const id of ids) delete next[id];
  return next;
};

export const keepOnly = <T,>(table: Record<string, T>, ids: string[]) => {
  const keep = new Set(ids);
  return Object.fromEntries(Object.entries(table).filter(([id]) => keep.has(id)));
};
