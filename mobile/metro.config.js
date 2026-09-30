const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// The pure C67 modules live at the repo root, outside this Expo app.
// SDK 52+ auto-configures real npm workspaces; this repo is not one,
// so the root has to be watched explicitly (Expo monorepo guide).
config.watchFolders = [repoRoot];

const upstreamResolve = config.resolver.resolveRequest;
const cryptoShim = path.resolve(projectRoot, "src/data/crypto-shim.ts");
const parsePackage = `${path.sep}node_modules${path.sep}parse${path.sep}`;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Parse 8's React Native build requires Node's `crypto` for randomUUID (Parse-SDK-JS#2856, #3095).
  // Only for requests from inside the parse package, point it at the expo-crypto shim.
  if (moduleName === "crypto" && context.originModulePath.includes(parsePackage)) {
    return { type: "sourceFile", filePath: cryptoShim };
  }
  // C67 sources import their siblings with an explicit `.ts` extension.
  // Metro would otherwise look for `file.ts.ts`.
  if (moduleName.endsWith(".ts") || moduleName.endsWith(".tsx")) {
    const stripped = moduleName.replace(/\.tsx?$/, "");
    if (upstreamResolve) return upstreamResolve(context, stripped, platform);
    return context.resolveRequest(context, stripped, platform);
  }
  if (upstreamResolve) return upstreamResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

// Do not resolve packages out of the web app's node_modules.
const rootModules = path.resolve(repoRoot, "node_modules").replace(/[/\\]/g, "[/\\\\]");
config.resolver.blockList = [new RegExp(`${rootModules}/.*`)];

module.exports = config;
