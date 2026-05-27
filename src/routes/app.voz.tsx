import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Mic, Volume2, Gauge } from "lucide-react";
import { SectionTitle } from "@/components/ui-app/SectionTitle";

export const Route = createFileRoute("/app/voz")({
  component: VozPage,
});

function VozPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <GlassCard className="relative min-h-[420px] flex flex-col items-center justify-center text-center">
        <AppBadge tone="purple" pulse className="absolute top-3 left-3">Narrador IA</AppBadge>
        <div className="relative">
          <BrainAI size={180} speaking />
        </div>
        <div className="mt-4 flex items-end justify-center gap-1 h-12">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar w-1 rounded-full bg-neon-purple"
              style={{ height: 40, animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>
        <div className="mt-3 text-sm">"Alerta estatístico de Tie ativo em paralelo."</div>
        <button className="mt-5 size-16 rounded-full btn-primary-grad flex items-center justify-center glow-blue">
          <Mic className="size-7" />
        </button>
        <div className="mt-2 text-[11px] uppercase tracking-widest text-neon-cyan/80">Voz ativada</div>
        <PremiumLock
          title="Narrador IA Premium"
          description="Narrador IA disponível no plano Premium"
          intensity="light"
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Controles" subtitle="Personalize o narrador IA" />
        <div className="space-y-4">
          <Control icon={<Volume2 className="size-4" />} label="Volume" value="80%" />
          <Control icon={<Gauge className="size-4" />} label="Velocidade" value="1.0x" />
          <Toggle label="Narrar apenas entradas" />
          <Toggle label="Narrar Tie Alert" defaultOn />
          <Toggle label="Falar última decisão" />
        </div>
      </GlassCard>
    </div>
  );
}

function Control({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className="flex items-center gap-3 flex-1 max-w-[60%]">
        <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
          <div className="h-full w-[70%] bg-gradient-to-r from-neon-blue to-neon-purple" />
        </div>
        <span className="text-xs font-semibold w-10 text-right">{value}</span>
      </div>
    </div>
  );
}
function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer">
      <span>{label}</span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition ${defaultOn ? "bg-neon-blue/70" : "bg-secondary"}`}>
        <span className={`block size-5 rounded-full bg-foreground transition ${defaultOn ? "translate-x-4" : ""}`} />
      </span>
    </label>
  );
}