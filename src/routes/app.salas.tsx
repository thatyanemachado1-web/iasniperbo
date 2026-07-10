import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RadioTower, RefreshCw, Save, Send, WifiOff } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { TelegramRoomTemplateEditor } from "@/components/telegram/TelegramRoomTemplateEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  TELEGRAM_ROOM_MODULES,
  listTelegramRooms,
  previewTelegramRoom,
  telegramRoomModuleEnabled,
  telegramRoomSignalModulesPatch,
  testTelegramRoom,
  toggleTelegramRoomModule,
  updateTelegramRoom,
  type TelegramRoomModuleKey,
} from "@/lib/telegramRooms";
import type { TelegramRoomSignalModuleConfig, ValidatorNotificationChannel } from "@/types/neuralValidator";

export const Route = createFileRoute("/app/salas")({
  component: TelegramRoomsPage,
});

const MAX_ROOMS = 3;

function TelegramRoomsPage() {
  const [rooms, setRooms] = useState<ValidatorNotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void refreshRooms();
  }, []);

  async function refreshRooms() {
    setLoading(true);
    setError("");
    try {
      setRooms(await listTelegramRooms());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function patchRoom(room: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>) {
    const key = `${room.id}:patch`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const saved = await updateTelegramRoom(room.id, patch);
      replaceRoom(saved);
      setSuccess(`${saved.name} atualizada.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function toggleModule(
    room: ValidatorNotificationChannel,
    moduleKey: TelegramRoomModuleKey,
    enabled: boolean,
  ) {
    const key = `${room.id}:${moduleKey}`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const saved = await toggleTelegramRoomModule(room.id, moduleKey, enabled);
      replaceRoom(saved);
      setSuccess(`${moduleLabel(moduleKey)} ${enabled ? "ligado" : "desligado"}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function testRoom(room: ValidatorNotificationChannel) {
    const key = `${room.id}:test`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const result = await testTelegramRoom(room.id);
      if (result.channel) replaceRoom(result.channel);
      else await refreshRooms();
      setSuccess(`Teste enviado para ${room.name}.`);
    } catch (cause) {
      setError(errorMessage(cause));
      await refreshRooms();
    } finally {
      setBusyKey("");
    }
  }

  async function saveTemplateConfig(
    room: ValidatorNotificationChannel,
    moduleKey: TelegramRoomModuleKey,
    config: TelegramRoomSignalModuleConfig,
  ) {
    const key = `${room.id}:templates`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const saved = await updateTelegramRoom(room.id, {
        signalModules: telegramRoomSignalModulesPatch(room, moduleKey, config),
      });
      replaceRoom(saved);
      setSuccess(`Mensagens de ${moduleLabel(moduleKey)} salvas.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function previewTemplate(
    room: ValidatorNotificationChannel,
    message: string,
    button: Parameters<typeof previewTelegramRoom>[2],
  ) {
    const key = `${room.id}:templates`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const result = await previewTelegramRoom(room.id, message, button);
      setSuccess(result.messageId ? `Teste enviado. message_id ${result.messageId}.` : "Teste enviado.");
    } catch (cause) {
      setError(errorMessage(cause));
      await refreshRooms();
    } finally {
      setBusyKey("");
    }
  }

  function replaceRoom(saved: ValidatorNotificationChannel) {
    setRooms((current) => current.map((room) => (room.id === saved.id ? saved : room)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="Minhas Salas de Sinais"
          subtitle="Controle os modulos autorizados em cada destino Telegram."
          right={<AppBadge tone="blue">{rooms.length}/{MAX_ROOMS} salas</AppBadge>}
        />
        <Button type="button" variant="secondary" onClick={() => void refreshRooms()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <WifiOff className="size-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" /> {success}
        </div>
      )}

      {loading ? (
        <GlassCard className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-neon-cyan" />
        </GlassCard>
      ) : rooms.length ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {rooms.map((room, index) => (
            <TelegramRoomCard
              key={room.id}
              room={room}
              slot={index + 1}
              busyKey={busyKey}
              onPatch={patchRoom}
              onToggleModule={toggleModule}
              onTest={testRoom}
              onSaveTemplate={saveTemplateConfig}
              onPreviewTemplate={previewTemplate}
            />
          ))}
        </div>
      ) : (
        <GlassCard className="border-neon-cyan/30">
          <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <RadioTower className="size-8 text-neon-cyan" />
            <div>
              <div className="font-black">Nenhuma sala conectada</div>
              <div className="mt-1 text-sm text-muted-foreground">Aguardando conexao administrativa.</div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function TelegramRoomCard({
  room,
  slot,
  busyKey,
  onPatch,
  onToggleModule,
  onTest,
  onSaveTemplate,
  onPreviewTemplate,
}: {
  room: ValidatorNotificationChannel;
  slot: number;
  busyKey: string;
  onPatch: (room: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>) => Promise<void>;
  onToggleModule: (room: ValidatorNotificationChannel, key: TelegramRoomModuleKey, enabled: boolean) => Promise<void>;
  onTest: (room: ValidatorNotificationChannel) => Promise<void>;
  onSaveTemplate: (
    room: ValidatorNotificationChannel,
    key: TelegramRoomModuleKey,
    config: TelegramRoomSignalModuleConfig,
  ) => Promise<void>;
  onPreviewTemplate: (
    room: ValidatorNotificationChannel,
    message: string,
    button: Parameters<typeof previewTelegramRoom>[2],
  ) => Promise<void>;
}) {
  const [name, setName] = useState(room.name);
  const connected = room.connectionStatus === "connected";
  const activeModules = TELEGRAM_ROOM_MODULES.filter((module) => telegramRoomModuleEnabled(room, module.key)).length;

  useEffect(() => setName(room.name), [room.name]);

  return (
    <GlassCard className="border-neon-cyan/25">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase text-neon-cyan">Sala {slot}</div>
          <div className="mt-1 font-black">{room.name}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">{room.chatId}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AppBadge tone={room.isActive ? "green" : "amber"}>{room.isActive ? "Ativa" : "Inativa"}</AppBadge>
          <AppBadge tone={connected ? "blue" : "amber"}>{connected ? "Conectada" : "Pendente"}</AppBadge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        <Button
          type="button"
          variant="secondary"
          title="Salvar nome"
          onClick={() => void onPatch(room, { name: name.trim() || room.name })}
          disabled={busyKey === `${room.id}:patch` || name.trim() === room.name}
        >
          {busyKey === `${room.id}:patch` ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2">
        <div>
          <div className="text-xs font-bold">Envio da sala</div>
          <div className="text-[10px] text-muted-foreground">{activeModules} modulos ligados</div>
        </div>
        <Switch checked={room.isActive} onCheckedChange={(checked) => void onPatch(room, { isActive: checked })} />
      </div>

      <div className="mt-3 space-y-1.5">
        {TELEGRAM_ROOM_MODULES.map((module) => {
          const enabled = telegramRoomModuleEnabled(room, module.key);
          const busy = busyKey === `${room.id}:${module.key}`;
          return (
            <div key={module.key} className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
              <span className="text-xs font-semibold">{module.label}</span>
              {busy ? (
                <Loader2 className="size-4 animate-spin text-neon-cyan" />
              ) : (
                <Switch
                  checked={enabled}
                  disabled={!connected}
                  onCheckedChange={(checked) => void onToggleModule(room, module.key, checked)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <div className="rounded-lg border border-border/50 px-2 py-2">
          <div className="uppercase">Ultimo sucesso</div>
          <div className="mt-1 font-bold text-foreground">{formatRoomTime(room.lastSuccessAt)}</div>
        </div>
        <div className="rounded-lg border border-border/50 px-2 py-2">
          <div className="uppercase">Ultimo erro</div>
          <div className={`mt-1 truncate font-bold ${room.lastError ? "text-destructive" : "text-foreground"}`}>
            {room.lastError || "Nenhum"}
          </div>
        </div>
      </div>

      <Button
        type="button"
        className="mt-3 w-full"
        variant="secondary"
        onClick={() => void onTest(room)}
        disabled={busyKey === `${room.id}:test`}
      >
        {busyKey === `${room.id}:test` ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Testar conexao
      </Button>

      <TelegramRoomTemplateEditor
        room={room}
        busy={busyKey === `${room.id}:templates`}
        onSave={(moduleKey, config) => onSaveTemplate(room, moduleKey, config)}
        onPreview={(message, button) => onPreviewTemplate(room, message, button)}
      />
    </GlassCard>
  );
}

function moduleLabel(key: TelegramRoomModuleKey) {
  return TELEGRAM_ROOM_MODULES.find((module) => module.key === key)?.label || key;
}

function formatRoomTime(value?: string) {
  if (!value) return "Sem envio";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sem envio";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Falha ao atualizar sala Telegram.";
}
