import { useEffect, useState } from "react";
import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { countdown, firstSentence, formatPct, formatWhen, sessionLabel } from "@/lib/catalyst/format";
import { impactLabel, kindLabel as newsKindLabel } from "@/lib/catalyst/impact";
import { EventBead } from "./mark";
import { flatBandPct } from "@/lib/catalyst/scoring";
import { marketClock } from "@/lib/catalyst/session";
import {
  deskHero,
  entryFor,
  eventLabel,
  isEntryComplete,
  kindLabel,
  lastSimilarEvent,
  missingFields,
  oldestIncomplete,
  pendingCount,
  setupHeadline,
  suggestedPrint,
  typicalFor,
  thisWeek,
} from "@/lib/catalyst/selectors";
import { useCatalyst, type CatalystState } from "@/lib/catalyst/store";
import type { CatalystEvent, Direction } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { EventRow } from "./event-row";
import { CallComposer } from "./journal";
import { EmptyState, Pill, PrimaryButton, SecondaryButton } from "./ui";

export function NowScreen() {
  const store = useCatalyst();
  const hero = deskHero(store);
  const clock = marketClock(store.now);
  const pending = pendingCount(store);
  const oldest = oldestIncomplete(store);
  const heroId = hero.kind === "quiet" ? "" : hero.event.id;
  const week = thisWeek(store).filter((e) => e.id !== heroId);
  const empty = store.tickers.length === 0 && store.macros.length === 0;
  const material = materialDeskLine(store, hero.kind === "quiet" ? undefined : hero.event);

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-4 flex items-start justify-between pt-1">
        <div className="min-w-0">
          <h1 className="text-[34px] font-bold leading-none tracking-tight">Desk</h1>
          <p suppressHydrationWarning className="mt-1.5 text-[13px] leading-snug text-[var(--fg-muted)]">
            <span className="session-dot" style={{ background: phaseColor(clock.phase) }} />
            <span className="font-medium text-[var(--fg)]">{clock.label}</span>
            <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
            {deskLine(store, hero)}
          </p>
        </div>
        <div className="mt-1 flex shrink-0 items-center gap-1">
          <HeaderBtn label="Watch" onClick={() => store.push({ name: "names" })}>
            <ListIcon />
          </HeaderBtn>
          <HeaderBtn label="Tape" onClick={() => store.push({ name: "news" })}>
            <NewsIcon />
          </HeaderBtn>
          <HeaderBtn label="Settings" onClick={() => store.push({ name: "settings" })}>
            <GearIcon />
          </HeaderBtn>
        </div>
      </header>

      {empty ? (
        <EmptyHome />
      ) : (
        <>
          {hero.kind === "result" ? (
            <ResultHero event={hero.event} />
          ) : hero.kind === "call" ? (
            <CallHero event={hero.event} />
          ) : (
            <QuietDay />
          )}

          {pending > 0 ? (
            <button
              type="button"
              className="mt-4 w-full rounded-[18px] px-4 py-3 text-left"
              style={{ background: "var(--bg-card)" }}
              onClick={() => {
                if (!oldest) return;
                store.openSheet({ name: "journal", eventId: oldest.eventId });
              }}
            >
              <p className="text-[14px] font-medium">
                {pending} {pending === 1 ? "call" : "calls"} unfinished. They cannot score yet.
              </p>
              {oldest ? (
                <p className="mt-0.5 text-[12px] text-[var(--fg-muted)]">
                  Continue at {missingFields(oldest)[0] ?? "the next field"}.
                </p>
              ) : null}
            </button>
          ) : null}

          {material ? (
            <button
              type="button"
              onClick={() => store.openSheet({ name: "article", id: material.id })}
              className="mt-3 flex w-full items-center gap-2 rounded-[18px] px-4 py-3 text-left"
              style={{ background: "var(--bg-card)" }}
            >
              <span className="text-[12px] font-semibold text-[var(--color-accent)]">Material</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{material.title}</span>
            </button>
          ) : null}

          {week.length ? (
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-[var(--fg-muted)] uppercase">
                Later catalysts
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

function HeaderBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex h-11 w-11 items-center justify-center rounded-full"
      style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function deskLine(store: CatalystState, hero: ReturnType<typeof deskHero>): string {
  if (hero.kind === "result") return "Result ready.";
  if (hero.kind === "call") {
    const { kicker } = eventLabel(store, hero.event);
    return `${kicker} needs a call.`;
  }
  return "Nothing requires action.";
}

function materialDeskLine(store: CatalystState, current?: CatalystEvent) {
  const followedIds = new Set(store.tickers.map((t) => t.id));
  const followedMacros = new Set(store.macros.map((m) => m.id));
  return store.headlines
    .filter(
      (h) =>
        h.impact === "high" &&
        ((h.tickerId && followedIds.has(h.tickerId)) || (h.macroId && followedMacros.has(h.macroId))) &&
        (!current || (current.tickerId ? h.tickerId !== current.tickerId : h.macroId !== current.macroId)),
    )
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))[0];
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
          <SecondaryButton onClick={() => store.push({ name: "names" })}>Search names</SecondaryButton>
        </>
      }
    />
  );
}

function QuietDay() {
  return (
    <div className="rounded-[28px] px-5 py-8 text-center" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">Quiet</p>
      <p className="mt-3 text-[20px] font-semibold tracking-tight">Nothing requires action</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-muted)]">
        No followed print needs a call, and nothing is waiting to resolve.
      </p>
    </div>
  );
}

