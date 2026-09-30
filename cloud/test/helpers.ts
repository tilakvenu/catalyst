// Shared helpers for live tests against the Back4App app in cloud/.env.
// Test users are always named test-*, get random passwords that are never printed,
// and are removed (with everything they own) by cleanupTestUsers using the master key.
import { randomUUID } from "node:crypto";
import { loadEnv } from "../env.ts";
import { makeRest, ParseError } from "../rest.ts";

export const TEST_PREFIX = "test-";
export const env = loadEnv();
export const rest = makeRest(env);

export type TestUser = { id: string; username: string; email: string; sessionToken: string };

export const where = (w: unknown) => `where=${encodeURIComponent(JSON.stringify(w))}`;
export const userPtr = (id: string) => ({ __type: "Pointer", className: "_User", objectId: id });
export const ptr = (className: string, id: string) => ({ __type: "Pointer", className, objectId: id });

export async function signUp(label: string): Promise<TestUser> {
  const username = `${TEST_PREFIX}${label}-${randomUUID().slice(0, 8)}`;
  const email = `${username}@example.com`;
  const res = await rest.request<{ objectId: string; sessionToken: string }>(
    "POST",
    "users",
    { username, password: randomUUID(), email },
    { kind: "client" },
  );
  return { id: res.objectId, username, email, sessionToken: res.sessionToken };
}

export const as = (u: TestUser) => ({ kind: "client" as const, sessionToken: u.sessionToken });

/** Runs fn; returns "rejected (code)" if the server refused, or "ALLOWED" if it went through. */
export async function attempt(fn: () => Promise<unknown>): Promise<{ allowed: boolean; detail: string; value?: unknown }> {
  try {
    const value = await fn();
    return { allowed: true, detail: "ALLOWED", value };
  } catch (e) {
    if (e instanceof ParseError) return { allowed: false, detail: `rejected (${e.status} code ${e.code ?? "?"})` };
    throw e;
  }
}

const OWNED = ["CallRevision", "Call", "WatchItem"] as const;

/** Master-key cleanup: every test-* user, their rows in OWNED classes, then the users. Returns remaining counts. */
export async function cleanupTestUsers(): Promise<{ users: number; rows: number }> {
  const { results: users } = await rest.request<{ results: { objectId: string }[] }>(
    "GET",
    `classes/_User?${where({ username: { $regex: `^${TEST_PREFIX}` } })}&limit=1000&keys=objectId`,
  );
  for (const u of users) {
    for (const cls of OWNED) {
      const { results } = await rest.request<{ results: { objectId: string }[] }>(
        "GET",
        `classes/${cls}?${where({ owner: userPtr(u.objectId) })}&limit=1000&keys=objectId`,
      );
      for (const r of results) await rest.request("DELETE", `classes/${cls}/${r.objectId}`);
    }
    await rest.request("DELETE", `users/${u.objectId}`);
  }
  const left = await rest.request<{ count: number }>(
    "GET",
    `classes/_User?${where({ username: { $regex: `^${TEST_PREFIX}` } })}&count=1&limit=0`,
  );
  let rows = 0;
  for (const u of users) {
    for (const cls of OWNED) {
      const r = await rest.request<{ count: number }>("GET", `classes/${cls}?${where({ owner: userPtr(u.objectId) })}&count=1&limit=0`);
      rows += r.count;
    }
  }
  return { users: left.count, rows };
}
