/**
 * Market data sits behind this protocol. Views never call vendors directly.
 * Live calls go through /api/live, which rotates sources and cools off 429s:
 *
 *   quote      Finnhub → Alpha Vantage → Stooq (no key)
 *   news       Finnhub company-news → NewsAPI
 *   earnings   Finnhub /stock/earnings → Alpha Vantage EARNINGS
 *   recs       Finnhub /stock/recommendation
 *   metrics    Finnhub /stock/metric + profile2 → Alpha Vantage OVERVIEW
 *   calendar   Finnhub /calendar/earnings → Alpha Vantage EARNINGS_CALENDAR
 *   macro      Finnhub /calendar/economic → Alpha Vantage series
 *              → NY Fed EFFR (FOMC) / BLS (CPI)
 *
 * Finnhub free: 60 rpm. Alpha Vantage free: ~25/day. A tripped source is
 * skipped for a minute so one 429 doesn't burn the rest of the keys.
 */

import type { CalendarHit, EarningsPrint, MacroPrint, MacroSeriesId, Recommendation, TapeMetrics } from "./types";

export interface QuoteResult {
  lastPrice: number;
  change: number;
  changePct: number;
  dayHigh?: number;
  dayLow?: number;
  dayOpen?: number;
  prevClose?: number;
  source?: string;
}

export type LiveKeys = { finnhub: string; alphaVantage: string; newsapi: string };

async function post(body: unknown) {
  const res = await fetch("/api/live", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function liveQuote(symbol: string, keys: LiveKeys): Promise<QuoteResult | null> {
  try {
    const data = await post({ action: "quote", symbol, keys });
    if (data && typeof data.lastPrice === "number") return data as QuoteResult;
    return null;
  } catch {
    return null;
  }
}

export async function liveNews(
  symbol: string,
  keys: LiveKeys,
): Promise<{ title: string; source: string; publishedAt: string }[]> {
  if (!keys.finnhub && !keys.newsapi) return [];
  try {
    const data = await post({ action: "news", symbol, keys });
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function liveEarnings(symbol: string, keys: LiveKeys): Promise<EarningsPrint[]> {
  if (!keys.finnhub && !keys.alphaVantage) return [];
  try {
    const data = await post({ action: "earnings", symbol, keys });
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function liveRecs(symbol: string, keys: LiveKeys): Promise<Recommendation | null> {
  if (!keys.finnhub) return null;
  try {
    const data = await post({ action: "recommendation", symbol, keys });
    if (data && typeof data.buy === "number") return data as Recommendation;
    return null;
  } catch {
    return null;
  }
}

export async function liveMetrics(symbol: string, keys: LiveKeys): Promise<Omit<TapeMetrics, "tickerId"> | null> {
  if (!keys.finnhub && !keys.alphaVantage) return null;
  try {
    const data = await post({ action: "metrics", symbol, keys });
    if (!data || typeof data !== "object") return null;
    return data as Omit<TapeMetrics, "tickerId">;
  } catch {
    return null;
  }
}

export async function liveCalendar(
  symbols: string[],
  keys: LiveKeys,
  from: string,
  to: string,
): Promise<CalendarHit[]> {
  if (!keys.finnhub && !keys.alphaVantage) return [];
  try {
    const data = await post({ action: "calendar", symbols, from, to, keys });
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

export async function liveMacro(
  series: MacroSeriesId,
  keys: LiveKeys,
): Promise<Omit<MacroPrint, "macroId"> | null> {
  try {
    const data = await post({ action: "macro", series, keys });
    if (!data || typeof data.value !== "string") return null;
    return data as Omit<MacroPrint, "macroId">;
  } catch {
    return null;
  }
}
