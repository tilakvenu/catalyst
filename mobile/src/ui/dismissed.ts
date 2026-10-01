// "Result ready" heroes the user has already opened. Device-only UI state.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";

const KEY = "catalyst.seenResults.v1";
let seen = new Set<string>();
const listeners = new Set<() => void>();
AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (raw) {
      seen = new Set(JSON.parse(raw) as string[]);
      listeners.forEach((l) => l());
    }
  })
  .catch(() => {});

export function markResultSeen(entryId: string) {
  if (seen.has(entryId)) return;
  seen = new Set([...seen, entryId]);
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify([...seen].slice(-200))).catch(() => {});
}

export function useSeenResults(): Set<string> {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => seen,
    () => seen,
  );
}
