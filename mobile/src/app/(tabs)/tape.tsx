// C67 news.tsx NewsScreen: what materially changed in what you follow, grouped by impact tier then name.
// Impact is magnitude only, on a violet ramp (never red/green). Cache only; "Refresh tape" is a sync.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { EMPTY_COPY } from "../../../../src/lib/catalyst/fixtures.ts";
import { impactWeight, resolveDisplayImpact } from "../../../../src/lib/catalyst/impact.ts";
import { followedEquityTypicals, observedMoveForHeadline, typicalForTicker, upcomingFollowed } from "../../../../src/lib/catalyst/selectors.ts";
import type { Headline, NewsImpact } from "../../../../src/lib/catalyst/types.ts";
import { refresh, useSyncState } from "../../data";
import { router } from "expo-router";
import { Card, Chip, EmptyState, LargeTitle, Press, PrimaryButton, SecondaryButton, TabScreen, useC, wide } from "../../ui/kit";
import { HeadlineRow, openEvent, openTicker } from "../../ui/parts";
import { useSlice, type Slice } from "../../ui/slice";

const TIERS: { id: NewsImpact; label: string }[] = [
  { id: "high", label: "High impact" },
  { id: "medium", label: "Medium impact" },
  { id: "low", label: "Low impact" },
];
type Filter = "all" | NewsImpact | "today";

export default function TapeTab() {
  const c = useC();
  const s = useSlice();
  const sync = useSyncState();
  const [filter, setFilter] = useState<Filter>("all");
  const typicals = followedEquityTypicals(s);
  const displayOf = (h: Headline) =>
    resolveDisplayImpact({ base: h.impact ?? "low", why: h.why, typical: typicalForTicker(s, h.tickerId), followedTypicals: typicals, isMacro: Boolean(h.macroId) && !h.tickerId });

  const followed = useMemo(() => {
    const ids = new Set(s.tickers.map((t) => t.id));
    const macros = new Set(s.macros.map((m) => m.id));
    return s.headlines
      .filter((h) => (h.tickerId && ids.has(h.tickerId)) || (h.macroId && macros.has(h.macroId)))
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }, [s.headlines, s.tickers, s.macros]);

  const startOfDay = new Date(s.now);
  startOfDay.setHours(0, 0, 0, 0);
  const list = followed.filter((h) => {
    if (filter === "today") return new Date(h.publishedAt).getTime() >= startOfDay.getTime();
    if (filter === "all") return true;
    return displayOf(h).impact === filter;
  });
  const byTier = TIERS.map((t) => ({ ...t, items: list.filter((h) => displayOf(h).impact === t.id) })).filter((t) => t.items.length);
  const material = followed.filter((h) => ["high", "medium"].includes(displayOf(h).impact));
  const following = s.tickers.length + s.macros.length > 0;

  return (
    <TabScreen>
      <LargeTitle>Tape</LargeTitle>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18, paddingHorizontal: 4, marginTop: -4, marginBottom: 12 }}>
        What materially changed in what you follow. Impact estimate is magnitude, not direction.
      </Text>

      <Press
        onPress={() => refresh().catch(() => {})}
        disabled={sync.syncing}
        style={{ height: 44, borderRadius: 14, backgroundColor: c.elevated, alignItems: "center", justifyContent: "center", marginBottom: 12 }}
      >
        <Text style={{ color: c.fg, fontSize: 15, fontWeight: "600" }}>{sync.syncing ? "Fetching…" : "Refresh tape"}</Text>
      </Press>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingBottom: 4 }}>
        {(
          [
            ["all", "All"],
            ["high", "High"],
            ["medium", "Medium"],
            ["low", "Low"],
            ["today", "Today"],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} label={label} on={filter === id} onPress={() => setFilter(id)} />
        ))}
      </View>

      {sync.error ? <Text style={{ color: c.warn, fontSize: 12, marginTop: 12 }}>Tape refresh failed. Showing what we already have.</Text> : null}

      {list.length === 0 ? (
        <EmptyState
          title={following ? "Nothing material changed." : EMPTY_COPY.watchlistTitle}
          body={following ? "Quiet is a valid tape. Material filings and street changes land here." : "Follow a name and its material headlines land here."}
          actions={
            following ? (
              filter !== "all" ? <SecondaryButton onPress={() => setFilter("all")}>Show all</SecondaryButton> : undefined
            ) : (
              <PrimaryButton onPress={() => router.push("/watch")}>Follow a name</PrimaryButton>
            )
          }
        />
      ) : (
        <View style={{ marginTop: 16, gap: 20 }}>
          {byTier.map((tier) => (
            <View key={tier.id}>
              <Text
                style={{
                  color: tier.id === "low" ? c.faint : c.muted,
                  fontSize: 13,
                  fontWeight: impactWeight(tier.id) === "semibold" ? "600" : "400",
                  letterSpacing: wide(13),
                  textTransform: "uppercase",
                  paddingHorizontal: 4,
                  marginBottom: 8,
                }}
              >
                {tier.label}
              </Text>
              <View style={{ gap: 12 }}>
                {groupTape(tier.items, s).map((g) => (
                  <Card key={g.key}>
                    <Press
                      onPress={() => {
                        if (g.tickerId) openTicker(g.tickerId);
                        else if (g.macroId) {
                          const ev = upcomingFollowed(s).find((e) => e.macroId === g.macroId);
                          if (ev) openEvent(ev.id);
                        }
                      }}
                      style={{ flexDirection: "row", alignItems: "baseline", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.hairline }}
                    >
                      <Text style={{ color: c.fg, fontSize: 16, fontWeight: "600" }}>{g.kicker}</Text>
                      <Text style={{ color: c.muted, fontSize: 12, marginLeft: 8 }}>{g.countLine}</Text>
                    </Press>
                    {g.items.map((h, i) => {
                      const shown = displayOf(h);
                      return <HeadlineRow key={h.id} h={h} now={s.now} impact={shown.impact} why={shown.why} observed={observedMoveForHeadline(s, h)} last={i === g.items.length - 1} />;
                    })}
                  </Card>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={{ color: c.faint, fontSize: 11, lineHeight: 18, marginTop: 16, paddingHorizontal: 4 }}>
        Impact scores expected materiality only — never up or down. Observed move is shown after the resolving session, separately.
        {material.length === 0 ? " Tape can be quiet." : ""}
      </Text>
    </TabScreen>
  );
}

function groupTape(list: Headline[], s: Slice) {
  const order: string[] = [];
  const map = new Map<string, Headline[]>();
  for (const h of list) {
    const key = h.tickerId ? `t:${h.tickerId}` : h.macroId ? `m:${h.macroId}` : "other";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(h);
  }
  return order.map((key) => {
    const items = map.get(key)!;
    const tickerId = key.startsWith("t:") ? key.slice(2) : undefined;
    const macroId = key.startsWith("m:") ? key.slice(2) : undefined;
    return {
      key,
      kicker: (tickerId && s.allTickers[tickerId]?.symbol) || (macroId && s.allMacros[macroId]?.shortName) || "—",
      tickerId,
      macroId,
      countLine: `${items.length} ${items.length === 1 ? "item" : "items"}`,
      items,
    };
  });
}
