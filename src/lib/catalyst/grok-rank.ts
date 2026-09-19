import type { NewsImpact } from "./types.ts";

/** Rank expected MATERIALITY only. Never direction, never the user's call. */
export const GROK_RANK_SYSTEM =
  "You rank equity and macro headlines by EXPECTED MATERIALITY only — how much the name is likely to move, not which way. Reply with JSON only: an array of {id, impact, why}. impact is high, medium, or low. why is one short sentence about why it is material. Do NOT predict direction. Do NOT say up, down, buy, sell, long, short, bullish, or bearish. Do NOT fill in a user's call. No markdown.";

const DIRECTIONAL =
  /\b(buy|sell|long|short|bullish|bearish|upgrade to buy|goes?\s+(up|down)|call\s+(up|down)|predict\w*\s+(up|down)|outperform the market|underperform the market)\b/i;

export function stripDirectional(text: string): string {
  return text
    .replace(/\b(buy|sell|long|short|bullish|bearish)\b/gi, "material")
    .replace(/\b(up|down)\b/gi, "this print")
    .slice(0, 180);
}

export function parseGrokRank(text: string): { id: string; impact: NewsImpact; why: string }[] {
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < 0) return [];
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      id?: string;
      impact?: string;
      why?: string;
      direction?: string;
    }[];
    return parsed
      .filter((r) => r.id && (r.impact === "high" || r.impact === "medium" || r.impact === "low"))
      .map((r) => {
        void r.direction;
        let why = stripDirectional((r.why ?? "").replace(/\s+/g, " ").trim());
        if (DIRECTIONAL.test(why) || /goes up|bullish|buy/i.test(why)) {
          why = "Material for the name. Magnitude only — not a call.";
        }
        return {
          id: r.id as string,
          impact: r.impact as NewsImpact,
          why,
        };
      });
  } catch {
    return [];
  }
}
