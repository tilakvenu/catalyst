// C67 watchlist.tsx WatchlistScreen (push from the Catalyst toolbar). held / muted are per user.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { countdown } from "../../../src/lib/catalyst/format.ts";
import { materialChangeCount, thisWeek, upcomingFollowed } from "../../../src/lib/catalyst/selectors.ts";
import type { WatchFilter } from "../../../src/lib/catalyst/types.ts";
import { addWatch, removeWatch, setHeld, setMuted } from "../data";
import { Chip, EmptyState, Pill, Press, PrimaryButton, PushScreen, R, SecondaryButton, TABULAR, useC } from "../ui/kit";
import { openEvent, openTicker } from "../ui/parts";
import { SwipeRow } from "../ui/SwipeRow";
import { useSlice } from "../ui/slice";

export default function WatchScreen() {
  const c = useC();
  const s = useSlice();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<WatchFilter>("all");
  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<unknown>) => {
    setError(null);
    p.catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const held = s.tickers.filter((t) => t.held).length;
  const searching = q.trim().length > 0;
  const week = thisWeek(s);
  const rows = useMemo(() => {
    if (filter === "held") return s.tickers.filter((t) => t.held);
    if (filter === "macro") return s.macros;
    return [...s.tickers, ...s.macros];
  }, [filter, s.tickers, s.macros]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return Object.values(s.allTickers)
      .filter((h) => h.symbol.toLowerCase().includes(needle) || h.company.toLowerCase().includes(needle))
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .slice(0, 8);
  }, [q, s.allTickers]);

  return (
    <PushScreen
      title="Watch"
      trailing={
        <Press label="Add" onPress={() => router.push("/add")} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 4, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: c.accentInk, fontSize: 22, fontWeight: "500", marginTop: -2 }}>+</Text>
        </Press>
      }
    >
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search ticker or event"
        placeholderTextColor={c.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ height: 44, borderRadius: R.btn, paddingHorizontal: 14, fontSize: 16, color: c.fg, backgroundColor: c.elevated, marginBottom: 12 }}
      />
      {error ? <Text style={{ color: c.warn, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}

      {searching ? (
        <View>
          <View style={{ gap: 4 }}>
            {hits.map((h) => {
              const watched = s.tickers.some((t) => t.id === h.id);
              return (
                <View key={h.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: c.card }}>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{h.symbol}</Text>
                    <Text style={{ color: c.muted, fontSize: 13 }}>{h.company}</Text>
                  </View>
                  {watched ? (
                    <Pill>On watchlist</Pill>
                  ) : (
                    <Press onPress={() => run(addWatch({ tickerId: h.id }))} style={{ height: 36, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: c.accent }}>
                      <Text style={{ color: c.accentInk, fontSize: 13, fontWeight: "600" }}>Add</Text>
                    </Press>
                  )}
                </View>
              );
            })}
            {hits.length === 0 ? <Text style={{ color: c.muted, fontSize: 14, paddingHorizontal: 4, paddingVertical: 24 }}>No matches in the names Catalyst tracks.</Text> : null}
          </View>
          <Text style={{ color: c.faint, fontSize: 12, lineHeight: 19, marginTop: 16, paddingHorizontal: 4 }}>
            Search covers the {Object.keys(s.allTickers).length} US-listed names Catalyst tracks so far. Macro releases are under Follow macro events.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
            {(
              [
                ["all", "All", s.tickers.length + s.macros.length],
                ["held", "Held", held],
                ["macro", "Macro", s.macros.length],
              ] as const
            ).map(([id, label, count]) => (
              <Chip key={id} accent on={filter === id} onPress={() => setFilter(id)} label={`${label} ${count}`} />
            ))}
          </View>
          {week.length ? (
            <Text style={{ color: c.muted, fontSize: 12, paddingHorizontal: 4, marginBottom: 12 }}>
              {week.length} {week.length === 1 ? "print" : "prints"} this week
            </Text>
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="Nothing on the watchlist"
              body="Add a US-listed equity or ETF, or follow a macro release as a first-class event."
              actions={
                <>
                  <PrimaryButton onPress={() => router.push("/add")}>Add a ticker</PrimaryButton>
                  <SecondaryButton onPress={() => router.push("/macro")}>Follow macro events</SecondaryButton>
                </>
              }
            />
          ) : (
            <View style={{ gap: 8 }}>
              {rows.map((row) => {
                const isMacro = row.kind === "macro";
                const next = upcomingFollowed(s).find((e) => (isMacro ? e.macroId === row.id : e.tickerId === row.id));
                const material = isMacro ? materialChangeCount(s.headlines, undefined, row.id) : materialChangeCount(s.headlines, row.id);
                const t = isMacro ? undefined : s.tickers.find((x) => x.id === row.id);
                return (
                  <SwipeRow
                    key={row.id}
                    open={openSwipe === row.id}
                    onToggle={() => setOpenSwipe(openSwipe === row.id ? null : row.id)}
                    onOpen={() => {
                      if (!isMacro) openTicker(row.id);
                      else if (next) openEvent(next.id);
                    }}
                    actions={[
                      ...(t ? [{ label: t.held ? "Not held" : "Held", onPress: () => run(setHeld(t.watchItemId, !t.held)) }] : []),
                      { label: row.muted ? "Unmute" : "Mute", onPress: () => run(setMuted(row.watchItemId, !row.muted)) },
                      { label: "Remove", tone: "neg" as const, onPress: () => run(removeWatch(row.watchItemId)) },
                    ]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14 }}>
                      <View style={{ flexShrink: 1 }}>
                        {isMacro ? (
                          <>
                            <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{row.shortName}</Text>
                            <Text style={{ color: c.muted, fontSize: 13 }}>{row.name}</Text>
                          </>
                        ) : (
                          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                            <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{t!.symbol}</Text>
                            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, flexShrink: 1 }}>{t!.company}</Text>
                          </View>
                        )}
                        <Text style={{ color: c.faint, fontSize: 12, marginTop: 4 }}>
                          {next ? `${next.title} · ${countdown(next.startsAt, s.now)}` : "No upcoming event"}
                          {row.muted ? " · Muted" : ""}
                        </Text>
                        {material ? (
                          <Text style={{ color: c.accent, fontSize: 12, marginTop: 4 }}>
                            {material} material {material === 1 ? "change" : "changes"}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {t?.held ? <Text style={{ color: c.accent, fontSize: 12, fontWeight: "600" }}>Held</Text> : null}
                        <Text style={[{ color: c.faint, fontSize: 13 }, TABULAR]}>{isMacro ? "Macro" : "No quote"}</Text>
                      </View>
                    </View>
                  </SwipeRow>
                );
              })}
            </View>
          )}
          {rows.length ? <Text style={{ color: c.faint, fontSize: 11, marginTop: 12, paddingHorizontal: 4 }}>Swipe left or long-press a row to mute, remove, or mark held.</Text> : null}
        </>
      )}
    </PushScreen>
  );
}
