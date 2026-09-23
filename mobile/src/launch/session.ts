/**
 * In-memory cold-launch flag. A screen remount must not replay the animation.
 * Replay is an explicit call from About.
 */

let played = false;
const listeners = new Set<() => void>();

export function hasPlayedLaunch(): boolean {
  return played;
}

export function markLaunchPlayed(): void {
  played = true;
}

export function subscribeReplay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function requestReplay(): void {
  played = false;
  for (const listener of listeners) listener();
}

export function resetLaunchSession(): void {
  played = false;
  listeners.clear();
}
