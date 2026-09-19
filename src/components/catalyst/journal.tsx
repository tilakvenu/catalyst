import { useEffect, useState } from "react";
import { canLock, macroTargetOptions } from "@/lib/catalyst/lock";
import { flatBandPct } from "@/lib/catalyst/scoring";
import { entryFor, eventLabel, isEntryComplete, missingFields, typicalFor } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { Direction } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { GhostButton, Pill } from "./ui";

export function JournalSheet() {
  const store = useCatalyst();
  const sheet = store.sheet;
  if (sheet?.name !== "journal" && sheet?.name !== "note") return null;
  return <CallSheet eventId={sheet.eventId} />;
}

function CallSheet({ eventId }: { eventId: string }) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === eventId);
  const draft = entryFor(store, eventId);
  const { kicker } = event ? eventLabel(store, event) : { kicker: "Call" };
  const complete = draft ? isEntryComplete(draft) : false;
  const blank = !draft?.direction && !draft?.conviction && !draft?.reasoning?.trim() && !draft?.invalidation?.trim();
  const locked = Boolean(draft?.lockedAt);

  return (
    <div className="dim absolute inset-0 z-40 flex flex-col justify-end">
      <button className="h-8 w-full" aria-label="Dismiss" onClick={() => store.closeSheet()} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[44px]" style={{ background: "var(--bg)" }}>
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--hairline)" }} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <GhostButton onClick={() => store.closeSheet()} className="pl-0">
            Cancel
          </GhostButton>
          <p className="text-[16px] font-semibold">{kicker}</p>
          <Pill tone={locked ? "pos" : complete ? "accent" : blank ? "neutral" : "warn"}>
            {locked ? "Locked" : complete ? "Ready" : blank ? "New" : "Draft"}
          </Pill>
        </div>
        <p className="px-5 pb-3 text-[13px] leading-snug text-[var(--fg-muted)]">{event?.title}</p>
        <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-5 pb-4">
          <CallComposer eventId={eventId} layout="sheet" onLock={() => store.closeSheet()} />
        </div>
      </div>
    </div>
  );
}

