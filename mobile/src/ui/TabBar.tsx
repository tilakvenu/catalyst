// C67 tab-bar.tsx: a floating glass capsule (chrome only), four activities, no badges.
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { TAB_BAR_ITEMS } from "../../../src/lib/catalyst/nav.ts";
import type { TabId } from "../../../src/lib/catalyst/types.ts";
import { useTheme } from "./theme-context";

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ROUTE_FOR: Record<TabId, string> = { catalyst: "index", calendar: "calendar", tape: "tape", record: "record" };

export function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const activeRoute = state.routes[state.index]?.name;
  return (
    <View style={{ pointerEvents: "box-none", position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 8, alignItems: "center", paddingHorizontal: 12 }}>
      <View
        accessibilityRole="tablist"
        style={{
          width: "100%",
          maxWidth: 348,
          height: 62,
          borderRadius: 999,
          paddingHorizontal: 4,
          flexDirection: "row",
          backgroundColor: c.glass,
          borderWidth: 0.5,
          borderColor: c.glassStroke,
          boxShadow: name === "light" ? "0 8px 32px rgba(0, 0, 0, 0.08)" : "0 8px 32px rgba(0, 0, 0, 0.3)",
        }}
      >
        {TAB_BAR_ITEMS.map((it) => {
          const routeName = ROUTE_FOR[it.id];
          const on = activeRoute === routeName;
          const color = on ? c.accent : c.tabIdle;
          return (
            <Pressable
              key={it.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={it.label}
              onPress={() => {
                const route = state.routes.find((r) => r.name === routeName);
                if (!route) return;
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!on && !event.defaultPrevented) navigation.navigate(routeName);
              }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
            >
              <TabIcon id={it.id} color={color} active={on} />
              <Text style={{ color, fontSize: 10, fontWeight: "500" }}>{it.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabIcon({ id, color, active }: { id: TabId; color: string; active: boolean }) {
  const sw = active ? 2 : 1.6;
  if (id === "catalyst")
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Circle cx={11} cy={11} r={7.5} stroke={color} strokeWidth={sw} />
        <Circle cx={11} cy={11} r={2.25} fill={color} />
      </Svg>
    );
  if (id === "calendar")
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Rect x={3.5} y={5} width={15} height={13.5} rx={2.5} stroke={color} strokeWidth={sw} />
        <Path d="M3.5 9.5H18.5" stroke={color} strokeWidth={sw} />
        <Path d="M7.5 3.5V6.5M14.5 3.5V6.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  if (id === "tape")
    return (
      <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
        <Rect x={4} y={4.5} width={14} height={13} rx={2.5} stroke={color} strokeWidth={sw} />
        <Path d="M7 9H15" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M7 12.5H12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </Svg>
    );
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <Path d="M4 16L8.5 11.5L12 14L18 7" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
