// Catalyst Cloud Code: the referee. Built by cloud/build.mjs into cloud/dist/main.js (CommonJS, Node 19)
// and deployed by cloud/deploy.ts. Rules live in referee.ts; this file adapts Parse rows to them.
//
// Requests: every function below is one client request; all joins happen here with include/containedIn.
import { enCaSample, enCaShimInstalled, installEnCaShim } from "./intl-shim.ts";
import { BUILD_ID } from "../../src/lib/catalyst/build.ts";
import { etMs, isTradingDay, nyDateKey } from "../../src/lib/catalyst/calendar.ts";
import type { Direction, EventKind, Session } from "../../src/lib/catalyst/types.ts";
import {
  DESK_HEADLINE_DAYS,
  DESK_HEADLINE_LIMIT,
  EVIDENCE_MAX_IDS,
  type BootstrapResult,
  type CallDTO,
  type CalendarResult,
  type DeleteAccountResult,
  type EventDTO,
  type EvidenceResult,
  type HeadlineDTO,
  type MacroSeriesDTO,
  type TickerDTO,
  type WatchItemDTO,
} from "./dto.ts";
import * as R from "./referee.ts";

declare const Parse: any;
type PObj = any;

// Must run before any C67 calendar/scoring call (see intl-shim.ts).
const nativeEnCa = enCaSample();
installEnCaShim();

const MASTER = { useMasterKey: true };
const DAY = 86400000;

const forbid = (message: string): never => {
  throw new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, message);
};
const invalid = (message: string): never => {
  throw new Parse.Error(Parse.Error.VALIDATION_ERROR, message);
};

function ownerAcl(user: PObj, write: boolean) {
  const acl = new Parse.ACL();
  acl.setReadAccess(user.id, true);
  acl.setWriteAccess(user.id, write);
  return acl;
}

// ---------- row -> DTO ----------

const iso = (d: Date | undefined) => (d ? d.toISOString() : undefined);
const idOf = (p: PObj | undefined) => (p ? (p.id as string) : undefined);

const tickerDTO = (o: PObj): TickerDTO => ({ id: o.id, symbol: o.get("symbol"), company: o.get("company"), kind: o.get("kind"), updatedAt: iso(o.updatedAt)! });
const macroDTO = (o: PObj): MacroSeriesDTO => ({
  id: o.id,
  key: o.get("key"),
  name: o.get("name"),
  shortName: o.get("shortName"),
  series: o.get("series"),
  updatedAt: iso(o.updatedAt)!,
});
const eventDTO = (o: PObj): EventDTO => ({
  id: o.id,
  tickerId: idOf(o.get("ticker")),
  macroId: idOf(o.get("macro")),
  kind: o.get("kind"),
  title: o.get("title"),
  startsAt: iso(o.get("startsAt"))!,
  session: o.get("session"),
  confirmed: !!o.get("confirmed"),
  consensus: o.get("consensus") ?? [],
  consensusSource: o.get("consensusSource"),
  printMovePct: o.get("printMovePct"),
  typicalMovePct: o.get("typicalMovePct"),
  updatedAt: iso(o.updatedAt)!,
});
const headlineDTO = (o: PObj): HeadlineDTO => ({
  id: o.id,
  tickerId: idOf(o.get("ticker")),
  macroId: idOf(o.get("macro")),
  title: o.get("title"),
  source: o.get("source"),
  url: o.get("url"),
  publishedAt: iso(o.get("publishedAt"))!,
  firstSeenAt: iso(o.get("firstSeenAt"))!,
  kind: o.get("kind"),
  impact: o.get("impact"),
  why: o.get("why"),
  scoredBy: o.get("scoredBy"),
  updatedAt: iso(o.updatedAt)!,
});
const watchDTO = (o: PObj): WatchItemDTO => ({
  id: o.id,
  tickerId: idOf(o.get("ticker")),
  macroId: idOf(o.get("macro")),
  held: !!o.get("held"),
  muted: !!o.get("muted"),
  updatedAt: iso(o.updatedAt)!,
});
const callDTO = (o: PObj): CallDTO => ({
  id: o.id,
  eventId: idOf(o.get("event"))!,
  direction: o.get("direction"),
  conviction: o.get("conviction"),
  reasoning: o.get("reasoning"),
  wrongIf: o.get("wrongIf"),
  callTargetId: idOf(o.get("callTarget")),
  lockedAt: iso(o.get("lockedAt"))!,
  evidenceIds: o.get("evidenceIds") ?? [],
  scoringRuleVersion: o.get("scoringRuleVersion"),
  state: o.get("state"),
  outcome: o.get("outcome"),
  updatedAt: iso(o.updatedAt)!,
});

