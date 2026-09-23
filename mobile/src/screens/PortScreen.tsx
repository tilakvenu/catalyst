import { Pressable, StyleSheet, Text, View } from "react-native";
import { themeFor, type ThemeName } from "../theme";

export function PortScreen({
  title,
  scheme,
  onGear,
}: {
  title: string;
  scheme: ThemeName;
  onGear?: () => void;
}) {
  const theme = themeFor(scheme);
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {onGear ? (
        <Pressable accessibilityLabel="Settings" onPress={onGear} style={styles.gear} hitSlop={12}>
          <Text style={[styles.gearMark, { color: theme.fg }]}>⚙</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.title, { color: theme.fg }]}>{title}</Text>
      <Text style={[styles.line, { color: theme.muted }]}>Porting from C67.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
  },
  gear: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  gearMark: {
    fontSize: 22,
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  line: {
    marginTop: 8,
    fontSize: 17,
  },
});
