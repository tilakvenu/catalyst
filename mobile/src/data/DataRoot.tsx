// Wraps the app: loads the stored session + cache before deciding what to show (no flash of the wrong
// screen), then overlays the sign-in screen when nobody is signed in. The navigator always stays mounted.
import { useEffect, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ThemeColors } from "../theme";
import { AuthScreen } from "./AuthScreen";
import { hydrateSession, useSession } from "./auth.ts";

export function DataRoot({ theme, children }: { theme: ThemeColors; children: ReactNode }) {
  const session = useSession();
  useEffect(() => {
    hydrateSession();
  }, []);

  return (
    <View style={styles.fill}>
      {children}
      {session.status === "loading" ? <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]} /> : null}
      {session.status === "signedOut" || session.status === "unconfigured" ? (
        <View style={StyleSheet.absoluteFill}>
          <AuthScreen theme={theme} unconfigured={session.status === "unconfigured"} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
