import { describe, expect, it } from "vitest";
import { darkTheme, lightTheme, mixSrgb } from "../theme";
import {
  BEAD_RADIUS,
  CEILING_MS,
  LAUNCH_ROWS,
  MARK_PATH,
  MARK_PATH_LENGTH,
  PARTICLE_COUNT,
  PARTICLE_SEED,
  TOTAL_MS,
  framePose,
  launchLayers,
  particleProgress,
  particleRadius,
  particleStart,
  pathLength,
  shouldSkipForWebdriver,
} from "./launch-spec";
import { hasPlayedLaunch, markLaunchPlayed, requestReplay, resetLaunchSession, subscribeReplay } from "./session";

const TABLE = [
  [0, "overlay"],
  [120, "markGroup"],
  [120, "markGhost"],
  [600, "bead"],
  [680, "wordmark"],
  [900, "spirals"],
  [900, "spiralGroup"],
  [1000, "particles"],
  [1350, "markGroup"],
  [1350, "wordmark"],
  [1800, "bead"],
  [1880, "bead"],
  [1880, "shockwave"],
  [2180, "overlay"],
  [2280, "overlay"],
  [2400, "overlay"],
] as const;

describe("launch spec", () => {
  it("exports every row of the timing table", () => {
    expect(LAUNCH_ROWS).toHaveLength(TABLE.length);
    TABLE.forEach(([t, element], i) => {
      expect(LAUNCH_ROWS[i].t).toBe(t);
      expect(LAUNCH_ROWS[i].element).toBe(element);
    });
  });

  it("stays under the 2.8s ceiling", () => {
    expect(TOTAL_MS).toBeLessThanOrEqual(CEILING_MS);
    expect(TOTAL_MS).toBe(2400);
    const last = LAUNCH_ROWS[LAUNCH_ROWS.length - 1];
    expect(last.t + last.duration).toBeLessThanOrEqual(CEILING_MS);
  });

  it("keeps a fixed particle seed and identical starts across runs", () => {
    expect(PARTICLE_SEED).toBe(6702);
    const a = Array.from({ length: PARTICLE_COUNT }, (_, i) => particleStart(i));
    const b = Array.from({ length: PARTICLE_COUNT }, (_, i) => particleStart(i));
    expect(a).toEqual(b);
  });

  it("pulls particle radius from r0 to the bead", () => {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const { r0 } = particleStart(i);
      expect(particleRadius(r0, 0)).toBeCloseTo(r0);
      expect(particleRadius(r0, 1)).toBeCloseTo(BEAD_RADIUS);
      let prev = particleRadius(r0, 0);
      for (const p of [0.25, 0.5, 0.75, 1]) {
        const r = particleRadius(r0, p);
        expect(r).toBeLessThan(prev);
        prev = r;
      }
      expect(particleProgress(0, i)).toBe(0);
    }
  });

  it("matches the Z path length constant", () => {
    expect(pathLength(MARK_PATH)).toBe(MARK_PATH_LENGTH);
  });

  it("renders no spin, spiral, or particle on the reduced-motion path", () => {
    const reduced = launchLayers(true);
    expect(reduced.spin).toBe(false);
    expect(reduced.spiral).toBe(false);
    expect(reduced.particle).toBe(false);
    expect(reduced.collapse).toBe(false);
    expect(reduced.burst).toBe(false);
    expect(reduced.staticMark).toBe(true);
    expect(launchLayers(false).spiral).toBe(true);
    expect(launchLayers(false).particle).toBe(true);
  });

  it("skips the webdriver launch unless ?launch=1", () => {
    expect(shouldSkipForWebdriver({ platform: "web", webdriver: true, launchParam: false })).toBe(true);
    expect(shouldSkipForWebdriver({ platform: "web", webdriver: true, launchParam: true })).toBe(false);
    expect(shouldSkipForWebdriver({ platform: "ios", webdriver: true, launchParam: false })).toBe(false);
  });

  it("plays once per cold start until replay", () => {
    resetLaunchSession();
    expect(hasPlayedLaunch()).toBe(false);
    markLaunchPlayed();
    expect(hasPlayedLaunch()).toBe(true);
    let heard = 0;
    const stop = subscribeReplay(() => {
      heard += 1;
    });
    requestReplay();
    expect(hasPlayedLaunch()).toBe(false);
    expect(heard).toBe(1);
    stop();
  });

  it("shows the mark in flight at 300ms and the burst at 2100ms", () => {
    const early = framePose(300);
    expect(early.mark.opacity).toBeGreaterThan(0);
    expect(early.mark.rotate).toBeLessThan(0);
    expect(early.mark.scaleX).toBeGreaterThan(0.35);
    expect(early.mark.scaleX).toBeLessThan(1);
    expect(early.spirals.every((s) => s.opacity === 0)).toBe(true);

    const burst = framePose(2100);
    expect(burst.bead.scale).toBeGreaterThan(1);
    expect(burst.overlay).toBe("accent");
    expect(burst.mark.opacity).toBe(0);
  });
});

describe("theme tokens", () => {
  it("matches the C67 impact-med mix", () => {
    expect(mixSrgb("#bf5af2", "#8e8e93", 0.55)).toBe(darkTheme.impactMed);
    expect(mixSrgb("#af52de", "#6e6e73", 0.55)).toBe(lightTheme.impactMed);
    expect(darkTheme.bg).toBe("#000000");
    expect(lightTheme.bg).toBe("#f2f2f7");
    expect(darkTheme.accent).toBe("#0a84ff");
    expect(lightTheme.accent).toBe("#007aff");
  });
});
