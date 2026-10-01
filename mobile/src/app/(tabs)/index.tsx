// C67 now.tsx: the Catalyst desk. Hero (result / make the next call / quiet), pending line, material
// headline, later catalysts. Cache only; the inline composer's lock is the one request here.
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { EMPTY_COPY } from "../../../../src/lib/catalyst/fixtures.ts";
import { firstSentence, formatPct, formatWhen, sessionLabel } from "../../../../src/lib/catalyst/format.ts";
import { impactLabel, kindLabel as newsKindLabel } from "../../../../src/lib/catalyst/impact.ts";
import { marketClock } from "../../../../src/lib/catalyst/session.ts";
import {
  entryFor,
  isEntryComplete,
  kindLabel,
  lastSimilarEvent,
  missingFields,
  needsCall,
  oldestIncomplete,
  pendingCount,
  setupHeadline,
  thisWeek,
} from "../../../../src/lib/catalyst/selectors.ts";
import type { CatalystEvent } from "../../../../src/lib/catalyst/types.ts";
import { addWatch } from "../../data";
import { CallComposer } from "../../ui/CallComposer";
import { markResultSeen, useSeenResults } from "../../ui/dismissed";
import { Card, dirColor, dirLabel, EmptyState, GearIcon, HeaderBtn, LargeTitle, ListIcon, Pill, PrimaryButton, Press, SecondaryButton, SectionTitle, SessionDot, TabScreen, TABULAR, phaseColor, tight, useC } from "../../ui/kit";
import { EventBead, EventRow, openArticle, openEvent, openJournal } from "../../ui/parts";
import { labelOf, useSlice, type Slice } from "../../ui/slice";

const RESULT_WINDOW_MS = 72 * 3600000;

type Hero = { kind: "result"; event: CatalystEvent } | { kind: "call"; event: CatalystEvent } | { kind: "quiet" };

/**
 * C67 deskHero, server-scored: the server's tick writes outcomes, so "Result ready" is a followed call the
 * server scored in the last 72 h that this phone has not opened yet. Otherwise C67 needsCall, then quiet.
 */
function deskHero(s: Slice, seen: Set<string>): Hero {
  const followed = new Set([...s.tickers.map((t) => t.id), ...s.macros.map((m) => m.id)]);
  const result = s.entries
    .filter((e) => e.lockedAt && e.actualDirection != null && e.actualMoveDate && !seen.has(e.id))
    .filter((e) => s.now - Date.parse(e.actualMoveDate!) <= RESULT_WINDOW_MS)
    .filter((e) => {
      const ev = s.eventById[e.eventId];
      return ev && followed.has(ev.tickerId ?? ev.macroId ?? "");
    })
    .sort((a, b) => Date.parse(b.actualMoveDate!) - Date.parse(a.actualMoveDate!))[0];
  if (result) return { kind: "result", event: s.eventById[result.eventId]! };
  const next = needsCall(s)[0];
  if (next) return { kind: "call", event: next };
  return { kind: "quiet" };
}

export default function CatalystTab() {
  const c = useC();
  const s = useSlice();
  const seen = useSeenResults();
  const hero = deskHero(s, seen);
  const clock = marketClock(s.now);
  const pending = pendingCount(s);
  const oldest = oldestIncomplete(s);
  const heroId = hero.kind === "quiet" ? "" : hero.event.id;
  const week = thisWeek(s).filter((e) => e.id !== heroId);
  const empty = s.tickers.length === 0 && s.macros.length === 0;
  const material = materialDeskLine(s, hero.kind === "quiet" ? undefined : hero.event);
  const line = hero.kind === "result" ? "Result ready." : hero.kind === "call" ? `${labelOf(s, hero.event).kicker} needs a call.` : "Nothing requires action.";

  return (
    <TabScreen>
      <LargeTitle
        subtitle={
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <SessionDot color={phaseColor(c, clock.phase)} />
            <Text style={{ color: c.fg, fontSize: 13, fontWeight: "500" }}>{clock.label}</Text>
            <Text style={{ color: c.faint, fontSize: 13 }}> · </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{line}</Text>
          </View>
        }
        right={
          <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
            <HeaderBtn label="Watch" onPress={() => router.push("/watch")}>
              <ListIcon color={c.fg} />
            </HeaderBtn>
            <HeaderBtn label="Settings" onPress={() => router.push("/settings")}>
              <GearIcon color={c.fg} />
            </HeaderBtn>
          </View>
        }
      >
        Catalyst
      </LargeTitle>

      {empty ? (
        <EmptyHome s={s} />
      ) : (
        <>
          {hero.kind === "result" ? <ResultHero s={s} event={hero.event} /> : hero.kind === "call" ? <CallHero s={s} event={hero.event} /> : <QuietDay />}

          {pending > 0 ? (
            <Press
              onPress={() => oldest && openJournal(oldest.eventId)}
              style={{ marginTop: 16, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.card }}
            >
              <Text style={{ color: c.fg, fontSize: 14, fontWeight: "500" }}>{pending} pending</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
                {oldest ? `Complete lock required to score · continue at ${missingFields(oldest)[0] ?? "the next field"}.` : "Complete lock required to score."}
              </Text>
            </Press>
          ) : null}

          {material ? (
            <Press onPress={() => openArticle(material.id)} style={{ marginTop: 12, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: "600" }}>Material</Text>
              <Text numberOfLines={1} style={{ color: c.fg, fontSize: 13, flex: 1 }}>
                {material.title}
              </Text>
            </Press>
          ) : null}

          {week.length ? (
            <View style={{ marginTop: 24 }}>
              <SectionTitle>Later catalysts</SectionTitle>
              <Card>
                {week.slice(0, 6).map((e, i) => (
                  <EventRow key={e.id} event={e} s={s} inset last={i === Math.min(week.length, 6) - 1} onOpen={() => openEvent(e.id)} />
                ))}
              </Card>
            </View>
          ) : null}
        </>
      )}
    </TabScreen>
  );
}