function eventFacts(o: PObj): R.EventFacts {
  return {
    id: o.id,
    kind: o.get("kind") as EventKind,
    startsAt: o.get("startsAt").toISOString(),
    session: o.get("session") as Session,
    tickerId: idOf(o.get("ticker")),
    macroId: idOf(o.get("macro")),
    printMovePct: o.get("printMovePct"),
    typicalMovePct: o.get("typicalMovePct"),
  };
}

async function mustGet(className: string, ptr: PObj | undefined, what: string): Promise<PObj> {
  if (!ptr || !R.isObjectId(ptr.id)) return invalid(`${what} is required.`);
  try {
    return await new Parse.Query(className).get(ptr.id, MASTER);
  } catch {
    return invalid(`Unknown ${what}.`);
  }
}

// ---------- reference data and history: master key only ----------

for (const cls of ["Ticker", "MacroSeries", "CatalystEvent", "Headline", "CallRevision"]) {
  Parse.Cloud.beforeSave(cls, (req: PObj) => {
    if (!req.master) forbid(`${cls} is read-only.`);
  });
  Parse.Cloud.beforeDelete(cls, (req: PObj) => {
    if (!req.master) forbid(`${cls} is read-only.`);
  });
}

Parse.Cloud.beforeSave(Parse.User, (req: PObj) => {
  if (req.master) return;
  const u = req.object;
  if (u.dirty("theme") && u.get("theme") != null && !R.THEMES.includes(u.get("theme"))) invalid("theme must be light, dark or system.");
  if (u.dirty("notifyLead") && u.get("notifyLead") != null && !R.NOTIFY_LEADS.includes(u.get("notifyLead"))) invalid("notifyLead must be 24h, 1h or both.");
});

// ---------- WatchItem: per-user, owner-only, no duplicates ----------

Parse.Cloud.beforeSave("WatchItem", async (req: PObj) => {
  if (req.master) return;
  const user = req.user ?? forbid("Sign in first.");
  const o = req.object;
  if (!req.original) {
    o.set("owner", user);
    const ticker = o.get("ticker");
    const macro = o.get("macro");
    if (!!ticker === !!macro) invalid("A watch item needs exactly one of ticker or macro.");
    const field = ticker ? "ticker" : "macro";
    const target = await mustGet(ticker ? "Ticker" : "MacroSeries", ticker ?? macro, field);
    const dup = await new Parse.Query("WatchItem").equalTo("owner", user).equalTo(field, target).first(MASTER);
    if (dup) forbid("That name is already on your watchlist.");
    if (o.get("held") === undefined) o.set("held", false);
    if (o.get("muted") === undefined) o.set("muted", false);
  } else {
    if (idOf(req.original.get("owner")) !== user.id) forbid("Not your watch item.");
    o.revert("owner", "ticker", "macro");
  }
  for (const k of ["held", "muted"]) if (typeof o.get(k) !== "boolean") invalid(`${k} must be true or false.`);
  o.setACL(ownerAcl(user, true));
});

// ---------- Call: every client save is a lock; the server stamps everything that matters ----------

const SERVER_ONLY_CALL_FIELDS = ["owner", "lockedAt", "outcome", "state", "scoringRuleVersion", "evidenceIds"];

