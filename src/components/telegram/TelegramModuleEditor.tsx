import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, RotateCcw, Save, Send } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type TelegramModuleKey =
  | "ai_patterns"
  | "paying_numbers"
  | "surf_alert"
  | "ties_only"
  | "validator"
  | "lateral_paying_numbers"
  | "lateral_tie_patterns";
export type TelegramButtonConfig = { enabled: boolean; label: string; url: string };
export type TelegramModuleConfig = {
  enabled: boolean;
  entryType: "AUTO" | "BANKER" | "PLAYER" | "TIE";
  galeLimit: number;
  coverTie: boolean;
  tieCoverage: number;
  cooldownSeconds: number;
  template: string;
  analyzingTemplate: string;
  greenTemplate: string;
  galeTemplate: string;
  redTemplate: string;
  tieTemplate: string;
  expiredTemplate: string;
  canceledTemplate: string;
  buttons: TelegramButtonConfig[];
};
type TemplateKey = "entry" | "analyzing" | "green" | "gale" | "red" | "tie";

const MODULE_LABELS: Record<TelegramModuleKey, string> = {
  ai_patterns: "Padrões IA",
  paying_numbers: "Leitura Neural / Número Pagante",
  surf_alert: "Surf Analyzer",
  ties_only: "Radar de Empate",
  validator: "Validador individual",
  lateral_paying_numbers: "Motor lateral — Número pagante",
  lateral_tie_patterns: "Motor de empate — lateral/diagonal/espaçado/horizontal",
};
const DEFAULT_ENTRY: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "🤖 <b>PADRÃO IA CONFIRMADO</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}\n📊 <b>Assertividade:</b> {{confidence}}",
  paying_numbers:
    "💎 <b>NÚMERO PAGANTE CONFIRMADO</b>\n\n🔢 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entryLabel}}\n🛡️ <b>Proteção:</b> {{gale}}\n📌 <b>Status:</b> {{status}}",
  surf_alert:
    "🌊 <b>AVISO DE SURF CONFIRMADO</b>\n\n🎯 <b>Entrada:</b> {{entryCompact}}\n⚠️ <b>Risco:</b> {{risk}}\n📊 <b>Confiança:</b> {{confidence}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only:
    "🟡 <b>POSSÍVEL EMPATE</b>\n\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Cobertura:</b> até G{{tieCoverage}}\n📊 <b>Nível:</b> {{level}}",
  validator:
    "🤖 <b>PADRÃO VALIDADOR</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}\n📊 <b>Assertividade:</b> {{percentage}}",
  lateral_paying_numbers:
    "💎 <b>MOTOR LATERAL — NÚMERO PAGANTE</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n🎯 <b>Entrada:</b> {{entry}}\n📍 <b>Tentativa:</b> {{attempt}}\n🛡️ <b>Proteção:</b> {{gale}}\n📊 <b>Força:</b> {{confidence}}",
  lateral_tie_patterns:
    "🟡 <b>MOTOR DE EMPATE LATERAL</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n🎯 <b>Entrada:</b> {{entry}}\n📍 <b>Tentativa:</b> {{attempt}}\n🛡️ <b>Proteção:</b> {{gale}}\n⚠️ <b>Risco:</b> {{risk}}",
};
const DEFAULT_ANALYZING: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "🔎 <b>ANALISANDO PADRÃO IA</b>\n🎲 <b>Mesa:</b> {{table}}\n⏳ Aguardando confirmação real.",
  paying_numbers:
    "🔎 <b>ANALISANDO NÚMERO PAGANTE</b>\n🔢 <b>Números:</b> {{numbers}}\n⏳ Aguardando confirmação real.",
  surf_alert:
    "🔎 <b>ANALISANDO SURF</b>\n🌊 <b>Direção:</b> {{side}}\n⏳ Aguardando confirmação real.",
  ties_only:
    "🔎 <b>ANALISANDO EMPATE</b>\n🟡 <b>Pressão Tie:</b> {{tie_pressure}}\n⏳ Aguardando confirmação real.",
  validator:
    "🔎 <b>ANALISANDO VALIDADOR</b>\n🧩 <b>Padrão:</b> {{pattern}}\n⏳ Aguardando entrada validada.",
  lateral_paying_numbers:
    "🔎 <b>ANALISANDO MOTOR LATERAL</b>\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n📊 <b>Amostra:</b> {{samples}} · <b>REDs:</b> {{reds}}\n⏳ Aguardando posição lateral confirmada.",
  lateral_tie_patterns:
    "🔎 <b>ANALISANDO EMPATE LATERAL</b>\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n⏳ Aguardando a posição de entrada.",
};
const DEFAULT_GREEN: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "✅ <b>{{result}}</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  paying_numbers:
    "✅ <b>{{result}}</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  surf_alert:
    "✅ <b>{{result}}</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only: "✅ <b>{{result}}</b>\n\n🟡 <b>Empate confirmado</b>\n🛡️ <b>Proteção:</b> {{gale}}",
  validator:
    "✅ <b>{{result}}</b>\n\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  lateral_paying_numbers:
    "✅ <b>{{result}}</b>\n\n💎 <b>Motor:</b> Número pagante lateral\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n🎯 <b>Entrada:</b> {{entry}}\n📍 <b>Resultado:</b> {{attempt}}",
  lateral_tie_patterns:
    "✅ <b>{{result}}</b>\n\n🟡 <b>Empate lateral confirmado</b>\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n💰 <b>Multiplicador:</b> {{tieMultiplier}}\n📍 <b>Resultado:</b> {{attempt}}",
};
const DEFAULT_GALE: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "🛡️ <b>FAZER {{gale}}</b>\n🎯 <b>Entrada:</b> {{entry}}\n🧩 <b>Padrão:</b> {{pattern}}",
  paying_numbers:
    "🛡️ <b>FAZER {{gale}}</b>\n🔢 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}",
  surf_alert:
    "🛡️ <b>FAZER {{gale}}</b>\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}",
  ties_only: "🛡️ <b>COBRIR EMPATE {{gale}}</b>\n🟡 <b>Pressão:</b> {{tie_pressure}}",
  validator:
    "🛡️ <b>FAZER {{gale}}</b>\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}",
  lateral_paying_numbers:
    "🛡️ <b>FAZER {{gale}} — MOTOR LATERAL</b>\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n🎯 <b>Manter entrada:</b> {{entry}}\n📍 <b>Posição:</b> abaixo do SG",
  lateral_tie_patterns:
    "🛡️ <b>FAZER {{gale}} — EMPATE LATERAL</b>\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n🎯 <b>Manter entrada:</b> {{entry}}",
};
const DEFAULT_RED: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "❌ <b>RED</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  paying_numbers:
    "❌ <b>RED</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  surf_alert:
    "❌ <b>RED</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only: "❌ <b>RED</b>\n\n🟡 <b>Empate não confirmou</b>\n🛡️ <b>Proteção:</b> {{gale}}",
  validator:
    "❌ <b>RED</b>\n\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  lateral_paying_numbers:
    "❌ <b>RED — MOTOR LATERAL</b>\n\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção encerrada:</b> {{gale}}\n⚠️ <b>REDs do padrão:</b> {{reds}}",
  lateral_tie_patterns:
    "❌ <b>RED — EMPATE LATERAL</b>\n\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n🛡️ <b>Proteção encerrada:</b> {{gale}}\n⚠️ <b>REDs da formação:</b> {{reds}}",
};
const DEFAULT_TIE: Record<TelegramModuleKey, string> = {
  ai_patterns:
    "🟡 <b>{{result}}</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}",
  paying_numbers:
    "🟡 <b>{{result}}</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n💰 <b>Multiplicador:</b> {{tieMultiplier}}",
  surf_alert: "🟡 <b>{{result}}</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}",
  ties_only:
    "🟡 <b>{{result}}</b>\n\n💰 <b>Multiplicador:</b> {{tieMultiplier}}\n🛡️ <b>Proteção:</b> {{gale}}",
  validator: "🟡 <b>{{result}}</b>\n\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}",
  lateral_paying_numbers:
    "🟡 <b>{{result}}</b>\n\n💎 <b>Motor:</b> Número pagante lateral\n🔢 <b>Gatilho:</b> {{triggerNumber}} {{triggerSide}}\n🎯 <b>Entrada:</b> {{entry}}\n💰 <b>Multiplicador:</b> {{tieMultiplier}}",
  lateral_tie_patterns:
    "🟡 <b>{{result}}</b>\n\n🧩 <b>Formação:</b> {{pattern}}\n📐 <b>Geometria:</b> {{geometry}}\n💰 <b>Multiplicador:</b> {{tieMultiplier}}\n📍 <b>Resultado:</b> {{attempt}}",
};
const TEMPLATE_OPTIONS: Array<{ key: TemplateKey; label: string }> = [
  { key: "entry", label: "Entrada" },
  { key: "analyzing", label: "Analisando" },
  { key: "green", label: "Green" },
  { key: "gale", label: "Gale" },
  { key: "red", label: "Red" },
  { key: "tie", label: "TIE" },
];
const SAMPLE_VARIABLES: Record<string, string> = {
  module: "Sniper BO",
  table: "Bac Bo",
  entry: "🔵 PLAYER",
  entryLabel: "Player",
  entryCompact: "🔵Player",
  gale: "G1",
  protection: "G1",
  result: "GREEN G1",
  time: "14:32",
  round: "123456",
  confidence: "91%",
  percentage: "91%",
  channel: "Sala principal",
  tieCoverage: "1",
  tieProtection: "Ativa",
  tieMultiplier: "4x",
  pattern: "🔴10 → 🔵7 → 🟡6",
  score: "91%",
  side: "Player",
  status: "CONFIRMADO",
  risk: "baixo",
  numbers: "🔴10, 🔵7, 🟡6",
  number: "🔵9",
  level: "Alto",
  tie_pressure: "forte",
  triggerNumber: "🔵11",
  triggerSide: "PLAYER",
  targetSide: "PLAYER",
  attempt: "SG",
  samples: "15",
  reds: "0",
  cycle: "129/200",
  geometry: "uma casa após a lateral",
  firstNumber: "7",
  secondNumber: "6",
};

