import type { CatalystEvent, Headline, JournalEntry } from "./types.ts";

export interface FrozenHeadline {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
}

/** Pack headline ids plus title/source so a later tape rollover cannot empty the freeze. */
export function packEvidence(headlines: Pick<Headline, "id" | "title" | "source" | "publishedAt">[]): string[] {
  return headlines.map((h) => `${h.id}|${JSON.stringify({ title: h.title, source: h.source, publishedAt: h.publishedAt })}`);
}

export function snapshotIds(snapshot?: string[]): string[] {
  return (snapshot ?? []).map((row) => row.split("|")[0] ?? "").filter(Boolean);
}

export function unpackEvidence(snapshot?: string[]): FrozenHeadline[] {
  return (snapshot ?? []).map((row) => {
    const i = row.indexOf("|");
    if (i < 0) return { id: row, title: row, source: "", publishedAt: "" };
    const id = row.slice(0, i);
    try {
      const extra = JSON.parse(row.slice(i + 1)) as { title?: string; source?: string; publishedAt?: string };
      return {
        id,
        title: extra.title || id,
        source: extra.source ?? "",
        publishedAt: extra.publishedAt ?? "",
      };
    } catch {
      return { id, title: id, source: "", publishedAt: "" };
    }
  });
}

export function eventHeadlines(headlines: Headline[], event: CatalystEvent): Headline[] {
  return headlines.filter((h) =>
    event.tickerId ? h.tickerId === event.tickerId : Boolean(event.macroId && h.macroId === event.macroId),
  );
}

export function splitEvidence(
  entry: JournalEntry,
  headlines: Headline[],
  event?: CatalystEvent,
): { known: FrozenHeadline[]; after: Headline[] } {
  const known = unpackEvidence(entry.evidenceSnapshot);
  const knownIds = new Set(known.map((h) => h.id));
  const lockedAt = entry.lockedAt ? new Date(entry.lockedAt).getTime() : 0;
  const after = headlines.filter((h) => {
    if (knownIds.has(h.id)) return false;
    if (event) {
      const sameName = event.tickerId
        ? h.tickerId === event.tickerId
        : Boolean(event.macroId && h.macroId === event.macroId);
      if (!sameName) return false;
    }
    const seen = h.firstSeenAt ? new Date(h.firstSeenAt).getTime() : new Date(h.publishedAt).getTime();
    return seen > lockedAt;
  });
  after.sort((a, b) => +new Date(a.firstSeenAt ?? a.publishedAt) - +new Date(b.firstSeenAt ?? b.publishedAt));
  return { known, after };
}

export function stampFirstSeen(existing: Headline[], incoming: Headline[], nowIso: string): Headline[] {
  const seen = new Map(existing.map((h) => [h.id, h]));
  return incoming.map((h) => {
    const prev = seen.get(h.id);
    if (prev?.firstSeenAt) return { ...h, firstSeenAt: prev.firstSeenAt };
    if (h.firstSeenAt) return h;
    return { ...h, firstSeenAt: nowIso };
  });
}

export function retainSnapshotted(existing: Headline[], nextLive: Headline[], entries: JournalEntry[]): Headline[] {
  const keep = new Set<string>();
  for (const e of entries) {
    for (const id of snapshotIds(e.evidenceSnapshot)) keep.add(id);
  }
  const liveIds = new Set(nextLive.map((h) => h.id));
  const frozen = existing.filter((h) => keep.has(h.id) && !liveIds.has(h.id));
  return [...nextLive, ...frozen];
}
