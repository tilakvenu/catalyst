import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          action?: string;
          symbol?: string;
          symbols?: string[];
          series?: string;
          from?: string;
          to?: string;
          keys?: { finnhub?: string; alphaVantage?: string; newsapi?: string };
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid json" }, 400);
        }
        const symbol = (body.symbol ?? "AAPL").replace(/[^A-Za-z.]/g, "").toUpperCase().slice(0, 8);
        const keys = body.keys ?? {};
        const action = body.action ?? "";

        if (action === "quote") {
          const q = await quoteRotated(symbol, keys);
          return q ? json(q) : json({ error: "no quote" }, 502);
        }
        if (action === "news") {
          const items = await newsRotated(symbol, keys);
          return json({ items });
        }
        if (action === "earnings") {
          const items = await earningsRotated(symbol, keys);
          return json({ items });
        }
        if (action === "recommendation") {
          const rec = await recsFinnhub(symbol, keys.finnhub);
          return rec ? json(rec) : json({ error: "no recs" }, 502);
        }
        if (action === "metrics") {
          const m = await metricsRotated(symbol, keys);
          return m ? json(m) : json({ error: "no metrics" }, 502);
        }
        if (action === "calendar") {
          const items = await calendarRotated(body.symbols ?? (symbol ? [symbol] : []), body.from, body.to, keys);
          return json({ items });
        }
        if (action === "macro") {
          const series = (body.series ?? "cpi").toLowerCase();
          const m = await macroRotated(series, keys);
          return m ? json(m) : json({ error: "no macro" }, 502);
        }
        return json({ error: "unknown action" }, 400);
      },
    },
  },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const cooloff = new Map<string, number>();
function up(src: string) {
  return Date.now() > (cooloff.get(src) ?? 0);
}
function trip(src: string, ms = 60_000) {
  cooloff.set(src, Date.now() + ms);
}

