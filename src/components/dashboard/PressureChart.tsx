import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { PressurePoint } from "@/types/dashboard";

export function PressureChart({ data }: { data: PressurePoint[] }) {
  return (
    <div className="h-44 w-full -ml-2">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lineB" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="oklch(0.65 0.23 27)" />
              <stop offset="100%" stopColor="oklch(0.7 0.22 30)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="color-mix(in oklab, var(--neon-blue) 10%, transparent)" strokeDasharray="3 3" />
          <XAxis dataKey="index" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.17 0.03 260)",
              border: "1px solid color-mix(in oklab, var(--neon-blue) 30%, transparent)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Line type="monotone" dataKey="banker" stroke="oklch(0.65 0.23 27)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="player" stroke="oklch(0.65 0.22 245)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="tie" stroke="oklch(0.65 0.25 295)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}