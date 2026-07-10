import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, MessageSquareText, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  TELEGRAM_ROOM_EVENT_OPTIONS,
  TELEGRAM_ROOM_MODULES,
  TELEGRAM_ROOM_TEMPLATE_OPTIONS,
  patchTelegramRoomEventButton,
  patchTelegramRoomTemplateText,
  renderTelegramRoomPreview,
  telegramRoomEventButton,
  telegramRoomModuleConfig,
  telegramRoomTemplateText,
  validateTelegramRoomButton,
  type TelegramRoomModuleKey,
} from "@/lib/telegramRooms";
import type {
  TelegramRoomEventButtonConfig,
  TelegramRoomSignalModuleConfig,
  TelegramRoomTemplateKey,
  ValidatorNotificationChannel,
} from "@/types/neuralValidator";

export function TelegramRoomTemplateEditor({
  room,
  busy,
  onSave,
  onPreview,
}: {
  room: ValidatorNotificationChannel;
  busy: boolean;
  onSave: (moduleKey: TelegramRoomModuleKey, config: TelegramRoomSignalModuleConfig) => Promise<void>;
  onPreview: (message: string, button: TelegramRoomEventButtonConfig) => Promise<void>;
}) {
  const [moduleKey, setModuleKey] = useState<TelegramRoomModuleKey>("paying_numbers");
  const [templateKey, setTemplateKey] = useState<TelegramRoomTemplateKey>("entry");
  const savedConfig = useMemo(
    () => telegramRoomModuleConfig(room, moduleKey),
    [moduleKey, room],
  );
  const [draft, setDraft] = useState<TelegramRoomSignalModuleConfig>(savedConfig);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraft(savedConfig);
    setLocalError("");
  }, [savedConfig]);

  const template = telegramRoomTemplateText(draft, templateKey);
  const button = telegramRoomEventButton(draft, templateKey);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedConfig);

  async function save() {
    const validationError = validateTelegramRoomButton(button);
    if (!template.trim()) {
      setLocalError("O texto da mensagem nao pode ficar vazio.");
      return;
    }
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError("");
    await onSave(moduleKey, draft);
  }

  async function preview() {
    const validationError = validateTelegramRoomButton(button);
    if (!template.trim()) {
      setLocalError("O texto da mensagem nao pode ficar vazio.");
      return;
    }
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    setLocalError("");
    await onPreview(renderTelegramRoomPreview(template), button);
  }

  return (
    <details className="group mt-3 border-t border-border/60 pt-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold">
        <span className="flex items-center gap-2">
          <MessageSquareText className="size-4 text-neon-cyan" />
          Mensagens e resultados
        </span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Modulo">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={moduleKey}
              onChange={(event) => setModuleKey(event.target.value as TelegramRoomModuleKey)}
            >
              {TELEGRAM_ROOM_MODULES.map((module) => (
                <option key={module.key} value={module.key}>{module.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Mensagem">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value as TelegramRoomTemplateKey)}
            >
              {TELEGRAM_ROOM_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {TELEGRAM_ROOM_EVENT_OPTIONS.map((option) => (
            <label
              key={String(option.key)}
              className="flex min-h-10 items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5"
            >
              <span className="text-[10px] font-semibold leading-tight">{option.label}</span>
              <Switch
                checked={draft[option.key] === true}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, [option.key]: checked }))}
              />
            </label>
          ))}
        </div>

        <Field label="Quando sair o resultado final apos G1">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
            value={draft.g1MessageBehavior}
            onChange={(event) => setDraft((current) => ({
              ...current,
              g1MessageBehavior: event.target.value as TelegramRoomSignalModuleConfig["g1MessageBehavior"],
            }))}
          >
            <option value="keep">Manter mensagem G1</option>
            <option value="delete_on_final">Apagar G1 no resultado final</option>
            <option value="edit_to_final">Editar G1 para o resultado final</option>
          </select>
        </Field>

        <Field label={`Texto - ${TELEGRAM_ROOM_TEMPLATE_OPTIONS.find((item) => item.key === templateKey)?.label || templateKey}`}>
          <Textarea
            value={template}
            onChange={(event) => setDraft((current) => patchTelegramRoomTemplateText(current, templateKey, event.target.value))}
            className="min-h-28 resize-y font-mono text-xs"
            maxLength={4096}
          />
        </Field>

        <div className="space-y-2 rounded-md border border-border/60 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold">Botao com link</div>
              <div className="text-[10px] text-muted-foreground">Somente URL https://</div>
            </div>
            <Switch
              checked={button.enabled}
              onCheckedChange={(checked) => setDraft((current) => patchTelegramRoomEventButton(current, templateKey, { enabled: checked }))}
            />
          </div>
          {button.enabled && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={button.text}
                onChange={(event) => setDraft((current) => patchTelegramRoomEventButton(current, templateKey, { text: event.target.value }))}
                placeholder="Texto do botao"
                maxLength={64}
              />
              <Input
                type="url"
                value={button.url}
                onChange={(event) => setDraft((current) => patchTelegramRoomEventButton(current, templateKey, { url: event.target.value }))}
                placeholder="https://sniperbo.com"
              />
            </div>
          )}
        </div>

        {localError && <div className="text-xs font-semibold text-destructive">{localError}</div>}

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
          </Button>
          <Button type="button" variant="secondary" onClick={() => void preview()} disabled={busy || dirty}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Enviar teste
          </Button>
        </div>
      </div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
