import { useEffect, useMemo, useRef, useState } from "react";
import { countdown } from "@/lib/catalyst/format";
import { eventLabel, nearest } from "@/lib/catalyst/selectors";
import { useCatalyst, useCurrentScreen } from "@/lib/catalyst/store";
import { cn } from "@/lib/utils";
import { EventScreen } from "./event";
import { ArticleSheet, NewsScreen } from "./news";
import { HeadlinesSheet } from "./ticker";
import { JournalSheet } from "./journal";
import { NowScreen } from "./now";
import { ReviewScreen } from "./review";
import { SettingsScreen } from "./settings";
import { SimulationScreen } from "./simulation";
import { TickerScreen } from "./ticker";
import { WatchlistScreen, WatchlistSheets } from "./watchlist";
import { CalendarScreen } from "./calendar-tab";
import { TabBarView } from "./tab-bar";

export function CatalystApp() {
  const store = useCatalyst();

  useEffect(() => {
    const id = window.setInterval(() => store.tick(), 30000);
    const onHydrate = () => {
      if (useCatalyst.persist.hasHydrated()) {
        useCatalyst.setState({ hydrated: true, now: Date.now() });
        useCatalyst.getState().autoResolve();
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
    <div className="studio-bg grid min-h-dvh w-full place-items-center overflow-x-hidden px-4 py-6 max-[520px]:px-0 max-[520px]:py-0">
      <div className="flex w-full min-w-0 max-w-[393px] flex-col items-center max-[520px]:max-w-none">
        <DeviceFrame theme={theme}>
          <PhoneBody />
        </DeviceFrame>
        <p className="mt-6 hidden text-[13px] tracking-tight text-[var(--color-studio-muted)] lg:block">
          Call it. Lock it. Learn from it.
        </p>
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
    <div className="device-wrap mx-auto w-full min-w-0">
      <div
        className="relative mx-auto aspect-[393/852] w-full overflow-hidden rounded-[54px] p-[10px] shadow-[var(--shadow-device)] max-[520px]:h-dvh max-[520px]:rounded-none max-[520px]:p-0 max-[520px]:shadow-none max-[520px]:aspect-auto"
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);

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
    let force = false;
    try {
      force = new URLSearchParams(window.location.search).get("launch") === "1";
    } catch {
      /* ignore */
    }
    if (automated && !force) {
      try {
        sessionStorage.setItem("cat-launch", "1");
      } catch {
        /* ignore */
      }
      done.current();
      return;
    }
    if (shown && !force) {
      done.current();
      return;
    }

    const overlay = overlayRef.current;
    const path = pathRef.current;
    const arc = arcRef.current;
    if (path) {
      const L = path.getTotalLength();
      path.style.strokeDasharray = String(L);
      path.style.strokeDashoffset = String(L);
    }
    if (arc) {
      const r = Number(arc.getAttribute("r") ?? 16.9);
      const C = 2 * Math.PI * r;
      arc.style.strokeDasharray = `${C * 0.89} ${C * 0.11}`;
      arc.style.strokeDashoffset = String(C);
    }

    const total = reduce ? 400 : 2100;
    overlay?.classList.add(reduce ? "cat-launch-reduce" : "cat-launch-run");

    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem("cat-launch", "1");
      } catch {
        /* ignore */
      }
      done.current();
    }, total);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div ref={overlayRef} className="cat-launch" role="img" aria-label="Catalyst" data-launch="1">
      <div className="cat-launch-svg-wrap">
        <svg viewBox="0 0 64 64" width="120" height="120" fill="none" aria-hidden>
          <g className="cat-launch-group">
            <path
              ref={pathRef}
              className="cat-launch-path"
              d="M6 52H28V44.5 M28 23.5V16H58"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
            <circle className="cat-launch-bead" cx="28" cy="34" r="6.5" fill="#0a84ff" />
            <circle
              ref={arcRef}
              className="cat-launch-arc"
              cx="28"
              cy="34"
              r={6.5 * 2.6}
              fill="none"
              stroke="#0a84ff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
      <p className="cat-launch-word wordmark mt-5 text-[22px]">Catalyst</p>
    </div>
  );
}

function PhoneBody() {
  const store = useCatalyst();
  const screen = useCurrentScreen();
  const onTab = screen.name === "tab";
  const showTabs = onTab && !store.sheet;

  return (
    <div className="relative flex h-full flex-col">
      <StatusBar />
      <div className={cn("relative min-h-0 flex-1 overflow-hidden", !onTab && "slide-push")}>
        <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto hide-scroll">
          {screen.name === "ticker" ? (
            <TickerScreen id={screen.id} />
          ) : screen.name === "event" ? (
            <EventScreen id={screen.id} />
          ) : screen.name === "settings" ? (
            <SettingsScreen />
          ) : screen.name === "simulation" ? (
            <SimulationScreen />
          ) : screen.name === "news" ? (
            <NewsScreen />
          ) : screen.name === "names" ? (
            <WatchlistScreen />
          ) : onTab && store.tab === "record" ? (
            <ReviewScreen />
          ) : onTab && store.tab === "calendar" ? (
            <CalendarScreen />
          ) : onTab && store.tab === "tape" ? (
            <NewsScreen />
          ) : (
            <NowScreen />
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

function TabBar() {
  const store = useCatalyst();
  return <TabBarView active={store.tab} onSelect={(id) => store.setTab(id)} />;
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
