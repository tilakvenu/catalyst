import { Platform } from "react-native";

export function readLaunchQuery(): { platform: string; webdriver: boolean; launch: boolean; frame: number | null } {
  const platform = Platform.OS;
  if (platform !== "web" || typeof window === "undefined") {
    return { platform, webdriver: false, launch: false, frame: null };
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("frame");
  const frame = raw != null && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : null;
  const webdriver = typeof navigator !== "undefined" && navigator.webdriver === true;
  return { platform, webdriver, launch: params.get("launch") === "1", frame };
}
