// Native port of C67 src/components/catalyst/ui.tsx (+ TopBar, EmptyState, Segmented) and shared screen
// wrappers. Type scale and radii follow src/styles.css: titles 34/700, section labels 13/600 uppercase,
// cards 22, buttons 14, chips 10, pills full.
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { refresh } from "../data";
import { alpha, type ThemeColors } from "../theme";
import { useTheme } from "./theme-context";

export const R = { card: 22, sheet: 28, btn: 14, chip: 10, pill: 999, field: 16, row: 18 } as const;
export const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };
/** tracking-tight on large text, tracking-wide on small caps labels. */
export const tight = (size: number) => -0.025 * size;
export const wide = (size: number) => 0.025 * size;

export function useC(): ThemeColors {
  return useTheme().c;
}

/** Scales to 0.97 while pressed (C67 .pressable). */
export function Press({
  onPress,
  disabled,
  style,
  children,
  label,
  onLongPress,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  label?: string;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [style as ViewStyle, pressed && !disabled ? { transform: [{ scale: 0.97 }] } : null]}
    >
      {children}
    </Pressable>
  );
}

export function T({ style, children, numberOfLines, selectable }: { style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; selectable?: boolean }) {
  const c = useC();
  return (
    <Text numberOfLines={numberOfLines} selectable={selectable} style={[{ color: c.fg, fontSize: 15 }, style]}>
      {children}
    </Text>
  );
}

export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const c = useC();
  return <View style={[{ backgroundColor: c.card, borderRadius: R.card, overflow: "hidden" }, style]}>{children}</View>;
}

/** Hairline between rows inside a card (C67 inset 0 -0.5px 0 var(--hairline)). */
export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useC();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />;
}

export type Tone = "neutral" | "accent" | "pos" | "neg" | "warn";

export function toneColors(c: ThemeColors, tone: Tone): { bg: string; fg: string } {
  if (tone === "accent") return { bg: alpha(c.accent, 0.16), fg: c.accent };
  if (tone === "pos") return { bg: alpha(c.positive, 0.18), fg: c.positive };
  if (tone === "neg") return { bg: alpha(c.negative, 0.18), fg: c.negative };
  if (tone === "warn") return { bg: alpha(c.warn, 0.18), fg: c.warn };
  return { bg: c.elevated, fg: c.muted };
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const c = useC();
  const t = toneColors(c, tone);
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" }}>
      <Text style={{ color: t.fg, fontSize: 11, fontWeight: "500", letterSpacing: wide(11) }}>{children}</Text>
    </View>
  );
}