function materialDeskLine(s: Slice, current?: CatalystEvent) {
  const t = new Set(s.tickers.map((x) => x.id));
  const m = new Set(s.macros.map((x) => x.id));
  return s.headlines
    .filter(
      (h) =>
        h.impact === "high" &&
        ((h.tickerId && t.has(h.tickerId)) || (h.macroId && m.has(h.macroId))) &&
        (!current || (current.tickerId ? h.tickerId !== current.tickerId : h.macroId !== current.macroId)),
    )
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))[0];
}

function EmptyHome({ s }: { s: Slice }) {
  const [busy, setBusy] = useState(false);
  const nvda = Object.values(s.allTickers).find((t) => t.symbol === "NVDA");
  return (
    <EmptyState
      title={EMPTY_COPY.nowTitle}
      body={EMPTY_COPY.nowBody}
      actions={
        <>
          {nvda ? (
            <PrimaryButton
              busy={busy}
              onPress={async () => {
                setBusy(true);
                await addWatch({ tickerId: nvda.id }).catch(() => {});
                setBusy(false);
              }}
            >
              Follow NVDA
            </PrimaryButton>
          ) : null}
          <SecondaryButton onPress={() => router.push("/watch")}>Search names</SecondaryButton>
        </>
      }
    />
  );
}

