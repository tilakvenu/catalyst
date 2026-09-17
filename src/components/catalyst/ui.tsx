import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "pos" | "neg" | "warn";
  className?: string;
}) {
  const tones = {
    neutral: "bg-elevated text-[var(--fg-muted)]",
    accent: "chip-accent",
    pos: "fill-pos",
    neg: "fill-neg",
    warn: "fill-warn",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
      style={
        tone === "neutral"
          ? { background: "var(--bg-elevated)", color: "var(--fg-muted)" }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function SectionLabel({
  title,
  count,
  extra,
}: {
  title: string;
  count?: number;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between px-1">
      <h2 className="text-[13px] font-semibold tracking-wide text-[var(--fg-muted)] uppercase">
        {title}
        {typeof count === "number" ? (
          <span className="ml-1.5 num font-medium text-[var(--fg-faint)]"> {count}</span>
        ) : null}
      </h2>
      {extra}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  actions,
}: {
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-1 mt-8 rounded-[22px] px-6 py-10 text-center hairline" style={{ background: "var(--bg-card)" }}>
      <p className="font-semibold text-[17px] text-balance">{title}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-muted)] text-pretty">{body}</p>
      {actions ? <div className="mt-5 flex flex-col gap-2">{actions}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="pressable h-12 w-full rounded-[14px] fill-accent text-[16px] font-semibold disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable h-12 w-full rounded-[14px] text-[16px] font-medium"
      style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("pressable min-h-11 px-2 text-[16px] font-medium text-[var(--color-accent)]", className)}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div
      className="flex rounded-[10px] p-[2px]"
      style={{ background: "var(--seg-track)" }}
      role="tablist"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "h-8 flex-1 rounded-[8px] text-[13px] font-medium transition-[background,color,box-shadow] duration-150",
              on ? "text-[var(--fg)]" : "text-[var(--fg-muted)]",
            )}
            style={
              on
                ? {
                    background: "var(--seg-thumb)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.04)",
                  }
                : undefined
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[13px] font-medium"
        style={{ color: warn ? "var(--color-warn)" : "var(--fg-muted)" }}
      >
        {label}
      </span>
      <div
        className="rounded-[14px]"
        style={{
          boxShadow: warn
            ? "0 0 0 1.5px var(--color-warn)"
            : "0 0 0 0.5px var(--hairline)",
          background: "var(--bg-elevated)",
        }}
      >
        {children}
      </div>
      {hint ? (
        <span className="mt-1 block text-[12px] text-[var(--fg-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function SheetFrame({
  children,
  onClose,
  title,
  trailing,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="dim absolute inset-0 z-40 flex flex-col justify-end">
      <button className="h-16 w-full shrink-0" aria-label="Dismiss" onClick={onClose} />
      <div
        className="flex max-h-[92%] min-h-[56%] flex-col overflow-hidden rounded-t-[44px]"
        style={{ background: "var(--bg)", color: "var(--fg)" }}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-10 rounded-full" style={{ background: "var(--hairline)" }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <GhostButton onClick={onClose} className="pl-0">
            Cancel
          </GhostButton>
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <div className="min-w-16 text-right">{trailing}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto hide-scroll px-5 pb-8">{children}</div>
      </div>
    </div>
  );
}

export function TopBar({
  title,
  onBack,
  trailing,
}: {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex h-12 items-center justify-between px-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="pressable flex h-11 min-w-11 items-center gap-0.5 px-2 text-[17px] font-medium text-[var(--color-accent)]"
        >
          <Chevron />
          Back
        </button>
      ) : (
        <span className="w-16" />
      )}
      <span className="text-[17px] font-semibold">{title}</span>
      <div className="flex min-w-16 items-center justify-end">{trailing}</div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden>
      <path d="M10 2L2 10L10 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
