// Versioned Parse schema for Catalyst C67.3. Source of truth for classes, fields, CLPs and indexes.
// Apply is idempotent: missing classes/fields/indexes are added, CLPs are set, nothing is dropped.
// A type or index-definition conflict stops the run instead of guessing.
//
//   node cloud/schema.ts            apply to the app in cloud/.env
//   node cloud/schema.ts --check    compare only; exit 1 on drift (no writes)
import { loadEnv } from "./env.ts";
import { makeRest, ParseError } from "./rest.ts";

export const SCHEMA_VERSION = 1;

type Field = { type: string; targetClass?: string };
type Clp = Record<string, unknown>;
type ClassSpec = { fields: Record<string, Field>; clp: Clp; indexes: Record<string, Record<string, 1 | -1>> };

const str: Field = { type: "String" };
const num: Field = { type: "Number" };
const bool: Field = { type: "Boolean" };
const date: Field = { type: "Date" };
const arr: Field = { type: "Array" };
const obj: Field = { type: "Object" };
const ptr = (targetClass: string): Field => ({ type: "Pointer", targetClass });

const SIGNED_IN = { requiresAuthentication: true };
const NOBODY = {};
const base = { protectedFields: { "*": [] }, addField: NOBODY };

/** Reference data: any signed-in user reads, only the master key (seed, Cloud Code) writes. */
const readOnlyClp: Clp = { ...base, find: SIGNED_IN, get: SIGNED_IN, count: SIGNED_IN, create: NOBODY, update: NOBODY, delete: NOBODY };
/** Per-user rows: signed-in users create/read/update/delete; ACLs set in beforeSave keep rows owner-only. */
const ownedClp: Clp = { ...base, find: SIGNED_IN, get: SIGNED_IN, count: SIGNED_IN, create: SIGNED_IN, update: SIGNED_IN, delete: SIGNED_IN };
/** Server-only history: owner reads through the ACL Cloud Code sets; clients never write. */
const serverWrittenClp: Clp = { ...base, find: SIGNED_IN, get: SIGNED_IN, count: SIGNED_IN, create: NOBODY, update: NOBODY, delete: NOBODY };
/** Sign-up stays public; listing users is master-only; account deletion goes through the deleteAccount function. */
const userClp: Clp = { ...base, find: NOBODY, count: NOBODY, get: SIGNED_IN, create: { "*": true }, update: SIGNED_IN, delete: NOBODY };

// Pointer index keys use Parse's Mongo column name (_p_<field>); Parse validates them against <field>.
// updatedAt is stored as _updated_at, which Parse's schema API cannot index (see DEFERRED.md).
export const SCHEMA: Record<string, ClassSpec> = {
  _User: {
    fields: { theme: str, notifyLead: str },
    clp: userClp,
    indexes: {},
  },
  Ticker: {
    fields: { symbol: str, company: str, kind: str },
    clp: readOnlyClp,
    indexes: { symbol_1: { symbol: 1 } },
  },
  MacroSeries: {
    fields: { key: str, name: str, shortName: str, series: str },
    clp: readOnlyClp,
    indexes: { key_1: { key: 1 } },
  },
  CatalystEvent: {
    fields: {
      ticker: ptr("Ticker"),
      macro: ptr("MacroSeries"),
      kind: str,
      title: str,
      startsAt: date,
      session: str,
      confirmed: bool,
      consensus: arr,
      consensusSource: str,
      printMovePct: num,
    },
    clp: readOnlyClp,
    indexes: { startsAt_1: { startsAt: 1 } },
  },
  Headline: {
    fields: {
      ticker: ptr("Ticker"),
      macro: ptr("MacroSeries"),
      title: str,
      source: str,
      url: str,
      publishedAt: date,
      firstSeenAt: date,
      kind: str,
      impact: str,
      why: str,
      scoredBy: str,
    },
    clp: readOnlyClp,
    indexes: {
      ticker_firstSeenAt: { _p_ticker: 1, firstSeenAt: 1 },
      macro_firstSeenAt: { _p_macro: 1, firstSeenAt: 1 },
    },
  },
  WatchItem: {
    fields: { owner: ptr("_User"), ticker: ptr("Ticker"), macro: ptr("MacroSeries"), held: bool, muted: bool },
    clp: ownedClp,
    indexes: { owner_1: { _p_owner: 1 } },
  },
  Call: {
    fields: {
      owner: ptr("_User"),
      event: ptr("CatalystEvent"),
      direction: str,
      conviction: num,
      reasoning: str,
      wrongIf: str,
      callTarget: ptr("Ticker"),
      lockedAt: date,
      evidenceIds: arr,
      scoringRuleVersion: num,
      state: str,
      outcome: obj,
    },
    clp: ownedClp,
    // Lookup index for the one-Call-per-(owner, event) rule, which beforeSave enforces.
    indexes: { owner_event: { _p_owner: 1, _p_event: 1 } },
  },
  CallRevision: {
    fields: { call: ptr("Call"), snapshot: obj },
    clp: serverWrittenClp,
    indexes: { call_1: { _p_call: 1 } },
  },
};

