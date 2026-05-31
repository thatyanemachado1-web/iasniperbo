import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import type { PressurePoint } from "@/types/dashboard";

export function PressureChart({ data }: { data: PressurePoint[] }) {
  return (
    <div className="digital-chart-panel relative h-52 w-full overflow-hidden rounded-xl border border-neon-cyan/10 bg-background/25">
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.035]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent" />
      <div className="relative h-full w-full -ml-2 pt-3">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="lineBanker" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.62 0.18 27)" />
                <stop offset="100%" stopColor="oklch(0.72 0.16 35)" />
              </linearGradient>
              <linearGradient id="linePlayer" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--neon-blue)" />
                <stop offset="100%" stopColor="var(--neon-cyan)" />
              </linearGradient>
              <linearGradient id="lineTie" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--deep-purple)" />
                <stop offset="100%" stopColor="var(--neon-purple)" />
              </linearGradient>
              <filter id="chartGlowBanker" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="0.9" floodColor="oklch(0.65 0.2 27)" floodOpacity="0.22" />
              </filter>
              <filter id="chartGlowPlayer" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="0.9" floodColor="var(--neon-cyan)" floodOpacity="0.26" />
              </filter>
              <filter id="chartGlowTie" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="var(--neon-purple)" floodOpacity="0.18" />
              </filter>
            </defs>
            <CartesianGrid
              stroke="color-mix(in oklab, var(--neon-cyan) 10%, transparent)"
              strokeDasharray="2 8"
              verticalFill={["transparent"]}
            />
            <XAxis dataKey="index" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip
              contentStyle={{
                background: "color-mix(in oklab, var(--background) 94%, black)",
                border: "1px solid color-mix(in oklab, var(--neon-cyan) 24%, transparent)",
                borderRadius: 10,
                boxShadow: "0 0 20px -16px color-mix(in oklab, var(--neon-cyan) 60%, transparent)",
                fontSize: 12,
              }}
              cursor={{
                stroke: "color-mix(in oklab, var(--neon-cyan) 32%, transparent)",
                strokeDasharray: "2 6",
              }}
            />
            <Line type="monotone" dataKey="banker" stroke="url(#lineBanker)" strokeWidth={1.8} dot={false} filter="url(#chartGlowBanker)" />
            <Line type="monotone" dataKey="player" stroke="url(#linePlayer)" strokeWidth={1.8} dot={false} filter="url(#chartGlowPlayer)" />
            <Line type="monotone" dataKey="tie" stroke="url(#lineTie)" strokeWidth={1.6} dot={false} filter="url(#chartGlowTie)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
