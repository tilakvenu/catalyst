/**
 * Server-only news collectors. No keys required for the first five sources.
 * Keys, if present, fill gaps (Finnhub company-news, NewsAPI, AV NEWS_SENTIMENT).
 */
import { decorateHeadline } from "./impact";
import type { Headline, NewsImpact } from "./types";

export type NewsKeys = { finnhub?: string; alphaVantage?: string; newsapi?: string };
type WatchTicker = { symbol: string; company: string; tickerId: string };

const UA = "CatalystJournal/1.0 (+https://github.com/tilakvenu/catalyst)";

function tripSafe() {
  /* per-request; serverless has no durable cooloff */
}

async function fetchText(url: string, ms = 4500): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/rss+xml, application/xml, application/json, text/xml, */*", "user-agent": UA },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    tripSafe();
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url: string, ms = 4500): Promise<unknown | null> {
  const text = await fetchText(url, ms);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stripTags(html: string) {
  let out = html.replace(/<[^>]+>/g, " ");
  for (let i = 0; i < 2; i++) {
    out = out
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&/gi, "&")
      .replace(/"/gi, '"')
      .replace(/'/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/</gi, "<")
      .replace(/>/gi, ">");
  }
  return out.replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? stripTags(m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "")) : "";
}

function parseRss(xml: string, fallbackSource: string) {
  const items: { title: string; url: string; source: string; publishedAt: string; summary: string }[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0] ?? raw;
    const title = tag(block, "title");
    if (!title) continue;
    const link = tag(block, "link") || (block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? "");
    const source = tag(block, "source") || fallbackSource;
    const pub = tag(block, "pubDate") || tag(block, "published") || tag(block, "dc:date");
    const summary = tag(block, "description");
    let publishedAt = new Date().toISOString();
    const d = pub ? new Date(pub) : null;
    if (d && !Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    items.push({ title, url: link, source, publishedAt, summary: summary.slice(0, 280) });
  }
  return items;
}

function keyOf(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);
}

async function yahoo(symbol: string) {
  const xml = await fetchText(
    `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`,
  );
  return xml ? parseRss(xml, "Yahoo Finance") : [];
}

async function googleNews(symbol: string, company: string) {
  const q = encodeURIComponent(`${symbol} ${company.split(" ")[0]} stock`);
  const xml = await fetchText(
    `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
  );
  return xml ? parseRss(xml, "Google News") : [];
}

async function nasdaq(symbol: string) {
  const xml = await fetchText(`https://www.nasdaq.com/feed/rssoutbound?symbol=${encodeURIComponent(symbol)}`);
  return xml ? parseRss(xml, "Nasdaq") : [];
}

async function seekingAlpha(symbol: string) {
  const xml = await fetchText(`https://seekingalpha.com/api/sa/combined/${encodeURIComponent(symbol)}.xml`);
  return xml ? parseRss(xml, "Seeking Alpha") : [];
}

async function freeNews(symbol: string, company: string) {
  const q = encodeURIComponent(`"${symbol}" OR "${company}"`);
  const raw = (await fetchJson(`https://freenewsapi.ai/v1/search?q=${q}&lang=en&size=8`)) as {
    results?: { title?: string; url?: string; host?: string; published_at?: string; description?: string }[];
  } | null;
  if (!raw?.results?.length) return [];
  return raw.results
    .filter((r) => r.title)
    .map((r) => ({
      title: r.title as string,
      url: r.url ?? "",
      source: r.host ?? "FreeNewsAPI",
      publishedAt: r.published_at ?? new Date().toISOString(),
      summary: (r.description ?? "").slice(0, 280),
    }));
}

async function finnhubNews(symbol: string, token: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 3 * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const raw = (await fetchJson(
    `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(token)}`,
  )) as { headline?: string; url?: string; source?: string; datetime?: number; summary?: string }[] | null;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => n.headline)
    .slice(0, 8)
    .map((n) => ({
      title: n.headline as string,
      url: n.url ?? "",
      source: n.source ?? "Finnhub",
      publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : new Date().toISOString(),
      summary: (n.summary ?? "").slice(0, 280),
    }));
}

async function newsApi(symbol: string, token: string) {
  const raw = (await fetchJson(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${encodeURIComponent(token)}`,
  )) as { articles?: { title?: string; url?: string; source?: { name?: string }; publishedAt?: string; description?: string }[] } | null;
  if (!raw?.articles?.length) return [];
  return raw.articles
    .filter((a) => a.title)
    .map((a) => ({
      title: a.title as string,
      url: a.url ?? "",
      source: a.source?.name ?? "NewsAPI",
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      summary: (a.description ?? "").slice(0, 280),
    }));
}

async function avSentiment(symbol: string, token: string) {
  const raw = (await fetchJson(
    `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=8&apikey=${encodeURIComponent(token)}`,
  )) as {
    feed?: { title?: string; url?: string; source?: string; time_published?: string; summary?: string }[];
  } | null;
  if (!raw?.feed?.length) return [];
  return raw.feed
    .filter((n) => n.title)
    .map((n) => {
      const tp = n.time_published ?? "";
      const iso =
        tp.length >= 15
          ? `${tp.slice(0, 4)}-${tp.slice(4, 6)}-${tp.slice(6, 8)}T${tp.slice(9, 11)}:${tp.slice(11, 13)}:${tp.slice(13, 15)}Z`
          : new Date().toISOString();
      return {
        title: n.title as string,
        url: n.url ?? "",
        source: n.source ?? "Alpha Vantage",
        publishedAt: iso,
        summary: (n.summary ?? "").slice(0, 280),
      };
    });
}

function toHeadline(
  t: WatchTicker,
  item: { title: string; url: string; source: string; publishedAt: string; summary: string },
  i: number,
): Headline {
  const deco = decorateHeadline(item);
  return {
    id: `live-${t.tickerId}-${i}-${keyOf(item.title).slice(0, 24).replace(/\s/g, "")}`,
    tickerId: t.tickerId,
    title: item.title,
    source: item.source,
    publishedAt: item.publishedAt,
    url: item.url || undefined,
    summary: item.summary || undefined,
    origin: "live",
    ...deco,
  };
}

function mentionsTicker(
  item: { title: string; summary: string },
  t: WatchTicker,
) {
  const hay = `${item.title} ${item.summary}`.toLowerCase();
  if (hay.includes(t.symbol.toLowerCase())) return true;
  const name = t.company.split(/[\s,]/)[0]?.toLowerCase() ?? "";
  return name.length >= 4 && hay.includes(name);
}

export async function collectWatchlistNews(tickers: WatchTicker[], keys: NewsKeys): Promise<Headline[]> {
  const capped = tickers.slice(0, 8);
  const per = await Promise.all(
    capped.map(async (t) => {
      const buckets = await Promise.all([
        yahoo(t.symbol),
        googleNews(t.symbol, t.company),
        nasdaq(t.symbol),
        seekingAlpha(t.symbol),
        freeNews(t.symbol, t.company),
        keys.finnhub ? finnhubNews(t.symbol, keys.finnhub) : Promise.resolve([]),
        keys.newsapi ? newsApi(t.symbol, keys.newsapi) : Promise.resolve([]),
        keys.alphaVantage ? avSentiment(t.symbol, keys.alphaVantage) : Promise.resolve([]),
      ]);
      const trusted = new Set([2, 3, 5, 6, 7]); // nasdaq, SA, finnhub, newsapi, AV
      const seen = new Set<string>();
      const merged: Headline[] = [];
      buckets.forEach((bucket, bi) => {
        let taken = 0;
        for (const item of bucket) {
          if (taken >= 4) break;
          const k = keyOf(item.title);
          if (!k || seen.has(k)) continue;
          if (!trusted.has(bi) && !mentionsTicker(item, t)) continue;
          seen.add(k);
          merged.push(toHeadline(t, item, merged.length));
          taken++;
        }
      });
      return merged.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)).slice(0, 10);
    }),
  );
  const seenTitles = new Set<string>();
  return per
    .flat()
    .filter((h) => {
      const k = keyOf(h.title);
      if (!k || seenTitles.has(k)) return false;
      seenTitles.add(k);
      return true;
    })
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
    .slice(0, 60);
}

export async function grokRankHeadlines(
  items: { id: string; symbol: string; title: string; summary?: string }[],
): Promise<{ id: string; impact: NewsImpact; why: string }[]> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || items.length === 0) return [];
  const payload = items.slice(0, 12).map((it) => ({
    id: it.id,
    symbol: it.symbol,
    title: it.title,
    summary: it.summary ?? "",
  }));
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You rank equity news by likely next-session price impact. Reply with JSON only: an array of {id, impact, why}. impact is high (>2% likely move), medium (0.5–2%), or low (<0.5%). why is one short sentence. No markdown.",
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    }),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  const jsonStart = text.indexOf("[");
  const jsonEnd = text.lastIndexOf("]");
  if (jsonStart < 0 || jsonEnd < 0) return [];
  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
      id?: string;
      impact?: string;
      why?: string;
    }[];
    return parsed
      .filter((r) => r.id && (r.impact === "high" || r.impact === "medium" || r.impact === "low"))
      .map((r) => ({ id: r.id as string, impact: r.impact as NewsImpact, why: (r.why ?? "").slice(0, 180) }));
  } catch {
    return [];
  }
}