Parse.Cloud.beforeSave("Call", async (req: PObj) => {
  if (req.master) return;
  const user = req.user ?? forbid("Sign in first.");
  const o = req.object;
  const prev = req.original;
  const now = Date.now();

  // Whatever the client sent for these is ignored.
  o.revert(...SERVER_ONLY_CALL_FIELDS);

  let event: PObj;
  if (!prev) {
    o.set("owner", user);
    event = await mustGet("CatalystEvent", o.get("event"), "event");
    const dup = await new Parse.Query("Call").equalTo("owner", user).equalTo("event", event).first(MASTER);
    if (dup) forbid("You already have a call on this event. Re-lock that one instead.");
  } else {
    if (idOf(prev.get("owner")) !== user.id) forbid("Not your call.");
    o.revert("event");
    event = await mustGet("CatalystEvent", prev.get("event"), "event");
  }

  const facts = eventFacts(event);
  const macro = facts.kind === "macro";
  if (!macro) o.revert("callTarget");
  const verdict = R.checkLock(
    {
      direction: o.get("direction"),
      conviction: o.get("conviction"),
      reasoning: o.get("reasoning"),
      wrongIf: o.get("wrongIf"),
      callTargetId: macro ? idOf(o.get("callTarget")) : undefined,
    },
    facts,
    now,
  );
  if (!verdict.ok) (verdict.code === "started" ? forbid : invalid)(verdict.message);
  if (macro) await mustGet("Ticker", o.get("callTarget"), "call target");

  const field = facts.tickerId ? "ticker" : "macro";
  const headlines = await new Parse.Query("Headline")
    .equalTo(field, event.get(field))
    .lessThanOrEqualTo("firstSeenAt", new Date(now))
    .descending("firstSeenAt")
    .select("firstSeenAt")
    .limit(EVIDENCE_MAX_IDS)
    .find(MASTER);
  const stamp = R.lockStamp(
    now,
    headlines.map((h: PObj) => ({ id: h.id, firstSeenAt: h.get("firstSeenAt").toISOString() })),
  );

  if (prev) {
    // Re-lock before the event: keep the version being replaced, then save.
    const snap: Record<string, unknown> = {};
    for (const k of ["direction", "conviction", "reasoning", "wrongIf", "evidenceIds", "scoringRuleVersion"]) snap[k] = prev.get(k);
    snap.callTarget = idOf(prev.get("callTarget"));
    snap.lockedAt = iso(prev.get("lockedAt"));
    const rev = new Parse.Object("CallRevision");
    rev.set({ call: prev, owner: user, snapshot: R.revisionSnapshot(snap) });
    rev.setACL(ownerAcl(user, false));
    await rev.save(null, MASTER);
    o.unset("state");
    o.unset("outcome");
  }

  o.set("lockedAt", new Date(stamp.lockedAt));
  o.set("evidenceIds", stamp.evidenceIds);
  o.set("scoringRuleVersion", stamp.scoringRuleVersion);
  o.setACL(ownerAcl(user, true));
});

Parse.Cloud.beforeDelete("Call", (req: PObj) => {
  if (req.master) return;
  if (req.object.get("lockedAt")) forbid("Locked calls cannot be deleted.");
});

// ---------- functions ----------

function sinceParam(v: unknown): Date | undefined {
  if (v == null || v === "") return undefined;
  const d = typeof v === "string" ? new Date(v) : undefined;
  if (!d || Number.isNaN(d.getTime())) return invalid("since must be an ISO date string.");
  return d;
}

