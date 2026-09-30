// Phase 6.1: two throwaway users (test-*) try to cheat the referee. Every attempt must be refused
// (an error) or neutralized (the server ignored the forged value). Then everything test-* is deleted
// with the master key and the count of what remains is reported.
//   cd cloud && npm run test:cheat
import { as, attempt, cleanupTestUsers, ptr, rest, signUp, userPtr, where } from "./helpers.ts";

type Verdict = { name: string; pass: boolean; how: string };
const results: Verdict[] = [];
const record = (name: string, pass: boolean, how: string) => results.push({ name, pass, how });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

try {
  const a = await signUp("cheat-a");
  const b = await signUp("cheat-b");
  const { result: boot } = await rest.request<{ result: any }>("POST", "functions/bootstrap", {}, as(a));
  const aapl = boot.tickers.find((t: any) => t.symbol === "AAPL");
  const event = boot.events.find((e: any) => e.tickerId === aapl.id && e.kind === "earnings");
  const lock = { event: ptr("CatalystEvent", event.id), direction: "up", conviction: 3, reasoning: "r", wrongIf: "w" };

  // 1. Backdated lockedAt
  const forged = "2020-01-01T00:00:00.000Z";
  const t0 = Date.now();
  const created = await rest.request<{ objectId: string }>("POST", "classes/Call", { ...lock, lockedAt: { __type: "Date", iso: forged } }, as(a));
  const c1 = await rest.request<any>("GET", `classes/Call/${created.objectId}`, undefined, as(a));
  const stamped = Date.parse(c1.lockedAt.iso);
  record("backdated lockedAt", c1.lockedAt.iso !== forged && Math.abs(stamped - t0) < 60000, `sent ${forged}, server stored ${c1.lockedAt.iso} (server time)`);

  // 2. Self-written outcome (and state)
  const out = await attempt(() =>
    rest.request("PUT", `classes/Call/${created.objectId}`, { outcome: { actualMovePct: 9.9, actualDirection: "up", result: "called" }, state: "unresolvable" }, as(a)),
  );
  const c2 = await rest.request<any>("GET", `classes/Call/${created.objectId}`, undefined, as(a));
  record("self-written outcome", c2.outcome === undefined && c2.state === undefined, `${out.allowed ? "save accepted as a re-lock but" : out.detail + ";"} stored outcome: ${JSON.stringify(c2.outcome ?? null)}, state: ${c2.state ?? "none"}`);

  // 3. Client-set evidenceIds
  const fake = ["FAKEFAKE01", "FAKEFAKE02"];
  await attempt(() => rest.request("PUT", `classes/Call/${created.objectId}`, { evidenceIds: fake }, as(a)));
  const c3 = await rest.request<any>("GET", `classes/Call/${created.objectId}`, undefined, as(a));
  record("client-set evidenceIds", !c3.evidenceIds.some((id: string) => fake.includes(id)), `sent ${JSON.stringify(fake)}, server stored ${JSON.stringify(c3.evidenceIds)} (headlines first seen before lock)`);

  // 4. Second Call for the same event
  const dup = await attempt(() => rest.request("POST", "classes/Call", lock, as(a)));
  record("second Call for the same event", !dup.allowed, dup.detail);

  // 5a. Create a CallRevision
  const revCreate = await attempt(() => rest.request("POST", "classes/CallRevision", { call: ptr("Call", created.objectId), owner: userPtr(a.id), snapshot: { conviction: 5 } }, as(a)));
  record("create a CallRevision", !revCreate.allowed, revCreate.detail);

  // 5b. Delete a CallRevision (the relocks above wrote real ones)
  const revs = await rest.request<{ results: any[] }>("GET", `classes/CallRevision?${where({ call: ptr("Call", created.objectId) })}`, undefined, as(a));
  const revDelete = revs.results[0] ? await attempt(() => rest.request("DELETE", `classes/CallRevision/${revs.results[0].objectId}`, undefined, as(a))) : { allowed: true, detail: "no revision to try" };
  record("delete a CallRevision", !revDelete.allowed && revs.results.length > 0, `${revs.results.length} revision(s) exist; delete: ${revDelete.detail}`);

  // 6. Read the other user's Call (by id, and by querying for it)
  const byId = await attempt(() => rest.request("GET", `classes/Call/${created.objectId}`, undefined, as(b)));
  const byQuery = await rest.request<{ results: any[] }>("GET", `classes/Call?${where({ owner: userPtr(a.id) })}`, undefined, as(b));
  record("read the other user's Call", !byId.allowed && byQuery.results.length === 0, `by id: ${byId.detail}; query for A's calls returned ${byQuery.results.length}`);

  // 6b (extra). Overwrite or delete the other user's Call
  const bWrite = await attempt(() => rest.request("PUT", `classes/Call/${created.objectId}`, { conviction: 1 }, as(b)));
  const bDelete = await attempt(() => rest.request("DELETE", `classes/Call/${created.objectId}`, undefined, as(b)));
  record("(extra) write or delete the other user's Call", !bWrite.allowed && !bDelete.allowed, `write: ${bWrite.detail}; delete: ${bDelete.detail}`);

  // 6c (extra). Create a Call owned by someone else
  const { result: bootB } = await rest.request<{ result: any }>("POST", "functions/bootstrap", {}, as(b));
  const otherEvent = bootB.events.find((e: any) => e.kind === "earnings" && e.id !== event.id);
  const spoof = await rest.request<{ objectId: string }>("POST", "classes/Call", { ...lock, event: ptr("CatalystEvent", otherEvent.id), owner: userPtr(a.id) }, as(b));
  const spoofed = await rest.request<any>("GET", `classes/Call/${spoof.objectId}`, undefined, as(b));
  record("(extra) create a Call owned by the other user", spoofed.owner.objectId === b.id, `sent owner A, server stored owner ${spoofed.owner.objectId === b.id ? "B (the caller)" : "A"}`);

  // 7. Mute a Ticker globally
  const mute = await attempt(() => rest.request("PUT", `classes/Ticker/${aapl.id}`, { muted: true }, as(a)));
  const tick = await rest.request<any>("GET", `classes/Ticker/${aapl.id}`);
  record("mute a Ticker globally", !mute.allowed && tick.muted === undefined, `${mute.detail}; Ticker has no muted field (muting is per-user on WatchItem)`);

  // 8. Edit after event start (server time). Master creates a test event starting in 12 s; A locks before it.
  const startsAt = new Date(Date.now() + 12000).toISOString();
  const soon = await rest.request<{ objectId: string }>("POST", "classes/CatalystEvent", {
    ticker: ptr("Ticker", aapl.id), kind: "earnings", title: "test-cheat-starts-soon", startsAt: { __type: "Date", iso: startsAt }, session: "bmo", confirmed: true, consensus: [],
  });
  const early = await rest.request<{ objectId: string }>("POST", "classes/Call", { ...lock, event: ptr("CatalystEvent", soon.objectId) }, as(a));
  await sleep(Math.max(0, Date.parse(startsAt) - Date.now()) + 3000);
  const late = await attempt(() => rest.request("PUT", `classes/Call/${early.objectId}`, { direction: "down", conviction: 5 }, as(a)));
  const lateCreate = await attempt(() => rest.request("POST", "classes/Call", { ...lock, event: ptr("CatalystEvent", soon.objectId) }, as(b)));
  const kept = await rest.request<any>("GET", `classes/Call/${early.objectId}`, undefined, as(a));
  record("edit after event start", !late.allowed && !lateCreate.allowed && kept.direction === "up", `edit: ${late.detail}; new call after start: ${lateCreate.detail}; stored direction still "${kept.direction}"`);

  // (extra) Delete a locked call
  const del = await attempt(() => rest.request("DELETE", `classes/Call/${created.objectId}`, undefined, as(a)));
  record("(extra) delete own locked Call", !del.allowed, del.detail);
  void DAY;
} catch (e) {
  record("test ran to completion", false, e instanceof Error ? e.message : String(e));
} finally {
  const left = await cleanupTestUsers();
  record("cleanup: zero test-* users and rows remain", left.users === 0 && left.rows === 0, `${left.users} user(s), ${left.rows} row(s) (incl. test-* events)`);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(46)} ${r.how}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}
