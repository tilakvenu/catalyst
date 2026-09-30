// Minimal sign-in / create-account screen. Grok restyles; the contract is signIn/signUp from src/data.
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThemeColors } from "../theme";
import { signIn, signUp } from "./auth.ts";

export function AuthScreen({ theme, unconfigured }: { theme: ThemeColors; unconfigured: boolean }) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (unconfigured) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.fg }]}>Backend not configured</Text>
        <Text style={[styles.body, { color: theme.muted }]}>
          Copy mobile/.env.example to mobile/.env, fill in the Back4App Application ID, JavaScript key and server URL, then restart
          npx expo start.
        </Text>
      </View>
    );
  }

  const canSubmit = /\S+@\S+\.\S+/.test(email) && password.length >= 8 && !busy;
  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await (mode === "signIn" ? signIn(email, password) : signUp(email, password));
    } catch (e) {
      const err = e as { code?: number; message?: string };
      setError(err.code === 100 ? "Can't reach the server. Check your connection and try again." : err.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.fg }]}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>Your watchlist and locked calls follow you to any device.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.faint}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        style={[styles.input, { backgroundColor: theme.card, color: theme.fg, borderColor: theme.hairline }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password (8+ characters)"
        placeholderTextColor={theme.faint}
        secureTextEntry
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        textContentType={mode === "signIn" ? "password" : "newPassword"}
        onSubmitEditing={submit}
        style={[styles.input, { backgroundColor: theme.card, color: theme.fg, borderColor: theme.hairline }]}
      />
      {error ? <Text style={[styles.error, { color: theme.negative }]}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={!canSubmit}
        onPress={submit}
        style={[styles.button, { backgroundColor: theme.accent, opacity: canSubmit ? 1 : 0.5 }]}
      >
        {busy ? <ActivityIndicator color={theme.accentInk} /> : <Text style={[styles.buttonText, { color: theme.accentInk }]}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setError(null); }} style={styles.switch}>
        <Text style={{ color: theme.accent, fontSize: 16 }}>{mode === "signIn" ? "New here? Create an account" : "Have an account? Sign in"}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 34, fontWeight: "700" },
  body: { marginTop: 8, marginBottom: 20, fontSize: 16, lineHeight: 22 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, fontSize: 17, marginTop: 12 },
  error: { marginTop: 12, fontSize: 15 },
  button: { marginTop: 20, minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 17, fontWeight: "600" },
  switch: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
});
