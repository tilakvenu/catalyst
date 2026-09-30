// Pre-commit guard: fails if any real key value from cloud/.env or mobile/.env appears in staged changes.
// Prints counts only, never a value.   node cloud/scan-keys.ts
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { CLOUD_DIR } from "./env.ts";

const root = path.dirname(CLOUD_DIR);
for (const f of ["cloud/.env", "mobile/.env"]) if (existsSync(path.join(root, f))) process.loadEnvFile(path.join(root, f));
const names = ["PARSE_APP_ID", "PARSE_JS_KEY", "PARSE_MASTER_KEY", "EXPO_PUBLIC_PARSE_APP_ID", "EXPO_PUBLIC_PARSE_JS_KEY"];
const values = names.map((n) => process.env[n]?.trim()).filter((v): v is string => !!v && v.length >= 8);
const staged = execSync("git diff --cached", { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString();
const hits = values.filter((v) => staged.includes(v)).length;
if (hits) {
  console.error(`key scan: ${hits} key value(s) found in staged changes. Unstage them before committing.`);
  process.exit(1);
}
console.log(`key scan: clean (${values.length} values checked)`);
