// Read hooks. All read the local cache. Only useCalendar may make a request, and only when the user
// pages to a month the last bootstrap did not cover. Nothing here fetches on focus or on a timer.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BOOTSTRAP_AHEAD_DAYS,
  BOOTSTRAP_PAST_DAYS,
  EVIDENCE_MAX_IDS,
  type CallDTO,
  type CalendarResult,
  type EvidenceResult,
  type HeadlineDTO,
} from "../../../cloud/src/dto.ts";
import { etMs } from "../../../src/lib/catalyst/calendar.ts";
import {
  calibrationCopy,
  capturedMove,
  convictionBands,
  isPending,
  isScored,
  isUnresolvable,
  rollingAccuracy,
} from "../../../src/lib/catalyst/scoring.ts";
import type { CatalystEvent, Headline, JournalEntry } from "../../../src/lib/catalyst/types.ts";
import { getCache, updateCache, upsert, useCache } from "./cache.ts";
import { draftToEntry, toEntry, toEvent, toHeadline } from "./map.ts";
import { getRequestCount, Parse, subscribeRequestCount } from "./parse.ts";
import { getSyncStatus, subscribeSyncStatus } from "./sync.ts";

const DAY = 86400000;
const DESK_DAYS_AHEAD = 14;

// ---------- desk ----------

export interface Desk {
  /** Next DESK_DAYS_AHEAD days of events for watched, unmuted names, soonest first. */
  upcoming: CatalystEvent[];
  /** Headlines for watched, unmuted names, newest first. */
  headlines: Headline[];
  /** Locked call per event id. */
  callsByEvent: Record<string, JournalEntry>;
  /** Local draft per event id. */
  draftsByEvent: Record<string, JournalEntry>;
}

export function useDesk(now = Date.now()): Desk {
  const s = useCache();
  const hour = Math.floor(now / 3600000); // recompute at most hourly; renders are cheap
  return useMemo(() => {
    const t = hour * 3600000;
    const watched = Object.values(s.watchItems).filter((w) => !w.muted);
    const names = new Set(watched.flatMap((w) => [w.tickerId, w.macroId].filter(Boolean) as string[]));
    const upcoming = Object.values(s.events)
      .filter((e) => names.has(e.tickerId ?? e.macroId ?? ""))
      .filter((e) => {
        const at = Date.parse(e.startsAt);
        return at >= t - DAY && at <= t + DESK_DAYS_AHEAD * DAY;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(toEvent);
    const headlines = Object.values(s.headlines)
      .filter((h) => names.has(h.tickerId ?? h.macroId ?? ""))
      .sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))
      .map(toHeadline);
    const callsByEvent = Object.fromEntries(Object.values(s.calls).map((c) => [c.eventId, toEntry(c)]));
    const draftsByEvent = Object.fromEntries(Object.values(s.drafts).map((d) => [d.eventId, draftToEntry(d)]));
    return { upcoming, headlines, callsByEvent, draftsByEvent };
  }, [s.events, s.headlines, s.watchItems, s.calls, s.drafts, hour]);
}

// ---------- calendar ----------

function monthBounds(month: string): [number, number] | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return [etMs(y, mo, 1, 0, 0), mo === 12 ? etMs(y + 1, 1, 1, 0, 0) : etMs(y, mo + 1, 1, 0, 0)];
}

/** Does the last bootstrap's event window cover this whole month? */
function coveredByBootstrap(month: string, cursor?: string): boolean {
  const b = monthBounds(month);
  if (!b || !cursor) return false;
  const at = Date.parse(cursor);
  return b[0] >= at - BOOTSTRAP_PAST_DAYS * DAY && b[1] <= at + BOOTSTRAP_AHEAD_DAYS * DAY;
}

export type CalendarView = { month: string; events: CatalystEvent[]; status: "ready" | "loading" | "error"; error?: string };

const monthRequests = new Map<string, Promise<void>>();

