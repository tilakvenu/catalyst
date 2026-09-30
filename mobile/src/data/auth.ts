// Accounts. The signed-in user comes from Parse's local session (AsyncStorage), so opening the app
// costs no login request. Username is the email address.
import { useSyncExternalStore } from "react";
import type { DeleteAccountResult } from "../../../cloud/src/dto.ts";
import { clearCache, loadCache } from "./cache.ts";
import { backendConfigured, Parse } from "./parse.ts";
import { bootstrap, startSyncPolicy } from "./sync.ts";

export interface SessionUser {
  id: string;
  email: string;
}

export type Session =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: SessionUser };

let session: Session = { status: "loading" };
const listeners = new Set<() => void>();
const setSession = (s: Session) => {
  session = s;
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const getSession = () => session;

export const useSession = (): Session => useSyncExternalStore(subscribe, getSession, getSession);

/** The signed-in user from memory. Never a network call. */
export function currentUser(): SessionUser | null {
  return session.status === "signedIn" ? session.user : null;
}

const toSessionUser = (u: Parse.User): SessionUser => ({ id: u.id!, email: (u.getEmail() ?? u.getUsername() ?? "") as string });

let hydrating: Promise<void> | null = null;

/** App start: read Parse's stored session and this user's cache from the device, then start syncing. */
export function hydrateSession(): Promise<void> {
  if (hydrating) return hydrating;
  hydrating = (async () => {
    if (!backendConfigured) {
      setSession({ status: "unconfigured" });
      return;
    }
    const user = await Parse.User.currentAsync().catch(() => null);
    if (user?.id) {
      await loadCache(user.id);
      setSession({ status: "signedIn", user: toSessionUser(user) });
    } else {
      setSession({ status: "signedOut" });
    }
    startSyncPolicy();
  })();
  return hydrating;
}

async function afterSignIn(user: Parse.User) {
  await loadCache(user.id!);
  setSession({ status: "signedIn", user: toSessionUser(user) });
  await bootstrap("sign-in").catch(() => {
    // Signed in, but the first sync failed; the Backend check screen shows the error, pull to retry.
  });
}

const cleanEmail = (email: string) => email.trim().toLowerCase();

export async function signUp(email: string, password: string): Promise<SessionUser> {
  const user = new Parse.User();
  user.set("username", cleanEmail(email));
  user.set("email", cleanEmail(email));
  user.set("password", password);
  await user.signUp();
  await afterSignIn(user);
  return toSessionUser(user);
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const user = await Parse.User.logIn(cleanEmail(email), password);
  await afterSignIn(user);
  return toSessionUser(user);
}

/** One request (revokes the session on the server), then forgets this user's cache on this device. */
export async function signOut(): Promise<void> {
  try {
    await Parse.User.logOut();
  } finally {
    await clearCache();
    setSession({ status: "signedOut" });
  }
}

/** Server deletes the user's calls, revisions, watch items, sessions and account; then the device forgets them. */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const result = (await Parse.Cloud.run("deleteAccount")) as DeleteAccountResult;
  // The server already revoked the session, so clear it locally without another request.
  await Parse.CoreManager.getUserController().removeUserFromDisk();
  await clearCache();
  setSession({ status: "signedOut" });
  return result;
}
