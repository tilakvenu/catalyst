import { countdown, formatTimeEt, sessionLabel } from "@/lib/catalyst/format";
import { entryFor, eventLabel, isUrgent, kindLabel, type StoreSlice } from "@/lib/catalyst/selectors";
import { isEntryComplete, type CatalystEvent } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";

export function EventRow({
  event,
  store,
  onOpen,
  inset,
  last,
}: {
  event: CatalystEvent;
  store: StoreSlice;
  onOpen: () => void;
  inset?: boolean;
  last?: boolean;
}) {
  const { kicker } = eventLabel(store, event);
  const urgent = isUrgent(event.startsAt, store.now);
  const note = entryFor(store, event.id);
  const call = note ? (isEntryComplete(note) ? "Call in" : "Draft") : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "pressable relative flex w-full text-left",
        inset ? "rounded-none" : "overflow-hidden rounded-[22px]",
      )}
      style={{
        background: inset ? "transparent" : "var(--bg-card)",
        boxShadow: inset && !last ? "inset 0 -0.5px 0 var(--hairline)" : undefined,
      }}
    >
      <span className={cn("w-1 shrink-0", urgent ? "edge-urgent" : "edge-calm")} />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3.5 py-3">
        <span className="min-w-0">
          <span className="flex items-baseline gap-2">
            <span className="text-[16px] font-semibold tracking-tight">{kicker}</span>
            {call ? (
              <span
                className="text-[11px] font-medium"
                style={{ color: call === "Call in" ? "var(--color-positive)" : "var(--color-accent)" }}
              >
                {call}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-[var(--fg-muted)]">
            {kindLabel(event)}
            {" · "}
            {sessionLabel(event.session)}
            {" · "}
            {formatTimeEt(event.startsAt)}
            {!event.confirmed ? " · Est." : ""}
          </span>
        </span>
        <span
          suppressHydrationWarning
          className="num shrink-0 text-[13px] font-medium"
          style={{ color: urgent ? "var(--color-accent)" : "var(--fg)" }}
        >
          {countdown(event.startsAt, store.now)}
        </span>
      </span>
    </button>
  );
}
