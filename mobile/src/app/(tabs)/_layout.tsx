import { Tabs } from "expo-router";
import { GlassTabBar } from "../../ui/TabBar";
import { useTheme } from "../../ui/theme-context";

export default function TabLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
    >
      <Tabs.Screen name="index" options={{ title: "Catalyst" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="tape" options={{ title: "Tape" }} />
      <Tabs.Screen name="record" options={{ title: "Record" }} />
    </Tabs>
  );
}
