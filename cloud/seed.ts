// Seeds reference data with the master key from cloud/.env. Idempotent: rows are matched on natural keys,
// missing rows are created, changed rows updated, nothing duplicated or deleted. Writes go through /batch.
//   cd cloud && npm run seed
//
// Tickers and three macro series come from the C67 fixtures; PPI, GDP and ISM are added here.
// Events cover a FIXED six-week window so re-running later never creates a second set at new dates.
// Every event date is checked with calendar.ts isTradingDay. Dates are estimates, not vendor data
// (confirmed: false, consensusSource says so). Headlines are C67 demo fixtures (scoredBy: "fixture").
import { etMs, isTradingDay } from "../src/lib/catalyst/calendar.ts";
import { buildDemoSnapshot } from "../src/lib/catalyst/fixtures.ts";
import type { MacroSeriesId, Session } from "../src/lib/catalyst/types.ts";
import { loadEnv } from "./env.ts";
import { makeRest } from "./rest.ts";

export const SEED_WINDOW = { from: "2026-09-28", to: "2026-11-06" };
const SOURCE = "seed: estimated date";
const HEADLINE_LIMIT = 12;

const EXTRA_MACROS: { key: MacroSeriesId; name: string; shortName: string; series: string }[] = [
  { key: "ppi", name: "Producer Price Index", shortName: "PPI", series: "PPI final demand YoY / Core" },
  { key: "gdp", name: "Gross domestic product", shortName: "GDP", series: "Real GDP QoQ SAAR" },
  { key: "ism", name: "ISM Manufacturing", shortName: "ISM", series: "Manufacturing PMI" },
];

// [symbol, year, month, day, session]. BMO 08:30 ET, AMC 16:20 ET (calendar.ts sessionStampOnDay).
const EARNINGS: [string, number, number, number, Session][] = [
  ["JPM", 2026, 10, 13, "bmo"],
  ["TSLA", 2026, 10, 21, "amc"],
  ["MSFT", 2026, 10, 28, "amc"],
  ["META", 2026, 10, 28, "amc"],
  ["AAPL", 2026, 10, 29, "amc"],
  ["AMZN", 2026, 10, 29, "amc"],
];

// [key, year, month, day, hour, minute, session, title]. 8:30 ET releases are pre-open (bmo).
const MACRO_EVENTS: [MacroSeriesId, number, number, number, number, number, Session, string][] = [
  ["ism", 2026, 10, 1, 10, 0, "intraday", "ISM Manufacturing, September"],
  ["nfp", 2026, 10, 2, 8, 30, "bmo", "Nonfarm payrolls, September"],
  ["cpi", 2026, 10, 14, 8, 30, "bmo", "CPI, September"],
  ["ppi", 2026, 10, 15, 8, 30, "bmo", "PPI, September"],
  ["fomc", 2026, 10, 28, 14, 0, "intraday", "FOMC decision, October meeting"],
  ["gdp", 2026, 10, 29, 8, 30, "bmo", "GDP, Q3 advance"],
  ["ism", 2026, 11, 2, 10, 0, "intraday", "ISM Manufacturing, October"],
  ["nfp", 2026, 11, 6, 8, 30, "bmo", "Nonfarm payrolls, October"],
];

const { request } = makeRest(loadEnv());
type Row = Record<string, any> & { objectId: string };
const ptr = (className: string, objectId: string) => ({ __type: "Pointer", className, objectId });
const date = (iso: string) => ({ __type: "Date", iso });

function tradingStamp(y: number, m: number, d: number, h: number, min: number): string {
  const ms = etMs(y, m, d, h, min);
  const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (ymd < SEED_WINDOW.from || ymd > SEED_WINDOW.to) throw new Error(`${ymd} is outside the seed window`);
  if (!isTradingDay(ms)) throw new Error(`${ymd} is not a NYSE trading day (calendar.ts)`);
  return new Date(ms).toISOString();
}

async function all(className: string): Promise<Row[]> {
  const { results } = await request<{ results: Row[] }>("GET", `classes/${className}?limit=1000`);
  return results;
}
const count = async (className: string) => (await request<{ count: number }>("GET", `classes/${className}?count=1&limit=0`)).count;