async function getJson(url: string, src: string): Promise<unknown | null> {
  if (!up(src)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (res.status === 429) {
      trip(src, 90_000);
      return null;
    }
    if (!res.ok) {
      trip(src, 20_000);
      return null;
    }
    return await res.json();
  } catch {
    trip(src, 20_000);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function getText(url: string, src: string): Promise<string | null> {
  if (!up(src)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) {
      trip(src, 90_000);
      return null;
    }
    if (!res.ok) {
      trip(src, 20_000);
      return null;
    }
    return await res.text();
  } catch {
    trip(src, 20_000);
    return null;
  } finally {
    clearTimeout(t);
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && v !== "None") {
    const n = Number(v.replace("%", "").replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

async function quoteRotated(
  symbol: string,
  keys: { finnhub?: string; alphaVantage?: string },
) {
  if (keys.finnhub) {
    const raw = (await getJson(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-quote",
    )) as { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number } | null;
    if (raw && typeof raw.c === "number" && raw.c > 0) {
      return {
        lastPrice: raw.c,
        change: raw.d ?? 0,
        changePct: raw.dp ?? 0,
        dayHigh: raw.h,
        dayLow: raw.l,
        dayOpen: raw.o,
        prevClose: raw.pc,
        source: "finnhub",
      };
    }
  }
  if (keys.alphaVantage) {
    const raw = (await getJson(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(keys.alphaVantage)}`,
      "av-quote",
    )) as {
      "Global Quote"?: {
        "02. open"?: string;
        "03. high"?: string;
        "04. low"?: string;
        "05. price"?: string;
        "08. previous close"?: string;
        "09. change"?: string;
        "10. change percent"?: string;
      };
    } | null;
    const g = raw?.["Global Quote"];
    if (g?.["05. price"]) {
      return {
        lastPrice: Number(g["05. price"]),
        change: Number(g["09. change"] ?? 0),
        changePct: Number(String(g["10. change percent"] ?? "0").replace("%", "")),
        dayHigh: num(g["03. high"]),
        dayLow: num(g["04. low"]),
        dayOpen: num(g["02. open"]),
        prevClose: num(g["08. previous close"]),
        source: "alphavantage",
      };
    }
  }
  const stooq = await quoteStooq(symbol);
  if (stooq) return stooq;
  return null;
}

async function quoteStooq(symbol: string) {
  const s = `${symbol.replace(/\./g, "-").toLowerCase()}.us`;
  const text = await getText(
    `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`,
    "stooq-quote",
  );
  if (!text) return null;
  const line = text.trim().split(/\r?\n/)[1];
  if (!line) return null;
  const parts = line.split(",");
  const open = num(parts[3]);
  const high = num(parts[4]);
  const low = num(parts[5]);
  const close = num(parts[6]);
  if (close == null || close <= 0) return null;
  const prev = open ?? close;
  const change = close - prev;
  const changePct = prev ? (change / prev) * 100 : 0;
  return {
    lastPrice: close,
    change,
    changePct,
    dayHigh: high,
    dayLow: low,
    dayOpen: open,
    prevClose: prev,
    source: "stooq",
  };
}

async function newsRotated(symbol: string, keys: { finnhub?: string; newsapi?: string }) {
  if (keys.finnhub) {
    const to = new Date();
    const from = new Date(to.getTime() - 14 * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const raw = (await getJson(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${iso(from)}&to=${iso(to)}&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-news",
    )) as { headline?: string; source?: string; datetime?: number }[] | null;
    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter((n) => n.headline)
        .slice(0, 8)
        .map((n) => ({
          title: n.headline as string,
          source: n.source ?? "Finnhub",
          publishedAt: n.datetime ? new Date(n.datetime * 1000).toISOString() : new Date().toISOString(),
        }));
    }
  }
  if (keys.newsapi) {
    const raw = (await getJson(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(symbol)}&language=en&sortBy=publishedAt&pageSize=8&apiKey=${encodeURIComponent(keys.newsapi)}`,
      "newsapi",
    )) as { articles?: { title?: string; source?: { name?: string }; publishedAt?: string }[] } | null;
    if (raw?.articles?.length) {
      return raw.articles
        .filter((a) => a.title)
        .map((a) => ({
          title: a.title as string,
          source: a.source?.name ?? "NewsAPI",
          publishedAt: a.publishedAt ?? new Date().toISOString(),
        }));
    }
  }
  return [];
}

async function earningsRotated(symbol: string, keys: { finnhub?: string; alphaVantage?: string }) {
  if (keys.finnhub) {
    const raw = (await getJson(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-earn",
    )) as { actual?: number; estimate?: number; period?: string; surprisePercent?: number; quarter?: number; year?: number }[] | null;
    if (Array.isArray(raw) && raw.length) {
      return raw.slice(0, 4).map((r) => ({
        period: r.period ?? (r.year && r.quarter ? `${r.year} Q${r.quarter}` : "—"),
        actual: typeof r.actual === "number" ? r.actual : null,
        estimate: typeof r.estimate === "number" ? r.estimate : null,
        surprisePct: typeof r.surprisePercent === "number" ? r.surprisePercent : null,
      }));
    }
  }
  if (keys.alphaVantage) {
    const raw = (await getJson(
      `https://www.alphavantage.co/query?function=EARNINGS&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(keys.alphaVantage)}`,
      "av-earn",
    )) as { quarterlyEarnings?: { fiscalDateEnding?: string; reportedEPS?: string; estimatedEPS?: string; surprisePercentage?: string }[] } | null;
    const q = raw?.quarterlyEarnings;
    if (Array.isArray(q) && q.length) {
      return q.slice(0, 4).map((r) => ({
        period: r.fiscalDateEnding ?? "—",
        actual: r.reportedEPS != null ? Number(r.reportedEPS) : null,
        estimate: r.estimatedEPS != null ? Number(r.estimatedEPS) : null,
        surprisePct: r.surprisePercentage != null ? Number(r.surprisePercentage) : null,
      }));
    }
  }
  return [];
}

async function recsFinnhub(symbol: string, token?: string) {
  if (!token) return null;
  const raw = (await getJson(
    `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(token)}`,
    "fh-rec",
  )) as { buy?: number; hold?: number; sell?: number; strongBuy?: number; strongSell?: number; period?: string }[] | null;
  const r = Array.isArray(raw) ? raw[0] : null;
  if (!r) return null;
  return {
    buy: (r.strongBuy ?? 0) + (r.buy ?? 0),
    hold: r.hold ?? 0,
    sell: (r.sell ?? 0) + (r.strongSell ?? 0),
    period: r.period ?? "",
  };
}

async function metricsRotated(symbol: string, keys: { finnhub?: string; alphaVantage?: string }) {
  const out: {
    marketCap?: number;
    pe?: number;
    week52High?: number;
    week52Low?: number;
    target?: number;
    fetchedAt: string;
  } = { fetchedAt: new Date().toISOString() };

  if (keys.finnhub) {
    const raw = (await getJson(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-metric",
    )) as { metric?: Record<string, unknown> } | null;
    const m = raw?.metric;
    if (m) {
      out.pe = num(m.peNormalizedAnnual) ?? num(m.peBasicExclExtraTTM) ?? num(m.peTTM);
      out.week52High = num(m["52WeekHigh"]);
      out.week52Low = num(m["52WeekLow"]);
      out.marketCap = num(m.marketCapitalization);
    }
    if (out.marketCap == null) {
      const p = (await getJson(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(keys.finnhub)}`,
        "fh-profile",
      )) as { marketCapitalization?: number } | null;
      if (p?.marketCapitalization) out.marketCap = p.marketCapitalization;
    }
    const tgt = (await getJson(
      `https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-target",
    )) as { targetMean?: number } | null;
    if (tgt?.targetMean) out.target = tgt.targetMean;
  }

  const missing = out.pe == null || out.week52High == null || out.marketCap == null;
  if (missing && keys.alphaVantage) {
    const raw = (await getJson(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(keys.alphaVantage)}`,
      "av-overview",
    )) as Record<string, string> | null;
    if (raw && raw.Symbol) {
      if (out.pe == null) out.pe = num(raw.PERatio);
      if (out.week52High == null) out.week52High = num(raw["52WeekHigh"]);
      if (out.week52Low == null) out.week52Low = num(raw["52WeekLow"]);
      if (out.target == null) out.target = num(raw.AnalystTargetPrice);
      if (out.marketCap == null) {
        const cap = num(raw.MarketCapitalization);
        if (cap != null) out.marketCap = cap / 1_000_000;
      }
    }
  }

  if (out.pe == null && out.marketCap == null && out.week52High == null) return null;
  return out;
}

type CalHit = {
  symbol: string;
  date: string;
  hour: "bmo" | "amc" | "intraday";
  epsEstimate?: number | null;
  confirmed: boolean;
};

function hourFrom(raw?: string): "bmo" | "amc" | "intraday" {
  const h = (raw ?? "").toLowerCase();
  if (h === "bmo" || h.includes("before") || h === "amc-bmo") return "bmo";
  if (h === "amc" || h.includes("after")) return "amc";
  return "amc";
}

async function calendarRotated(
  symbols: string[],
  from: string | undefined,
  to: string | undefined,
  keys: { finnhub?: string; alphaVantage?: string },
): Promise<CalHit[]> {
  const want = new Set(symbols.map((s) => s.toUpperCase()));
  const fromD = from ?? new Date().toISOString().slice(0, 10);
  const toD = to ?? new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);

  if (keys.finnhub) {
    const url =
      want.size === 1
        ? `https://finnhub.io/api/v1/calendar/earnings?from=${fromD}&to=${toD}&symbol=${encodeURIComponent([...want][0]!)}&token=${encodeURIComponent(keys.finnhub)}`
        : `https://finnhub.io/api/v1/calendar/earnings?from=${fromD}&to=${toD}&token=${encodeURIComponent(keys.finnhub)}`;
    const raw = (await getJson(url, "fh-cal")) as {
      earningsCalendar?: { symbol?: string; date?: string; hour?: string; epsEstimate?: number }[];
    } | null;
    const list = raw?.earningsCalendar;
    if (Array.isArray(list) && list.length) {
      return list
        .filter((r) => r.symbol && r.date && (want.size === 0 || want.has(r.symbol.toUpperCase())))
        .map((r) => ({
          symbol: r.symbol!.toUpperCase(),
          date: r.date!,
          hour: hourFrom(r.hour),
          epsEstimate: typeof r.epsEstimate === "number" ? r.epsEstimate : null,
          confirmed: Boolean(r.hour),
        }));
    }
  }

  if (keys.alphaVantage) {
    const text = await getText(
      `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${encodeURIComponent(keys.alphaVantage)}`,
      "av-cal",
    );
    if (text && text.includes("symbol")) {
      const rows = text.trim().split(/\r?\n/).slice(1);
      const hits: CalHit[] = [];
      for (const row of rows) {
        const [sym, , reportDate, , estimate] = row.split(",");
        if (!sym || !reportDate) continue;
        const S = sym.toUpperCase();
        if (want.size && !want.has(S)) continue;
        if (reportDate < fromD || reportDate > toD) continue;
        hits.push({
          symbol: S,
          date: reportDate,
          hour: "amc",
          epsEstimate: num(estimate) ?? null,
          confirmed: false,
        });
        if (hits.length >= 40) break;
      }
      return hits;
    }
  }
  return [];
}

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

async function macroRotated(series: string, keys: { finnhub?: string; alphaVantage?: string }) {
  const from = isoDaysAgo(40);
  const to = isoDaysAgo(-2);

  if (keys.finnhub) {
    const raw = (await getJson(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(keys.finnhub)}`,
      "fh-econ",
    )) as {
      economicCalendar?: { event?: string; actual?: number; previous?: number; time?: string; country?: string; unit?: string }[];
    } | null;
    const list = raw?.economicCalendar;
    if (Array.isArray(list)) {
      const needle =
        series === "cpi"
          ? /consumer price|cpi/i
          : series === "fomc"
            ? /federal funds|fomc|fed rate/i
            : series === "nfp"
              ? /nonfarm|non-farm|payroll/i
              : series === "gdp"
                ? /gdp/i
                : series === "ppi"
                  ? /producer price|ppi/i
                  : /ism|pmi/i;
      const us = list.filter((e) => (e.country ?? "US") === "US" && e.event && needle.test(e.event) && e.actual != null);
      const hit = us.sort((a, b) => String(b.time).localeCompare(String(a.time)))[0];
      if (hit && hit.actual != null) {
        return {
          value: formatMacroValue(series, hit.actual, hit.unit),
          prior: hit.previous != null ? formatMacroValue(series, hit.previous, hit.unit) : undefined,
          asOf: hit.time ?? new Date().toISOString(),
          source: "Finnhub",
        };
      }
    }
  }

  if (keys.alphaVantage) {
    const fn =
      series === "cpi"
        ? "INFLATION"
        : series === "fomc"
          ? "FEDERAL_FUNDS_RATE"
          : series === "nfp"
            ? "NONFARM_PAYROLL"
            : series === "gdp"
              ? "REAL_GDP"
              : series === "ppi"
                ? "CPI"
                : "INFLATION";
    const raw = (await getJson(
      `https://www.alphavantage.co/query?function=${fn}&interval=monthly&apikey=${encodeURIComponent(keys.alphaVantage)}`,
      "av-macro",
    )) as { data?: { date?: string; value?: string }[]; name?: string; unit?: string } | null;
    const d0 = raw?.data?.[0];
    const d1 = raw?.data?.[1];
    if (d0?.value) {
      const n = Number(d0.value);
      return {
        value: formatMacroValue(series, n, raw?.unit),
        prior: d1?.value ? formatMacroValue(series, Number(d1.value), raw?.unit) : undefined,
        asOf: d0.date ?? new Date().toISOString(),
        source: "Alpha Vantage",
      };
    }
  }

  if (series === "fomc") {
    const raw = (await getJson(
      "https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json",
      "nyfed-effr",
    )) as { refRates?: { percentRate?: number; effectiveDate?: string }[]; data?: { percentRate?: number }[] } | null;
    const r = raw?.refRates?.[0] ?? raw?.data?.[0];
    const rate = r?.percentRate;
    if (typeof rate === "number") {
      return {
        value: `${rate.toFixed(2)}%`,
        asOf: (r as { effectiveDate?: string })?.effectiveDate ?? new Date().toISOString(),
        source: "NY Fed",
      };
    }
  }

  if (series === "cpi") {
    const year = new Date().getFullYear();
    const raw = (await getJson(
      `https://api.bls.gov/publicAPI/v2/timeseries/data/CUSR0000SA0?startyear=${year - 1}&endyear=${year}`,
      "bls-cpi",
    )) as { Results?: { series?: { data?: { year?: string; period?: string; value?: string }[] }[] } } | null;
    const rows = raw?.Results?.series?.[0]?.data;
    if (rows?.[0]?.value) {
      return {
        value: `${Number(rows[0].value).toFixed(1)} idx`,
        prior: rows[1]?.value ? `${Number(rows[1].value).toFixed(1)} idx` : undefined,
        asOf: `${rows[0].year}-${String(rows[0].period ?? "").replace("M", "")}-01`,
        source: "BLS",
      };
    }
  }

  return null;
}

function formatMacroValue(series: string, n: number, unit?: string): string {
  if (!Number.isFinite(n)) return "—";
  if (series === "nfp") {
    if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(1)}M`;
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${Math.abs(n).toFixed(0)}k`;
  }
  if (series === "fomc" || series === "cpi" || series === "ppi" || (unit && /percent|%/i.test(unit))) {
    return `${n.toFixed(2)}%`;
  }
  if (series === "gdp") return `${n.toFixed(1)}%`;
  return n.toFixed(2);
}
