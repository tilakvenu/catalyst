// C67 event.tsx: the before/after workspace for one catalyst. Evidence freeze shows what was known at
// lock vs what arrived after. Cache only; missing evidence titles load only when the user asks.
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { splitEvidence } from "../../../../src/lib/catalyst/evidence.ts";
import { ageLabel, countdown, firstSentence, formatPct, formatTime, formatWhen, sessionLabel } from "../../../../src/lib/catalyst/format.ts";
import { entryFor, isUrgent, kindLabel, lastSimilarEvent } from "../../../../src/lib/catalyst/selectors.ts";
import { isEntryComplete, type Headline } from "../../../../src/lib/catalyst/types.ts";
import { getEvidence } from "../../data";
import { Card, Divider, LockIcon, Pill, Press, PushScreen, SectionTitle, TABULAR, tight, useC, wide } from "../../ui/kit";
import { EventBead, HeadlineRow, openArticle, openJournal } from "../../ui/parts";
import { labelOf, useSlice } from "../../ui/slice";

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useC();
  const s = useSlice();
  const event = s.eventById[id];
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  if (!event) {
    return (
      <PushScreen title="Missing">
        <Text style={{ color: c.muted, fontSize: 15, marginTop: 8 }}>This event is not on this device. Pull to refresh on the Catalyst tab.</Text>
      </PushScreen>
    );
  }

  const { kicker } = labelOf(s, event);
  const urgent = isUrgent(event.startsAt, s.now);
  const note = entryFor(s, event.id);
  const news = s.headlines
    .filter((h) => (event.tickerId ? h.tickerId === event.tickerId : h.macroId === event.macroId))
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  const complete = note ? isEntryComplete(note) : false;
  const locked = Boolean(note?.lockedAt);
  const resolved = note?.actualDirection != null;
  const last = lastSimilarEvent(s, event);
  const lastNote = last ? entryFor(s, last.id) : undefined;
  const target = note?.callTarget ? s.allTickers[note.callTarget] : undefined;
  const started = s.now >= new Date(event.startsAt).getTime();
  const hasDraft = s.hasDraft[event.id];

  // Evidence at lock: the server stores ids; titles come from cached headlines.
  const byId = new Map(s.headlines.map((h) => [h.id, h]));
  const knownIds = locked ? note?.evidenceSnapshot ?? [] : [];
  const known = knownIds.map((hid) => byId.get(hid)).filter((h): h is Headline => !!h);
  const missingKnown = knownIds.filter((hid) => !byId.has(hid));
  const after = locked && note ? splitEvidence(note, s.headlines, event).after : [];

  const header = (
    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
      <Text style={[{ color: urgent ? c.accent : c.fg, fontSize: 28, fontWeight: "600", letterSpacing: tight(28) }, TABULAR]}>{countdown(event.startsAt, s.now)}</Text>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
        {formatWhen(event.startsAt, s.now)} · {sessionLabel(event.session)}
      </Text>
    </View>
  );

  return (
    <PushScreen title={kicker} header={header}>
      <EventBead startsAt={event.startsAt} now={s.now} locked={locked} resolved={resolved} />

      <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Pill>{kindLabel(event)}</Pill>
        {urgent ? <Pill tone="accent">Within 48h</Pill> : null}
        {!event.confirmed ? <Pill tone="warn">Estimated</Pill> : null}
        {resolved ? (
          <Pill tone={note?.direction === note?.actualDirection ? "pos" : "neg"}>{note?.direction === note?.actualDirection ? "Called it" : "Missed"}</Pill>
        ) : locked ? (
          <Pill tone="pos">Locked</Pill>
        ) : complete ? (
          <Pill tone="accent">Draft ready</Pill>
        ) : note ? (
          <Pill tone="warn">Draft</Pill>
        ) : null}
      </View>

      <Text style={{ color: c.fg, fontSize: 22, fontWeight: "600", lineHeight: 27, marginTop: 12 }}>{event.title}</Text>
      {event.kind === "macro" ? (
        <Text style={{ color: c.muted, fontSize: 14, marginTop: 4 }}>
          {kicker}
          {target ? `  ·  ${target.symbol}, next session` : "  ·  pick a target to lock"}
          {note?.direction ? `:  ${note.direction}` : ""}
        </Text>
      ) : null}

      {last && lastNote?.actualMovePct != null ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 12 }}>
          Last comparable{"  "}
          <Text style={[{ fontWeight: "600", color: lastNote.actualMovePct >= 0 ? c.positive : c.negative }, TABULAR]}>{formatPct(lastNote.actualMovePct)}</Text>
          {"\n"}
          {lastNote.actualFigure ? firstSentence(lastNote.actualFigure) : <Text style={{ color: c.faint, fontSize: 12 }}>Only this comparable print is in the record.</Text>}
        </Text>
      ) : null}

      <SectionTitle style={{ marginTop: 20 }}>Your call</SectionTitle>
      <Card style={{ padding: 16 }}>
        {note?.direction ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Pill tone={note.direction === "up" ? "pos" : note.direction === "down" ? "neg" : "neutral"}>{note.direction.toUpperCase()}</Pill>
              {note.conviction ? <Pill>Conviction {note.conviction}/5</Pill> : null}
              <Text style={{ color: c.faint, fontSize: 12 }}>{note.lockedAt ? `Locked ${formatTime(note.lockedAt)}` : `Edited ${ageLabel(note.updatedAt, s.now)}`}</Text>
            </View>
            {note.reasoning ? <Text style={{ color: c.fg, fontSize: 15, lineHeight: 23, marginTop: 8 }}>{note.reasoning}</Text> : null}
            {note.invalidation ? <Text style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>Wrong if: {note.invalidation}</Text> : null}
            {hasDraft && locked && !started ? <Text style={{ color: c.warn, fontSize: 12, marginTop: 8 }}>Unlocked edits on this phone — update the lock to send them.</Text> : null}
          </>
        ) : (
          <Text style={{ color: c.muted, fontSize: 14 }}>No call yet. Four fields — direction, conviction, why, invalidation.</Text>
        )}
      </Card>

      {resolved && note ? (
        <Card style={{ padding: 16, marginTop: 12 }}>
          <Text style={{ color: c.faint, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>Outcome</Text>
          <Text style={{ color: note.direction === note.actualDirection ? c.positive : c.negative, fontSize: 18, fontWeight: "600", marginTop: 8 }}>
            {note.direction === note.actualDirection ? "Called it" : "Missed"}
            {note.actualMovePct != null ? (
              <Text style={[{ fontSize: 16, color: note.actualMovePct >= 0 ? c.positive : c.negative }, TABULAR]}>{"  "}{formatPct(note.actualMovePct)}</Text>
            ) : null}
          </Text>
          {note.invalidation ? (
            <View style={{ marginTop: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.elevated }}>
              <Text style={{ color: c.faint, fontSize: 11, letterSpacing: wide(11), textTransform: "uppercase" }}>You said</Text>
              <Text style={{ color: c.fg, fontSize: 14, lineHeight: 19, marginTop: 2 }}>“{note.invalidation}”</Text>
              <Text style={{ color: c.faint, fontSize: 11, letterSpacing: wide(11), textTransform: "uppercase", marginTop: 8 }}>Actual</Text>
              <Text style={{ color: c.fg, fontSize: 14, lineHeight: 19, marginTop: 2 }}>{note.actualFigure ?? "Figures not in the structured print."}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>Manual review needed</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      {locked ? (
        <View style={{ marginTop: 20 }}>
          <SectionTitle>Known when you called</SectionTitle>
          <Card>
            {known.length ? (
              known.map((h, i) => (
                <View key={h.id}>
                  <Press onPress={() => openArticle(h.id)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                    <Text style={{ color: c.fg, fontSize: 15, fontWeight: "500", lineHeight: 20 }}>{h.title}</Text>
                    <Text style={{ color: c.faint, fontSize: 12, marginTop: 4 }}>
                      {h.source}
                      {h.publishedAt ? ` · ${formatTime(h.publishedAt)}` : ""} · Known when you called
                    </Text>
                  </Press>
                  {i < known.length - 1 || missingKnown.length ? <Divider /> : null}
                </View>
              ))
            ) : missingKnown.length ? null : (
              <Text style={{ color: c.muted, fontSize: 13, paddingHorizontal: 14, paddingVertical: 12 }}>Snapshot stored. Nothing on the sheet at lock.</Text>
            )}
            {missingKnown.length ? (
              <Press
                disabled={loading}
                onPress={async () => {
                  setLoading(true);
                  setLoadError(null);
                  try {
                    await getEvidence(knownIds);
                  } catch (e) {
                    setLoadError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ paddingHorizontal: 14, paddingVertical: 12 }}
              >
                <Text style={{ color: c.accent, fontSize: 14, fontWeight: "500" }}>
                  {loading ? "Loading…" : `Load ${missingKnown.length} earlier headline${missingKnown.length === 1 ? "" : "s"} known at lock`}
                </Text>
                {loadError ? <Text style={{ color: c.warn, fontSize: 12, marginTop: 4 }}>{loadError}</Text> : null}
              </Press>
            ) : null}
          </Card>
          {after.length ? (
            <>
              <SectionTitle style={{ marginTop: 16 }}>Arrived after your call</SectionTitle>
              <Card>
                {after.map((h, i) => (
                  <View key={h.id}>
                    <Press onPress={() => openArticle(h.id)} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                      <Text style={{ color: c.fg, fontSize: 15, fontWeight: "500", lineHeight: 20 }}>{h.title}</Text>
                      <Text style={{ color: c.faint, fontSize: 12, marginTop: 4 }}>
                        {h.source} · {ageLabel(h.publishedAt, s.now)} · After your call
                      </Text>
                    </Press>
                    {i < after.length - 1 ? <Divider /> : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </View>
      ) : null}

      {!started || !locked ? (
        <Press
          disabled={started}
          onPress={() => openJournal(event.id)}
          style={{ marginTop: 12, height: 48, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: started ? 0.4 : 1 }}
        >
          <LockIcon color={c.accentInk} />
          <Text style={{ color: c.accentInk, fontSize: 16, fontWeight: "600" }}>{started ? "Event started" : locked ? "Update lock" : note ? "Continue the call" : "Write the call"}</Text>
        </Press>
      ) : null}

      {!event.confirmed ? (
        <Card style={{ padding: 16, marginTop: 20 }}>
          <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>Nothing confirmed yet</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginTop: 4 }}>
            This date comes from the company’s reporting pattern. Consensus figures appear once the company confirms.
          </Text>
        </Card>
      ) : event.consensus?.length ? (
        <Card style={{ marginTop: 20 }}>
          <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8 }}>
            {["Metric", "Consensus", "Prior"].map((h, i) => (
              <Text key={h} style={{ flex: 1, textAlign: i ? "right" : "left", color: c.faint, fontSize: 11, letterSpacing: wide(11), textTransform: "uppercase" }}>
                {h}
              </Text>
            ))}
          </View>
          {event.consensus.map((row) => (
            <View key={row.metric} style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: c.hairline }}>
              <Text style={{ flex: 1, color: c.muted, fontSize: 14 }}>{row.metric}</Text>
              <Text style={[{ flex: 1, textAlign: "right", color: c.fg, fontSize: 14, fontWeight: "500" }, TABULAR]}>{row.consensus}</Text>
              <Text style={[{ flex: 1, textAlign: "right", color: c.muted, fontSize: 14 }, TABULAR]}>{row.prior}</Text>
            </View>
          ))}
          {event.consensusSource ? <Text style={{ color: c.faint, fontSize: 11, paddingHorizontal: 16, paddingVertical: 8 }}>{event.consensusSource}</Text> : null}
        </Card>
      ) : null}

      {!locked && news.length ? (
        <>
          <SectionTitle
            style={{ marginTop: 24 }}
            right={
              <Press onPress={() => router.push({ pathname: "/headlines", params: event.tickerId ? { tickerId: event.tickerId } : { macroId: event.macroId! } })}>
                <Text style={{ color: c.accent, fontSize: 13, fontWeight: "500" }}>See all {news.length}</Text>
              </Press>
            }
          >
            Evidence
          </SectionTitle>
          <Card>
            {news.slice(0, 3).map((h, i) => (
              <HeadlineRow key={h.id} h={h} now={s.now} compact last={i === Math.min(news.length, 3) - 1} />
            ))}
          </Card>
        </>
      ) : null}

      <Text style={{ color: c.faint, fontSize: 11, textAlign: "center", marginTop: 24 }}>Notes are yours only. Catalyst does not execute trades or give advice.</Text>
    </PushScreen>
  );
}
