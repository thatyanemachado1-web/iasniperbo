import { GlassCard } from "@/components/ui-app/GlassCard";
import { CircularProgress } from "@/components/ui-app/CircularProgress";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { ChevronRight } from "lucide-react";

interface ScoreItem { label: string; value: number; tone?: string; }

interface Props {
  title: string;
  assertiveness: number;
  items: ScoreItem[];
  note?: string;
  color?: string;
  onDetails?: () => void;
}

export function ScoreboardCard({ title, assertiveness, items, note, color = "var(--neon-blue)", onDetails }: Props) {
  return (
    <GlassCard>
      <SectionTitle title={title} />
      <div className="flex items-center gap-4">
        <CircularProgress value={assertiveness} color={color} size={90} stroke={8} sublabel="Assertividade" />
        <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
          {items.map((it) => (
            <div key={it.label} className="rounded-lg bg-secondary/40 p-2 text-center">
              <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{it.label}</div>
              <div className="text-base font-bold" style={{ color: it.tone }}>{it.value}</div>
            </div>
          ))}
        </div>
      </div>
      {note && <div className="mt-2 text-[11px] text-muted-foreground">{note}</div>}
      <button onClick={onDetails} className="mt-2 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-blue">
        Ver detalhes <ChevronRight className="size-3" />
      </button>
    </GlassCard>
  );
}