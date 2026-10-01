// C67 calendar-tab.tsx: Month / Week, trading-day dimming, call-state dots, event heat, day list.
// Reads the cache. Only paging to a month outside the last sync window asks the server (useCalendar).
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  callStateLabel,
  dateDotState,
  eventsOnDay,
  heatAlpha,
  isTradingDay,
  monthGrid,
  nyDateKey,
  nyParts,
  sessionCode,
  weekStrip,
  type DateDotState,
} from "../../../../src/lib/catalyst/cal-view.ts";
import { entryFor, isFollowedEvent } from "../../../../src/lib/catalyst/selectors.ts";
import type { CatalystEvent } from "../../../../src/lib/catalyst/types.ts";
import { useCalendar } from "../../data";
import { alpha, type ThemeColors } from "../../theme";
import { Card, Divider, LargeTitle, Press, Segmented, SectionTitle, TabScreen, tight, useC } from "../../ui/kit";
import { openEvent } from "../../ui/parts";
import { labelOf, useSlice, type Slice } from "../../ui/slice";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const dotColor = (c: ThemeColors, s: DateDotState) =>
  ({ "needs-call": c.accent, handled: c.muted, called: c.positive, missed: c.negative, pending: c.warn })[s];

const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** Mounted only after the user pages; asks for that month if the last sync did not cover it. */
function MonthFetcher({ month, onStatus }: { month: string; onStatus: (s: string | null) => void }) {
  const view = useCalendar(month);
  useEffect(() => {
    onStatus(view.status === "loading" ? "Loading this month…" : view.status === "error" ? `Could not load this month. ${view.error ?? ""}` : null);
  }, [view.status, view.error, onStatus]);
  return null;
}

export default function CalendarTab() {
  const c = useC();
  const s = useSlice();
  const today = nyParts(s.now);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [paged, setPaged] = useState(false);
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedKey, setSelectedKey] = useState(() => nyDateKey(s.now));
  const [status, setStatus] = useState<string | null>(null);

  const followed = useMemo(() => s.events.filter((e) => isFollowedEvent(s, e)), [s.events, s.tickers, s.macros]);

  const cells = monthGrid(year, month);
  const selectedMs = keyToMs(selectedKey);
  const week = weekStrip(selectedMs);
  const selectedEvents = eventsOnDay(followed, selectedMs).sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const monthLabel = new Date(Date.UTC(year, month - 1, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
    setPaged(true);
  }

  function pick(ms: number) {
    setSelectedKey(nyDateKey(ms));
    const p = nyParts(ms);
    if (p.year !== year || p.month !== month) setPaged(true);
    setYear(p.year);
    setMonth(p.month);
  }

  return (
    <TabScreen>
      {paged ? <MonthFetcher month={monthKey(year, month)} onStatus={setStatus} /> : null}
      <LargeTitle>Calendar</LargeTitle>
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
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
            <Press label="Previous month" onPress={() => shiftMonth(-1)} style={{ height: 44, paddingHorizontal: 8, justifyContent: "center" }}>
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>‹</Text>
            </Press>
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: "600", letterSpacing: tight(17) }}>{monthLabel}</Text>
            <Press label="Next month" onPress={() => shiftMonth(1)} style={{ height: 44, paddingHorizontal: 8, justifyContent: "center" }}>
              <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>›</Text>
            </Press>
          </View>
          <View style={{ marginTop: 8, flexDirection: "row" }}>
            {WEEKDAYS.map((d, i) => (
              <Text key={`${d}${i}`} style={{ width: `${100 / 7}%`, textAlign: "center", color: c.faint, fontSize: 11, fontWeight: "500", paddingVertical: 4 }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((cell) => (
              <DayCell key={nyDateKey(cell.ms) + String(cell.inMonth)} s={s} ms={cell.ms} events={followed} dimOutside={!cell.inMonth} selectedKey={selectedKey} onPick={pick} minHeight={52} />
            ))}
          </View>
          {status ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 6, paddingHorizontal: 4 }}>{status}</Text> : null}
        </>
      ) : (
        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap" }}>
          {week.map((ms) => (
            <DayCell key={nyDateKey(ms)} s={s} ms={ms} events={followed} selectedKey={selectedKey} onPick={pick} minHeight={72} weekday />
          ))}
        </View>
      )}

      <Legend />

      <View style={{ marginTop: 16 }}>
        <SectionTitle>{formatDayHead(selectedMs)}</SectionTitle>
        {selectedEvents.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 14, textAlign: "center", paddingVertical: 24 }}>Nothing prints this day.</Text>
        ) : (
          <Card>
            {selectedEvents.map((event, i) => (
              <CalendarEventRow key={event.id} s={s} event={event} last={i === selectedEvents.length - 1} />
            ))}
          </Card>
        )}
      </View>
    </TabScreen>
  );
}

