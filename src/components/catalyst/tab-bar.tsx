import type { ReactNode } from "react";
import { TAB_BAR_ITEMS } from "@/lib/catalyst/nav";
import type { TabId } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";

export function TabBarView({
  items = TAB_BAR_ITEMS,
  active,
  onSelect,
}: {
  items?: { id: TabId; label: string }[];
  active: TabId;
  onSelect: (id: TabId) => void;
}) {
  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-3" data-tabbar="1">
      <div className="pointer-events-auto sheen glass flex h-[62px] w-full max-w-[348px] items-stretch rounded-full px-1">
        {items.map((it) => {
          const on = active === it.id;
          const Icon = ICONS[it.id];
          return (
            <button
              key={it.id}
              type="button"
              data-tab={it.id}
              onClick={() => onSelect(it.id)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5"
              style={{ color: on ? "var(--color-accent)" : "var(--tab-idle)" }}
            >
              {Icon ? <Icon active={on} /> : null}
              <span className="text-[10px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

const ICONS: Record<TabId, (p: { active: boolean }) => ReactNode> = {
  catalyst: NowIcon,
  calendar: CalIcon,
  tape: TapeIcon,
  record: ChartIcon,
};

function NowIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <circle cx="11" cy="11" r="2.25" fill="currentColor" />
    </svg>
  );
}
function CalIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="15" height="13.5" rx="2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M3.5 9.5H18.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M7.5 3.5V6.5M14.5 3.5V6.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}
function TapeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden className={cn(active && "opacity-100")}>
      <rect x="4" y="4.5" width="14" height="13" rx="2.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M7 9H15" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M7 12.5H12" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}
function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M4 16L8.5 11.5L12 14L18 7"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
