import { isEntryComplete, type Direction, type JournalEntry } from "./types";

export function predictedVsActual(
  predicted: Direction,
  actual: Direction,
): "called" | "missed" {
  return predicted === actual ? "called" : "missed";
}

export function isScored(e: JournalEntry, now = Date.now()): boolean {
  if (!isEntryComplete(e)) return false;
  if (e.actualDirection == null || e.actualMovePct == null) return false;
  if (e.actualMoveDate && new Date(e.actualMoveDate).getTime() > now) return false;
  return true;
}

export function isPending(e: JournalEntry, now = Date.now()): boolean {
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

/** Daily-ish vol from a spark. Used to size a call against a typical session. */
export function typicalSessionPct(series: number[]): number | null {
  if (series.length < 6) return null;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!;
    const cur = series[i]!;
    if (prev <= 0) continue;
    rets.push((cur - prev) / prev);
  }
  if (rets.length < 5) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  const sd = Math.sqrt(variance) * 100;
  if (!Number.isFinite(sd) || sd < 0.08) return null;
  return Number(sd.toFixed(1));
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