type Op = { method: "POST" | "PUT"; path: string; body: Record<string, unknown> };
async function runBatch(ops: Op[]) {
  for (let i = 0; i < ops.length; i += 50) {
    const res = await request<{ success?: unknown; error?: { code: number; error: string } }[]>("POST", "batch", { requests: ops.slice(i, i + 50) });
    const failed = res.filter((r) => r.error);
    if (failed.length) throw new Error(`batch: ${failed.length} failed, first: ${failed[0].error!.code} ${failed[0].error!.error}`);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const norm = (v: any) => (v && v.__type === "Date" ? v.iso : v && v.__type === "Pointer" ? v.objectId : v);

/** Create missing rows, update rows whose managed fields differ. Returns counts. */
async function upsert(className: string, want: { key: string; body: Record<string, any>; createOnly?: Record<string, any> }[], keyOf: (r: Row) => string) {
  const existing = new Map((await all(className)).map((r) => [keyOf(r), r]));
  const ops: Op[] = [];
  let created = 0;
  let updated = 0;
  for (const w of want) {
    const have = existing.get(w.key);
    if (!have) {
      ops.push({ method: "POST", path: `/classes/${className}`, body: { ...w.body, ...w.createOnly } });
      created++;
      continue;
    }
    const diff = Object.fromEntries(Object.entries(w.body).filter(([k, v]) => !same(norm(have[k]), norm(v))));
    if (Object.keys(diff).length) {
      ops.push({ method: "PUT", path: `/classes/${className}/${have.objectId}`, body: diff });
      updated++;
    }
  }
  await runBatch(ops);
  console.log(`  ${className.padEnd(14)} created ${created}, updated ${updated}, unchanged ${want.length - created - updated}`);
  return new Map((await all(className)).map((r) => [keyOf(r), r]));
}

async function main() {
  const classes = ["Ticker", "MacroSeries", "CatalystEvent", "Headline"];
  const before = Object.fromEntries(await Promise.all(classes.map(async (c) => [c, await count(c)])));
  const demo = buildDemoSnapshot(Date.now());
  console.log(`Seeding ${SEED_WINDOW.from} .. ${SEED_WINDOW.to}`);

  const tickers = await upsert(
    "Ticker",
    demo.tickers.map((t) => ({ key: t.symbol, body: { symbol: t.symbol, company: t.company, kind: t.kind } })),
    (r) => r.symbol,
  );
  const macroDefs = [...demo.macros.map((m) => ({ key: m.id as MacroSeriesId, name: m.name, shortName: m.shortName, series: m.series })), ...EXTRA_MACROS];
  const macros = await upsert("MacroSeries", macroDefs.map((m) => ({ key: m.key, body: m })), (r) => r.key);

  const tickerId = (symbol: string) => tickers.get(symbol)?.objectId ?? (() => { throw new Error(`no Ticker ${symbol}`); })();
  const macroId = (key: string) => macros.get(key)?.objectId ?? (() => { throw new Error(`no MacroSeries ${key}`); })();
  const eventKey = (nameId: string, kind: string, startsAt: string) => `${nameId}|${kind}|${startsAt}`;

  const events = [
    ...EARNINGS.map(([symbol, y, m, d, session]) => {
      const startsAt = tradingStamp(y, m, d, session === "amc" ? 16 : 8, session === "amc" ? 20 : 30);
      const id = tickerId(symbol);
      return {
        key: eventKey(id, "earnings", startsAt),
        body: { ticker: ptr("Ticker", id), kind: "earnings", title: `${symbol} earnings`, startsAt: date(startsAt), session, confirmed: false, consensus: [], consensusSource: SOURCE },
      };
    }),
    ...MACRO_EVENTS.map(([key, y, m, d, h, min, session, title]) => {
      const startsAt = tradingStamp(y, m, d, h, min);
      const id = macroId(key);
      return {
        key: eventKey(id, "macro", startsAt),
        body: { macro: ptr("MacroSeries", id), kind: "macro", title, startsAt: date(startsAt), session, confirmed: false, consensus: [], consensusSource: SOURCE },
      };
    }),
  ];
  await upsert("CatalystEvent", events, (r) => eventKey(r.ticker?.objectId ?? r.macro?.objectId, r.kind, r.startsAt?.iso));

  const symbolOf = new Map(demo.tickers.map((t) => [t.id, t.symbol]));
  const now = new Date().toISOString();
  const perName = new Map<string, number>();
  const headlines = demo.headlines
    .map((h) => {
      const nameId = h.tickerId ? tickers.get(symbolOf.get(h.tickerId) ?? "")?.objectId : h.macroId ? macros.get(h.macroId)?.objectId : undefined;
      return nameId ? { h, nameId } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter(({ nameId }) => {
      const n = (perName.get(nameId) ?? 0) + 1;
      perName.set(nameId, n);
      return n <= 2;
    })
    .slice(0, HEADLINE_LIMIT)
    .map(({ h, nameId }) => ({
      key: `${nameId}|${h.title}`,
      body: {
        ...(h.tickerId ? { ticker: ptr("Ticker", nameId) } : { macro: ptr("MacroSeries", nameId) }),
        title: h.title,
        source: h.source,
        ...(h.url ? { url: h.url } : {}),
        kind: h.kind,
        impact: h.impact,
        why: h.why,
        scoredBy: "fixture",
      },
      // Set once: re-running must not move publishedAt/firstSeenAt (evidence depends on firstSeenAt).
      createOnly: { publishedAt: date(h.publishedAt), firstSeenAt: date(now) },
    }));
  await upsert("Headline", headlines, (r) => `${r.ticker?.objectId ?? r.macro?.objectId}|${r.title}`);

  const after = Object.fromEntries(await Promise.all(classes.map(async (c) => [c, await count(c)])));
  console.log("Row counts (before -> after):");
  for (const c of classes) console.log(`  ${c.padEnd(14)} ${String(before[c]).padStart(3)} -> ${after[c]}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
