// C67 journal.tsx CallComposer. Drafts save on the phone (saveDraft, 0 requests); "Lock the call" sends
// one request (lockCall). The server stamps lockedAt / evidence; failures keep the draft.
import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { canLock } from "../../../src/lib/catalyst/lock.ts";
import { entryFor } from "../../../src/lib/catalyst/selectors.ts";
import { isEntryComplete, missingFields, type Direction, type JournalEntry } from "../../../src/lib/catalyst/types.ts";
import { lockCall, LockError, saveDraft } from "../data";
import { getCache } from "../data/cache";
import { R, TABULAR, useC, wide } from "./kit";
import { Press } from "./kit";
import { labelOf, macroTargets, useSlice } from "./slice";

type Conv = 1 | 2 | 3 | 4 | 5;

/** What the composer starts from: this phone's draft if any, else the locked call. */
function startingPoint(eventId: string) {
  const s = getCache();
  const d = s.drafts[eventId];
  const call = Object.values(s.calls).find((c) => c.eventId === eventId);
  return {
    direction: (d?.direction ?? call?.direction ?? null) as Direction | null,
    conviction: (d?.conviction ?? call?.conviction ?? null) as Conv | null,
    reasoning: d?.reasoning ?? call?.reasoning ?? "",
    wrongIf: d?.wrongIf ?? call?.wrongIf ?? "",
    callTarget: d?.callTargetId ?? call?.callTargetId,
  };
}

