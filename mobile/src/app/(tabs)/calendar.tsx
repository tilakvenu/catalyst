import { useColorScheme } from "react-native";
import { PortScreen } from "../../screens/PortScreen";
import type { ThemeName } from "../../theme";

export default function CalendarTab() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  return <PortScreen title="Calendar" scheme={scheme} />;
}
