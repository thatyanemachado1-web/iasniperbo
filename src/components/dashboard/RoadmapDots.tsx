import type { Round } from "@/types/dashboard";

const colorMap: Record<Round["result"], string> = {
  B: "bg-banker text-white border-banker/50",
  P: "bg-player text-white border-player/50",
  T: "bg-tie text-white border-tie/50",
};

export function RoadmapDots({ rounds, compact = false }: { rounds: Round[]; compact?: boolean }) {
  return (
    <div className={`flex gap-1.5 ${compact ? "overflow-x-auto pb-1" : "flex-wrap"}`}>
      {rounds.map((r) => (
        <div
          key={r.id}
          title={`#${r.id} ${r.bankerScore}x${r.playerScore}`}
          className={`shrink-0 size-7 rounded-full border-2 ${colorMap[r.result]} flex items-center justify-center text-[11px] font-bold shadow-[0_0_10px_-2px_currentColor]`}
        >
          {r.result}
        </div>
      ))}
    </div>
  );
}