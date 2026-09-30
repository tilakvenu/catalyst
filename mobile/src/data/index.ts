// Public data API for screens. Import from "src/data" only; see README.md. Rule: never fetch on focus.
export { backendConfigured } from "./parse.ts";
export { currentUser, deleteAccount, hydrateSession, signIn, signOut, signUp, useSession, type Session, type SessionUser } from "./auth.ts";
export { refresh, FOREGROUND_RESYNC_MS } from "./sync.ts";
export { addWatch, removeWatch, setHeld, setMuted, useWatchlist, type Watchlist, type WatchTarget } from "./watchlist.ts";
export { discardDraft, lockCall, LockError, saveDraft, type DraftFields, type LockErrorKind } from "./calls.ts";
export { getEvidence, useCalendar, useDesk, useRecord, useSyncState, type CalendarView, type Desk, type RecordStats } from "./hooks.ts";
export type { Draft } from "./cache.ts";
