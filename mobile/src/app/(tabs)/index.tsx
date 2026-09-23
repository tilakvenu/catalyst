import { useColorScheme } from "react-native";
import { router } from "expo-router";
import { PortScreen } from "../../screens/PortScreen";
import type { ThemeName } from "../../theme";

export default function CatalystTab() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  return <PortScreen title="Catalyst" scheme={scheme} onGear={() => router.push("/about")} />;
}
