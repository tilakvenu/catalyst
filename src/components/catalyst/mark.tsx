type Props = { size?: number; className?: string; showDot?: boolean };

/** Two-tier step mark. 64-unit grid. Square caps, mitered joints, tint bead in the riser notch. */
export function CatalystMark({ size = 32, className, showDot = true }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 52H28V44.5"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M28 23.5V16H58"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {showDot ? <circle cx="28" cy="34" r="6.5" fill="var(--color-accent)" /> : null}
    </svg>
  );
}

/** Thin BEFORE → EVENT → AFTER timeline. Bead stays Catalyst blue. */
export function EventBead({
  startsAt,
  now,
  locked = false,
  resolved = false,
}: {
  startsAt: string;
  now: number;
  locked?: boolean;
  resolved?: boolean;
}) {
  const start = new Date(startsAt).getTime();
  const windowMs = 48 * 3600000;
  const raw = 1 - (start - now) / windowMs;
  const p = Math.min(1, Math.max(0, raw));
  const left = 4 + p * 92;
  return (
    <div className="mt-3 px-0.5" aria-hidden>
      <div className="relative h-3">
        <div
          className="absolute top-1/2 h-px w-full -translate-y-1/2"
          style={{ background: "var(--hairline)" }}
        />
        <span
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${left}%`,
            background: "var(--color-accent)",
            opacity: resolved ? 1 : locked ? 1 : 0.85,
            transform: `translate(-50%, -50%) scale(${locked || resolved ? 1.15 : 1})`,
            transition: "left 300ms ease, transform 300ms ease",
          }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-[var(--fg-faint)]">
        <span>Before</span>
        <span>Event</span>
        <span>After</span>
      </div>
    </div>
  );
}
