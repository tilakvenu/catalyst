// C67 ui.tsx SheetFrame: grabber, Cancel · title · trailing, scrolling body.
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { back, GhostButton, useC } from "./kit";

export function SheetFrame({ title, trailing, children }: { title: string; trailing?: ReactNode; children: ReactNode }) {
  const c = useC();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: c.hairline }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <GhostButton onPress={back} style={{ paddingLeft: 0 }}>
          Cancel
        </GhostButton>
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{title}</Text>
        <View style={{ minWidth: 64, alignItems: "flex-end" }}>{trailing}</View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
