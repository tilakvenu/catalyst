// The referee's rules as pure functions. They reuse the C67 modules unchanged; Cloud Code (main.ts)
// only feeds them server rows and server time. No Parse imports here, so node:test can cover them.
import { SCORING_RULE_VERSION } from "../../src/lib/catalyst/build.ts";
import { etMs } from "../../src/lib/catalyst/calendar.ts";
import { canLock, eventHasStarted } from "../../src/lib/catalyst/lock.ts";
import { resolvingMove } from "../../src/lib/catalyst/resolve.ts";
import { classifyMove, predictedVsActual } from "../../src/lib/catalyst/scoring.ts";
import { isResolvableAt } from "../../src/lib/catalyst/session.ts";
import {
  isEntryComplete,
  type CatalystEvent,
  type Direction,
  type EventKind,
  type JournalEntry,
  type NotifyLead,
  type Session,
  type ThemePref,
} from "../../src/lib/catalyst/types.ts";
import { BOOTSTRAP_AHEAD_DAYS, BOOTSTRAP_PAST_DAYS, type CallOutcome } from "./dto.ts";

export { SCORING_RULE_VERSION };

const DAY = 86400000;
export const MAX_TEXT = 4000;
export const DIRECTIONS: readonly Direction[] = ["up", "down", "flat"];
export const THEMES: readonly ThemePref[] = ["light", "dark", "system"];
export const NOTIFY_LEADS: readonly NotifyLead[] = ["24h", "1h", "both"];
export const HEADLINE_RETENTION_DAYS = 30;

/** The server's view of an event, enough for the C67 rules. */
export interface EventFacts {
  id: string;
  kind: EventKind;
  startsAt: string;
  session: Session;
  tickerId?: string;
  macroId?: string;
  printMovePct?: number;
  typicalMovePct?: number;
}

/** Adapt server facts to the C67 CatalystEvent shape the shared modules take. */
export function asC67Event(e: EventFacts): CatalystEvent {
  return {
    id: e.id,
    kind: e.kind,
    title: "",
    tickerId: e.tickerId,
    macroId: e.macroId,
    startsAt: e.startsAt,
    confirmed: false,
    session: e.session,
    description: "",
    impact: [],
    notify: false,
    printMovePct: e.printMovePct,
  };
}

export interface CallFields {
  direction: unknown;
  conviction: unknown;
  reasoning: unknown;
  wrongIf: unknown;
  callTargetId?: string;
}

export type Verdict = { ok: true } | { ok: false; code: "started" | "invalid" | "incomplete" | "macro-target"; message: string };

export function eventStarted(event: EventFacts, now: number): boolean {
  return eventHasStarted(asC67Event(event), now);
}

/** Every client save of a Call is a lock. Types first, then C67's canLock (all four fields; macro needs a target). */
export function checkLock(fields: CallFields, event: EventFacts, now: number): Verdict {
  if (eventStarted(event, now)) return { ok: false, code: "started", message: "This event has started; calls on it are frozen." };
  if (!DIRECTIONS.includes(fields.direction as Direction)) return { ok: false, code: "invalid", message: "direction must be up, down or flat." };
  const c = fields.conviction;
  if (typeof c !== "number" || !Number.isInteger(c) || c < 1 || c > 5) return { ok: false, code: "invalid", message: "conviction must be a whole number from 1 to 5." };
  for (const [name, v] of [["reasoning", fields.reasoning], ["wrongIf", fields.wrongIf]] as const) {
    if (typeof v !== "string") return { ok: false, code: "incomplete", message: `${name} is required.` };
    if (v.length > MAX_TEXT) return { ok: false, code: "invalid", message: `${name} is longer than ${MAX_TEXT} characters.` };
  }
  const gate = canLock(
    {
      direction: fields.direction as Direction,
      conviction: c as JournalEntry["conviction"],
      reasoning: fields.reasoning as string,
      invalidation: fields.wrongIf as string,
      callTarget: fields.callTargetId,
    },
    asC67Event(event),
  );
  if (!gate.ok) {
    return gate.reason === "macro-target"
      ? { ok: false, code: "macro-target", message: "A macro call needs a call target (the ticker it is scored against)." }
      : { ok: false, code: "incomplete", message: "Direction, conviction, reasoning and wrong-if are all required to lock." };
  }
  return { ok: true };
}

