// When the app talks to the server, and only then:
//   - app open (once per launch, after the local session and cache are loaded)
//   - returning to the foreground after FOREGROUND_RESYNC_MS or more since the last sync
//   - after a write (the write itself; see watchlist.ts and calls.ts)
//   - pull-to-refresh (refresh())
// Never on tab switch, screen focus, or a timer.
import { AppState, type AppStateStatus } from "react-native";
import type { BootstrapResult } from "../../../cloud/src/dto.ts";
import { getCache, keepOnly, updateCache, upsert, type SyncReason } from "./cache.ts";
import { Parse } from "./parse.ts";

export const FOREGROUND_RESYNC_MS = 15 * 60 * 1000;

type SyncStatus = { syncing: boolean; error: string | null };
let status: SyncStatus = { syncing: false, error: null };
const statusListeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  status = s;
  statusListeners.forEach((fn) => fn());
};
export const getSyncStatus = () => status;
export function subscribeSyncStatus(fn: () => void) {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

let inflight: Promise<void> | null = null;

/** One bootstrap request: full the first time, then a delta since the last server cursor. */
export function bootstrap(reason: SyncReason): Promise<void> {
  if (!getCache().userId) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    setStatus({ syncing: true, error: null });
    try {
      const since = getCache().cursor;
      const res = (await Parse.Cloud.run("bootstrap", since ? { since } : {})) as BootstrapResult;
      applyBootstrap(res, reason);
      setStatus({ syncing: false, error: null });
    } catch (e) {
      setStatus({ syncing: false, error: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function applyBootstrap(res: BootstrapResult, reason: SyncReason) {
  updateCache((s) => {
    const watchItems = res.full ? upsert({}, res.watchItems) : upsert(s.watchItems, res.watchItems);
    const calls = res.full ? upsert({}, res.calls) : upsert(s.calls, res.calls);
    return {
      ...s,
      cursor: res.serverTime,
      lastSyncAt: Date.now(),
      lastSyncReason: reason,
      tickers: res.full ? upsert({}, res.tickers) : upsert(s.tickers, res.tickers),
      macroSeries: res.full ? upsert({}, res.macroSeries) : upsert(s.macroSeries, res.macroSeries),
      events: upsert(s.events, res.events),
      headlines: upsert(s.headlines, res.headlines),
      // A delta cannot show deletions, so it carries every id the user still has.
      watchItems: res.watchIds ? keepOnly(watchItems, res.watchIds) : watchItems,
      calls: res.callIds ? keepOnly(calls, res.callIds) : calls,
    };
  });
}

/** Pull-to-refresh. */
export const refresh = () => bootstrap("pull");

let appState: AppStateStatus = AppState.currentState;
let policyStarted = false;

/** Called once, after the session and cache are loaded. Syncs for "app open" and watches the foreground. */
export function startSyncPolicy() {
  if (policyStarted) return;
  policyStarted = true;
  if (getCache().userId) bootstrap("open").catch(() => {});
  AppState.addEventListener("change", (next) => {
    const cameBack = appState !== "active" && next === "active";
    appState = next;
    if (!cameBack) return;
    const last = getCache().lastSyncAt ?? 0;
    if (Date.now() - last >= FOREGROUND_RESYNC_MS) bootstrap("foreground").catch(() => {});
  });
}