function QuietDay() {
  const c = useC();
  return (
    <View style={{ borderRadius: 28, paddingHorizontal: 20, paddingVertical: 32, backgroundColor: c.card, alignItems: "center" }}>
      <Text style={{ color: c.faint, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>Quiet</Text>
      <Text style={{ color: c.fg, fontSize: 20, fontWeight: "600", letterSpacing: tight(20), marginTop: 12, textAlign: "center" }}>Nothing requires action</Text>
      <Text style={{ color: c.muted, fontSize: 15, lineHeight: 23, marginTop: 8, textAlign: "center" }}>
        No followed print needs a call, and nothing is waiting to resolve.
      </Text>
    </View>
  );
}

function HeroFrame({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  const c = useC();
  return (
    <View style={{ borderRadius: 28, padding: 20, backgroundColor: c.card }}>
      <Text style={{ color: c.accent, fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" }}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function ResultHero({ s, event }: { s: Slice; event: CatalystEvent }) {
  const c = useC();
  const { kicker } = labelOf(s, event);
  const note = entryFor(s, event.id);
  const hit = note?.direction === note?.actualDirection;
  return (
    <HeroFrame eyebrow="Result ready">
      <EventBead startsAt={event.startsAt} now={s.now} locked resolved />
      <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600", marginTop: 12 }}>{kicker}</Text>
      <Text style={{ color: c.fg, fontSize: 22, fontWeight: "700", letterSpacing: tight(22), marginTop: 2 }}>{event.title}</Text>
      {note?.direction ? (
        <Text style={{ color: c.fg, fontSize: 15, marginTop: 12 }}>
          You called <Text style={{ fontWeight: "600", color: dirColor(c, note.direction) }}>{dirLabel(note.direction)}</Text>
          {note.conviction ? <Text style={{ color: c.muted }}> · {note.conviction}/5</Text> : null}
        </Text>
      ) : null}
      {note?.actualMovePct != null ? (
        <Text style={[{ color: dirColor(c, note.actualDirection), fontSize: 15, fontWeight: "500", marginTop: 4 }, TABULAR]}>
          {formatPct(note.actualMovePct)} · {dirLabel(note.actualDirection)}
        </Text>
      ) : null}
      <Text style={{ color: hit ? c.positive : c.negative, fontSize: 15, fontWeight: "600", marginTop: 12 }}>{hit ? "Called it" : "Missed"}</Text>
      {note?.invalidation ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 12 }}>
          You said: “{note.invalidation}”{"\n"}
          <Text style={{ color: c.faint, fontSize: 12 }}>Actual: Figures not in the structured print. · Manual review needed</Text>
        </Text>
      ) : null}
      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          onPress={() => {
            if (note) markResultSeen(note.id);
            openEvent(event.id);
          }}
        >
          Review the call
        </PrimaryButton>
      </View>
    </HeroFrame>
  );
}

function CallHero({ s, event }: { s: Slice; event: CatalystEvent }) {
  const c = useC();
  const { kicker } = labelOf(s, event);
  const note = entryFor(s, event.id);
  const complete = note ? isEntryComplete(note) && Boolean(note.lockedAt) : false;
  const [editing, setEditing] = useState(false);
  const showPad = !complete || editing;
  const street = event.consensus?.slice(0, 3) ?? [];
  const last = lastSimilarEvent(s, event);
  const lastNote = last ? entryFor(s, last.id) : undefined;
  const setup = setupHeadline(s.headlines, event);
  const target = note?.callTarget ? s.allTickers[note.callTarget] : undefined;

  return (
    <HeroFrame eyebrow="Make the next call">
      <EventBead startsAt={event.startsAt} now={s.now} locked={Boolean(note?.lockedAt)} />
      <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600", letterSpacing: tight(15), marginTop: 12 }}>{kicker}</Text>
      <Text style={{ color: c.fg, fontSize: 22, fontWeight: "700", letterSpacing: tight(22), marginTop: 2 }}>{event.title}</Text>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>
        {kindLabel(event)} · {formatWhen(event.startsAt, s.now)} · {sessionLabel(event.session)}
        {event.confirmed ? "" : " · Est."}
      </Text>
      {event.kind === "macro" && target ? (
        <Text style={{ color: c.fg, fontSize: 13, marginTop: 4 }}>
          {kicker} · {target.symbol}, next session
        </Text>
      ) : null}
      {street.length ? (
        <View style={{ marginTop: 16, borderRadius: 16, overflow: "hidden", backgroundColor: c.elevated }}>
          {street.map((row, i) => (
            <View key={row.metric} style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: i < street.length - 1 ? 0.5 : 0, borderBottomColor: c.hairline }}>
              <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12, flexShrink: 1 }}>{row.metric}</Text>
              <Text style={[{ color: c.fg, fontSize: 13, fontWeight: "600" }, TABULAR]}>
                {row.consensus}
                <Text style={{ color: c.faint, fontWeight: "500" }}>{"  "}prior {row.prior}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {last && lastNote?.actualMovePct != null ? (
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
          Last comparable print{"  "}
          <Text style={[{ fontWeight: "600", color: lastNote.actualMovePct >= 0 ? c.positive : c.negative }, TABULAR]}>{formatPct(lastNote.actualMovePct)}</Text>
          {lastNote.actualFigure ? `\n${firstSentence(lastNote.actualFigure)}` : ""}
        </Text>
      ) : null}
      {setup ? (
        <Press onPress={() => openArticle(setup.id)} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pill tone="accent">{impactLabel(setup.impact)}</Pill>
          <Text numberOfLines={1} style={{ color: c.fg, fontSize: 13, flex: 1 }}>{setup.title}</Text>
          <Text style={{ color: c.faint, fontSize: 11 }}>{newsKindLabel(setup.kind)}</Text>
        </Press>
      ) : null}

      {showPad ? (
        <View style={{ marginTop: 20 }}>
          <CallComposer eventId={event.id} layout="inline" onLock={() => setEditing(false)} />
        </View>
      ) : (
        <View style={{ marginTop: 20 }}>
          <Text style={{ color: c.positive, fontSize: 15, fontWeight: "500", textAlign: "center" }}>
            Locked · {dirLabel(note?.direction)}
            {note?.conviction ? ` · ${note.conviction}` : ""}
          </Text>
          {note?.lockedAt ? <Text style={{ color: c.faint, fontSize: 12, textAlign: "center", marginTop: 4 }}>{formatWhen(note.lockedAt, s.now)}</Text> : null}
          {note?.reasoning ? <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 8 }}>{note.reasoning}</Text> : null}
          <Press onPress={() => setEditing(true)} style={{ height: 44, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <Text style={{ color: c.accent, fontSize: 15, fontWeight: "500" }}>Edit the call</Text>
          </Press>
          <Press onPress={() => openEvent(event.id)} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: c.accent, fontSize: 15, fontWeight: "500" }}>Event details</Text>
          </Press>
        </View>
      )}
    </HeroFrame>
  );
}

