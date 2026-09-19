import { useEffect, useMemo, useState } from "react";
import { ageLabel, formatPct } from "@/lib/catalyst/format";
import { impactLabel, impactRulePx, impactWeight, kindLabel } from "@/lib/catalyst/impact";
import { tickerById, upcomingFollowed } from "@/lib/catalyst/selectors";
import { useCatalyst, type CatalystState } from "@/lib/catalyst/store";
import type { Headline, NewsImpact } from "@/lib/catalyst/types";
import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { EmptyState, Pill, PrimaryButton, SecondaryButton, TopBar } from "./ui";
import { cn } from "@/lib/utils";

const TIERS: { id: NewsImpact; label: string }[] = [
  { id: "high", label: "High impact" },
  { id: "medium", label: "Medium impact" },
  { id: "low", label: "Low impact" },
];

export function NewsScreen() {
  const store = useCatalyst();
  const [filter, setFilter] = useState<"all" | NewsImpact | "today">("all");
  const [rankNote, setRankNote] = useState<string | null>(null);
  const canPop = store.stack.length > 0;

  useEffect(() => {
    if (store.demoMode) return;
    const stale =
      !store.newsFetchedAt || Date.now() - new Date(store.newsFetchedAt).getTime() > 10 * 60_000;
    if (stale && store.tickers.length) void store.refreshNews();
  }, [store.tickers.length, store.demoMode]);

  const followed = useMemo(() => {
    const ids = new Set(store.tickers.map((t) => t.id));
    const macros = new Set(store.macros.map((m) => m.id));
    return store.headlines
      .filter((h) => (h.tickerId && ids.has(h.tickerId)) || (h.macroId && macros.has(h.macroId)))
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }, [store.headlines, store.tickers, store.macros]);

  const startOfDay = new Date(store.now);
  startOfDay.setHours(0, 0, 0, 0);

  const list = followed.filter((h) => {
    if (filter === "today") return new Date(h.publishedAt).getTime() >= startOfDay.getTime();
    if (filter === "all") return true;
    return h.impact === filter;
  });

  const byTier = TIERS.map((t) => ({
    ...t,
    items: list.filter((h) => (h.impact ?? "low") === t.id),
  })).filter((t) => t.items.length);

  const material = followed.filter((h) => h.impact === "high" || h.impact === "medium");

  return (
    <div className="px-4 pb-10 pt-1">
      {canPop ? (
        <div className="-mx-2 mb-1">
          <TopBar title="Tape" onBack={() => store.pop()} />
        </div>
      ) : (
        <header className="mb-3 pt-1">
          <h1 className="text-[34px] font-bold leading-none tracking-tight">Tape</h1>
        </header>
      )}
      <p className="mb-3 px-1 text-[13px] leading-snug text-[var(--fg-muted)]">
        What materially changed in what you follow. Impact estimate is magnitude, not direction.
      </p>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => void store.refreshNews()}
          disabled={store.newsStatus === "loading"}
          className="h-11 flex-1 rounded-[14px] text-[15px] font-semibold"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        >
          {store.newsStatus === "loading" ? "Fetching…" : "Refresh tape"}
        </button>
        <button
          type="button"
          onClick={() => {
            setRankNote(null);
            void store.scoreNews().then((ok) => {
              setRankNote(ok ? "Grok re-ranked expected materiality." : "Grok did not re-rank. Heuristic flags still apply.");
            });
          }}
          disabled={store.newsStatus === "scoring" || !followed.length}
          className="h-11 flex-1 rounded-[14px] text-[15px] font-semibold fill-accent"
        >
          {store.newsStatus === "scoring" ? "Ranking…" : "Rank with Grok"}
        </button>
      </div>
      {rankNote ? <p className="mb-3 text-[12px] text-[var(--fg-muted)]">{rankNote}</p> : null}

      <div className="flex gap-1.5 overflow-x-auto hide-scroll pb-1">
        {(
          [
            ["all", "All"],
            ["high", "High"],
            ["medium", "Medium"],
            ["low", "Low"],
            ["today", "Today"],
          ] as const
        ).map(([id, label]) => {
          const on = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className="h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold"
              style={{
                background: on ? "var(--seg-thumb)" : "var(--bg-elevated)",
                color: on ? "var(--fg)" : "var(--fg-muted)",
                boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : undefined,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {store.newsStatus === "error" ? (
        <p className="mt-3 text-[12px] text-[var(--color-warn)]">Tape fetch failed. Showing what we already have.</p>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title={store.tickers.length ? "Nothing material changed." : EMPTY_COPY.watchlistTitle}
          body={
            store.tickers.length
              ? "Quiet is a valid tape. Material filings and street changes land here."
              : "Follow a name and Catalyst will pull Yahoo, Google News, Nasdaq, and Seeking Alpha — no key required."
          }
          actions={
            store.tickers.length ? (
              filter !== "all" ? <SecondaryButton onClick={() => setFilter("all")}>Show all</SecondaryButton> : undefined
            ) : (
              <PrimaryButton onClick={() => store.push({ name: "names" })}>Follow a name</PrimaryButton>
            )
          }
        />
      ) : (
        <div className="mt-4 flex flex-col gap-5">
          {byTier.map((tier) => (
            <section key={tier.id}>
              <h2
                className="mb-2 px-1 text-[13px] uppercase tracking-wide"
                style={{
                  fontWeight: impactWeight(tier.id) === "semibold" ? 600 : 400,
                  color: tier.id === "low" ? "var(--fg-faint)" : "var(--fg-muted)",
                }}
              >
                {tier.label}
              </h2>
              <div className="flex flex-col gap-3">
                {groupTape(tier.items, store).map((g) => (
                  <div key={g.key} className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (g.tickerId) store.push({ name: "ticker", id: g.tickerId });
                        else if (g.macroId) {
                          const ev = upcomingFollowed(store).find((e) => e.macroId === g.macroId);
                          if (ev) store.push({ name: "event", id: ev.id });
                        }
                      }}
                      className="flex w-full items-baseline justify-between gap-3 px-3.5 py-3 text-left"
                      style={{ boxShadow: "inset 0 -0.5px 0 var(--hairline)" }}
                    >
                      <span>
                        <span className="text-[16px] font-semibold">{g.kicker}</span>
                        <span className="ml-2 text-[12px] text-[var(--fg-muted)]">{g.countLine}</span>
                      </span>
                      {g.changePct != null ? (
                        <span className={cn("num text-[13px] font-medium", g.changePct >= 0 ? "pos" : "neg")}>
                          {formatPct(g.changePct)}
                        </span>
                      ) : g.printValue ? (
                        <span className="num text-[13px] font-medium">{g.printValue}</span>
                      ) : null}
                    </button>
                    {g.items.map((h, i) => (
                      <NewsRow
                        key={h.id}
                        headline={h}
                        last={i === g.items.length - 1}
                        onOpen={() => store.openSheet({ name: "article", id: h.id })}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-[var(--fg-faint)]">
        Rank with Grok scores expected materiality only — never up or down. Observed move is shown after the resolving session, separately.
        {material.length === 0 ? " Tape can be quiet." : ""}
      </p>
    </div>
  );
}

function groupTape(list: Headline[], store: CatalystState) {
  const order: string[] = [];
  const map = new Map<string, Headline[]>();
  for (const h of list) {
    const key = h.tickerId ? `t:${h.tickerId}` : h.macroId ? `m:${h.macroId}` : "other";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(h);
  }
  return order.map((key) => {
    const items = map.get(key)!;
    const tickerId = key.startsWith("t:") ? key.slice(2) : undefined;
    const macroId = key.startsWith("m:") ? key.slice(2) : undefined;
    const ticker = tickerId ? store.tickers.find((t) => t.id === tickerId) : undefined;
    const macro = macroId ? store.macros.find((m) => m.id === macroId) : undefined;
    return {
      key,
      kicker: ticker?.symbol ?? macro?.shortName ?? "—",
      tickerId,
      macroId,
      changePct: ticker?.changePct,
      printValue: macroId ? store.macroPrints[macroId]?.value : undefined,
      countLine: `${items.length} ${items.length === 1 ? "item" : "items"}`,
      items,
    };
  });
}

function NewsRow({
  headline,
  last,
  onOpen,
}: {
  headline: Headline;
  last: boolean;
  onOpen: () => void;
}) {
  const store = useCatalyst();
  const weight = impactWeight(headline.impact);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 px-3.5 py-3 text-left"
      style={{ boxShadow: last ? undefined : "inset 0 -0.5px 0 var(--hairline)" }}
    >
      <span
        className="mt-1 shrink-0 rounded-full"
        style={{
          width: impactRulePx(headline.impact),
          minHeight: 40,
          background: "var(--fg)",
          opacity: headline.impact === "high" ? 0.85 : headline.impact === "medium" ? 0.45 : 0.22,
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] tracking-wide"
            style={{
              fontWeight: weight === "semibold" ? 600 : 400,
              color: headline.impact === "low" ? "var(--fg-faint)" : "var(--fg)",
            }}
          >
            {impactLabel(headline.impact)}
          </span>
          <span className="text-[11px] text-[var(--fg-faint)]">{kindLabel(headline.kind)}</span>
        </div>
        <p className="mt-1 text-[15px] font-medium leading-snug">{headline.title}</p>
        {headline.why ? (
          <p className="mt-1 text-[12px] leading-snug text-[var(--fg-muted)]">{headline.why}</p>
        ) : null}
        <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
          {headline.source} · {ageLabel(headline.publishedAt, store.now)}
        </p>
      </div>
    </button>
  );
}

export function ArticleSheet() {
  const store = useCatalyst();
  const sheet = store.sheet;
  if (sheet?.name !== "article") return null;
  const h = store.headlines.find((x) => x.id === sheet.id);
  if (!h) return null;
  const ticker = tickerById(store, h.tickerId);
  const kicker = ticker?.symbol ?? store.macros.find((m) => m.id === h.macroId)?.shortName ?? "Tape";

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "var(--bg)" }}>
      <TopBar title={kicker} onBack={() => store.closeSheet()} />
      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-28">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[12px]"
            style={{
              fontWeight: impactWeight(h.impact) === "semibold" ? 600 : 400,
              color: h.impact === "low" ? "var(--fg-faint)" : "var(--fg)",
            }}
          >
            {impactLabel(h.impact)}
          </span>
          <Pill tone="neutral">{kindLabel(h.kind)}</Pill>
          {h.scoredBy === "grok" ? <Pill tone="accent">Grok</Pill> : null}
        </div>
        <h1 className="mt-3 text-[22px] font-bold leading-snug tracking-tight">{h.title}</h1>
        <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
          {h.source} · {ageLabel(h.publishedAt, store.now)}
        </p>
        {h.why ? (
          <p className="mt-4 rounded-[16px] px-3.5 py-3 text-[14px] leading-relaxed" style={{ background: "var(--bg-card)" }}>
            {h.why}
          </p>
        ) : null}
        {h.summary ? (
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--fg-muted)]">{h.summary}</p>
        ) : null}
        {ticker ? (
          <button
            type="button"
            className="mt-5 h-11 w-full rounded-[14px] text-[15px] font-semibold"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
            onClick={() => {
              store.closeSheet();
              store.push({ name: "ticker", id: ticker.id });
            }}
          >
            Open {ticker.symbol}
          </button>
        ) : null}
        {h.url ? (
          <a
            href={h.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex h-11 w-full items-center justify-center rounded-[14px] text-[15px] font-semibold fill-accent"
          >
            Read source
          </a>
        ) : null}
      </div>
    </div>
  );
}
