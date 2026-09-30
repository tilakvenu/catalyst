// Must be the first import: parse.ts reads EXPO_PUBLIC_ values when it is evaluated.
import path from "node:path";
import { fileURLToPath } from "node:url";
process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../mobile/.env"));
