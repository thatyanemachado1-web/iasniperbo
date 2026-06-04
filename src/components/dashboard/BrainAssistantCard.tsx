import { GlassCard } from "@/components/ui-app/GlassCard";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { AppBadge } from "@/components/ui-app/AppBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useVoiceAssistant,
  type BrowserVoiceChoice,
  type VoiceProvider,
} from "@/hooks/useVoiceAssistant";
import { buildAssistantCopy } from "@/lib/operationalCopy";
import type { VoiceNarrationStyle } from "@/lib/voiceNarrative";
import type { AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";
import type { DashboardData } from "@/types/dashboard";
import { Mic, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";

type BrainAssistantCardProps = {
  data: DashboardData;
  mode: "mock" | "fallback" | "connecting" | "live";
  adaptiveSnapshot?: AdaptiveStrategySnapshot;
  locked?: boolean;
};

export function BrainAssistantCard({ data, mode, adaptiveSnapshot, locked = false }: BrainAssistantCardProps) {
  const voice = useVoiceAssistant(data, locked ? "fallback" : mode, adaptiveSnapshot);
  const voiceEnabled = !locked && voice.enabled;
  const active = voiceEnabled && voice.isSpeaking;
  const liveReady = !locked && voice.hasLiveBackendData;
  const operationalMessage = buildAssistantCopy(data);

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
        Quando ativado, usa Edge TTS local e fallback Web Speech para narrar numero pagante,
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

      <div className="relative w-full rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-left">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold">Estilo da narracao</span>
          <span className="text-[11px] text-muted-foreground">
            {voice.style === "aggressive"
              ? "Agressivo"
              : voice.style === "discreet"
                ? "Discreto"
                : "Profissional"}
          </span>
        </div>
        <ToggleGroup
          type="single"
          value={voice.style}
          onValueChange={(value) => {
            if (value && !locked) voice.setStyle(value as VoiceNarrationStyle);
          }}
          className="grid w-full grid-cols-3 rounded-lg bg-background/35 p-1"
          disabled={locked}
        >
          <ToggleGroupItem
            value="discreet"
            className="h-8 rounded-md text-[11px] font-bold data-[state=on]:bg-neon-cyan/15 data-[state=on]:text-neon-cyan"
          >
            Discreta
          </ToggleGroupItem>
          <ToggleGroupItem
            value="professional"
            className="h-8 rounded-md text-[11px] font-bold data-[state=on]:bg-neon-blue/15 data-[state=on]:text-neon-blue"
          >
            Profissional
          </ToggleGroupItem>
          <ToggleGroupItem
            value="aggressive"
            className="h-8 rounded-md text-[11px] font-bold data-[state=on]:bg-neon-purple/15 data-[state=on]:text-neon-purple"
          >
            Agressivo
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          A IA fala como analista ao vivo, sem prometer ganho e sem inventar dados.
        </p>
      </div>

      <div className="relative w-full rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-left">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold">Provedor de voz</span>
          <span className="text-[11px] text-muted-foreground">
            {voice.provider === "edge-tts"
              ? "Edge TTS"
              : voice.provider === "browser"
                ? "Navegador"
                : "Futuro"}
          </span>
        </div>
        <Select
          value={voice.provider}
          disabled={locked}
          onValueChange={(value) => voice.setProvider(value as VoiceProvider)}
        >
          <SelectTrigger className="h-9 border-neon-cyan/20 bg-background/35 text-xs">
            <SelectValue placeholder="Edge TTS" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edge-tts">Edge TTS local</SelectItem>
            <SelectItem value="browser">Web Speech navegador</SelectItem>
            <SelectItem value="piper">Piper futuro</SelectItem>
          </SelectContent>
        </Select>

        <div className="mb-2 mt-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold">Voz escolhida</span>
          <span className="text-[11px] text-muted-foreground">pt-BR Antonio</span>
        </div>
        <Select
          value={voice.voiceChoice}
          disabled={locked}
          onValueChange={(value) => voice.setVoiceChoice(value as BrowserVoiceChoice)}
        >
          <SelectTrigger className="h-9 border-neon-cyan/20 bg-background/35 text-xs">
            <SelectValue placeholder="pt-BR Antonio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pt-BR-AntonioNeural">pt-BR Antonio Neural</SelectItem>
            <SelectItem value="browser_auto">Automatico do navegador</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Se o Edge TTS falhar, o navegador assume com speechSynthesis.
        </p>
      </div>

      <div className="relative w-full space-y-3 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-left">
        <VoiceSlider label="Volume" value={voice.volume} min={0} max={1} step={0.05} onChange={voice.setVolume} />
        <VoiceSlider label="Velocidade" value={voice.rate} min={0.7} max={1.35} step={0.05} onChange={voice.setRate} />
        <VoiceSlider label="Tom" value={voice.pitch} min={0.6} max={1.45} step={0.05} onChange={voice.setPitch} />
      </div>

      <div className="relative min-h-[3.75rem] w-full rounded-xl border border-border/60 bg-background/25 px-3 py-2 text-left">
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Ultima analise</span>
          {voice.queueLength > 0 && <span>{voice.queueLength} na fila</span>}
        </div>
        <div className="text-xs leading-relaxed text-foreground">
          {voice.latestNarration ||
            (liveReady ? operationalMessage : "Aguardando dados reais do backend.")}
        </div>
      </div>

      {!voice.supported && (
        <div className="relative rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Voz local indisponivel no momento.
        </div>
      )}
      {voice.voiceError && (
        <div className="relative rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {voice.voiceError}
        </div>
      )}

      <button
        type="button"
        onClick={voice.replayLastNarration}
        disabled={!voice.canReplay || locked}
        className="relative inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neon-cyan/30 px-3 py-2 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Volume2 className="size-4" />
        Ouvir ultima analise
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

function VoiceSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-bold">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </div>
  );
}
