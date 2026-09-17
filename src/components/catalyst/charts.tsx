import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDateShort } from "@/lib/catalyst/format";
import { cn } from "@/lib/utils";

export function Sparkline({
  data,
  positive,
  className,
}: {
  data: number[];
  positive: boolean;
  className?: string;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const color = positive ? "var(--color-positive)" : "var(--color-negative)";
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <polyline fill={color} fillOpacity="0.12" stroke="none" points={fillPts} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

export function AccuracyChart({ points }: { points: { t: string; pct: number }[] }) {
  const data = points.map((p) => ({
    ...p,
    label: formatDateShort(p.t),
    pct: Number(p.pct.toFixed(1)),
  }));
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--hairline)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--fg-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: "var(--fg-faint)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={50} stroke="var(--fg-faint)" strokeDasharray="4 4" />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "0.5px solid var(--hairline)",
              borderRadius: 12,
              color: "var(--fg)",
              fontSize: 12,
            }}
            formatter={(v: number | string) => [`${v}%`, "Rolling"]}
          />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="var(--color-accent)"
            strokeWidth={2.2}
            dot={{ r: 3, fill: "var(--color-accent)", stroke: "none" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
