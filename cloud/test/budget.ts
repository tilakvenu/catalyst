// Phase 6.3 request budget. Runs the typical session N times with the real mobile/src/data code:
//   open (bootstrap) -> change 2 watchlist items -> lock 1 call -> pull-to-refresh -> open Record
// and counts every request this run sends (app SDK + the test's own setup/cleanup), so the Back4App
// dashboard delta can be compared against it. One test-* user, deleted at the end.
//   cd cloud && node run-app.mjs test/budget.ts 20
import "./app-stubs/load-mobile-env.ts";
import { randomUUID } from "node:crypto";
import { addWatch, computeRecord, deleteAccount, hydrateSession, lockCall, refresh, saveDraft, setMuted, signUp } from "../../mobile/src/data/index.ts";
import { getCache } from "../../mobile/src/data/cache.ts";
import { getRequestCount, Parse } from "../../mobile/src/data/parse.ts";
import { bootstrap } from "../../mobile/src/data/sync.ts";
import { cleanupTestUsers, rest } from "./helpers.ts";

Parse.User.enableUnsafeCurrentUser();
const N = Math.max(1, Number(process.argv[2] ?? 20));

let helperRequests = 0;
const originalRequest = rest.request;
rest.request = ((...args: Parameters<typeof originalRequest>) => {
  helperRequests += 1;
  return originalRequest(...args);
}) as typeof originalRequest;

const started = new Date().toISOString();
const perSession: number[] = [];
let setup = 0;
let teardown = 0;
let ok = true;

try {
  await hydrateSession();
  const a0 = getRequestCount();
  await signUp(`test-budget-${randomUUID().slice(0, 8)}@example.com`, randomUUID());
  const s = getCache();
  const aapl = Object.values(s.tickers).find((t) => t.symbol === "AAPL")!;
  const cpi = Object.values(s.macroSeries).find((m) => m.key === "cpi")!;
  const event = Object.values(s.events)
    .filter((e) => e.tickerId === aapl.id && Date.parse(e.startsAt) > Date.now())
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0];
  const wA = await addWatch({ tickerId: aapl.id });
  const wC = await addWatch({ macroId: cpi.id });
  setup = getRequestCount() - a0;

  for (let i = 0; i < N; i++) {
    const before = getRequestCount();
    await bootstrap("open"); // app open
    await setMuted(wA.id, i % 2 === 0); // change watchlist item 1
    await setMuted(wC.id, i % 2 === 0); // change watchlist item 2
    saveDraft(event.id, { direction: i % 2 ? "down" : "up", conviction: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5, reasoning: `Budget session ${i + 1}.`, wrongIf: "Test." });
    await lockCall(event.id); // lock 1 call (first time creates, then re-locks)
    await refresh(); // pull-to-refresh
    computeRecord(Object.values(getCache().calls), Date.now()); // open Record
    perSession.push(getRequestCount() - before);
  }

  const t0 = getRequestCount();
  await deleteAccount();
  teardown = getRequestCount() - t0;
} catch (e) {
  ok = false;
  console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  const left = await cleanupTestUsers();
  const finished = new Date().toISOString();
  const appTotal = getRequestCount();
  const total = appTotal + helperRequests;
  const per = perSession.length ? perSession.reduce((a, b) => a + b, 0) / perSession.length : 0;
  console.log(`window (UTC): ${started} .. ${finished}`);
  console.log(`sessions: ${perSession.length}; requests per session (app): ${perSession.join(", ")}`);
  console.log(`setup (sign-up, first sync, 2 adds): ${setup}; teardown (deleteAccount): ${teardown}`);
  console.log(`app requests: ${appTotal}; test harness requests (master-key cleanup/checks): ${helperRequests}`);
  console.log(`TOTAL requests this run sent to Back4App: ${total}`);
  console.log(`typical session = ${per} requests -> ${per ? Math.floor(25000 / per) : "?"} sessions per 25K/month (~${per ? Math.floor(25000 / per / 30) : "?"} a day)`);
  console.log(`if Cloud Code's internal queries were billed too, the dashboard would show roughly ${N * 20}+ more than ${total}`);
  console.log(`cleanup: ${left.users} test-* user(s), ${left.rows} row(s) left`);
  process.exitCode = ok && left.users === 0 && left.rows === 0 && perSession.every((n) => n === 5) ? 0 : 1;
}
