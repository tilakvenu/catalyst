import { useMemo, useRef, useState } from "react";
import { countdown, formatPct, formatPrice } from "@/lib/catalyst/format";
import { thisWeek, upcomingFollowed } from "@/lib/catalyst/selectors";
import { MACRO_CATALOG, useCatalyst } from "@/lib/catalyst/store";
import type { MacroItem, Ticker, WatchFilter } from "@/lib/catalyst/types";
import { SEARCH_UNIVERSE } from "@/lib/catalyst/universe";
import { cn } from "@/lib/utils";
import { EmptyState, Pill, PrimaryButton, SecondaryButton, SheetFrame } from "./ui";

function useReveal(open: boolean, onToggle: () => void, onOpen: () => void) {
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      startX.current = e.clientX;
      moved.current = false;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (startX.current == null) return;
      const dx = e.clientX - startX.current;
      if (Math.abs(dx) > 8) moved.current = true;
      if (dx < -48 && !open) onToggle();
      if (dx > 48 && open) onToggle();
    },
    onPointerUp: () => {
      const wasMove = moved.current;
      startX.current = null;
      if (!wasMove && !open) onOpen();
    },
  };
}

export function WatchlistScreen() {
  const store = useCatalyst();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<WatchFilter>("all");
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);

  const held = store.tickers.filter((t) => t.held).length;
  const allCount = store.tickers.length + store.macros.length;
  const searching = q.trim().length > 0;
  const week = thisWeek(store);

  const rows = useMemo(() => {
    if (filter === "held") return store.tickers.filter((t) => t.held);
    if (filter === "macro") return store.macros;
    return [...store.tickers, ...store.macros];
  }, [filter, store.tickers, store.macros]);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return SEARCH_UNIVERSE.filter(
      (h) => h.symbol.toLowerCase().includes(needle) || h.company.toLowerCase().includes(needle),
    ).slice(0, 8);
  }, [q]);

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-3 flex items-end justify-between pt-1">
        <h1 className="text-[34px] font-bold leading-none tracking-tight">Names</h1>
        <button
          type="button"
          onClick={() => store.openSheet({ name: "add" })}
          className="pressable flex h-11 w-11 items-center justify-center rounded-full fill-accent text-[22px] font-medium"
          aria-label="Add"
        >
          +
        </button>
      </header>

      <label className="mb-3 block">
        <span className="sr-only">Search ticker or event</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ticker or event"
          className="h-11 w-full rounded-[14px] px-3.5 text-[16px] outline-none"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        />
      </label>

      {searching ? (
        <div>
          <div className="flex flex-col gap-1">
            {hits.map((h) => {
              const watched = store.tickers.some((t) => t.symbol === h.symbol);
              return (
                <div
                  key={h.symbol}
                  className="flex items-center justify-between rounded-[16px] px-3 py-3"
                  style={{ background: "var(--bg-card)" }}
                >
                  <div>
                    <p className="text-[16px] font-semibold">{h.symbol}</p>
                    <p className="text-[13px] text-[var(--fg-muted)]">{h.company}</p>
                  </div>
                  {watched ? (
                    <Pill>On watchlist</Pill>
                  ) : (
                    <button
                      type="button"
                      className="pressable h-9 rounded-full px-3 text-[13px] font-semibold fill-accent"
                      onClick={() => store.addTicker(h.symbol)}
                    >
                      Add
                    </button>
                  )}
                </div>
              );
            })}
            {hits.length === 0 ? (
              <p className="px-1 py-6 text-[14px] text-[var(--fg-muted)]">No matches in the US list.</p>
            ) : null}
          </div>
          <p className="mt-4 px-1 text-[12px] leading-relaxed text-[var(--fg-faint)]">
            Search covers US-listed equities and ETFs. Macro releases are under Follow macro events.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-1.5">
            {(
              [
                ["all", "All", allCount],
                ["held", "Held", held],
                ["macro", "Macro", store.macros.length],
              ] as const
            ).map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "pressable h-8 rounded-full px-3 text-[13px] font-medium",
                  filter === id ? "fill-accent" : "",
                )}
                style={
                  filter === id
                    ? undefined
                    : { background: "var(--bg-elevated)", color: "var(--fg-muted)" }
                }
              >
                {label} <span className="num">{count}</span>
              </button>
            ))}
          </div>
          {week.length ? (
            <p className="mb-3 px-1 text-[12px] text-[var(--fg-muted)]">
              {week.length} {week.length === 1 ? "print" : "prints"} this week
            </p>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="Nothing on the watchlist"
              body="Add a US-listed equity or ETF, or follow a macro release as a first-class event."
              actions={
                <>
                  <PrimaryButton onClick={() => store.openSheet({ name: "add" })}>Add a ticker</PrimaryButton>
                  <SecondaryButton onClick={() => store.openSheet({ name: "macro" })}>
                    Follow macro events
                  </SecondaryButton>
                </>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) =>
                row.kind === "macro" ? (
                  <MacroRow
                    key={row.id}
                    item={row}
                    open={openSwipe === row.id}
                    onToggle={() => setOpenSwipe(openSwipe === row.id ? null : row.id)}
                    onOpen={() => {
                      const ev = upcomingFollowed(store).find((e) => e.macroId === row.id);
                      if (ev) store.push({ name: "event", id: ev.id });
                    }}
                  />
                ) : (
                  <TickerRow
                    key={row.id}
                    item={row}
                    open={openSwipe === row.id}
                    onToggle={() => setOpenSwipe(openSwipe === row.id ? null : row.id)}
                    onOpen={() => store.push({ name: "ticker", id: row.id })}
                  />
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TickerRow({
  item,
  open,
  onToggle,
  onOpen,
}: {
  item: Ticker;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const store = useCatalyst();
  const swipe = useReveal(open, onToggle, onOpen);
  const next = upcomingFollowed(store).find((e) => e.tickerId === item.id);
  const up = item.changePct >= 0;
  return (
    <div className="relative overflow-hidden rounded-[22px]">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: 168 }}>
        <button
          type="button"
          onClick={() => store.toggleMuteTicker(item.id)}
          className="w-[84px] text-[13px] font-semibold"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
        >
          {item.muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          onClick={() => store.removeTicker(item.id)}
          className="w-[84px] text-[13px] font-semibold fill-neg"
        >
          Remove
        </button>
      </div>
      <button
        type="button"
        {...swipe}
        onContextMenu={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className="relative z-10 flex w-full items-start justify-between px-3.5 py-3.5 text-left transition-transform duration-200"
        style={{
          background: "var(--bg-card)",
          transform: open ? "translateX(-168px)" : "translateX(0)",
        }}
      >
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold">{item.symbol}</span>
            {store.headlines.some((h) => h.tickerId === item.id && h.impact === "high") ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-negative)" }} />
            ) : null}
            <span className="truncate text-[13px] text-[var(--fg-muted)]">{item.company}</span>
          </span>
          <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">
            {next ? `${next.title} · ${countdown(next.startsAt, store.now)}` : "No upcoming event"}
            {item.muted ? " · Muted" : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="num block text-[16px] font-semibold">{formatPrice(item.lastPrice)}</span>
          <span className={cn("num text-[13px] font-medium", up ? "pos" : "neg")}>
            {formatPct(item.changePct)}
          </span>
        </span>
      </button>
    </div>
  );
}

function MacroRow({
  item,
  open,
  onToggle,
  onOpen,
}: {
  item: MacroItem;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const store = useCatalyst();
  const swipe = useReveal(open, onToggle, onOpen);
  const next = upcomingFollowed(store).find((e) => e.macroId === item.id);
  const print = store.macroPrints[item.id];
  return (
    <div className="relative overflow-hidden rounded-[22px]">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: 168 }}>
        <button
          type="button"
          onClick={() => store.toggleMuteMacro(item.id)}
          className="w-[84px] text-[13px] font-semibold"
          style={{ background: "var(--bg-elevated)" }}
        >
          {item.muted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          onClick={() => store.unfollowMacro(item.id)}
          className="w-[84px] text-[13px] font-semibold fill-neg"
        >
          Remove
        </button>
      </div>
      <button
        type="button"
        {...swipe}
        onContextMenu={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className="relative z-10 flex w-full items-start justify-between px-3.5 py-3.5 text-left transition-transform duration-200"
        style={{
          background: "var(--bg-card)",
          transform: open ? "translateX(-168px)" : "translateX(0)",
        }}
      >
        <span>
          <span className="block text-[16px] font-semibold">{item.shortName}</span>
          <span className="block text-[13px] text-[var(--fg-muted)]">{item.name}</span>
          <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">
            {next ? `${next.title} · ${countdown(next.startsAt, store.now)}` : "No upcoming event"}
          </span>
        </span>
        <span className="text-right">
          {print ? (
            <>
              <span className="num block text-[16px] font-semibold">{print.value}</span>
              <span className="block text-[12px] text-[var(--fg-faint)]">{print.prior ? `prior ${print.prior}` : print.source}</span>
            </>
          ) : (
            <span className="text-[13px] text-[var(--fg-faint)]">Macro</span>
          )}
        </span>
      </button>
    </div>
  );
}

function AddSheet() {
  const store = useCatalyst();
  const [q, setQ] = useState("");
  const hits = SEARCH_UNIVERSE.filter(
    (h) =>
      !q.trim() ||
      h.symbol.toLowerCase().includes(q.toLowerCase()) ||
      h.company.toLowerCase().includes(q.toLowerCase()),
  ).slice(0, 12);
  return (
    <SheetFrame onClose={() => store.closeSheet()} title="Add ticker">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ticker or company"
        className="mb-3 h-11 w-full rounded-[14px] px-3.5 text-[16px] outline-none"
        style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
      />
      <div className="flex flex-col gap-1 pb-4">
        {hits.map((h) => {
          const watched = store.tickers.some((t) => t.symbol === h.symbol);
          return (
            <button
              key={h.symbol}
              type="button"
              disabled={watched}
              onClick={() => {
                store.addTicker(h.symbol);
                store.closeSheet();
              }}
              className="flex items-center justify-between rounded-[14px] px-3 py-3 text-left"
              style={{ background: "var(--bg-card)" }}
            >
              <span>
                <span className="block font-semibold">{h.symbol}</span>
                <span className="block text-[13px] text-[var(--fg-muted)]">{h.company}</span>
              </span>
              {watched ? <Pill>On watchlist</Pill> : <span className="text-[13px] text-[var(--color-accent)]">Add</span>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="mb-2 text-[14px] font-medium text-[var(--color-accent)]"
        onClick={() => store.openSheet({ name: "macro" })}
      >
        Follow macro events
      </button>
      <button
        type="button"
        className="mb-6 block text-[14px] font-medium text-[var(--color-accent)]"
        onClick={() => store.openSheet({ name: "csv" })}
      >
        Import from a broker CSV
      </button>
    </SheetFrame>
  );
}

function MacroSheet() {
  const store = useCatalyst();
  return (
    <SheetFrame onClose={() => store.closeSheet()} title="Follow macro">
      <p className="mb-4 text-[14px] leading-relaxed text-[var(--fg-muted)]">
        Macro releases are first-class. They have no quote — they show “No quote” on the watchlist.
      </p>
      <div className="flex flex-col gap-2 pb-8">
        {MACRO_CATALOG.map((m) => {
          const on = store.macros.some((x) => x.id === m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => (on ? store.unfollowMacro(m.id) : store.followMacro(m.id))}
              className="flex items-center justify-between rounded-[16px] px-3.5 py-3.5 text-left"
              style={{ background: "var(--bg-card)" }}
            >
              <span>
                <span className="block font-semibold">{m.shortName}</span>
                <span className="block text-[13px] text-[var(--fg-muted)]">{m.name}</span>
              </span>
              <span className="text-[13px] font-medium text-[var(--color-accent)]">{on ? "Following" : "Follow"}</span>
            </button>
          );
        })}
      </div>
    </SheetFrame>
  );
}

function CsvSheet() {
  const store = useCatalyst();
  const [text, setText] = useState("NVDA,AAPL,MSFT,JPM,SPY");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  return (
    <SheetFrame onClose={() => store.closeSheet()} title="Import CSV">
      <p className="mb-3 text-[14px] text-[var(--fg-muted)]">
        Paste symbols separated by commas or new lines. Unknown symbols are skipped.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="mb-3 w-full rounded-[14px] p-3 text-[15px] outline-none"
        style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
      />
      <PrimaryButton
        onClick={() => {
          const r = store.importCsv(text);
          setResult(r);
        }}
      >
        Import
      </PrimaryButton>
      {result ? (
        <p className="mt-3 text-[13px] text-[var(--fg-muted)]">
          Added {result.added}, skipped {result.skipped}.
        </p>
      ) : null}
    </SheetFrame>
  );
}

export function WatchlistSheets() {
  const store = useCatalyst();
  if (store.sheet?.name === "add") return <AddSheet />;
  if (store.sheet?.name === "macro") return <MacroSheet />;
  if (store.sheet?.name === "csv") return <CsvSheet />;
  return null;
}
