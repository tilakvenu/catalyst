// Unit tests for the referee rules (no network).   cd cloud && npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";
import { etMs } from "../../src/lib/catalyst/calendar.ts";
import { checkLock, isObjectId, lockStamp, monthRange, resolveCall, SCORING_RULE_VERSION, type EventFacts } from "./referee.ts";

const tsla: EventFacts = { id: "ev1", kind: "earnings", startsAt: new Date(etMs(2026, 10, 29, 16, 20)).toISOString(), session: "amc", tickerId: "t1" };
const cpi: EventFacts = { id: "ev2", kind: "macro", startsAt: new Date(etMs(2026, 10, 14, 8, 30)).toISOString(), session: "bmo", macroId: "m1" };
const before = etMs(2026, 10, 20, 12, 0);
const good = { direction: "up", conviction: 4, reasoning: "Deliveries beat.", wrongIf: "Margins under 17%." };

test("a complete ticker call locks", () => assert.deepEqual(checkLock(good, tsla, before), { ok: true }));
test("missing wrong-if is incomplete", () => assert.equal((checkLock({ ...good, wrongIf: "  " }, tsla, before) as any).code, "incomplete"));
test("conviction must be a whole number 1-5", () => {
  for (const conviction of [0, 6, 2.5, "4", null]) assert.equal((checkLock({ ...good, conviction }, tsla, before) as any).code, "invalid");
});
test("direction must be up, down or flat", () => assert.equal((checkLock({ ...good, direction: "sideways" }, tsla, before) as any).code, "invalid"));
test("macro call needs a call target", () => {
  assert.equal((checkLock(good, cpi, etMs(2026, 10, 1, 12)) as any).code, "macro-target");
  assert.deepEqual(checkLock({ ...good, callTargetId: "spy" }, cpi, etMs(2026, 10, 1, 12)), { ok: true });
});
test("no lock at or after event start", () => {
  assert.equal((checkLock(good, tsla, etMs(2026, 10, 29, 16, 20)) as any).code, "started");
});

test("evidence is only headlines first seen at or before lock", () => {
  const now = etMs(2026, 10, 20, 12, 0);
  const s = lockStamp(now, [
    { id: "a", firstSeenAt: new Date(now - 1000).toISOString() },
    { id: "b", firstSeenAt: new Date(now).toISOString() },
    { id: "c", firstSeenAt: new Date(now + 1000).toISOString() },
  ]);
  assert.deepEqual(s.evidenceIds, ["a", "b"]);
  assert.equal(s.lockedAt, new Date(now).toISOString());
  assert.equal(s.scoringRuleVersion, SCORING_RULE_VERSION);
});

const locked = { ...good, direction: "up" as const, lockedAt: new Date(before).toISOString(), hasOutcome: false };
const printed = { ...tsla, printMovePct: 3.1, typicalMovePct: 2.0 };

test("AMC resolves at the NEXT session close, not the same night", () => {
  assert.equal(resolveCall(locked, printed, etMs(2026, 10, 29, 20, 0)).action, "none");
  assert.equal(resolveCall(locked, printed, etMs(2026, 10, 30, 15, 59)).action, "none");
  const r = resolveCall(locked, printed, etMs(2026, 10, 30, 16, 0));
  assert.equal(r.action, "score");
  if (r.action === "score") assert.deepEqual([r.outcome.actualDirection, r.outcome.result, r.outcome.actualMovePct], ["up", "called", 3.1]);
});
test("BMO resolves at the same session close", () => {
  const bmo = { ...printed, session: "bmo" as const, startsAt: new Date(etMs(2026, 10, 29, 8, 30)).toISOString() };
  assert.equal(resolveCall(locked, bmo, etMs(2026, 10, 29, 15, 59)).action, "none");
  assert.equal(resolveCall(locked, bmo, etMs(2026, 10, 29, 16, 0)).action, "score");
});
test("a move inside the typical band is flat, so an up call misses", () => {
  const r = resolveCall(locked, { ...printed, printMovePct: 1.5 }, etMs(2026, 11, 2, 17, 0));
  assert.ok(r.action === "score" && r.outcome.actualDirection === "flat" && r.outcome.result === "missed");
});
test("no print or no typical band stays pending (never marked unresolvable)", () => {
  assert.equal(resolveCall(locked, { ...tsla, printMovePct: 3.1 }, etMs(2026, 11, 20, 17)).action, "none");
  assert.equal(resolveCall(locked, { ...tsla, typicalMovePct: 2 }, etMs(2026, 11, 20, 17)).action, "none");
});
test("already scored calls are left alone", () => {
  assert.equal(resolveCall({ ...locked, hasOutcome: true }, printed, etMs(2026, 11, 2, 17)).action, "none");
});

test("month range is New York midnight to midnight across the DST change", () => {
  const [start, end] = monthRange("2026-11")!;
  assert.equal(new Date(start).toISOString(), "2026-11-01T04:00:00.000Z"); // EDT
  assert.equal(new Date(end).toISOString(), "2026-12-01T05:00:00.000Z"); // EST
  assert.equal(monthRange("2026-13"), null);
  assert.equal(monthRange("26-11"), null);
});
test("object ids", () => {
  assert.ok(isObjectId("a1B2c3D4e5"));
  assert.ok(!isObjectId("x"));
  assert.ok(!isObjectId({ $ne: null }));
});

test("en-CA shim (forced) keeps the C67 calendar correct", async () => {
  const { installEnCaShim, enCaSample } = await import("./intl-shim.ts");
  const { nyDateKey, isTradingDay } = await import("../../src/lib/catalyst/calendar.ts");
  const before = [nyDateKey(Date.UTC(2026, 2, 9, 2, 0)), isTradingDay(etMs(2026, 11, 26, 12)), isTradingDay(etMs(2026, 11, 27, 12))];
  assert.equal(installEnCaShim(true), true);
  assert.equal(enCaSample(), "2026-01-02");
  assert.deepEqual([nyDateKey(Date.UTC(2026, 2, 9, 2, 0)), isTradingDay(etMs(2026, 11, 26, 12)), isTradingDay(etMs(2026, 11, 27, 12))], before);
  assert.deepEqual(before, ["2026-03-08", false, true]);
  // Non en-CA and time-of-day formats are untouched.
  assert.equal(new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", hourCycle: "h23" }).format(new Date(Date.UTC(2026, 0, 1, 7))), "07");
});
