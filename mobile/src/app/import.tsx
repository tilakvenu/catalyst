// C67 watchlist.tsx CsvSheet: paste symbols; known names are added (one request each), others skipped.
import { useState } from "react";
import { Text, TextInput } from "react-native";
import { addWatch } from "../data";
import { PrimaryButton, R, useC } from "../ui/kit";
import { SheetFrame } from "../ui/Sheet";
import { useSlice } from "../ui/slice";

export default function ImportSheet() {
  const c = useC();
  const s = useSlice();
  const [text, setText] = useState("NVDA,AAPL,MSFT,JPM,SPY");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; already: number } | null>(null);

  async function run() {
    setBusy(true);
    const bySymbol = new Map(Object.values(s.allTickers).map((t) => [t.symbol.toUpperCase(), t]));
    const watched = new Set(s.tickers.map((t) => t.id));
    const symbols = [...new Set(text.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
    let added = 0;
    let skipped = 0;
    let already = 0;
    for (const sym of symbols) {
      const t = bySymbol.get(sym);
      if (!t) skipped++;
      else if (watched.has(t.id)) already++;
      else {
        try {
          await addWatch({ tickerId: t.id });
          added++;
        } catch {
          skipped++;
        }
      }
    }
    setResult({ added, skipped, already });
    setBusy(false);
  }

  return (
    <SheetFrame title="Import CSV">
      <Text style={{ color: c.muted, fontSize: 14, marginBottom: 12 }}>Paste symbols separated by commas or new lines. Unknown symbols are skipped.</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCapitalize="characters"
        autoCorrect={false}
        style={{ minHeight: 140, borderRadius: R.btn, padding: 12, fontSize: 15, color: c.fg, backgroundColor: c.elevated, textAlignVertical: "top", marginBottom: 12 }}
      />
      <PrimaryButton busy={busy} onPress={run}>
        Import
      </PrimaryButton>
      {result ? (
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 12 }}>
          Added {result.added}, skipped {result.skipped}
          {result.already ? `, ${result.already} already on the watchlist` : ""}.
        </Text>
      ) : null}
    </SheetFrame>
  );
}
