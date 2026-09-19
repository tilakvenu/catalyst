import type { TabId } from "./types.ts";

/** A tab is an activity. Watch is a push, never a tab. */
export const TAB_BAR_ITEMS: { id: TabId; label: string }[] = [
  { id: "catalyst", label: "Catalyst" },
  { id: "calendar", label: "Calendar" },
  { id: "tape", label: "Tape" },
  { id: "record", label: "Record" },
];

export const DEFAULT_TAB: TabId = "catalyst";
