import { useEffect, useMemo, useRef, useState } from "react";
import { countdown } from "@/lib/catalyst/format";
import { eventLabel, nearest, pendingCount } from "@/lib/catalyst/selectors";
import { useCatalyst, useCurrentScreen } from "@/lib/catalyst/store";
import { cn } from "@/lib/utils";
import { EventScreen } from "./event";
import { ArticleSheet, NewsScreen } from "./news";
import { HeadlinesSheet } from "./ticker";
import { JournalSheet } from "./journal";
import { CatalystMark } from "./mark";
import { ReviewScreen } from "./review";
import { SettingsScreen } from "./settings";
import { TickerScreen } from "./ticker";
import { TimelineScreen } from "./timeline";
import { WatchlistScreen, WatchlistSheets } from "./watchlist";

export function CatalystApp() {
  const store = useCatalyst();

  useEffect(() => {
    const id = window.setInterval(() => store.tick(), 30000);
    const onHydrate = () => {
      if (useCatalyst.persist.hasHydrated()) {
        useCatalyst.setState({ hydrated: true, now: Date.now() });
        void useCatalyst.getState().scanLive();
      }
    };
    onHydrate();
    const unsub = useCatalyst.persist.onFinishHydration(onHydrate);
    return () => {
      window.clearInterval(id);
      unsub();
    };
  }, [store.tick]);

  const theme = useResolvedTheme(store.theme);

  return (
    <div className="studio-bg relative min-h-dvh w-full">
      <div className="relative mx-auto flex min-h-dvh max-w-[1400px] items-center justify-center gap-16 px-4 py-6">
        <aside className="hidden max-w-sm lg:block">
          <CatalystMark size={64} className="text-[var(--color-studio-ink)]" />
          <p className="wordmark mt-5 text-[15px] text-[var(--color-studio-ink)]">Catalyst</p>
          <h2 className="mt-3 text-[40px] font-bold leading-[1.05] tracking-tight text-[var(--color-studio-ink)] text-balance">
            The call,
            <br />
            then the score.
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[var(--color-studio-muted)] text-pretty">
            Earnings, CPI, FOMC — journaled, then graded the session after. Incomplete notes stay
            pending. They never inflate the number.
          </p>
        </aside>
        <DeviceFrame theme={theme}>
          <PhoneBody />
        </DeviceFrame>
      </div>
    </div>
  );
}

function useResolvedTheme(pref: "light" | "dark" | "system"): "light" | "dark" {
  return useMemo(() => {
    if (pref !== "system") return pref;
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }, [pref]);
}

function DeviceFrame({ children, theme }: { children: React.ReactNode; theme: "light" | "dark" }) {
  const [launch, setLaunch] = useState(true);
  return (
    <div className="device-wrap">
      <div
        className="relative mx-auto aspect-[393/852] w-[min(393px,calc(100vw-1.5rem))] overflow-hidden rounded-[54px] p-[10px] shadow-[var(--shadow-device)] max-[520px]:h-dvh max-[520px]:w-full max-[520px]:max-w-none max-[520px]:rounded-none max-[520px]:p-0 max-[520px]:shadow-none max-[520px]:aspect-auto"
        style={{ background: "var(--color-dark)" }}
      >
        <div
          data-theme={theme}
          className="cat-app relative h-full overflow-hidden rounded-[44px] max-[520px]:rounded-none"
        >
          {children}
          {launch ? <LaunchOverlay onDone={() => setLaunch(false)} /> : null}
        </div>
      </div>
    </div>
  );
}

function LaunchOverlay({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem("cat-launch") === "1";
    } catch {
      /* private mode */
    }
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const automated = Boolean(navigator.webdriver);
    if (shown || reduce || automated) {
      try {
        sessionStorage.setItem("cat-launch", "1");
      } catch {
        /* ignore */
      }
      done.current();
      return;
    }
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem("cat-launch", "1");
      } catch {
        /* ignore */
      }
      done.current();
    }, 1550);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="cat-launch" role="img" aria-label="Catalyst">
      <CatalystMark size={72} className="cat-launch-mark text-[var(--fg)]" />
      <p className="cat-launch-word wordmark mt-4 text-[22px] text-[var(--fg)]">Catalyst</p>
    </div>
  );
}

