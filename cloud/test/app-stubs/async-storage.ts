// In-memory stand-in for @react-native-async-storage/async-storage (headless tests only).
const mem = new Map<string, string>();
const AsyncStorage = {
  getItem: async (k: string) => mem.get(k) ?? null,
  setItem: async (k: string, v: string) => void mem.set(k, v),
  removeItem: async (k: string) => void mem.delete(k),
  clear: async () => mem.clear(),
  getAllKeys: async () => [...mem.keys()],
};
export default AsyncStorage;
