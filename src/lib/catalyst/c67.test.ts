import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { C5_SHA, BUILD_NAME, SCORING_RULE_VERSION } from "./build.ts";
import { packEvidence, splitEvidence, unpackEvidence, snapshotIds } from "./evidence.ts";
import { parseGrokRank, GROK_RANK_SYSTEM } from "./grok-rank.ts";
import { canLock, lockCall, mutateLocked, scoredVersion } from "./lock.ts";
import { classifyMove, FLAT_BAND_MULTIPLE, isCalibrationScored, isPending, isScored, isUnresolvable } from "./scoring.ts";
import { isResolvableAt } from "./session.ts";
import { isTradingDay, nyParts, upcomingSessionIso } from "./calendar.ts";
import type { CatalystEvent, Headline, JournalEntry } from "./types.ts";
import { isEntryComplete } from "./types.ts";

const C5 = "ced85b4cbf70fe48949b2e8fbe7b2ca213d7d4e4";

function event(p: Partial<CatalystEvent> & Pick<CatalystEvent, "id" | "startsAt" | "session">): CatalystEvent {
  return {
    kind: "earnings",
    title: "Print",
    confirmed: true,
    description: "",
    impact: [],
    notify: false,
    ...p,
  };
}

function entry(p: Partial<JournalEntry> & Pick<JournalEntry, "id" | "eventId">): JournalEntry {
  return {
    text: "why",
    sentiment: "bullish",
    direction: "up",
    conviction: 4,
    reasoning: "why this prints",
    invalidation: "wrong if X",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...p,
  };
}

describe("C67 version", () => {
  it("identifies Catalyst C67 and the preserved C5 SHA", () => {
    assert.equal(BUILD_NAME, "Catalyst C67");
    assert.equal(C5_SHA, C5);
  });
});

describe("C67 schema budget", () => {
  it("types.ts adds the five C67 fields plus UNRESOLVABLE and no other JournalEntry/Headline keys", () => {
    const src = readFileSync(new URL("./types.ts", import.meta.url), "utf8");
    const journal = src.slice(src.indexOf("export interface JournalEntry"), src.indexOf("export interface QuoteCache"));
    const headline = src.slice(src.indexOf("export interface Headline"), src.indexOf("export interface JournalEntry"));
    const addedJournal = ["lockedAt", "callTarget", "evidenceSnapshot", "scoringRuleVersion", "state"];
    for (const f of addedJournal) assert.match(journal, new RegExp(`\\b${f}\\b`));
    assert.match(src, /unresolvable/);
    assert.match(headline, /firstSeenAt/);
    const forbidden = ["unresolvableReason", "revisionOf", "frozenHeadlines", "yieldTarget", "leaderboard"];
    for (const f of forbidden) {
      assert.equal(journal.includes(f), false, f);
    }
  });

  it("git diff vs C5 on types.ts does not add extra data-model fields", () => {
    const diff = execSync(`git diff ${C5} -- src/lib/catalyst/types.ts`, { encoding: "utf8" });
    const added = diff
      .split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");
    for (const f of ["lockedAt", "callTarget", "evidenceSnapshot", "scoringRuleVersion", "firstSeenAt", "unresolvable"]) {
      assert.match(added, new RegExp(f));
    }
    assert.doesNotMatch(added, /leaderboard|yieldTarget|relatedTicker|portfolio/);
  });
});

describe("C67 vendors", () => {
  it("introduces no new vendor hostname in src/", () => {
    const hosts = execSync(`git grep -hE 'https?://[a-zA-Z0-9.-]+' -- src || true`, { encoding: "utf8" });
    const c5 = execSync(`git grep -hE 'https?://[a-zA-Z0-9.-]+' ${C5} -- src || true`, { encoding: "utf8" });
    const grab = (s: string) => new Set([...s.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)].map((m) => m[1]!));
    const extra = [...grab(hosts)].filter((h) => !grab(c5).has(h));
    const allow = new Set(["api.x.ai", "auth.grok.me", "grok.com", "grok.me"]);
    for (const h of extra) {
      assert.ok(allow.has(h) || h.endsWith(".grok.com") || h.endsWith(".grok.me"), `new host ${h}`);
    }
  });
});

