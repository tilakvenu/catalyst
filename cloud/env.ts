// Loads cloud/.env for local scripts. Never print the values this returns.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLOUD_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ENV_FILE = path.join(CLOUD_DIR, ".env");

const REQUIRED = ["PARSE_APP_ID", "PARSE_JS_KEY", "PARSE_MASTER_KEY", "PARSE_SERVER_URL"] as const;
type Key = (typeof REQUIRED)[number];
export type CloudEnv = Record<Key, string>;

/** "set" / "empty" for every KEY= line in cloud/.env, in file order. Values are never returned. */
export function envStatus(): Array<{ name: string; set: boolean }> {
  if (!existsSync(ENV_FILE)) return [];
  return readFileSync(ENV_FILE, "utf8")
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ name: m[1], set: m[2].trim().length > 0 }));
}

/** Replace any key value from cloud/.env that appears in text (belt and braces for error output). */
export function redact(text: string, env: CloudEnv): string {
  let out = text;
  for (const k of ["PARSE_MASTER_KEY", "PARSE_JS_KEY", "PARSE_APP_ID"] as const) {
    if (env[k]) out = out.split(env[k]).join(`<${k}>`);
  }
  return out;
}

export function loadEnv(): CloudEnv {
  if (!existsSync(ENV_FILE)) {
    throw new Error("cloud/.env not found. Copy cloud/.env.example to cloud/.env and fill it in.");
  }
  process.loadEnvFile(ENV_FILE);
  const missing = REQUIRED.filter((k) => !process.env[k]?.trim());
  if (missing.length) throw new Error(`cloud/.env is missing: ${missing.join(", ")}`);
  const env = Object.fromEntries(REQUIRED.map((k) => [k, process.env[k]!.trim()])) as CloudEnv;
  if (!env.PARSE_SERVER_URL.endsWith("/")) env.PARSE_SERVER_URL += "/";
  return env;
}
