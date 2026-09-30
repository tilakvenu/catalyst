// Back4App's Cloud Code runtime (Node 19.9.0) formats en-CA dates as MM/DD/YYYY: its ICU build lacks
// en-CA locale data and falls back to en-US. The C67 modules use en-CA date-only formatting to get
// YYYY-MM-DD keys (calendar.ts nyDateKey for holiday lookup, scoring.ts nyDayKey). Rather than edit the
// shared modules, the server restores exactly that case: en-CA with year/month/day only is rebuilt from
// en-US formatToParts in the same time zone. Everything else goes to the native Intl.DateTimeFormat.

type Opts = Intl.DateTimeFormatOptions;

export function enCaSample(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.UTC(2026, 0, 2)));
}

let installed = false;
export const enCaShimInstalled = () => installed;

/** Installs the shim if en-CA is broken (or if forced, for tests). Idempotent. */
export function installEnCaShim(force = false): boolean {
  if (installed || (!force && enCaSample() === "2026-01-02")) return installed;
  const Native = Intl.DateTimeFormat;
  const isDateOnly = (o: Opts) => !!(o.year && o.month && o.day) && !o.hour && !o.minute && !o.second && !o.weekday && !o.era;

  function Shim(locales?: string | string[], options?: Opts): Intl.DateTimeFormat {
    const first = Array.isArray(locales) ? locales[0] : locales;
    const opts = options ?? {};
    if (first !== "en-CA" || !isDateOnly(opts)) return new Native(locales, options);
    const inner = new Native("en-US", { ...opts, year: "numeric", month: "2-digit", day: "2-digit" });
    const format = (d?: Date | number) => {
      const parts = inner.formatToParts(d);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
      return `${get("year")}-${get("month")}-${get("day")}`;
    };
    return new Proxy(inner, {
      get(target, key) {
        if (key === "format") return format;
        const v = Reflect.get(target, key, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
  }
  Object.assign(Shim, { supportedLocalesOf: Native.supportedLocalesOf.bind(Native) });
  Object.defineProperty(Shim, "prototype", { value: Native.prototype });
  (Intl as { DateTimeFormat: unknown }).DateTimeFormat = Shim;
  installed = true;
  return true;
}