/** "YYYY-MM" (New York). From cache when covered; otherwise one getCalendar request for that month. */
export function useCalendar(month: string): CalendarView {
  const s = useCache();
  const needsFetch = !coveredByBootstrap(month, s.cursor) && !s.calendarMonths[month];
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!needsFetch || !s.userId || !monthBounds(month)) return;
    setError(undefined);
    let p = monthRequests.get(month);
    if (!p) {
      p = (Parse.Cloud.run("getCalendar", { month }) as Promise<CalendarResult>).then((res) => {
        updateCache((st) => ({ ...st, events: upsert(st.events, res.events), calendarMonths: { ...st.calendarMonths, [month]: new Date().toISOString() } }));
      });
      monthRequests.set(month, p);
      p.catch(() => monthRequests.delete(month));
    }
    p.catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [month, needsFetch, s.userId]);

  return useMemo(() => {
    const b = monthBounds(month);
    const events = b
      ? Object.values(s.events)
          .filter((e) => {
            const at = Date.parse(e.startsAt);
            return at >= b[0] && at < b[1];
          })
          .sort((a, c) => a.startsAt.localeCompare(c.startsAt))
          .map(toEvent)
      : [];
    const status: CalendarView["status"] = error ? "error" : needsFetch ? "loading" : "ready";
    return { month, events, status, error };
  }, [s.events, month, needsFetch, error]);
}

// ---------- record ----------

export interface RecordStats {
  entries: JournalEntry[];
  scored: JournalEntry[];
  pending: JournalEntry[];
  unresolvable: JournalEntry[];
  accuracy: { n: number; hits: number; pct: number | null };
  rolling: ReturnType<typeof rollingAccuracy>;
  bands: ReturnType<typeof convictionBands>;
  captured: ReturnType<typeof capturedMove>;
  calibration: ReturnType<typeof calibrationCopy>;
}

/** Record stats from calls with C67 scoring.ts. Pure: no requests, nothing stored server-side. */
export function computeRecord(calls: CallDTO[], now: number): RecordStats {
  const entries = calls.map(toEntry);
  const scored = entries.filter((e) => isScored(e, now));
  const hits = scored.filter((e) => e.direction === e.actualDirection).length;
  const bands = convictionBands(scored);
  return {
    entries,
    scored,
    pending: entries.filter((e) => isPending(e, now)),
    unresolvable: entries.filter(isUnresolvable),
    accuracy: { n: scored.length, hits, pct: scored.length ? Math.round((hits / scored.length) * 100) : null },
    rolling: rollingAccuracy(scored),
    bands,
    captured: capturedMove(scored),
    calibration: calibrationCopy(bands, scored.length),
  };
}

/** Cached calls scored with C67 scoring.ts. Zero requests. */
export function useRecord(now = Date.now()): RecordStats {
  const s = useCache();
  const hour = Math.floor(now / 3600000);
  return useMemo(() => computeRecord(Object.values(s.calls), hour * 3600000), [s.calls, hour]);
}

// ---------- evidence ----------

/** Headline details for an evidence panel. Uses the cache; requests only ids it does not have. */
export async function getEvidence(ids: string[]): Promise<Headline[]> {
  const have = getCache().headlines;
  const missing = ids.filter((id) => !have[id]).slice(0, EVIDENCE_MAX_IDS);
  if (missing.length) {
    const res = (await Parse.Cloud.run("getEvidence", { ids: missing })) as EvidenceResult;
    updateCache((s) => ({ ...s, headlines: upsert(s.headlines, res.headlines) }));
  }
  const all = getCache().headlines;
  return ids.map((id) => all[id]).filter((h): h is HeadlineDTO => !!h).map(toHeadline);
}

// ---------- sync status + request counter (debug screen) ----------

export function useSyncState() {
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
  const requestCount = useSyncExternalStore(subscribeRequestCount, getRequestCount, getRequestCount);
  const s = useCache();
  return {
    ...sync,
    requestCount,
    lastSyncAt: s.lastSyncAt ?? null,
    lastSyncReason: s.lastSyncReason ?? null,
    cursor: s.cursor ?? null,
    counts: {
      watchItems: Object.keys(s.watchItems).length,
      calls: Object.keys(s.calls).length,
      drafts: Object.keys(s.drafts).length,
      events: Object.keys(s.events).length,
      headlines: Object.keys(s.headlines).length,
    },
  };
}
