import { useEffect, useState } from "react";
import { typicalSessionPct } from "@/lib/catalyst/scoring";
import { entryFor, isEntryComplete, missingFields } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import type { Direction, Sentiment } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { Field, GhostButton, Pill } from "./ui";

export function JournalSheet() {
  const store = useCatalyst();
  const sheet = store.sheet;
  if (sheet?.name !== "journal" && sheet?.name !== "note") return null;
  if (sheet.name === "note") return <QuickNote eventId={sheet.eventId} />;
  return <FullEntry eventId={sheet.eventId} />;
}

function QuickNote({ eventId }: { eventId: string }) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === eventId);
  const existing = entryFor(store, eventId);
  const [text, setText] = useState(existing?.text ?? "");
  const [sentiment, setSentiment] = useState<Sentiment>(existing?.sentiment ?? "none");

  return (
    <div className="dim absolute inset-0 z-40 flex flex-col justify-end">
      <button className="h-20 w-full" aria-label="Dismiss" onClick={() => store.closeSheet()} />
      <div
        className="flex max-h-[88%] flex-col overflow-hidden rounded-t-[44px]"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--hairline)" }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3">
          <GhostButton onClick={() => store.closeSheet()} className="pl-0">
            Cancel
          </GhostButton>
          <h2 className="text-[16px] font-semibold">Quick note</h2>
          <GhostButton
            onClick={() => {
              store.saveNote(eventId, text, sentiment);
              store.closeSheet();
            }}
            className="pr-0"
          >
            Save note
          </GhostButton>
        </div>
        <div className="overflow-y-auto px-5 pb-10">
          <p className="text-[15px] font-semibold">{event?.title}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            rows={5}
            placeholder="What are you watching into this print?"
            className="mt-3 w-full rounded-[14px] p-3 text-[16px] outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          />
          <p className="mb-3 mt-1 text-right text-[12px] text-[var(--fg-faint)]">{text.length}/500</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["bullish", "Bullish"],
                ["bearish", "Bearish"],
                ["none", "No view"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSentiment(id)}
                className={cn(
                  "h-12 rounded-[14px] text-[14px] font-semibold",
                  sentiment === id ? "fill-accent" : "",
                )}
                style={
                  sentiment === id
                    ? undefined
                    : { background: "var(--bg-elevated)", color: "var(--fg)" }
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-[var(--fg-faint)]">
            Notes are yours only. Catalyst does not execute trades or give advice.
          </p>
          {existing?.text ? (
            <button
              type="button"
              className="mt-4 text-[14px] font-medium text-[var(--color-accent)]"
              onClick={() => store.openSheet({ name: "journal", eventId })}
            >
              Open full entry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FullEntry({ eventId }: { eventId: string }) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === eventId);
  const existing = entryFor(store, eventId);

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
  const stateLabel = !existing && blank ? "New entry" : complete ? "COMPLETE" : "INCOMPLETE";
  const ticker = event?.tickerId ? store.tickers.find((t) => t.id === event.tickerId) : undefined;
  const typical = event?.tickerId ? typicalSessionPct(store.sparks[event.tickerId]?.["1M"] ?? []) : null;
  const sub =
    stateLabel === "New entry"
      ? "Four fields. The call scores the day after the event."
      : complete
        ? "This call will score once the next session prints."
        : `Still open: ${missing.join(", ")}.`;

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
          <div className="text-center">
            <p className="text-[16px] font-semibold">Journal entry</p>
          </div>
          <Pill tone={complete ? "pos" : "warn"}>{stateLabel}</Pill>
        </div>
        <p className="px-5 pb-2 text-[13px] text-[var(--fg-muted)]">
          {event?.title}. {sub}
          {typical != null ? ` Typical session ±${typical.toFixed(1)}%${ticker ? ` in ${ticker.symbol}` : ""}.` : ""}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-5 pb-4">
          <Field label="Direction" warn={Boolean(existing) && !direction}>
            <div className="grid grid-cols-3">
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
                    "h-12 text-[15px] font-semibold",
                    direction === id ? "fill-accent" : "text-[var(--fg)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>

          <div className="mt-4">
            <Field
              label="Conviction"
              warn={Boolean(direction) && conviction == null}
              hint={conviction ? `${conviction} of 5` : "Not set"}
            >
              <div className="px-3 py-3">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={conviction ?? 1}
                  onChange={(e) => setConviction(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-[var(--fg-faint)]">
                  <span>1 low</span>
                  <span className="num">{[1, 2, 3, 4, 5].join("   ")}</span>
                  <span>5 high</span>
                </div>
                {conviction == null ? (
                  <button
                    type="button"
                    className="mt-2 text-[13px] font-medium text-[var(--color-accent)]"
                    onClick={() => setConviction(3)}
                  >
                    Set conviction
                  </button>
                ) : null}
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Reasoning" warn={Boolean(direction) && !reasoning.trim()}>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Why this side, in one or two sentences."
                className="w-full bg-transparent p-3 text-[16px] outline-none"
              />
            </Field>
            <p className="mt-1 text-right text-[12px] text-[var(--fg-faint)]">{reasoning.length}/500</p>
          </div>

          <div className="mt-2">
            <Field label="Invalidation condition" warn={Boolean(direction) && !invalidation.trim()}>
              <textarea
                value={invalidation}
                onChange={(e) => setInvalidation(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="What would tell you this call was wrong?"
                className="w-full bg-transparent p-3 text-[16px] outline-none"
              />
            </Field>
          </div>
        </div>
        <div className="px-5 pb-8 pt-2" style={{ boxShadow: "0 -0.5px 0 var(--hairline)" }}>
          {blank ? (
            <button
              type="button"
              disabled
              className="h-12 w-full rounded-[14px] text-[16px] font-semibold"
              style={{ background: "var(--bg-elevated)", color: "var(--fg-faint)" }}
            >
              Pick a direction to continue
            </button>
          ) : (
            <button
              type="button"
              onClick={persist}
              className="pressable h-12 w-full rounded-[14px] fill-accent text-[16px] font-semibold"
            >
              {complete ? "Save entry" : "Save as incomplete"}
            </button>
          )}
          <p className="mt-2 text-center text-[12px] leading-relaxed text-[var(--fg-faint)]">
            {complete
              ? "Complete. Scores the session after the event against the actual next-day move."
              : "Incomplete entries stay in Pending. They never enter the accuracy percentage."}
          </p>
        </div>
      </div>
    </div>
  );
}
