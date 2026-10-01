// C67 news.tsx ArticleSheet: one headline, its impact read, open the name, read the source.
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";
import { ageLabel } from "../../../../src/lib/catalyst/format.ts";
import { impactLabel, impactWeight, kindLabel } from "../../../../src/lib/catalyst/impact.ts";
import { Pill, PrimaryButton, PushScreen, SecondaryButton, tight, useC } from "../../ui/kit";
import { impactTint, openTicker } from "../../ui/parts";
import { useSlice } from "../../ui/slice";

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useC();
  const s = useSlice();
  const h = s.headlines.find((x) => x.id === id);
  const ticker = h?.tickerId ? s.allTickers[h.tickerId] : undefined;
  const kicker = ticker?.symbol ?? (h?.macroId ? s.allMacros[h.macroId]?.shortName : undefined) ?? "Tape";

  if (!h) {
    return (
      <PushScreen title="Tape">
        <Text style={{ color: c.muted, fontSize: 15, marginTop: 8 }}>This headline is not on this device anymore.</Text>
      </PushScreen>
    );
  }
  return (
    <PushScreen title={kicker}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        <Text style={{ color: impactTint(c, h.impact), fontSize: 12, fontWeight: impactWeight(h.impact) === "semibold" ? "600" : "400" }}>{impactLabel(h.impact)}</Text>
        <Pill>{kindLabel(h.kind)}</Pill>
        {h.scoredBy === "grok" ? <Pill tone="accent">Grok</Pill> : null}
      </View>
      <Text selectable style={{ color: c.fg, fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: tight(22), marginTop: 12 }}>
        {h.title}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 8 }}>
        {h.source} · {ageLabel(h.publishedAt, s.now)}
      </Text>
      {h.why ? <Text style={{ color: c.fg, fontSize: 14, lineHeight: 22, marginTop: 16, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: c.card, overflow: "hidden" }}>{h.why}</Text> : null}
      {ticker ? (
        <View style={{ marginTop: 20 }}>
          <SecondaryButton onPress={() => openTicker(ticker.id)}>Open {ticker.symbol}</SecondaryButton>
        </View>
      ) : null}
      {h.url ? (
        <View style={{ marginTop: 8 }}>
          <PrimaryButton onPress={() => WebBrowser.openBrowserAsync(h.url!).catch(() => {})}>Read source</PrimaryButton>
        </View>
      ) : null}
    </PushScreen>
  );
}
