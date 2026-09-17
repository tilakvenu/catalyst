import { useEffect } from "react";
import { ageLabel, countdown, formatPct, formatWhen, impactLabel, sessionLabel } from "@/lib/catalyst/format";
import { typicalSessionPct } from "@/lib/catalyst/scoring";
import { entryFor, eventLabel, isUrgent, kindLabel, suggestedPrint } from "@/lib/catalyst/selectors";
import { isEntryComplete } from "@/lib/catalyst/types";
import { useCatalyst } from "@/lib/catalyst/store";
import { TapeCard } from "./context";
import { Pill, PrimaryButton, SecondaryButton, TopBar } from "./ui";

export function EventScreen({ id }: { id: string }) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === id);
  useEffect(() => {
    if (!event?.tickerId) return;
    const t = store.tickers.find((x) => x.id === event.tickerId);
    if (t) void store.refreshLive(t.symbol, t.id);
  }, [event?.tickerId]);
  if (!event) {
    return (
      <div className="p-6">
        <TopBar onBack={() => store.pop()} title="Missing" />
      </div>
    );
  }
  const { kicker } = eventLabel(store, event);
  const urgent = isUrgent(event.startsAt, store.now);
  const note = entryFor(store, event.id);
  const news = store.headlines.filter((h) =>
    event.tickerId ? h.tickerId === event.tickerId : h.macroId === event.macroId,
  );
  const prints = event.tickerId ? store.earningsHistory[event.tickerId] ?? [] : [];
  const rec = event.tickerId ? store.recommendations[event.tickerId] : undefined;
  const ready = suggestedPrint(store, event);
  const complete = note ? isEntryComplete(note) : false;
  const typical = event.tickerId ? typicalSessionPct(store.sparks[event.tickerId]?.["1M"] ?? []) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 px-2 pb-3 pt-0" style={{ background: "var(--bg)" }}>
        <TopBar
          onBack={() => store.pop()}
          title={kicker}
          trailing={
            <button
              type="button"
              onClick={() => store.toggleNotify(event.id)}
              className="pressable mr-2 h-9 rounded-full px-3 text-[13px] font-semibold"
              style={{
                background: event.notify ? "var(--color-accent)" : "var(--bg-elevated)",
                color: event.notify ? "var(--color-accent-ink)" : "var(--fg)",
              }}
            >
              {event.notify ? "Notify on" : "Notify"}
            </button>
          }
        />
        <div className="px-3">
          <p className="num text-[28px] font-semibold tracking-tight" style={{ color: urgent ? "var(--color-accent)" : "var(--fg)" }}>
            {countdown(event.startsAt, store.now)}
          </p>
          <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
            {formatWhen(event.startsAt)} · {sessionLabel(event.session)}
            {typical != null ? ` · typ. ±${typical.toFixed(1)}%` : ""}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-12">
        <div className="flex flex-wrap gap-1.5">
          <Pill>{kindLabel(event)}</Pill>
          {urgent ? <Pill tone="accent">Within 48h</Pill> : null}
          {!event.confirmed ? <Pill tone="warn">Estimated</Pill> : null}
          {complete ? <Pill tone="pos">Call in</Pill> : note ? <Pill tone="accent">Draft</Pill> : null}
          {event.impact.map((t) => (
            <Pill key={t}>{impactLabel(t)}</Pill>
          ))}
        </div>

        <h1 className="mt-3 text-[22px] font-semibold leading-tight text-balance">{event.title}</h1>

        {ready ? (
          <div className="mt-4 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
            <p className="text-[16px] font-semibold">Next-session print is in</p>
            <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
              {formatPct(ready.movePct)} · {ready.direction}. Score the call against the actual, not against memory.
            </p>
            <div className="mt-3">
              <PrimaryButton onClick={() => store.applyPrintScore(event.id)}>Score this call</PrimaryButton>
            </div>
          </div>
        ) : null}

        <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Your call</h2>
        <div className="mt-2 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
          {note?.text ? (
            <>
              <div className="flex items-center gap-2">
                {note.sentiment && note.sentiment !== "none" ? (
                  <Pill tone={note.sentiment === "bullish" ? "pos" : "neg"}>
                    {note.sentiment === "bullish" ? "Bullish" : "Bearish"}
                  </Pill>
                ) : (
                  <Pill>No view</Pill>
                )}
                {note.conviction ? <Pill>Conviction {note.conviction}/5</Pill> : null}
                <span className="text-[12px] text-[var(--fg-faint)]">Edited {ageLabel(note.updatedAt, store.now)}</span>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed">{note.text}</p>
            </>
          ) : (
            <p className="text-[14px] text-[var(--fg-muted)]">No call yet. Four fields — direction, conviction, why, invalidation.</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => store.openSheet({ name: "journal", eventId: event.id })}
          className="pressable mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] fill-accent text-[16px] font-semibold"
        >
          <LockIcon />
          {note ? "Continue journal" : "Write the call"}
        </button>

        {!event.confirmed ? (
          <div className="mt-5 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
            <p className="text-[16px] font-semibold">Nothing confirmed yet</p>
            <p className="mt-1 text-[14px] leading-relaxed text-[var(--fg-muted)]">
              This date comes from the company’s reporting pattern. Consensus figures appear once the company confirms.
            </p>
            <div className="mt-3">
              <SecondaryButton onClick={() => store.toggleNotify(event.id)}>
                {event.notify ? "Notification on" : "Notify me when confirmed"}
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <>
            {event.consensus?.length ? (
              <div className="mt-5 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
                <div className="grid grid-cols-3 px-4 py-2 text-[11px] uppercase tracking-wide text-[var(--fg-faint)]">
                  <span>Metric</span>
                  <span className="text-right">Consensus</span>
                  <span className="text-right">Prior</span>
                </div>
                {event.consensus.map((row) => (
                  <div
                    key={row.metric}
                    className="grid grid-cols-3 px-4 py-2.5 text-[14px]"
                    style={{ boxShadow: "inset 0 0.5px 0 var(--hairline)" }}
                  >
                    <span className="text-[var(--fg-muted)]">{row.metric}</span>
                    <span className="num text-right font-medium">{row.consensus}</span>
                    <span className="num text-right text-[var(--fg-muted)]">{row.prior}</span>
                  </div>
                ))}
                {event.consensusSource ? (
                  <p className="px-4 py-2 text-[11px] text-[var(--fg-faint)]">{event.consensusSource}</p>
                ) : null}
              </div>
            ) : null}
            {event.description ? (
              <p className="mt-4 text-[14px] leading-relaxed text-pretty text-[var(--fg-muted)]">{event.description}</p>
            ) : null}
          </>
        )}

        <div className="mt-5">
          <TapeCard prints={prints} rec={rec} typical={typical} />
        </div>

        {news.length ? (
          <>
            <div className="mt-6 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Headlines</h2>
              <button
                type="button"
                className="text-[13px] font-medium text-[var(--color-accent)]"
                onClick={() =>
                  store.openSheet({ name: "headlines", tickerId: event.tickerId, macroId: event.macroId })
                }
              >
                See all {news.length}
              </button>
            </div>
            <div className="mt-2 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
              {news.slice(0, 2).map((h, i) => (
                <div
                  key={h.id}
                  className="px-3.5 py-3"
                  style={{ boxShadow: i === 0 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
                >
                  <p className="text-[15px] font-medium leading-snug">{h.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
                    {h.source} · {ageLabel(h.publishedAt, store.now)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-[var(--fg-faint)]">
          Notes are yours only. Catalyst does not execute trades or give advice.
        </p>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" fill="none" aria-hidden>
      <rect x="1" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7V4.5a3 3 0 0 1 6 0V7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
