// C67 watchlist.tsx MacroSheet: follow the six macro releases as first-class events.
import { useState } from "react";
import { Text, View } from "react-native";
import { addWatch, removeWatch } from "../data";
import { Press, useC } from "../ui/kit";
import { SheetFrame } from "../ui/Sheet";
import { useSlice } from "../ui/slice";

const ORDER = ["cpi", "fomc", "nfp", "ppi", "gdp", "ism"];

export default function MacroSheet() {
  const c = useC();
  const s = useSlice();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const catalog = Object.values(s.allMacros).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));

  return (
    <SheetFrame title="Follow macro">
      <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, marginBottom: 16 }}>Macro releases are first-class. They have no quote — they show “Macro” on the watchlist.</Text>
      {error ? <Text style={{ color: c.warn, fontSize: 12, marginBottom: 8 }}>{error}</Text> : null}
      <View style={{ gap: 8, paddingBottom: 32 }}>
        {catalog.map((m) => {
          const following = s.macros.find((x) => x.id === m.id);
          return (
            <Press
              key={m.id}
              disabled={busy !== null}
              onPress={async () => {
                setBusy(m.id);
                setError(null);
                try {
                  if (following) await removeWatch(following.watchItemId);
                  else await addWatch({ macroId: m.id });
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(null);
                }
              }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: c.card }}
            >
              <View style={{ flexShrink: 1 }}>
                <Text style={{ color: c.fg, fontWeight: "600", fontSize: 15 }}>{m.shortName}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>{m.name}</Text>
              </View>
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: "500" }}>{busy === m.id ? "…" : following ? "Following" : "Follow"}</Text>
            </Press>
          );
        })}
      </View>
    </SheetFrame>
  );
}
