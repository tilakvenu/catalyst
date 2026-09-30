// Deploy Cloud Code to Back4App with only the Application ID + Master Key from cloud/.env.
// Uses the same endpoints as Back4App's official MCP package v0.1.9 (src/fileDeployment.ts):
//   GET  {api}/deploy   current release (checksums + versions per file)
//   POST {api}/scripts  upload one cloud file: { name, content: base64 } -> { version }
//   POST {api}/deploy   new release: { parseVersion, description, checksums, userFiles }
// Like the MCP, files not in this upload are kept from the previous release.
//
//   node cloud/deploy.ts --list              list deployed cloud files (read only)
//   node cloud/deploy.ts [dir] [-m "note"]   upload every file in dir (default cloud/dist)
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CLOUD_DIR, loadEnv, redact } from "./env.ts";

const API = "https://parsecli.back4app.com/";

type DeployInfo = {
  parseVersion?: string;
  checksums?: { cloud?: Record<string, string>; public?: Record<string, string> };
  userFiles?: { cloud?: Record<string, string>; public?: Record<string, string> };
};

const env = loadEnv();

async function call<T>(method: "GET" | "POST", route: string, body?: unknown): Promise<T> {
  const res = await fetch(API + route, {
    method,
    headers: {
      "X-Parse-Application-Id": env.PARSE_APP_ID,
      "X-Parse-Master-Key": env.PARSE_MASTER_KEY,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(redact(`${method} ${route} -> ${res.status} ${text.slice(0, 300)}`, env));
  return JSON.parse(text) as T;
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listFiles(full, base);
    return name.startsWith(".") ? [] : [path.relative(base, full).split(path.sep).join("/")];
  });
}

async function list() {
  const info = await call<DeployInfo>("GET", "deploy");
  const cloud = info.checksums?.cloud ?? {};
  console.log(`Deploy endpoint reachable. parseVersion: ${info.parseVersion ?? "unknown"}`);
  console.log(`Cloud Code files deployed: ${Object.keys(cloud).length}`);
  for (const name of Object.keys(cloud).sort()) console.log(`  ${name}  md5 ${cloud[name]}  v ${info.userFiles?.cloud?.[name] ?? "?"}`);
  console.log(`Web hosting files: ${Object.keys(info.checksums?.public ?? {}).length}`);
}

async function deploy(dir: string, description: string) {
  const files = listFiles(dir);
  if (!files.includes("main.js")) throw new Error(`${dir} has no main.js; build Cloud Code first.`);
  const prev = await call<DeployInfo>("GET", "deploy");

  const checksums: Record<string, string> = {};
  const versions: Record<string, string> = {};
  for (const name of files) {
    const bytes = readFileSync(path.join(dir, name));
    const { version } = await call<{ version: string }>("POST", "scripts", { name, content: bytes.toString("base64") });
    checksums[name] = createHash("md5").update(bytes).digest("hex");
    versions[name] = version;
    console.log(`uploaded ${name} (${bytes.length} bytes)`);
  }

  const release = await call<{ releaseId?: string; releaseName?: string }>("POST", "deploy", {
    parseVersion: prev.parseVersion || "1.0.0",
    description,
    checksums: { cloud: { ...prev.checksums?.cloud, ...checksums }, public: prev.checksums?.public ?? {} },
    userFiles: { cloud: { ...prev.userFiles?.cloud, ...versions }, public: prev.userFiles?.public ?? {} },
  });
  console.log(`deployed: release ${release.releaseName ?? release.releaseId ?? "(no id returned)"} — ${files.length} file(s)`);
}

const args = process.argv.slice(2);
try {
  if (args.includes("--list")) await list();
  else {
    const m = args.indexOf("-m");
    const description = m >= 0 ? args[m + 1] : `deploy ${new Date().toISOString()}`;
    const dir = args.find((a, i) => !a.startsWith("-") && args[i - 1] !== "-m") ?? path.join(CLOUD_DIR, "dist");
    await deploy(path.resolve(dir), description);
  }
} catch (err) {
  console.error(redact(err instanceof Error ? err.message : String(err), env));
  process.exit(1);
}
