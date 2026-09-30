// Runs a TypeScript entry that imports the C67 modules (whose imports omit ".ts", which plain Node
// cannot resolve). Bundles it next to this file so cloud/env.ts still finds cloud/.env, runs it, deletes it.
//   node run.mjs seed.ts [args]
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cloudDir = path.dirname(fileURLToPath(import.meta.url));
const [entry, ...args] = process.argv.slice(2);
if (!entry) {
  console.error("usage: node run.mjs <entry.ts> [args]");
  process.exit(2);
}
const out = path.join(cloudDir, `.run-${path.basename(entry, ".ts")}.mjs`);
await build({
  entryPoints: [path.resolve(cloudDir, entry)],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  logLevel: "warning",
});
const r = spawnSync(process.execPath, [out, ...args], { stdio: "inherit" });
rmSync(out, { force: true });
process.exit(r.status ?? 1);
