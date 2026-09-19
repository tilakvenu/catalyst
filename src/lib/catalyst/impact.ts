import type { Headline, NewsImpact, NewsKind } from "./types";

/**
 * Rank a headline by how much it is likely to move the name next session.
 * High ≈ >2% one-day, medium ≈ 0.5–2%, low is color / noise.
 * Keyword first so the tape paints without a model call. Grok may override.
 */
const HIGH = [
  /\bprice[- ]?target\b/i,
  /\b(raises|cuts|lifts|slashes|hikes)\b.{0,24}\b(pt|target|price target)\b/i,
  /\b(upgrade[ds]?|downgrade[ds]?|initiates? coverage)\b/i,
  /\b(overweight|underweight|outperform|underperform)\b.{0,18}\b(from|to)\b/i,
  /\b(8-?k|10-?k|10-?q|form 4)\b/i,
  /\b(guidance|guides?|outlook)\b.{0,20}\b(cut|raise|slash|withdraw|suspend)\b/i,
  /\b(beats?|misses?)\b.{0,16}\b(eps|revenue|sales|estimates?)\b/i,
  /\b(merger|acquisition|acquire[ds]?|takeover|buyout)\b/i,
  /\b(fda|crl|approval|rejected|phase 3)\b/i,
  /\b(ceo|cfo)\b.{0,16}\b(resign|stepping down|ousted|depart)/i,
  /\b(bankrupt|chapter 11|going concern|delist)\b/i,
  /\b(investigation|doj|sec probe|subpoena|class action)\b/i,
  /\b(dividend cut|suspends dividend|buyback halt)\b/i,
  /\b(recall|halt(ed)? production|plant (fire|explosion))\b/i,
];

const MEDIUM = [
  /\b(partnership|contract|wins? deal|awarded)\b/i,
  /\b(product launch|unveils?|announces?)\b/i,
  /\b(buyback|repurchase|dividend)\b/i,
  /\b(hiring|layoffs?|workforce|restructur)/i,
  /\b(insider (buy|sell)|form 4)\b/i,
  /\b(analyst|desk note|channel check)\b/i,
  /\b(guidance|outlook|capex)\b/i,
  /\b(earnings|print|quarter)\b/i,
];

const LOW = [
  /\b(stocks? to (buy|watch)|what to know|here's why)\b/i,
  /\b(cramer|prediction|forecast: where)\b/i,
  /\b(how to invest|is it (a )?buy)\b/i,
  /\b(etf|roundup|these \d+ stocks)\b/i,
];

const KIND_TARGET = [
  /\bprice[- ]?target\b/i,
  /\b(upgrade|downgrade|initiates? coverage|overweight|underweight|outperform|underperform|equal[- ]weight)\b/i,
  /\b(pt |target to \$|raises target|cuts target)\b/i,
];
const KIND_FILING = [/\b(8-?k|10-?k|10-?q|form 4|13[df]|s-1|proxy|13g)\b/i, /\bsec filing\b/i];
const KIND_ANNOUNCE = [
  /\b(announces?|unveils?|launches?|introduces?)\b/i,
  /\b(press release|company said|said today)\b/i,
  /\b(guidance|buyback|dividend|appoints?|names? .* ceo)\b/i,
];

export function classifyKind(title: string, source = ""): NewsKind {
  const t = `${title} ${source}`;
  if (KIND_FILING.some((r) => r.test(t))) return "filing";
  if (KIND_TARGET.some((r) => r.test(t))) return "target";
  if (KIND_ANNOUNCE.some((r) => r.test(t))) return "announcement";
  return "coverage";
}

export function scoreImpact(title: string, summary = ""): { impact: NewsImpact; why: string } {
  const t = `${title} ${summary}`;
  if (LOW.some((r) => r.test(t)) && !HIGH.some((r) => r.test(t))) {
    return { impact: "low", why: "Opinion or roundup — color, not a print." };
  }
  if (HIGH.some((r) => r.test(t))) {
    const kind = classifyKind(title);
    const why =
      kind === "target"
        ? "Street target or rating change. Next-session flow usually follows."
        : kind === "filing"
          ? "Primary filing. The tape has to reprice the new fact."
          : "Hard news that typically moves a name more than a session's typical range.";
    return { impact: "high", why };
  }
  if (MEDIUM.some((r) => r.test(t))) {
    return { impact: "medium", why: "Material, but not a full reset of the setup." };
  }
  return { impact: "low", why: "Background coverage. Unlikely to move the name on its own." };
}

export function decorateHeadline(
  h: Pick<Headline, "title" | "source" | "summary">,
): Pick<Headline, "kind" | "impact" | "why" | "scoredBy"> {
  const kind = classifyKind(h.title, h.source);
  const { impact, why } = scoreImpact(h.title, h.summary);
  return { kind, impact, why, scoredBy: "heuristic" };
}

export function kindLabel(kind?: NewsKind): string {
  if (kind === "target") return "Target";
  if (kind === "announcement") return "Company";
  if (kind === "filing") return "Filing";
  return "Coverage";
}

export function impactLabel(impact?: NewsImpact): string {
  if (impact === "high") return "High";
  if (impact === "medium") return "Med";
  return "Low";
}

/** Next-session move the flag is sized for. */
export function impactMove(impact?: NewsImpact): string {
  if (impact === "high") return ">2%";
  if (impact === "medium") return "0.5–2%";
  return "<0.5%";
}

export function impactCaption(impact?: NewsImpact): string {
  return `${impactLabel(impact)} · ${impactMove(impact)}`;
}

export function impactTone(impact?: NewsImpact): "neg" | "warn" | "neutral" {
  if (impact === "high") return "neg";
  if (impact === "medium") return "warn";
  return "neutral";
}
