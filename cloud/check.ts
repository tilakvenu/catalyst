// Connection check: which cloud/.env lines are filled, then /serverInfo with the master key.
// Prints only "set"/"empty", "connected", and the Parse Server version. Never a key.
import { envStatus, loadEnv } from "./env.ts";
import { makeRest } from "./rest.ts";

for (const { name, set } of envStatus()) console.log(`${name.padEnd(20)} ${set ? "set" : "empty"}`);

const { request } = makeRest(loadEnv());
const info = await request<{ parseServerVersion?: string }>("GET", "serverInfo");
console.log("connected");
console.log(`Parse Server version: ${info.parseServerVersion ?? "unknown"}`);
