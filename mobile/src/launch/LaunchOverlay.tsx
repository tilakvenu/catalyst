import { useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle, Path } from "react-native-svg";
import {
  BEAD_RADIUS,
  BEAD_SPRING,
  COLLAPSE,
  EASE_ACCEL,
  EASE_OUT,
  EASE_RELEASE,
  EASE_SPIN,
  EASE_WORD,
  FADE_OUT,
  FILL_SHIFT,
  GHOST_FADE_OUT_AT,
  GHOST_LAG_MS,
  GHOST_OPACITY,
  MARK_BEAD,
  MARK_PATH,
  MARK_SIZE,
  MARK_SPIN,
  MARK_VIEW,
  PARTICLE_COUNT,
  PARTICLE_LIFE_MS,
  PARTICLE_SCALE_TO,
  PARTICLE_STAGGER_MS,
  REDUCED_FADE_MS,
  REDUCED_HOLD_MS,
  RELEASE,
  SHOCK_BASE,
  SHOCK_SCALE_TO,
  SHOCK_STROKE,
  SINGULARITY,
  SPIRAL_DASH_FRACTION,
  SPIRAL_GROUP_ROTATE_DEG,
  SPIRAL_GROUP_SCALE_TO,
  SPIRAL_PATHS,
  SPIRAL_PATH_LENGTH,
  SPIRAL_R0,
  SPIRAL_STARTS,
  WORDMARK,
  WORDMARK_ENTER_Y,
  WORDMARK_OFFSET,
  applyEase,
  framePose,
  launchLayers,
  particleAngle,
  particleProgress,
  particleRadius,
  particleStart,
} from "./launch-spec";
import { markLaunchPlayed } from "./session";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const spinEase = Easing.bezier(EASE_SPIN[0], EASE_SPIN[1], EASE_SPIN[2], EASE_SPIN[3]);
const wordEase = Easing.bezier(EASE_WORD[0], EASE_WORD[1], EASE_WORD[2], EASE_WORD[3]);
const accelEase = Easing.bezier(EASE_ACCEL[0], EASE_ACCEL[1], EASE_ACCEL[2], EASE_ACCEL[3]);
const releaseEase = Easing.bezier(EASE_RELEASE[0], EASE_RELEASE[1], EASE_RELEASE[2], EASE_RELEASE[3]);
const easeOut = Easing.bezier(EASE_OUT[0], EASE_OUT[1], EASE_OUT[2], EASE_OUT[3]);

type Props = {
  accent: string;
  ink: string;
  background: string;
  onDone: () => void;
  frame: number | null;
};

export function LaunchOverlay(props: Props) {
  const reduced = useReducedMotion();
  if (props.frame != null && !Number.isNaN(props.frame)) {
    return <FrozenFrame {...props} t={props.frame} />;
  }
  return <AnimatedLaunch {...props} reduced={reduced} />;
}

function MarkGlyph({ color, showBead, accent }: { color: string; showBead: boolean; accent: string }) {
  const vb = `${MARK_BEAD.cx - MARK_VIEW / 2} ${MARK_BEAD.cy - MARK_VIEW / 2} ${MARK_VIEW} ${MARK_VIEW}`;
  return (
    <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox={vb}>
      <Path d={MARK_PATH} stroke={color} strokeWidth={5} strokeLinecap="square" strokeLinejoin="miter" fill="none" />
      {showBead ? <Circle cx={MARK_BEAD.cx} cy={MARK_BEAD.cy} r={MARK_BEAD.r} fill={accent} /> : null}
    </Svg>
  );
}

