// C67 review.tsx: what your history says about your judgment. Computed on the phone from cached calls
// with scoring.ts (zero requests); nothing computed is stored on the server.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { EMPTY_COPY } from "../../ui/copy";
import { formatPct, formatWhen } from "../../../../src/lib/catalyst/format.ts";
import {
  CALIBRATION_MIN_BAND,
  CALIBRATION_MIN_OVERALL,
  calibrationCopy,
  capturedMove,
  convictionBands,
  isCalibrationScored,
  isPreC67Scored,
  isUnresolvable,
  rollingAccuracy,
} from "../../../../src/lib/catalyst/scoring.ts";
import { isPending, isScored, kindLabel, missingFields } from "../../../../src/lib/catalyst/selectors.ts";
import type { JournalEntry } from "../../../../src/lib/catalyst/types.ts";
import { router } from "expo-router";
import { Card, EmptyState, LargeTitle, Pill, Press, PrimaryButton, SectionTitle, TabScreen, TABULAR, useC, wide } from "../../ui/kit";
import { AccuracyChart, Dropdown, openEvent, openJournal } from "../../ui/parts";
import { labelOf, useSlice } from "../../ui/slice";

export default function RecordTab() {
  const c = useC();
  const s = useSlice();
  const [tickerF, setTickerF] = useState("all");
  const [kindF, setKindF] = useState("all");
  const [convF, setConvF] = useState("all");

  const nameOptions = useMemo(() => {
    const ids = new Set(s.entries.map((e) => s.eventById[e.eventId]).flatMap((ev) => (ev ? [ev.tickerId ?? ev.macroId ?? ""] : [])).filter(Boolean));
    return [...ids]
      .map((id) => ({ id, label: s.allTickers[id]?.symbol ?? s.allMacros[id]?.shortName ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [s.entries, s.eventById, s.allTickers, s.allMacros]);

  function matchesFilters(entry: JournalEntry): boolean {
    const ev = s.eventById[entry.eventId];
    if (!ev) return false;
    if (tickerF !== "all" && ev.tickerId !== tickerF && ev.macroId !== tickerF) return false;
    if (kindF !== "all" && ev.kind !== kindF) return false;
    if (convF !== "all" && String(entry.conviction) !== convF) return false;
    return true;
  }

  const scoredAll = s.entries.filter((e) => isScored(e, s.now));
  const calAll = s.entries.filter((e) => isCalibrationScored(e, s.now));
  const preC67 = s.entries.filter((e) => isPreC67Scored(e, s.now));
  const pendingAll = s.entries.filter((e) => isPending(e, s.now));
  const unresolvable = s.entries.filter((e) => isUnresolvable(e));
  const scored = calAll.filter(matchesFilters);
  const pending = pendingAll.filter(matchesFilters);
  const hiddenPending = pendingAll.length - pending.length;
  const hits = scored.filter((e) => e.direction && e.actualDirection && e.direction === e.actualDirection);
  const pct = scored.length ? Math.round((hits.length / scored.length) * 100) : 0;
  const series = rollingAccuracy(scored, 5);
  const bands = convictionBands(scored);
  const captured = capturedMove(scored);
  const calib = calibrationCopy(bands, scored.length);
  const kindOf = (e: JournalEntry) => s.eventById[e.eventId]?.kind;

  const chips: { id: string; label: string; clear: () => void }[] = [];
  if (tickerF !== "all") chips.push({ id: "t", label: nameOptions.find((o) => o.id === tickerF)?.label ?? tickerF, clear: () => setTickerF("all") });
  if (kindF !== "all") chips.push({ id: "k", label: kindF, clear: () => setKindF("all") });
  if (convF !== "all") chips.push({ id: "c", label: `Conviction ${convF}`, clear: () => setConvF("all") });

  const byKind = [
    { id: "earnings", label: "Earnings", rows: scored.filter((e) => kindOf(e) === "earnings") },
    { id: "macro", label: "Macro", rows: scored.filter((e) => kindOf(e) === "macro") },
  ].filter((g) => g.rows.length >= 8);
  const byDir = (["up", "down", "flat"] as const).map((d) => ({ id: d, label: d[0]!.toUpperCase() + d.slice(1), rows: scored.filter((e) => e.direction === d) })).filter((g) => g.rows.length >= 8);
  const lowN = scored.length < CALIBRATION_MIN_OVERALL || bands.some((b) => b.n < CALIBRATION_MIN_BAND && bands.length > 1);
  const small = (t: string, color = c.muted) => <Text style={{ color, fontSize: 13, lineHeight: 18, marginTop: 12 }}>{t}</Text>;

  return (
    <TabScreen>
      <LargeTitle subtitle={<Text style={{ color: c.muted, fontSize: 13 }}>What your history says about your judgment.</Text>}>Record</LargeTitle>

      <Card style={{ padding: 16 }}>
        <Text style={{ color: c.faint, fontSize: 13, letterSpacing: wide(13), textTransform: "uppercase" }}>Your confidence</Text>
        {bands.length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {bands.map((b) => (
              <View key={b.id} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <Text style={{ color: c.fg, fontSize: 15 }}>Conviction {b.label}</Text>
                <Text style={[{ color: c.fg, fontSize: 15, fontWeight: "600" }, TABULAR]}>
                  {b.pct}%<Text style={{ color: c.muted, fontSize: 12, fontWeight: "500" }}>{"  "}n = {b.n}</Text>
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: c.muted, fontSize: 15, marginTop: 12 }}>No scored calls yet.</Text>
        )}
        {lowN
          ? small(`${hits.length} of ${scored.length} scored calls. Calibration needs more observations.`)
          : calib.text
            ? small(calib.text)
            : small(`${hits.length} of ${scored.length} scored calls under Catalyst’s scoring rule v1.`)}
        <Text style={[{ color: c.faint, fontSize: 13, marginTop: 12 }, TABULAR]}>
          Overall {scored.length ? `${pct}%` : "—"} · n = {scored.length}
        </Text>
        {captured.hitAvg != null ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
            When you called it, the tape moved {captured.hitAvg.toFixed(1)}% on average
            {captured.missAvg != null ? ` · ${captured.missAvg.toFixed(1)}% when you missed` : ""}
          </Text>
        ) : null}
        {series.length >= 2 ? (
          <View style={{ marginTop: 8 }}>
            <AccuracyChart points={series} />
          </View>
        ) : null}
      </Card>

      {preC67.length ? <Text style={{ color: c.faint, fontSize: 12, lineHeight: 17, marginTop: 12, paddingHorizontal: 4 }}>Earlier scores (older scoring rule) · n = {preC67.length} · excluded from calibration.</Text> : null}
      {unresolvable.length ? <Text style={{ color: c.faint, fontSize: 12, lineHeight: 17, marginTop: 4, paddingHorizontal: 4 }}>Unresolvable · n = {unresolvable.length} · excluded from accuracy.</Text> : null}

      {byKind.length || byDir.length ? (
        <Card style={{ padding: 16, marginTop: 16 }}>
          <Text style={{ color: c.faint, fontSize: 12, letterSpacing: wide(12), textTransform: "uppercase" }}>Observed in your record</Text>
          {[...byKind, ...byDir].map((g) => {
            const h = g.rows.filter((e) => e.direction === e.actualDirection).length;
            return (
              <Text key={g.id} style={[{ color: c.fg, fontSize: 14, marginTop: 8 }, TABULAR]}>
                {g.label} {Math.round((h / g.rows.length) * 100)}% · n = {g.rows.length}
              </Text>
            );
          })}
        </Card>
      ) : null}

      <View style={{ marginTop: 12, flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
        <Dropdown value={tickerF} onChange={setTickerF} placeholder="Ticker" options={[{ id: "all", label: "All names" }, ...nameOptions]} />
        <Dropdown
          value={kindF}
          onChange={setKindF}
          placeholder="Event type"
          options={[
            { id: "all", label: "All types" },
            { id: "earnings", label: "Earnings" },
            { id: "macro", label: "Macro" },
            { id: "product", label: "Event" },
          ]}
        />
        <Dropdown value={convF} onChange={setConvF} placeholder="Conviction" options={[{ id: "all", label: "Any" }, ...["1", "2", "3", "4", "5"].map((n) => ({ id: n, label: n }))]} />
      </View>
      {chips.length ? (
        <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {chips.map((ch) => (
            <Press key={ch.id} onPress={ch.clear} style={{ height: 28, borderRadius: 999, paddingHorizontal: 10, justifyContent: "center", backgroundColor: c.accent }}>
              <Text style={{ color: c.accentInk, fontSize: 12, fontWeight: "500" }}>{ch.label} ×</Text>
            </Press>
          ))}
        </View>
      ) : null}

      <View style={{ marginTop: 20 }}>
        <SectionTitle>Pending</SectionTitle>
        {hiddenPending > 0 ? (
          <Text style={{ color: c.faint, fontSize: 12, marginTop: -4, marginBottom: 4, paddingHorizontal: 4 }}>
            {hiddenPending} pending {hiddenPending === 1 ? "entry" : "entries"} hidden by filters
          </Text>
        ) : null}
        <View style={{ gap: 8 }}>
          {pending.map((e) => {
            const ev = s.eventById[e.eventId];
            if (!ev) return null;
            const miss = missingFields(e);
            return (
              <View key={e.id} style={{ borderRadius: 18, padding: 14, backgroundColor: c.card, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600" }}>
                    {labelOf(s, ev).kicker} · {ev.title}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{miss.length ? miss.map((m) => `${m} missing`).join(" · ") : "Awaiting the resolving session close"}</Text>
                </View>
                <Press
                  onPress={() => (miss.length ? openJournal(ev.id) : openEvent(ev.id))}
                  style={{ height: 32, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: miss.length ? c.accent : c.elevated }}
                >
                  <Text style={{ color: miss.length ? c.accentInk : c.fg, fontSize: 12, fontWeight: "600" }}>{miss.length ? "Continue" : "Open"}</Text>
                </Press>
              </View>
            );
          })}
          {pending.length === 0 ? <Text style={{ color: c.faint, fontSize: 13, paddingHorizontal: 4 }}>No pending entries in this view.</Text> : null}
        </View>
      </View>

      {unresolvable.length ? (
        <View style={{ marginTop: 24 }}>
          <SectionTitle>Unresolvable</SectionTitle>
          <View style={{ gap: 8 }}>
            {unresolvable.map((e) => {
              const ev = s.eventById[e.eventId];
              if (!ev) return null;
              return (
                <Press key={e.id} onPress={() => openEvent(ev.id)} style={{ borderRadius: 18, padding: 14, backgroundColor: c.card }}>
                  <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600" }}>
                    {labelOf(s, ev).kicker} · {ev.title}
                  </Text>
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{e.actualFigure ?? "Could not obtain a resolving move."}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <SectionTitle>Scored calls</SectionTitle>
        {scored.length === 0 && scoredAll.length === 0 ? (
          <EmptyState
            title={EMPTY_COPY.reviewTitle}
            body={EMPTY_COPY.reviewBody}
            actions={pendingAll.length === 0 ? <PrimaryButton onPress={() => router.navigate("/")}>See what’s next</PrimaryButton> : undefined}
          />
        ) : (
          <View style={{ gap: 8 }}>
            {[...scored]
              .sort((a, b) => new Date(b.actualMoveDate ?? b.updatedAt).getTime() - new Date(a.actualMoveDate ?? a.updatedAt).getTime())
              .map((e) => {
                const ev = s.eventById[e.eventId];
                if (!ev) return null;
                const called = e.direction === e.actualDirection;
                return (
                  <Press key={e.id} onPress={() => openEvent(ev.id)} style={{ borderRadius: 22, padding: 16, backgroundColor: c.card }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600", flexShrink: 1 }}>
                        {labelOf(s, ev).kicker} · {ev.title}
                      </Text>
                      <Pill tone={called ? "pos" : "neg"}>{called ? "Called it" : "Missed"}</Pill>
                    </View>
                    <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                      {[
                        ["Predicted", e.direction],
                        ["Actual", e.actualDirection],
                      ].map(([k, v]) => (
                        <View key={k} style={{ flex: 1 }}>
                          <Text style={{ color: c.faint, fontSize: 11, textTransform: "uppercase" }}>{k}</Text>
                          <Text style={{ color: c.fg, fontSize: 13, fontWeight: "500", textTransform: "capitalize" }}>{v}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
                      Conviction {e.conviction}/5 · {kindLabel(ev)} · n counted
                    </Text>
                    {e.actualMovePct != null ? (
                      <Text style={[{ color: e.actualMovePct >= 0 ? c.positive : c.negative, fontSize: 14, fontWeight: "500", marginTop: 4 }, TABULAR]}>
                        Observed {formatPct(e.actualMovePct)}
                        {e.actualMoveDate ? ` · ${formatWhen(e.actualMoveDate, s.now)}` : ""}
                      </Text>
                    ) : null}
                    {e.invalidation ? (
                      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
                        You said: “{e.invalidation}”{"\n"}
                        <Text style={{ color: c.faint, fontSize: 12 }}>Actual: {e.actualFigure ?? "Figures not in the structured print."} · Manual review needed</Text>
                      </Text>
                    ) : null}
                  </Press>
                );
              })}
          </View>
        )}
      </View>
    </TabScreen>
  );
}
