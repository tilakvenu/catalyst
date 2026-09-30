// Live privacy test (schema v2):
//  1. user B fetching user A by id must not see A's email or authData; A still sees their own email
//  2. owner pointer permissions hide a WatchItem from other users even when the row has no ACL
// Cleans up every test-* user and their rows at the end.   node cloud/test/privacy.ts
import { as, attempt, cleanupTestUsers, rest, signUp, userPtr } from "./helpers.ts";

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail });

try {
  const a = await signUp("privacy-a");
  const b = await signUp("privacy-b");

  // Default: Parse 6.2+ gives new users an owner-only ACL, so B cannot load A's row at all.
  const byDefault = await attempt(() => rest.request<Record<string, unknown>>("GET", `users/${a.id}`, undefined, as(b)));
  const leaked = byDefault.allowed && "email" in (byDefault.value as object);
  check("B fetching A by id (default ACL) does not see A's email", !leaked, byDefault.allowed ? (leaked ? "email visible" : "row visible, email hidden") : byDefault.detail);

  // Second lock: even if A's row were public (e.g. a future public profile), protectedFields must hide email/authData.
  await rest.request("PUT", `users/${a.id}`, { ACL: { "*": { read: true }, [a.id]: { read: true, write: true } } }, as(a));
  const bSeesA = await rest.request<Record<string, unknown>>("GET", `users/${a.id}`, undefined, as(b));
  check("B fetching A's PUBLIC row does not see A's email", !("email" in bSeesA), "email" in bSeesA ? "email visible" : "email hidden");
  check("B fetching A's PUBLIC row does not see A's authData", !("authData" in bSeesA), "authData" in bSeesA ? "authData visible" : "authData hidden");
  const aSeesA = await rest.request<Record<string, unknown>>("GET", `users/${a.id}`, undefined, as(a));
  check("A still sees their own email", aSeesA.email === a.email, aSeesA.email === a.email ? "own email visible" : "own email missing");

  // No ACL on purpose: only the pointer permission stands between B and this row.
  const item = await rest.request<{ objectId: string }>("POST", "classes/WatchItem", { owner: userPtr(a.id), held: true, muted: false }, as(a));
  const bFind = await rest.request<{ results: unknown[] }>("GET", "classes/WatchItem", undefined, as(b));
  check("B's WatchItem query returns none of A's rows", bFind.results.length === 0, `B sees ${bFind.results.length} row(s)`);
  const bGet = await attempt(() => rest.request("GET", `classes/WatchItem/${item.objectId}`, undefined, as(b)));
  check("B fetching A's WatchItem by id is refused", !bGet.allowed, bGet.detail);
  const aFind = await rest.request<{ results: unknown[] }>("GET", "classes/WatchItem", undefined, as(a));
  check("A still sees their own WatchItem", aFind.results.length === 1, `A sees ${aFind.results.length} row(s)`);
} catch (e) {
  check("test ran to completion", false, e instanceof Error ? e.message : String(e));
} finally {
  const left = await cleanupTestUsers();
  check("cleanup: zero test-* users and rows remain", left.users === 0 && left.rows === 0, `${left.users} user(s), ${left.rows} row(s) left`);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}  — ${r.detail}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}