function FrozenFrame({ t, accent, ink, background }: Props & { t: number }) {
  const pose = framePose(t);
  const layers = launchLayers(false);
  const bg = pose.overlay === "black" ? "#000000" : pose.overlay === "accent" ? accent : background;
  return (
    <View testID="launch-overlay" style={[StyleSheet.absoluteFill, { backgroundColor: bg, opacity: pose.overlayOpacity }]}>
      <View style={[styles.stage, { pointerEvents: "none" }]}>
        {layers.spiral ? (
          <View
            style={{
              transform: [{ rotate: `${pose.spiralGroup.rotate}deg` }, { scale: pose.spiralGroup.scale }],
            }}
          >
            <SpiralSvg accent={accent} dashes={pose.spirals} />
          </View>
        ) : null}
        {pose.particles.map((p, i) =>
          layers.particle ? (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: accent,
                  opacity: p.opacity,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                },
              ]}
            />
          ) : null,
        )}
        <View
          style={[
            styles.shock,
            {
              borderColor: accent,
              opacity: pose.shock.opacity,
              transform: [{ scale: pose.shock.scale }],
            },
          ]}
        />
        <View
          style={[
            styles.bead,
            { backgroundColor: accent, opacity: pose.bead.opacity, transform: [{ scale: pose.bead.scale }] },
          ]}
        />
        <View style={{ opacity: pose.ghost.opacity, transform: [{ rotate: `${pose.ghost.rotate}deg` }, { scale: pose.ghost.scale }] }}>
          <MarkGlyph color={ink} showBead={false} accent={accent} />
        </View>
        <View
          style={{
            opacity: pose.mark.opacity,
            transform: [{ rotate: `${pose.mark.rotate}deg` }, { scaleX: pose.mark.scaleX }, { scaleY: pose.mark.scaleY }],
          }}
        >
          <MarkGlyph color={ink} showBead accent={accent} />
        </View>
        <Text
          style={[
            styles.word,
            {
              color: ink,
              opacity: pose.word.opacity,
              transform: [{ translateY: pose.word.translateY }, { scale: pose.word.scale }],
            },
          ]}
        >
          {WORDMARK}
        </Text>
      </View>
    </View>
  );
}

function SpiralSvg({ accent, dashes }: { accent: string; dashes: { opacity: number; dash: number }[] }) {
  const span = SPIRAL_R0 * 2 + 16;
  const travel = SPIRAL_PATH_LENGTH * (1 - SPIRAL_DASH_FRACTION);
  const dashArray = `${SPIRAL_PATH_LENGTH * SPIRAL_DASH_FRACTION} ${SPIRAL_PATH_LENGTH}`;
  return (
    <Svg width={span} height={span} viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}>
      {SPIRAL_PATHS.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={accent}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={-dashes[i].dash * travel}
          opacity={dashes[i].opacity}
        />
      ))}
    </Svg>
  );
}