export function telegramModuleLabel(key: TelegramModuleKey) {
  return MODULE_LABELS[key];
}
export function normalizeTelegramModuleConfigs(value: unknown) {
  const source = asRecord(value);
  return (Object.keys(MODULE_LABELS) as TelegramModuleKey[]).reduce<
    Record<TelegramModuleKey, TelegramModuleConfig>
  >(
    (acc, key) => {
      acc[key] = normalizeTelegramModuleConfig(key, source[key]);
      return acc;
    },
    {} as Record<TelegramModuleKey, TelegramModuleConfig>,
  );
}
export function normalizeTelegramModuleConfig(
  key: TelegramModuleKey,
  value: unknown,
): TelegramModuleConfig {
  const raw = asRecord(value);
  const defaults = defaultTelegramModuleConfig(key);
  return {
    enabled: Object.prototype.hasOwnProperty.call(raw, "enabled")
      ? Boolean(raw.enabled)
      : defaults.enabled,
    entryType: Object.prototype.hasOwnProperty.call(raw, "entryType")
      ? normalizeEntryType(raw.entryType)
      : defaults.entryType,
    galeLimit: clampNumber(raw.galeLimit, defaults.galeLimit, 0, 4),
    coverTie: Object.prototype.hasOwnProperty.call(raw, "coverTie")
      ? Boolean(raw.coverTie)
      : defaults.coverTie,
    tieCoverage: clampNumber(raw.tieCoverage, defaults.tieCoverage, 0, 4),
    cooldownSeconds: clampNumber(raw.cooldownSeconds, defaults.cooldownSeconds, 0, 300),
    template: text(raw.template) || defaults.template,
    analyzingTemplate: text(raw.analyzingTemplate) || defaults.analyzingTemplate,
    greenTemplate: text(raw.greenTemplate) || defaults.greenTemplate,
    galeTemplate: text(raw.galeTemplate) || defaults.galeTemplate,
    redTemplate: text(raw.redTemplate) || defaults.redTemplate,
    tieTemplate: text(raw.tieTemplate) || defaults.tieTemplate,
    expiredTemplate: text(raw.expiredTemplate) || defaults.expiredTemplate,
    canceledTemplate: text(raw.canceledTemplate) || defaults.canceledTemplate,
    buttons: normalizeButtons(raw.buttons, raw),
  };
}

