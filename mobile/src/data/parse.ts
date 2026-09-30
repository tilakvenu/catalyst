// Parse client, set up the way the Parse JS SDK README documents for React Native:
// parse/react-native.js + Parse.setAsyncStorage(AsyncStorage). The same build runs on web, where
// AsyncStorage is backed by localStorage. Keys come from EXPO_PUBLIC_ variables in mobile/.env;
// only the Application ID and JavaScript key, never the master key.
import AsyncStorage from "@react-native-async-storage/async-storage";
import Parse from "parse/react-native.js";

const APP_ID = process.env.EXPO_PUBLIC_PARSE_APP_ID;
const JS_KEY = process.env.EXPO_PUBLIC_PARSE_JS_KEY;
const SERVER_URL = process.env.EXPO_PUBLIC_PARSE_SERVER_URL;

export const backendConfigured = Boolean(APP_ID && JS_KEY && SERVER_URL);

Parse.setAsyncStorage(AsyncStorage);
if (backendConfigured) {
  Parse.initialize(APP_ID!, JS_KEY!);
  Parse.serverURL = SERVER_URL!;
}

// ---------- session request counter (debug screen) ----------
// Every request the SDK makes goes through RESTController.request, so counting there counts
// exactly what reaches Back4App from this app session.

let requestCount = 0;
const counterListeners = new Set<() => void>();

const rest = Parse.CoreManager.getRESTController();
Parse.CoreManager.setRESTController({
  ...rest,
  request(...args: Parameters<typeof rest.request>) {
    requestCount += 1;
    counterListeners.forEach((fn) => fn());
    return rest.request(...args);
  },
});

export const getRequestCount = () => requestCount;
export function subscribeRequestCount(fn: () => void) {
  counterListeners.add(fn);
  return () => {
    counterListeners.delete(fn);
  };
}

/** Parse error code for "could not reach the server". */
export const CONNECTION_FAILED = Parse.Error.CONNECTION_FAILED;

export { Parse };
