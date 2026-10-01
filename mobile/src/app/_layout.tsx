import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { LaunchOverlay } from "../launch/LaunchOverlay";
import { readLaunchQuery } from "../launch/query";
import { hasPlayedLaunch, markLaunchPlayed, subscribeReplay } from "../launch/session";
import { shouldSkipForWebdriver } from "../launch/launch-spec";
import { SCORING_RULE_VERSION } from "../lib/shared";
import { DataRoot } from "../data/DataRoot";
import { ThemeProvider, useTheme } from "../ui/theme-context";

if (SCORING_RULE_VERSION !== 1) {
  throw new Error("C67 scoring rule did not load");
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  );
}

function Root() {
  const { c: theme, name: scheme } = useTheme();
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

  const sheet = { presentation: "modal" as const, contentStyle: { backgroundColor: theme.bg } };

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <DataRoot theme={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="watch" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="event/[id]" />
          <Stack.Screen name="ticker/[id]" />
          <Stack.Screen name="article/[id]" />
          <Stack.Screen name="headlines" />
          <Stack.Screen name="journal/[eventId]" options={sheet} />
          <Stack.Screen name="add" options={sheet} />
          <Stack.Screen name="macro" options={sheet} />
          <Stack.Screen name="import" options={sheet} />
          <Stack.Screen
            name="backend-check"
            options={{
              headerShown: true,
              title: "Backend check",
              presentation: "card",
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.accent,
              headerTitleStyle: { color: theme.fg },
              headerShadowVisible: false,
            }}
          />
        </Stack>
      </DataRoot>
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
