import { useMemo, useState } from "react";
import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { formatPct, formatWhen } from "@/lib/catalyst/format";
import {
  CALIBRATION_MIN_BAND,
  CALIBRATION_MIN_OVERALL,
  calibrationCopy,
  capturedMove,
  convictionBands,
  isCalibrationScored,
  isPreC67Scored,
  isUnresolvable,
  rollingAccuracy,
} from "@/lib/catalyst/scoring";
import { eventLabel, isPending, isScored, kindLabel, missingFields } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { JournalEntry } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { AccuracyChart } from "./charts";
import { EmptyState, Pill, PrimaryButton } from "./ui";

export function ReviewScreen() {
  const store = useCatalyst();
  const [tickerF, setTickerF] = useState("all");
  const [kindF, setKindF] = useState("all");
  const [convF, setConvF] = useState("all");

  const tickerOptions = useMemo(() => {
    const ids = new Set(
      store.entries
        .map((e) => store.events.find((ev) => ev.id === e.eventId)?.tickerId)
        .filter(Boolean) as string[],
    );
    return [...ids].map((id) => store.tickers.find((t) => t.id === id)).filter(Boolean);
  }, [store.entries, store.events, store.tickers]);

  function matchesFilters(entry: JournalEntry): boolean {
    const ev = store.events.find((e) => e.id === entry.eventId);
    if (!ev) return false;
    if (tickerF !== "all" && ev.tickerId !== tickerF && ev.macroId !== tickerF) return false;
    if (kindF !== "all" && ev.kind !== kindF) return false;
    if (convF !== "all" && String(entry.conviction) !== convF) return false;
    return true;
  }

  const scoredAll = store.entries.filter((e) => isScored(e, store.now));
  const calAll = store.entries.filter((e) => isCalibrationScored(e, store.now));
  const preC67 = store.entries.filter((e) => isPreC67Scored(e, store.now));
  const pendingAll = store.entries.filter((e) => isPending(e, store.now));
  const unresolvable = store.entries.filter((e) => isUnresolvable(e));
  const scored = calAll.filter(matchesFilters);
  const pending = pendingAll.filter(matchesFilters);
  const hiddenPending = pendingAll.length - pending.length;
  const hits = scored.filter((e) => e.direction && e.actualDirection && e.direction === e.actualDirection);
  const pct = scored.length ? Math.round((hits.length / scored.length) * 100) : 0;
  const series = rollingAccuracy(scored, 5);
  const bands = convictionBands(scored);
  const captured = capturedMove(scored);
  const calib = calibrationCopy(bands, scored.length);
  const chips: { id: string; label: string; clear: () => void }[] = [];
  if (tickerF !== "all") {
    const t = store.tickers.find((x) => x.id === tickerF);
    const m = store.macros.find((x) => x.id === tickerF);
    chips.push({ id: "t", label: t?.symbol ?? m?.shortName ?? tickerF, clear: () => setTickerF("all") });
  }
  if (kindF !== "all") chips.push({ id: "k", label: kindF, clear: () => setKindF("all") });
  if (convF !== "all") chips.push({ id: "c", label: `Conviction ${convF}`, clear: () => setConvF("all") });

  const byKind = [
    { id: "earnings", label: "Earnings", rows: scored.filter((e) => store.events.find((x) => x.id === e.eventId)?.kind === "earnings") },
    { id: "macro", label: "Macro", rows: scored.filter((e) => store.events.find((x) => x.id === e.eventId)?.kind === "macro") },
  ].filter((g) => g.rows.length >= 8);
  const byDir = (["up", "down", "flat"] as const)
    .map((d) => ({
      id: d,
      label: d,
      rows: scored.filter((e) => e.direction === d),
    }))
    .filter((g) => g.rows.length >= 8);

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-3 pt-1">
        <h1 className="text-[34px] font-bold leading-none tracking-tight">Record</h1>
        <p className="mt-1.5 text-[13px] text-[var(--fg-muted)]">What your history says about your judgment.</p>
      </header>

      <div className="rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
        <p className="text-[13px] uppercase tracking-wide text-[var(--fg-faint)]">Your confidence</p>
        {bands.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {bands.map((b) => (
              <div key={b.id} className="flex items-baseline justify-between gap-3">
                <p className="text-[15px]">Conviction {b.label}</p>
                <p className="num text-[15px] font-semibold">
                  {b.pct}% <span className="text-[12px] font-medium text-[var(--fg-muted)]">n = {b.n}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[15px] text-[var(--fg-muted)]">No C67 scored calls yet.</p>
        )}
        {scored.length < CALIBRATION_MIN_OVERALL || bands.some((b) => b.n < CALIBRATION_MIN_BAND && bands.length > 1) ? (
          <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">
            {hits.length} of {scored.length} scored calls. Calibration needs more observations.
          </p>
        ) : calib.text ? (
          <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">{calib.text}</p>
        ) : (
          <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">
            {hits.length} of {scored.length} scored calls under Catalyst’s scoring rule v1.
          </p>
        )}
        <p className="mt-3 num text-[13px] text-[var(--fg-faint)]">
          Overall {scored.length ? `${pct}%` : "—"} · n = {scored.length}
        </p>
        {captured.hitAvg != null ? (
          <p className="mt-2 text-[13px] leading-snug text-[var(--fg-muted)]">
            When you called it, the tape moved {captured.hitAvg.toFixed(1)}% on average
            {captured.missAvg != null ? ` · ${captured.missAvg.toFixed(1)}% when you missed` : ""}
          </p>
        ) : null}
        {series.length >= 2 ? (
          <div className="mt-2">
            <AccuracyChart points={series} />
          </div>
        ) : null}
      </div>

      {preC67.length ? (
        <p className="mt-3 px-1 text-[12px] leading-snug text-[var(--fg-faint)]">
          Earlier scores (pre-C67 rule) · n = {preC67.length} · excluded from calibration.
        </p>
      ) : null}
      {unresolvable.length ? (
        <p className="mt-1 px-1 text-[12px] leading-snug text-[var(--fg-faint)]">
          Unresolvable · n = {unresolvable.length} · excluded from accuracy.
        </p>
      ) : null}

      {byKind.length || byDir.length ? (
        <div className="mt-4 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
          <p className="text-[12px] uppercase tracking-wide text-[var(--fg-faint)]">Observed in your record</p>
          {byKind.map((g) => {
            const h = g.rows.filter((e) => e.direction === e.actualDirection).length;
            return (
              <p key={g.id} className="mt-2 text-[14px]">
                {g.label} {Math.round((h / g.rows.length) * 100)}% · n = {g.rows.length}
              </p>
            );
          })}
          {byDir.map((g) => {
            const h = g.rows.filter((e) => e.direction === e.actualDirection).length;
            return (
              <p key={g.id} className="mt-2 text-[14px] capitalize">
                {g.label} {Math.round((h / g.rows.length) * 100)}% · n = {g.rows.length}
              </p>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <select
          value={tickerF}
          onChange={(e) => setTickerF(e.target.value)}
          className="h-10 rounded-[12px] px-2 text-[13px] outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        >
          <option value="all">Ticker</option>
          {tickerOptions.map((t) =>
            t ? (
              <option key={t.id} value={t.id}>
                {t.symbol}
              </option>
            ) : null,
          )}
          {store.macros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.shortName}
            </option>
          ))}
        </select>
        <select
          value={kindF}
          onChange={(e) => setKindF(e.target.value)}
          className="h-10 rounded-[12px] px-2 text-[13px] outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        >
          <option value="all">Event type</option>
          <option value="earnings">Earnings</option>
          <option value="macro">Macro</option>
          <option value="product">Event</option>
        </select>
        <select
          value={convF}
          onChange={(e) => setConvF(e.target.value)}
          className="h-10 rounded-[12px] px-2 text-[13px] outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        >
          <option value="all">Conviction</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
      {chips.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={c.clear}
              className="h-7 rounded-full px-2.5 text-[12px] font-medium fill-accent"
            >
              {c.label} ×
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Pending</h2>
        {hiddenPending > 0 ? (
          <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
            {hiddenPending} pending {hiddenPending === 1 ? "entry" : "entries"} hidden by filters
          </p>
        ) : null}
        <div className="mt-2 flex flex-col gap-2">
          {pending.map((e) => {
            const ev = store.events.find((x) => x.id === e.eventId);
            if (!ev) return null;
            const miss = missingFields(e);
            const label = eventLabel(store, ev);
            return (
              <div key={e.id} className="rounded-[18px] p-3.5" style={{ background: "var(--bg-card)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold">
                      {label.kicker} · {ev.title}
                    </p>
                    <p className="text-[12px] text-[var(--fg-muted)]">
                      {miss.length ? miss.map((m) => `${m} missing`).join(" · ") : "Awaiting the resolving session close"}
                    </p>
                  </div>
                  {miss.length ? (
                    <button
                      type="button"
                      className="h-8 rounded-full px-3 text-[12px] font-semibold fill-accent"
                      onClick={() => store.openSheet({ name: "journal", eventId: ev.id })}
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="h-8 rounded-full px-3 text-[12px] font-semibold"
                      style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
                      onClick={() => store.push({ name: "event", id: ev.id })}
                    >
                      Open
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {pending.length === 0 ? (
            <p className="text-[13px] text-[var(--fg-faint)]">No pending entries in this view.</p>
          ) : null}
        </div>
      </div>

      {unresolvable.length ? (
        <div className="mt-6">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Unresolvable</h2>
          <div className="mt-2 flex flex-col gap-2">
            {unresolvable.map((e) => {
              const ev = store.events.find((x) => x.id === e.eventId);
              if (!ev) return null;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => store.push({ name: "event", id: ev.id })}
                  className="rounded-[18px] p-3.5 text-left"
                  style={{ background: "var(--bg-card)" }}
                >
                  <p className="text-[15px] font-semibold">
                    {eventLabel(store, ev).kicker} · {ev.title}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">{e.actualFigure ?? "Could not obtain a resolving move."}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Scored calls</h2>
        {scored.length === 0 && scoredAll.length === 0 ? (
          <EmptyState
            title={EMPTY_COPY.reviewTitle}
            body={EMPTY_COPY.reviewBody}
            actions={
              pendingAll.length === 0 ? (
                <PrimaryButton onClick={() => store.setTab("catalyst")}>See what’s next</PrimaryButton>
              ) : undefined
            }
          />
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {[...scored]
              .sort(
                (a, b) =>
                  new Date(b.actualMoveDate ?? b.updatedAt).getTime() -
                  new Date(a.actualMoveDate ?? a.updatedAt).getTime(),
              )
              .map((e) => {
                const ev = store.events.find((x) => x.id === e.eventId);
                if (!ev) return null;
                const called = e.direction === e.actualDirection;
                const label = eventLabel(store, ev);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => store.push({ name: "event", id: ev.id })}
                    className="rounded-[22px] p-4 text-left"
                    style={{ background: "var(--bg-card)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] font-semibold">
                        {label.kicker} · {ev.title}
                      </p>
                      <Pill tone={called ? "pos" : "neg"}>{called ? "Called it" : "Missed"}</Pill>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                      <div>
                        <p className="text-[11px] uppercase text-[var(--fg-faint)]">Predicted</p>
                        <p className="font-medium capitalize">{e.direction}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase text-[var(--fg-faint)]">Actual</p>
                        <p className="font-medium capitalize">{e.actualDirection}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
                      Conviction {e.conviction}/5 · {kindLabel(ev)} · n counted
                    </p>
                    {e.actualMovePct != null ? (
                      <p className={cn("num mt-1 text-[14px] font-medium", e.actualMovePct >= 0 ? "pos" : "neg")}>
                        Observed {formatPct(e.actualMovePct)}
                        {e.actualMoveDate ? ` · ${formatWhen(e.actualMoveDate)}` : ""}
                      </p>
                    ) : null}
                    {e.invalidation ? (
                      <p className="mt-2 text-[13px] leading-snug text-[var(--fg-muted)]">
                        Wrong if: {e.invalidation}
                        <span className="mt-0.5 block text-[12px] text-[var(--fg-faint)]">
                          {e.actualFigure ?? "Manual review needed"} · Invalidation: manual review needed
                        </span>
                      </p>
                    ) : null}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
