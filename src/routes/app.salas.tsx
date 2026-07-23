import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RadioTower,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  TelegramModuleEditor,
  normalizeTelegramModuleConfigs,
  telegramModuleLabel,
  type TelegramModuleConfig,
  type TelegramModuleKey,
} from "@/components/telegram/TelegramModuleEditor";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { readAdminSession } from "@/lib/adminApi";
import {
  TELEGRAM_ROOM_MODULES,
  createTelegramRoom,
  deleteTelegramRoom,
  listTelegramRooms,
  listTelegramStrategyPatterns,
  previewTelegramRoom,
  saveTelegramStrategyDelivery,
  telegramRoomModuleEnabled,
  testTelegramRoom,
  toggleTelegramRoomModule,
  updateTelegramRoom,
  type TelegramRoomModuleKey,
} from "@/lib/telegramRooms";
import { hasAdminRole, hasFullAccess, readUserSession } from "@/lib/userSession";
import type {
  SavedValidatorPattern,
  ValidatorDestination,
  ValidatorNotificationChannel,
} from "@/types/neuralValidator";

export const Route = createFileRoute("/app/salas")({
  component: TelegramRoomsPage,
});

export function TelegramRoomsPage({
  embedded = false,
  initialRooms = [],
  initialPatterns = [],
}: {
  embedded?: boolean;
  initialRooms?: ValidatorNotificationChannel[];
  initialPatterns?: SavedValidatorPattern[];
} = {}) {
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const fullAccess = hasFullAccess(userSession);
  const premiumBlackAccess =
    Boolean(adminSession?.token) ||
    hasAdminRole(userSession) ||
    (fullAccess && userSession.plan === "premium");
  const roomLimit = premiumBlackAccess ? 3 : fullAccess ? 1 : 0;
  const telegramAllowed = roomLimit > 0;
  const [rooms, setRooms] = useState<ValidatorNotificationChannel[]>(initialRooms);
  const [createForm, setCreateForm] = useState({ name: "", chatId: "", botToken: "" });
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editorTarget, setEditorTarget] = useState<{
    roomId: string;
    moduleKey: TelegramModuleKey;
  } | null>(null);
  const [patterns, setPatterns] = useState<SavedValidatorPattern[]>(initialPatterns);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternBusy, setPatternBusy] = useState("");

  useEffect(() => {
    if (embedded) {
      setLoading(false);
      setPatternsLoading(false);
      return;
    }
    void refreshRooms();
    if (telegramAllowed) void refreshPatterns();
  }, [embedded, telegramAllowed]);

  useEffect(() => {
    if (!embedded) return;
    setRooms(initialRooms);
  }, [embedded, initialRooms]);

  useEffect(() => {
    if (!embedded) return;
    setPatterns(initialPatterns);
  }, [embedded, initialPatterns]);

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

  async function refreshPatterns() {
    setPatternsLoading(true);
    try {
      setPatterns(await listTelegramStrategyPatterns());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPatternsLoading(false);
    }
  }

  async function patchRoom(
    room: ValidatorNotificationChannel,
    patch: Partial<ValidatorNotificationChannel>,
  ) {
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

  async function connectRoom() {
    const name = createForm.name.trim() || `Sala ${rooms.length + 1}`;
    const chatId = createForm.chatId.trim();
    const botToken = createForm.botToken.trim();
    if (!chatId || !botToken) {
      setError("Informe o Chat ID e o Bot Token para conectar sua sala.");
      setSuccess("");
      return;
    }
    if (rooms.length >= roomLimit) {
      setError(`Voce pode cadastrar ate ${roomLimit} ${roomLimit === 1 ? "sala" : "salas"}.`);
      setSuccess("");
      return;
    }

    setBusyKey("create");
    setError("");
    setSuccess("");
    try {
      const saved = await createTelegramRoom({ name, chatId, botToken });
      setRooms((current) => [...current, saved]);
      setCreateForm({ name: "", chatId: "", botToken: "" });
      setSuccess(`${saved.name} conectada. Agora escolha os motores que deseja ativar.`);
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

  async function removeRoom(room: ValidatorNotificationChannel) {
    if (!window.confirm(`Excluir ${room.name}? Esta ação remove a conexão desta sala.`)) return;
    const key = `${room.id}:delete`;
    setBusyKey(key);
    setError("");
    setSuccess("");
    try {
      await deleteTelegramRoom(room.id);
      setRooms((current) => current.filter((item) => item.id !== room.id));
      setEditorTarget((current) => (current?.roomId === room.id ? null : current));
      setSuccess(`${room.name} excluída.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  }

  async function saveModuleConfig(
    room: ValidatorNotificationChannel,
    moduleKey: TelegramModuleKey,
    config: TelegramModuleConfig,
  ) {
    const modules = normalizeTelegramModuleConfigs(room.signalModules);
    const saved = await updateTelegramRoom(room.id, {
      signalModules: {
        ...modules,
        [moduleKey]: { ...config, enabled: true },
      },
    } as Partial<ValidatorNotificationChannel>);
    replaceRoom(saved);
    setSuccess(`${telegramModuleLabel(moduleKey)} salvo e ativado em ${saved.name}.`);
    setError("");
  }

  async function previewModule(
    room: ValidatorNotificationChannel,
    message: string,
    buttons: Array<{ enabled?: boolean; label: string; url: string }>,
  ) {
    await previewTelegramRoom(room.id, message, buttons);
  }

  function patchPattern(patternId: string, patch: Partial<SavedValidatorPattern>) {
    setPatterns((current) =>
      current.map((pattern) => (pattern.id === patternId ? { ...pattern, ...patch } : pattern)),
    );
  }

  async function savePattern(pattern: SavedValidatorPattern) {
    const needsTelegram =
      pattern.destination === "telegram" || pattern.destination === "site_telegram";
    if (needsTelegram && !pattern.telegramChannelId) {
      setError("Escolha uma sala Telegram para esta estratégia.");
      return;
    }
    setPatternBusy(pattern.id);
    setError("");
    setSuccess("");
    try {
      const saved = await saveTelegramStrategyDelivery({
        ...pattern,
        updatedAt: new Date().toISOString(),
      });
      setPatterns((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setSuccess(`Destino de ${saved.name} salvo sem alterar a lógica do padrão.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPatternBusy("");
    }
  }

  function replaceRoom(saved: ValidatorNotificationChannel) {
    setRooms((current) => current.map((room) => (room.id === saved.id ? saved : room)));
  }

  const editorRoom = editorTarget
    ? rooms.find((room) => room.id === editorTarget.roomId) || null
    : null;
  const editorConfig =
    editorRoom && editorTarget
      ? normalizeTelegramModuleConfigs(editorRoom.signalModules)[editorTarget.moduleKey]
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="Central Telegram"
          subtitle={`Conecte ${roomLimit === 1 ? "uma sala" : `até ${roomLimit} salas`}, escolha os motores e personalize todas as mensagens.`}
          right={
            <AppBadge tone="blue">
              {rooms.length}/{roomLimit} salas
            </AppBadge>
          }
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void refreshRooms()}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <WifiOff className="size-4" /> {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
        >
          <CheckCircle2 className="size-4" /> {success}
        </div>
      )}

      {!telegramAllowed && (
        <GlassCard className="border-warning/40 bg-warning/5">
          <div className="text-sm font-black text-warning">
            Central Telegram disponível nos planos Premium e Premium Black.
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Suas salas permanecem protegidas, mas novos envios e alterações ficam desativados neste
            plano.
          </div>
        </GlassCard>
      )}

      {!loading && telegramAllowed && rooms.length < roomLimit && (
        <GlassCard className="border-neon-cyan/30">
          <SectionTitle
            title="Conectar minha sala"
            subtitle="Cadastre seu proprio destino. A conexao sera validada com uma mensagem de teste."
            right={<RadioTower className="size-5 text-neon-cyan" />}
          />
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void connectRoom();
            }}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1.5 text-xs font-bold">
                <span>Nome da sala</span>
                <Input
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={`Sala ${rooms.length + 1}`}
                  maxLength={80}
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold">
                <span>Chat ID</span>
                <Input
                  value={createForm.chatId}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, chatId: event.target.value }))
                  }
                  placeholder="Ex.: -1001234567890"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <label className="space-y-1.5 text-xs font-bold">
                <span>Bot Token</span>
                <Input
                  type="password"
                  value={createForm.botToken}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, botToken: event.target.value }))
                  }
                  placeholder="Token fornecido pelo BotFather"
                  autoComplete="new-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/30 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>
                Adicione o bot ao grupo ou canal antes de conectar. Os motores iniciam desligados.
              </span>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  busyKey === "create" || !createForm.chatId.trim() || !createForm.botToken.trim()
                }
              >
                {busyKey === "create" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RadioTower className="size-4" />
                )}
                {busyKey === "create" ? "Validando..." : "Validar e conectar"}
              </Button>
            </div>
          </form>
        </GlassCard>
      )}

      {loading ? (
        <GlassCard className="flex min-h-40 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-neon-cyan" />
        </GlassCard>
      ) : (
        <div className="grid items-stretch gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: roomLimit }, (_, index) => {
            const room = rooms[index];
            return room ? (
              <TelegramRoomCard
                key={room.id}
                room={room}
                slot={index + 1}
                busyKey={busyKey}
                onPatch={patchRoom}
                onToggleModule={toggleModule}
                onTest={testRoom}
                onDelete={removeRoom}
                onConfigure={(room, moduleKey) =>
                  setEditorTarget({ roomId: room.id, moduleKey: moduleKey as TelegramModuleKey })
                }
                canManage={telegramAllowed}
              />
            ) : (
              <TelegramEmptyRoomSlot key={`empty-room-${index + 1}`} slot={index + 1} />
            );
          })}
        </div>
      )}

      {telegramAllowed && (
        <StrategyDeliveryPanel
          patterns={patterns}
          rooms={rooms}
          loading={patternsLoading}
          busyId={patternBusy}
          onRefresh={refreshPatterns}
          onPatch={patchPattern}
          onSave={savePattern}
        />
      )}

      <Sheet
        open={Boolean(editorRoom && editorTarget)}
        onOpenChange={(open) => !open && setEditorTarget(null)}
      >
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto border-neon-cyan/30 bg-background p-4 sm:max-w-2xl lg:max-w-3xl"
        >
          <SheetHeader className="pr-8">
            <SheetTitle>
              Configurar {editorTarget ? telegramModuleLabel(editorTarget.moduleKey) : "motor"}
            </SheetTitle>
            <SheetDescription>
              {editorRoom?.name || "Sala Telegram"} · mensagens, proteção e botões
            </SheetDescription>
          </SheetHeader>
          {editorRoom && editorTarget && editorConfig ? (
            <TelegramModuleEditor
              key={`${editorRoom.id}:${editorTarget.moduleKey}`}
              roomId={editorRoom.id}
              roomName={editorRoom.name}
              moduleKey={editorTarget.moduleKey}
              initialConfig={editorConfig}
              onSave={(config) => saveModuleConfig(editorRoom, editorTarget.moduleKey, config)}
              onPreview={(message, buttons) => previewModule(editorRoom, message, buttons)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
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
  onDelete,
  onConfigure,
  canManage,
}: {
  room: ValidatorNotificationChannel;
  slot: number;
  busyKey: string;
  onPatch: (
    room: ValidatorNotificationChannel,
    patch: Partial<ValidatorNotificationChannel>,
  ) => Promise<void>;
  onToggleModule: (
    room: ValidatorNotificationChannel,
    key: TelegramRoomModuleKey,
    enabled: boolean,
  ) => Promise<void>;
  onTest: (room: ValidatorNotificationChannel) => Promise<void>;
  onDelete: (room: ValidatorNotificationChannel) => Promise<void>;
  onConfigure: (room: ValidatorNotificationChannel, key: TelegramRoomModuleKey) => void;
  canManage: boolean;
}) {
  const [name, setName] = useState(room.name);
  const connected = room.connectionStatus === "connected";
  const activeModules = TELEGRAM_ROOM_MODULES.filter((module) =>
    telegramRoomModuleEnabled(room, module.key),
  ).length;

  useEffect(() => setName(room.name), [room.name]);

  return (
    <GlassCard className="h-full border-neon-cyan/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-neon-cyan">Sala {slot}</div>
          <div className="mt-1 break-words font-black">{room.name}</div>
          <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {room.chatId}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <AppBadge tone={room.isActive ? "green" : "amber"}>
            {room.isActive ? "Ativa" : "Inativa"}
          </AppBadge>
          <AppBadge tone={connected ? "blue" : "amber"}>
            {connected ? "Conectada" : "Pendente"}
          </AppBadge>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
        <Button
          type="button"
          variant="secondary"
          title="Salvar nome"
          onClick={() => void onPatch(room, { name: name.trim() || room.name })}
          disabled={!canManage || busyKey === `${room.id}:patch` || name.trim() === room.name}
        >
          {busyKey === `${room.id}:patch` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-background/30 px-3 py-2">
        <div>
          <div className="text-xs font-bold">Envio da sala</div>
          <div className="text-[10px] text-muted-foreground">{activeModules} modulos ligados</div>
        </div>
        <Switch
          aria-label={`Ativar envios de ${room.name}`}
          checked={room.isActive}
          disabled={!canManage || busyKey === `${room.id}:patch`}
          onCheckedChange={(checked) => void onPatch(room, { isActive: checked })}
        />
      </div>

      <div className="mt-3 space-y-1.5">
        {TELEGRAM_ROOM_MODULES.map((module) => {
          const enabled = telegramRoomModuleEnabled(room, module.key);
          const busy = busyKey === `${room.id}:${module.key}`;
          return (
            <div
              key={module.key}
              className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2"
            >
              <span className="min-w-0 text-xs font-semibold">{module.label}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-[10px]"
                  disabled={!canManage || !connected}
                  onClick={() => onConfigure(room, module.key)}
                >
                  <Settings2 className="size-3.5" /> Configurar
                </Button>
                {busy ? (
                  <Loader2 className="size-4 animate-spin text-neon-cyan" />
                ) : (
                  <Switch
                    aria-label={`${enabled ? "Desativar" : "Ativar"} ${module.label}`}
                    checked={enabled}
                    disabled={!canManage || !connected}
                    onCheckedChange={(checked) => void onToggleModule(room, module.key, checked)}
                  />
                )}
              </div>
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
          <div
            className={`mt-1 truncate font-bold ${room.lastError ? "text-destructive" : "text-foreground"}`}
          >
            {room.lastError || "Nenhum"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          type="button"
          className="w-full"
          variant="secondary"
          onClick={() => void onTest(room)}
          disabled={!canManage || busyKey === `${room.id}:test`}
        >
          {busyKey === `${room.id}:test` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}{" "}
          Testar conexão
        </Button>
        <Button
          type="button"
          variant="destructive"
          aria-label={`Excluir ${room.name}`}
          title="Excluir sala"
          onClick={() => void onDelete(room)}
          disabled={!canManage || busyKey === `${room.id}:delete`}
        >
          {busyKey === `${room.id}:delete` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </Button>
      </div>
    </GlassCard>
  );
}

function TelegramEmptyRoomSlot({ slot }: { slot: number }) {
  return (
    <GlassCard className="flex min-h-48 h-full flex-col border-dashed border-neon-cyan/20 bg-background/15 sm:min-h-64 xl:min-h-[34rem]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase text-neon-cyan">Sala {slot}</div>
          <div className="mt-1 font-black text-muted-foreground">Espaco disponivel</div>
        </div>
        <AppBadge tone="amber">Vazia</AppBadge>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-neon-cyan/25 bg-neon-cyan/5">
          <RadioTower className="size-6 text-neon-cyan/70" />
        </div>
        <div>
          <div className="font-black">Conectar Sala {slot}</div>
          <div className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">
            Preencha o Chat ID e o Bot Token no formulario acima para ocupar este espaco.
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function StrategyDeliveryPanel({
  patterns,
  rooms,
  loading,
  busyId,
  onRefresh,
  onPatch,
  onSave,
}: {
  patterns: SavedValidatorPattern[];
  rooms: ValidatorNotificationChannel[];
  loading: boolean;
  busyId: string;
  onRefresh: () => Promise<void>;
  onPatch: (patternId: string, patch: Partial<SavedValidatorPattern>) => void;
  onSave: (pattern: SavedValidatorPattern) => Promise<void>;
}) {
  return (
    <GlassCard>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="Estratégias próprias no Telegram"
          subtitle="Escolha apenas o destino, a sala e a mensagem. A sequência, a entrada e o gale do padrão não são alterados aqui."
          right={<AppBadge tone="blue">{patterns.length} padrões</AppBadge>}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void onRefresh()}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar padrões
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {patterns.map((pattern) => {
          const needsTelegram =
            pattern.destination === "telegram" || pattern.destination === "site_telegram";
          return (
            <details
              key={pattern.id}
              className="rounded-xl border border-border/60 bg-background/25 p-3"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black">{pattern.name}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Entrada {pattern.entryType} · gale próprio G{pattern.galeLimit} ·{" "}
                      {pattern.isActive ? "ativo" : "inativo"}
                    </div>
                  </div>
                  <AppBadge tone={needsTelegram ? "green" : "amber"}>
                    {destinationLabel(pattern.destination)}
                  </AppBadge>
                </div>
              </summary>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5 text-xs font-bold">
                  <span>Destino do padrão</span>
                  <Select
                    value={pattern.destination}
                    onValueChange={(value) =>
                      onPatch(pattern.id, { destination: value as ValidatorDestination })
                    }
                  >
                    <SelectTrigger className="bg-secondary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site">Somente no site</SelectItem>
                      <SelectItem value="telegram">Somente Telegram</SelectItem>
                      <SelectItem value="site_telegram">Site + Telegram</SelectItem>
                      <SelectItem value="monitor">Apenas monitorar</SelectItem>
                      <SelectItem value="disabled">Desativado</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-1.5 text-xs font-bold">
                  <span>Sala de destino</span>
                  <Select
                    value={pattern.telegramChannelId || "none"}
                    onValueChange={(value) =>
                      onPatch(pattern.id, { telegramChannelId: value === "none" ? "" : value })
                    }
                    disabled={!needsTelegram || !rooms.length}
                  >
                    <SelectTrigger className="bg-secondary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma sala</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label className="mt-3 block space-y-1.5 text-xs font-bold">
                <span>Mensagem personalizada opcional</span>
                <Textarea
                  value={pattern.messageOverride || ""}
                  maxLength={4096}
                  onChange={(event) => onPatch(pattern.id, { messageOverride: event.target.value })}
                  placeholder="Use as variáveis do padrão, por exemplo {{pattern}}, {{entry}}, {{percentage}} e {{table}}."
                  className="min-h-24"
                />
              </label>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px] text-muted-foreground">
                  O motor continua obedecendo a entrada {pattern.entryType} e o gale G
                  {pattern.galeLimit} já salvos no Validador.
                </div>
                <Button
                  type="button"
                  onClick={() => void onSave(pattern)}
                  disabled={busyId === pattern.id}
                >
                  {busyId === pattern.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {busyId === pattern.id ? "Salvando..." : "Salvar destino"}
                </Button>
              </div>
            </details>
          );
        })}

        {!loading && !patterns.length && (
          <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
            Nenhuma estratégia própria salva. Crie e salve seus padrões no Validador; depois
            configure o destino aqui.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function moduleLabel(key: TelegramRoomModuleKey) {
  return TELEGRAM_ROOM_MODULES.find((module) => module.key === key)?.label || key;
}

function destinationLabel(destination: ValidatorDestination) {
  if (destination === "telegram") return "Somente Telegram";
  if (destination === "site_telegram") return "Site + Telegram";
  if (destination === "monitor") return "Apenas monitorar";
  if (destination === "disabled") return "Desativado";
  return "Somente no site";
}

function formatRoomTime(value?: string) {
  if (!value) return "Sem envio";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sem envio";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Falha ao atualizar sala Telegram.";
}
