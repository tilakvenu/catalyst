// DEMO DATA, on purpose only. Creates one demo account with ~20 locked, already-resolved calls on past
// events so the Record tab has something to show. Uses the master key from cloud/.env.
//
//   cd cloud && npm run seed:demo            create or update (idempotent: re-running changes nothing)
//   cd cloud && npm run seed:demo:cleanup    delete the demo account, its rows, and the demo events
//   cd cloud && npm run seed:demo:plan       print the planned calls and outcomes; no network, no keys
//
// cloud/.env needs DEMO_PASSWORD (8+ characters, you choose it; never printed) and optionally DEMO_EMAIL
// (default demo@catalyst.example; .example addresses never receive mail).
//
// Labels: demo events have "(demo)" in the title and consensusSource DEMO_SOURCE. They sit in Apr-Sep 2026,
// before the app's sync window, so other accounts only see them if they page the calendar back.
// Outcomes come from the same referee.resolveCall the tick job uses, at each event's resolving close.
import { etMs, isTradingDay } from "../src/lib/catalyst/calendar.ts";
import { resolvingCloseAt } from "../src/lib/catalyst/session.ts";
import type { Direction, MacroSeriesId, Session } from "../src/lib/catalyst/types.ts";
import { calibrationCopy, convictionBands } from "../src/lib/catalyst/scoring.ts";
import { resolveCall, SCORING_RULE_VERSION } from "./src/referee.ts";

export const DEMO_SOURCE = "demo data: cloud/seed-demo.ts";
const DEFAULT_EMAIL = "demo@catalyst.example";

type Row = {
  name: string; // ticker symbol or macro key
  macro?: MacroSeriesId;
  target?: string; // macro calls: ticker symbol they are scored against
  date: [number, number, number];
  session: Session;
  direction: Direction;
  conviction: 1 | 2 | 3 | 4 | 5;
  printMovePct: number;
  typicalMovePct: number;
  reasoning: string;
  wrongIf: string;
};