type RemoteSchema = {
  fields: Record<string, Field & { required?: boolean }>;
  classLevelPermissions?: Clp;
  indexes?: Record<string, Record<string, number>>;
};

const sameField = (a: Field, b: Field) => a.type === b.type && (a.targetClass ?? null) === (b.targetClass ?? null);
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

type Plan = { className: string; create: boolean; addFields: string[]; setClp: boolean; addIndexes: string[]; conflicts: string[] };

function planFor(className: string, spec: ClassSpec, remote: RemoteSchema | null): Plan {
  const plan: Plan = { className, create: !remote, addFields: [], setClp: !remote, addIndexes: [], conflicts: [] };
  if (!remote) return { ...plan, addIndexes: Object.keys(spec.indexes) };
  for (const [name, f] of Object.entries(spec.fields)) {
    const have = remote.fields[name];
    if (!have) plan.addFields.push(name);
    else if (!sameField(have, f)) plan.conflicts.push(`field ${name}: server has ${have.type}${have.targetClass ? `<${have.targetClass}>` : ""}, schema wants ${f.type}${f.targetClass ? `<${f.targetClass}>` : ""}`);
  }
  const clpHave = { ...remote.classLevelPermissions };
  const clpWant = spec.clp;
  plan.setClp = Object.keys(clpWant).some((k) => canon(clpHave[k]) !== canon(clpWant[k]));
  for (const [name, keys] of Object.entries(spec.indexes)) {
    const have = remote.indexes?.[name];
    if (!have) plan.addIndexes.push(name);
    else if (canon(have) !== canon(keys)) plan.conflicts.push(`index ${name}: server has ${canon(have)}, schema wants ${canon(keys)}`);
  }
  return plan;
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const { request } = makeRest(loadEnv());

  async function getRemote(className: string): Promise<RemoteSchema | null> {
    try {
      return await request<RemoteSchema>("GET", `schemas/${className}`);
    } catch (e) {
      if (e instanceof ParseError && e.code === 103) return null; // class does not exist
      throw e;
    }
  }

  console.log(`Catalyst schema v${SCHEMA_VERSION} — ${checkOnly ? "check only" : "apply"}`);
  let drift = 0;
  let conflicts = 0;
  for (const [className, spec] of Object.entries(SCHEMA)) {
    const plan = planFor(className, spec, await getRemote(className));
    const changes = [
      plan.create && "create class",
      plan.addFields.length && `add fields ${plan.addFields.join(", ")}`,
      !plan.create && plan.setClp && "set permissions",
      plan.addIndexes.length && `add indexes ${plan.addIndexes.join(", ")}`,
    ].filter(Boolean) as string[];

    if (plan.conflicts.length) {
      conflicts += plan.conflicts.length;
      for (const c of plan.conflicts) console.log(`  ${className.padEnd(14)} CONFLICT ${c}`);
      continue;
    }
    if (!changes.length) {
      console.log(`  ${className.padEnd(14)} unchanged`);
      continue;
    }
    drift++;
    console.log(`  ${className.padEnd(14)} ${checkOnly ? "would " : ""}${changes.join("; ")}`);
    if (checkOnly) continue;

    const fields = Object.fromEntries((plan.create ? Object.keys(spec.fields) : plan.addFields).map((n) => [n, spec.fields[n]]));
    if (plan.create) {
      // Create with fields + CLP first, then indexes, so index validation sees the fields.
      await request("POST", `schemas/${className}`, { className, fields, classLevelPermissions: spec.clp });
    } else if (plan.addFields.length || plan.setClp) {
      await request("PUT", `schemas/${className}`, { className, fields, classLevelPermissions: spec.clp });
    }
    if (plan.addIndexes.length) {
      const indexes = Object.fromEntries(plan.addIndexes.map((n) => [n, spec.indexes[n]]));
      await request("PUT", `schemas/${className}`, { className, indexes });
    }
  }

  if (conflicts) {
    console.log(`\n${conflicts} conflict(s). Nothing was dropped; resolve them by hand or with a new schema version.`);
    process.exit(1);
  }
  if (checkOnly) {
    console.log(drift ? `\n${drift} class(es) differ from schema v${SCHEMA_VERSION}.` : `\nServer matches schema v${SCHEMA_VERSION}.`);
    process.exit(drift ? 1 : 0);
  }
  console.log(drift ? `\nApplied. Run with --check to verify.` : `\nNothing to do; server already matches.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()!)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
