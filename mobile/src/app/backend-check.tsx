// Gear > About > Backend check. Reads the cache and counters only; the one request it can make is the
// user-initiated sync (pull down, or "Sync now").
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { backendConfigured, currentUser, refresh, useSyncState } from "../data";
import { themeFor, type ThemeName } from "../theme";

export default function BackendCheckScreen() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  const theme = themeFor(scheme);
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
});
