// C67 JournalSheet: the call sheet (Cancel · kicker · status pill, event title, composer).
import { useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { entryFor } from "../../../../src/lib/catalyst/selectors.ts";
import { isEntryComplete } from "../../../../src/lib/catalyst/types.ts";
import { CallComposer } from "../../ui/CallComposer";
import { back, GhostButton, Pill, useC } from "../../ui/kit";
import { labelOf, useSlice } from "../../ui/slice";

export default function JournalSheet() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const c = useC();
  const s = useSlice();
  const insets = useSafeAreaInsets();
  const event = s.eventById[eventId];
  const draft = entryFor(s, eventId);
  const kicker = event ? labelOf(s, event).kicker : "Call";
  const complete = draft ? isEntryComplete(draft) : false;
  const blank = !draft?.direction && !draft?.conviction && !draft?.reasoning?.trim() && !draft?.invalidation?.trim();
  const locked = Boolean(draft?.lockedAt);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ alignItems: "center", paddingTop: 8 }}>
        <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: c.hairline }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 }}>
        <GhostButton onPress={back} style={{ paddingLeft: 0 }}>
          Cancel
        </GhostButton>
        <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{kicker}</Text>
        <Pill tone={locked ? "pos" : complete ? "accent" : blank ? "neutral" : "warn"}>{locked ? "Locked" : complete ? "Ready" : blank ? "New" : "Draft"}</Pill>
      </View>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 20, paddingBottom: 12 }}>{event?.title ?? "This event is not on this device. Pull to refresh."}</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        {event ? <CallComposer eventId={eventId} layout="sheet" onLock={back} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