function ResultHero({ event }: { event: CatalystEvent }) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const note = entryFor(store, event.id);
  const print = suggestedPrint(store, event);
  const scored = note?.actualDirection != null;

  useEffect(() => {
    if (!scored && print) store.applyPrintScore(event.id);
  }, [event.id, scored, print]);

  const result = store.lastScore?.eventId === event.id ? store.lastScore : null;
  const hit = result ? result.hit : note?.direction === note?.actualDirection;

  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">Result ready</p>
      <EventBead startsAt={event.startsAt} now={store.now} locked resolved />
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{event.title}</h2>
      {note?.direction ? (
        <p className="mt-3 text-[15px]">
          You called{" "}
          <span className={cn("font-semibold", dirClass(note.direction))}>{dirLabel(note.direction)}</span>
          {note.conviction ? <span className="text-[var(--fg-muted)]"> · {note.conviction}/5</span> : null}
        </p>
      ) : null}
      {(result || note?.actualMovePct != null) && (
        <p className={cn("num mt-1 text-[15px] font-medium", dirClass(result?.actual ?? note?.actualDirection))}>
          {formatPct(result?.movePct ?? note?.actualMovePct ?? 0)} · {dirLabel(result?.actual ?? note?.actualDirection)}
        </p>
      )}
      <p
        className="mt-3 text-[15px] font-semibold"
        style={{ color: hit ? "var(--color-positive)" : "var(--color-negative)" }}
      >
        {hit ? "Called it" : "Missed"}
      </p>
      {note?.invalidation ? (
        <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">
          You said: “{note.invalidation}”
          <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">
            {note.actualFigure ?? "Manual review needed"} · Invalidation: manual review needed
          </span>
        </p>
      ) : null}
      <div className="mt-5">
        <PrimaryButton
          onClick={() => {
            store.dismissLastScore();
            store.push({ name: "event", id: event.id });
          }}
        >
          Review the call
        </PrimaryButton>
      </div>
    </div>
  );
}

function CallHero({ event }: { event: CatalystEvent }) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const note = entryFor(store, event.id);
  const complete = note ? isEntryComplete(note) && Boolean(note.lockedAt) : false;
  const [editing, setEditing] = useState(false);
  const showPad = !complete || editing;
  const typical = typicalFor(store, event, note?.callTarget);
  const band = typical != null ? flatBandPct(typical) : null;
  const street = event.consensus?.slice(0, 3) ?? [];
  const last = lastSimilarEvent(store, event);
  const lastNote = last ? entryFor(store, last.id) : undefined;
  const setup = setupHeadline(store.headlines, event);
  const prints = event.tickerId ? store.earningsHistory[event.tickerId] ?? [] : [];
  const target = note?.callTarget ? store.tickers.find((t) => t.id === note.callTarget) : undefined;

  return (
    <div className="rounded-[28px] p-5" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
        Make the next call
      </p>
      <EventBead startsAt={event.startsAt} now={store.now} locked={Boolean(note?.lockedAt)} />
      <p className="mt-3 text-[15px] font-semibold tracking-tight">{kicker}</p>
      <h2 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-balance">{event.title}</h2>
      <p suppressHydrationWarning className="mt-1 text-[13px] text-[var(--fg-muted)]">
        {kindLabel(event)} · {formatWhen(event.startsAt)} · {sessionLabel(event.session)}
        {event.confirmed ? "" : " · Est."}
      </p>
      {event.kind === "macro" && target ? (
        <p className="mt-1 text-[13px] text-[var(--fg)]">
          {kicker} · {target.symbol}, next session
        </p>
      ) : null}
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
      {typical != null && band != null ? (
        <p className="mt-2 text-[12px] text-[var(--fg-muted)]">
          Typical session ±{typical.toFixed(1)}% · Flat band ±{band.toFixed(1)}%
        </p>
      ) : null}
      {prints.length ? (
        <p className="mt-2 text-[12px] leading-snug text-[var(--fg-muted)]">
          Last {prints.length} EPS surprises:{" "}
          {prints
            .slice(0, 4)
            .map((p) => (p.surprisePct == null ? "—" : `${p.surprisePct > 0 ? "+" : ""}${p.surprisePct.toFixed(1)}%`))
            .join("  ")}
        </p>
      ) : null}
      {last && lastNote?.actualMovePct != null ? (
        <p className="mt-2 text-[13px] leading-snug text-[var(--fg-muted)]">
          Last comparable print
          <span className={cn("num ml-1.5 font-semibold", lastNote.actualMovePct >= 0 ? "pos" : "neg")}>
            {formatPct(lastNote.actualMovePct)}
          </span>
          {lastNote.actualFigure ? (
            <span className="mt-0.5 block text-[12px]">{firstSentence(lastNote.actualFigure)}</span>
          ) : null}
        </p>
      ) : null}
      {setup ? (
        <button
          type="button"
          onClick={() => store.openSheet({ name: "article", id: setup.id })}
          className="mt-3 flex w-full items-center gap-2 text-left"
        >
          <Pill tone="accent">{impactLabel(setup.impact)}</Pill>
          <span className="min-w-0 flex-1 truncate text-[13px]">{setup.title}</span>
          <span className="text-[11px] text-[var(--fg-faint)]">{newsKindLabel(setup.kind)}</span>
        </button>
      ) : null}

      {showPad ? (
        <div className="mt-5">
          <CallComposer eventId={event.id} layout="inline" onLock={() => setEditing(false)} />
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-center text-[15px] font-medium" style={{ color: "var(--color-positive)" }}>
            Locked · {dirLabel(note?.direction)}
            {note?.conviction ? ` · ${note.conviction}` : ""}
          </p>
          {note?.lockedAt ? (
            <p className="mt-1 text-center text-[12px] text-[var(--fg-faint)]">{formatWhen(note.lockedAt)}</p>
          ) : null}
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

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M5 6H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 11H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 16H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function NewsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="4" y="4.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9H15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12.5H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none" aria-hidden>
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