describe("C67 visual tokens", () => {
  it("does not change color tokens, radii, or type-scale in styles.css vs C5 except --impact-high/--impact-med", () => {
    const diff = execSync(`git diff ${C5} -- src/styles.css`, { encoding: "utf8" });
    const changed = diff
      .split("\n")
      .filter((l) => (l.startsWith("+") || l.startsWith("-")) && !l.startsWith("+++") && !l.startsWith("---"));
    const token = changed.filter((l) => /--color-|--radius-|--font-|text-\[[0-9]+px\]/.test(l));
    assert.deepEqual(token, []);
    const added = changed.filter((l) => l.startsWith("+"));
    const extraVars = added
      .map((l) => l.match(/--[a-z0-9-]+/g) ?? [])
      .flat()
      .filter((v) => v.startsWith("--impact") || v.startsWith("--color-") || v.startsWith("--radius-") || v.startsWith("--font-"));
    for (const v of extraVars) {
      assert.ok(v === "--impact-high" || v === "--impact-med" || !v.startsWith("--impact"), v);
    }
  });
});

describe("C67 lock integrity", () => {
  const nvda = event({
    id: "nvda-earn",
    tickerId: "nvda",
    startsAt: "2026-09-22T16:20:00-04:00",
    session: "amc",
  });
  const tape: Headline[] = [
    {
      id: "h1",
      tickerId: "nvda",
      title: "Street raises NVDA target",
      source: "Reuters",
      publishedAt: "2026-09-19T14:48:00.000Z",
      firstSeenAt: "2026-09-19T14:50:00.000Z",
    },
  ];

  it("locking writes lockedAt and a non-empty evidenceSnapshot", () => {
    const draft = entry({ id: "e1", eventId: "nvda-earn" });
    const result = lockCall({
      existing: draft,
      event: nvda,
      headlines: tape,
      now: Date.parse("2026-09-20T12:00:00-04:00"),
      patch: {},
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.entry.lockedAt);
    assert.ok((result.entry.evidenceSnapshot ?? []).length > 0);
    assert.equal(result.entry.scoringRuleVersion, SCORING_RULE_VERSION);
    assert.ok(snapshotIds(result.entry.evidenceSnapshot).includes("h1"));
  });

  it("a headline removed from the store still renders under KNOWN WHEN YOU CALLED", () => {
    const snap = packEvidence(tape);
    const locked = entry({
      id: "e1",
      eventId: "nvda-earn",
      lockedAt: "2026-09-20T15:12:00.000Z",
      evidenceSnapshot: snap,
    });
    const { known } = splitEvidence(locked, [], nvda);
    assert.equal(known.length, 1);
    assert.equal(known[0]!.title, "Street raises NVDA target");
    assert.equal(known[0]!.source, "Reuters");
  });

  it("a headline with firstSeenAt > lockedAt renders under AFTER YOUR CALL", () => {
    const snap = packEvidence(tape);
    const locked = entry({
      id: "e1",
      eventId: "nvda-earn",
      lockedAt: "2026-09-20T15:12:00.000Z",
      evidenceSnapshot: snap,
    });
    const later: Headline = {
      id: "h-late",
      tickerId: "nvda",
      title: "Company 8-K after the lock",
      source: "SEC",
      publishedAt: "2026-09-20T16:06:00.000Z",
      firstSeenAt: "2026-09-20T16:06:00.000Z",
    };
    const { after } = splitEvidence(locked, [later], nvda);
    assert.equal(after.length, 1);
    assert.equal(after[0]!.id, "h-late");
  });

  it("a locked entry is not mutated after event start; a revision is created instead", () => {
    const locked = entry({
      id: "e1",
      eventId: "nvda-earn",
      lockedAt: "2026-09-20T15:12:00.000Z",
      reasoning: "original thesis",
    });
    const started = Date.parse(nvda.startsAt) + 1000;
    const { current, revision } = mutateLocked({
      current: locked,
      event: nvda,
      patch: { reasoning: "hindsight rewrite" },
      now: started,
      headlines: tape,
    });
    assert.equal(current.reasoning, "original thesis");
    assert.equal(current.id, "e1");
    assert.ok(revision);
    assert.equal(revision!.reasoning, "hindsight rewrite");
    assert.notEqual(revision!.id, "e1");
    const scored = scoredVersion([current, revision!], nvda);
    assert.equal(scored?.id, "e1");
  });

  it("a pre-event re-lock creates a revision and does not overwrite", () => {
    const draft = entry({ id: "e1", eventId: "nvda-earn", reasoning: "first lock" });
    const first = lockCall({
      existing: draft,
      event: nvda,
      headlines: tape,
      now: Date.parse("2026-09-20T12:00:00-04:00"),
      patch: {},
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = lockCall({
      existing: first.entry,
      event: nvda,
      headlines: tape,
      now: Date.parse("2026-09-21T09:00:00-04:00"),
      patch: { reasoning: "final pre-event lock" },
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.ok(second.previous);
    assert.equal(second.previous!.id, first.entry.id);
    assert.equal(second.previous!.reasoning, "first lock");
    assert.notEqual(second.entry.id, first.entry.id);
    assert.equal(second.entry.reasoning, "final pre-event lock");
    assert.ok(second.entry.lockedAt);
  });

  it("the scored version is the FINAL pre-event lock", () => {
    const first = lockCall({
      existing: entry({ id: "e1", eventId: "nvda-earn", reasoning: "v1" }),
      event: nvda,
      headlines: tape,
      now: Date.parse("2026-09-20T12:00:00-04:00"),
      patch: {},
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = lockCall({
      existing: first.entry,
      event: nvda,
      headlines: tape,
      now: Date.parse("2026-09-21T10:00:00-04:00"),
      patch: { reasoning: "v2 final" },
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    const post = mutateLocked({
      current: second.entry,
      event: nvda,
      patch: { reasoning: "after the print" },
      now: Date.parse(nvda.startsAt) + 60_000,
      headlines: tape,
    });
    const scored = scoredVersion([first.entry, second.entry, post.revision!], nvda);
    assert.equal(scored?.id, second.entry.id);
    assert.equal(scored?.reasoning, "v2 final");
    assert.equal(post.current.reasoning, "v2 final");
    assert.equal(post.revision?.reasoning, "after the print");
  });

  it("an incomplete entry never appears in any accuracy denominator", () => {
    const incomplete = entry({
      id: "e2",
      eventId: "nvda-earn",
      conviction: null,
      actualDirection: "up",
      actualMovePct: 3,
    });
    assert.equal(isEntryComplete(incomplete), false);
    assert.equal(isScored(incomplete), false);
    assert.equal(isCalibrationScored(incomplete), false);
    assert.equal(isPending(incomplete), true);
  });

  it("an UNRESOLVABLE entry never appears in any accuracy denominator", () => {
    const row = entry({
      id: "e3",
      eventId: "nvda-earn",
      lockedAt: "2026-09-20T15:12:00.000Z",
      state: "unresolvable",
      actualDirection: "up",
      actualMovePct: 3,
    });
    assert.equal(isUnresolvable(row), true);
    assert.equal(isScored(row), false);
    assert.equal(isPending(row), false);
  });

  it("a macro entry without callTarget cannot be locked", () => {
    const cpi = event({
      id: "cpi-soon",
      kind: "macro",
      macroId: "cpi",
      startsAt: "2026-09-21T08:30:00-04:00",
      session: "bmo",
    });
    const draft = entry({ id: "e4", eventId: "cpi-soon", callTarget: undefined });
    const gate = canLock(draft, cpi);
    assert.equal(gate.ok, false);
    if (gate.ok) return;
    assert.equal(gate.reason, "macro-target");
    const locked = lockCall({
      existing: draft,
      event: cpi,
      headlines: [],
      now: Date.parse("2026-09-18T12:00:00-04:00"),
      patch: {},
    });
    assert.equal(locked.ok, false);
  });
});

describe("C67 scoring", () => {
  it("FLAT_BAND_MULTIPLE is a single exported named constant", () => {
    assert.equal(FLAT_BAND_MULTIPLE, 1.0);
  });

  it("classification matches the 16b formula for +2σ, −2σ, and 0", () => {
    const typical = 1.8;
    assert.equal(classifyMove(2 * typical, typical), "up");
    assert.equal(classifyMove(-2 * typical, typical), "down");
    assert.equal(classifyMove(0, typical), "flat");
    assert.equal(classifyMove(typical * 0.99, typical), "flat");
    assert.equal(classifyMove(typical, typical), "up");
  });

  it("an AMC event is not resolvable before the next session's close", () => {
    const amc = "2026-09-18T16:20:00-04:00";
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-09-19T12:00:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-09-21T10:00:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-09-21T16:05:00-04:00")), true);
  });

  it("a BMO event is resolvable at the same session's close", () => {
    const bmo = "2026-09-22T08:00:00-04:00";
    assert.equal(isResolvableAt(bmo, "bmo", Date.parse("2026-09-22T10:00:00-04:00")), false);
    assert.equal(isResolvableAt(bmo, "bmo", Date.parse("2026-09-22T16:05:00-04:00")), true);
  });

  it("Friday AMC is not resolvable on Saturday — next session is Monday", () => {
    const amc = "2026-09-18T16:20:00-04:00";
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-09-19T16:05:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-09-21T16:05:00-04:00")), true);
  });

  it("Thursday AMC before Good Friday 2026 resolves Monday, not Friday", () => {
    const amc = "2026-04-02T16:20:00-04:00";
    assert.equal(isTradingDay(Date.parse("2026-04-03T12:00:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-04-03T16:05:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-04-06T10:00:00-04:00")), false);
    assert.equal(isResolvableAt(amc, "amc", Date.parse("2026-04-06T16:05:00-04:00")), true);
  });

  it("a Saturday clock does not mint a BMO CPI print on the weekend", () => {
    const sat = Date.parse("2026-09-19T04:52:00-04:00");
    const iso = upcomingSessionIso(sat, "bmo", 2 * 3600000);
    const ms = Date.parse(iso);
    assert.equal(isTradingDay(ms), true);
    const p = nyParts(ms);
    assert.notEqual(p.weekday, "Sat");
    assert.notEqual(p.weekday, "Sun");
    assert.equal(p.hour, 8);
    assert.equal(p.minute, 30);
  });

  it("entries without scoringRuleVersion are excluded from calibration scoring", () => {
    const pre = entry({
      id: "pre",
      eventId: "msft-past",
      actualDirection: "up",
      actualMovePct: 3.8,
      actualMoveDate: "2026-09-01T00:00:00.000Z",
    });
    const post = entry({
      id: "post",
      eventId: "aapl-past",
      scoringRuleVersion: 1,
      actualDirection: "up",
      actualMovePct: 2.1,
      actualMoveDate: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(isScored(pre), true);
    assert.equal(isCalibrationScored(pre), false);
    assert.equal(isCalibrationScored(post), true);
  });
});

describe("C67 AI boundary", () => {
  it("Grok system prompt forbids directional prediction", () => {
    assert.match(GROK_RANK_SYSTEM, /MATERIALITY/);
    assert.match(GROK_RANK_SYSTEM, /Do NOT predict direction/);
    assert.doesNotMatch(GROK_RANK_SYSTEM, /buy or sell this name/i);
  });

  it("Grok output containing a directional call is stripped", () => {
    const ranked = parseGrokRank(
      `[{"id":"h1","impact":"high","why":"Buy the name, it goes up","direction":"up"}]`,
    );
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0]!.impact, "high");
    assert.equal(ranked[0]!.why.includes("Buy"), false);
    assert.equal(/goes up|bullish|buy/i.test(ranked[0]!.why), false);
  });
});

describe("C67 evidence pack", () => {
  it("unpacks title and source from the snapshot string", () => {
    const packed = packEvidence([
      { id: "a", title: "Filing", source: "SEC", publishedAt: "2026-01-01T00:00:00.000Z" },
    ]);
    const rows = unpackEvidence(packed);
    assert.equal(rows[0]!.id, "a");
    assert.equal(rows[0]!.title, "Filing");
    assert.equal(rows[0]!.source, "SEC");
  });
});
