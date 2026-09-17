import { useEffect, useMemo, useState } from "react";
import { ageLabel } from "@/lib/catalyst/format";
import { impactLabel, kindLabel } from "@/lib/catalyst/impact";
import { tickerById } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { Headline, NewsFilter, NewsImpact } from "@/lib/catalyst/types";
import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { EmptyState, Pill, PrimaryButton, SecondaryButton, TopBar } from "./ui";

export function NewsScreen() {
  const store = useCatalyst();
  const [filter, setFilter] = useState<NewsFilter>("all");
  const [rankNote, setRankNote] = useState<string | null>(null);

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
    if (filter === "high") return h.impact === "high";
    if (filter === "target") return h.kind === "target";
    if (filter === "announcement") return h.kind === "announcement" || h.kind === "filing";
    if (filter === "today") return new Date(h.publishedAt).getTime() >= startOfDay.getTime();
    return true;
  });

  const highCount = followed.filter((h) => h.impact === "high").length;

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-3 flex items-end justify-between pt-1">
        <div>
          <h1 className="text-[34px] font-bold leading-none tracking-tight">News</h1>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            Watchlist tape. Flagged by how much it should move the name.
          </p>
        </div>
        {highCount ? (
          <span className="mb-0.5">
            <Pill tone="neg">{highCount} high</Pill>
          </span>
        ) : null}
      </header>

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
              setRankNote(ok ? "Grok re-ranked the top of the tape." : "Grok did not re-rank. Heuristic flags still apply.");
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
            ["target", "Targets"],
            ["announcement", "Company"],
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
          title={store.tickers.length ? "No stories in this filter" : EMPTY_COPY.watchlistTitle}
          body={
            store.tickers.length
              ? "Try All, or refresh the tape. Targets, 8-Ks, and company notes land here first."
              : "Follow a name and Catalyst will pull Yahoo, Google News, Nasdaq, and Seeking Alpha — no key required."
          }
          actions={
            store.tickers.length ? (
              <SecondaryButton onClick={() => setFilter("all")}>Show all</SecondaryButton>
            ) : (
              <PrimaryButton onClick={() => store.setTab("watchlist")}>Open Watchlist</PrimaryButton>
            )
          }
        />
      ) : (
        <div className="mt-3 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
          {list.map((h, i) => (
            <NewsRow
              key={h.id}
              headline={h}
              last={i === list.length - 1}
              onOpen={() => store.openSheet({ name: "article", id: h.id })}
            />
          ))}
        </div>
      )}

      <p className="mt-4 px-1 text-[11px] leading-relaxed text-[var(--fg-faint)]">
        High (red) ≈ a session that can print more than ~2%. Med (amber) is 0.5–2%. Low is color.
        Heuristic first; Rank with Grok re-scores the top of the tape. Not a real-time feed.
      </p>
    </div>
  );
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
  const ticker = tickerById(store, headline.tickerId);
  const kicker = ticker?.symbol ?? store.macros.find((m) => m.id === headline.macroId)?.shortName ?? "—";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-3 px-3.5 py-3 text-left"
      style={{ boxShadow: last ? undefined : "inset 0 -0.5px 0 var(--hairline)" }}
    >
      <ImpactRail impact={headline.impact} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold tracking-wide">{kicker}</span>
          <Pill tone={headline.impact === "high" ? "neg" : headline.impact === "medium" ? "warn" : "neutral"}>
            {impactLabel(headline.impact)}
          </Pill>
          <span className="text-[11px] text-[var(--fg-faint)]">{kindLabel(headline.kind)}</span>
        </div>
        <p className="mt-1 text-[15px] font-medium leading-snug">{headline.title}</p>
        <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
          {headline.source} · {ageLabel(headline.publishedAt, store.now)}
        </p>
      </div>
    </button>
  );
}

function ImpactRail({ impact }: { impact?: NewsImpact }) {
  const color =
    impact === "high" ? "var(--color-negative)" : impact === "medium" ? "var(--color-warn)" : "var(--hairline)";
  return <span className="mt-1 h-10 w-[3px] shrink-0 rounded-full" style={{ background: color }} />;
}

export function ArticleSheet() {
  const store = useCatalyst();
  const sheet = store.sheet;
  if (sheet?.name !== "article") return null;
  const h = store.headlines.find((x) => x.id === sheet.id);
  if (!h) return null;
  const ticker = tickerById(store, h.tickerId);
  const kicker = ticker?.symbol ?? store.macros.find((m) => m.id === h.macroId)?.shortName ?? "News";

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "var(--bg)" }}>
      <TopBar title={kicker} onBack={() => store.closeSheet()} />
      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-28">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={h.impact === "high" ? "neg" : h.impact === "medium" ? "warn" : "neutral"}>
            {impactLabel(h.impact)} move
          </Pill>
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
