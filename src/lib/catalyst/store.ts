import { create } from "zustand";
import { persist } from "zustand/middleware";
import { buildDemoSnapshot, buildEmptySnapshot } from "./fixtures";
import { isoDateEt, makeSpark } from "./format";
import { decorateHeadline } from "./impact";
import { liveCalendar, liveEarnings, liveMacro, liveMetrics, liveNews, liveQuote, liveRecs, liveScoreNews, liveWatchlistNews } from "./live";
import { directionFromMove } from "./session";
import { SEARCH_UNIVERSE } from "./universe";
import {
  SEED_VERSION,
  type AppSnapshot,
  type CatalystEvent,
  type Direction,
  type JournalEntry,
  type MacroItem,
  type MacroSeriesId,
  type NotifyLead,
  type Screen,
  type Sentiment,
  type Sheet,
  type TabId,
  type ThemePref,
  type Ticker,
} from "./types";

export interface Banner {
  id: string;
  title: string;
  body: string;
}

export interface CatalystState extends AppSnapshot {
  tab: TabId;
  stack: Screen[];
  sheet: Sheet | null;
  banner: Banner | null;
  now: number;
  hydrated: boolean;

  setTab: (tab: TabId) => void;
  push: (s: Screen) => void;
  pop: () => void;
  openSheet: (s: Sheet) => void;
  closeSheet: () => void;
  tick: (n?: number) => void;

  setTheme: (t: ThemePref) => void;
  setDemoMode: (on: boolean) => void;
  setNotifyLead: (n: NotifyLead) => void;
  setDataSource: (d: "fixture" | "live") => void;
  setLiveKey: (k: keyof AppSnapshot["liveKeys"], v: string) => void;
  restoreDemo: () => void;
  resetEmpty: () => void;

  addTicker: (symbol: string) => void;
  removeTicker: (id: string) => void;
  toggleMuteTicker: (id: string) => void;
  toggleHeld: (id: string) => void;
  followMacro: (id: string) => void;
  unfollowMacro: (id: string) => void;
  toggleMuteMacro: (id: string) => void;
  importCsv: (text: string) => { added: number; skipped: number };

  toggleNotify: (eventId: string) => void;
  fireDebugNotification: () => void;
  dismissBanner: () => void;

  saveNote: (eventId: string, text: string, sentiment: Sentiment) => void;
  saveJournal: (
    eventId: string,
    patch: Partial<
      Pick<JournalEntry, "direction" | "conviction" | "reasoning" | "invalidation" | "text" | "sentiment">
    >,
  ) => void;
  applyPrintScore: (eventId: string) => void;
  refreshLive: (symbol: string, tickerId: string) => Promise<void>;
  scanLive: () => Promise<void>;
  refreshNews: () => Promise<void>;
  scoreNews: () => Promise<boolean>;
  newsStatus: "idle" | "loading" | "scoring" | "error";
}

