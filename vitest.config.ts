import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
  test: {
    include: ["src/lib/catalyst/**/*.test.ts", "src/components/catalyst/**/*.test.ts", "mobile/src/**/*.test.ts"],
    environment: "node",
  },
});
