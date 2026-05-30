import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Switch } from "@/components/ui/switch";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import type { DashboardData } from "@/types/dashboard";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";

type BrainAssistantCardProps = {
  data: DashboardData;
  mode: "mock" | "fallback" | "connecting" | "live";
  locked?: boolean;
};

export function BrainAssistantCard({ data, mode, locked = false }: BrainAssistantCardProps) {
  const voice = useVoiceAssistant(data, locked ? "fallback" : mode);
  const voiceEnabled = !locked && voice.enabled;
  const active = voiceEnabled && voice.isSpeaking;
  const liveReady = !locked && voice.hasLiveBackendData;

  useEffect(() => {
    if (locked && voice.enabled) voice.setEnabled(false);
  }, [locked, voice.enabled, voice.setEnabled]);

  return (
    <GlassCard className="relative text-center flex flex-col items-center overflow-hidden gap-3">
      <NeuralLines cx={50} cy={32} count={10} opacity={0.45} reach={1.1} />
      <div className="relative flex w-full items-center justify-between gap-2">
        <AppBadge tone={voiceEnabled ? "green" : "muted"} pulse={active}>
          Assistente de Voz IA
        </AppBadge>
        <AppBadge tone={liveReady ? "blue" : "amber"}>
          {liveReady ? "Dados ao vivo" : "Aguardando API"}
        </AppBadge>
      </div>
      <div className="relative">
        <BrainAI size={140} speaking={active} />
      </div>
      <div className="relative text-sm">
        {active ? "Narrando a mesa em tempo real." : "IA acompanhando a mesa"}
      </div>
      <p className="relative max-w-[24rem] text-xs leading-relaxed text-muted-foreground">
        Quando ativado, usa a voz gratuita do navegador para narrar em tempo real numero pagante,
        surf, tie, bloqueios e entradas confirmadas.
      </p>

      <label className="relative flex w-full items-center justify-between gap-3 rounded-xl border border-neon-cyan/20 bg-secondary/30 px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block text-xs font-bold">Assistente de Voz</span>
          <span className="block text-[11px] text-muted-foreground">
            {locked ? "Bloqueado" : voiceEnabled ? "Ativado" : "Desativado"}
          </span>
        </span>
        <Switch
          checked={voiceEnabled}
          disabled={!voice.supported || locked}
          onCheckedChange={(checked) => {
            if (!locked) voice.setEnabled(checked);
          }}
          aria-label="Ativar Assistente de Voz IA"
        />
      </label>

      <div className="relative min-h-[3.75rem] w-full rounded-xl border border-border/60 bg-background/25 px-3 py-2 text-left">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Última análise</span>
          {voice.queueLength > 0 && <span>{voice.queueLength} na fila</span>}
        </div>
        <div className="text-xs leading-relaxed text-foreground">
          {voice.latestNarration ||
            (liveReady ? "Aguardando evento relevante." : "Aguardando dados reais do backend.")}
        </div>
      </div>

      {!voice.supported && (
        <div className="relative rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Voz automática indisponível neste navegador.
        </div>
      )}

      <button
        type="button"
        onClick={voice.replayLastNarration}
        disabled={!voice.canReplay || locked}
        className="relative inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/30 px-3 py-2 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Volume2 className="size-4" />
        Ouvir última análise
      </button>

      <div className="relative size-14 rounded-full btn-primary-grad flex items-center justify-center glow-blue">
        {voiceEnabled ? <Mic className="size-6" /> : <VolumeX className="size-6" />}
      </div>
      <div className="relative mt-2 text-[11px] uppercase tracking-widest text-neon-cyan/80">
        {active ? "Narrando" : voiceEnabled ? "Escutando eventos" : "Voz desligada"}
      </div>
    </GlassCard>
  );
}