// 20 calls: conviction 1-2 x4, 3 x8, 4-5 x8. Hits 12 / 20. High conviction hits 4/8 vs medium 6/8,
// so the Record tab's calibration note appears. Includes conviction-5 misses (NVDA May and Aug).
const ROWS: Row[] = [
  { name: "JPM", date: [2026, 4, 14], session: "bmo", direction: "up", conviction: 3, printMovePct: 2.1, typicalMovePct: 1.4, reasoning: "NII guide holds; trading desks had a strong quarter.", wrongIf: "NII guide cut or reserve build above $2B." },
  { name: "TSLA", date: [2026, 4, 22], session: "amc", direction: "down", conviction: 4, printMovePct: 5.8, typicalMovePct: 3.6, reasoning: "Deliveries already missed; auto margin compresses again.", wrongIf: "Auto gross margin ex-credits above 17%." },
  { name: "MSFT", date: [2026, 4, 29], session: "amc", direction: "up", conviction: 5, printMovePct: 4.2, typicalMovePct: 2.0, reasoning: "Azure growth re-accelerates on AI capacity coming online.", wrongIf: "Azure growth under 30% constant currency." },
  { name: "META", date: [2026, 4, 29], session: "amc", direction: "up", conviction: 3, printMovePct: 7.9, typicalMovePct: 3.1, reasoning: "Ad pricing strong; Reels monetization closing the gap.", wrongIf: "Capex guide raised more than $5B without revenue raise." },
  { name: "AAPL", date: [2026, 4, 30], session: "amc", direction: "up", conviction: 2, printMovePct: -0.9, typicalMovePct: 1.6, reasoning: "Services beat offsets soft iPhone units.", wrongIf: "Services growth under 12%." },
  { name: "AMZN", date: [2026, 4, 30], session: "amc", direction: "down", conviction: 3, printMovePct: -3.4, typicalMovePct: 2.5, reasoning: "Q2 operating income guide light on capex depreciation.", wrongIf: "AWS growth above 20%." },
  { name: "NVDA", date: [2026, 5, 27], session: "amc", direction: "up", conviction: 5, printMovePct: -4.6, typicalMovePct: 3.3, reasoning: "Data center beat and raise; supply constraints easing.", wrongIf: "Data center revenue guide flat quarter on quarter." },
  { name: "AVGO", date: [2026, 6, 11], session: "amc", direction: "up", conviction: 4, printMovePct: 6.3, typicalMovePct: 2.9, reasoning: "Custom accelerator orders from two new hyperscalers.", wrongIf: "AI semiconductor revenue guide under $5B." },
  { name: "cpi", macro: "cpi", target: "SPY", date: [2026, 6, 10], session: "bmo", direction: "down", conviction: 3, printMovePct: -1.2, typicalMovePct: 0.8, reasoning: "Shelter sticky; core prints 0.4% and pushes out cuts.", wrongIf: "Core CPI at or below 0.2% month on month." },
  { name: "fomc", macro: "fomc", target: "QQQ", date: [2026, 6, 17], session: "intraday", direction: "flat", conviction: 2, printMovePct: 0.4, typicalMovePct: 0.9, reasoning: "Hold is fully priced; dots barely move.", wrongIf: "Median dot shows fewer than two cuts this year." },
  { name: "JPM", date: [2026, 7, 14], session: "bmo", direction: "flat", conviction: 3, printMovePct: -0.6, typicalMovePct: 1.4, reasoning: "In-line quarter; buyback already priced.", wrongIf: "CET1 guide changes by more than 50 bp." },
  { name: "TSLA", date: [2026, 7, 22], session: "amc", direction: "down", conviction: 5, printMovePct: -8.1, typicalMovePct: 3.6, reasoning: "Price cuts show up in margin; energy cannot offset.", wrongIf: "Auto gross margin ex-credits above 18%." },
  { name: "MSFT", date: [2026, 7, 29], session: "amc", direction: "up", conviction: 4, printMovePct: -1.1, typicalMovePct: 2.0, reasoning: "Copilot seat growth shows in Office commercial.", wrongIf: "Office commercial growth under 12%." },
  { name: "META", date: [2026, 7, 29], session: "amc", direction: "up", conviction: 3, printMovePct: -2.8, typicalMovePct: 3.1, reasoning: "Q3 revenue guide above consensus.", wrongIf: "Expense guide raised again." },
  { name: "AAPL", date: [2026, 7, 30], session: "amc", direction: "up", conviction: 3, printMovePct: 2.4, typicalMovePct: 1.6, reasoning: "Gross margin holds above 46% on Services mix.", wrongIf: "Gross margin guide under 45.5%." },
  { name: "AMZN", date: [2026, 7, 30], session: "amc", direction: "up", conviction: 4, printMovePct: 3.9, typicalMovePct: 2.5, reasoning: "AWS backlog converts; retail margins expand.", wrongIf: "North America operating margin under 5%." },
  { name: "NVDA", date: [2026, 8, 26], session: "amc", direction: "up", conviction: 5, printMovePct: 1.8, typicalMovePct: 3.3, reasoning: "Next-gen ramp pulls forward; guide well above Street.", wrongIf: "Gross margin guide under 72%." },
  { name: "nfp", macro: "nfp", target: "SPY", date: [2026, 8, 7], session: "bmo", direction: "up", conviction: 1, printMovePct: -0.9, typicalMovePct: 0.8, reasoning: "Goldilocks print near 150k.", wrongIf: "Unemployment rate ticks up to 4.5%." },
  { name: "AVGO", date: [2026, 9, 10], session: "amc", direction: "down", conviction: 3, printMovePct: -1.9, typicalMovePct: 2.9, reasoning: "Non-AI semis still soft; VMware growth fading.", wrongIf: "Total revenue guide above $17B." },
  { name: "cpi", macro: "cpi", target: "QQQ", date: [2026, 9, 11], session: "bmo", direction: "up", conviction: 1, printMovePct: 1.3, typicalMovePct: 1.0, reasoning: "Goods deflation pulls core to 0.2%.", wrongIf: "Core CPI at or above 0.4%." },
];

const TIMES: Record<Session, [number, number]> = { bmo: [8, 30], amc: [16, 20], intraday: [14, 0] };

function planRow(r: Row) {
  const [y, m, d] = r.date;
  const [h, min] = r.macro === "fomc" ? [14, 0] : TIMES[r.session];
  const start = etMs(y, m, d, h, min);
  if (!isTradingDay(start)) throw new Error(`${r.name} ${r.date.join("-")} is not a trading day`);
  const startsAt = new Date(start).toISOString();
  const closeAt = resolvingCloseAt(startsAt, r.session);
  const res = resolveCall(
    { direction: r.direction, conviction: r.conviction, reasoning: r.reasoning, wrongIf: r.wrongIf, callTargetId: r.target, lockedAt: "x", hasOutcome: false },
    { id: "demo", kind: r.macro ? "macro" : "earnings", startsAt, session: r.session, printMovePct: r.printMovePct, typicalMovePct: r.typicalMovePct },
    closeAt,
  );
  if (res.action !== "score") throw new Error(`${r.name} ${r.date.join("-")} did not resolve: ${res.reason}`);
  const label = r.macro ? `${r.macro.toUpperCase()}` : r.name;
  const title = `${label} ${r.macro ? "release" : "earnings"} (demo)`;
  return { ...r, startsAt, lockedAt: new Date(start - 20 * 3600000).toISOString(), outcome: res.outcome, title };
}