function DayCell({ s, ms, events, dimOutside, selectedKey, onPick, minHeight, weekday }: { s: Slice; ms: number; events: CatalystEvent[]; dimOutside?: boolean; selectedKey: string; onPick: (ms: number) => void; minHeight: number; weekday?: boolean }) {
  const c = useC();
  const key = nyDateKey(ms);
  const dayEvents = eventsOnDay(events, ms);
  const trading = isTradingDay(ms);
  const heat = heatAlpha(dayEvents.length, trading);
  const isToday = key === nyDateKey(s.now);
  const selected = key === selectedKey;
  const p = nyParts(ms);
  const bg = !trading ? alpha(c.fg, 0.04) : heat ? alpha(c.fg, heat) : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${key}${dayEvents.length ? `, ${dayEvents.length} event${dayEvents.length > 1 ? "s" : ""}` : ""}${trading ? "" : ", market closed"}`}
      onPress={() => onPick(ms)}
      style={{ width: `${100 / 7}%`, minHeight, alignItems: "center", paddingVertical: weekday ? 8 : 4, backgroundColor: bg, opacity: dimOutside ? 0.38 : 1 }}
    >
      {weekday ? <Text style={{ color: c.faint, fontSize: 10, fontWeight: "500" }}>{WEEKDAYS[new Date(ms).getUTCDay()]}</Text> : null}
      <View
        style={[
          { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: weekday ? 4 : 0 },
          isToday ? { backgroundColor: c.accent } : selected ? { borderWidth: 1.5, borderColor: c.fg } : null,
        ]}
      >
        <Text style={{ fontSize: 15, fontWeight: weekday ? "600" : "500", color: isToday ? c.accentInk : !trading ? c.faint : c.fg }}>{p.day}</Text>
      </View>
      <DotRow s={s} events={dayEvents} />
    </Pressable>
  );
}

function DotRow({ s, events }: { s: Slice; events: CatalystEvent[] }) {
  const c = useC();
  const states = events.map((event) => dateDotState({ event, entry: entryFor(s, event.id) ?? undefined, now: s.now }));
  if (!states.length) return <View style={{ height: 6, marginTop: 4 }} />;
  const shown = states.length > 3 ? states.slice(0, 2) : states;
  const extra = states.length > 3 ? states.length - 2 : 0;
  return (
    <View style={{ marginTop: 4, height: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 }}>
      {shown.map((st, i) => (
        <View key={`${st}${i}`} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: dotColor(c, st) }} />
      ))}
      {extra ? <Text style={{ color: c.muted, fontSize: 8, lineHeight: 8 }}>+{extra}</Text> : null}
    </View>
  );
}

function Legend() {
  const c = useC();
  const items: [DateDotState, string][] = [
    ["needs-call", "Needs a call"],
    ["handled", "Locked"],
    ["called", "Called"],
    ["missed", "Missed"],
    ["pending", "Pending"],
  ];
  return (
    <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
      <Text style={{ color: c.faint, fontSize: 11 }}>Darker = more events · shaded = market closed</Text>
      <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
        {items.map(([st, label]) => (
          <View key={st} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor(c, st) }} />
            <Text style={{ color: c.faint, fontSize: 11 }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CalendarEventRow({ s, event, last }: { s: Slice; event: CatalystEvent; last: boolean }) {
  const c = useC();
  const { kicker } = labelOf(s, event);
  const state = callStateLabel({ event, entry: entryFor(s, event.id) ?? undefined, now: s.now });
  return (
    <View>
      <Press onPress={() => openEvent(event.id)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{kicker}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>{sessionCode(event.session)}</Text>
        </View>
        <Text style={{ color: c.fg, fontSize: 14, lineHeight: 19, marginTop: 2 }}>{event.title}</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{state}</Text>
      </Press>
      {!last ? <Divider /> : null}
    </View>
  );
}

function keyToMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 16, 0, 0);
}

function formatDayHead(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" });
}
