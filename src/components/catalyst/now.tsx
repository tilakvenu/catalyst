import { useState } from "react";
import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { ageLabel, countdown, formatPct, formatWhen } from "@/lib/catalyst/format";
import { impactCaption, kindLabel as newsKindLabel } from "@/lib/catalyst/impact";
import { typicalSessionPct } from "@/lib/catalyst/scoring";
import { marketClock } from "@/lib/catalyst/session";
import {
  entryFor,
  eventLabel,
  isEntryComplete,
  kindLabel,
  nearest,
  needsCall,
  deskReadyToScore,
  suggestedPrint,
  thisWeek,
} from "@/lib/catalyst/selectors";
import { useCatalyst, type CatalystState } from "@/lib/catalyst/store";
import type { CatalystEvent, Direction, Headline } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { EventRow } from "./event-row";
import { CallComposer } from "./journal";
import { EmptyState, Pill, PrimaryButton, SecondaryButton } from "./ui";

export function NowScreen() {
  const store = useCatalyst();
  const next = nearest(store);
  const clock = marketClock(store.now);
  const ready = deskReadyToScore(store);
  const open = needsCall(store).filter((e) => e.id !== next?.id && !ready.some((r) => r.id === e.id));
  const week = thisWeek(store).filter((e) => e.id !== next?.id && !ready.some((r) => r.id === e.id));
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

  const empty = store.tickers.length === 0 && store.macros.length === 0;
  const briefing = deskBriefing(store, next, ready.length, open.length, highTape.length);

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-4 flex items-start justify-between pt-1">
        <div className="min-w-0">
          <h1 className="text-[34px] font-bold leading-none tracking-tight">Now</h1>
          <p suppressHydrationWarning className="mt-1.5 text-[13px] leading-snug text-[var(--fg-muted)]">
            <span className="session-dot" style={{ background: phaseColor(clock.phase) }} />
            <span className="font-medium text-[var(--fg)]">{clock.label}</span>
            <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
            {briefing}
          </p>
        </div>
        <button
          type="button"
          onClick={() => store.push({ name: "settings" })}
          className="pressable mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
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
          <TickerRail />
          {store.lastScore ? (
            <JustScored />
          ) : ready[0] ? (
            <ScoreHero event={ready[0]} more={ready.length - 1} />
          ) : next ? (
            <CallHero event={next} />
          ) : (
            <QuietDay />
          )}
          {open.length && !store.lastScore && !ready[0] ? <OpenCalls events={open} /> : null}
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

function deskBriefing(
  store: CatalystState,
  next: CatalystEvent | undefined,
  ready: number,
  open: number,
  high: number,
): string {
  if (store.lastScore) return store.lastScore.hit ? "You called it." : "Missed. Next print is waiting.";
  if (ready) return ready === 1 ? "The print is in. Score it." : `${ready} prints to score.`;
  if (next) {
    const note = entryFor(store, next.id);
    const { kicker } = eventLabel(store, next);
    const tape = high ? ` · ${high} high` : "";
    if (note && isEntryComplete(note)) return `${kicker} is locked.${tape}`;
    if (note?.direction) return `${kicker} is a draft. Finish it.`;
    return `${kicker} ${countdown(next.startsAt, store.now)}.`;
  }
  if (open) return `${open} still open this week.`;
  if (high) return `${high} high on the tape.`;
  return "Quiet. The tape is below.";
}

function phaseColor(phase: string) {
  if (phase === "open") return "var(--color-positive)";
  if (phase === "pre" || phase === "after") return "var(--color-warn)";
  return "var(--fg-faint)";
}

function dirLabel(d: Direction | null | undefined) {
  if (d === "up") return "Up";
  if (d === "down") return "Down";
  if (d === "flat") return "Flat";
  return "—";
}

function dirClass(d: Direction | null | undefined) {
  if (d === "up") return "pos";
  if (d === "down") return "neg";
  return "";
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

function TickerRail() {
  const store = useCatalyst();
  if (!store.tickers.length && !store.macros.length) return null;
  return (
    <div className="mb-4 min-w-0 max-w-full overflow-x-auto hide-scroll">
      <div className="flex w-max gap-2 pb-1">
        {store.tickers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => store.push({ name: "ticker", id: t.id })}
            className="pressable flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5"
            style={{ background: "var(--bg-card)" }}
          >
            <span className="text-[14px] font-semibold">{t.symbol}</span>
            {store.headlines.some((h) => h.tickerId === t.id && h.impact === "high") ? (
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-negative)" }} />
            ) : null}
            <span className={cn("num text-[12px] font-medium", t.changePct >= 0 ? "pos" : "neg")}>
              {formatPct(t.changePct)}
            </span>
          </button>
        ))}
        {store.macros.map((m) => {
          const ev = store.events
            .filter((e) => e.macroId === m.id)
            .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
            .find((e) => +new Date(e.startsAt) >= store.now - 30 * 60000);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => (ev ? store.push({ name: "event", id: ev.id }) : store.setTab("names"))}
              className="pressable flex h-11 shrink-0 items-center rounded-full px-3.5"
              style={{ background: "var(--bg-card)" }}
            >
              <span className="text-[14px] font-semibold">{m.shortName}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => store.openSheet({ name: "add" })}
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] font-medium"
          style={{ background: "var(--bg-card)", color: "var(--fg)" }}
          aria-label="Add a name"
        >
          +
        </button>
      </div>
    </div>
  );
}