function AnimatedLaunch({ accent, ink, background, onDone, reduced }: Props & { reduced: boolean }) {
  const layers = launchLayers(reduced);
  const finish = useCallback(() => onDone(), [onDone]);

  const markRot = useSharedValue(MARK_SPIN.rotateFrom);
  const markSX = useSharedValue(MARK_SPIN.scaleFrom);
  const markSY = useSharedValue(MARK_SPIN.scaleFrom);
  const markOp = useSharedValue(0);
  const ghostRot = useSharedValue(MARK_SPIN.rotateFrom);
  const ghostScale = useSharedValue(MARK_SPIN.scaleFrom);
  const ghostOp = useSharedValue(0);
  const beadScale = useSharedValue(0);
  const beadOp = useSharedValue(0);
  const wordOp = useSharedValue(0);
  const wordY = useSharedValue(WORDMARK_OFFSET + WORDMARK_ENTER_Y);
  const wordScale = useSharedValue(1);
  const spiralRot = useSharedValue(0);
  const spiralScale = useSharedValue(1);
  const dash0 = useSharedValue(0);
  const dash1 = useSharedValue(0);
  const dash2 = useSharedValue(0);
  const particleClock = useSharedValue(0);
  const shockScale = useSharedValue(1);
  const shockOp = useSharedValue(0);
  const fill = useSharedValue(0);
  const overlayOp = useSharedValue(1);

  useEffect(() => {
    markLaunchPlayed();
    if (reduced) {
      markRot.value = 0;
      markSX.value = 1;
      markSY.value = 1;
      markOp.value = 1;
      wordOp.value = 1;
      wordY.value = WORDMARK_OFFSET;
      wordScale.value = 1;
      overlayOp.value = withDelay(
        REDUCED_HOLD_MS,
        withTiming(0, { duration: REDUCED_FADE_MS, easing: Easing.linear }, (finished) => {
          if (finished) scheduleOnRN(finish);
        }),
      );
      return () => cancelAnimation(overlayOp);
    }

    const spinGap = COLLAPSE.t - (MARK_SPIN.t + MARK_SPIN.duration);
    markRot.value = withSequence(
      withDelay(MARK_SPIN.t, withTiming(MARK_SPIN.rotateTo, { duration: MARK_SPIN.duration, easing: spinEase })),
      withDelay(spinGap, withTiming(COLLAPSE.rotateTo, { duration: COLLAPSE.duration, easing: accelEase })),
    );
    markSX.value = withSequence(
      withDelay(MARK_SPIN.t, withTiming(1, { duration: MARK_SPIN.duration, easing: spinEase })),
      withDelay(
        spinGap,
        withSequence(
          withTiming(COLLAPSE.stretchX, { duration: COLLAPSE.duration / 2, easing: accelEase }),
          withTiming(0, { duration: COLLAPSE.duration / 2, easing: accelEase }),
        ),
      ),
    );
    markSY.value = withSequence(
      withDelay(MARK_SPIN.t, withTiming(1, { duration: MARK_SPIN.duration, easing: spinEase })),
      withDelay(
        spinGap,
        withSequence(
          withTiming(COLLAPSE.stretchY, { duration: COLLAPSE.duration / 2, easing: accelEase }),
          withTiming(0, { duration: COLLAPSE.duration / 2, easing: accelEase }),
        ),
      ),
    );
    markOp.value = withSequence(
      withDelay(MARK_SPIN.t, withTiming(1, { duration: MARK_SPIN.duration, easing: spinEase })),
      withDelay(
        spinGap,
        withSequence(
          withTiming(1, { duration: COLLAPSE.duration / 2 }),
          withTiming(0, { duration: COLLAPSE.duration / 2 }),
        ),
      ),
    );

    const ghostStart = MARK_SPIN.t + GHOST_LAG_MS;
    const ghostFade = GHOST_FADE_OUT_AT - ghostStart;
    ghostRot.value = withDelay(ghostStart, withTiming(0, { duration: MARK_SPIN.duration, easing: spinEase }));
    ghostScale.value = withDelay(ghostStart, withTiming(1, { duration: MARK_SPIN.duration, easing: spinEase }));
    ghostOp.value = withDelay(
      ghostStart,
      withSequence(
        withTiming(GHOST_OPACITY, { duration: ghostFade * 0.35 }),
        withTiming(0, { duration: ghostFade * 0.65 }),
      ),
    );

    const introMs = 320;
    const afterIntro = SINGULARITY.t - (600 + introMs);
    beadScale.value = withSequence(
      withDelay(
        600,
        withSequence(
          withSpring(BEAD_SPRING.peakScale, {
            duration: BEAD_SPRING.peakPerceptualMs,
            dampingRatio: BEAD_SPRING.dampingRatio,
          }),
          withSpring(1, { duration: BEAD_SPRING.settlePerceptualMs, dampingRatio: 1 }),
        ),
      ),
      withDelay(afterIntro, withTiming(SINGULARITY.scale, { duration: SINGULARITY.duration, easing: Easing.linear })),
      withTiming(RELEASE.scale, { duration: RELEASE.duration, easing: releaseEase }),
    );
    beadOp.value = withDelay(600, withTiming(1, { duration: introMs, easing: Easing.linear }));

    const wordGap = 1350 - (680 + 300);
    wordOp.value = withSequence(
      withDelay(680, withTiming(1, { duration: 300, easing: wordEase })),
      withDelay(wordGap, withTiming(0, { duration: 300, easing: accelEase })),
    );
    wordY.value = withSequence(
      withDelay(680, withTiming(WORDMARK_OFFSET, { duration: 300, easing: wordEase })),
      withDelay(wordGap, withTiming(0, { duration: 300, easing: accelEase })),
    );
    wordScale.value = withDelay(1350, withTiming(0, { duration: 300, easing: accelEase }));

    spiralRot.value = withDelay(900, withTiming(SPIRAL_GROUP_ROTATE_DEG, { duration: 800, easing: accelEase }));
    spiralScale.value = withDelay(900, withTiming(SPIRAL_GROUP_SCALE_TO, { duration: 800, easing: accelEase }));
    [dash0, dash1, dash2].forEach((dash, i) => {
      dash.value = withDelay(SPIRAL_STARTS[i], withTiming(1, { duration: 700, easing: Easing.linear }));
    });

    const particleWindow = PARTICLE_LIFE_MS + (PARTICLE_COUNT - 1) * PARTICLE_STAGGER_MS;
    particleClock.value = withDelay(1000, withTiming(1, { duration: particleWindow, easing: Easing.linear }));

    shockScale.value = withDelay(1880, withTiming(SHOCK_SCALE_TO, { duration: 320, easing: easeOut }));
    shockOp.value = withDelay(
      1880,
      withSequence(withTiming(0.8, { duration: 0 }), withTiming(0, { duration: 320, easing: easeOut })),
    );

    fill.value = withSequence(
      withDelay(RELEASE.t, withTiming(1, { duration: 0 })),
      withDelay(
        FILL_SHIFT.t - RELEASE.t,
        withTiming(2, { duration: FILL_SHIFT.duration, easing: Easing.linear }),
      ),
    );
    overlayOp.value = withDelay(
      FADE_OUT.t,
      withTiming(0, { duration: FADE_OUT.duration, easing: Easing.linear }, (finished) => {
        if (finished) scheduleOnRN(finish);
      }),
    );

    return () => {
      cancelAnimation(markRot);
      cancelAnimation(overlayOp);
    };
  }, [
    reduced,
    finish,
    beadOp,
    beadScale,
    dash0,
    dash1,
    dash2,
    fill,
    ghostOp,
    ghostRot,
    ghostScale,
    markOp,
    markRot,
    markSX,
    markSY,
    overlayOp,
    particleClock,
    shockOp,
    shockScale,
    spiralRot,
    spiralScale,
    wordOp,
    wordScale,
    wordY,
  ]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: overlayOp.value,
    backgroundColor: interpolateColor(fill.value, [0, 1, 2], ["#000000", accent, background]),
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOp.value,
    transform: [{ rotate: `${markRot.value}deg` }, { scaleX: markSX.value }, { scaleY: markSY.value }],
  }));
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: ghostOp.value,
    transform: [{ rotate: `${ghostRot.value}deg` }, { scale: ghostScale.value }],
  }));
  const beadStyle = useAnimatedStyle(() => ({
    opacity: beadOp.value,
    transform: [{ scale: beadScale.value }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOp.value,
    transform: [{ translateY: wordY.value }, { scale: wordScale.value }],
  }));
  const spiralStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spiralRot.value}deg` }, { scale: spiralScale.value }],
  }));
  const shockStyle = useAnimatedStyle(() => ({
    opacity: shockOp.value,
    transform: [{ scale: shockScale.value }],
  }));

  return (
    <Animated.View testID="launch-overlay" style={[StyleSheet.absoluteFill, backdrop, { pointerEvents: "auto" }]}>
      <View style={[styles.stage, { pointerEvents: "none" }]}>
        {layers.spiral ? (
          <Animated.View style={spiralStyle}>
            <AnimatedSpirals accent={accent} dashes={[dash0, dash1, dash2]} />
          </Animated.View>
        ) : null}
        {layers.particle
          ? Array.from({ length: PARTICLE_COUNT }, (_, i) => (
              <Particle key={i} index={i} clock={particleClock} color={accent} />
            ))
          : null}
        {layers.shockwave ? <Animated.View style={[styles.shock, { borderColor: accent }, shockStyle]} /> : null}
        <Animated.View style={[styles.bead, { backgroundColor: accent }, beadStyle]} />
        {layers.spin || layers.staticMark ? (
          <Animated.View style={ghostStyle}>
            <MarkGlyph color={ink} showBead={false} accent={accent} />
          </Animated.View>
        ) : null}
        <Animated.View style={markStyle}>
          <MarkGlyph color={ink} showBead accent={accent} />
        </Animated.View>
        <Animated.Text style={[styles.word, { color: ink }, wordStyle]}>{WORDMARK}</Animated.Text>
      </View>
    </Animated.View>
  );
}

function AnimatedSpirals({ accent, dashes }: { accent: string; dashes: SharedValue<number>[] }) {
  const span = SPIRAL_R0 * 2 + 16;
  return (
    <Svg width={span} height={span} viewBox={`${-span / 2} ${-span / 2} ${span} ${span}`}>
      {SPIRAL_PATHS.map((d, i) => (
        <DashPath key={i} d={d} accent={accent} progress={dashes[i]} />
      ))}
    </Svg>
  );
}

function DashPath({ d, accent, progress }: { d: string; accent: string; progress: SharedValue<number> }) {
  const travel = SPIRAL_PATH_LENGTH * (1 - SPIRAL_DASH_FRACTION);
  const props = useAnimatedProps(() => {
    const u = progress.value;
    const opacity = u <= 0 ? 0 : u < 0.28 ? 0.9 * (u / 0.28) : Math.max(0, 0.9 * (1 - (u - 0.28) / 0.72));
    return {
      strokeDashoffset: -applyEase(EASE_ACCEL, u) * travel,
      opacity,
    };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={accent}
      strokeWidth={2}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${SPIRAL_PATH_LENGTH * SPIRAL_DASH_FRACTION} ${SPIRAL_PATH_LENGTH}`}
      animatedProps={props}
    />
  );
}

