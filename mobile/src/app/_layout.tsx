import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { LaunchOverlay } from "../launch/LaunchOverlay";
import { readLaunchQuery } from "../launch/query";
import { hasPlayedLaunch, markLaunchPlayed, subscribeReplay } from "../launch/session";
import { shouldSkipForWebdriver } from "../launch/launch-spec";
import { themeFor, type ThemeName } from "../theme";
import { SCORING_RULE_VERSION } from "../lib/shared";

if (SCORING_RULE_VERSION !== 1) {
  throw new Error("C67 scoring rule did not load");
}

export default function RootLayout() {
  const scheme: ThemeName = useColorScheme() === "light" ? "light" : "dark";
  const theme = themeFor(scheme);
  const [showLaunch, setShowLaunch] = useState(false);
  const [frame, setFrame] = useState<number | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    const query = readLaunchQuery();
    if (query.frame != null) {
      setFrame(query.frame);
      setShowLaunch(true);
      return;
    }
    const skip = shouldSkipForWebdriver({
      platform: query.platform,
      webdriver: query.webdriver,
      launchParam: query.launch,
    });
    if (skip) {
      markLaunchPlayed();
      return;
    }
    if (!hasPlayedLaunch()) setShowLaunch(true);
    return subscribeReplay(() => {
      setFrame(null);
      setReplayKey((n) => n + 1);
      setShowLaunch(true);
    });
  }, []);

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="about" options={{ headerShown: true, title: "About", presentation: "card" }} />
      </Stack>
      {showLaunch ? (
        <LaunchOverlay
          key={replayKey}
          accent={theme.accent}
          ink={theme.fg}
          background={theme.bg}
          frame={frame}
          onDone={() => setShowLaunch(false)}
        />
      ) : null}
    </>
  );
}
