import { etMs, isTradingDay, nextOpenDetail, nextTradingYmd, nyParts } from "./calendar.ts";
import type { Session } from "./types.ts";

export type MarketPhase = "pre" | "open" | "after" | "closed";

export interface MarketClock {
  phase: MarketPhase;
  label: string;
  detail: string;
}

/** NYSE session, computed — no network. Weekends and listed US market holidays are closed. */
export function marketClock(now = Date.now()): MarketClock {
  const { hour, minute } = nyParts(now);
  const mins = hour * 60 + minute;
  if (!isTradingDay(now) || mins < 4 * 60 || mins >= 20 * 60) {
    return {
      phase: "closed",
      label: "Closed",
      detail: nextOpenDetail(now),
    };
  }
  if (mins < 9 * 60 + 30) {
    return { phase: "pre", label: "Before open", detail: "Regular open 9:30 ET" };
  }
  if (mins < 16 * 60) {
    const left = 16 * 60 - mins;
    const h = Math.floor(left / 60);
    const m = left % 60;
    return {
      phase: "open",
      label: "During session",
      detail: h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`,
    };
  }
  return { phase: "after", label: "After close", detail: "Session ended 4:00 ET" };
}

/** 16:00 ET close of the trading day that contains `fromMs`. Weekend/holiday → next trading day. */
export function sameSessionClose(fromMs: number): number {
  const p = nyParts(fromMs);
  const day = nextTradingYmd(p.year, p.month, p.day, false);
  return etMs(day.year, day.month, day.day, 16, 0);
}

/** 16:00 ET close of the next trading session after the one that contains `fromMs`. */
export function nextSessionClose(fromMs: number): number {
  const p = nyParts(fromMs);
  const day = nextTradingYmd(p.year, p.month, p.day, true);
  return etMs(day.year, day.month, day.day, 16, 0);
}

/**
 * When a locked call becomes objectively resolvable.
 * AMC → close of the NEXT trading session. BMO / intraday → close of the SAME trading session.
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
