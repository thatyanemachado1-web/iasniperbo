import { cn } from "@/lib/utils";
import type { SurfAlert } from "@/types/dashboard";

const ROAD_PANELS = [
  ["Big Road", "big_road"],
  ["Big Eye Boy", "big_eye_boy"],
  ["Small Road", "small_road"],
  ["Cockroach Pig", "cockroach_pig"],
] as const;

export function SurfRoadPanelsStrip({ alert }: { alert: SurfAlert }) {
  return (
    <section className="rounded-2xl border border-neon-cyan/12 bg-background/18 px-3 py-2 shadow-[0_0_26px_-22px_var(--neon-cyan)]">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {ROAD_PANELS.map(([label, key]) => (
          <RoadPanel key={key} label={label} value={alert.panels[key]} />
        ))}
      </div>
    </section>
  );
}

function RoadPanel({ label, value }: { label: string; value: string }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/45 bg-secondary/16 px-3 py-2",
        "text-[11px] leading-snug",
      )}
    >
      <div className="font-semibold text-neon-cyan">{label}</div>
      <div className="mt-1 text-muted-foreground">{value}</div>
    </div>
  );
}
