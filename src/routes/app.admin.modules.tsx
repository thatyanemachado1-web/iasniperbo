import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bot, ChevronDown, CreditCard, Save, Settings2, Star, Tag, Volume2 } from "lucide-react";
import {
  getAdminPlanOffers,
  getLocalAiAdmin,
  getModuleToggles,
  readAdminSession,
  updateAdminPlanOffer,
  updateLocalAiAdmin,
  updateModuleToggles,
  type AdminPlanOffer,
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
  const [planOffers, setPlanOffers] = useState<AdminPlanOffer[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string>("premium");
  const [savingPlan, setSavingPlan] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return;
    getModuleToggles(session)
      .then(setToggles)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar modulos."));
    getAdminPlanOffers(session)
      .then(setPlanOffers)
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao carregar planos."));
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

  function updatePlanDraft(planId: AdminPlanOffer["id"], patch: Partial<AdminPlanOffer>) {
    setPlanOffers((current) => current.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan)));
  }

  async function savePlan(plan: AdminPlanOffer, patch: Partial<AdminPlanOffer> = plan) {
    if (!session) return;
    setSavingPlan(plan.id);
    setError("");
    setSuccess("");
    try {
      const data = await updateAdminPlanOffer(session, plan.id, patch);
      setPlanOffers(data.plans);
      setSuccess(`${data.plan.name} salvo com sucesso.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar plano.");
    } finally {
      setSavingPlan("");
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
      <GlassCard className="border-gold/30">
        <SectionTitle
          title="PLANOS E OFERTAS"
          subtitle="Ative, desative e ajuste promocionais exibidos no checkout."
          right={<CreditCard className="size-5 text-gold" />}
        />
        {error && <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        {success && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300">{success}</div>}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {planOffers.map((plan) => (
            <PlanOfferCard
              key={plan.id}
              plan={plan}
              expanded={expandedPlan === plan.id}
              saving={savingPlan === plan.id}
              onExpand={() => setExpandedPlan((current) => (current === plan.id ? "" : plan.id))}
              onChange={(patch) => updatePlanDraft(plan.id, patch)}
              onSave={(patch) => void savePlan({ ...plan, ...patch }, patch)}
            />
          ))}
        </div>
      </GlassCard>

      <GlassCard className="border-neon-cyan/25">
        <SectionTitle title="CONFIGURAR MODULOS" subtitle="Ative ou desative recursos operacionais do painel." right={<Settings2 className="size-5 text-neon-cyan" />} />
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
          right={<AppBadge tone={localAiStatus.online ? "green" : "amber"}>{localAiStatus.status}</AppBadge>}
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

function PlanOfferCard({
  plan,
  expanded,
  saving,
  onExpand,
  onChange,
  onSave,
}: {
  plan: AdminPlanOffer;
  expanded: boolean;
  saving: boolean;
  onExpand: () => void;
  onChange: (patch: Partial<AdminPlanOffer>) => void;
  onSave: (patch: Partial<AdminPlanOffer>) => void;
}) {
  const nextActive = !plan.isActive;
  return (
    <div className="rounded-2xl border border-gold/20 bg-background/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onExpand} className="flex min-w-0 items-center gap-3 text-left">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            {plan.isFeatured ? <Star className="size-5" /> : <Tag className="size-5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-black">{plan.name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {formatAdminMoney(plan.price)} / mes {plan.oldPrice > plan.price ? `- de ${formatAdminMoney(plan.oldPrice)}` : ""}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <AppBadge tone={plan.isActive ? "green" : "amber"}>{plan.isActive ? "Ativo" : "Fechado"}</AppBadge>
          <button
            type="button"
            onClick={() => onSave({ isActive: nextActive, status: nextActive ? "active" : "inactive" })}
            disabled={saving}
            className={`rounded-xl px-3 py-2 text-xs font-black ${plan.isActive ? "border border-destructive/40 text-destructive" : "btn-primary-grad"}`}
          >
            {plan.isActive ? "Desativar" : "Ativar"}
          </button>
          <button type="button" onClick={onExpand} className="rounded-xl border border-border/60 p-2 text-muted-foreground hover:text-foreground">
            <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField label="Nome" value={plan.name} onChange={(value) => onChange({ name: value })} onBlur={() => undefined} />
            <AdminField label="Selo promocional" value={plan.badgeText} onChange={(value) => onChange({ badgeText: value })} onBlur={() => undefined} />
            <AdminField label="Preco atual" value={String(plan.price)} onChange={(value) => onChange({ price: Number(value.replace(",", ".")) || 0 })} onBlur={() => undefined} />
            <AdminField label="Preco antigo" value={String(plan.oldPrice)} onChange={(value) => onChange({ oldPrice: Number(value.replace(",", ".")) || 0 })} onBlur={() => undefined} />
            <SelectField
              label="Status"
              value={plan.status}
              options={[
                ["promo", "Promocional"],
                ["active", "Ativo normal"],
                ["inactive", "Inativo"],
                ["sold_out", "Esgotado"],
              ]}
              onChange={(value) => onChange({ status: value as AdminPlanOffer["status"], isActive: value !== "inactive" && value !== "sold_out" })}
            />
            <label className="flex items-center justify-between rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-3">
              <span className="font-black">Plano em destaque</span>
              <input type="checkbox" checked={plan.isFeatured} onChange={(event) => onChange({ isFeatured: event.target.checked })} />
            </label>
          </div>
          <AdminTextarea label="Descricao" value={plan.description} onChange={(value) => onChange({ description: value })} />
          <AdminTextarea label="Beneficios, um por linha" value={plan.benefits.join("\n")} onChange={(value) => onChange({ benefits: value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
          <AdminField label="Link do checkout Hubla" value={plan.checkoutUrl} onChange={(value) => onChange({ checkoutUrl: value })} onBlur={() => undefined} />
          <button
            type="button"
            onClick={() => onSave(plan)}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black btn-primary-grad disabled:opacity-60"
          >
            <Save className="size-4" />
            {saving ? "Salvando..." : "Salvar plano"}
          </button>
        </div>
      )}
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

function AdminTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-3">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full resize-y rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-neon-cyan"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-neon-cyan/15 bg-background/35 px-4 py-3">
      <span className="mb-2 block text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none focus:border-neon-cyan"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatAdminMoney(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount || 0);
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
