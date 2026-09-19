import type { Session } from "./types.ts";

/**
 * NYSE full-day closures, 2024–2028, including weekday observations.
 * Hardcoded — no vendor. Early closes are ignored (still a trading day).
 */
export const US_MARKET_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2024
  "2024-01-01",
  "2024-01-15",
  "2024-02-19",
  "2024-03-29",
  "2024-05-27",
  "2024-06-19",
  "2024-07-04",
  "2024-09-02",
  "2024-11-28",
  "2024-12-25",
  // 2025
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  // 2026
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  // 2027
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
  // 2028
  "2027-12-31",
  "2028-01-17",
  "2028-02-21",
  "2028-04-14",
  "2028-05-29",
  "2028-06-19",
  "2028-07-04",
  "2028-09-04",
  "2028-11-23",
  "2028-12-25",
]);

export function nyParts(now: number) {
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

export function nyDateKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** ET wall-clock → epoch. Handles EST/EDT by correcting the UTC guess. */
export function etMs(year: number, month: number, day: number, hour: number, minute = 0): number {
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

export function isTradingDay(ms: number): boolean {
  const p = nyParts(ms);
  if (p.weekday === "Sat" || p.weekday === "Sun") return false;
  return !US_MARKET_HOLIDAYS.has(nyDateKey(ms));
}

export function nextTradingYmd(
  year: number,
  month: number,
  day: number,
  skipSame: boolean,
): { year: number; month: number; day: number } {
  let y = year;
  let m = month;
  let d = day;
  if (skipSame) {
    const n = addCalendarDays(y, m, d, 1);
    y = n.year;
    m = n.month;
    d = n.day;
  }
  for (let i = 0; i < 14; i++) {
    const noon = etMs(y, m, d, 12, 0);
    if (isTradingDay(noon)) return { year: y, month: m, day: d };
    const n = addCalendarDays(y, m, d, 1);
    y = n.year;
    m = n.month;
    d = n.day;
  }
  return { year: y, month: m, day: d };
}

/** BMO 08:30 ET · AMC 16:20 ET · FOMC-style intraday 14:00 ET. */
export function sessionStampOnDay(ms: number, session: Session): number {
  const p = nyParts(ms);
  if (session === "bmo") return etMs(p.year, p.month, p.day, 8, 30);
  if (session === "amc") return etMs(p.year, p.month, p.day, 16, 20);
  return etMs(p.year, p.month, p.day, 14, 0);
}

export function upcomingSessionIso(now: number, session: Session, minAheadMs: number): string {
  let t = now + Math.max(0, minAheadMs);
  for (let i = 0; i < 40; i++) {
    const stamp = sessionStampOnDay(t, session);
    if (isTradingDay(stamp) && stamp >= now + minAheadMs) return new Date(stamp).toISOString();
    t += 86400000;
  }
  return new Date(sessionStampOnDay(t, session)).toISOString();
}

export function pastSessionIso(now: number, session: Session, minAgoMs: number): string {
  let t = now - Math.max(0, minAgoMs);
  for (let i = 0; i < 40; i++) {
    const stamp = sessionStampOnDay(t, session);
    if (isTradingDay(stamp) && stamp <= now - minAgoMs) return new Date(stamp).toISOString();
    t -= 86400000;
  }
  return new Date(sessionStampOnDay(t, session)).toISOString();
}

export function nextOpenDetail(now: number): string {
  const p = nyParts(now);
  const next = nextTradingYmd(p.year, p.month, p.day, !isTradingDay(now) || p.hour >= 20);
  const today = nyDateKey(now);
  const key = `${String(next.year).padStart(4, "0")}-${String(next.month).padStart(2, "0")}-${String(next.day).padStart(2, "0")}`;
  if (key === today) return "Opens 9:30 ET";
  const wd = nyParts(etMs(next.year, next.month, next.day, 12, 0)).weekday;
  return `Opens ${wd} 9:30 ET`;
}
