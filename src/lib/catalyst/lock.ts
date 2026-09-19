import { SCORING_RULE_VERSION } from "./build.ts";
import { eventHeadlines, packEvidence } from "./evidence.ts";
import { isEntryComplete, type CatalystEvent, type Headline, type JournalEntry, type Ticker } from "./types.ts";

export const MACRO_TARGET_FALLBACKS = ["spy", "qqq"] as const;

export function macroTargetOptions(tickers: Ticker[]): Ticker[] {
  const byId = new Map(tickers.map((t) => [t.id, t]));
  const extra: Ticker[] = [];
  for (const id of MACRO_TARGET_FALLBACKS) {
    if (byId.has(id)) continue;
    extra.push({
      id,
      symbol: id.toUpperCase(),
      company: id === "spy" ? "SPDR S&P 500 ETF Trust" : "Invesco QQQ Trust",
      held: false,
      muted: false,
      lastPrice: 0,
      change: 0,
      changePct: 0,
      kind: "equity",
    });
  }
  return [...tickers, ...extra];
}

export function allowedCallTargets(tickers: Ticker[]): string[] {
  const ids = new Set(tickers.map((t) => t.id));
  ids.add("spy");
  ids.add("qqq");
  return [...ids];
}

export function canLock(
  entry: Pick<JournalEntry, "direction" | "conviction" | "reasoning" | "invalidation" | "callTarget">,
  event: CatalystEvent,
): { ok: true } | { ok: false; reason: string } {
  if (!isEntryComplete(entry as JournalEntry)) {
    return { ok: false, reason: "incomplete" };
  }
  if (event.kind === "macro" && !entry.callTarget) {
    return { ok: false, reason: "macro-target" };
  }
  return { ok: true };
}

export function eventHasStarted(event: CatalystEvent, now: number): boolean {
  return now >= new Date(event.startsAt).getTime();
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function lockCall(args: {
  existing: JournalEntry | undefined;
  event: CatalystEvent;
  headlines: Headline[];
  now: number;
  patch: Partial<JournalEntry>;
}): { ok: true; entry: JournalEntry; previous?: JournalEntry } | { ok: false; reason: string } {
  const merged: JournalEntry = args.existing
    ? { ...args.existing, ...args.patch, updatedAt: new Date(args.now).toISOString() }
    : {
        id: newId("e"),
        eventId: args.event.id,
        text: args.patch.text ?? args.patch.reasoning ?? null,
        sentiment: args.patch.sentiment ?? null,
        direction: args.patch.direction ?? null,
        conviction: args.patch.conviction ?? null,
        reasoning: args.patch.reasoning ?? null,
        invalidation: args.patch.invalidation ?? null,
        callTarget: args.patch.callTarget,
        updatedAt: new Date(args.now).toISOString(),
      };

  const gate = canLock(merged, args.event);
  if (!gate.ok) return gate;

  const snapshot = packEvidence(eventHeadlines(args.headlines, args.event));
  const lockedAt = new Date(args.now).toISOString();

  if (args.existing?.lockedAt) {
    const revision: JournalEntry = {
      ...merged,
      id: newId("e"),
      lockedAt,
      evidenceSnapshot: snapshot.length ? snapshot : args.existing.evidenceSnapshot ?? snapshot,
      scoringRuleVersion: SCORING_RULE_VERSION,
      state: undefined,
    };
    return { ok: true, entry: revision, previous: args.existing };
  }

  return {
    ok: true,
    entry: {
      ...merged,
      lockedAt,
      evidenceSnapshot: snapshot.length ? snapshot : merged.evidenceSnapshot ?? snapshot,
      scoringRuleVersion: SCORING_RULE_VERSION,
      state: undefined,
    },
  };
}

/** Latest lock whose lockedAt is still at or before the event start. That version is scored. */
export function scoredVersion(entries: JournalEntry[], event: CatalystEvent): JournalEntry | undefined {
  const start = new Date(event.startsAt).getTime();
  const pre = entries
    .filter((e) => e.eventId === event.id && e.lockedAt && new Date(e.lockedAt).getTime() <= start)
    .sort((a, b) => new Date(b.lockedAt!).getTime() - new Date(a.lockedAt!).getTime());
  if (pre[0]) return pre[0];
  return entries
    .filter((e) => e.eventId === event.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export function currentDraft(entries: JournalEntry[], eventId: string): JournalEntry | undefined {
  return entries
    .filter((e) => e.eventId === eventId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

export function mutateLocked(args: {
  current: JournalEntry;
  event: CatalystEvent;
  patch: Partial<JournalEntry>;
  now: number;
  headlines: Headline[];
}): { current: JournalEntry; revision?: JournalEntry } {
  if (args.current.lockedAt) {
    const revision: JournalEntry = {
      ...args.current,
      ...args.patch,
      id: newId("e"),
      eventId: args.event.id,
      updatedAt: new Date(args.now).toISOString(),
    };
    if (!eventHasStarted(args.event, args.now) && isEntryComplete(revision)) {
      revision.lockedAt = new Date(args.now).toISOString();
      revision.evidenceSnapshot = packEvidence(eventHeadlines(args.headlines, args.event));
      revision.scoringRuleVersion = SCORING_RULE_VERSION;
      revision.state = undefined;
    }
    return { current: args.current, revision };
  }
  return {
    current: {
      ...args.current,
      ...args.patch,
      updatedAt: new Date(args.now).toISOString(),
    },
  };
}
