// Live smoke test of the deployed referee with one throwaway test-* user, then full cleanup.
//   cd cloud && node --no-warnings test/smoke.ts
import { as, attempt, cleanupTestUsers, ptr, rest, signUp, where } from "./helpers.ts";

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });
const fn = <T>(name: string, params: unknown, auth: any) => rest.request<{ result: T }>("POST", `functions/${name}`, params, auth).then((r) => r.result);

try {
  const u = await signUp("smoke");
  const me = as(u);

  const full = await fn<any>("bootstrap", {}, me);
  check("bootstrap (full) returns reference data", full.full && full.tickers.length >= 10 && full.macroSeries.length === 6 && full.events.length > 0, `${full.tickers.length} tickers, ${full.macroSeries.length} macros, ${full.events.length} events`);

  const aapl = full.tickers.find((t: any) => t.symbol === "AAPL");
  const spy = full.tickers.find((t: any) => t.symbol === "SPY");
  const cpiSeries = full.macroSeries.find((m: any) => m.key === "cpi");
  const aaplEvent = full.events.find((e: any) => e.tickerId === aapl.id && e.kind === "earnings");
  const cpiEvent = full.events.find((e: any) => e.macroId === cpiSeries.id);

  const w = await rest.request<{ objectId: string }>("POST", "classes/WatchItem", { ticker: ptr("Ticker", aapl.id), held: true, muted: false }, me);
  const dupe = await attempt(() => rest.request("POST", "classes/WatchItem", { ticker: ptr("Ticker", aapl.id) }, me));
  check("watchlist add works, duplicate rejected", !!w.objectId && !dupe.allowed, dupe.detail);

  const lock = { event: ptr("CatalystEvent", aaplEvent.id), direction: "up", conviction: 3, reasoning: "iPhone mix.", wrongIf: "Services growth under 10%." };
  const c = await rest.request<{ objectId: string }>("POST", "classes/Call", lock, me);
  const call1 = await rest.request<any>("GET", `classes/Call/${c.objectId}`, undefined, me);
  check("lock stamps lockedAt, evidence, rule version", !!call1.lockedAt && Array.isArray(call1.evidenceIds) && call1.scoringRuleVersion === 1 && call1.owner?.objectId === u.id, `evidence ${call1.evidenceIds?.length ?? 0} headline(s)`);

  await new Promise((r) => setTimeout(r, 1100));
  await rest.request("PUT", `classes/Call/${c.objectId}`, { conviction: 5 }, me);
  const call2 = await rest.request<any>("GET", `classes/Call/${c.objectId}`, undefined, me);
  const revs = await rest.request<{ results: any[] }>("GET", `classes/CallRevision?${where({ call: ptr("Call", c.objectId) })}`, undefined, me);
  check(
    "re-lock writes the prior version to CallRevision",
    call2.conviction === 5 && call2.lockedAt.iso > call1.lockedAt.iso && revs.results.length === 1 && revs.results[0].snapshot.conviction === 3,
    `${revs.results.length} revision(s), snapshot conviction ${revs.results[0]?.snapshot?.conviction}`,
  );

  const noTarget = await attempt(() => rest.request("POST", "classes/Call", { ...lock, event: ptr("CatalystEvent", cpiEvent.id) }, me));
  const withTarget = await attempt(() => rest.request("POST", "classes/Call", { ...lock, event: ptr("CatalystEvent", cpiEvent.id), callTarget: ptr("Ticker", spy.id) }, me));
  check("macro lock needs a call target", !noTarget.allowed && withTarget.allowed, `${noTarget.detail} / with SPY: ${withTarget.detail}`);

  const delta = await fn<any>("bootstrap", { since: full.serverTime }, me);
  const again = await fn<any>("bootstrap", { since: delta.serverTime }, me);
  check("bootstrap(since) with nothing changed returns nothing", again.tickers.length + again.events.length + again.headlines.length + again.watchItems.length + again.calls.length === 0,
    `${again.tickers.length + again.events.length + again.headlines.length + again.watchItems.length + again.calls.length} row(s)`);
  check(
    "bootstrap(since) returns only changes, id lists, and a newly watched name's headlines",
    !delta.full && delta.tickers.length === 0 && delta.watchItems.length === 1 && delta.calls.length === 2 && delta.callIds.length === 2 && delta.watchIds.length === 1 &&
      delta.headlines.length > 0 && delta.headlines.every((h: any) => h.tickerId === aapl.id),
    `${delta.tickers.length} tickers, ${delta.watchItems.length} watch, ${delta.calls.length} calls, ${delta.headlines.length} headlines`,
  );

  const cal = await fn<any>("getCalendar", { month: "2026-10" }, me);
  check("getCalendar(month)", cal.events.length > 0 && cal.events.every((e: any) => e.startsAt.startsWith("2026-10")), `${cal.events.length} events in 2026-10`);
  const ev = await fn<any>("getEvidence", { ids: call2.evidenceIds }, me);
  check("getEvidence(ids)", ev.headlines.length === call2.evidenceIds.length, `${ev.headlines.length} headline(s)`);

  // A past event with a recorded print, and a call locked before it (master key: clients cannot backdate).
  const pastStart = new Date(Date.now() - 5 * 86400000);
  const past = await rest.request<{ objectId: string }>("POST", "classes/CatalystEvent", {
    ticker: ptr("Ticker", aapl.id), kind: "earnings", title: "test-past-print", session: "bmo", confirmed: true, consensus: [],
    startsAt: { __type: "Date", iso: pastStart.toISOString() }, printMovePct: -2.4, typicalMovePct: 1.2,
  });
  const pastCall = await rest.request<{ objectId: string }>("POST", "classes/Call", {
    owner: { __type: "Pointer", className: "_User", objectId: u.id }, event: ptr("CatalystEvent", past.objectId),
    direction: "down", conviction: 4, reasoning: "r", wrongIf: "w", evidenceIds: [], scoringRuleVersion: 1,
    lockedAt: { __type: "Date", iso: new Date(pastStart.getTime() - 3600000).toISOString() },
    ACL: { [u.id]: { read: true, write: true } },
  });

  await rest.request("POST", "jobs/tick", {});
  let status: any;
  for (let i = 0; i < 20 && status?.status !== "succeeded" && status?.status !== "failed"; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    status = (await rest.request<{ results: any[] }>("GET", `classes/_JobStatus?${where({ jobName: "tick" })}&order=-createdAt&limit=1`)).results[0];
  }
  check("tick job runs", status?.status === "succeeded", status?.message ?? status?.status ?? "no status");
  const scoredCall = await rest.request<any>("GET", `classes/Call/${pastCall.objectId}`, undefined, me);
  const o = scoredCall.outcome;
  check("tick scores a closed session: -2.4% vs typical 1.2% is down, so a down call is called", o?.actualDirection === "down" && o?.result === "called" && o?.actualMovePct === -2.4, JSON.stringify(o ?? null));

  const del = await fn<any>("deleteAccount", {}, me);
  const leftCalls = await rest.request<{ count: number }>("GET", `classes/Call?${where({ owner: { __type: "Pointer", className: "_User", objectId: u.id } })}&count=1&limit=0`);
  check("deleteAccount removes the user's rows and the user", del.deleted.user === 1 && del.deleted.calls === 3 && del.deleted.callRevisions === 1 && leftCalls.count === 0, JSON.stringify(del.deleted));
} catch (e) {
  check("smoke ran to completion", false, e instanceof Error ? e.message : String(e));
} finally {
  const left = await cleanupTestUsers();
  check("cleanup: zero test-* users and rows remain", left.users === 0 && left.rows === 0, `${left.users} user(s), ${left.rows} row(s) left`);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  — ${r.detail}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}
