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