export function CallComposer({ eventId, layout = "sheet", onLock }: { eventId: string; layout?: "sheet" | "inline"; onLock?: () => void }) {
  const c = useC();
  const s = useSlice();
  const event = s.eventById[eventId];
  const existing = entryFor(s, eventId);
  const targets = macroTargets(s);

  const start = startingPoint(eventId);
  const [direction, setDirection] = useState<Direction | null>(start.direction);
  const [conviction, setConviction] = useState<Conv | null>(start.conviction);
  const [reasoning, setReasoning] = useState(start.reasoning);
  const [wrongIf, setWrongIf] = useState(start.wrongIf);
  const [callTarget, setCallTarget] = useState<string | undefined>(start.callTarget);
  const [lockError, setLockError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = startingPoint(eventId);
    setDirection(p.direction);
    setConviction(p.conviction);
    setReasoning(p.reasoning);
    setWrongIf(p.wrongIf);
    setCallTarget(p.callTarget);
    setLockError(null);
  }, [eventId]);

  const draft: JournalEntry = {
    id: "draft",
    eventId,
    text: reasoning,
    sentiment: null,
    direction,
    conviction,
    reasoning,
    invalidation: wrongIf || null,
    callTarget,
    updatedAt: new Date().toISOString(),
  };
  const complete = isEntryComplete(draft);
  const missing = missingFields(draft);
  const blank = !direction && !conviction && !reasoning.trim() && !wrongIf.trim();
  const inline = layout === "inline";
  const gate = event ? canLock(draft, event) : ({ ok: false, reason: "missing-event" } as const);
  const started = event ? s.now >= new Date(event.startsAt).getTime() : false;
  const locked = Boolean(existing?.lockedAt);
  const frozen = locked && started;

  function persist(patch: { direction?: Direction | null; conviction?: Conv | null; reasoning?: string; wrongIf?: string; callTarget?: string }) {
    if (frozen) return;
    saveDraft(eventId, {
      direction: patch.direction !== undefined ? patch.direction : direction,
      conviction: patch.conviction !== undefined ? patch.conviction : conviction,
      reasoning: patch.reasoning !== undefined ? patch.reasoning : reasoning,
      wrongIf: (patch.wrongIf !== undefined ? patch.wrongIf : wrongIf) || null,
      callTargetId: patch.callTarget !== undefined ? patch.callTarget : callTarget,
    });
  }

  async function lock() {
    persist({});
    if (!event) return;
    const check = canLock(draft, event);
    if (!check.ok) {
      setLockError(check.reason === "macro-target" ? "Pick a target before locking a macro call." : "Finish the four fields first.");
      return;
    }
    setBusy(true);
    setLockError(null);
    try {
      await lockCall(eventId);
      onLock?.();
    } catch (e) {
      setLockError(e instanceof LockError ? e.message : "Could not lock.");
    } finally {
      setBusy(false);
    }
  }

  const targetSym = callTarget ? targets.find((t) => t.id === callTarget)?.symbol : null;
  const label = (t: string) => (
    <Text style={{ color: c.muted, fontSize: 13, fontWeight: "600", letterSpacing: wide(13), textTransform: "uppercase", marginBottom: 8 }}>{t}</Text>
  );
  const choice = (on: boolean) => ({ backgroundColor: on ? c.accent : c.elevated });
  const choiceText = (on: boolean) => ({ color: on ? c.accentInk : c.fg });
  const input = (value: string, set: (v: string) => void, key: "reasoning" | "wrongIf", placeholder: string) => (
    <TextInput
      value={value}
      editable={!frozen}
      onChangeText={(v) => set(v.slice(0, 500))}
      onBlur={() => persist({ [key]: value })}
      placeholder={placeholder}
      placeholderTextColor={c.faint}
      multiline={!inline}
      style={[
        { backgroundColor: c.elevated, color: c.fg, borderRadius: R.field, fontSize: 16, paddingHorizontal: 14 },
        inline ? { height: 48 } : { minHeight: 92, paddingTop: 14, paddingBottom: 14, lineHeight: 24, textAlignVertical: "top" },
      ]}
    />
  );

  return (
    <View>
      {event?.kind === "macro" ? (
        <View style={{ marginBottom: 16 }}>
          {label("Target")}
          <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
            {labelOf(s, event).kicker}
            {targetSym ? `  ·  ${targetSym}, next session` : "  ·  pick what this call is scored against"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {targets.map((t) => {
              const on = callTarget === t.id;
              return (
                <Press
                  key={t.id}
                  disabled={frozen}
                  onPress={() => {
                    setCallTarget(t.id);
                    persist({ callTarget: t.id });
                  }}
                  style={[{ height: 36, borderRadius: R.pill, paddingHorizontal: 12, justifyContent: "center" }, choice(on)]}
                >
                  <Text style={[{ fontSize: 13, fontWeight: "600" }, choiceText(on)]}>{t.symbol}</Text>
                </Press>
              );
            })}
          </View>
        </View>
      ) : null}

      {inline ? null : label("Direction")}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(
          [
            ["up", "Up"],
            ["down", "Down"],
            ["flat", "Flat"],
          ] as const
        ).map(([id, text]) => (
          <Press
            key={id}
            disabled={frozen}
            label={text}
            onPress={() => {
              setDirection(id);
              persist({ direction: id });
            }}
            style={[{ flex: 1, height: inline ? 64 : 56, borderRadius: R.field, alignItems: "center", justifyContent: "center" }, choice(direction === id)]}
          >
            <Text style={[{ fontSize: 17, fontWeight: "600" }, choiceText(direction === id)]}>{text}</Text>
          </Press>
        ))}
      </View>

      {direction ? (
        <>
          <View style={{ height: 20 }} />
          {label("Conviction")}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <Press
                key={n}
                disabled={frozen}
                label={`Conviction ${n}`}
                onPress={() => {
                  setConviction(n);
                  persist({ conviction: n });
                }}
                style={[{ flex: 1, height: 48, borderRadius: R.btn, alignItems: "center", justifyContent: "center" }, choice(conviction === n)]}
              >
                <Text style={[{ fontSize: 16, fontWeight: "600" }, TABULAR, choiceText(conviction === n)]}>{n}</Text>
              </Press>
            ))}
          </View>
          <View style={{ marginTop: 6, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: c.faint, fontSize: 11 }}>Low</Text>
            <Text style={{ color: c.faint, fontSize: 11 }}>High</Text>
          </View>
        </>
      ) : inline ? (
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center", marginTop: 12 }}>Tap a direction. That starts the call.</Text>
      ) : null}

      {direction && conviction ? (
        <>
          <View style={{ height: 20 }} />
          {label("Why this prints")}
          {input(reasoning, setReasoning, "reasoning", inline ? "One sentence." : "One or two sentences. The tape already knows the story.")}
          <View style={{ height: 16 }} />
          {label("Wrong if")}
          {input(wrongIf, setWrongIf, "wrongIf", inline ? "The fact that kills this." : "The one fact that kills this call.")}

          <View style={{ marginTop: inline ? 16 : 20 }}>
            {frozen ? (
              <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>Locked before the event. The original call is preserved.</Text>
            ) : (
              <>
                <Press
                  disabled={blank || busy}
                  onPress={complete && gate.ok ? lock : () => persist({})}
                  style={{ height: 48, borderRadius: R.btn, alignItems: "center", justifyContent: "center", backgroundColor: blank ? c.elevated : c.accent, opacity: blank ? 0.4 : 1 }}
                >
                  <Text style={{ color: blank ? c.faint : c.accentInk, fontSize: 16, fontWeight: "600" }}>
                    {busy ? "Locking…" : complete && gate.ok ? (locked ? "Update the lock" : "Lock the call") : "Save draft"}
                  </Text>
                </Press>
                <Text style={{ color: lockError ? c.warn : c.faint, fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 8 }}>
                  {lockError
                    ? lockError
                    : complete && gate.ok
                      ? "Locked. Catalyst scores the resolving session close — not against memory."
                      : missing.length
                        ? `Draft until ${missing.join(", ")} are set. Drafts never enter the accuracy %.`
                        : event?.kind === "macro" && !callTarget
                          ? "A macro call needs an explicit target to lock."
                          : "Incomplete entries stay in Pending."}
                </Text>
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}
