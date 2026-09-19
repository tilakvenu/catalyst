import { packEvidence } from "./evidence.ts";
import { BUILD_NAME, SCORING_RULE_VERSION } from "./build.ts";
import { classifyMove, FLAT_BAND_MULTIPLE, typicalSessionPct } from "./scoring.ts";
import { isEntryComplete, type AppSnapshot, type CatalystEvent, type Direction, type Headline, type JournalEntry } from "./types.ts";
import { buildDemoSnapshot } from "./fixtures.ts";

/**
 * SYNTHETIC MODEL — NOT PRODUCT VALIDATION.
 * One user over ~6 months. High-conviction forecasts worse than medium.
 * Deterministic seed so the report is stable.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const NAMES = [
  { id: "nvda", title: "earnings" },
  { id: "aapl", title: "earnings" },
  { id: "msft", title: "earnings" },
  { id: "amzn", title: "earnings" },
  { id: "meta", title: "earnings" },
  { id: "jpm", title: "earnings" },
  { id: "avgo", title: "earnings" },
] as const;

export interface SimulationReport {
  scored: number;
  accuracyPct: number;
  hits: number;
  bands: { id: string; label: string; n: number; pct: number }[];
  earnings: { n: number; pct: number };
  macro: { n: number; pct: number };
  moveDist: { up: number; down: number; flat: number };
  stableFromCall: number | null;
  stableMonth: string | null;
  label: string;
}

export function buildSimulationSnapshot(now = Date.now()): { snapshot: AppSnapshot; report: SimulationReport } {
  const base = buildDemoSnapshot(now);
  const rand = rng(67);
  const events: CatalystEvent[] = [...base.events];
  const headlines: Headline[] = [...base.headlines];
  const entries: JournalEntry[] = [];

  const typicalOf = (id: string) => typicalSessionPct(base.sparks[id]?.["1M"] ?? [], [], now) ?? 1.8;

  // 36 earnings + 8 macro over ~180 days. High conv (4–5) hit ~38%, mid (3) ~72%, low ~58%.
  const months = 6;
  let n = 0;
  const running: { hit: boolean }[] = [];
  let stableFromCall: number | null = null;
  let stableMonth: string | null = null;

  function hitProb(conv: number) {
    if (conv >= 4) return 0.38;
    if (conv === 3) return 0.72;
    return 0.58;
  }

  for (let m = 0; m < months; m++) {
    for (let k = 0; k < 6; k++) {
      n += 1;
      const name = NAMES[(m * 6 + k) % NAMES.length]!;
      const daysAgo = 10 + m * 28 + k * 4;
      const startsAt = new Date(now - daysAgo * 86400000).toISOString();
      const eventId = `sim-${name.id}-${m}-${k}`;
      const typical = typicalOf(name.id);
      const conv = (k === 0 ? 5 : k === 1 ? 4 : k === 2 || k === 3 ? 3 : k === 4 ? 2 : 1) as 1 | 2 | 3 | 4 | 5;
      const wantHit = rand() < hitProb(conv);
      // Realized move distribution under FLAT_BAND_MULTIPLE — not tuned for balance.
      const roll = rand();
      let move = 0;
      if (roll < 0.18) move = (rand() - 0.5) * typical * 0.8; // flat
      else if (roll < 0.62) move = typical * (1.15 + rand() * 1.4);
      else move = -typical * (1.15 + rand() * 1.4);
      if (k === 5 && m === 0) move = typical * 0.2; // guaranteed flat
      if (k === 0 && m === 1) {
        // high-conviction miss
        move = -typical * 1.8;
      }
      let actual = classifyMove(move, typical);
      let direction: Direction = wantHit ? actual : actual === "up" ? "down" : actual === "down" ? "up" : rand() > 0.5 ? "up" : "down";
      if (k === 0 && m === 1) direction = "up"; // high-conviction miss
      actual = classifyMove(move, typical);
      const hit = direction === actual;
      running.push({ hit });
      if (stableFromCall == null && running.length >= 18) {
        const recent = running.slice(-12);
        const high = recent; // crude: once n>=18 the inverted pattern is visible
        if (high.length >= 12) {
          stableFromCall = running.length;
          stableMonth = `Month ${m + 1}`;
        }
      }

      const session = k % 5 === 0 ? "amc" : k % 5 === 1 ? "bmo" : "amc";
      events.push({
        id: eventId,
        kind: "earnings",
        title: `${name.title} (synthetic)`,
        tickerId: name.id,
        startsAt,
        confirmed: true,
        session,
        description: "SYNTHETIC MODEL — NOT PRODUCT VALIDATION.",
        impact: session === "amc" ? ["after-close"] : [],
        notify: false,
        printMovePct: Number(move.toFixed(2)),
      });

      const hKnown: Headline = {
        id: `sim-h-${eventId}-k`,
        tickerId: name.id,
        title: `${name.id.toUpperCase()} street note before the print`,
        source: "Street",
        publishedAt: new Date(now - (daysAgo + 2) * 86400000).toISOString(),
        firstSeenAt: new Date(now - (daysAgo + 2) * 86400000).toISOString(),
        impact: "medium",
        kind: "coverage",
        origin: "fixture",
        scoredBy: "fixture",
      };
      const hAfter: Headline = {
        id: `sim-h-${eventId}-a`,
        tickerId: name.id,
        title: `${name.id.toUpperCase()} 8-K after the lock`,
        source: "SEC",
        publishedAt: new Date(now - (daysAgo - 0.2) * 86400000).toISOString(),
        firstSeenAt: new Date(now - (daysAgo - 0.2) * 86400000).toISOString(),
        impact: "high",
        kind: "filing",
        origin: "fixture",
        scoredBy: "fixture",
      };
      headlines.push(hKnown, hAfter);

      const lockedAt = new Date(now - (daysAgo + 1) * 86400000).toISOString();
      const fired = k === 2 && m === 2;
      entries.push({
        id: `sim-e-${eventId}`,
        eventId,
        text: conv >= 4 ? "High conviction. Capacity is the bottleneck." : "Standard setup.",
        sentiment: direction === "up" ? "bullish" : direction === "down" ? "bearish" : "none",
        direction,
        conviction: conv,
        reasoning: conv >= 4 ? "Street is behind the mix shift." : "Base rate plus one tape item.",
        invalidation: fired ? "Gross-margin guide below 73%." : "A clean miss on the guide.",
        updatedAt: lockedAt,
        lockedAt,
        evidenceSnapshot: packEvidence([hKnown]),
        scoringRuleVersion: SCORING_RULE_VERSION,
        actualDirection: actual,
        actualMovePct: Number(move.toFixed(2)),
        actualMoveDate: new Date(now - (daysAgo - 1) * 86400000).toISOString(),
        actualFigure: fired
          ? "You wrote: margin guide below 73%. It came in at 71.4%. Invalidation fired."
          : "You wrote: a clean miss on the guide. Guide held. Manual review needed.",
      });
    }
  }

  // Macro calls with explicit QQQ target
  for (let i = 0; i < 8; i++) {
    const daysAgo = 18 + i * 20;
    const eventId = `sim-cpi-${i}`;
    const startsAt = new Date(now - daysAgo * 86400000).toISOString();
    const typical = typicalOf("qqq");
    const move = (i % 3 === 0 ? 1 : -1) * typical * (i === 3 ? 0.4 : 1.3);
    const actual = classifyMove(move, typical);
    const direction: Direction = i % 4 === 0 ? (actual === "up" ? "down" : "up") : actual;
    const conv = (i % 2 === 0 ? 3 : 4) as 3 | 4;
    events.push({
      id: eventId,
      kind: "macro",
      title: "CPI (synthetic)",
      macroId: "cpi",
      startsAt,
      confirmed: true,
      session: "intraday",
      description: "SYNTHETIC MODEL — NOT PRODUCT VALIDATION.",
      impact: ["high-vol"],
      notify: false,
      printMovePct: Number(move.toFixed(2)),
    });
    const lockedAt = new Date(now - (daysAgo + 1) * 86400000).toISOString();
    entries.push({
      id: `sim-e-${eventId}`,
      eventId,
      text: "Core sticky; duration sells the print.",
      sentiment: direction === "down" ? "bearish" : "bullish",
      direction,
      conviction: conv,
      reasoning: "Shelter lag. Score QQQ next session, not the print itself.",
      invalidation: "Core 0.1 below consensus.",
      updatedAt: lockedAt,
      lockedAt,
      callTarget: "qqq",
      evidenceSnapshot: packEvidence([]),
      scoringRuleVersion: SCORING_RULE_VERSION,
      actualDirection: actual,
      actualMovePct: Number(move.toFixed(2)),
      actualMoveDate: new Date(now - daysAgo * 86400000 + 8 * 3600000).toISOString(),
      actualFigure: "QQQ session move vs typical. Catalyst scoring rule v1.",
    });
  }

  const snapshot: AppSnapshot = {
    ...base,
    events,
    headlines,
    entries: [...entries, ...base.entries.filter((e) => !isEntryComplete(e))],
  };

  const scored = entries.filter((e) => e.actualDirection && e.direction);
  const hits = scored.filter((e) => e.direction === e.actualDirection);
  const bandDefs = [
    { id: "high", label: "4–5", min: 4, max: 5 },
    { id: "mid", label: "3", min: 3, max: 3 },
    { id: "low", label: "1–2", min: 1, max: 2 },
  ];
  const bands = bandDefs.map((d) => {
    const slice = scored.filter((e) => e.conviction != null && e.conviction >= d.min && e.conviction <= d.max);
    const h = slice.filter((e) => e.direction === e.actualDirection).length;
    return { id: d.id, label: d.label, n: slice.length, pct: slice.length ? Math.round((h / slice.length) * 100) : 0 };
  });
  const earn = scored.filter((e) => events.find((x) => x.id === e.eventId)?.kind === "earnings");
  const mac = scored.filter((e) => events.find((x) => x.id === e.eventId)?.kind === "macro");
  const dist = { up: 0, down: 0, flat: 0 };
  for (const e of scored) {
    if (e.actualDirection === "up") dist.up += 1;
    else if (e.actualDirection === "down") dist.down += 1;
    else dist.flat += 1;
  }

  return {
    snapshot,
    report: {
      scored: scored.length,
      accuracyPct: scored.length ? Math.round((hits.length / scored.length) * 100) : 0,
      hits: hits.length,
      bands,
      earnings: {
        n: earn.length,
        pct: earn.length ? Math.round((earn.filter((e) => e.direction === e.actualDirection).length / earn.length) * 100) : 0,
      },
      macro: {
        n: mac.length,
        pct: mac.length ? Math.round((mac.filter((e) => e.direction === e.actualDirection).length / mac.length) * 100) : 0,
      },
      moveDist: dist,
      stableFromCall,
      stableMonth,
      label: `${BUILD_NAME} synthetic model · FLAT_BAND_MULTIPLE = ${FLAT_BAND_MULTIPLE}`,
    },
  };
}

export const SIM_DISCLAIMER = "SYNTHETIC MODEL — NOT PRODUCT VALIDATION";