export function SectionTitle({ children, count, right, style }: { children: ReactNode; count?: number; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useC();
  return (
    <View style={[{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 8 }, style]}>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600", letterSpacing: wide(13), textTransform: "uppercase" }}>
        {children}
        {typeof count === "number" ? <Text style={[{ color: c.faint, fontWeight: "500" }, TABULAR]}>{"  "}{count}</Text> : null}
      </Text>
      {right}
    </View>
  );
}

export function EmptyState({ title, body, actions }: { title: string; body: string; actions?: ReactNode }) {
  const c = useC();
  return (
    <View style={{ marginHorizontal: 4, marginTop: 32, borderRadius: R.card, paddingHorizontal: 24, paddingVertical: 40, backgroundColor: c.card, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline }}>
      <Text style={{ color: c.fg, fontSize: 17, fontWeight: "600", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: c.muted, fontSize: 15, lineHeight: 23, textAlign: "center", marginTop: 8 }}>{body}</Text>
      {actions ? <View style={{ marginTop: 20, gap: 8 }}>{actions}</View> : null}
    </View>
  );
}

export function PrimaryButton({ children, onPress, disabled, busy }: { children: ReactNode; onPress?: () => void; disabled?: boolean; busy?: boolean }) {
  const c = useC();
  return (
    <Press onPress={onPress} disabled={disabled || busy} style={{ height: 48, borderRadius: R.btn, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: c.accentInk, fontSize: 16, fontWeight: "600" }}>{busy ? "…" : children}</Text>
    </Press>
  );
}

export function SecondaryButton({ children, onPress, disabled }: { children: ReactNode; onPress?: () => void; disabled?: boolean }) {
  const c = useC();
  return (
    <Press onPress={onPress} disabled={disabled} style={{ height: 48, borderRadius: R.btn, backgroundColor: c.elevated, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: c.fg, fontSize: 16, fontWeight: "500" }}>{children}</Text>
    </Press>
  );
}

export function GhostButton({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const c = useC();
  return (
    <Press onPress={onPress} style={[{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }, style]}>
      <Text style={{ color: c.accent, fontSize: 16, fontWeight: "500" }}>{children}</Text>
    </Press>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  const c = useC();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderRadius: R.chip, padding: 2, backgroundColor: c.segTrack }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.id)}
            style={[
              { flex: 1, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
              on ? { backgroundColor: c.segThumb, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null,
            ]}
          >
            <Text style={{ color: on ? c.fg : c.muted, fontSize: 13, fontWeight: "500" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter chip row item (Tape filters, Watch filters). */
export function Chip({ label, on, onPress, accent }: { label: ReactNode; on: boolean; onPress: () => void; accent?: boolean }) {
  const c = useC();
  const bg = on ? (accent ? c.accent : c.segThumb) : c.elevated;
  const fg = on ? (accent ? c.accentInk : c.fg) : c.muted;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[{ height: accent ? 32 : 36, borderRadius: R.pill, paddingHorizontal: accent ? 12 : 14, justifyContent: "center", backgroundColor: bg }, on && !accent ? { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : null]}
    >
      <Text style={[{ color: fg, fontSize: 13, fontWeight: accent ? "500" : "600" }, TABULAR]}>{label}</Text>
    </Pressable>
  );
}

export function TopBar({ title, onBack, trailing }: { title?: string; onBack?: () => void; trailing?: ReactNode }) {
  const c = useC();
  return (
    <View style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 }}>
      {onBack ? (
        <Press onPress={onBack} label="Back" style={{ height: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8 }}>
          <Chevron color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 17, fontWeight: "500" }}>Back</Text>
        </Press>
      ) : (
        <View style={{ width: 64 }} />
      )}
      <Text numberOfLines={1} style={{ color: c.fg, fontSize: 17, fontWeight: "600", flexShrink: 1 }}>{title}</Text>
      <View style={{ minWidth: 64, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" }}>{trailing}</View>
    </View>
  );
}

export function back() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Pull-to-refresh: the one user-initiated sync. */
function usePull() {
  const [pulling, setPulling] = useState(false);
  const onRefresh = async () => {
    setPulling(true);
    await refresh().catch(() => {});
    setPulling(false);
  };
  return { pulling, onRefresh };
}

/** Tab root: large title header, 16 px gutters, room for the floating tab bar, pull to refresh. */
export function TabScreen({ children, refreshable = true }: { children: ReactNode; refreshable?: boolean }) {
  const c = useC();
  const insets = useSafeAreaInsets();
  const { pulling, onRefresh } = usePull();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 112 }}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshable ? <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

/** Push screen: TopBar pinned, body scrolls. */
export function PushScreen({ title, trailing, header, children, refreshable = false }: { title?: string; trailing?: ReactNode; header?: ReactNode; children: ReactNode; refreshable?: boolean }) {
  const c = useC();
  const insets = useSafeAreaInsets();
  const { pulling, onRefresh } = usePull();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ backgroundColor: c.bg }}>
        <TopBar title={title} onBack={back} trailing={trailing} />
        {header}
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshable ? <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function LargeTitle({ children, right, subtitle }: { children: ReactNode; right?: ReactNode; subtitle?: ReactNode }) {
  const c = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: 4, marginBottom: 16 }}>
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: c.fg, fontSize: 34, fontWeight: "700", letterSpacing: tight(34), lineHeight: 38 }}>{children}</Text>
        {subtitle ? <View style={{ marginTop: 6 }}>{subtitle}</View> : null}
      </View>
      {right}
    </View>
  );
}

/** 44 pt round header button on bg-elevated (C67 HeaderBtn). */
export function HeaderBtn({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const c = useC();
  return (
    <Press onPress={onPress} label={label} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.elevated, alignItems: "center", justifyContent: "center" }}>
      {children}
    </Press>
  );
}

// ---------- icons (C67 SVGs) ----------

export function Chevron({ color }: { color: string }) {
  return (
    <Svg width={12} height={20} viewBox="0 0 12 20" fill="none">
      <Path d="M10 2L2 10L10 18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

export function ListIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 22 22" fill="none">
      <Path d="M5 6H17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M5 11H17" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M5 16H13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={11} r={3} stroke={color} strokeWidth={1.7} />
      <Path
        d="M11 3.5V5.5M11 16.5V18.5M3.5 11H5.5M16.5 11H18.5M5.8 5.8L7.2 7.2M14.8 14.8L16.2 16.2M16.2 5.8L14.8 7.2M7.2 14.8L5.8 16.2"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function LockIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={16} viewBox="0 0 14 16" fill="none">
      <Rect x={1} y={7} width={12} height={8} rx={2} stroke={color} strokeWidth={1.6} />
      <Path d="M4 7V4.5a3 3 0 0 1 6 0V7" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

/** C67 two-tier step mark. */
export function CatalystMark({ size = 22, color, accent }: { size?: number; color: string; accent: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M6 52H28V44.5" stroke={color} strokeWidth={5} strokeLinecap="square" strokeLinejoin="miter" />
      <Path d="M28 23.5V16H58" stroke={color} strokeWidth={5} strokeLinecap="square" strokeLinejoin="miter" />
      <Circle cx={28} cy={34} r={6.5} fill={accent} />
    </Svg>
  );
}

export function phaseColor(c: ThemeColors, phase: string) {
  if (phase === "open") return c.positive;
  if (phase === "pre" || phase === "after") return c.warn;
  return c.faint;
}

/** C67 .session-dot. */
export function SessionDot({ color }: { color: string }) {
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 6, alignSelf: "center" }} />;
}

export const dirColor = (c: ThemeColors, d?: string | null) => (d === "up" ? c.positive : d === "down" ? c.negative : c.fg);
export const dirLabel = (d?: string | null) => (d === "up" ? "Up" : d === "down" ? "Down" : d === "flat" ? "Flat" : "—");
