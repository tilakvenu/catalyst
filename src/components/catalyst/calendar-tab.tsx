import { useMemo, useState } from "react";
import {
  callStateLabel,
  dateDotState,
  DOT_COLOR,
  eventsOnDay,
  heatAlpha,
  isTradingDay,
  monthGrid,
  nyDateKey,
  nyParts,
  sessionCode,
  weekStrip,
} from "@/lib/catalyst/cal-view";
import { entryFor, eventLabel, isFollowedEvent } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { CatalystEvent } from "@/lib/catalyst/types";
import { Segmented } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarScreen() {
  const store = useCatalyst();
  const today = nyParts(store.now);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedKey, setSelectedKey] = useState(() => nyDateKey(store.now));

  const followed = useMemo(
    () => store.events.filter((e) => isFollowedEvent(store, e)),
    [store.events, store.tickers, store.macros],
  );

  const cells = monthGrid(year, month);
  const selectedMs = keyToMs(selectedKey);
  const week = weekStrip(selectedMs);
  const selectedEvents = eventsOnDay(followed, selectedMs).sort(
    (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
  );

  const monthLabel = new Date(Date.UTC(year, month - 1, 15)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
  }

  function pick(ms: number) {
    const key = nyDateKey(ms);
    setSelectedKey(key);
    const p = nyParts(ms);
    setYear(p.year);
    setMonth(p.month);
  }

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-3 flex items-end justify-between pt-1">
        <h1 className="text-[34px] font-bold leading-none tracking-tight">Calendar</h1>
      </header>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { id: "month", label: "Month" },
          { id: "week", label: "Week" },
        ]}
      />

      {view === "month" ? (
        <>
          <div className="mt-4 flex items-center justify-between px-1">
            <button
              type="button"
              className="h-11 px-2 text-[15px] font-semibold text-[var(--color-accent)]"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-[17px] font-semibold tracking-tight">{monthLabel}</p>
            <button
              type="button"
              className="h-11 px-2 text-[15px] font-semibold text-[var(--color-accent)]"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <MonthGrid
            cells={cells}
            events={followed}
            now={store.now}
            selectedKey={selectedKey}
            onPick={pick}
          />
          <p className="mt-2 px-1 text-[11px] text-[var(--fg-faint)]">Darker = more events</p>
        </>
      ) : (
        <WeekStrip
          days={week}
          events={followed}
          now={store.now}
          selectedKey={selectedKey}
          onPick={pick}
        />
      )}

      <section className="mt-4">
        <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
          {formatDayHead(selectedMs)}
        </h2>
        {selectedEvents.length === 0 ? (
          <p className="px-1 py-6 text-center text-[14px] text-[var(--fg-muted)]">Nothing prints this day.</p>
        ) : (
          <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
            {selectedEvents.map((event, i) => (
              <CalendarEventRow
                key={event.id}
                event={event}
                last={i === selectedEvents.length - 1}
                onOpen={() => store.push({ name: "event", id: event.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MonthGrid({
  cells,
  events,
  now,
  selectedKey,
  onPick,
}: {
  cells: { ms: number; inMonth: boolean }[];
  events: CatalystEvent[];
  now: number;
  selectedKey: string;
  onPick: (ms: number) => void;
}) {
  const todayKey = nyDateKey(now);
  return (
    <div className="mt-2">
      <div className="grid grid-cols-7 px-0.5">
        {WEEKDAYS.map((d, i) => (
          <div key={`${d}-${i}`} className="py-1 text-center text-[11px] font-medium text-[var(--fg-faint)]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const key = nyDateKey(cell.ms);
          const dayEvents = eventsOnDay(events, cell.ms);
          const trading = isTradingDay(cell.ms);
          const heat = heatAlpha(dayEvents.length, trading);
          const isToday = key === todayKey;
          const selected = key === selectedKey;
          const day = nyParts(cell.ms).day;
          return (
            <button
              key={key + String(cell.inMonth)}
              type="button"
              onClick={() => onPick(cell.ms)}
              className="relative flex min-h-[52px] flex-col items-center px-0.5 py-1"
              style={{
                opacity: cell.inMonth ? 1 : 0.38,
                background: !trading
                  ? "color-mix(in srgb, var(--fg) 4%, transparent)"
                  : heat
                    ? `color-mix(in srgb, var(--fg) ${Math.round(heat * 100)}%, transparent)`
                    : undefined,
              }}
            >
              <span
                className="flex size-7 items-center justify-center text-[15px] font-medium"
                style={
                  isToday
                    ? {
                        background: "var(--color-accent)",
                        color: "var(--color-accent-ink)",
                        borderRadius: 999,
                      }
                    : selected
                      ? {
                          boxShadow: "inset 0 0 0 1.5px var(--fg)",
                          borderRadius: 999,
                        }
                      : !trading
                        ? { color: "var(--fg-faint)" }
                        : undefined
                }
              >
                {day}
              </span>
              <DotRow events={dayEvents} now={now} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekStrip({
  days,
  events,
  now,
  selectedKey,
  onPick,
}: {
  days: number[];
  events: CatalystEvent[];
  now: number;
  selectedKey: string;
  onPick: (ms: number) => void;
}) {
  const todayKey = nyDateKey(now);
  return (
    <div className="mt-4 grid grid-cols-7">
      {days.map((ms) => {
        const key = nyDateKey(ms);
        const p = nyParts(ms);
        const dayEvents = eventsOnDay(events, ms);
        const trading = isTradingDay(ms);
        const heat = heatAlpha(dayEvents.length, trading);
        const isToday = key === todayKey;
        const selected = key === selectedKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(ms)}
            className="flex min-h-[72px] flex-col items-center py-2"
            style={{
              background: !trading
                ? "color-mix(in srgb, var(--fg) 4%, transparent)"
                : heat
                  ? `color-mix(in srgb, var(--fg) ${Math.round(heat * 100)}%, transparent)`
                  : undefined,
            }}
          >
            <span className="text-[10px] font-medium text-[var(--fg-faint)]">{WEEKDAYS[new Date(ms).getUTCDay()]}</span>
            <span
              className="mt-1 flex size-7 items-center justify-center text-[15px] font-semibold"
              style={
                isToday
                  ? {
                      background: "var(--color-accent)",
                      color: "var(--color-accent-ink)",
                      borderRadius: 999,
                    }
                  : selected
                    ? { boxShadow: "inset 0 0 0 1.5px var(--fg)", borderRadius: 999 }
                    : !trading
                      ? { color: "var(--fg-faint)" }
                      : undefined
              }
            >
              {p.day}
            </span>
            <DotRow events={dayEvents} now={now} />
          </button>
        );
      })}
    </div>
  );
}

function DotRow({ events, now }: { events: CatalystEvent[]; now: number }) {
  const store = useCatalyst();
  const states = events.map((event) =>
    dateDotState({ event, entry: entryFor(store, event.id) ?? undefined, now }),
  );
  if (!states.length) return <span className="mt-1 h-1.5" />;
  const shown = states.length > 3 ? states.slice(0, 2) : states;
  const extra = states.length > 3 ? states.length - 2 : 0;
  return (
    <span className="mt-1 flex h-1.5 items-center justify-center gap-0.5">
      {shown.map((s, i) => (
        <span
          key={`${s}-${i}`}
          className="size-1 rounded-full"
          style={{ background: DOT_COLOR[s] }}
          data-dot={s}
        />
      ))}
      {extra ? <span className="text-[8px] leading-none text-[var(--fg-muted)]">+{extra}</span> : null}
    </span>
  );
}

function CalendarEventRow({
  event,
  last,
  onOpen,
}: {
  event: CatalystEvent;
  last: boolean;
  onOpen: () => void;
}) {
  const store = useCatalyst();
  const { kicker } = eventLabel(store, event);
  const entry = entryFor(store, event.id);
  const state = callStateLabel({ event, entry: entry ?? undefined, now: store.now });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col px-3.5 py-3 text-left"
      style={{ boxShadow: last ? undefined : "inset 0 -0.5px 0 var(--hairline)" }}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[16px] font-semibold">{kicker}</span>
        <span className="text-[12px] text-[var(--fg-muted)]">{sessionCode(event.session)}</span>
      </span>
      <span className="mt-0.5 text-[14px] leading-snug text-[var(--fg)]">{event.title}</span>
      <span className="mt-1 text-[12px] text-[var(--fg-muted)]">{state}</span>
    </button>
  );
}

function keyToMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 16, 0, 0);
}

function formatDayHead(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "America/New_York",
  });
}
