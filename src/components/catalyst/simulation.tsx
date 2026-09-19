import { BUILD_NAME, C5_SHA, SCORING_RULE_VERSION } from "@/lib/catalyst/build";
import { FLAT_BAND_MULTIPLE, isCalibrationScored } from "@/lib/catalyst/scoring";
import { SIM_DISCLAIMER, buildSimulationSnapshot } from "@/lib/catalyst/simulation";
import { useCatalyst } from "@/lib/catalyst/store";
import { TopBar } from "./ui";
import { useMemo } from "react";

export function SimulationScreen() {
  const store = useCatalyst();
  const report = useMemo(() => {
    const scored = store.entries.filter((e) => isCalibrationScored(e, store.now));
    const hits = scored.filter((e) => e.direction === e.actualDirection);
    const { report: r } = buildSimulationSnapshot(store.now);
    return { liveN: scored.length, liveHits: hits.length, r };
  }, [store.entries, store.now]);

  return (
    <div className="px-4 pb-10 pt-1">
      <div className="-mx-2">
        <TopBar title="Synthetic model" onBack={() => store.pop()} />
      </div>
      <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-warn)" }}>
        {SIM_DISCLAIMER}
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--fg-muted)]">
        One simulated user over six months. High-conviction forecasts are worse than medium-conviction
        forecasts — a genuine calibration flaw, not a product demo win. {BUILD_NAME}. Scoring rule v{SCORING_RULE_VERSION}.
        C5 preserved at {C5_SHA.slice(0, 7)}.
      </p>
      <div className="mt-4 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
        <p className="text-[13px] uppercase tracking-wide text-[var(--fg-faint)]">Loaded record</p>
        <p className="mt-2 text-[15px]">
          Scored calls {report.r.scored} · n = {report.r.scored}
        </p>
        <p className="mt-1 text-[15px]">
          Overall {report.r.accuracyPct}% · {report.r.hits} of {report.r.scored}
        </p>
        {report.r.bands.map((b) => (
          <p key={b.id} className="mt-1 text-[15px]">
            Conviction {b.label} {b.pct}% · n = {b.n}
          </p>
        ))}
        <p className="mt-3 text-[15px]">
          Earnings {report.r.earnings.pct}% · n = {report.r.earnings.n}
        </p>
        <p className="mt-1 text-[15px]">
          Macro {report.r.macro.pct}% · n = {report.r.macro.n}
        </p>
        <p className="mt-3 text-[15px]">
          Realized Up / Down / Flat under FLAT_BAND_MULTIPLE = {FLAT_BAND_MULTIPLE}: {report.r.moveDist.up} / {report.r.moveDist.down} / {report.r.moveDist.flat}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--fg-muted)]">
          {report.r.stableFromCall
            ? `A visible calibration pattern (high conviction underperforming medium) is readable after ${report.r.stableFromCall} scored calls${report.r.stableMonth ? ` (${report.r.stableMonth})` : ""}.`
            : "No stable pattern in this draw."}{" "}
          Not statistically proven. The multiple was not tuned to look balanced.
        </p>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-[var(--fg-faint)]">{report.r.label}</p>
    </div>
  );
}