export function CallComposer({
  eventId,
  layout = "sheet",
  onLock,
}: {
  eventId: string;
  layout?: "sheet" | "inline";
  onLock?: () => void;
}) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === eventId);
  const existing = entryFor(store, eventId);
  const targets = macroTargetOptions(store.tickers);

  const [direction, setDirection] = useState<Direction | null>(existing?.direction ?? null);
  const [conviction, setConviction] = useState<number | null>(existing?.conviction ?? null);
  const [reasoning, setReasoning] = useState(existing?.reasoning ?? existing?.text ?? "");
  const [invalidation, setInvalidation] = useState(existing?.invalidation ?? "");
  const [callTarget, setCallTarget] = useState<string | undefined>(existing?.callTarget);
  const [lockError, setLockError] = useState<string | null>(null);

  useEffect(() => {
    const note = entryFor(useCatalyst.getState(), eventId);
    setDirection(note?.direction ?? null);
    setConviction(note?.conviction ?? null);
    setReasoning(note?.reasoning ?? note?.text ?? "");
    setInvalidation(note?.invalidation ?? "");
    setCallTarget(note?.callTarget);
    setLockError(null);
  }, [eventId]);

  const draft = {
    id: existing?.id ?? "draft",
    eventId,
    text: reasoning,
    sentiment: existing?.sentiment ?? null,
    direction,
    conviction: conviction as 1 | 2 | 3 | 4 | 5 | null,
    reasoning,
    invalidation: invalidation || null,
    callTarget,
    updatedAt: new Date().toISOString(),
  };
  const complete = isEntryComplete(draft);
  const missing = missingFields(draft);
  const blank = !direction && !conviction && !reasoning.trim() && !invalidation.trim();
  const typical = event ? typicalFor(store, event, callTarget) : null;
  const band = typical != null ? flatBandPct(typical) : null;
  const inline = layout === "inline";
  const gate = event
    ? canLock(draft, event)
    : ({ ok: false, reason: "missing-event" } as const);
  const started = event ? store.now >= new Date(event.startsAt).getTime() : false;
  const locked = Boolean(existing?.lockedAt);
  const frozen = locked && started;

  function persist(patch: {
    direction?: Direction | null;
    conviction?: number | null;
    reasoning?: string;
    invalidation?: string;
    callTarget?: string;
  }) {
    if (frozen) return;
    const dir = patch.direction !== undefined ? patch.direction : direction;
    const conv = patch.conviction !== undefined ? patch.conviction : conviction;
    const why = patch.reasoning !== undefined ? patch.reasoning : reasoning;
    const inv = patch.invalidation !== undefined ? patch.invalidation : invalidation;
    const target = patch.callTarget !== undefined ? patch.callTarget : callTarget;
    store.saveJournal(eventId, {
      direction: dir,
      conviction: (conv as 1 | 2 | 3 | 4 | 5 | null) ?? null,
      reasoning: why,
      invalidation: inv || null,
      text: why,
      callTarget: target,
      sentiment: dir === "up" ? "bullish" : dir === "down" ? "bearish" : existing?.sentiment ?? "none",
    });
  }

  function lock() {
    persist({});
    if (!event) return;
    const check = canLock(
      {
        direction,
        conviction: conviction as 1 | 2 | 3 | 4 | 5 | null,
        reasoning,
        invalidation,
        callTarget,
      },
      event,
    );
    if (!check.ok) {
      setLockError(check.reason === "macro-target" ? "Pick a target before locking a macro call." : "Finish the four fields first.");
      return;
    }
    const result = store.lockCall(eventId);
    if (!result.ok) {
      setLockError(result.reason === "macro-target" ? "Pick a target before locking a macro call." : "Could not lock.");
      return;
    }
    setLockError(null);
    onLock?.();
  }

  const targetSym = callTarget ? targets.find((t) => t.id === callTarget)?.symbol : null;

  return (
    <div>
      {typical != null && band != null ? (
        <p className="mb-3 text-[13px] text-[var(--fg-muted)]">
          Typical session ±{typical.toFixed(1)}% · Flat band ±{band.toFixed(1)}%
          <span className="mt-0.5 block text-[11px] text-[var(--fg-faint)]">Catalyst’s scoring rule v1 — not statistically optimal.</span>
        </p>
      ) : null}

      {event?.kind === "macro" ? (
        <div className="mb-4">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Target
          </p>
          <p className="mb-2 text-[12px] text-[var(--fg-muted)]">
            {eventLabel(store, event).kicker}
            {targetSym ? `  ·  ${targetSym}, next session` : "  ·  pick what this call is scored against"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => {
              const on = callTarget === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={frozen}
                  onClick={() => {
                    setCallTarget(t.id);
                    persist({ callTarget: t.id });
                  }}
                  className={cn("pressable h-9 rounded-full px-3 text-[13px] font-semibold", on ? "fill-accent" : "")}
                  style={on ? undefined : { background: "var(--bg-elevated)", color: "var(--fg)" }}
                >
                  {t.symbol}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className={cn("mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]", inline && "sr-only")}>
        Direction
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["up", "Up"],
            ["down", "Down"],
            ["flat", "Flat"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            disabled={frozen}
            onClick={() => {
              setDirection(id);
              persist({ direction: id });
            }}
            className={cn(
              "pressable rounded-[16px] text-[17px] font-semibold",
              inline ? "h-16" : "h-14",
              direction === id ? "fill-accent" : "",
            )}
            style={direction === id ? undefined : { background: "var(--bg-elevated)", color: "var(--fg)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {direction ? (
        <>
          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Conviction
          </p>
          <div className="grid grid-cols-5 gap-2">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={frozen}
                onClick={() => {
                  setConviction(n);
                  persist({ conviction: n });
                }}
                className={cn(
                  "pressable h-12 rounded-[14px] text-[16px] font-semibold num",
                  conviction === n ? "fill-accent" : "",
                )}
                style={conviction === n ? undefined : { background: "var(--bg-elevated)", color: "var(--fg)" }}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex justify-between text-[11px] text-[var(--fg-faint)]">
            <span>Low</span>
            <span>High</span>
          </p>
        </>
      ) : inline ? (
        <p className="mt-3 text-center text-[13px] text-[var(--fg-muted)]">Tap a direction. That starts the call.</p>
      ) : null}

      {direction && conviction ? (
        <>
          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Why this prints
          </p>
          {inline ? (
            <input
              value={reasoning}
              disabled={frozen}
              onChange={(e) => setReasoning(e.target.value.slice(0, 500))}
              onBlur={() => persist({ reasoning })}
              placeholder="One sentence."
              className="h-12 w-full rounded-[16px] px-3.5 text-[16px] outline-none"
              style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
            />
          ) : (
            <textarea
              value={reasoning}
              disabled={frozen}
              onChange={(e) => setReasoning(e.target.value.slice(0, 500))}
              onBlur={() => persist({ reasoning })}
              rows={3}
              placeholder="One or two sentences. The tape already knows the story."
              className="w-full rounded-[16px] p-3.5 text-[16px] leading-relaxed outline-none"
              style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
            />
          )}

          <p className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Wrong if
          </p>
          {inline ? (
            <input
              value={invalidation}
              disabled={frozen}
              onChange={(e) => setInvalidation(e.target.value.slice(0, 500))}
              onBlur={() => persist({ invalidation })}
              placeholder="The fact that kills this."
              className="h-12 w-full rounded-[16px] px-3.5 text-[16px] outline-none"
              style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
            />
          ) : (
            <textarea
              value={invalidation}
              disabled={frozen}
              onChange={(e) => setInvalidation(e.target.value.slice(0, 500))}
              onBlur={() => persist({ invalidation })}
              rows={3}
              placeholder="The one fact that kills this call."
              className="w-full rounded-[16px] p-3.5 text-[16px] leading-relaxed outline-none"
              style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
            />
          )}

          <div className={inline ? "mt-4" : "mt-5"}>
            {frozen ? (
              <p className="text-center text-[13px] text-[var(--fg-muted)]">
                Locked before the event. The original call is preserved.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  disabled={blank}
                  onClick={complete && gate.ok ? lock : () => persist({})}
                  className={cn(
                    "pressable h-12 w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-40",
                    blank ? "" : "fill-accent",
                  )}
                  style={blank ? { background: "var(--bg-elevated)", color: "var(--fg-faint)" } : undefined}
                >
                  {complete && gate.ok ? "Lock the call" : "Save draft"}
                </button>
                <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--fg-faint)]">
                  {lockError
                    ? lockError
                    : complete && gate.ok
                      ? "Locked. Catalyst scores the resolving session close — not against memory."
                      : missing.length
                        ? `Draft until ${missing.join(", ")} are set. Drafts never enter the accuracy %.`
                        : event?.kind === "macro" && !callTarget
                          ? "A macro call needs an explicit target to lock."
                          : "Incomplete entries stay in Pending."}
                </p>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
