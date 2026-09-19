import { SCORING_RULE_VERSION } from "./build.ts";
import { isEntryComplete, type CatalystEvent, type Direction, type JournalEntry } from "./types.ts";

/** One named constant. Flat = |move| < this × typical session of the instrument. */
export const FLAT_BAND_MULTIPLE = 1.0;

export { SCORING_RULE_VERSION };

export function predictedVsActual(
  predicted: Direction,
  actual: Direction,
): "called" | "missed" {
  return predicted === actual ? "called" : "missed";
}

export function isUnresolvable(e: JournalEntry): boolean {
  return e.state === "unresolvable";
}

export function isScored(e: JournalEntry, now = Date.now()): boolean {
  if (!isEntryComplete(e)) return false;
  if (isUnresolvable(e)) return false;
  if (e.actualDirection == null || e.actualMovePct == null) return false;
  if (e.actualMoveDate && new Date(e.actualMoveDate).getTime() > now) return false;
  return true;
}

export function isCalibrationScored(e: JournalEntry, now = Date.now()): boolean {
  return isScored(e, now) && e.scoringRuleVersion != null;
}

export function isPreC67Scored(e: JournalEntry, now = Date.now()): boolean {
  return isScored(e, now) && e.scoringRuleVersion == null;
}

export function isPending(e: JournalEntry, now = Date.now()): boolean {
  if (isUnresolvable(e)) return false;
  if (isScored(e, now)) return false;
  return !isEntryComplete(e) || e.actualDirection == null;
}

export function rollingAccuracy(
  scored: JournalEntry[],
  window = 5,
): { t: string; pct: number }[] {
  const ordered = [...scored].sort(
    (a, b) =>
      new Date(a.actualMoveDate ?? a.updatedAt).getTime() -
      new Date(b.actualMoveDate ?? b.updatedAt).getTime(),
  );
  const pts: { t: string; pct: number }[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const slice = ordered.slice(Math.max(0, i - window + 1), i + 1);
    const hits = slice.filter(
      (e) => e.direction && e.actualDirection && e.direction === e.actualDirection,
    ).length;
    pts.push({
      t: ordered[i]?.actualMoveDate ?? ordered[i]!.updatedAt,
      pct: (hits / slice.length) * 100,
    });
  }
  return pts;
}

function nyDayKey(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/**
 * Typical session = stdev of daily returns on the 1M spark.
 * Event dates from the store are dropped from the series so the last earnings
 * day does not inflate the band used to judge the next print (C67 16c, option a).
 */
export function typicalSessionPct(
  series: number[],
  eventDates: string[] = [],
  now = Date.now(),
): number | null {
  if (series.length < 6) return null;
  const eventDays = new Set(eventDates.map((iso) => nyDayKey(new Date(iso).getTime())));
  const n = series.length;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!;
    const cur = series[i]!;
    if (prev <= 0) continue;
    const dayMs = now - (n - 1 - i) * 86400000;
    if (eventDays.has(nyDayKey(dayMs))) continue;
    rets.push((cur - prev) / prev);
  }
  const used = rets.length >= 5 ? rets : fallbackRets(series);
  if (used.length < 5) return null;
  const mean = used.reduce((a, b) => a + b, 0) / used.length;
  const variance = used.reduce((a, b) => a + (b - mean) ** 2, 0) / used.length;
  const sd = Math.sqrt(variance) * 100;
  if (!Number.isFinite(sd) || sd < 0.08) return null;
  return Number(sd.toFixed(1));
}

function fallbackRets(series: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!;
    const cur = series[i]!;
    if (prev <= 0) continue;
    rets.push((cur - prev) / prev);
  }
  return rets;
}

export function flatBandPct(typical: number): number {
  return FLAT_BAND_MULTIPLE * typical;
}

/** Catalyst's scoring rule. Not claimed to be statistically optimal. */
export function classifyMove(movePct: number, typical: number): Direction {
  const band = flatBandPct(typical);
  if (Math.abs(movePct) < band) return "flat";
  if (movePct >= band) return "up";
  return "down";
}

export function normalizedMove(movePct: number, typical: number): number {
  if (!typical) return 0;
  return movePct / typical;
}

export interface ConvictionBand {
  id: string;
  label: string;
  n: number;
  hits: number;
  pct: number;
}

/** Hit rate by conviction. The journal's actual edge, if any. */
export function convictionBands(scored: JournalEntry[]): ConvictionBand[] {
  const defs = [
    { id: "low", label: "1–2", min: 1, max: 2 },
    { id: "mid", label: "3", min: 3, max: 3 },
    { id: "high", label: "4–5", min: 4, max: 5 },
  ];
  return defs
    .map((d) => {
      const slice = scored.filter((e) => e.conviction != null && e.conviction >= d.min && e.conviction <= d.max);
      const hits = slice.filter((e) => e.direction && e.actualDirection && e.direction === e.actualDirection).length;
      return {
        id: d.id,
        label: d.label,
        n: slice.length,
        hits,
        pct: slice.length ? Math.round((hits / slice.length) * 100) : 0,
      };
    })
    .filter((b) => b.n > 0);
}

export function capturedMove(scored: JournalEntry[]): {
  hitAvg: number | null;
  missAvg: number | null;
} {
  const absAvg = (rows: JournalEntry[]) => {
    const xs = rows.map((e) => e.actualMovePct).filter((n): n is number => n != null);
    if (!xs.length) return null;
    return xs.reduce((a, n) => a + Math.abs(n), 0) / xs.length;
  };
  const hits = scored.filter((e) => e.direction && e.actualDirection && e.direction === e.actualDirection);
  const misses = scored.filter((e) => e.direction && e.actualDirection && e.direction !== e.actualDirection);
  return { hitAvg: absAvg(hits), missAvg: absAvg(misses) };
}

export const CALIBRATION_MIN_OVERALL = 15;
export const CALIBRATION_MIN_BAND = 8;

export function calibrationCopy(
  bands: ConvictionBand[],
  overallN: number,
): { inverted: boolean; text: string | null } {
  const high = bands.find((b) => b.id === "high");
  const mid = bands.find((b) => b.id === "mid");
  if (overallN < CALIBRATION_MIN_OVERALL) {
    return { inverted: false, text: null };
  }
  if (!high || !mid || high.n < CALIBRATION_MIN_BAND || mid.n < CALIBRATION_MIN_BAND) {
    return { inverted: false, text: null };
  }
  if (high.pct < mid.pct) {
    return {
      inverted: true,
      text: "Your highest-conviction calls have not outperformed your medium-conviction calls.",
    };
  }
  return { inverted: false, text: null };
}
