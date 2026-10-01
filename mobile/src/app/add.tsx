// C67 watchlist.tsx AddSheet: add a ticker the server tracks; links to macro and CSV import.
import { router } from "expo-router";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { addWatch } from "../data";
import { back, Pill, Press, R, useC } from "../ui/kit";
import { SheetFrame } from "../ui/Sheet";
import { useSlice } from "../ui/slice";

export default function AddSheet() {
  const c = useC();
  const s = useSlice();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const hits = Object.values(s.allTickers)
    .filter((h) => !needle || h.symbol.toLowerCase().includes(needle) || h.company.toLowerCase().includes(needle))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .slice(0, 12);

  return (
    <SheetFrame title="Add ticker">
      <TextInput
        autoFocus
        value={q}
        onChangeText={setQ}
        placeholder="Search ticker or company"
        placeholderTextColor={c.faint}
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ height: 44, borderRadius: R.btn, paddingHorizontal: 14, fontSize: 16, color: c.fg, backgroundColor: c.elevated, marginBottom: 12 }}
      />
      {error ? <Text style={{ color: c.warn, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
      <View style={{ gap: 4, paddingBottom: 16 }}>
        {hits.map((h) => {
          const watched = s.tickers.some((t) => t.id === h.id);
          return (
            <Press
              key={h.id}
              disabled={watched || busy !== null}
              onPress={async () => {
                setBusy(h.id);
                setError(null);
                try {
                  await addWatch({ tickerId: h.id });
                  back();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(null);
                }
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: R.btn, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: c.card }}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: c.fg, fontWeight: "600", fontSize: 15 }}>{h.symbol}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>{h.company}</Text>
              </View>
              {watched ? <Pill>On watchlist</Pill> : <Text style={{ color: c.accent, fontSize: 13 }}>{busy === h.id ? "Adding…" : "Add"}</Text>}
            </Press>
          );
        })}
      </View>
      <Press onPress={() => router.replace("/macro")} style={{ marginBottom: 8 }}>
        <Text style={{ color: c.accent, fontSize: 14, fontWeight: "500" }}>Follow macro events</Text>
      </Press>
      <Press onPress={() => router.replace("/import")}>
        <Text style={{ color: c.accent, fontSize: 14, fontWeight: "500" }}>Import from a broker CSV</Text>
      </Press>
    </SheetFrame>
  );
}
