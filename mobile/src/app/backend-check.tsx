// Gear > About > Backend check. Reads the cache and counters only. Requests happen only on a tap:
// pull down / "Sync now", and the two Debug actions (for the Phase 6 cross-device check; remove once
// the real Names and Journal screens are ported).
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { addWatch, backendConfigured, currentUser, lockCall, refresh, saveDraft, useRecord, useSyncState, useWatchlist } from "../data";
import { getCache } from "../data/cache";
import type { ThemeColors } from "../theme";
import { useTheme } from "../ui/theme-context";

function DebugActions({ theme, enabled }: { theme: ThemeColors; enabled: boolean }) {
  const wl = useWatchlist();
  const rec = useRecord();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const events = getCache().events;

  const watched = [
    ...wl.tickers.map((t) => `${t.symbol}${t.held ? " (held)" : ""}${t.muted ? " (muted)" : ""}`),
    ...wl.macros.map((m) => `${m.shortName}${m.muted ? " (muted)" : ""}`),
  ];
  const calls = rec.entries.map((e) => {
    const title = events[e.eventId]?.title ?? e.eventId;
    return `${title}: ${e.direction}, conviction ${e.conviction}, locked ${e.lockedAt ? new Date(e.lockedAt).toLocaleString() : "?"}`;
  });

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const watchTwo = () =>
    run(async () => {
      const have = new Set([...wl.tickers.map((t) => t.id), ...wl.macros.map((m) => m.id)]);
      const aapl = wl.universe.tickers.find((t) => t.symbol === "AAPL");
      const cpi = wl.universe.macros.find((m) => m.shortName === "CPI");
      let added = 0;
      if (aapl && !have.has(aapl.id)) added += (await addWatch({ tickerId: aapl.id }), 1);
      if (cpi && !have.has(cpi.id)) added += (await addWatch({ macroId: cpi.id }), 1);
      return added ? `Added ${added} to your watchlist.` : "Already watching AAPL and CPI.";
    });

  const lockSample = () =>
    run(async () => {
      const s = getCache();
      const aapl = Object.values(s.tickers).find((t) => t.symbol === "AAPL");
      const next = Object.values(s.events)
        .filter((e) => e.tickerId === aapl?.id && Date.parse(e.startsAt) > Date.now())
        .sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0];
      if (!next) throw new Error("No upcoming AAPL event on this device. Pull to refresh.");
      saveDraft(next.id, { direction: "up", conviction: 3, reasoning: "Cross-device check: locked on this device.", wrongIf: "Services growth under 10%." });
      const c = await lockCall(next.id);
      return `Locked "${next.title}" at ${new Date(c.lockedAt).toLocaleTimeString()}.`;
    });

  return (
    <View style={{ marginTop: 28 }}>
      <Text style={[styles.section, { color: theme.muted }]}>ON THIS ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.muted }]}>Watching</Text>
          <Text selectable style={[styles.value, { color: theme.fg }]}>{watched.length ? watched.join(", ") : "nothing yet"}</Text>
        </View>
        <View style={[styles.row, { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <Text style={[styles.label, { color: theme.muted }]}>Locked calls</Text>
          <Text selectable style={[styles.value, { color: theme.fg }]}>{calls.length ? calls.join("\n") : "none yet"}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: devOpen }}
        onPress={() => setDevOpen(!devOpen)}
        style={{ marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <Text style={[styles.section, { color: theme.muted, marginBottom: 0 }]}>DEVELOPER</Text>
        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: "500", marginRight: 16 }}>{devOpen ? "Hide" : "Show"}</Text>
      </Pressable>
      {devOpen ? (
      <View style={{ marginTop: 8 }}>
      <Pressable accessibilityRole="button" onPress={watchTwo} disabled={busy || !enabled} style={[styles.button, { marginTop: 0, backgroundColor: theme.card, opacity: busy || !enabled ? 0.5 : 1 }]}>
        <Text style={[styles.buttonText, { color: theme.accent }]}>Watch AAPL + CPI</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={lockSample} disabled={busy || !enabled} style={[styles.button, { marginTop: 12, backgroundColor: theme.card, opacity: busy || !enabled ? 0.5 : 1 }]}>
        <Text style={[styles.buttonText, { color: theme.accent }]}>Lock a sample AAPL call</Text>
      </Pressable>
      {msg ? <Text style={[styles.note, { color: theme.fg }]}>{msg}</Text> : null}
      <Text style={[styles.note, { color: theme.faint }]}>Debug actions for the cross-device check. Watch = 1 request per name added; lock = 1 request.</Text>
      </View>
      ) : null}
    </View>
  );
}

export default function BackendCheckScreen() {
  const theme = useTheme().c;
  const s = useSyncState();
  const [pulling, setPulling] = useState(false);
  const user = currentUser();

  const sync = async () => {
    setPulling(true);
    await refresh().catch(() => {});
    setPulling(false);
  };

  const rows: [string, string][] = [
    ["Backend", backendConfigured ? "configured" : "not configured (mobile/.env)"],
    ["Signed in as", user ? user.email : "nobody"],
    ["Watchlist items", String(s.counts.watchItems)],
    ["Locked calls", String(s.counts.calls)],
    ["Drafts on this phone", String(s.counts.drafts)],
    ["Cached events / headlines", `${s.counts.events} / ${s.counts.headlines}`],
    ["Last sync", s.lastSyncAt ? `${new Date(s.lastSyncAt).toLocaleString()} (${s.lastSyncReason})` : "never"],
    ["Server cursor", s.cursor ?? "none (next sync is full)"],
    ["Requests this session", String(s.requestCount)],
    ["Sync status", s.syncing ? "syncing…" : s.error ? `error: ${s.error}` : "idle"],
  ];

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={sync} tintColor={theme.muted} />}
    >
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
            <Text selectable style={[styles.value, { color: label === "Requests this session" ? theme.accent : theme.fg }]}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={sync} disabled={pulling || !user} style={[styles.button, { backgroundColor: theme.accent, opacity: pulling || !user ? 0.5 : 1 }]}>
        <Text style={[styles.buttonText, { color: theme.accentInk }]}>{pulling ? "Syncing…" : "Sync now"}</Text>
      </Pressable>
      <DebugActions theme={theme} enabled={!!user} />
      <Text style={[styles.note, { color: theme.faint }]}>
        The app syncs on open, on return after 15+ minutes, after a write, and when you pull to refresh. Never on tab switch or a timer.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  card: { borderRadius: 22, paddingHorizontal: 16 },
  row: { paddingVertical: 12 },
  label: { fontSize: 13 },
  value: { fontSize: 17, marginTop: 2 },
  button: { marginTop: 20, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  note: { marginTop: 16, fontSize: 13, lineHeight: 18 },
  section: { fontSize: 13, marginBottom: 8, marginLeft: 16 },
});