function Particle({ index, clock, color }: { index: number; clock: SharedValue<number>; color: string }) {
  const start = particleStart(index);
  const total = PARTICLE_LIFE_MS + (PARTICLE_COUNT - 1) * PARTICLE_STAGGER_MS;
  const style = useAnimatedStyle(() => {
    const elapsed = clock.value * total;
    const p = particleProgress(elapsed, index);
    const born = elapsed >= index * PARTICLE_STAGGER_MS && elapsed <= index * PARTICLE_STAGGER_MS + PARTICLE_LIFE_MS;
    const r = particleRadius(start.r0, p);
    const a = particleAngle(start.angle0, p);
    const fade = born ? Math.min(p / 0.18, (1 - p) / 0.22, 1) : 0;
    return {
      opacity: Math.max(0, fade),
      transform: [
        { translateX: r * Math.cos(a) },
        { translateY: r * Math.sin(a) },
        { scale: 1 + (PARTICLE_SCALE_TO - 1) * p },
      ],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  stage: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  bead: {
    position: "absolute",
    width: BEAD_RADIUS * 2,
    height: BEAD_RADIUS * 2,
    borderRadius: BEAD_RADIUS,
  },
  shock: {
    position: "absolute",
    width: SHOCK_BASE,
    height: SHOCK_BASE,
    borderRadius: SHOCK_BASE / 2,
    borderWidth: SHOCK_STROKE,
    backgroundColor: "transparent",
  },
  dot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  word: {
    position: "absolute",
    fontSize: 13,
    letterSpacing: 4,
    fontWeight: "600",
  },
});
