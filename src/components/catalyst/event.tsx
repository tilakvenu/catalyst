import { useEffect } from "react";
import { splitEvidence } from "@/lib/catalyst/evidence";
import { ageLabel, countdown, firstSentence, formatPct, formatTime, formatWhen, impactLabel, sessionLabel } from "@/lib/catalyst/format";
import { impactLabel as newsImpactLabel, impactRulePx, impactWeight, kindLabel as newsKindLabel } from "@/lib/catalyst/impact";
import { EventBead } from "./mark";
import { flatBandPct } from "@/lib/catalyst/scoring";
import { entryFor, eventLabel, isUrgent, kindLabel, lastSimilarEvent, suggestedPrint, typicalFor } from "@/lib/catalyst/selectors";
import { isEntryComplete } from "@/lib/catalyst/types";
import { useCatalyst } from "@/lib/catalyst/store";
import { TapeCard } from "./context";
import { Pill, SecondaryButton, TopBar } from "./ui";
import { cn } from "@/lib/utils";

export function EventScreen({ id }: { id: string }) {
  const store = useCatalyst();
  const event = store.events.find((e) => e.id === id);
  useEffect(() => {
    if (!event?.tickerId) return;
    const t = store.tickers.find((x) => x.id === event.tickerId);
    if (t) void store.refreshLive(t.symbol, t.id);
  }, [event?.tickerId]);
  useEffect(() => {
    if (!event) return;
    const print = suggestedPrint(store, event);
    const note = entryFor(store, event.id);
    if (print && note && isEntryComplete(note) && note.actualDirection == null) {
      store.applyPrintScore(event.id);
    }
  }, [event?.id, store.now]);
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
  const complete = note ? isEntryComplete(note) : false;
  const locked = Boolean(note?.lockedAt);
  const resolved = note?.actualDirection != null;
  const typical = typicalFor(store, event, note?.callTarget);
  const band = typical != null ? flatBandPct(typical) : null;
  const last = lastSimilarEvent(store, event);
  const lastNote = last ? entryFor(store, last.id) : undefined;
  const target = note?.callTarget ? store.tickers.find((t) => t.id === note.callTarget) : undefined;
  const freeze = note?.lockedAt ? splitEvidence(note, store.headlines, event) : null;
  const started = store.now >= new Date(event.startsAt).getTime();

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
            {band != null ? ` · flat ±${band.toFixed(1)}%` : ""}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-4 pb-12">
        <EventBead startsAt={event.startsAt} now={store.now} locked={locked} resolved={resolved} />

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill>{kindLabel(event)}</Pill>
          {urgent ? <Pill tone="accent">Within 48h</Pill> : null}
          {!event.confirmed ? <Pill tone="warn">Estimated</Pill> : null}
          {resolved ? (
            <Pill tone={note?.direction === note?.actualDirection ? "pos" : "neg"}>
              {note?.direction === note?.actualDirection ? "Called it" : "Missed"}
            </Pill>
          ) : locked ? (
            <Pill tone="pos">Locked</Pill>
          ) : complete ? (
            <Pill tone="accent">Draft ready</Pill>
          ) : note ? (
            <Pill tone="warn">Draft</Pill>
          ) : null}
        </div>

        <h1 className="mt-3 text-[22px] font-semibold leading-tight text-balance">{event.title}</h1>
        {event.kind === "macro" ? (
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            {kicker}
            {target ? `  ·  ${target.symbol}, next session` : "  ·  pick a target to lock"}
            {note?.direction ? `:  ${note.direction}` : ""}
          </p>
        ) : null}

        {prints.length ? (
          <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">
            Last {prints.length} EPS surprises:{" "}
            {prints
              .slice(0, 4)
              .map((p) => (p.surprisePct == null ? "—" : `${p.surprisePct > 0 ? "+" : ""}${p.surprisePct.toFixed(1)}%`))
              .join("  ")}
          </p>
        ) : last && lastNote?.actualMovePct != null ? (
          <p className="mt-3 text-[13px] leading-snug text-[var(--fg-muted)]">
            Last comparable
            <span className={lastNote.actualMovePct >= 0 ? "pos num ml-1.5 font-semibold" : "neg num ml-1.5 font-semibold"}>
              {formatPct(lastNote.actualMovePct)}
            </span>
            {lastNote.actualFigure ? (
              <span className="mt-0.5 block">{firstSentence(lastNote.actualFigure)}</span>
            ) : (
              <span className="mt-0.5 block text-[12px] text-[var(--fg-faint)]">Only this comparable print is in the record.</span>
            )}
          </p>
        ) : null}

        <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Your call</h2>
        <div className="mt-2 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
          {note?.direction ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={note.direction === "up" ? "pos" : note.direction === "down" ? "neg" : "neutral"}>
                  {note.direction.toUpperCase()}
                </Pill>
                {note.conviction ? <Pill>Conviction {note.conviction}/5</Pill> : null}
                {note.lockedAt ? (
                  <span className="text-[12px] text-[var(--fg-faint)]">Locked {formatTime(note.lockedAt)}</span>
                ) : (
                  <span className="text-[12px] text-[var(--fg-faint)]">Edited {ageLabel(note.updatedAt, store.now)}</span>
                )}
              </div>
              {note.reasoning ? <p className="mt-2 text-[15px] leading-relaxed">{note.reasoning}</p> : null}
              {note.invalidation ? (
                <p className="mt-2 text-[13px] text-[var(--fg-muted)]">Wrong if: {note.invalidation}</p>
              ) : null}
            </>
          ) : (
            <p className="text-[14px] text-[var(--fg-muted)]">No call yet. Four fields — direction, conviction, why, invalidation.</p>
          )}
        </div>

        {resolved && note ? <ResolvedBlock note={note} /> : null}

        {freeze ? (
          <EvidenceFreeze
            known={freeze.known}
            after={freeze.after}
            now={store.now}
            onOpen={(hid) => store.openSheet({ name: "article", id: hid })}
          />
        ) : null}

        {!started || !locked ? (
          <button
            type="button"
            onClick={() => store.openSheet({ name: "journal", eventId: event.id })}
            className="pressable mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] fill-accent text-[16px] font-semibold"
          >
            <LockIcon />
            {locked ? "Update lock" : note ? "Continue the call" : "Write the call"}
          </button>
        ) : null}

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

        {!freeze && news.length ? (
          <>
            <div className="mt-6 flex items-baseline justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Evidence</h2>
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
              {news.slice(0, 3).map((h, i) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => store.openSheet({ name: "article", id: h.id })}
                  className="flex w-full gap-3 px-3.5 py-3 text-left"
                  style={{ boxShadow: i < Math.min(news.length, 3) - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
                >
                  <span
                    className="mt-1 shrink-0 rounded-full"
                    style={{
                      width: impactRulePx(h.impact),
                      background: "var(--fg)",
                      opacity: h.impact === "high" ? 0.85 : h.impact === "medium" ? 0.45 : 0.22,
                      minHeight: 36,
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="text-[11px]"
                        style={{
                          fontWeight: impactWeight(h.impact) === "semibold" ? 600 : 400,
                          color: h.impact === "low" ? "var(--fg-faint)" : "var(--fg)",
                        }}
                      >
                        {newsImpactLabel(h.impact)}
                      </span>
                      <span className="text-[11px] text-[var(--fg-faint)]">{newsKindLabel(h.kind)}</span>
                    </span>
                    <span className="mt-1 block text-[15px] font-medium leading-snug">{h.title}</span>
                    <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">
                      {h.source} · {ageLabel(h.publishedAt, store.now)}
                    </span>
                  </span>
                </button>
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

function ResolvedBlock({
  note,
}: {
  note: NonNullable<ReturnType<typeof entryFor>>;
}) {
  const called = note.direction === note.actualDirection;
  return (
    <div className="mt-3 rounded-[22px] p-4" style={{ background: "var(--bg-card)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">Outcome</p>
      <p className="mt-2 text-[18px] font-semibold" style={{ color: called ? "var(--color-positive)" : "var(--color-negative)" }}>
        {called ? "Called it" : "Missed"}
        {note.actualMovePct != null ? (
          <span className={cn("num ml-2 text-[16px]", note.actualMovePct >= 0 ? "pos" : "neg")}>
            {formatPct(note.actualMovePct)}
          </span>
        ) : null}
      </p>
      {note.actualFigure ? (
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">{note.actualFigure}</p>
      ) : null}
      {note.invalidation ? (
        <div className="mt-3 rounded-[14px] px-3 py-2.5" style={{ background: "var(--bg-elevated)" }}>
          <p className="text-[11px] uppercase tracking-wide text-[var(--fg-faint)]">You said</p>
          <p className="mt-0.5 text-[14px] leading-snug">Wrong if {note.invalidation}</p>
          <p className="mt-2 text-[11px] uppercase tracking-wide text-[var(--fg-faint)]">Actual</p>
          <p className="mt-0.5 text-[14px] leading-snug">{note.actualFigure ?? "Figures not in the structured print."}</p>
          <p className="mt-2 text-[12px] font-semibold text-[var(--fg-muted)]">Invalidation: manual review needed</p>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceFreeze({
  known,
  after,
  now,
  onOpen,
}: {
  known: { id: string; title: string; source: string; publishedAt: string }[];
  after: { id: string; title: string; source: string; publishedAt: string }[];
  now: number;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mt-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">Known when you called</h2>
      <div className="mt-2 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
        {known.length ? (
          known.map((h, i) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onOpen(h.id)}
              className="w-full px-3.5 py-3 text-left"
              style={{ boxShadow: i < known.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
            >
              <p className="text-[15px] font-medium leading-snug">{h.title}</p>
              <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
                {h.source}
                {h.publishedAt ? ` · ${formatTime(h.publishedAt)}` : ""} · Known when you called
              </p>
            </button>
          ))
        ) : (
          <p className="px-3.5 py-3 text-[13px] text-[var(--fg-muted)]">Snapshot stored. Nothing on the sheet at lock.</p>
        )}
      </div>
      {after.length ? (
        <>
          <h2 className="mt-4 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            Arrived after your call
          </h2>
          <div className="mt-2 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
            {after.map((h, i) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onOpen(h.id)}
                className="w-full px-3.5 py-3 text-left"
                style={{ boxShadow: i < after.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
              >
                <p className="text-[15px] font-medium leading-snug">{h.title}</p>
                <p className="mt-1 text-[12px] text-[var(--fg-faint)]">
                  {h.source} · {ageLabel(h.publishedAt, now)} · After your call
                </p>
              </button>
            ))}
          </div>
        </>
      ) : null}
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
