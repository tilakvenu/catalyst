// Minimal react-native stand-in for headless tests: only what mobile/src/data touches outside components.
export const AppState = { currentState: "active", addEventListener: () => ({ remove() {} }) };