function ensureSeed(s: AppSnapshot): AppSnapshot {
  if (s.seedVersion !== SEED_VERSION) {
    const fresh = s.emptySeed ? buildEmptySnapshot() : buildDemoSnapshot();
    return {
      ...fresh,
      theme: s.theme ?? "dark",
      demoMode: s.demoMode ?? true,
      notifyLead: s.notifyLead ?? "both",
      liveKeys: s.liveKeys ?? fresh.liveKeys,
      dataSource: s.demoMode === false ? "live" : "fixture",
    };
  }
  return {
    ...s,
    tape: s.tape ?? {},
    macroPrints: s.macroPrints ?? {},
  };
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const MACRO_CATALOG: MacroItem[] = [
  { id: "cpi", name: "Consumer Price Index", shortName: "CPI", series: "CPI-U YoY / Core", muted: false, kind: "macro" },
  { id: "fomc", name: "FOMC decision", shortName: "FOMC", series: "Fed funds rate", muted: false, kind: "macro" },
  { id: "nfp", name: "Nonfarm payrolls", shortName: "NFP", series: "Establishment survey", muted: false, kind: "macro" },
  { id: "ppi", name: "Producer Price Index", shortName: "PPI", series: "Final demand", muted: false, kind: "macro" },
  { id: "gdp", name: "GDP advance", shortName: "GDP", series: "Real GDP QoQ SAAR", muted: false, kind: "macro" },
  { id: "ism", name: "ISM manufacturing", shortName: "ISM", series: "PMI", muted: false, kind: "macro" },
];

function tickerFromUniverse(symbol: string): Ticker | null {
  const hit = SEARCH_UNIVERSE.find((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
  if (!hit) return null;
  const seed = hit.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const lastPrice = 40 + (seed % 480) + (seed % 100) / 100;
  const changePct = ((seed % 17) - 8) / 4;
  const change = (lastPrice * changePct) / 100;
  return {
    id: hit.symbol.toLowerCase(),
    symbol: hit.symbol,
    company: hit.company,
    held: false,
    muted: false,
    lastPrice: Number(lastPrice.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    kind: "equity",
  };
}

let lastScan = 0;

export const useCatalyst = create<CatalystState>()(
  persist(
    (set, get) => {
      const demo = buildDemoSnapshot();
      return {
        ...demo,
        tab: "timeline",
        stack: [],
        sheet: null,
        banner: null,
        now: Date.now(),
        hydrated: false,
        newsStatus: "idle" as const,

        setTab: (tab) => set({ tab, stack: [] }),
        push: (s) => set({ stack: [...get().stack, s] }),
        pop: () => set({ stack: get().stack.slice(0, -1) }),
        openSheet: (sheet) => set({ sheet }),
        closeSheet: () => set({ sheet: null }),
        tick: (n) => set({ now: n ?? Date.now() }),

        setTheme: (theme) => set({ theme }),
        setDemoMode: (demoMode) =>
          set({
            demoMode,
            dataSource: demoMode ? "fixture" : "live",
          }),
        setNotifyLead: (notifyLead) => set({ notifyLead }),
        setDataSource: (dataSource) =>
          set({
            dataSource,
            demoMode: dataSource === "fixture",
          }),
        setLiveKey: (k, v) => set({ liveKeys: { ...get().liveKeys, [k]: v } }),
        restoreDemo: () => {
          const fresh = buildDemoSnapshot();
          set({
            ...fresh,
            theme: get().theme,
            liveKeys: get().liveKeys,
            tab: "timeline",
            stack: [],
            sheet: null,
            emptySeed: false,
            demoMode: true,
            dataSource: "fixture",
            now: Date.now(),
          });
        },
        resetEmpty: () => {
          const empty = buildEmptySnapshot();
          set({
            ...empty,
            theme: get().theme,
            liveKeys: get().liveKeys,
            tab: "timeline",
            stack: [],
            sheet: null,
            now: Date.now(),
          });
        },

        addTicker: (symbol) => {
          const t = tickerFromUniverse(symbol);
          if (!t) return;
          if (get().tickers.some((x) => x.symbol === t.symbol)) return;
          const seed = t.symbol.charCodeAt(0) * 100;
          set({
            tickers: [...get().tickers, t],
            sparks: {
              ...get().sparks,
              [t.id]: {
                "1D": makeSpark(seed + 1, 78, 0.0004, 0.006),
                "1M": makeSpark(seed + 2, 22, 0.004, 0.028),
                "6M": makeSpark(seed + 3, 26, 0.012, 0.055),
                "1Y": makeSpark(seed + 4, 52, 0.008, 0.07),
              },
            },
            quotes: [
              ...get().quotes,
              {
                tickerId: t.id,
                lastPrice: t.lastPrice,
                change: t.change,
                changePct: t.changePct,
                fetchedAt: new Date().toISOString(),
              },
            ],
          });
          if (!get().demoMode) {
            void get().refreshLive(t.symbol, t.id);
            void get().scanLive();
          }
        },
        removeTicker: (id) =>
          set({
            tickers: get().tickers.filter((t) => t.id !== id),
          }),
        toggleMuteTicker: (id) =>
          set({
            tickers: get().tickers.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
          }),
        toggleHeld: (id) =>
          set({
            tickers: get().tickers.map((t) => (t.id === id ? { ...t, held: !t.held } : t)),
          }),
        followMacro: (id) => {
          if (get().macros.some((m) => m.id === id)) return;
          const found = MACRO_CATALOG.find((m) => m.id === id);
          if (!found) return;
          const demo = buildDemoSnapshot();
          const related = demo.events.filter((e) => e.macroId === id);
          set({
            macros: [...get().macros, found],
            events: [
              ...get().events,
              ...related.filter((e) => !get().events.some((x) => x.id === e.id)),
            ],
          });
        },
        unfollowMacro: (id) =>
          set({
            macros: get().macros.filter((m) => m.id !== id),
          }),
        toggleMuteMacro: (id) =>
          set({
            macros: get().macros.map((m) => (m.id === id ? { ...m, muted: !m.muted } : m)),
          }),
        importCsv: (text) => {
          const tokens = text
            .split(/[\s,;\n]+/)
            .map((s) => s.replace(/[^A-Za-z]/g, "").toUpperCase())
            .filter((s) => s.length >= 1 && s.length <= 5);
          let added = 0;
          let skipped = 0;
          const unique = [...new Set(tokens)];
          for (const sym of unique) {
            if (get().tickers.some((t) => t.symbol === sym)) {
              skipped += 1;
              continue;
            }
            const before = get().tickers.length;
            get().addTicker(sym);
            if (get().tickers.length > before) added += 1;
            else skipped += 1;
          }
          return { added, skipped };
        },

        toggleNotify: (eventId) =>
          set({
            events: get().events.map((e) => (e.id === eventId ? { ...e, notify: !e.notify } : e)),
          }),
        fireDebugNotification: () => {
          const upcoming = get()
            .events.filter((e) => new Date(e.startsAt).getTime() > Date.now())
            .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
          const title = upcoming ? upcoming.title : "Catalyst";
          const body = upcoming
            ? `${upcoming.title} · local alert (debug fire)`
            : "No upcoming event to preview.";
          set({
            banner: { id: newId("n"), title: "In 1 hour", body },
          });
          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              try {
                new Notification(title, { body });
              } catch {
                /* ignore — unsupported in some embeds */
              }
            }
          }
        },
        dismissBanner: () => set({ banner: null }),

        saveNote: (eventId, text, sentiment) => {
          const existing = get().entries.find((e) => e.eventId === eventId);
          const mappedDir: Direction | null =
            sentiment === "bullish" ? "up" : sentiment === "bearish" ? "down" : existing?.direction ?? null;
          if (existing) {
            set({
              entries: get().entries.map((e) =>
                e.id === existing.id
                  ? {
                      ...e,
                      text,
                      sentiment,
                      reasoning: e.reasoning ?? text,
                      direction: e.direction ?? mappedDir,
                      updatedAt: new Date().toISOString(),
                    }
                  : e,
              ),
            });
          } else {
            set({
              entries: [
                ...get().entries,
                {
                  id: newId("e"),
                  eventId,
                  text,
                  sentiment,
                  direction: mappedDir,
                  conviction: null,
                  reasoning: text,
                  invalidation: null,
                  updatedAt: new Date().toISOString(),
                },
              ],
            });
          }
        },
        saveJournal: (eventId, patch) => {
          const existing = get().entries.find((e) => e.eventId === eventId);
          const next: JournalEntry = existing
            ? { ...existing, ...patch, updatedAt: new Date().toISOString() }
            : {
                id: newId("e"),
                eventId,
                text: patch.text ?? patch.reasoning ?? null,
                sentiment: patch.sentiment ?? null,
                direction: patch.direction ?? null,
                conviction: patch.conviction ?? null,
                reasoning: patch.reasoning ?? null,
                invalidation: patch.invalidation ?? null,
                updatedAt: new Date().toISOString(),
              };
          if (patch.reasoning && !next.text) next.text = patch.reasoning;
          if (existing) {
            set({
              entries: get().entries.map((e) => (e.id === existing.id ? next : e)),
            });
          } else {
            set({ entries: [...get().entries, next] });
          }
        },

        applyPrintScore: (eventId) => {
          const event = get().events.find((e) => e.id === eventId);
          const existing = get().entries.find((e) => e.eventId === eventId);
          if (!event || !existing) return;
          const ticker = event.tickerId ? get().tickers.find((t) => t.id === event.tickerId) : undefined;
          const move = event.printMovePct ?? ticker?.changePct;
          if (move == null) return;
          const actualDirection = directionFromMove(move);
          set({
            entries: get().entries.map((e) =>
              e.eventId === eventId
                ? {
                    ...e,
                    actualDirection,
                    actualMovePct: Number(move.toFixed(2)),
                    actualMoveDate: new Date().toISOString(),
                    actualFigure:
                      e.actualFigure ??
                      `Next-session ${move >= 0 ? "+" : ""}${move.toFixed(2)}%. Scored from the print, not from memory.`,
                    updatedAt: new Date().toISOString(),
                  }
                : e,
            ),
          });
        },

        refreshLive: async (symbol, tickerId) => {
          const keys = get().liveKeys;
          if (get().demoMode || get().dataSource !== "live") return;
          const [q, news, earns, rec, metrics] = await Promise.all([
            liveQuote(symbol, keys),
            liveNews(symbol, keys),
            liveEarnings(symbol, keys),
            liveRecs(symbol, keys),
            liveMetrics(symbol, keys),
          ]);
          set((s) => {
            const next = { ...s };
            if (q) {
              next.tickers = s.tickers.map((t) =>
                t.id === tickerId
                  ? { ...t, lastPrice: q.lastPrice, change: q.change, changePct: q.changePct }
                  : t,
              );
              const rest = s.quotes.filter((c) => c.tickerId !== tickerId);
              next.quotes = [
                ...rest,
                {
                  tickerId,
                  lastPrice: q.lastPrice,
                  change: q.change,
                  changePct: q.changePct,
                  fetchedAt: new Date().toISOString(),
                  dayHigh: q.dayHigh,
                  dayLow: q.dayLow,
                  dayOpen: q.dayOpen,
                  prevClose: q.prevClose,
                },
              ];
            }
            if (news.length) {
              const kept = s.headlines.filter((h) => h.tickerId !== tickerId || h.origin === "fixture");
              next.headlines = [
                ...news.map((n, i) => ({
                  id: `live-${tickerId}-${i}`,
                  tickerId,
                  title: n.title,
                  source: n.source,
                  publishedAt: n.publishedAt,
                  origin: "live" as const,
                  ...decorateHeadline(n),
                })),
                ...kept,
              ];
            }
            if (earns.length) {
              next.earningsHistory = { ...s.earningsHistory, [tickerId]: earns };
            }
            if (rec) {
              next.recommendations = { ...s.recommendations, [tickerId]: rec };
            }
            if (metrics) {
              next.tape = {
                ...s.tape,
                [tickerId]: { tickerId, ...metrics, fetchedAt: metrics.fetchedAt ?? new Date().toISOString() },
              };
            }
            return next;
          });
        },

        scanLive: async () => {
          const s = get();
          if (s.demoMode || s.dataSource !== "live") return;
          if (Date.now() - lastScan < 12 * 60_000) return;
          lastScan = Date.now();
          const keys = s.liveKeys;
          const symbols = s.tickers.map((t) => t.symbol);
          const from = isoDateEt(Date.now(), -1);
          const to = isoDateEt(Date.now(), 21);

          const cal = symbols.length ? await liveCalendar(symbols, keys, from, to) : [];
          if (cal.length) {
            const fresh: CatalystEvent[] = [];
            for (const hit of cal) {
              const ticker = get().tickers.find((t) => t.symbol.toUpperCase() === hit.symbol);
              if (!ticker) continue;
              const already = get().events.some((e) => {
                if (e.tickerId !== ticker.id || e.kind !== "earnings") return false;
                const diff = Math.abs(new Date(e.startsAt).getTime() - new Date(`${hit.date}T20:00:00-04:00`).getTime());
                return diff < 3 * 86400000;
              });
              if (already) continue;
              const hour = hit.hour === "bmo" ? 8 : hit.hour === "intraday" ? 12 : 16;
              const startsAt = new Date(`${hit.date}T${String(hour).padStart(2, "0")}:00:00-04:00`).toISOString();
              fresh.push({
                id: `cal-${ticker.id}-${hit.date}`,
                kind: "earnings",
                title: `${ticker.symbol} earnings`,
                tickerId: ticker.id,
                startsAt,
                confirmed: hit.confirmed,
                session: hit.hour,
                description: hit.confirmed
                  ? "Date confirmed on the earnings calendar."
                  : "Date from the reporting pattern. Consensus fills in once the company confirms.",
                impact: hit.hour === "amc" ? ["after-close"] : [],
                consensus:
                  hit.epsEstimate != null
                    ? [{ metric: "EPS", consensus: `$${hit.epsEstimate.toFixed(2)}`, prior: "—" }]
                    : undefined,
                consensusSource: hit.epsEstimate != null ? "Earnings calendar" : undefined,
                notify: false,
              });
            }
            if (fresh.length) {
              set({ events: [...get().events, ...fresh] });
            }
          }

          const macros = get().macros;
          for (const m of macros) {
            const print = await liveMacro(m.id as MacroSeriesId, keys);
            if (!print) continue;
            set({
              macroPrints: {
                ...get().macroPrints,
                [m.id]: { macroId: m.id, ...print },
              },
            });
          }

          const held = get().tickers.filter((t) => t.held).slice(0, 3);
          await Promise.all(held.map((t) => get().refreshLive(t.symbol, t.id)));
          void get().refreshNews();
        },

        refreshNews: async () => {
          const s = get();
          if (s.newsStatus === "loading") return;
          const tickers = s.tickers.filter((t) => !t.muted).slice(0, 8);
          if (!tickers.length) {
            set({ newsStatus: "idle" });
            return;
          }
          set({ newsStatus: "loading" });
          try {
            const items = await liveWatchlistNews(
              tickers.map((t) => ({ symbol: t.symbol, company: t.company, tickerId: t.id })),
              s.liveKeys,
            );
            if (!items.length) {
              set({ newsStatus: "idle" });
              return;
            }
            const liveIds = new Set(tickers.map((t) => t.id));
            const kept = get().headlines.filter((h) => h.origin === "fixture" || (h.tickerId && !liveIds.has(h.tickerId)));
            set({
              headlines: [...items, ...kept],
              newsFetchedAt: new Date().toISOString(),
              newsStatus: "idle",
            });
          } catch {
            set({ newsStatus: "error" });
          }
        },

        scoreNews: async () => {
          const s = get();
          if (s.newsStatus === "scoring") return false;
          const batch = s.headlines
            .filter((h) => h.tickerId && h.scoredBy !== "grok")
            .slice(0, 12)
            .map((h) => ({
              id: h.id,
              symbol: s.tickers.find((t) => t.id === h.tickerId)?.symbol ?? "",
              title: h.title,
              summary: h.summary,
            }))
            .filter((h) => h.symbol);
          if (!batch.length) return false;
          set({ newsStatus: "scoring" });
          try {
            const ranked = await liveScoreNews(batch);
            if (!ranked.length) {
              set({ newsStatus: "idle" });
              return false;
            }
            const byId = new Map(ranked.map((r) => [r.id, r]));
            set({
              headlines: get().headlines.map((h) => {
                const r = byId.get(h.id);
                if (!r) return h;
                return { ...h, impact: r.impact, why: r.why, scoredBy: "grok" as const };
              }),
              newsStatus: "idle",
            });
            return true;
          } catch {
            set({ newsStatus: "error" });
            return false;
          }
        },
      };
    },
    {
      name: "catalyst-v3",
      version: SEED_VERSION,
      migrate: (persisted, from) => {
        const s = (persisted ?? {}) as AppSnapshot;
        if (from !== SEED_VERSION || s.seedVersion !== SEED_VERSION) {
          const fresh = s.emptySeed ? buildEmptySnapshot() : buildDemoSnapshot();
          return {
            ...fresh,
            theme: s.theme ?? "dark",
            demoMode: s.demoMode ?? true,
            notifyLead: s.notifyLead ?? "both",
            liveKeys: s.liveKeys ?? fresh.liveKeys,
            dataSource: s.demoMode === false ? "live" : "fixture",
          };
        }
        return { ...s, tape: s.tape ?? {}, macroPrints: s.macroPrints ?? {} };
      },
      partialize: (s) => {
        const {
          tab: _t,
          stack: _s,
          sheet: _sh,
          banner: _b,
          now: _n,
          hydrated: _h,
          newsStatus: _ns,
          ...rest
        } = s;
        void _t;
        void _s;
        void _sh;
        void _b;
        void _n;
        void _h;
        void _ns;
        const snap: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (typeof v !== "function") snap[k] = v;
        }
        return snap as unknown as AppSnapshot;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const fixed = ensureSeed(state);
        if (fixed !== state || fixed.seedVersion !== SEED_VERSION) {
          useCatalyst.setState({ ...fixed, hydrated: true, now: Date.now(), stack: [], sheet: null, tab: "timeline", newsStatus: "idle" });
          return;
        }
        useCatalyst.setState({ hydrated: true, now: Date.now(), stack: [], sheet: null, tab: "timeline", newsStatus: "idle" });
      },
    },
  ),
);

export function useCurrentScreen(): Screen {
  const stack = useCatalyst((s) => s.stack);
  const tab = useCatalyst((s) => s.tab);
  return stack[stack.length - 1] ?? { name: "tab", tab };
}

export { MACRO_CATALOG };
