import { packEvidence } from "./evidence.ts";
import { SCORING_RULE_VERSION } from "./build.ts";
import type { AppSnapshot, Headline, JournalEntry, Screen, TabId } from "./types.ts";

export type ScenarioId = "A" | "B" | "C";

type Live = AppSnapshot & {
  now: number;
  stack: Screen[];
  tab: TabId;
  sheet: null;
  lastScore: null;
};

/** Interactive demo flows. Mutates in-memory store; does not add schema fields. */
export function applyScenario(state: Live, id: ScenarioId): Partial<Live> {
  const s = state;
  if (id === "A") {
    const event = s.events.find((e) => e.id === "nvda-earn");
    if (!event) return {};
    const lockMs = new Date(event.startsAt).getTime() - 20 * 3600000;
    const lockedAt = new Date(lockMs).toISOString();
    const known = s.headlines.filter((h) => h.tickerId === "nvda").slice(0, 3);
    const after: Headline = {
      id: "h-nvda-after-lock",
      tickerId: "nvda",
      title: "Company 8-K posted after the lock",
      source: "SEC",
      publishedAt: new Date(lockMs + 2 * 3600000).toISOString(),
      firstSeenAt: new Date(lockMs + 2 * 3600000).toISOString(),
      impact: "high",
      kind: "filing",
      why: "Primary filing after the call was already locked.",
      origin: "fixture",
      scoredBy: "fixture",
    };
    const entry: JournalEntry = {
      id: s.entries.find((e) => e.eventId === "nvda-earn")?.id ?? "e-nvda-scenario",
      eventId: "nvda-earn",
      text: "Blackwell mix clears the street. Margin holds.",
      sentiment: "bullish",
      direction: "up",
      conviction: 4,
      reasoning: "Blackwell mix clears the street. Margin holds a 75 handle.",
      invalidation: "Gross-margin guidance below 73%.",
      updatedAt: lockedAt,
      lockedAt,
      evidenceSnapshot: packEvidence(known),
      scoringRuleVersion: SCORING_RULE_VERSION,
    };
    return {
      now: lockMs + 3 * 3600000,
      headlines: [...s.headlines.filter((h) => h.id !== after.id), after],
      entries: [...s.entries.filter((e) => e.eventId !== "nvda-earn"), entry],
      stack: [{ name: "event", id: "nvda-earn" }],
      tab: "now",
      sheet: null,
      lastScore: null,
    };
  }
  if (id === "B") {
    const event = s.events.find((e) => e.id === "cpi-soon");
    if (!event) return {};
    const lockMs = new Date(event.startsAt).getTime() - 14 * 3600000;
    const lockedAt = new Date(lockMs).toISOString();
    const entry: JournalEntry = {
      id: "e-cpi-scenario",
      eventId: "cpi-soon",
      text: "Core holds. Score QQQ down next session.",
      sentiment: "bearish",
      direction: "down",
      conviction: 3,
      reasoning: "Core services stay sticky. Duration sells; QQQ follows for a session.",
      invalidation: "Core 0.1 below consensus.",
      callTarget: "qqq",
      updatedAt: lockedAt,
      lockedAt,
      evidenceSnapshot: packEvidence(s.headlines.filter((h) => h.macroId === "cpi")),
      scoringRuleVersion: SCORING_RULE_VERSION,
    };
    return {
      now: lockMs + 3600000,
      entries: [...s.entries.filter((e) => e.eventId !== "cpi-soon"), entry],
      stack: [{ name: "event", id: "cpi-soon" }],
      tab: "now",
      sheet: null,
      lastScore: null,
    };
  }
  const past = s.events.find((e) => e.id === "amzn-past");
  if (!past) return {};
  const lockedAt = new Date(new Date(past.startsAt).getTime() - 6 * 3600000).toISOString();
  const entry: JournalEntry = {
    id: "e-amzn-miss",
    eventId: "amzn-past",
    text: "AWS reaccelerates. High conviction.",
    sentiment: "bullish",
    direction: "up",
    conviction: 5,
    reasoning: "AWS should print a 12-handle. The stock still trades AWS first.",
    invalidation: "AWS growth below 11%.",
    updatedAt: lockedAt,
    lockedAt,
    evidenceSnapshot: packEvidence(s.headlines.filter((h) => h.tickerId === "amzn")),
    scoringRuleVersion: SCORING_RULE_VERSION,
    actualDirection: "down",
    actualMovePct: -5.4,
    actualMoveDate: new Date(new Date(past.startsAt).getTime() + 24 * 3600000).toISOString(),
    actualFigure: "AWS +10.8%. You wrote: AWS growth below 11%. It came in at 10.8%. Manual review needed.",
  };
  return {
    entries: [...s.entries.filter((e) => e.eventId !== "amzn-past"), entry],
    stack: [{ name: "event", id: "amzn-past" }],
    tab: "record",
    sheet: null,
    lastScore: null,
  };
}

export function advanceScenario(state: Live): Partial<Live> {
  const s = state;
  const nvda = s.events.find((e) => e.id === "nvda-earn");
  const cpi = s.events.find((e) => e.id === "cpi-soon");
  const nvdaLocked = s.entries.find((e) => e.eventId === "nvda-earn" && e.lockedAt && e.actualDirection == null);
  const cpiLocked = s.entries.find((e) => e.eventId === "cpi-soon" && e.lockedAt && e.actualDirection == null);
  if (nvdaLocked && nvda) {
    const resolveAt = new Date(nvda.startsAt).getTime() + 2 * 86400000 + 2 * 3600000;
    return {
      now: resolveAt,
      events: s.events.map((e) => (e.id === "nvda-earn" ? { ...e, printMovePct: 3.7 } : e)),
      tab: "now",
      stack: [],
    };
  }
  if (cpiLocked && cpi) {
    const resolveAt = new Date(cpi.startsAt).getTime() + 8 * 3600000;
    return {
      now: resolveAt,
      events: s.events.map((e) => (e.id === "cpi-soon" ? { ...e, printMovePct: -1.6 } : e)),
      tickers: s.tickers.map((t) => (t.id === "qqq" ? { ...t, changePct: -1.6, change: -7.7 } : t)),
      tab: "now",
      stack: [],
    };
  }
  return {};
}
