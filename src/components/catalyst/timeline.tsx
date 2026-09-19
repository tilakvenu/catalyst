import { EMPTY_COPY } from "@/lib/catalyst/fixtures";
import { formatPct } from "@/lib/catalyst/format";
import { marketClock } from "@/lib/catalyst/session";
import { eventLabel, readyToScore, suggestedPrint, upcomingGrouped } from "@/lib/catalyst/selectors";
import { useCatalyst } from "@/lib/catalyst/store";
import { EventRow } from "./event-row";
import { EmptyState, PrimaryButton, SecondaryButton } from "./ui";

export function TimelineScreen() {
  const store = useCatalyst();
  const groups = upcomingGrouped(store);
  const empty = groups.length === 0;
  const clock = marketClock(store.now);
  const ready = readyToScore(store);
  const phaseColor =
    clock.phase === "open"
      ? "var(--color-positive)"
      : clock.phase === "pre" || clock.phase === "after"
        ? "var(--color-warn)"
        : "var(--fg-faint)";

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-4 pt-1">
        <h1 className="text-[34px] font-bold leading-none tracking-tight">Timeline</h1>
        <p suppressHydrationWarning className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
          <span className="session-dot" style={{ background: phaseColor }} />
          <span className="font-medium text-[var(--fg)]">{clock.label}</span>
          <span className="mx-1.5 text-[var(--fg-faint)]">·</span>
          {clock.detail}
        </p>
      </header>

      {ready.length ? (
        <div className="mb-4 overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
          {ready.map((ev, i) => {
            const { kicker } = eventLabel(store, ev);
            const print = suggestedPrint(store, ev);
            return (
              <div
                key={ev.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ boxShadow: i < ready.length - 1 ? "inset 0 -0.5px 0 var(--hairline)" : undefined }}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-accent)]">Ready to score</p>
                  <p className="truncate text-[15px] font-semibold">
                    {kicker} · {ev.title}
                  </p>
                  {print ? (
                    <p className="num text-[12px] text-[var(--fg-muted)]">{formatPct(print.movePct)} next session</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="pressable h-8 shrink-0 rounded-full px-3 text-[12px] font-semibold fill-accent"
                  onClick={() => store.applyPrintScore(ev.id)}
                >
                  Score
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {empty ? (
        <EmptyState
          title={EMPTY_COPY.timelineTitle}
          body={EMPTY_COPY.timelineBody}
          actions={
            <>
              <PrimaryButton onClick={() => store.push({ name: "names" })}>Add your first ticker</PrimaryButton>
              <SecondaryButton onClick={() => store.openSheet({ name: "csv" })}>
                Or import from a broker CSV
              </SecondaryButton>
            </>
          }
        />
      ) : (
        <div className="stagger-in">
          {groups.map((g) => (
            <section key={g.key} className="mb-5">
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-[var(--fg-muted)]">
                {g.label}
                <span className="ml-1.5 num font-medium text-[var(--fg-faint)]">{g.events.length}</span>
              </h2>
              <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
                {g.events.map((e, i) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    store={store}
                    inset
                    last={i === g.events.length - 1}
                    onOpen={() => store.push({ name: "event", id: e.id })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
