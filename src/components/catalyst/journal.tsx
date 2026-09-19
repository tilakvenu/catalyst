import { useEffect, useState } from "react";
import { typicalSessionPct } from "@/lib/catalyst/scoring";
import { entryFor, eventLabel, isEntryComplete, missingFields } from "@/lib/catalyst/selectors";
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
  const existing = entryFor(store, eventId);
  const { kicker } = event ? eventLabel(store, event) : { kicker: "Call" };

  const [direction, setDirection] = useState<Direction | null>(existing?.direction ?? null);
  const [conviction, setConviction] = useState<number | null>(existing?.conviction ?? null);
  const [reasoning, setReasoning] = useState(existing?.reasoning ?? existing?.text ?? "");
  const [invalidation, setInvalidation] = useState(existing?.invalidation ?? "");

  useEffect(() => {
    setDirection(existing?.direction ?? null);
    setConviction(existing?.conviction ?? null);
    setReasoning(existing?.reasoning ?? existing?.text ?? "");
    setInvalidation(existing?.invalidation ?? "");
  }, [eventId, existing?.id]);

  const draft = {
    id: existing?.id ?? "draft",
    eventId,
    text: reasoning,
    sentiment: existing?.sentiment ?? null,
    direction,
    conviction: conviction as 1 | 2 | 3 | 4 | 5 | null,
    reasoning,
    invalidation: invalidation || null,
    updatedAt: new Date().toISOString(),
  };
  const complete = isEntryComplete(draft);
  const missing = missingFields(draft);
  const blank = !direction && !conviction && !reasoning.trim() && !invalidation.trim();
  const ticker = event?.tickerId ? store.tickers.find((t) => t.id === event.tickerId) : undefined;
  const typical = event?.tickerId ? typicalSessionPct(store.sparks[event.tickerId]?.["1M"] ?? []) : null;

  function persist() {
    store.saveJournal(eventId, {
      direction,
      conviction: conviction as 1 | 2 | 3 | 4 | 5 | null,
      reasoning,
      invalidation: invalidation || null,
      text: reasoning,
      sentiment:
        direction === "up" ? "bullish" : direction === "down" ? "bearish" : existing?.sentiment ?? "none",
    });
    store.closeSheet();
  }

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
          <Pill tone={complete ? "pos" : blank ? "neutral" : "warn"}>
            {complete ? "Ready" : blank ? "New" : "Draft"}
          </Pill>
        </div>
        <p className="px-5 pb-3 text-[13px] leading-snug text-[var(--fg-muted)]">
          {event?.title}
          {typical != null ? ` · Typical session ±${typical.toFixed(1)}%${ticker ? ` in ${ticker.symbol}` : ""}` : ""}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-5 pb-4">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Direction</p>
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
                onClick={() => setDirection(id)}
                className={cn(
                  "pressable h-14 rounded-[16px] text-[17px] font-semibold",
                  direction === id ? "fill-accent" : "",
                )}
                style={
                  direction === id ? undefined : { background: "var(--bg-elevated)", color: "var(--fg)" }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Conviction
          </p>
          <div className="grid grid-cols-5 gap-2">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setConviction(n)}
                className={cn(
                  "pressable h-12 rounded-[14px] text-[16px] font-semibold num",
                  conviction === n ? "fill-accent" : "",
                )}
                style={
                  conviction === n ? undefined : { background: "var(--bg-elevated)", color: "var(--fg)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1.5 flex justify-between text-[11px] text-[var(--fg-faint)]">
            <span>Low</span>
            <span>High</span>
          </p>

          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Why this prints
          </p>
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="One or two sentences. The tape already knows the story."
            className="w-full rounded-[16px] p-3.5 text-[16px] leading-relaxed outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          />

          <p className="mb-2 mt-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Wrong if
          </p>
          <textarea
            value={invalidation}
            onChange={(e) => setInvalidation(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="The one fact that kills this call."
            className="w-full rounded-[16px] p-3.5 text-[16px] leading-relaxed outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          />
        </div>

        <div className="px-5 pb-8 pt-2" style={{ boxShadow: "0 -0.5px 0 var(--hairline)" }}>
          <button
            type="button"
            disabled={blank}
            onClick={persist}
            className={cn(
              "pressable h-12 w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-40",
              blank ? "" : "fill-accent",
            )}
            style={blank ? { background: "var(--bg-elevated)", color: "var(--fg-faint)" } : undefined}
          >
            {complete ? "Lock the call" : blank ? "Pick a direction" : "Save draft"}
          </button>
          <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--fg-faint)]">
            {complete
              ? "Locked. Scores the session after the print — not against memory."
              : missing.length
                ? `Draft until ${missing.join(", ")} are set. Drafts never enter the accuracy %.`
                : "Incomplete entries stay in Pending."}
          </p>
        </div>
      </div>
    </div>
  );
}