export function TelegramModuleEditor({
  roomId,
  roomName,
  moduleKey,
  initialConfig,
  onSave,
  onPreview,
}: {
  roomId: string;
  roomName: string;
  moduleKey: TelegramModuleKey;
  initialConfig: TelegramModuleConfig;
  onSave: (config: TelegramModuleConfig) => Promise<void>;
  onPreview: (message: string, buttons: TelegramButtonConfig[]) => Promise<void>;
}) {
  const initialSignature = useMemo(() => JSON.stringify(initialConfig), [initialConfig]);
  const [draft, setDraft] = useState(() => normalizeTelegramModuleConfig(moduleKey, initialConfig));
  const [templateKey, setTemplateKey] = useState<TemplateKey>("entry");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const templateOptions =
    moduleKey === "validator"
      ? TEMPLATE_OPTIONS
      : TEMPLATE_OPTIONS.filter((option) => option.key !== "analyzing");
  useEffect(() => {
    const nextConfig = JSON.parse(initialSignature) as unknown;
    setDraft(normalizeTelegramModuleConfig(moduleKey, nextConfig));
    setTemplateKey("entry");
    setError("");
    setStatus("");
  }, [roomId, moduleKey, initialSignature]);
  const activeTemplate = templateValue(draft, templateKey);
  async function save() {
    const validation = validateConfig(moduleKey, draft);
    setError(validation);
    setStatus("");
    if (validation) return;
    setSaving(true);
    try {
      await onSave({ ...draft, buttons: normalizeButtons(draft.buttons) });
      setStatus("Configuração salva e ativada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a configuração.");
    } finally {
      setSaving(false);
    }
  }
  async function preview() {
    const validation = validateTemplate(moduleKey, activeTemplate);
    setError(validation);
    setStatus("");
    if (validation) return;
    setPreviewing(true);
    try {
      await onPreview(
        `[PRÉVIA DE TESTE]\n${renderTemplate(activeTemplate)}`,
        normalizeButtons(draft.buttons),
      );
      setStatus("Prévia enviada no Telegram.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a prévia.");
    } finally {
      setPreviewing(false);
    }
  }
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-3">
      <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/5 px-3 py-2 text-xs">
        <div className="font-black text-neon-cyan">
          {roomName} · {MODULE_LABELS[moduleKey]}
        </div>
        <div className="mt-1 text-muted-foreground">
          Esta proteção vale para as mensagens deste motor. O gale de cada padrão próprio continua
          sendo o gale salvo no Validador.
        </div>
      </div>
      <Field label="Tipo de entrada">
        <Select
          value={draft.entryType}
          onValueChange={(value) =>
            setDraft({ ...draft, entryType: value as TelegramModuleConfig["entryType"] })
          }
        >
          <SelectTrigger className="bg-secondary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO">Automático</SelectItem>
            <SelectItem value="BANKER">Banker</SelectItem>
            <SelectItem value="PLAYER">Player</SelectItem>
            <SelectItem value="TIE">TIE</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Proteção do motor">
          <Select
            value={String(draft.galeLimit)}
            onValueChange={(value) =>
              setDraft({ ...draft, galeLimit: clampNumber(value, 0, 0, 4) })
            }
          >
            <SelectTrigger className="bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sem gale</SelectItem>
              <SelectItem value="1">G1</SelectItem>
              <SelectItem value="2">G2</SelectItem>
              <SelectItem value="3">G3</SelectItem>
              <SelectItem value="4">G4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Intervalo mínimo (s)">
          <Input
            type="number"
            min={0}
            max={300}
            value={draft.cooldownSeconds}
            onChange={(event) =>
              setDraft({ ...draft, cooldownSeconds: clampNumber(event.target.value, 0, 0, 300) })
            }
          />
        </Field>
        <Field label="Cobrir empate">
          <div className="flex h-9 items-center justify-between rounded-md border border-input bg-secondary/20 px-3">
            <span className="text-sm">{draft.coverTie ? "Sim" : "Não"}</span>
            <Switch
              aria-label="Cobrir empate"
              checked={draft.coverTie}
              onCheckedChange={(checked) => setDraft({ ...draft, coverTie: checked })}
            />
          </div>
        </Field>
        <Field label="Cobertura TIE">
          <Select
            value={String(draft.tieCoverage)}
            onValueChange={(value) =>
              setDraft({ ...draft, tieCoverage: clampNumber(value, 1, 0, 4) })
            }
          >
            <SelectTrigger className="bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">SG</SelectItem>
              <SelectItem value="1">G1</SelectItem>
              <SelectItem value="2">G2</SelectItem>
              <SelectItem value="3">G3</SelectItem>
              <SelectItem value="4">G4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="rounded-xl border border-border/70 bg-secondary/15 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-black">Mensagens do motor</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Cada aba salva uma mensagem independente.
            </div>
          </div>
          <AppBadge tone="blue">{templateOptions.length} mensagens</AppBadge>
        </div>
        <div
          className={`grid grid-cols-2 gap-1 sm:grid-cols-3 ${templateOptions.length === 6 ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
        >
          {templateOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTemplateKey(option.key);
                setError("");
                setStatus("");
              }}
              className={`h-9 rounded-lg border px-2 text-xs font-black transition ${templateKey === option.key ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-border/70 bg-background/30 text-muted-foreground hover:bg-secondary/40"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Field label={templateLabel(templateKey)}>
            <Textarea
              value={activeTemplate}
              maxLength={4096}
              onChange={(event) => setDraft(patchTemplate(draft, templateKey, event.target.value))}
              className="min-h-52 resize-y font-mono text-xs"
            />
          </Field>
          <div className="rounded-lg border border-border/60 bg-background/30 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              Variáveis disponíveis
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {variablesForModule(moduleKey).map((variable) => (
                <span
                  key={variable}
                  className="rounded-full border border-neon-cyan/35 bg-neon-cyan/10 px-2 py-1 text-[11px] font-bold text-neon-cyan"
                >{`{{${variable}}}`}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black">Botões do Telegram</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Ative até quatro botões com texto e link HTTP/HTTPS.
            </div>
          </div>
          <AppBadge tone={draft.buttons.some((button) => button.enabled) ? "green" : "amber"}>
            {draft.buttons.filter((button) => button.enabled).length} ativo(s)
          </AppBadge>
        </div>
        <div className="space-y-2">
          {draft.buttons.map((button, index) => (
            <div
              key={`${roomId}-${moduleKey}-button-${index}`}
              className="rounded-lg border border-border/60 bg-background/30 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black">Botão {index + 1}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {button.enabled ? "Sim" : "Não"}
                  <Switch
                    aria-label={`Ativar botão ${index + 1}`}
                    checked={button.enabled}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        buttons: patchButton(draft.buttons, index, { enabled: checked }),
                      })
                    }
                  />
                </div>
              </div>
              {button.enabled && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Texto do botão">
                    <Input
                      maxLength={64}
                      value={button.label}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          buttons: patchButton(draft.buttons, index, { label: event.target.value }),
                        })
                      }
                      placeholder="Abrir Sniper Bo IA"
                    />
                  </Field>
                  <Field label="Link do botão">
                    <Input
                      maxLength={2048}
                      inputMode="url"
                      value={button.url}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          buttons: patchButton(draft.buttons, index, { url: event.target.value }),
                        })
                      }
                      placeholder="https://t.me/seu-canal"
                    />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-secondary/15 p-3 text-xs">
        <div className="font-black">Prévia da mensagem</div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
          {renderTemplate(activeTemplate)}
        </pre>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
        >
          {error}
        </div>
      )}
      {status && (
        <div
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-bold text-success"
        >
          {status}
        </div>
      )}
      <div className="sticky bottom-0 z-10 grid gap-2 border-t border-border/60 bg-background/95 pt-3 backdrop-blur sm:grid-cols-3">
        <Button
          type="button"
          className="h-10 w-full"
          variant="secondary"
          onClick={() => setDraft(defaultTelegramModuleConfig(moduleKey))}
          disabled={saving || previewing}
        >
          <RotateCcw className="size-4" /> Restaurar padrão
        </Button>
        <Button
          type="button"
          className="h-10 w-full"
          variant="secondary"
          onClick={() => void preview()}
          disabled={saving || previewing}
        >
          {previewing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{" "}
          Enviar prévia
        </Button>
        <Button
          type="button"
          className="h-10 w-full btn-primary-grad"
          onClick={() => void save()}
          disabled={saving || previewing}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{" "}
          {saving ? "Salvando..." : "Salvar e ativar"}
        </Button>
      </div>
    </div>
  );
}

