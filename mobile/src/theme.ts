/**
 * C67 color tokens. Hex values match src/styles.css [data-theme] blocks.
 * impact-med is the sRGB mix used by CSS color-mix (55% violet, 45% gray).
 */

export type ThemeName = "light" | "dark";

export type ThemeColors = {
  bg: string;
  elevated: string;
  card: string;
  fg: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
  accentInk: string;
  positive: string;
  negative: string;
  warn: string;
  impactHigh: string;
  impactMed: string;
  /** C67 --fill-urgency: calm event edge, neutral bar segments, toggle track. */
  urgency: string;
  /** C67 --glass / --glass-stroke: chrome only (tab bar). */
  glass: string;
  glassStroke: string;
  /** C67 --seg-track / --seg-thumb: segmented controls and filter chips. */
  segTrack: string;
  segThumb: string;
  /** C67 --tab-idle. */
  tabIdle: string;
};

export const darkTheme: ThemeColors = {
  bg: "#000000",
  elevated: "#1c1c1e",
  card: "#1c1c1e",
  fg: "#f5f5f7",
  muted: "#8e8e93",
  faint: "#636366",
  hairline: "#38383a",
  accent: "#0a84ff",
  accentInk: "#ffffff",
  positive: "#30d158",
  negative: "#ff453a",
  warn: "#ff9f0a",
  impactHigh: "#bf5af2",
  impactMed: "#a971c7",
  urgency: "#3a3a3c",
  glass: "#2c2c2e",
  glassStroke: "#545458",
  segTrack: "#2c2c2e",
  segThumb: "#636366",
  tabIdle: "#8e8e93",
};

export const lightTheme: ThemeColors = {
  bg: "#f2f2f7",
  elevated: "#ffffff",
  card: "#ffffff",
  fg: "#1d1d1f",
  muted: "#6e6e73",
  faint: "#8e8e93",
  hairline: "#c6c6c8",
  accent: "#007aff",
  accentInk: "#ffffff",
  positive: "#34c759",
  negative: "#ff3b30",
  warn: "#ff9500",
  impactHigh: "#af52de",
  impactMed: "#925fae",
  urgency: "#d1d1d6",
  glass: "#f7f7f8",
  glassStroke: "#d1d1d6",
  segTrack: "#e5e5ea",
  segThumb: "#ffffff",
  tabIdle: "#8e8e93",
};

/** C67 color-mix(in srgb, <hex> N%, transparent) as rgba. */
export function alpha(hexColor: string, a: number): string {
  const [r, g, b] = hex(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function themeFor(name: ThemeName): ThemeColors {
  return name === "light" ? lightTheme : darkTheme;
}

export function mixSrgb(a: string, b: string, weightA: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const channels = pa.map((v, i) => Math.round(v * weightA + pb[i] * (1 - weightA)));
  return "#" + channels.map((n) => n.toString(16).padStart(2, "0")).join("");
}

function hex(value: string): [number, number, number] {
  const s = value.slice(1);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
