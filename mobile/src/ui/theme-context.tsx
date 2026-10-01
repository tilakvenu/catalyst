// C67 Appearance preference (dark / light / system). A device-only UI preference, kept in AsyncStorage;
// it is not backend data (the server's _User.theme has no data-layer setter yet, see DEFERRED.md).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import type { ThemePref } from "../../../src/lib/catalyst/types.ts";
import { themeFor, type ThemeColors, type ThemeName } from "../theme";

const KEY = "catalyst.themePref.v1";

type ThemeValue = { name: ThemeName; c: ThemeColors; pref: ThemePref; setPref: (p: ThemePref) => void };

const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "dark" || v === "light" || v === "system") setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const name: ThemeName = pref === "system" ? (system === "light" ? "light" : "dark") : pref;
    return {
      name,
      c: themeFor(name),
      pref,
      setPref: (p) => {
        setPrefState(p);
        AsyncStorage.setItem(KEY, p).catch(() => {});
      },
    };
  }, [pref, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme outside ThemeProvider");
  return v;
}
