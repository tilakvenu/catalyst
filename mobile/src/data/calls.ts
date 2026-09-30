// Calls. Drafts live only on this phone; lockCall sends one request and the server stamps
// lockedAt, evidence and the scoring rule. Re-locking before the event is the same call.
import type { CallDTO } from "../../../cloud/src/dto.ts";
import { canLock, eventHasStarted } from "../../../src/lib/catalyst/lock.ts";
import { getCache, updateCache, upsert, without, type Draft } from "./cache.ts";
import { draftToEntry, toEvent } from "./map.ts";
import { CONNECTION_FAILED, Parse } from "./parse.ts";

export type DraftFields = Partial<Pick<Draft, "direction" | "conviction" | "reasoning" | "wrongIf" | "callTargetId">>;

/** Local only, works offline, zero requests. Merges into this event's draft. */
export function saveDraft(eventId: string, fields: DraftFields): Draft {
  const s = getCache();
  const locked = Object.values(s.calls).find((c) => c.eventId === eventId);
  const base: Draft = s.drafts[eventId] ?? {
    eventId,
    // Editing a locked call starts from what was locked.
    direction: locked?.direction ?? null,
    conviction: locked?.conviction ?? null,
    reasoning: locked?.reasoning ?? null,
    wrongIf: locked?.wrongIf ?? null,
    callTargetId: locked?.callTargetId,
    updatedAt: new Date().toISOString(),
  };
  const draft: Draft = { ...base, ...fields, eventId, updatedAt: new Date().toISOString() };
  updateCache((st) => ({ ...st, drafts: { ...st.drafts, [eventId]: draft } }));
  return draft;
}

export function discardDraft(eventId: string) {
  updateCache((s) => ({ ...s, drafts: without(s.drafts, [eventId]) }));
}

export type LockErrorKind = "offline" | "incomplete" | "macro-target" | "started" | "rejected";

export class LockError extends Error {
  kind: LockErrorKind;
  constructor(kind: LockErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "LockError";
  }
}

const toCallDTO = (o: Parse.Object, eventId: string): CallDTO => ({
  id: o.id!,
  eventId,
  direction: o.get("direction"),
  conviction: o.get("conviction"),
  reasoning: o.get("reasoning"),
  wrongIf: o.get("wrongIf"),
  callTargetId: (o.get("callTarget") as Parse.Object | undefined)?.id,
  lockedAt: (o.get("lockedAt") as Date).toISOString(),
  evidenceIds: o.get("evidenceIds") ?? [],
  scoringRuleVersion: o.get("scoringRuleVersion"),
  state: o.get("state"),
  outcome: o.get("outcome"),
  updatedAt: (o.updatedAt ?? new Date()).toISOString(),
});

const pointer = (className: string, objectId: string) => Parse.Object.fromJSON({ className, objectId, __type: "Pointer" });

/**
 * Locks this event's draft. Needs the network. Checks locally first (same C67 canLock the server uses)
 * so an incomplete draft never costs a request. On failure the draft is kept.
 */
export async function lockCall(eventId: string): Promise<CallDTO> {
  const s = getCache();
  const draft = s.drafts[eventId];
  const event = s.events[eventId];
  if (!draft) throw new LockError("incomplete", "Nothing to lock yet. Write the call first.");
  if (!event) throw new LockError("rejected", "This event is not on this device. Pull to refresh.");
  const c67Event = toEvent(event);
  if (eventHasStarted(c67Event, Date.now())) throw new LockError("started", "This event has started; calls on it are frozen.");
  const gate = canLock(draftToEntry(draft), c67Event);
  if (!gate.ok) {
    throw gate.reason === "macro-target"
      ? new LockError("macro-target", "Pick the ticker this macro call is scored against.")
      : new LockError("incomplete", "Direction, conviction, reasoning and wrong-if are all required to lock.");
  }

  const existing = Object.values(s.calls).find((c) => c.eventId === eventId);
  const call = existing ? Parse.Object.fromJSON({ className: "Call", objectId: existing.id }) : new Parse.Object("Call");
  if (!existing) call.set("event", pointer("CatalystEvent", eventId));
  call.set("direction", draft.direction);
  call.set("conviction", draft.conviction);
  call.set("reasoning", draft.reasoning);
  call.set("wrongIf", draft.wrongIf);
  if (event.kind === "macro" && draft.callTargetId) call.set("callTarget", pointer("Ticker", draft.callTargetId));

  try {
    await call.save();
  } catch (e) {
    const err = e as { code?: number; message?: string };
    if (err.code === CONNECTION_FAILED) {
      throw new LockError("offline", "You're offline. Your draft is saved on this phone; lock it when you're back online.");
    }
    throw new LockError("rejected", err.message ?? "The server did not accept this lock.");
  }
  const dto = toCallDTO(call, eventId);
  updateCache((st) => ({ ...st, calls: upsert(st.calls, [dto]), drafts: without(st.drafts, [eventId]) }));
  return dto;
}
