// Headless check of the real mobile/src/data API against the live backend, counting requests with the
// same counter the Backend check screen shows. One throwaway test-* user, removed at the end.
//   cd cloud && node run-app.mjs test/app-layer.ts
import "./app-stubs/load-mobile-env.ts";
import { randomUUID } from "node:crypto";
import {
  addWatch,
  computeRecord,
  currentUser,
  deleteAccount,
  getEvidence,
  hydrateSession,
  lockCall,
  LockError,
  refresh,
  saveDraft,
  setHeld,
  setMuted,
  signIn,
  signOut,
  signUp,
} from "../../mobile/src/data/index.ts";
import { getCache } from "../../mobile/src/data/cache.ts";
import { getRequestCount, Parse } from "../../mobile/src/data/parse.ts";
import { cleanupTestUsers } from "./helpers.ts";

// Node build of Parse keeps the current user only when told to (the RN build always does).
Parse.User.enableUnsafeCurrentUser();

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => results.push({ name, pass, detail });
let mark = getRequestCount();
const spent = () => {
  const n = getRequestCount() - mark;
  mark = getRequestCount();
  return n;
};

try {
  await hydrateSession();
  check("app open while signed out costs 0 requests", spent() === 0 && currentUser() === null, `${getRequestCount()} requests`);

  const email = `test-app-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  await signUp(email, password);
  const s0 = getCache();
  check("signUp + first sync = 2 requests, cache filled", spent() === 2 && Object.keys(s0.tickers).length >= 10 && !!s0.cursor, `tickers ${Object.keys(s0.tickers).length}, events ${Object.keys(s0.events).length}`);

  const aapl = Object.values(s0.tickers).find((t) => t.symbol === "AAPL")!;
  const cpi = Object.values(s0.macroSeries).find((m) => m.key === "cpi")!;
  const aaplEvent = Object.values(s0.events).find((e) => e.tickerId === aapl.id && e.kind === "earnings")!;
  const cpiEvent = Object.values(s0.events).find((e) => e.macroId === cpi.id)!;

  const wA = await addWatch({ tickerId: aapl.id });
  const wC = await addWatch({ macroId: cpi.id });
  check("addWatch x2 = 2 requests", spent() === 2 && Object.keys(getCache().watchItems).length === 2);
  await setHeld(wA.id, true);
  await setMuted(wC.id, true);
  const w = getCache().watchItems;
  check("setHeld / setMuted = 1 request each, per user", spent() === 2 && w[wA.id].held && w[wC.id].muted);

  saveDraft(aaplEvent.id, { direction: "up", conviction: 3, reasoning: "Services mix.", wrongIf: "Gross margin under 45%." });
  check("saveDraft is local (0 requests)", spent() === 0 && !!getCache().drafts[aaplEvent.id]);
  const call = await lockCall(aaplEvent.id);
  check("lockCall = 1 request; server stamps lockedAt + evidence; draft cleared", spent() === 1 && !!call.lockedAt && call.scoringRuleVersion === 1 && !getCache().drafts[aaplEvent.id], `evidence ${call.evidenceIds.length}`);

  saveDraft(cpiEvent.id, { direction: "down", conviction: 2, reasoning: "Hot core.", wrongIf: "Core under 0.2%." });
  let kind = "";
  try {
    await lockCall(cpiEvent.id);
  } catch (e) {
    kind = e instanceof LockError ? e.kind : String(e);
  }
  check("macro lock without a target is stopped on the phone (0 requests)", kind === "macro-target" && spent() === 0, kind);

  saveDraft(aaplEvent.id, { conviction: 5 });
  const relock = await lockCall(aaplEvent.id);
  check("re-lock = 1 request, same call", spent() === 1 && relock.id === call.id && relock.conviction === 5);

  await refresh();
  check("pull-to-refresh = 1 request (delta)", spent() === 1 && Object.keys(getCache().calls).length === 1);

  const rec = computeRecord(Object.values(getCache().calls), Date.now());
  check("Record from cache = 0 requests", spent() === 0 && rec.entries.length === 1 && rec.pending.length === 1, `pending ${rec.pending.length}, scored ${rec.scored.length}`);

  const ev = await getEvidence(relock.evidenceIds);
  check("getEvidence uses cached headlines first", ev.length === relock.evidenceIds.length, `${ev.length} headline(s), ${spent()} request(s)`);

  // Same account, fresh device: sign out (clears this device), sign back in, everything returns.
  await signOut();
  check("signOut = 1 request, device cache cleared", spent() === 1 && getCache().userId === null && currentUser() === null);
  await signIn(email, password);
  const s2 = getCache();
  const back = Object.values(s2.watchItems);
  check(
    "sign in again (other device): watchlist + locked call come back",
    spent() === 2 && back.length === 2 && back.some((x) => x.held) && back.some((x) => x.muted) && Object.values(s2.calls)[0]?.conviction === 5,
    `${back.length} watch, ${Object.keys(s2.calls).length} call`,
  );

  const del = await deleteAccount();
  check("deleteAccount = 1 request; signed out locally", spent() === 1 && currentUser() === null && del.deleted.user === 1, JSON.stringify(del.deleted));
} catch (e) {
  check("ran to completion", false, e instanceof Error ? e.message : String(e));
} finally {
  const left = await cleanupTestUsers();
  check("cleanup: zero test-* users and rows remain", left.users === 0 && left.rows === 0, `${left.users} user(s), ${left.rows} row(s)`);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
  console.log(`app requests this run: ${getRequestCount()}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}
