// C67 watchlist.tsx useReveal: swipe left (or long-press) to reveal row actions; tap opens.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { useC } from "./kit";

export type SwipeAction = { label: string; onPress: () => void; tone?: "neg" | "neutral" };
const ACTION_W = 84;

export function SwipeRow({ open, onToggle, onOpen, actions, children }: { open: boolean; onToggle: () => void; onOpen: () => void; actions: SwipeAction[]; children: ReactNode }) {
  const c = useC();
  const width = ACTION_W * actions.length;
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: open ? -width : 0, duration: 200, useNativeDriver: Platform.OS !== "web" }).start();
  }, [open, width, x]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx < -48 && !open) onToggle();
          if (g.dx > 48 && open) onToggle();
        },
      }),
    [open, onToggle],
  );

  return (
    <View style={{ borderRadius: 22, overflow: "hidden" }}>
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width, flexDirection: "row" }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={() => {
              a.onPress();
              onToggle();
            }}
            style={{ width: ACTION_W, alignItems: "center", justifyContent: "center", backgroundColor: a.tone === "neg" ? c.negative : c.elevated }}
          >
            <Text style={{ color: a.tone === "neg" ? "#ffffff" : c.fg, fontSize: 13, fontWeight: "600" }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Long-press for mute and remove"
          onPress={() => (open ? onToggle() : onOpen())}
          onLongPress={onToggle}
          style={{ backgroundColor: c.card }}
        >
          {children}
        </Pressable>
      </Animated.View>
    </View>
  );
}
