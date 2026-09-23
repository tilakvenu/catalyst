/**
 * Pure C67 logic, imported from the frozen web app. Do not copy.
 * store.ts and news-fetch.ts stay out — they use localStorage and fetch.
 */
export { SCORING_RULE_VERSION } from "../../../src/lib/catalyst/build.ts";
export {
  FLAT_BAND_MULTIPLE,
  classifyMove,
  isCalibrationScored,
  isPending,
  isScored,
  isUnresolvable,
  typicalSessionPct,
} from "../../../src/lib/catalyst/scoring.ts";
export { canLock, lockCall, mutateLocked, scoredVersion } from "../../../src/lib/catalyst/lock.ts";
export { packEvidence, unpackEvidence, splitEvidence, snapshotIds } from "../../../src/lib/catalyst/evidence.ts";
export { isTradingDay, nyParts, upcomingSessionIso } from "../../../src/lib/catalyst/calendar.ts";
export { isResolvableAt } from "../../../src/lib/catalyst/session.ts";
export { tryResolve } from "../../../src/lib/catalyst/resolve.ts";
export { adjustImpactForVol, impactColor, impactLabel } from "../../../src/lib/catalyst/impact.ts";
export type {
  CatalystEvent,
  Direction,
  Headline,
  JournalEntry,
  Ticker,
} from "../../../src/lib/catalyst/types.ts";
