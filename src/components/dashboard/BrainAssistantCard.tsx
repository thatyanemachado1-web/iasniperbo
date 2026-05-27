import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { Mic } from "lucide-react";
import { useState } from "react";

export function BrainAssistantCard() {
  const [active, setActive] = useState(false);
  return (
    <GlassCard className="relative text-center flex flex-col items-center overflow-hidden">
      <NeuralLines cx={50} cy={32} count={10} opacity={0.45} reach={1.1} />
      <div className="relative">
        <BrainAI size={140} speaking={active} />
      </div>
      <div className="relative mt-2 text-sm">
        {active ? "Estou analisando a mesa em tempo real." : "IA acompanhando a mesa"}
      </div>
      <button
        onClick={() => setActive((v) => !v)}
        className="relative mt-4 size-14 rounded-full btn-primary-grad flex items-center justify-center glow-blue"
      >
        <Mic className="size-6" />
      </button>
      <div className="relative mt-2 text-[11px] uppercase tracking-widest text-neon-cyan/80">
        {active ? "Narrando" : "Toque para falar"}
      </div>
    </GlassCard>
  );
}
