import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useColorScheme } from "react-native";
import { requestReplay } from "../launch/session";
import { SCORING_RULE_VERSION } from "../lib/shared";
import { deleteAccount, signOut, useSession } from "../data";
import { themeFor, type ThemeName } from "../theme";

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

export default function AboutScreen() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  const theme = themeFor(scheme);
  const session = useSession();
  const [busy, setBusy] = useState<null | "signOut" | "delete">(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "signOut" | "delete") => {
    if (kind === "delete") {
      const ok = await confirm(
        "Delete account?",
        "This permanently deletes your account, watchlist, and every locked call and its history. It cannot be undone.",
        "Delete",
      );
      if (!ok) return;
    }
    setBusy(kind);
    setError(null);
    try {
      await (kind === "delete" ? deleteAccount() : signOut());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.fg }]}>About</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Catalyst C67.3. Scoring rule {SCORING_RULE_VERSION}, shared with the frozen web app.
      </Text>
      {session.status === "signedIn" ? (
        <Text style={[styles.body, { color: theme.muted }]}>Signed in as {session.user.email}</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          requestReplay();
          router.back();
        }}
        style={[styles.button, { backgroundColor: theme.accent }]}
      >
        <Text style={styles.buttonText}>Replay launch animation</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/backend-check")}
        style={[styles.button, styles.secondary, { backgroundColor: theme.card }]}
      >
        <Text style={[styles.buttonText, { color: theme.accent }]}>Backend check</Text>
      </Pressable>
      {session.status === "signedIn" ? (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => run("signOut")}
            style={[styles.button, styles.secondary, { backgroundColor: theme.card, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: theme.accent }]}>{busy === "signOut" ? "Signing out…" : "Sign out"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy !== null}
            onPress={() => run("delete")}
            style={[styles.button, styles.secondary, { backgroundColor: theme.card, opacity: busy ? 0.5 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: theme.negative }]}>{busy === "delete" ? "Deleting…" : "Delete account"}</Text>
          </Pressable>
        </>
      ) : null}
      {error ? <Text style={[styles.body, { color: theme.negative }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
  },
  body: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 22,
  },
  button: {
    marginTop: 28,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondary: {
    marginTop: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
});
