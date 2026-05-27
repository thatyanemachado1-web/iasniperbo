import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { Mic } from "lucide-react";
import { useState } from "react";

export function BrainAssistantCard() {
  const [active, setActive] = useState(false);
  return (
    <GlassCard className="text-center flex flex-col items-center">
      <BrainAI size={140} speaking={active} />
      <div className="mt-2 text-sm">
        {active ? "Estou analisando a mesa em tempo real." : "IA acompanhando a mesa"}
      </div>
      <button
        onClick={() => setActive((v) => !v)}
        className="mt-4 size-14 rounded-full btn-primary-grad flex items-center justify-center glow-blue"
      >
        <Mic className="size-6" />
      </button>
      <div className="mt-2 text-[11px] uppercase tracking-widest text-neon-cyan/80">
        {active ? "Narrando" : "Toque para falar"}
      </div>
    </GlassCard>
  );
}