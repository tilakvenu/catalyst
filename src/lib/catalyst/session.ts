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
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
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

export function directionFromMove(pct: number): "up" | "down" | "flat" {
  if (pct > 0.4) return "up";
  if (pct < -0.4) return "down";
  return "flat";
}
