import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useColorScheme } from "react-native";
import { requestReplay } from "../launch/session";
import { SCORING_RULE_VERSION } from "../lib/shared";
import { themeFor, type ThemeName } from "../theme";

export default function AboutScreen() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  const theme = themeFor(scheme);
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.fg }]}>About</Text>
      <Text style={[styles.body, { color: theme.muted }]}>
        Catalyst C67.2. Scoring rule {SCORING_RULE_VERSION}, shared with the frozen web app.
      </Text>
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
  buttonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "600",
  },
});