Parse.Cloud.define(
  "bootstrap",
  async (req: PObj): Promise<BootstrapResult> => {
    const user = req.user;
    const asUser = { sessionToken: user.getSessionToken() };
    const since = sinceParam(req.params.since);
    const now = Date.now();
    const [from, to] = R.bootstrapWindow(now);
    const delta = (q: PObj) => (since ? q.greaterThan("updatedAt", since) : q);

    // Owner rows go through the user's session, so ACLs and pointer permissions apply here too.
    const [allWatch, calls, windowEvents, tickers, macros] = await Promise.all([
      new Parse.Query("WatchItem").equalTo("owner", user).limit(1000).find(asUser),
      delta(new Parse.Query("Call").equalTo("owner", user).include("event").limit(1000)).find(asUser),
      delta(new Parse.Query("CatalystEvent").greaterThanOrEqualTo("startsAt", new Date(from)).lessThan("startsAt", new Date(to)))
        .ascending("startsAt")
        .limit(1000)
        .find(asUser),
      delta(new Parse.Query("Ticker")).limit(1000).find(asUser),
      delta(new Parse.Query("MacroSeries")).limit(100).find(asUser),
    ]);

    // Desk headlines. On a delta, names watched since the last sync get their full recent set
    // (their headlines are older than `since`); names already watched get only changed rows.
    const deskSince = new Date(now - DESK_HEADLINE_DAYS * DAY);
    const deskQuery = (watch: PObj[], onlyChanged: boolean) => {
      const tickers = watch.map((w: PObj) => w.get("ticker")).filter(Boolean);
      const macros = watch.map((w: PObj) => w.get("macro")).filter(Boolean);
      const parts = [
        tickers.length && new Parse.Query("Headline").containedIn("ticker", tickers),
        macros.length && new Parse.Query("Headline").containedIn("macro", macros),
      ].filter(Boolean);
      if (!parts.length) return Promise.resolve([]);
      const q = Parse.Query.or(...parts).greaterThanOrEqualTo("firstSeenAt", deskSince).descending("firstSeenAt").limit(DESK_HEADLINE_LIMIT);
      return (onlyChanged ? q.greaterThan("updatedAt", since) : q).find(asUser);
    };
    const newlyWatched = since ? allWatch.filter((w: PObj) => w.createdAt > since) : allWatch;
    const alreadyWatched = since ? allWatch.filter((w: PObj) => w.createdAt <= since) : [];
    const [fresh, changed, callIdRows] = await Promise.all([
      deskQuery(newlyWatched, false),
      deskQuery(alreadyWatched, true),
      since ? new Parse.Query("Call").equalTo("owner", user).select("event").limit(1000).find(asUser) : [],
    ]);
    const headlines = [...new Map([...fresh, ...changed].map((h: PObj) => [h.id, h])).values()];

    // Events: the window, plus anything a returned call points at (included above, no extra query).
    const events = new Map<string, EventDTO>();
    for (const e of windowEvents) events.set(e.id, eventDTO(e));
    for (const c of calls) {
      const e = c.get("event");
      if (e && e.get("startsAt") && !events.has(e.id)) events.set(e.id, eventDTO(e));
    }
    const watchItems = since ? allWatch.filter((w: PObj) => w.updatedAt > since) : allWatch;

    return {
      serverTime: new Date(now).toISOString(),
      full: !since,
      tickers: tickers.map(tickerDTO),
      macroSeries: macros.map(macroDTO),
      events: [...events.values()],
      headlines: headlines.map(headlineDTO),
      watchItems: watchItems.map(watchDTO),
      calls: calls.map(callDTO),
      ...(since ? { watchIds: allWatch.map((w: PObj) => w.id), callIds: callIdRows.map((c: PObj) => c.id) } : {}),
    };
  },
  { requireUser: true },
);

Parse.Cloud.define(
  "getCalendar",
  async (req: PObj): Promise<CalendarResult> => {
    const month = String(req.params.month ?? "");
    const range = R.monthRange(month) ?? invalid('month must look like "2026-10".');
    const events = await new Parse.Query("CatalystEvent")
      .greaterThanOrEqualTo("startsAt", new Date(range[0]))
      .lessThan("startsAt", new Date(range[1]))
      .ascending("startsAt")
      .limit(1000)
      .find({ sessionToken: req.user.getSessionToken() });
    return { month, events: events.map(eventDTO) };
  },
  { requireUser: true },
);

Parse.Cloud.define(
  "getEvidence",
  async (req: PObj): Promise<EvidenceResult> => {
    const ids = req.params.ids;
    if (!Array.isArray(ids) || ids.length > EVIDENCE_MAX_IDS || !ids.every(R.isObjectId)) {
      invalid(`ids must be an array of at most ${EVIDENCE_MAX_IDS} object ids.`);
    }
    if (!ids.length) return { headlines: [] };
    const rows = await new Parse.Query("Headline").containedIn("objectId", ids).limit(EVIDENCE_MAX_IDS).find({ sessionToken: req.user.getSessionToken() });
    return { headlines: rows.map(headlineDTO) };
  },
  { requireUser: true },
);

async function destroyWhere(className: string, field: string, value: PObj): Promise<number> {
  let total = 0;
  for (;;) {
    const rows = await new Parse.Query(className).equalTo(field, value).limit(500).find(MASTER);
    if (!rows.length) return total;
    await Parse.Object.destroyAll(rows, MASTER);
    total += rows.length;
  }
}

