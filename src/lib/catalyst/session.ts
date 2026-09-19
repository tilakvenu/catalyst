import type { Session } from "./types.ts";

export type MarketPhase = "pre" | "open" | "after" | "closed";

export interface MarketClock {
  phase: MarketPhase;
  label: string;
  detail: string;
}

function nyParts(now: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** NYSE session, computed — no network. Indicative; ignores exchange holidays. */
export function marketClock(now = Date.now()): MarketClock {
  const { weekday, hour, minute } = nyParts(now);
  const mins = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  if (weekend || mins < 4 * 60 || mins >= 20 * 60) {
    return {
      phase: "closed",
      label: "Closed",
      detail: weekend ? "Opens Monday 9:30 ET" : mins >= 20 * 60 ? "Opens 9:30 ET" : "Pre-market 4:00 ET",
    };
  }
  if (mins < 9 * 60 + 30) {
    return { phase: "pre", label: "Pre-market", detail: "Regular open 9:30 ET" };
  }
  if (mins < 16 * 60) {
    const left = 16 * 60 - mins;
    const h = Math.floor(left / 60);
    const m = left % 60;
    return {
      phase: "open",
      label: "Open",
      detail: h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`,
    };
  }
  return { phase: "after", label: "After hours", detail: "Session ended 4:00 ET" };
}

function isWeekend(weekday: string) {
  return weekday === "Sat" || weekday === "Sun";
}

function etMs(year: number, month: number, day: number, hour: number, minute = 0): number {
  const guess = Date.UTC(year, month - 1, day, hour + 4, minute);
  const parts = nyParts(guess);
  const driftDays =
    Date.UTC(parts.year, parts.month - 1, parts.day) - Date.UTC(year, month - 1, day);
  const hourDrift = (parts.hour - hour) * 3600000 + (parts.minute - minute) * 60000;
  return guess - driftDays - hourDrift;
}

function addCalendarDays(year: number, month: number, day: number, n: number) {
  const d = new Date(Date.UTC(year, month - 1, day + n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function weekdayName(year: number, month: number, day: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(Date.UTC(year, month - 1, day, 16));
}

function nextWeekday(year: number, month: number, day: number, skipSame: boolean) {
  let y = year;
  let m = month;
  let d = day;
  if (skipSame) {
    const n = addCalendarDays(y, m, d, 1);
    y = n.year;
    m = n.month;
    d = n.day;
  }
  for (let i = 0; i < 8; i++) {
    const wd = weekdayName(y, m, d);
    if (!isWeekend(wd)) return { year: y, month: m, day: d };
    const n = addCalendarDays(y, m, d, 1);
    y = n.year;
    m = n.month;
    d = n.day;
  }
  return { year: y, month: m, day: d };
}

/** 16:00 ET close of the trading day that contains `fromMs`. Weekend → next weekday. */
export function sameSessionClose(fromMs: number): number {
  const p = nyParts(fromMs);
  const day = nextWeekday(p.year, p.month, p.day, false);
  return etMs(day.year, day.month, day.day, 16, 0);
}

/** 16:00 ET close of the next trading session after the one that contains `fromMs`. */
export function nextSessionClose(fromMs: number): number {
  const p = nyParts(fromMs);
  const day = nextWeekday(p.year, p.month, p.day, true);
  return etMs(day.year, day.month, day.day, 16, 0);
}

/**
 * When a locked call becomes objectively resolvable.
 * AMC → close of the NEXT session. BMO / intraday → close of the SAME session.
 */
export function resolvingCloseAt(startsAt: string, session: Session): number {
  const start = new Date(startsAt).getTime();
  if (session === "amc") return nextSessionClose(start);
  return sameSessionClose(start);
}

export function isResolvableAt(startsAt: string, session: Session, now: number): boolean {
  return now >= resolvingCloseAt(startsAt, session);
}

/** @deprecated C5 0.4% cutoff. C67 scores through classifyMove + typical session. */
export function directionFromMove(pct: number): "up" | "down" | "flat" {
  if (pct > 0.4) return "up";
  if (pct < -0.4) return "down";
  return "flat";
}
