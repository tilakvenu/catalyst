// C67 ticker.tsx TickerScreen. The backend has no quotes, price history, metrics or analyst data yet
// (live data is deferred), so the price block becomes a plain "No quote yet" line.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { countdown, formatPct, formatWhen } from "../../../../src/lib/catalyst/format.ts";
import { entryFor, isUrgent, kindLabel, pastFollowed, upcomingFollowed } from "../../../../src/lib/catalyst/selectors.ts";
import type { PastFilter } from "../../../../src/lib/catalyst/types.ts";
import { addWatch } from "../../data";
import { Card, Press, PrimaryButton, PushScreen, Segmented, SectionTitle, TABULAR, tight, useC } from "../../ui/kit";
import { HeadlineRow, openEvent, openJournal } from "../../ui/parts";
import { useSlice } from "../../ui/slice";

export default function TickerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useC();
  const s = useSlice();
  const [past, setPast] = useState<PastFilter>("all");
  const [busy, setBusy] = useState(false);
  const ticker = s.allTickers[id];
  const watched = s.tickers.find((t) => t.id === id);

  if (!ticker) {
    return (
      <PushScreen title="Missing">
        <Text style={{ color: c.muted, fontSize: 15, marginTop: 8 }}>That ticker is not on this device.</Text>
      </PushScreen>
    );
  }

  const next = upcomingFollowed(s).find((e) => e.tickerId === id) ?? s.events.filter((e) => e.tickerId === id && Date.parse(e.startsAt) >= s.now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const headlines = s.headlines.filter((h) => h.tickerId === id).sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const history = (watched ? pastFollowed(s) : s.events.filter((e) => Date.parse(e.startsAt) < s.now - 30 * 60000).sort((a, b) => b.startsAt.localeCompare(a.startsAt))).filter((e) => e.tickerId === id);
  const filtered = history.filter((e) => (past === "earnings" ? e.kind === "earnings" : past === "notes" ? Boolean(entryFor(s, e.id)?.text) : true));
  const urgent = next ? isUrgent(next.startsAt, s.now) : false;

  return (
    <PushScreen>
      <Text style={{ color: c.muted, fontSize: 13 }}>{ticker.company}</Text>
      <Text style={{ color: c.fg, fontSize: 34, fontWeight: "700", letterSpacing: tight(34) }}>{ticker.symbol}</Text>
      <Text style={{ color: c.faint, fontSize: 15, marginTop: 4 }}>No quote yet</Text>
      <Text style={{ color: c.faint, fontSize: 11, marginTop: 4 }}>
        {watched ? `On your watchlist${watched.held ? " · Held" : ""}${watched.muted ? " · Muted" : ""}` : "Not on your watchlist"} · Prices arrive with live data
      </Text>
      {!watched ? (
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            busy={busy}
            onPress={async () => {
              setBusy(true);
              await addWatch({ tickerId: id }).catch(() => {});
              setBusy(false);
            }}
          >
            Follow {ticker.symbol}
          </PrimaryButton>
        </View>
      ) : null}

      {next ? (
        <View style={{ marginTop: 20, borderRadius: 22, padding: 16, backgroundColor: c.card, borderWidth: urgent ? 1.5 : 0.5, borderColor: urgent ? c.accent : c.hairline }}>
          <Press onPress={() => openEvent(next.id)}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: c.faint, fontSize: 11, fontWeight: "500", letterSpacing: 0.55, textTransform: "uppercase" }}>Next event</Text>
                <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600", marginTop: 4 }}>{next.title}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {kindLabel(next)} · {formatWhen(next.startsAt, s.now)}
                </Text>
              </View>
              <Text style={[{ color: urgent ? c.accent : c.fg, fontSize: 13, fontWeight: "500" }, TABULAR]}>{countdown(next.startsAt, s.now)}</Text>
            </View>
          </Press>
          <Press onPress={() => openJournal(next.id)} style={{ marginTop: 12, height: 40, borderRadius: 12, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: c.accentInk, fontSize: 14, fontWeight: "600" }}>Write the call</Text>
          </Press>
        </View>
      ) : null}

      <SectionTitle
        style={{ marginTop: 24 }}
        right={
          <Press onPress={() => router.push({ pathname: "/headlines", params: { tickerId: id } })}>
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: "500" }}>See all</Text>
          </Press>
        }
      >
        Recent headlines
      </SectionTitle>
      <Card>
        {headlines.slice(0, 3).map((h, i) => (
          <HeadlineRow key={h.id} h={h} now={s.now} compact last={i === Math.min(headlines.length, 3) - 1} />
        ))}
        {headlines.length === 0 ? <Text style={{ color: c.faint, fontSize: 13, paddingHorizontal: 14, paddingVertical: 16 }}>No headlines yet.</Text> : null}
      </Card>

      <SectionTitle style={{ marginTop: 24 }}>Past events</SectionTitle>
      <Segmented
        value={past}
        onChange={setPast}
        options={[
          { id: "all", label: "All" },
          { id: "earnings", label: "Earnings" },
          { id: "notes", label: "With notes" },
        ]}
      />
      <View style={{ marginTop: 8, gap: 8 }}>
        {filtered.map((e) => {
          const note = entryFor(s, e.id);
          return (
            <Press key={e.id} onPress={() => openEvent(e.id)} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.card }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>{e.title}</Text>
                {note?.actualMovePct != null ? (
                  <Text style={[{ color: note.actualMovePct >= 0 ? c.positive : c.negative, fontSize: 13, fontWeight: "500" }, TABULAR]}>{formatPct(note.actualMovePct)}</Text>
                ) : null}
              </View>
              <Text style={{ color: c.faint, fontSize: 12 }}>{formatWhen(e.startsAt, s.now)}</Text>
              <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>{note?.text ? note.text : "No note recorded"}</Text>
            </Press>
          );
        })}
        {filtered.length === 0 ? <Text style={{ color: c.faint, fontSize: 13, paddingVertical: 16 }}>No matching past events.</Text> : null}
      </View>
    </PushScreen>
  );
}
