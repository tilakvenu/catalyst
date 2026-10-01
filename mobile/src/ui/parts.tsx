// Shared C67 pieces: EventRow (event-row.tsx), EventBead (mark.tsx), headline rows with the violet impact
// ramp (news.tsx), AccuracyChart (charts.tsx, Recharts -> react-native-svg).
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { ageLabel, countdown, formatDateShort, formatPct, formatTimeEt, sessionLabel } from "../../../src/lib/catalyst/format.ts";
import { impactLabel, impactRulePx, impactWeight, kindLabel as newsKindLabel } from "../../../src/lib/catalyst/impact.ts";
import { entryFor, isUrgent, kindLabel } from "../../../src/lib/catalyst/selectors.ts";
import { isEntryComplete, type CatalystEvent, type Headline, type NewsImpact } from "../../../src/lib/catalyst/types.ts";
import type { ThemeColors } from "../theme";
import { Divider, Press, TABULAR, tight, useC, wide } from "./kit";
import { labelOf, type Slice } from "./slice";

/** One hue, three intensities. Never red or green (C67 impactColor). */
export function impactTint(c: ThemeColors, impact?: NewsImpact): string {
  if (impact === "high") return c.impactHigh;
  if (impact === "medium") return c.impactMed;
  return c.faint;
}

export const openEvent = (id: string) => router.push({ pathname: "/event/[id]", params: { id } });
export const openTicker = (id: string) => router.push({ pathname: "/ticker/[id]", params: { id } });
export const openArticle = (id: string) => router.push({ pathname: "/article/[id]", params: { id } });
export const openJournal = (eventId: string) => router.push({ pathname: "/journal/[eventId]", params: { eventId } });

export function EventRow({ event, s, onOpen, inset, last }: { event: CatalystEvent; s: Slice; onOpen: () => void; inset?: boolean; last?: boolean }) {
  const c = useC();
  const { kicker } = labelOf(s, event);
  const urgent = isUrgent(event.startsAt, s.now);
  const note = entryFor(s, event.id);
  const call = note ? (isEntryComplete(note) && note.lockedAt ? "Call in" : "Draft") : null;
  const meta = [kindLabel(event), sessionLabel(event.session), formatTimeEt(event.startsAt)];
  if (!event.confirmed) meta.push("Est.");
  if (event.consensus?.[0]) meta.push(`${event.consensus[0].metric} ${event.consensus[0].consensus}`);
  return (
    <View>
      <Press onPress={onOpen} style={{ flexDirection: "row", backgroundColor: inset ? "transparent" : c.card, borderRadius: inset ? 0 : 22, overflow: "hidden" }}>
        <View style={{ width: 4, backgroundColor: urgent ? c.accent : c.urgency }} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600", letterSpacing: tight(16) }}>{kicker}</Text>
              {call ? <Text style={{ color: call === "Call in" ? c.positive : c.accent, fontSize: 11, fontWeight: "500" }}>{call}</Text> : null}
            </View>
            <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
              {meta.join(" · ")}
            </Text>
          </View>
          <Text style={[{ color: urgent ? c.accent : c.fg, fontSize: 13, fontWeight: "500" }, TABULAR]}>{countdown(event.startsAt, s.now)}</Text>
        </View>
      </Press>
      {inset && !last ? <Divider /> : null}
    </View>
  );
}