function JustScored() {
  const store = useCatalyst();
  const result = store.lastScore;
  if (!result) return null;
  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p
        className="text-[12px] font-semibold uppercase tracking-wider"
        style={{ color: result.hit ? "var(--color-positive)" : "var(--color-negative)" }}
      >
        {result.hit ? "Called" : "Missed"}
      </p>
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{result.kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{result.title}</h2>
      <p className="mt-4 text-[15px]">
        You: <span className={cn("font-semibold", dirClass(result.predicted))}>{dirLabel(result.predicted)}</span>
        <span className="mx-2 text-[var(--fg-faint)]">·</span>
        Tape:{" "}
        <span className={cn("font-semibold", dirClass(result.actual))}>
          {formatPct(result.movePct)} {dirLabel(result.actual)}
        </span>
      </p>
      <div className="mt-5">
        <PrimaryButton onClick={() => store.dismissLastScore()}>Next</PrimaryButton>
      </div>
    </div>
  );
}

function ScoreHero({ event, more }: { event: CatalystEvent; more: number }) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const note = entryFor(store, event.id);
  const print = suggestedPrint(store, event);
  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">The print is in</p>
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{event.title}</h2>
      {note?.direction ? (
        <p className="mt-3 text-[15px]">
          You called{" "}
          <span className={cn("font-semibold", dirClass(note.direction))}>{dirLabel(note.direction)}</span>
          {note.conviction ? <span className="text-[var(--fg-muted)]"> · {note.conviction}</span> : null}
        </p>
      ) : null}
      {print ? (
        <p className={cn("num mt-1 text-[15px] font-medium", dirClass(print.direction))}>
          {formatPct(print.movePct)} next session
        </p>
      ) : null}
      <div className="mt-5">
        <PrimaryButton onClick={() => store.applyPrintScore(event.id)}>Score this call</PrimaryButton>
      </div>
      {more > 0 ? (
        <p className="mt-3 text-center text-[13px] text-[var(--fg-muted)]">
          {more} more {more === 1 ? "print" : "prints"} after this
        </p>
      ) : null}
    </div>
  );
}

function CallHero({ event }: { event: CatalystEvent }) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const note = entryFor(store, event.id);
  const complete = note ? isEntryComplete(note) : false;
  const [editing, setEditing] = useState(false);
  const showPad = !complete || editing;
  const typical = event.tickerId ? typicalSessionPct(store.sparks[event.tickerId]?.["1M"] ?? []) : null;
  const street = event.consensus?.slice(0, 3) ?? [];

  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">Next</p>
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{event.title}</h2>
      <p suppressHydrationWarning className="mt-1 text-[13px] text-[var(--fg-muted)]">
        {kindLabel(event)} · {formatWhen(event.startsAt)}
        {event.confirmed ? "" : " · Est."}
      </p>
      <p suppressHydrationWarning className="display-num mt-4 text-[48px] leading-none" style={{ color: "var(--fg)" }}>
        {countdown(event.startsAt, store.now)}
      </p>
      {street.length ? (
        <dl className="mt-4 overflow-hidden rounded-[16px]" style={{ background: "var(--bg-elevated)" }}>
          {street.map((row, i) => (
            <div
              key={row.metric}
              className="flex items-baseline justify-between gap-3 px-3.5 py-2.5"
              style={{ boxShadow: i < street.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
            >
              <dt className="min-w-0 truncate text-[12px] text-[var(--fg-muted)]">{row.metric}</dt>
              <dd className="num shrink-0 text-[13px] font-semibold">
                {row.consensus}
                <span className="ml-2 font-medium text-[var(--fg-faint)]">prior {row.prior}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {typical != null ? (
        <p className="mt-2 text-[12px] text-[var(--fg-muted)]">Typical session ±{typical.toFixed(1)}%</p>
      ) : null}
      {event.consensusSource ? (
        <p className="mt-1 text-[11px] text-[var(--fg-faint)]">{event.consensusSource}</p>
      ) : null}

      {showPad ? (
        <div className="mt-5">
          <CallComposer eventId={event.id} layout="inline" onLock={() => setEditing(false)} />
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-center text-[15px] font-medium" style={{ color: "var(--color-positive)" }}>
            Call in · {dirLabel(note?.direction)}
            {note?.conviction ? ` · ${note.conviction}` : ""}
          </p>
          {note?.reasoning ? (
            <p className="mt-2 text-center text-[13px] leading-snug text-[var(--fg-muted)]">{note.reasoning}</p>
          ) : null}
          <button
            type="button"
            className="mt-2 h-11 w-full text-[15px] font-medium text-[var(--color-accent)]"
            onClick={() => setEditing(true)}
          >
            Edit the call
          </button>
          <button
            type="button"
            className="h-11 w-full text-[15px] font-medium text-[var(--color-accent)]"
            onClick={() => store.push({ name: "event", id: event.id })}
          >
            Event details
          </button>
        </div>
      )}
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
          onClick={() => store.setTab("news")}
        >
          See all
        </button>
      </div>
      <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
        {items.map((h, i) => {
          const ticker = store.tickers.find((t) => t.id === h.tickerId);
          const kicker = ticker?.symbol ?? store.macros.find((m) => m.id === h.macroId)?.shortName ?? "—";
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
                  <Pill tone="neg">{impactCaption(h.impact)}</Pill>
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
