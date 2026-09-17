import { useState } from "react";
import { useCatalyst } from "@/lib/catalyst/store";
import type { NotifyLead, ThemePref } from "@/lib/catalyst/types";
import { cn } from "@/lib/utils";
import { CatalystMark } from "./mark";
import { PrimaryButton, SecondaryButton } from "./ui";

export function SettingsScreen() {
  const store = useCatalyst();
  const [confirm, setConfirm] = useState<"empty" | "demo" | null>(null);

  return (
    <div className="px-4 pb-28 pt-1">
      <header className="mb-4 flex items-end justify-between pt-1">
        <h1 className="text-[34px] font-bold leading-none tracking-tight">Settings</h1>
        <CatalystMark size={32} className="text-[var(--fg)]" />
      </header>

      <Group title="Notifications">
        <Row label="Alert timing">
          <select
            value={store.notifyLead}
            onChange={(e) => store.setNotifyLead(e.target.value as NotifyLead)}
            className="h-9 rounded-[10px] px-2 text-[13px] outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          >
            <option value="both">24 hours and 1 hour</option>
            <option value="24h">24 hours only</option>
            <option value="1h">1 hour only</option>
          </select>
        </Row>
        <p className="px-4 pb-3 text-[12px] leading-relaxed text-[var(--fg-faint)]">
          Local alerts fire on the device when an event is added to the timeline. No push server.
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof Notification !== "undefined" && Notification.permission === "default") {
              void Notification.requestPermission().finally(() => store.fireDebugNotification());
            } else {
              store.fireDebugNotification();
            }
          }}
          className="mx-4 mb-4 h-11 w-[calc(100%-2rem)] rounded-[14px] text-[15px] font-semibold fill-accent"
        >
          Fire a notification now
        </button>
      </Group>

      <Group title="Data">
        <Row label="Demo mode">
          <Toggle on={store.demoMode} onChange={store.setDemoMode} />
        </Row>
        <Row label="Source">
          <select
            value={store.dataSource}
            onChange={(e) => store.setDataSource(e.target.value as "fixture" | "live")}
            className="h-9 rounded-[10px] px-2 text-[13px] outline-none"
            style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
          >
            <option value="fixture">Fixture dataset</option>
            <option value="live">Live APIs</option>
          </select>
        </Row>
        {!store.demoMode ? (
          <div className="space-y-2 px-4 pb-4">
            <p className="text-[12px] text-[var(--fg-muted)]">
              Keys stay on this device. If a source 429s it cools off and the next one answers.
              Quote: Finnhub → Alpha Vantage → Stooq. News: Finnhub company-news → NewsAPI.
              Earnings history: Finnhub → Alpha Vantage. Calendar: Finnhub → Alpha Vantage.
              Metrics: Finnhub metric/profile → Alpha Vantage overview. Macro prints: Finnhub
              economic calendar → Alpha Vantage series → NY Fed / BLS.
            </p>
            <KeyField
              label="Finnhub"
              value={store.liveKeys.finnhub}
              onChange={(v) => store.setLiveKey("finnhub", v)}
            />
            <KeyField
              label="Alpha Vantage"
              value={store.liveKeys.alphaVantage}
              onChange={(v) => store.setLiveKey("alphaVantage", v)}
            />
            <KeyField
              label="NewsAPI"
              value={store.liveKeys.newsapi}
              onChange={(v) => store.setLiveKey("newsapi", v)}
            />
          </div>
        ) : null}
      </Group>

      <Group title="Appearance">
        <Row label="Theme">
          <div className="flex gap-1">
            {(["dark", "light", "system"] as ThemePref[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => store.setTheme(t)}
                className={cn(
                  "h-8 rounded-full px-3 text-[12px] font-medium capitalize",
                  store.theme === t ? "fill-accent" : "",
                )}
                style={
                  store.theme === t
                    ? undefined
                    : { background: "var(--bg-elevated)", color: "var(--fg-muted)" }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
      </Group>

      <Group title="Account">
        <Row label="Workspace">
          <span className="text-[13px] text-[var(--fg-muted)]">On this device</span>
        </Row>
        <p className="px-4 pb-4 text-[12px] leading-relaxed text-[var(--fg-faint)]">
          Single-user. No login, no cloud. Journal entries never leave the phone.
        </p>
      </Group>

      <Group title="Seed">
        <p className="px-4 pt-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
          Restore the full demo, or reset to empty states so every blank screen can be reached.
        </p>
        <div className="flex flex-col gap-2 p-4">
          <PrimaryButton onClick={() => setConfirm("demo")}>Restore demo data</PrimaryButton>
          <SecondaryButton onClick={() => setConfirm("empty")}>Reset to empty</SecondaryButton>
        </div>
      </Group>

      <Group title="About">
        <div className="px-4 py-4">
          <p className="wordmark text-[12px] text-[var(--fg-faint)]">Catalyst</p>
          <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
            Calls. Catalysts. Score. A journal for the events that actually move a name — and a
            scoreboard that only counts complete calls.
          </p>
          <p className="mt-3 text-[12px] text-[var(--fg-faint)]">
            Live mode rotates free endpoints so one dead key does not blank the tape. Calendar
            dates for watched names fill the timeline automatically. This web build is the class
            demo; native Swift lives alongside for Xcode.
          </p>
        </div>
      </Group>

      {confirm ? (
        <div className="dim fixed inset-0 z-50 flex items-end justify-center p-4">
          <div className="w-full max-w-sm rounded-[22px] p-5" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-[17px] font-semibold">
              {confirm === "empty" ? "Reset to empty?" : "Restore demo?"}
            </p>
            <p className="mt-1 text-[14px] text-[var(--fg-muted)]">
              {confirm === "empty"
                ? "Watchlist, timeline, notes, and scored calls will be cleared on this device."
                : "Replaces local data with the fixture dataset."}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <PrimaryButton
                onClick={() => {
                  if (confirm === "empty") store.resetEmpty();
                  else store.restoreDemo();
                  setConfirm(null);
                }}
              >
                Confirm
              </PrimaryButton>
              <SecondaryButton onClick={() => setConfirm(null)}>Cancel</SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[22px]" style={{ background: "var(--bg-card)" }}>
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={{ boxShadow: "inset 0 -0.5px 0 var(--hairline)" }}
    >
      <span className="text-[15px]">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative h-8 w-14 rounded-full"
      style={{ background: on ? "var(--color-positive)" : "var(--fill-urgency)" }}
    >
      <span
        className="absolute top-1 size-6 rounded-full bg-white transition-transform duration-200"
        style={{ transform: on ? "translateX(24px)" : "translateX(4px)" }}
      />
    </button>
  );
}

function KeyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-[var(--fg-faint)]">{label}</span>
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste key"
        className="mt-1 h-10 w-full rounded-[12px] px-3 text-[14px] outline-none"
        style={{ background: "var(--bg-elevated)", color: "var(--fg)" }}
      />
    </label>
  );
}
