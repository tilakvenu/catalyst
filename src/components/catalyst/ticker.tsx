import { useEffect, useState } from "react";
import { ageLabel, countdown, formatPct, formatPrice, formatUsdChange, formatWhen } from "@/lib/catalyst/format";
import { impactLabel, kindLabel as newsKindLabel } from "@/lib/catalyst/impact";
import { typicalSessionPct } from "@/lib/catalyst/scoring";
import { entryFor, isUrgent, kindLabel, pastFollowed, upcomingFollowed } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { PastFilter, SparkRange } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { Sparkline } from "./charts";
import { DayRange, MetricsLine, TapeCard } from "./context";
import { Segmented, TopBar, Pill } from "./ui";

export function TickerScreen({ id }: { id: string }) {
  const store = useCatalyst();
  const ticker = store.tickers.find((t) => t.id === id);
  const [range, setRange] = useState<SparkRange>("1M");
  const [past, setPast] = useState<PastFilter>("all");

  useEffect(() => {
    if (!ticker) return;
    void store.refreshLive(ticker.symbol, ticker.id);
  }, [ticker?.id, ticker?.symbol]);

  if (!ticker) {
    return (
      <div className="p-6">
        <TopBar title="Missing" onBack={() => store.pop()} />
        <p className="text-[var(--fg-muted)]">That ticker is not on the watchlist.</p>
      </div>
    );
  }
  const up = ticker.changePct >= 0;
  const spark = store.sparks[ticker.id]?.[range] ?? [];
  const sparkUp = spark.length ? spark[spark.length - 1]! >= spark[0]! : up;
  const next = upcomingFollowed(store).find((e) => e.tickerId === ticker.id);
  const headlines = store.headlines.filter((h) => h.tickerId === ticker.id);
  const history = pastFollowed(store).filter((e) => e.tickerId === ticker.id);
  const filtered = history.filter((e) => {
    if (past === "earnings") return e.kind === "earnings";
    if (past === "notes") return Boolean(entryFor(store, e.id)?.text);
    return true;
  });
  const urgent = next ? isUrgent(next.startsAt, store.now) : false;
  const profile = store.profiles.find((p) => p.tickerId === ticker.id);
  const prints = store.earningsHistory[ticker.id] ?? [];
  const rec = store.recommendations[ticker.id];
  const quote = store.quotes.find((q) => q.tickerId === ticker.id);
  const tape = store.tape[ticker.id];
  const typical = typicalSessionPct(store.sparks[ticker.id]?.["1M"] ?? []);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        onBack={() => store.pop()}
        trailing={
          next ? (
            <button
              type="button"
              onClick={() => store.toggleNotify(next.id)}
              className="pressable mr-2 h-9 rounded-full px-3 text-[13px] font-semibold"
              style={{
                background: next.notify ? "var(--color-accent)" : "var(--bg-elevated)",
                color: next.notify ? "var(--color-accent-ink)" : "var(--fg)",
              }}
            >
              {next.notify ? "Notify on" : "Notify"}
            </button>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-10">
        <p className="text-[13px] text-[var(--fg-muted)]">{ticker.company}</p>
        <h1 className="text-[34px] font-bold tracking-tight">{ticker.symbol}</h1>
        <p className="num mt-1 text-[34px] font-semibold leading-none tracking-tight">{formatPrice(ticker.lastPrice)}</p>
        <p className={cn("num mt-2 text-[16px] font-medium", up ? "pos" : "neg")}>
          {formatUsdChange(ticker.change)} ({formatPct(ticker.changePct)})
        </p>
        <DayRange quote={quote} last={ticker.lastPrice} />
        <MetricsLine tape={tape} typical={typical} />
        <p className="mt-1 text-[11px] text-[var(--fg-faint)]">
          Delayed 15 min
          {profile ? ` · ${profile.sector}` : ""}
        </p>

        <div className="mt-4">
          <Sparkline data={spark} positive={sparkUp} className="h-16 w-full" />
          <div className="mt-3">
            <Segmented
              value={range}
              onChange={setRange}
              options={([
                ["1D", "1D"],
                ["1M", "1M"],
                ["6M", "6M"],
                ["1Y", "1Y"],
              ] as const).map(([id, label]) => ({ id, label }))}
            />
          </div>
        </div>

        {next ? (
          <div
            className="mt-5 w-full rounded-[22px] p-4 text-left"
            style={{
              background: "var(--bg-card)",
              boxShadow: urgent ? "0 0 0 1.5px var(--color-accent)" : "0 0 0 0.5px var(--hairline)",
            }}
          >
            <button type="button" onClick={() => store.push({ name: "event", id: next.id })} className="w-full text-left">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-faint)]">Next event</p>
                  <p className="mt-1 text-[16px] font-semibold">{next.title}</p>
                  <p className="text-[13px] text-[var(--fg-muted)]">
                    {kindLabel(next)} · {formatWhen(next.startsAt)}
                  </p>
                </div>
                <span className="num text-[13px] font-medium" style={{ color: urgent ? "var(--color-accent)" : "var(--fg)" }}>
                  {countdown(next.startsAt, store.now)}
                </span>
              </div>
            </button>
            <button
              type="button"
              className="mt-3 h-10 w-full rounded-[12px] text-[14px] font-semibold fill-accent"
              onClick={() => store.openSheet({ name: "note", eventId: next.id })}
            >
              Write a note
            </button>
          </div>
        ) : null}

        <div className="mt-5">
          <TapeCard prints={prints} rec={rec} />
        </div>

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Recent headlines</h2>
          <button
            type="button"
            className="text-[13px] font-medium text-[var(--color-accent)]"
            onClick={() => store.openSheet({ name: "headlines", tickerId: ticker.id })}
          >
            See all
          </button>
        </div>
        <div className="mt-2 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
          {headlines.slice(0, 3).map((h, i) => (
            <button
              key={h.id}
              type="button"
              onClick={() => store.openSheet({ name: "article", id: h.id })}
              className="w-full px-3.5 py-3 text-left"
              style={{ boxShadow: i < Math.min(headlines.length, 3) - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
            >
              <div className="flex items-center gap-1.5">
                <Pill tone={h.impact === "high" ? "neg" : h.impact === "medium" ? "warn" : "neutral"}>
                  {impactLabel(h.impact)}
                </Pill>
                <span className="text-[11px] text-[var(--fg-faint)]">{newsKindLabel(h.kind)}</span>
              </div>
              <p className="mt-1 text-[15px] font-medium leading-snug">{h.title}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
                {h.source} · {ageLabel(h.publishedAt, store.now)}
              </p>
            </button>
          ))}
          {headlines.length === 0 ? (
            <p className="px-3.5 py-4 text-[13px] text-[var(--fg-faint)]">No headlines yet.</p>
          ) : null}
        </div>

        <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Past events</h2>
        <div className="mt-2">
          <Segmented
            value={past}
            onChange={setPast}
            options={[
              { id: "all" as const, label: "All" },
              { id: "earnings" as const, label: "Earnings" },
              { id: "notes" as const, label: "With notes" },
            ]}
          />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {filtered.map((e) => {
            const note = entryFor(store, e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => store.push({ name: "event", id: e.id })}
                className="rounded-[16px] px-3.5 py-3 text-left"
                style={{ background: "var(--bg-card)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[15px] font-semibold">{e.title}</p>
                  {note?.actualMovePct != null ? (
                    <span className={cn("num text-[13px] font-medium", note.actualMovePct >= 0 ? "pos" : "neg")}>
                      {formatPct(note.actualMovePct)}
                    </span>
                  ) : null}
                </div>
                <p className="text-[12px] text-[var(--fg-faint)]">{formatWhen(e.startsAt)}</p>
                <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
                  {note?.text ? note.text : "No note recorded"}
                </p>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <p className="py-4 text-[13px] text-[var(--fg-faint)]">No matching past events.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function HeadlinesSheet() {
  const store = useCatalyst();
  const sheet = store.sheet;
  if (sheet?.name !== "headlines") return null;
  const list = store.headlines.filter((h) => {
    if (sheet.tickerId) return h.tickerId === sheet.tickerId;
    if (sheet.macroId) return h.macroId === sheet.macroId;
    return true;
  });
  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "var(--bg)" }}>
      <TopBar title="Headlines" onBack={() => store.closeSheet()} />
      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-28">
        {list.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => store.openSheet({ name: "article", id: h.id })}
            className="w-full border-b py-3 text-left"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="flex items-center gap-1.5">
              <Pill tone={h.impact === "high" ? "neg" : h.impact === "medium" ? "warn" : "neutral"}>
                {impactLabel(h.impact)}
              </Pill>
              <span className="text-[11px] text-[var(--fg-faint)]">{newsKindLabel(h.kind)}</span>
            </div>
            <p className="mt-1 text-[16px] font-medium leading-snug">{h.title}</p>
            <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
              {h.source} · {ageLabel(h.publishedAt, store.now)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