/** Server-set fields at lock: server time, evidence = the event's headlines first seen at or before now. */
export function lockStamp(now: number, headlines: { id: string; firstSeenAt: string }[]) {
  return {
    lockedAt: new Date(now).toISOString(),
    evidenceIds: headlines.filter((h) => new Date(h.firstSeenAt).getTime() <= now).map((h) => h.id),
    scoringRuleVersion: SCORING_RULE_VERSION,
  };
}

/** What the previous lock looked like, for CallRevision.snapshot. */
export function revisionSnapshot(prev: Record<string, unknown>) {
  const keys = ["direction", "conviction", "reasoning", "wrongIf", "callTarget", "lockedAt", "evidenceIds", "scoringRuleVersion"];
  return Object.fromEntries(keys.filter((k) => prev[k] !== undefined).map((k) => [k, prev[k]]));
}

export type Resolution = { action: "none"; reason: string } | { action: "score"; outcome: CallOutcome };

/**
 * Mirrors resolve.ts tryResolve for one server Call. Session timing (session.ts), the resolving move
 * (resolve.ts) and classification (scoring.ts) are the C67 functions. The typical band comes from the
 * event row because the server keeps no price history. Missing data leaves the call pending; it is never
 * marked unresolvable here, since that cannot be undone once prices exist.
 */
export function resolveCall(
  call: { direction: Direction; conviction: number; reasoning: string; wrongIf: string; callTargetId?: string; lockedAt?: string; hasOutcome: boolean; state?: string },
  event: EventFacts,
  now: number,
): Resolution {
  if (call.hasOutcome || call.state === "unresolvable") return { action: "none", reason: "already settled" };
  const entry = {
    direction: call.direction,
    conviction: call.conviction as JournalEntry["conviction"],
    reasoning: call.reasoning,
    invalidation: call.wrongIf,
  } as JournalEntry;
  if (!call.lockedAt || !isEntryComplete(entry)) return { action: "none", reason: "not a complete lock" };
  if (!isResolvableAt(event.startsAt, event.session, now)) return { action: "none", reason: "resolving session not closed" };
  const move = resolvingMove(asC67Event(event), [], call.callTargetId);
  const typical = event.typicalMovePct;
  if (move == null || typical == null || !(typical > 0)) return { action: "none", reason: "no recorded print or typical band" };
  const actualDirection = classifyMove(move, typical);
  return {
    action: "score",
    outcome: {
      actualMovePct: Number(move.toFixed(2)),
      actualDirection,
      result: predictedVsActual(call.direction, actualDirection),
      typicalPct: typical,
      resolvedAt: new Date(now).toISOString(),
    },
  };
}

/** [start, end) of a "YYYY-MM" month in New York time, as epoch ms. */
export function monthRange(month: string): [number, number] | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  return [etMs(y, mo, 1, 0, 0), mo === 12 ? etMs(y + 1, 1, 1, 0, 0) : etMs(y, mo + 1, 1, 0, 0)];
}

export function bootstrapWindow(now: number): [number, number] {
  return [now - BOOTSTRAP_PAST_DAYS * DAY, now + BOOTSTRAP_AHEAD_DAYS * DAY];
}

export function headlineCutoff(now: number): number {
  return now - HEADLINE_RETENTION_DAYS * DAY;
}

const OBJECT_ID = /^[A-Za-z0-9]{10}$/;
export const isObjectId = (v: unknown): v is string => typeof v === "string" && OBJECT_ID.test(v);
