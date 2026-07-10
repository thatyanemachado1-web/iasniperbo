import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, RadioTower, Save, Search, Send, WifiOff } from "lucide-react";
import {
  createAdminTelegramRoom,
  listAdminTelegramRooms,
  previewAdminTelegramRoom,
  readAdminSession,
  testAdminTelegramRoom,
  updateAdminTelegramRoom,
} from "@/lib/adminApi";
import { readEffectiveAdminSession } from "@/lib/adminSession";
import {
  TELEGRAM_ROOM_MODULES,
  telegramRoomModuleEnabled,
  telegramRoomSignalModulesPatch,
  type TelegramRoomModuleKey,
} from "@/lib/telegramRooms";
import { TelegramRoomTemplateEditor } from "@/components/telegram/TelegramRoomTemplateEditor";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  TelegramRoomEventButtonConfig,
  TelegramRoomSignalModuleConfig,
  ValidatorNotificationChannel,
} from "@/types/neuralValidator";

export const Route = createFileRoute("/app/admin/telegram")({
  component: AdminTelegramRoomsPage,
});

const EMPTY_MODULES = Object.fromEntries(
  TELEGRAM_ROOM_MODULES.map((module) => [module.key, { enabled: false }]),
);

function AdminTelegramRoomsPage() {
  const session = readEffectiveAdminSession() || readAdminSession();
  const [email, setEmail] = useState("");
  const [searchedEmail, setSearchedEmail] = useState("");
  const [rooms, setRooms] = useState<ValidatorNotificationChannel[]>([]);
  const [limit, setLimit] = useState(3);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", chatId: "", botToken: "" });

  async function searchClient(targetEmail = email) {
    if (!session || !targetEmail.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await listAdminTelegramRooms(session, targetEmail.trim());
      setRooms(data.channels || []);
      setLimit(data.limit || 3);
      setSearchedEmail(data.userId || targetEmail.trim().toLowerCase());
    } catch (cause) {
      setRooms([]);
      setSearchedEmail("");
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function createRoom() {
    if (!session || !searchedEmail) return;
    setBusyKey("create");
    setError("");
    setSuccess("");
    try {
      const data = await createAdminTelegramRoom(session, searchedEmail, {
        name: createForm.name.trim() || defaultRoomName(rooms.length),
        chatId: createForm.chatId.trim(),
        botToken: createForm.botToken.trim(),
        isActive: true,
        signalModules: EMPTY_MODULES,
      });
      setRooms((current) => [...current, data.channel]);
      setCreateForm({ name: "", chatId: "", botToken: "" });
      setSuccess("Sala cadastrada e validada.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function updateRoom(room: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>, action: string) {
    if (!session || !searchedEmail) return;
    const key = `${room.id}:${action}`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const data = await updateAdminTelegramRoom(session, searchedEmail, room.id, patch);
      replaceRoom(data.channel);
      setSuccess(`${room.name} atualizada.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function testRoom(room: ValidatorNotificationChannel) {
    if (!session || !searchedEmail) return;
    const key = `${room.id}:test`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      await testAdminTelegramRoom(session, searchedEmail, room.id);
      await searchClient(searchedEmail);
      setSuccess(`Teste enviado para ${room.name}.`);
    } catch (cause) {
      setError(errorMessage(cause));
      await searchClient(searchedEmail);
    } finally {
      setBusyKey("");
    }
  }

  async function saveTemplateConfig(
    room: ValidatorNotificationChannel,
    moduleKey: TelegramRoomModuleKey,
    config: TelegramRoomSignalModuleConfig,
  ) {
    if (!session || !searchedEmail) return;
    const key = `${room.id}:templates`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const data = await updateAdminTelegramRoom(session, searchedEmail, room.id, {
        signalModules: telegramRoomSignalModulesPatch(room, moduleKey, config),
      });
      replaceRoom(data.channel);
      setSuccess(`Mensagens de ${room.name} salvas.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function previewTemplate(
    room: ValidatorNotificationChannel,
    message: string,
    button: TelegramRoomEventButtonConfig,
  ) {
    if (!session || !searchedEmail) return;
    const key = `${room.id}:templates`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      const result = await previewAdminTelegramRoom(session, searchedEmail, room.id, message, button);
      setSuccess(result.messageId ? `Teste enviado. message_id ${result.messageId}.` : "Teste enviado.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  function replaceRoom(saved: ValidatorNotificationChannel) {
    setRooms((current) => current.map((room) => (room.id === saved.id ? saved : room)));
  }

  if (!session) {
    return (
      <GlassCard className="border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="border-neon-cyan/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle
            title="Salas Telegram por cliente"
            subtitle="Controle os destinos do Telegram Engine existente."
            right={<RadioTower className="size-5 text-neon-cyan" />}
          />
          <div className="flex w-full gap-2 lg:max-w-xl">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void searchClient()}
              placeholder="cliente@email.com"
            />
            <Button type="button" onClick={() => void searchClient()} disabled={loading || !email.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Buscar
            </Button>
          </div>
        </div>
      </GlassCard>

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

      {searchedEmail && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Cliente</div>
              <div className="font-black">{searchedEmail}</div>
            </div>
            <AppBadge tone={rooms.length >= limit ? "amber" : "blue"}>{rooms.length}/{limit} salas</AppBadge>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {rooms.map((room, index) => (
              <AdminRoomCard
                key={room.id}
                room={room}
                slot={index + 1}
                busyKey={busyKey}
                onUpdate={updateRoom}
                onTest={testRoom}
                onSaveTemplate={saveTemplateConfig}
                onPreviewTemplate={previewTemplate}
              />
            ))}
          </div>

          {rooms.length < limit && (
            <GlassCard className="border-gold/25">
              <SectionTitle
                title={defaultRoomName(rooms.length)}
                subtitle="Novo destino do cliente"
                right={<AppBadge tone="gold">Sala {rooms.length + 1}</AppBadge>}
              />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <AdminField label="Nome da sala" value={createForm.name} onChange={(value) => setCreateForm((current) => ({ ...current, name: value }))} />
                <AdminField label="Chat ID" value={createForm.chatId} onChange={(value) => setCreateForm((current) => ({ ...current, chatId: value }))} />
                <AdminField label="Bot Token" type="password" value={createForm.botToken} onChange={(value) => setCreateForm((current) => ({ ...current, botToken: value }))} />
              </div>
              <Button
                type="button"
                className="mt-4"
                onClick={() => void createRoom()}
                disabled={busyKey === "create" || !createForm.chatId.trim() || !createForm.botToken.trim()}
              >
                {busyKey === "create" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Validar e cadastrar
              </Button>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

function AdminRoomCard({
  room,
  slot,
  busyKey,
  onUpdate,
  onTest,
  onSaveTemplate,
  onPreviewTemplate,
}: {
  room: ValidatorNotificationChannel;
  slot: number;
  busyKey: string;
  onUpdate: (room: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>, action: string) => Promise<void>;
  onTest: (room: ValidatorNotificationChannel) => Promise<void>;
  onSaveTemplate: (
    room: ValidatorNotificationChannel,
    moduleKey: TelegramRoomModuleKey,
    config: TelegramRoomSignalModuleConfig,
  ) => Promise<void>;
  onPreviewTemplate: (
    room: ValidatorNotificationChannel,
    message: string,
    button: TelegramRoomEventButtonConfig,
  ) => Promise<void>;
}) {
  const [name, setName] = useState(room.name);
  const [chatId, setChatId] = useState(room.chatId);

  async function toggleModule(moduleKey: TelegramRoomModuleKey, enabled: boolean) {
    const currentModules = room.signalModules && typeof room.signalModules === "object"
      ? room.signalModules as Record<string, Record<string, unknown>>
      : {};
    await onUpdate(room, {
      signalModules: {
        ...currentModules,
        [moduleKey]: { ...(currentModules[moduleKey] || {}), enabled },
      },
    }, moduleKey);
  }

  return (
    <GlassCard className="border-neon-cyan/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase text-neon-cyan">Sala {slot}</div>
          <div className="mt-1 font-black">{room.name}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AppBadge tone={room.isActive ? "green" : "amber"}>{room.isActive ? "Ativa" : "Inativa"}</AppBadge>
          <AppBadge tone={room.connectionStatus === "connected" ? "blue" : "amber"}>
            {room.connectionStatus === "connected" ? "Conectada" : "Pendente"}
          </AppBadge>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <AdminField label="Nome" value={name} onChange={setName} />
        <AdminField label="Chat ID" value={chatId} onChange={setChatId} />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void onUpdate(room, { name: name.trim(), chatId: chatId.trim() }, "identity")}
          disabled={busyKey === `${room.id}:identity`}
        >
          {busyKey === `${room.id}:identity` ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar sala
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
        <span className="text-xs font-bold">Sala ativa</span>
        <Switch checked={room.isActive} onCheckedChange={(checked) => void onUpdate(room, { isActive: checked }, "active")} />
      </div>

      <div className="mt-3 space-y-1.5">
        {TELEGRAM_ROOM_MODULES.map((module) => (
          <div key={module.key} className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2">
            <span className="text-xs font-semibold">{module.label}</span>
            {busyKey === `${room.id}:${module.key}` ? (
              <Loader2 className="size-4 animate-spin text-neon-cyan" />
            ) : (
              <Switch
                checked={telegramRoomModuleEnabled(room, module.key)}
                onCheckedChange={(checked) => void toggleModule(module.key, checked)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1 rounded-lg border border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
        <div>Ultimo sucesso: <span className="font-bold text-foreground">{formatTime(room.lastSuccessAt)}</span></div>
        <div className={room.lastError ? "text-destructive" : ""}>Ultimo erro: {room.lastError || "Nenhum"}</div>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="mt-3 w-full"
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

function AdminField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs font-bold">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" />
    </label>
  );
}

function defaultRoomName(index: number) {
  return ["Sala Principal", "Sala VIP / Backup", "Sala Extra"][index] || `Sala ${index + 1}`;
}

function formatTime(value?: string) {
  if (!value) return "Sem envio";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date)
    : "Sem envio";
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Falha ao administrar sala Telegram.";
}