function printPlan() {
  const plan = ROWS.map(planRow);
  for (const p of plan) {
    console.log(
      `${p.startsAt.slice(0, 10)}  ${p.title.padEnd(24)} conv ${p.conviction}  called ${p.direction.padEnd(4)}  move ${String(p.printMovePct).padStart(5)}% vs ±${p.typicalMovePct}%  -> ${p.outcome.actualDirection.padEnd(4)} ${p.outcome.result.toUpperCase()}`,
    );
  }
  const entries = plan.map((p) => ({ conviction: p.conviction, direction: p.direction, actualDirection: p.outcome.actualDirection })) as never[];
  const bands = convictionBands(entries);
  const hits = plan.filter((p) => p.outcome.result === "called").length;
  console.log(`\n${plan.length} calls, ${hits} called (${Math.round((hits / plan.length) * 100)}%). Bands: ${bands.map((b) => `${b.label}: ${b.hits}/${b.n}`).join(", ")}`);
  console.log(`Calibration note: ${calibrationCopy(bands, plan.length).text ?? "(none)"}`);
}

async function main() {
  if (process.argv.includes("--plan")) return printPlan();

  const { loadEnv } = await import("./env.ts");
  const { makeRest } = await import("./rest.ts");
  const env = loadEnv();
  const { request } = makeRest(env);
  const email = (process.env.DEMO_EMAIL?.trim() || DEFAULT_EMAIL).toLowerCase();
  const q = (w: unknown) => `where=${encodeURIComponent(JSON.stringify(w))}`;
  const ptr = (className: string, objectId: string) => ({ __type: "Pointer", className, objectId });
  const date = (iso: string) => ({ __type: "Date", iso });
  const findUser = async () => (await request<{ results: { objectId: string }[] }>("GET", `classes/_User?${q({ username: email })}&keys=objectId`)).results[0];

  if (process.argv.includes("--cleanup")) {
    const user = await findUser();
    const counts: Record<string, number> = {};
    if (user) {
      const owner = ptr("_User", user.objectId);
      for (const [cls, field] of [["CallRevision", "owner"], ["Call", "owner"], ["WatchItem", "owner"], ["_Session", "user"]] as const) {
        const { results } = await request<{ results: { objectId: string }[] }>("GET", `classes/${cls}?${q({ [field]: owner })}&keys=objectId&limit=1000`);
        for (const r of results) await request("DELETE", `classes/${cls}/${r.objectId}`);
        counts[cls] = results.length;
      }
      await request("DELETE", `users/${user.objectId}`);
      counts.user = 1;
    }
    const { results: evs } = await request<{ results: { objectId: string }[] }>("GET", `classes/CatalystEvent?${q({ consensusSource: DEMO_SOURCE })}&keys=objectId&limit=1000`);
    for (const e of evs) await request("DELETE", `classes/CatalystEvent/${e.objectId}`);
    counts.demoEvents = evs.length;
    const leftUser = await findUser();
    const leftEv = (await request<{ count: number }>("GET", `classes/CatalystEvent?${q({ consensusSource: DEMO_SOURCE })}&count=1&limit=0`)).count;
    console.log(`Removed: ${JSON.stringify(counts)}`);
    console.log(`Remaining demo user: ${leftUser ? 1 : 0}, demo events: ${leftEv}`);
    return;
  }

  const password = process.env.DEMO_PASSWORD ?? "";
  if (password.length < 8) throw new Error("Set DEMO_PASSWORD (8+ characters) in cloud/.env first.");
  const plan = ROWS.map(planRow);

  const tickers = new Map((await request<{ results: any[] }>("GET", "classes/Ticker?limit=1000")).results.map((t) => [t.symbol, t.objectId]));
  const macros = new Map((await request<{ results: any[] }>("GET", "classes/MacroSeries?limit=1000")).results.map((m) => [m.key, m.objectId]));
  const need = (map: Map<string, string>, k: string) => map.get(k) ?? (() => { throw new Error(`${k} not found; run npm run seed first.`); })();

  // 1. Demo user (password kept in sync with cloud/.env on every run; never printed).
  let user = await findUser();
  let createdUser = false;
  if (!user) {
    user = await request<{ objectId: string }>("POST", "users", { username: email, email, password });
    createdUser = true;
  } else {
    await request("PUT", `users/${user.objectId}`, { password });
  }
  const userId = user.objectId;
  const owner = ptr("_User", userId);
  const acl = { [userId]: { read: true, write: true } };

  // 2. Demo events (labeled), matched on name + start time.
  const existingEv = new Map(
    (await request<{ results: any[] }>("GET", `classes/CatalystEvent?${q({ consensusSource: DEMO_SOURCE })}&limit=1000`)).results.map((e) => [
      `${e.ticker?.objectId ?? e.macro?.objectId}|${e.startsAt.iso}`,
      e,
    ]),
  );
  let evCreated = 0;
  let evUpdated = 0;
  const eventIds: string[] = [];
  for (const p of plan) {
    const nameId = p.macro ? need(macros, p.macro) : need(tickers, p.name);
    const body = {
      ...(p.macro ? { macro: ptr("MacroSeries", nameId) } : { ticker: ptr("Ticker", nameId) }),
      kind: p.macro ? "macro" : "earnings",
      title: p.title,
      startsAt: date(p.startsAt),
      session: p.session,
      confirmed: true,
      consensus: [],
      consensusSource: DEMO_SOURCE,
      printMovePct: p.printMovePct,
      typicalMovePct: p.typicalMovePct,
    };
    const have = existingEv.get(`${nameId}|${p.startsAt}`);
    if (!have) {
      eventIds.push((await request<{ objectId: string }>("POST", "classes/CatalystEvent", body)).objectId);
      evCreated++;
    } else {
      eventIds.push(have.objectId);
      if (have.title !== body.title || have.printMovePct !== body.printMovePct || have.typicalMovePct !== body.typicalMovePct || have.session !== body.session) {
        await request("PUT", `classes/CatalystEvent/${have.objectId}`, body);
        evUpdated++;
      }
    }
  }

  // 3. Locked, resolved calls (one per event), written with the master key so lockedAt can be in the past.
  const existingCalls = new Map(
    (await request<{ results: any[] }>("GET", `classes/Call?${q({ owner })}&limit=1000`)).results.map((c) => [c.event.objectId, c]),
  );
  let callsCreated = 0;
  let callsUpdated = 0;
  for (const [i, p] of plan.entries()) {
    const body = {
      owner,
      event: ptr("CatalystEvent", eventIds[i]),
      direction: p.direction,
      conviction: p.conviction,
      reasoning: p.reasoning,
      wrongIf: p.wrongIf,
      ...(p.target ? { callTarget: ptr("Ticker", need(tickers, p.target)) } : {}),
      lockedAt: date(p.lockedAt),
      evidenceIds: [],
      scoringRuleVersion: SCORING_RULE_VERSION,
      outcome: p.outcome,
      ACL: acl,
    };
    const have = existingCalls.get(eventIds[i]);
    if (!have) {
      await request("POST", "classes/Call", body);
      callsCreated++;
    } else if (
      have.direction !== p.direction ||
      have.conviction !== p.conviction ||
      have.reasoning !== p.reasoning ||
      have.wrongIf !== p.wrongIf ||
      JSON.stringify(have.outcome) !== JSON.stringify(p.outcome)
    ) {
      await request("PUT", `classes/Call/${have.objectId}`, body);
      callsUpdated++;
    }
  }

  // 4. A watchlist so the desk is not empty either.
  const watch = [
    ...["NVDA", "AAPL", "MSFT", "AMZN", "META", "TSLA", "JPM", "AVGO"].map((s) => ({
      field: "ticker",
      target: ptr("Ticker", need(tickers, s)),
      held: s === "NVDA" || s === "MSFT",
    })),
    { field: "macro", target: ptr("MacroSeries", need(macros, "cpi")), held: false },
  ];
  const haveWatch = new Set(
    (await request<{ results: any[] }>("GET", `classes/WatchItem?${q({ owner })}&limit=1000`)).results.map((w) => w.ticker?.objectId ?? w.macro?.objectId),
  );
  let watchCreated = 0;
  for (const w of watch) {
    if (haveWatch.has(w.target.objectId)) continue;
    await request("POST", "classes/WatchItem", { owner, [w.field]: w.target, held: w.held, muted: false, ACL: acl });
    watchCreated++;
  }

  const calls = (await request<{ count: number }>("GET", `classes/Call?${q({ owner })}&count=1&limit=0`)).count;
  console.log(`Demo user ${email}: ${createdUser ? "created" : "already existed (password re-synced)"}`);
  console.log(`Demo events: created ${evCreated}, updated ${evUpdated}, unchanged ${plan.length - evCreated - evUpdated}`);
  console.log(`Demo calls: created ${callsCreated}, updated ${callsUpdated}, unchanged ${plan.length - callsCreated - callsUpdated} (total now ${calls})`);
  console.log(`Watchlist items created: ${watchCreated}`);
  console.log(`Sign in on the app as ${email} with DEMO_PASSWORD from cloud/.env, then open Record.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
