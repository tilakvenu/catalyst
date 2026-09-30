// Runs a headless script against the real mobile/src/data code. Swaps only platform pieces:
// parse/react-native.js -> parse/node, AsyncStorage -> in-memory, react-native -> AppState stub.
//   node run-app.mjs test/app-layer.ts
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cloudDir = path.dirname(fileURLToPath(import.meta.url));
const mobileModules = path.resolve(cloudDir, "../mobile/node_modules");
const [entry, ...args] = process.argv.slice(2);
const out = path.join(cloudDir, `.run-${path.basename(entry, ".ts")}.mjs`);
await build({
  entryPoints: [path.resolve(cloudDir, entry)],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
  nodePaths: [mobileModules],
  alias: {
    "parse/react-native.js": path.join(mobileModules, "parse/node.js"),
    "@react-native-async-storage/async-storage": path.join(cloudDir, "test/app-stubs/async-storage.ts"),
    "react-native": path.join(cloudDir, "test/app-stubs/react-native.ts"),
  },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
const r = spawnSync(process.execPath, [out, ...args], { stdio: "inherit" });
rmSync(out, { force: true });
process.exit(r.status ?? 1);
