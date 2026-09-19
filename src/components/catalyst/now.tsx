import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { ageLabel, countdown, formatPct, formatWhen } from "@/lib/catalyst/format";
import { impactLabel, kindLabel as newsKindLabel } from "@/lib/catalyst/impact";
import { marketClock } from "@/lib/catalyst/session";
import {
  entryFor,
  eventLabel,
  isEntryComplete,
  kindLabel,
  nearest,
  needsCall,
  readyToScore,
  suggestedPrint,
  thisWeek,
} from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { CatalystEvent, Headline } from "@/lib/catalyst/types";
import { EventRow } from "./event-row";
import { EmptyState, Pill, PrimaryButton, SecondaryButton } from "./ui";

export function NowScreen() {
  const store = useCatalyst();
  const next = nearest(store);
  const clock = marketClock(store.now);
  const ready = readyToScore(store);
  const open = needsCall(store).filter((e) => e.id !== next?.id);
  const week = thisWeek(store).filter((e) => e.id !== next?.id);
  const followedIds = new Set(store.tickers.map((t) => t.id));
  const followedMacros = new Set(store.macros.map((m) => m.id));
  const highTape = store.headlines
    .filter(
      (h) =>
        h.impact === "high" &&
        ((h.tickerId && followedIds.has(h.tickerId)) || (h.macroId && followedMacros.has(h.macroId))),
    )
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 3);

  const phaseColor =
    clock.phase === "open"
      ? "var(--color-positive)"
      : clock.phase === "pre" || clock.phase === "after"
        ? "var(--color-warn)"
        : "var(--fg-faint)";

  const empty = store.tickers.length === 0 && store.macros.length === 0;

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-4 flex items-start justify-between pt-1">
        <div>
          <h1 className="text-[34px] font-bold leading-none tracking-tight">Now</h1>
          <p suppressHydrationWarning className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
            <span className="session-dot" style={{ background: phaseColor }} />
            <span className="font-medium text-[var(--fg)]">{clock.label}</span>
            <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
            {clock.detail}
          </p>
        </div>
        <button
          type="button"
          onClick={() => store.push({ name: "settings" })}
          className="pressable mt-1 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </header>

      {empty ? (
        <EmptyHome />
      ) : (
        <>
          {ready.length ? <ScoreStrip events={ready} /> : null}
          {next ? <Hero event={next} /> : <QuietDay />}
          {open.length ? <OpenCalls events={open} /> : null}
          {highTape.length ? <HighTape items={highTape} /> : null}
          {week.length ? (
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-[var(--fg-muted)] uppercase">
                Later this week
              </h2>
              <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
                {week.slice(0, 6).map((e, i) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    store={store}
                    inset
                    last={i === Math.min(week.length, 6) - 1}
                    onOpen={() => store.push({ name: "event", id: e.id })}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyHome() {
  const store = useCatalyst();
  return (
    <EmptyState
      title={EMPTY_COPY.nowTitle}
      body={EMPTY_COPY.nowBody}
      actions={
        <>
          <PrimaryButton onClick={() => store.addTicker("NVDA")}>Follow NVDA</PrimaryButton>
          <SecondaryButton onClick={() => store.setTab("names")}>Search names</SecondaryButton>
        </>
      }
    />
  );
}

function QuietDay() {
  return (
    <div className="rounded-[28px] px-5 py-8 text-center" style={{ background: "var(--bg-card)" }}>
      <p className="text-[20px] font-semibold tracking-tight">Nothing on the tape</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-muted)]">
        No followed print is due. When one lands, it shows up here first.
      </p>
    </div>
  );
}

function Hero({ event }: { event: CatalystEvent }) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const note = entryFor(store, event.id);
  const complete = note ? isEntryComplete(note) : false;
  const cta = complete ? "Edit the call" : note ? "Finish the call" : "Write the call";

  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">Next</p>
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{event.title}</h2>
      <p suppressHydrationWarning className="mt-1 text-[13px] text-[var(--fg-muted)]">
        {kindLabel(event)} · {formatWhen(event.startsAt)}
      </p>
      <p
        suppressHydrationWarning
        className="display-num mt-4 text-[48px] leading-none"
        style={{ color: "var(--fg)" }}
      >
        {countdown(event.startsAt, store.now)}
      </p>
      <div className="mt-5">
        <PrimaryButton onClick={() => store.openSheet({ name: "journal", eventId: event.id })}>
          {cta}
        </PrimaryButton>
      </div>
      {complete ? (
        <p className="mt-3 text-center text-[13px] font-medium" style={{ color: "var(--color-positive)" }}>
          Call in
        </p>
      ) : null}
      <button
        type="button"
        className="mt-1 h-11 w-full text-[15px] font-medium text-[var(--color-accent)]"
        onClick={() => store.push({ name: "event", id: event.id })}
      >
        Event details
      </button>
    </div>
  );
}

function ScoreStrip({ events }: { events: CatalystEvent[] }) {
  const store = useCatalyst();
  return (
    <div className="mb-4 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
      {events.map((ev, i) => {
        const { kicker } = eventLabel(store, ev);
        const print = suggestedPrint(store, ev);
        return (
          <div
            key={ev.id}
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            style={{ boxShadow: i < events.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
          >
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[var(--color-accent)]">Ready to score</p>
              <p className="truncate text-[16px] font-semibold">
                {kicker} · {ev.title}
              </p>
              {print ? (
                <p className="num text-[12px] text-[var(--fg-muted)]">{formatPct(print.movePct)} next session</p>
              ) : null}
            </div>
            <button
              type="button"
              className="pressable h-11 shrink-0 rounded-full px-4 text-[14px] font-semibold fill-accent"
              onClick={() => store.applyPrintScore(ev.id)}
            >
              Score
            </button>
          </div>
        );
      })}
    </div>
  );
}

function OpenCalls({ events }: { events: CatalystEvent[] }) {
  const store = useCatalyst();
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
        Still open
      </h2>
      <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
        {events.slice(0, 4).map((e, i) => {
          const { kicker } = eventLabel(store, e);
          const note = entryFor(store, e.id);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => store.openSheet({ name: "journal", eventId: e.id })}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
              style={{ boxShadow: i < Math.min(events.length, 4) - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold">
                  {kicker} · {e.title}
                </span>
                <span className="text-[12px] text-[var(--fg-muted)]">
                  {note ? "Draft" : "No call"} · {countdown(e.startsAt, store.now)}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold text-[var(--color-accent)]">
                {note ? "Finish" : "Write"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function HighTape({ items }: { items: Headline[] }) {
  const store = useCatalyst();
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">High on the tape</h2>
        <button
          type="button"
          className="text-[13px] font-medium text-[var(--color-accent)]"
          onClick={() => store.push({ name: "news" })}
        >
          See all
        </button>
      </div>
      <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
        {items.map((h, i) => {
          const ticker = store.tickers.find((t) => t.id === h.tickerId);
          const kicker =
            ticker?.symbol ?? store.macros.find((m) => m.id === h.macroId)?.shortName ?? "—";
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => store.openSheet({ name: "article", id: h.id })}
              className="flex w-full gap-3 px-3.5 py-3 text-left"
              style={{ boxShadow: i < items.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
            >
              <span className="mt-1 h-10 w-[3px] shrink-0 rounded-full" style={{ background: "var(--color-negative)" }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] font-semibold">{kicker}</span>
                  <Pill tone="neg">{impactLabel(h.impact)}</Pill>
                  <span className="text-[11px] text-[var(--fg-faint)]">{newsKindLabel(h.kind)}</span>
                </span>
                <span className="mt-1 block text-[15px] font-medium leading-snug">{h.title}</span>
                <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">
                  {h.source} · {ageLabel(h.publishedAt, store.now)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M11 3.5V5.5M11 16.5V18.5M3.5 11H5.5M16.5 11H18.5M5.8 5.8L7.2 7.2M14.8 14.8L16.2 16.2M16.2 5.8L14.8 7.2M7.2 14.8L5.8 16.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