function defaultTelegramModuleConfig(key: TelegramModuleKey): TelegramModuleConfig {
  const lateralTie = key === "lateral_tie_patterns";
  const lateralModule = key === "lateral_paying_numbers" || lateralTie;
  return {
    enabled: !lateralModule,
    entryType: lateralTie ? "TIE" : "AUTO",
    galeLimit: key === "ties_only" ? 0 : 1,
    coverTie: key === "ties_only" || lateralTie,
    tieCoverage: key === "ties_only" ? 4 : 1,
    cooldownSeconds: key === "validator" ? 0 : 2,
    template: DEFAULT_ENTRY[key],
    analyzingTemplate: DEFAULT_ANALYZING[key],
    greenTemplate: DEFAULT_GREEN[key],
    galeTemplate: DEFAULT_GALE[key],
    redTemplate: DEFAULT_RED[key],
    tieTemplate: DEFAULT_TIE[key],
    expiredTemplate: "",
    canceledTemplate: "",
    buttons: Array.from({ length: 4 }, () => ({ enabled: false, label: "", url: "" })),
  };
}
function templateValue(config: TelegramModuleConfig, key: TemplateKey) {
  return key === "entry"
    ? config.template
    : key === "analyzing"
      ? config.analyzingTemplate
      : key === "green"
        ? config.greenTemplate
        : key === "gale"
          ? config.galeTemplate
          : key === "red"
            ? config.redTemplate
            : config.tieTemplate;
}
function patchTemplate(
  config: TelegramModuleConfig,
  key: TemplateKey,
  value: string,
): TelegramModuleConfig {
  return key === "entry"
    ? { ...config, template: value }
    : key === "analyzing"
      ? { ...config, analyzingTemplate: value }
      : key === "green"
        ? { ...config, greenTemplate: value }
        : key === "gale"
          ? { ...config, galeTemplate: value }
          : key === "red"
            ? { ...config, redTemplate: value }
            : { ...config, tieTemplate: value };
}
function templateLabel(key: TemplateKey) {
  return key === "entry"
    ? "Mensagem de entrada confirmada"
    : key === "analyzing"
      ? "Mensagem de analisando / aguarde"
      : key === "green"
        ? "Mensagem de Green"
        : key === "gale"
          ? "Mensagem de G1/G2/G3/G4"
          : key === "red"
            ? "Mensagem de Red"
            : "Mensagem de TIE / Empate";
}
function normalizeButtons(value: unknown, legacy: Record<string, unknown> = {}) {
  const source = Array.isArray(value) ? value.slice(0, 4) : [];
  const normalized: TelegramButtonConfig[] = source.map((item) => {
    const button = asRecord(item);
    return {
      enabled: Object.prototype.hasOwnProperty.call(button, "enabled")
        ? Boolean(button.enabled)
        : true,
      label: text(button.label).slice(0, 64),
      url: text(button.url).slice(0, 2048),
    };
  });
  if (!normalized.length && (legacy.buttonEnabled || legacy.buttonLabel || legacy.buttonUrl))
    normalized.push({
      enabled: Object.prototype.hasOwnProperty.call(legacy, "buttonEnabled")
        ? Boolean(legacy.buttonEnabled)
        : true,
      label: text(legacy.buttonLabel).slice(0, 64),
      url: text(legacy.buttonUrl).slice(0, 2048),
    });
  while (normalized.length < 4) normalized.push({ enabled: false, label: "", url: "" });
  return normalized.slice(0, 4);
}
function patchButton(
  buttons: TelegramButtonConfig[],
  index: number,
  patch: Partial<TelegramButtonConfig>,
) {
  return normalizeButtons(buttons).map((button, currentIndex) =>
    currentIndex === index ? { ...button, ...patch } : button,
  );
}
function validateConfig(key: TelegramModuleKey, config: TelegramModuleConfig) {
  const options =
    key === "validator"
      ? TEMPLATE_OPTIONS
      : TEMPLATE_OPTIONS.filter((option) => option.key !== "analyzing");
  for (const option of options) {
    const validation = validateTemplate(key, templateValue(config, option.key));
    if (validation) return `${option.label}: ${validation}`;
  }
  if (
    config.buttons.some(
      (button) => button.enabled && (!button.label.trim() || !validHttpUrl(button.url)),
    )
  )
    return "Todo botão ativo precisa de texto e link HTTP/HTTPS válido.";
  return "";
}
function validateTemplate(key: TelegramModuleKey, template: string) {
  if (!template.trim()) return "a mensagem não pode ficar vazia.";
  if (template.length > 4096) return "a mensagem ultrapassa 4.096 caracteres.";
  const allowed = new Set(variablesForModule(key));
  const invalid = [...template.matchAll(/{{\s*([a-zA-Z_]+)\s*}}/g)]
    .map((match) => match[1])
    .find((variable) => !allowed.has(variable));
  if (invalid) return `variável inválida {{${invalid}}} para este motor.`;
  return validateHtml(template);
}
function validateHtml(template: string) {
  const stack: string[] = [];
  const supported = new Set([
    "b",
    "strong",
    "i",
    "em",
    "u",
    "ins",
    "s",
    "strike",
    "del",
    "code",
    "pre",
    "a",
    "spoiler",
    "tg-spoiler",
    "blockquote",
  ]);
  for (const match of template.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    if (!supported.has(tag)) return `tag HTML <${tag}> não é permitida pelo Telegram.`;
    if (raw.endsWith("/>")) continue;
    if (raw.startsWith("</")) {
      if (stack.pop() !== tag) return `tag </${tag}> sem abertura correta.`;
    } else stack.push(tag);
  }
  return stack.length ? `tag <${stack.at(-1)}> ficou aberta.` : "";
}
function variablesForModule(key: TelegramModuleKey) {
  const common = [
    "module",
    "table",
    "entry",
    "entryLabel",
    "entryCompact",
    "gale",
    "protection",
    "result",
    "time",
    "round",
    "confidence",
    "percentage",
    "channel",
    "tieCoverage",
    "tieProtection",
    "tieMultiplier",
  ];
  const specific: Record<TelegramModuleKey, string[]> = {
    ai_patterns: ["pattern", "score", "side", "status", "risk"],
    paying_numbers: ["numbers", "number", "side", "score", "status", "risk", "level"],
    surf_alert: ["side", "score", "status", "risk", "level"],
    ties_only: ["numbers", "number", "tie_pressure", "side", "score", "level", "status", "risk"],
    validator: ["pattern", "score", "side", "status", "risk"],
    lateral_paying_numbers: [
      "number",
      "triggerNumber",
      "triggerSide",
      "targetSide",
      "attempt",
      "samples",
      "reds",
      "cycle",
      "score",
      "side",
      "status",
      "risk",
    ],
    lateral_tie_patterns: [
      "pattern",
      "geometry",
      "firstNumber",
      "secondNumber",
      "attempt",
      "samples",
      "reds",
      "cycle",
      "score",
      "status",
      "risk",
    ],
  };
  return [...new Set([...common, ...specific[key]])].sort();
}
function renderTemplate(template: string) {
  return template.replace(
    /{{\s*([a-zA-Z_]+)\s*}}/g,
    (_, variable: string) => SAMPLE_VARIABLES[variable] ?? "",
  );
}
function validHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
function normalizeEntryType(value: unknown): TelegramModuleConfig["entryType"] {
  const entry = text(value).toUpperCase();
  return entry === "BANKER" || entry === "PLAYER" || entry === "TIE" ? entry : "AUTO";
}
function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-bold">
      <span>{label}</span>
      {children}
    </label>
  );
}
