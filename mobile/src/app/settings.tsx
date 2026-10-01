// C67 settings.tsx (push from the Catalyst gear), merged with the old About screen.
// Kept: Notifications timing, Appearance, Account, About. Dropped (no longer meaningful with a backend):
// Demo mode / Live API keys (no vendor keys on the phone), Demo flows, Synthetic model, Seed reset.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { BUILD_NAME, C5_SHA, SCORING_RULE_VERSION } from "../../../src/lib/catalyst/build.ts";
import { FLAT_BAND_MULTIPLE } from "../../../src/lib/catalyst/scoring.ts";
import type { NotifyLead, ThemePref } from "../../../src/lib/catalyst/types.ts";
import { deleteAccount, signOut, useSession } from "../data";
import { requestReplay } from "../launch/session";
import { CatalystMark, Divider, Press, PrimaryButton, PushScreen, SecondaryButton, useC, wide } from "../ui/kit";
import { useTheme } from "../ui/theme-context";

const NOTIFY_KEY = "catalyst.notifyLead.v1";
const NOTIFY_OPTIONS: { id: NotifyLead; label: string }[] = [
  { id: "both", label: "24 hours and 1 hour" },
  { id: "24h", label: "24 hours only" },
  { id: "1h", label: "1 hour only" },
];

/** Alert.alert is a no-op on react-native-web, so web uses window.confirm. */
function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: action, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export default function SettingsScreen() {
  const c = useC();
  const { pref, setPref } = useTheme();
  const session = useSession();
  const [lead, setLead] = useState<NotifyLead>("both");
  const [busy, setBusy] = useState<null | "signOut" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(NOTIFY_KEY)
      .then((v) => {
        if (v === "both" || v === "24h" || v === "1h") setLead(v);
      })
      .catch(() => {});
  }, []);

  const account = async (kind: "signOut" | "delete") => {
    if (kind === "delete") {
      const ok = await confirm("Delete account?", "This permanently deletes your account, watchlist, and every locked call and its history. It cannot be undone.", "Delete");
      if (!ok) return;
    }
    setBusy(kind);
    setError(null);
    try {
      await (kind === "delete" ? deleteAccount() : signOut());
      router.dismissAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <PushScreen title="Settings" trailing={<View style={{ marginRight: 8 }}><CatalystMark size={22} color={c.fg} accent={c.accent} /></View>}>
      <Group title="Notifications">
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: c.fg, fontSize: 15, marginBottom: 8 }}>Alert timing</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {NOTIFY_OPTIONS.map((o) => (
              <Choice
                key={o.id}
                on={lead === o.id}
                label={o.label}
                onPress={() => {
                  setLead(o.id);
                  AsyncStorage.setItem(NOTIFY_KEY, o.id).catch(() => {});
                }}
              />
            ))}
          </View>
        </View>
        <Divider />
        <Text style={{ color: c.faint, fontSize: 12, lineHeight: 19, paddingHorizontal: 16, paddingVertical: 12 }}>
          Only real workflow state: an unlocked call before a print, a material filing, or a result ready. No “come back” nag. Saved on this phone; push alerts are not wired up yet.
        </Text>
      </Group>

      <Group title="Appearance">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: c.fg, fontSize: 15 }}>Theme</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {(["dark", "light", "system"] as ThemePref[]).map((t) => (
              <Choice key={t} on={pref === t} label={t[0]!.toUpperCase() + t.slice(1)} onPress={() => setPref(t)} />
            ))}
          </View>
        </View>
      </Group>

      <Group title="Account">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: c.fg, fontSize: 15 }}>Signed in as</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, flexShrink: 1 }}>{session.status === "signedIn" ? session.user.email : "—"}</Text>
        </View>
        <Divider />
        <Text style={{ color: c.faint, fontSize: 12, lineHeight: 19, paddingHorizontal: 16, paddingVertical: 12 }}>
          Your watchlist and locked calls follow your account to any device. The server stamps every lock; nobody can edit a call once its event starts.
        </Text>
        <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
          <SecondaryButton disabled={busy !== null} onPress={() => account("signOut")}>
            {busy === "signOut" ? "Signing out…" : "Sign out"}
          </SecondaryButton>
          <Press disabled={busy !== null} onPress={() => account("delete")} style={{ height: 48, borderRadius: 14, backgroundColor: c.elevated, alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : 1 }}>
            <Text style={{ color: c.negative, fontSize: 16, fontWeight: "500" }}>{busy === "delete" ? "Deleting…" : "Delete account"}</Text>
          </Press>
          {error ? <Text style={{ color: c.warn, fontSize: 12 }}>{error}</Text> : null}
        </View>
      </Group>

      <Group title="About">
        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          <Text style={{ color: c.faint, fontSize: 12, fontWeight: "600", letterSpacing: -0.24 }}>{BUILD_NAME}.3</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            Call it. Lock it. Learn from it. A decision-calibration system — not a news app, not a brokerage.
          </Text>
          <Text style={{ color: c.faint, fontSize: 12, lineHeight: 19, marginTop: 12 }}>
            Scoring rule v{SCORING_RULE_VERSION} · FLAT_BAND_MULTIPLE = {FLAT_BAND_MULTIPLE}. Typical session excludes known event dates. C5 preserved at {C5_SHA.slice(0, 12)}. Calendar is
            load-bearing: if it goes dark, scoring goes dark.
          </Text>
        </View>
        <View style={{ gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
          <PrimaryButton
            onPress={() => {
              requestReplay();
              router.dismissAll();
            }}
          >
            Replay launch animation
          </PrimaryButton>
          <SecondaryButton onPress={() => router.push("/backend-check")}>Backend check</SecondaryButton>
        </View>
      </Group>
    </PushScreen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const c = useC();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600", letterSpacing: wide(13), textTransform: "uppercase", paddingHorizontal: 4, marginBottom: 8 }}>{title}</Text>
      <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: c.card }}>{children}</View>
    </View>
  );
}

function Choice({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const c = useC();
  return (
    <Press onPress={onPress} style={{ height: 32, borderRadius: 999, paddingHorizontal: 12, justifyContent: "center", backgroundColor: on ? c.accent : c.elevated }}>
      <Text style={{ color: on ? c.accentInk : c.muted, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </Press>
  );
}
