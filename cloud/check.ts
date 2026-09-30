// Connection check: which cloud/.env lines are filled, then /serverInfo with the master key,
// then any class on the server that schema.ts does not define (built-ins starting with "_" are ignored).
// Prints only "set"/"empty", "connected", the Parse Server version, and class names. Never a key.
import { envStatus, loadEnv } from "./env.ts";
import { makeRest } from "./rest.ts";
import { SCHEMA } from "./schema.ts";

for (const { name, set } of envStatus()) console.log(`${name.padEnd(20)} ${set ? "set" : "empty"}`);

const { request } = makeRest(loadEnv());
const info = await request<{ parseServerVersion?: string }>("GET", "serverInfo");
console.log("connected");
console.log(`Parse Server version: ${info.parseServerVersion ?? "unknown"}`);

const { results } = await request<{ results: { className: string }[] }>("GET", "schemas");
const unknown = results.map((s) => s.className).filter((c) => !c.startsWith("_") && !(c in SCHEMA)).sort();
console.log(unknown.length ? `classes not in schema.ts: ${unknown.join(", ")}` : "classes not in schema.ts: none");
