import type { Direction, ImpactTag, Session } from "./types";

const ET = "en-US";

export function formatPrice(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 100 ? 2 : abs >= 10 ? 2 : 2;
  return n.toLocaleString(ET, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(n: number, signed = true): string {
  const body = `${Math.abs(n).toFixed(2)}%`;
  if (!signed) return body;
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

export function formatUsdChange(n: number): string {
  const body = `$${Math.abs(n).toFixed(2)}`;
  if (n > 0) return `+${body}`;
  if (n < 0) return `−${body}`;
  return body;
}

/** Finnhub marketCap is millions of USD. */
export function formatMarketCap(millions: number): string {
  if (!Number.isFinite(millions) || millions <= 0) return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`;
  if (millions >= 1) return `$${millions.toFixed(0)}M`;
  return `$${(millions * 1000).toFixed(0)}K`;
}

export function formatPe(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${n.toFixed(n >= 100 ? 0 : 1)}×`;
}

export function formatWhen(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleString(ET, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(ET, { month: "short", day: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(ET, { hour: "numeric", minute: "2-digit" });
}

export function sessionLabel(s: Session): string {
  if (s === "amc") return "After close";
  if (s === "bmo") return "Before open";
  return "During session";
}

export function impactLabel(t: ImpactTag): string {
  switch (t) {
    case "high-vol":
      return "High volatility";
    case "sector":
      return "Sector-wide";
    case "implied-move":
      return "Implied move";
    case "after-close":
      return "After close";
  }
}

export function directionLabel(d: Direction): string {
  if (d === "up") return "Up";
  if (d === "down") return "Down";
  return "Flat";
}

export function ageLabel(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d`;
  return formatDateShort(iso);
}

export function countdown(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  const past = ms < 0;
  const abs = Math.abs(ms);
  const min = Math.floor(abs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  let core: string;
  if (day >= 2) core = `${day}d ${hr % 24}h`;
  else if (hr >= 1) core = `${hr}h ${min % 60}m`;
  else core = `${Math.max(1, min)}m`;
  return past ? `${core} ago` : `in ${core}`;
}

export function hoursUntil(iso: string, now = Date.now()): number {
  return (new Date(iso).getTime() - now) / 3600000;
}

export function startOfWeek(now = Date.now()): Date {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function endOfWeek(now = Date.now()): Date {
  const s = startOfWeek(now);
  return new Date(s.getTime() + 7 * 86400000);
}

export function inThisWeek(iso: string, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  return t >= startOfWeek(now).getTime() && t < endOfWeek(now).getTime();
}

export function inNextWeek(iso: string, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  const n = endOfWeek(now).getTime();
  return t >= n && t < n + 7 * 86400000;
}

export function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function makeSpark(seed: number, n: number, drift: number, vol: number): number[] {
  const rand = seededRng(seed);
  const out: number[] = [];
  let v = 100;
  for (let i = 0; i < n; i++) {
    const shock = (rand() - 0.48) * vol;
    v = Math.max(8, v * (1 + drift + shock));
    out.push(Number(v.toFixed(3)));
  }
  return out;
}

export function startOfNyDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function dayHeading(iso: string, now = Date.now()): string {
  const key = startOfNyDay(iso);
  const today = startOfNyDay(new Date(now).toISOString());
  const tom = startOfNyDay(new Date(now + 86400000).toISOString());
  if (key === today) return "Today";
  if (key === tom) return "Tomorrow";
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function formatTimeEt(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isoDateEt(now = Date.now(), offsetDays = 0): string {
  const d = new Date(now + offsetDays * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}
