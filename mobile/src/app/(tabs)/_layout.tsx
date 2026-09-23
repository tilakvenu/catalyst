import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { themeFor, type ThemeName } from "../../theme";

export default function TabLayout() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  const theme = themeFor(scheme);
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.elevated,
          borderTopColor: theme.hairline,
        },
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Catalyst" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="tape" options={{ title: "Tape" }} />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
    </Tabs>
  );
}
