import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bot, Settings2, Volume2 } from "lucide-react";
import {
  getLocalAiAdmin,
  getModuleToggles,
  readAdminSession,
  updateLocalAiAdmin,
  updateModuleToggles,
  type LocalAiAdminSettings,
  type LocalAiAdminStatus,
} from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import type { ModuleToggles } from "@/types/dashboard";

export const Route = createFileRoute("/app/admin/modules")({
  component: AdminModulesPage,
});

const futureModules = ["Leitura Neural", "Assistente de Voz", "Modo Demonstracao"];

function AdminModulesPage() {
  const session = readEffectiveAdminSession() || readAdminSession();
  const [toggles, setToggles] = useState<ModuleToggles>({ tieAlert: true, surfAnalyzer: true });
  const [localAi, setLocalAi] = useState<LocalAiAdminSettings>(() => defaultLocalAiSettings());
  const [localAiStatus, setLocalAiStatus] = useState<LocalAiAdminStatus>({
    online: false,
    status: "Offline",
    model: "qwen2.5:7b",
    baseUrl: "http://localhost:11434",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    getModuleToggles(session).then(setToggles).catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar modulos."));
    getLocalAiAdmin(session)
      .then((data) => {
        setLocalAi(data.settings);
        setLocalAiStatus(data.status);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar IA local."));
  }, []);

  async function save(next: Partial<ModuleToggles>) {
    if (!session) return;
    try {
      const updated = await updateModuleToggles(session, next);
      setToggles(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar modulo.");
    }
  }

  async function saveLocalAi(next: Partial<LocalAiAdminSettings>) {
    if (!session) return;
    try {
      const data = await updateLocalAiAdmin(session, { ...localAi, ...next });
      setLocalAi(data.settings);
      setLocalAiStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar IA local.");
    }
  }

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">Somente admin ou owner pode configurar modulos.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="border-neon-cyan/25">
        <SectionTitle title="CONFIGURAR MODULOS" subtitle="Ative ou desative recursos operacionais do painel." right={<Settings2 className="size-5 text-neon-cyan" />} />
        {error && <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ModuleSwitch label="Tie Alert" checked={toggles.tieAlert} onChange={(checked) => void save({ tieAlert: checked })} />
          <ModuleSwitch label="Surf Analyzer" checked={toggles.surfAnalyzer} onChange={(checked) => void save({ surfAnalyzer: checked })} />
          {futureModules.map((label) => (
            <ModuleSwitch key={label} label={label} checked disabled onChange={() => undefined} />
          ))}
        </div>
      </GlassCard>

      <GlassCard className="border-neon-purple/25">
        <SectionTitle
          title="IA Local / Voz IA"
          subtitle="Ollama/Qwen explica a mesa. Edge TTS narra; navegador assume se falhar."
          right={
            <AppBadge tone={localAiStatus.online ? "green" : "amber"}>
              {localAiStatus.status}
            </AppBadge>
          }
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ModuleSwitch label="Ativar IA Local" checked={localAi.enabled} onChange={(checked) => void saveLocalAi({ enabled: checked })} />
          <ModuleSwitch label="Ativar Narracao IA" checked={localAi.narrationEnabled} onChange={(checked) => void saveLocalAi({ narrationEnabled: checked })} />
          <AdminField label="URL do Ollama" value={localAi.ollamaBaseUrl} onChange={(value) => setLocalAi((current) => ({ ...current, ollamaBaseUrl: value }))} onBlur={() => void saveLocalAi({ ollamaBaseUrl: localAi.ollamaBaseUrl })} />
          <AdminField label="Modelo Ollama" value={localAi.ollamaModel} onChange={(value) => setLocalAi((current) => ({ ...current, ollamaModel: value }))} onBlur={() => void saveLocalAi({ ollamaModel: localAi.ollamaModel })} />
          <AdminField label="Provedor de voz" value={localAi.voiceProvider} onChange={(value) => setLocalAi((current) => ({ ...current, voiceProvider: value }))} onBlur={() => void saveLocalAi({ voiceProvider: localAi.voiceProvider })} icon={<Volume2 className="size-4" />} />
          <AdminField label="Voz escolhida" value={localAi.voiceName} onChange={(value) => setLocalAi((current) => ({ ...current, voiceName: value }))} onBlur={() => void saveLocalAi({ voiceName: localAi.voiceName })} />
          <AdminField label="Chamadas/minuto" value={String(localAi.callsPerMinute)} onChange={(value) => setLocalAi((current) => ({ ...current, callsPerMinute: Number(value) || 1 }))} onBlur={() => void saveLocalAi({ callsPerMinute: localAi.callsPerMinute })} />
          <AdminField label="Cooldown ms" value={String(localAi.cooldownMs)} onChange={(value) => setLocalAi((current) => ({ ...current, cooldownMs: Number(value) || 0 }))} onBlur={() => void saveLocalAi({ cooldownMs: localAi.cooldownMs })} />
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Bot className="size-4 text-neon-cyan" />
            Teste Ollama
          </div>
          <div className="mt-1">
            Endpoint esperado: {localAiStatus.baseUrl}/api/generate | Modelo: {localAiStatus.model}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function ModuleSwitch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-4">
      <span className="font-black">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function AdminField({
  label,
  value,
  onChange,
  onBlur,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  icon?: ReactNode;
}) {
  return (
    <label className="rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-3">
      <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-neon-cyan"
      />
    </label>
  );
}

function defaultLocalAiSettings(): LocalAiAdminSettings {
  return {
    enabled: true,
    narrationEnabled: true,
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "qwen2.5:7b",
    voiceProvider: "edge-tts",
    voiceName: "pt-BR-AntonioNeural",
    voiceVolume: 0.9,
    voiceRate: 1,
    voicePitch: 0.95,
    callsPerMinute: 12,
    cooldownMs: 8000,
  };
}
