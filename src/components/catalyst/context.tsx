import { formatMarketCap, formatPct, formatPe, formatPrice } from "@/lib/catalyst/format";
import type { EarningsPrint, QuoteCache, Recommendation, TapeMetrics } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";

export function SurpriseStrip({ prints }: { prints: EarningsPrint[] }) {
  if (!prints.length) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-faint)]">Last four prints</p>
        <p className="text-[11px] text-[var(--fg-faint)]">EPS vs est.</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-0">
        {prints.slice(0, 4).map((p) => {
          const beat = (p.surprisePct ?? 0) > 0.2;
          const miss = (p.surprisePct ?? 0) < -0.2;
          return (
            <div key={p.period} className="px-1 text-center">
              <p className="truncate text-[10px] uppercase tracking-wide text-[var(--fg-faint)]">{p.period}</p>
              <p className="num mt-1 text-[15px] font-semibold">{p.actual != null ? p.actual.toFixed(2) : "—"}</p>
              <p
                className={cn(
                  "num mt-0.5 text-[11px] font-medium",
                  beat ? "pos" : miss ? "neg" : "text-[var(--fg-muted)]",
                )}
              >
                {p.surprisePct == null ? "—" : formatPct(p.surprisePct)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RecLine({ rec }: { rec: Recommendation }) {
  const total = rec.buy + rec.hold + rec.sell || 1;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-faint)]">Analysts</p>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
        <span className="h-full" style={{ width: `${(rec.buy / total) * 100}%`, background: "var(--color-positive)" }} />
        <span className="h-full" style={{ width: `${(rec.hold / total) * 100}%`, background: "var(--fill-urgency)" }} />
        <span className="h-full" style={{ width: `${(rec.sell / total) * 100}%`, background: "var(--color-negative)" }} />
      </div>
      <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
        <span className="pos font-medium">{rec.buy} buy</span>
        <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
        {rec.hold} hold
        <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
        <span className="neg font-medium">{rec.sell} sell</span>
      </p>
    </div>
  );
}

export function DayRange({ quote, last }: { quote?: QuoteCache; last: number }) {
  const low = quote?.dayLow;
  const high = quote?.dayHigh;
  if (low == null || high == null || high <= low) return null;
  const span = high - low;
  const pct = Math.min(100, Math.max(0, ((last - low) / span) * 100));
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[11px] text-[var(--fg-faint)]">
        <span className="num">{formatPrice(low)}</span>
        <span>Day range</span>
        <span className="num">{formatPrice(high)}</span>
      </div>
      <div className="relative mt-1.5 h-1 rounded-full" style={{ background: "var(--fill-urgency)" }}>
        <span
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${pct}%`, background: "var(--fg)" }}
        />
      </div>
    </div>
  );
}

export function MetricsLine({ tape, typical }: { tape?: TapeMetrics; typical?: number | null }) {
  const bits: string[] = [];
  if (tape?.marketCap) bits.push(formatMarketCap(tape.marketCap));
  if (tape?.pe) bits.push(`${formatPe(tape.pe)} P/E`);
  if (tape?.week52Low && tape?.week52High) {
    bits.push(`52w ${formatPrice(tape.week52Low)}–${formatPrice(tape.week52High)}`);
  }
  if (typical) bits.push(`typ. ±${typical.toFixed(1)}%`);
  if (!bits.length) return null;
  return <p className="mt-2 text-[12px] text-[var(--fg-faint)]">{bits.join(" · ")}</p>;
}

export function TapeCard({
  prints,
  rec,
  typical,
}: {
  prints?: EarningsPrint[];
  rec?: Recommendation;
  typical?: number | null;
}) {
  const hasPrints = Boolean(prints?.length);
  const hasRec = Boolean(rec);
  if (!hasPrints && !hasRec && typical == null) return null;
  return (
    <div className="overflow-hidden rounded-[22px] px-4 py-3.5" style={{ background: "var(--bg-card)" }}>
      {hasPrints ? <SurpriseStrip prints={prints!} /> : null}
      {hasPrints && hasRec ? <div className="my-3 h-px" style={{ background: "var(--hairline)" }} /> : null}
      {hasRec ? <RecLine rec={rec!} /> : null}
      {typical != null ? (
        <p className="mt-2 text-[12px] text-[var(--fg-faint)]">Typical session ±{typical.toFixed(1)}%</p>
      ) : null}
    </div>
  );
}