Parse.Cloud.define(
  "deleteAccount",
  async (req: PObj): Promise<DeleteAccountResult> => {
    const user = req.user;
    const deleted = {
      callRevisions: await destroyWhere("CallRevision", "owner", user),
      calls: await destroyWhere("Call", "owner", user),
      watchItems: await destroyWhere("WatchItem", "owner", user),
      sessions: 0,
      user: 0,
    };
    await user.destroy(MASTER);
    deleted.user = 1;
    deleted.sessions = await destroyWhere("_Session", "user", user);
    return { deleted };
  },
  { requireUser: true },
);

/** Deploy check. Master key only. */
Parse.Cloud.define(
  "health",
  () => ({
    build: `${BUILD_ID}.3-backend`,
    node: process.version,
    scoringRuleVersion: R.SCORING_RULE_VERSION,
    icu: process.versions.icu,
    nativeEnCa, // what en-CA gave before the shim; "2026-01-02" means no shim was needed
    enCaShim: enCaShimInstalled(),
    // 2026-03-09 02:00Z is 22:00 EDT on 2026-03-08 in New York (UTC is already the 9th).
    nyDateKey: nyDateKey(Date.UTC(2026, 2, 9, 2, 0)),
    thanksgiving2026Trading: isTradingDay(etMs(2026, 11, 26, 12, 0)), // expect false
    dayAfterTrading: isTradingDay(etMs(2026, 11, 27, 12, 0)), // expect true
  }),
  { requireMaster: true },
);

// ---------- job: the free plan allows one; schedule it daily after the close ----------

Parse.Cloud.job("tick", async (req: PObj) => {
  const now = Date.now();

  // 1. Resolve locked calls whose resolving session has closed (session.ts: AMC -> next session close).
  const due = await new Parse.Query("Call")
    .exists("lockedAt")
    .doesNotExist("outcome")
    .notEqualTo("state", "unresolvable")
    .matchesQuery("event", new Parse.Query("CatalystEvent").lessThanOrEqualTo("startsAt", new Date(now)))
    .include("event")
    .limit(1000)
    .find(MASTER);
  const scored: PObj[] = [];
  const waiting: Record<string, number> = {};
  for (const c of due) {
    const r = R.resolveCall(
      {
        direction: c.get("direction") as Direction,
        conviction: c.get("conviction"),
        reasoning: c.get("reasoning"),
        wrongIf: c.get("wrongIf"),
        callTargetId: idOf(c.get("callTarget")),
        lockedAt: iso(c.get("lockedAt")),
        hasOutcome: c.get("outcome") != null,
        state: c.get("state"),
      },
      eventFacts(c.get("event")),
      now,
    );
    if (r.action === "score") {
      c.set("outcome", r.outcome);
      scored.push(c);
    } else waiting[r.reason] = (waiting[r.reason] ?? 0) + 1;
  }
  if (scored.length) await Parse.Object.saveAll(scored, MASTER);

  // 2. Prune headlines older than 30 days unless a call's evidence points at them.
  let pruned = 0;
  let kept = 0;
  const cutoff = new Date(R.headlineCutoff(now));
  for (let page = 0; page < 20; page++) {
    const old = await new Parse.Query("Headline").lessThan("firstSeenAt", cutoff).select("firstSeenAt").skip(kept).limit(500).find(MASTER);
    if (!old.length) break;
    const ids = old.map((h: PObj) => h.id);
    const refs = await new Parse.Query("Call").containedIn("evidenceIds", ids).select("evidenceIds").limit(1000).find(MASTER);
    const referenced = new Set<string>(refs.flatMap((c: PObj) => c.get("evidenceIds") ?? []));
    const drop = old.filter((h: PObj) => !referenced.has(h.id));
    kept += old.length - drop.length;
    if (drop.length) await Parse.Object.destroyAll(drop, MASTER);
    pruned += drop.length;
  }

  const summary = `tick ${new Date(now).toISOString()}: scored ${scored.length}, waiting ${JSON.stringify(waiting)}, pruned ${pruned}, kept ${kept}`;
  req.message(summary);
  return summary;
});