function PhoneBody() {
  const store = useCatalyst();
  const screen = useCurrentScreen();
  const showTabs = screen.name === "tab";

  return (
    <div className="relative flex h-full flex-col">
      <StatusBar />
      <div className={cn("relative min-h-0 flex-1 overflow-hidden", screen.name !== "tab" && "slide-push")}>
        <div className="h-full overflow-y-auto hide-scroll">
          {screen.name === "ticker" ? (
            <TickerScreen id={screen.id} />
          ) : screen.name === "event" ? (
            <EventScreen id={screen.id} />
          ) : store.tab === "watchlist" ? (
            <WatchlistScreen />
          ) : store.tab === "news" ? (
            <NewsScreen />
          ) : store.tab === "review" ? (
            <ReviewScreen />
          ) : store.tab === "settings" ? (
            <SettingsScreen />
          ) : (
            <TimelineScreen />
          )}
        </div>
        <JournalSheet />
        <HeadlinesSheet />
        <ArticleSheet />
        <WatchlistSheets />
        {store.banner ? <Banner /> : null}
      </div>
      {showTabs ? <TabBar /> : null}
      <div className="flex h-4 items-end justify-center pb-1 max-[520px]:h-[calc(env(safe-area-inset-bottom)+8px)]">
        <span className="home-bar" />
      </div>
    </div>
  );
}

function StatusBar() {
  const store = useCatalyst();
  const next = nearest(store);
  const time = new Date(store.now).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <div className="relative z-20 flex items-center justify-between px-6 pt-3">
      <span suppressHydrationWarning className="num w-16 text-[15px] font-semibold">{time.replace(" ", "")}</span>
      <div className="island relative flex items-center justify-center overflow-hidden">
        {next ? (
          <span suppressHydrationWarning className="truncate px-3 text-[10px] font-medium tracking-wide">
            {eventLabel(store, next).kicker} {countdown(next.startsAt, store.now).replace("in ", "")}
          </span>
        ) : (
          <span className="size-2 rounded-full opacity-40" style={{ background: "currentColor" }} />
        )}
      </div>
      <span className="flex w-16 items-center justify-end gap-1 text-[13px]">
        <Signal />
        <span className="num text-[12px] font-semibold">5G</span>
        <Battery />
      </span>
    </div>
  );
}

function TabBar() {
  const store = useCatalyst();
  const pending = pendingCount(store);
  const followedIds = new Set(store.tickers.map((t) => t.id));
  const highNews = store.headlines.filter((h) => h.impact === "high" && h.tickerId && followedIds.has(h.tickerId)).length;
  const items = [
    { id: "timeline" as const, label: "Timeline", icon: TimelineIcon },
    { id: "watchlist" as const, label: "Watchlist", icon: ListIcon },
    { id: "news" as const, label: "News", icon: NewsIcon, badge: highNews },
    { id: "review" as const, label: "Review", icon: ChartIcon, badge: pending },
    { id: "settings" as const, label: "Settings", icon: GearIcon },
  ];
  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <div className="pointer-events-auto sheen glass flex h-[62px] w-full max-w-[360px] items-stretch rounded-full px-2">
        {items.map((it) => {
          const on = store.tab === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => store.setTab(it.id)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5"
              style={{ color: on ? "var(--color-accent)" : "var(--tab-idle)" }}
            >
              <span className="relative">
                <Icon active={on} />
                {it.badge ? <span className="tab-badge">{it.badge > 9 ? "9+" : it.badge}</span> : null}
              </span>
              <span className="text-[10px] font-medium">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Banner() {
  const store = useCatalyst();
  const b = store.banner;
  if (!b) return null;
  return (
    <button
      type="button"
      onClick={() => store.dismissBanner()}
      className="glass sheen absolute left-3 right-3 top-3 z-50 rounded-[22px] px-4 py-3 text-left"
    >
      <p className="text-[12px] font-medium text-[var(--color-accent)]">{b.title}</p>
      <p className="text-[14px] font-semibold leading-snug">{b.body}</p>
    </button>
  );
}

function Signal() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.6" />
      <rect x="4.3" y="5.5" width="3" height="6.5" rx="0.6" />
      <rect x="8.6" y="3" width="3" height="9" rx="0.6" />
      <rect x="12.9" y="0" width="3" height="12" rx="0.6" opacity="0.35" />
    </svg>
  );
}
function Battery() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="20" height="11" rx="3" stroke="currentColor" />
      <rect x="2" y="2" width="15" height="8" rx="1.5" fill="currentColor" />
      <rect x="21.5" y="3.5" width="2" height="5" rx="0.6" fill="currentColor" />
    </svg>
  );
}
function TimelineIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M4 16.5V18.5H18V16.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M4 11V13H12V11" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M4 5.5V7.5H16V5.5" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}
function ListIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path d="M5 6H17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M5 11H17" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
      <path d="M5 16H13" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
    </svg>
  );
}
function NewsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="3.5" y="4.5" width="15" height="13" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path d="M7 8.5H15M7 11.5H15M7 14.5H12" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" />
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
function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="3" stroke="currentColor" strokeWidth={active ? 2 : 1.6} />
      <path
        d="M11 3.5V5.5M11 16.5V18.5M3.5 11H5.5M16.5 11H18.5M5.8 5.8L7.2 7.2M14.8 14.8L16.2 16.2M16.2 5.8L14.8 7.2M7.2 14.8L5.8 16.2"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