/** Thin BEFORE -> EVENT -> AFTER timeline; the bead stays Catalyst blue. */
export function EventBead({ startsAt, now, locked = false, resolved = false }: { startsAt: string; now: number; locked?: boolean; resolved?: boolean }) {
  const c = useC();
  const p = Math.min(1, Math.max(0, 1 - (new Date(startsAt).getTime() - now) / (48 * 3600000)));
  const left = 4 + p * 92;
  const big = locked || resolved;
  return (
    <View style={{ marginTop: 12, paddingHorizontal: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ height: 12, justifyContent: "center" }}>
        <View style={{ height: 1, backgroundColor: c.hairline }} />
        <View
          style={{
            position: "absolute",
            left: `${left}%`,
            width: big ? 11.5 : 10,
            height: big ? 11.5 : 10,
            marginLeft: big ? -5.75 : -5,
            borderRadius: 6,
            backgroundColor: c.accent,
            opacity: big ? 1 : 0.85,
          }}
        />
      </View>
      <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between" }}>
        {["Before", "Event", "After"].map((t) => (
          <Text key={t} style={{ color: c.faint, fontSize: 10, letterSpacing: wide(10), textTransform: "uppercase" }}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Tape / evidence row: impact rail, impact label, kind, title, why, source and age. */
export function HeadlineRow({ h, now, impact, why, observed, last, compact }: { h: Headline; now: number; impact?: NewsImpact; why?: string; observed?: number | null; last?: boolean; compact?: boolean }) {
  const c = useC();
  const shown = impact ?? h.impact ?? "low";
  const color = impactTint(c, shown);
  return (
    <View>
      <Press onPress={() => openArticle(h.id)} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ width: impactRulePx(shown), minHeight: compact ? 36 : 40, borderRadius: 4, backgroundColor: color, marginTop: 4 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color, fontSize: 11, fontWeight: impactWeight(shown) === "semibold" ? "600" : "400", letterSpacing: wide(11) }}>{impactLabel(shown)}</Text>
            <Text style={{ color: c.faint, fontSize: 11 }}>{newsKindLabel(h.kind)}</Text>
          </View>
          <Text style={{ color: c.fg, fontSize: 15, fontWeight: "500", lineHeight: 20, marginTop: 4 }}>{h.title}</Text>
          {!compact && (why ?? h.why) ? <Text style={{ color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 4 }}>{why ?? h.why}</Text> : null}
          {observed != null ? <Text style={[{ color: c.muted, fontSize: 12, marginTop: 4 }, TABULAR]}>Observed next session: {formatPct(observed)}</Text> : null}
          <Text style={{ color: c.faint, fontSize: 12, marginTop: 4 }}>
            {h.source} · {ageLabel(h.publishedAt, now)}
          </Text>
        </View>
      </Press>
      {!last ? <Divider /> : null}
    </View>
  );
}

/** Rolling accuracy, 0-100 with a dashed 50 line (C67 AccuracyChart). */
export function AccuracyChart({ points }: { points: { t: string; pct: number }[] }) {
  const c = useC();
  const [w, setW] = useState(0);
  const h = 176;
  const padL = 26;
  const padR = 8;
  const padT = 8;
  const padB = 22;
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const plotW = Math.max(0, w - padL - padR);
  const plotH = h - padT - padB;
  const x = (i: number) => padL + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const y = (pct: number) => padT + (1 - pct / 100) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.pct).toFixed(1)}`).join(" ");
  const labelIdx = points.length <= 3 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <View style={{ height: h, width: "100%" }} onLayout={onLayout}>
      {w ? (
        <Svg width={w} height={h}>
          {[0, 50, 100].map((g) => (
            <Line key={g} x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke={g === 50 ? c.faint : c.hairline} strokeWidth={1} strokeDasharray={g === 50 ? "4 4" : undefined} />
          ))}
          {[0, 50, 100].map((g) => (
            <SvgText key={`l${g}`} x={padL - 6} y={y(g) + 4} fontSize={11} fill={c.faint} textAnchor="end">
              {String(g)}
            </SvgText>
          ))}
          <Path d={path} stroke={c.accent} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <Circle key={i} cx={x(i)} cy={y(p.pct)} r={3} fill={c.accent} />
          ))}
          {labelIdx.map((i) => (
            <SvgText key={`x${i}`} x={x(i)} y={h - 4} fontSize={11} fill={c.faint} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
              {formatDateShort(points[i]!.t)}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** Small inline dropdown (stands in for the web <select>). */
export function Dropdown<T extends string>({ value, options, onChange, placeholder }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; placeholder: string }) {
  const c = useC();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={{ height: 40, borderRadius: 12, paddingHorizontal: 10, backgroundColor: c.elevated, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <Text numberOfLines={1} style={{ color: c.fg, fontSize: 13, flexShrink: 1 }}>{current && value !== ("all" as T) ? current.label : placeholder}</Text>
        <Text style={{ color: c.faint, fontSize: 11 }}>{open ? "▲" : "▼"}</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 4, borderRadius: 12, backgroundColor: c.elevated, overflow: "hidden" }}>
          {options.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => {
                onChange(o.id);
                setOpen(false);
              }}
              style={{ paddingHorizontal: 10, paddingVertical: 9 }}
            >
              <Text style={{ color: o.id === value ? c.accent : c.fg, fontSize: 13, fontWeight: o.id === value ? "600" : "400" }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
