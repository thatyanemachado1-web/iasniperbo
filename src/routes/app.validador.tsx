import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Bot,
  DatabaseZap,
  Eraser,
  Eye,
  History,
  Layers3,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardData } from "@/hooks/useDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import {
  DEFAULT_VALIDATOR_CONFIG,
  NeuralValidatorEngine,
  VALIDATOR_HISTORY_OPTIONS,
  formatPercent,
  formatToken,
  matchesPattern,
  sideName,
  sideTone,
  type PatternMiningFilters,
} from "@/neuralValidator/NeuralValidatorEngine";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  createStorageId,
  currentUserId,
  maskBotToken,
  readPatternDraft,
  removeNotificationChannel,
  removeSavedPattern,
  upsertSavedPattern,
  writeNotificationChannels,
  writeSavedPatterns,
} from "@/neuralValidator/NeuralValidatorStorage";
import type { Round, RoundResult } from "@/types/dashboard";
import type {
  LiveValidatorHit,
  PatternSuggestion,
  SavedValidatorPattern,
  ValidatorConfig,
  ValidatorDestination,
  ValidatorEntryType,
  ValidatorGaleLimit,
  ValidatorNotificationChannel,
  ValidatorPatternToken,
  ValidatorResult,
} from "@/types/neuralValidator";

export const Route = createFileRoute("/app/validador")({
  component: NeuralValidatorPage,
});

const engine = new NeuralValidatorEngine();
const TELEGRAM_SENT_KEY = "sniper_neural_validator_telegram_sent_v1";
const VALIDATOR_CLIENT_HISTORY_LIMIT = 200;

const ENTRY_OPTIONS: Array<{ value: ValidatorEntryType; label: string }> = [
  { value: "AI", label: "Entrada sugerida pela IA" },
  { value: "BANKER", label: "Entrar no Banker" },
  { value: "PLAYER", label: "Entrar no Player" },
  { value: "TIE", label: "Entrar no Tie" },
  { value: "OPPOSITE", label: "Entrar no lado oposto" },
  { value: "SAME_LAST", label: "Mesmo lado do ultimo resultado" },
];

const DESTINATION_OPTIONS: Array<{ value: ValidatorDestination; label: string }> = [
  { value: "site", label: "Somente no site" },
  { value: "telegram", label: "Somente Telegram" },
  { value: "site_telegram", label: "Site + Telegram" },
  { value: "monitor", label: "Apenas monitorar" },
  { value: "disabled", label: "Desativado" },
];

function NeuralValidatorPage() {
  const { data, mode } = useDashboardData();
  const session = readUserSession();
  const adminSession = readAdminSession();
  const hasClientSession = Boolean(session.clientToken);
  const adminAccess = Boolean(adminSession?.token && !hasClientSession);
  const fullAccess = adminAccess || hasFullAccess(session);
  const [activeTab, setActiveTab] = useState("dashboard");
  const realTimeRounds = mode === "live" && !data.mockMode ? data.rounds : [];
  const planLimits = adminAccess ? planLimitForSession("vip", true) : planLimitForSession(session.plan, fullAccess);
  const [serverHistory, setServerHistory] = useState<Round[]>([]);
  const [serverHistoryStatus, setServerHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const historyRounds = useMemo(
    () => mergeRoundSources([serverHistory, realTimeRounds]).slice(-VALIDATOR_CLIENT_HISTORY_LIMIT),
    [realTimeRounds, serverHistory],
  );
  const hasHistory = historyRounds.length > 0;
  const [notice, setNotice] = useState("");

  const [pattern, setPattern] = useState<ValidatorPatternToken[]>(() => {
    const draft = readPatternDraft();
    return draft.length ? draft : [{ side: "B" }, { side: "P" }, { side: "B" }];
  });
  const [tokenScore, setTokenScore] = useState("");
  const [config, setConfig] = useState<ValidatorConfig>({
    ...DEFAULT_VALIDATOR_CONFIG,
    name: "Estrategia Neural",
    entryType: "BANKER",
    historySize: Math.min(DEFAULT_VALIDATOR_CONFIG.historySize, planLimits.history),
  });
  const [manualResult, setManualResult] = useState<ValidatorResult | null>(null);
  const [savedPatterns, setSavedPatterns] = useState<SavedValidatorPattern[]>([]);
  const [channels, setChannels] = useState<ValidatorNotificationChannel[]>([]);
  const [testingTelegramId, setTestingTelegramId] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [siteAlerts, setSiteAlerts] = useState<LiveValidatorHit[]>([]);
  const telegramSendKeysRef = useRef(new Set<string>());
  const deletedPatternIdsRef = useRef(new Set<string>());
  const [channelForm, setChannelForm] = useState({
    name: "Sala Premium",
    botToken: "",
    chatId: "",
    buttonLink: "",
    isActive: true,
    entryTemplate: DEFAULT_MESSAGE_TEMPLATES.entry,
    analyzingEnabled: false,
    analyzingCooldownRounds: 3,
    analyzingTemplate: DEFAULT_MESSAGE_TEMPLATES.analyzing,
  });
  const [filters, setFilters] = useState<PatternMiningFilters>({
    historySize: Math.min(5000, planLimits.history),
    patternLength: 3,
    entryType: "AI",
    galeLimit: 1,
    minAccuracy: 70,
    minOccurrences: 5,
    includeTie: true,
    includeNumbers: true,
    includeOpposite: true,
    hotOnly: false,
    lowRedOnly: false,
  });

  const suggestions = useMemo(() => {
    if (!hasHistory || !planLimits.ai) return [];
    return engine.minePatterns(historyRounds, filters);
  }, [filters, hasHistory, historyRounds, planLimits.ai]);

  const historySignature = roundsSignature(historyRounds);
  const patternSignature = pattern.map(formatToken).join(">");
  const validationHistoryRounds = historyRounds;
  const hasValidationHistory = Boolean(manualResult?.analyzedRounds || historyRounds.length);
  const currentSavedPattern = useMemo(
    () => findSavedPattern(savedPatterns, pattern, config),
    [savedPatterns, pattern, config.entryType, config.galeLimit, config.tableId, config.tieProtection],
  );

  const liveHits = useMemo(
    () => detectLiveHits(savedPatterns, historyRounds),
    [savedPatterns, historyRounds],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadValidatorHistory() {
      setServerHistoryStatus("loading");
      try {
        const rounds = await fetchValidatorRoundHistory(VALIDATOR_CLIENT_HISTORY_LIMIT);
        if (cancelled) return;
        setServerHistory(rounds);
        setServerHistoryStatus("ready");
      } catch {
        if (cancelled) return;
        setServerHistoryStatus("error");
      }
    }

    void loadValidatorHistory();

    return () => {
      cancelled = true;
    };
  }, [data.updatedAt]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendValidatorData() {
      try {
        const [serverPatterns, serverChannels] = await Promise.all([
          fetchServerValidatorPatterns(),
          fetchServerValidatorChannels(),
        ]);
        if (cancelled) return;

        const mergedChannels = mergeValidatorChannels(serverChannels);
        const deletedPatternIds = deletedPatternIdsRef.current;
        const mergedPatterns = autoPrepareAdminTelegramDelivery(
          serverPatterns.filter((item) => !deletedPatternIds.has(item.id)),
          mergedChannels,
          adminAccess,
        );
        writeSavedPatterns(mergedPatterns);
        writeNotificationChannels(mergedChannels);
        setSavedPatterns(mergedPatterns);
        setChannels(mergedChannels);

        const patternsToSync = mergedPatterns.filter((item) => shouldSyncValidatorItem(item, serverPatterns));
        await Promise.all([
          ...patternsToSync.map((item) => saveServerValidatorPattern(item).catch(() => null)),
        ]);
      } catch {
        // Local storage remains the fallback when backend sync is unavailable.
      }
    }

    void loadBackendValidatorData();

    return () => {
      cancelled = true;
    };
  }, [session.email, session.clientToken, adminSession?.email, adminSession?.token]);

  useEffect(() => {
    let cancelled = false;

    async function validateCurrentPattern() {
      if (pattern.length < 1) {
        setManualResult(null);
        return;
      }

      setManualResult(null);
      try {
        const result = await validatePatternOnServer(pattern, config);
        if (!cancelled) setManualResult(result);
      } catch {
        if (cancelled) return;
        const fallbackHistory = validationHistoryRounds.slice(-VALIDATOR_CLIENT_HISTORY_LIMIT);
        setManualResult(
          fallbackHistory.length
            ? engine.validatePattern(fallbackHistory, pattern, {
              ...config,
              historySize: fallbackHistory.length,
            })
            : null,
        );
      }
    }

    void validateCurrentPattern();

    return () => {
      cancelled = true;
    };
  }, [
    config.entryType,
    config.galeLimit,
    config.historySize,
    config.tableId,
    config.tieProtection,
    data.updatedAt,
    historySignature,
    patternSignature,
  ]);

  useEffect(() => {
    if (!liveHits.length) return;
    setSiteAlerts((current) => {
      const byId = new Map(current.map((hit) => [hit.id, hit]));
      for (const hit of liveHits) byId.set(hit.id, hit);
      return [...byId.values()]
        .sort((a, b) => b.detectedRoundId - a.detectedRoundId)
        .slice(0, 5);
    });
    void Promise.all(liveHits.map((hit) => sendLiveHitToTelegram(hit)));
    setSavedPatterns((current) => {
      let changed = false;
      const now = new Date().toISOString();
      const next = current.map((patternItem) => {
        const hit = liveHits.find((item) => item.pattern.id === patternItem.id);
        if (!hit || patternItem.lastDetectedRoundId === hit.detectedRoundId) return patternItem;
        changed = true;
        return {
          ...patternItem,
          lastDetectedAt: now,
          lastDetectedRoundId: hit.detectedRoundId,
          updatedAt: now,
        };
      });
      if (changed) writeSavedPatterns(next);
      return changed ? next : current;
    });
  }, [liveHits.map((hit) => `${hit.pattern.id}:${hit.detectedRoundId}`).join("|")]);

  function addToken(side: RoundResult, scoreText = tokenScore) {
    const score = Number(scoreText);
    const token: ValidatorPatternToken = {
      side,
      ...(Number.isFinite(score) && score > 0 ? { score } : {}),
    };
    setPattern((current) => [...current, token]);
    setTokenScore("");
  }

  function saveCurrentPattern(
    sourceResult: ValidatorResult | null = manualResult,
    sourcePattern = pattern,
    name = config.name,
  ) {
    if (!sourcePattern.length) {
      showNotice("Monte pelo menos uma bolinha antes de salvar.");
      return false;
    }
    const duplicate = findSavedPattern(savedPatterns, sourcePattern, config);
    if (duplicate) {
      showNotice("Padrao ja salvo em Padroes Salvos.");
      return false;
    }
    if (savedPatterns.length >= planLimits.patterns) {
      showNotice(`Seu plano permite ate ${planLimits.patterns} padroes salvos.`);
      return false;
    }
    const sourceHistory = validationHistoryRounds.length ? validationHistoryRounds : historyRounds;
    const validation =
      sourceResult ?? engine.validatePattern(sourceHistory, sourcePattern, config);
    const now = new Date().toISOString();
    const saved: SavedValidatorPattern = {
      id: createStorageId("pattern"),
      userId: currentUserId(),
      name: name || "Estrategia Neural",
      tableId: config.tableId,
      pattern: sourcePattern,
      entryType: config.entryType,
      pulledSide: validation.pulledSide,
      galeLimit: config.galeLimit,
      tieProtection: config.tieProtection,
      destination: "site",
      telegramChannelId: "",
      messageOverride: "",
      cooldownRounds: 2,
      isActive: true,
      validation,
      currentGreenStreak: validation.currentGreenStreak,
      wins: validation.sgWins + validation.g1Wins + validation.g2Wins,
      losses: validation.losses,
      lastDetectedAt: "",
      createdAt: now,
      updatedAt: now,
    };
    const next = upsertSavedPattern(saved);
    setSavedPatterns(next);
    void saveServerValidatorPattern(saved).then((serverPattern) => {
      if (!serverPattern) {
        showNotice("Padrao salvo no navegador, mas o servidor nao confirmou. Telegram precisa do padrao no servidor.");
      }
    });
    showNotice(sourceHistory.length ? "Padrao salvo em Padroes Salvos." : "Padrao salvo sem amostra historica.");
    return true;
  }

  function saveAndClearPattern() {
    if (!saveCurrentPattern()) return;
    setPattern([]);
  }

  function saveSuggestion(suggestion: PatternSuggestion) {
    saveCurrentPattern(
      suggestion.validation,
      suggestion.pattern,
      `IA ${sideName(suggestion.pulledSide)} ${formatPercent(suggestion.validation.accuracy)}`,
    );
  }

  function removePattern(id: string) {
    deletedPatternIdsRef.current.add(id);
    telegramSendKeysRef.current = new Set(
      [...telegramSendKeysRef.current].filter((key) => !key.startsWith(`${id}:`)),
    );
    forgetTelegramNotificationsForPattern(id);
    setSiteAlerts((current) => current.filter((hit) => hit.pattern.id !== id));
    setSavedPatterns(removeSavedPattern(id));
    void deleteServerValidatorPattern(id).then((deleted) => {
      if (!deleted) showNotice("Padrao removido da tela, mas o servidor nao confirmou. Tente excluir novamente.");
    });
    showNotice("Padrao removido.");
  }

  async function refreshPattern(patternItem: SavedValidatorPattern) {
    const validationConfig = {
      ...config,
      entryType: patternItem.entryType,
      galeLimit: patternItem.galeLimit,
      tieProtection: patternItem.tieProtection,
      tableId: patternItem.tableId,
    };
    const validation = await validatePatternOnServer(patternItem.pattern, validationConfig).catch(() =>
      engine.validatePattern(historyRounds, patternItem.pattern, {
        ...validationConfig,
        historySize: Math.min(historyRounds.length || 1, VALIDATOR_CLIENT_HISTORY_LIMIT),
      }),
    );
    const nextItem = {
      ...patternItem,
      validation,
      pulledSide: validation.pulledSide,
      wins: validation.sgWins + validation.g1Wins + validation.g2Wins,
      losses: validation.losses,
      currentGreenStreak: validation.currentGreenStreak,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(nextItem));
    void saveServerValidatorPattern(nextItem);
    showNotice("Padrao atualizado com o historico real disponivel.");
  }

  function resetPatternScore(patternItem: SavedValidatorPattern) {
    const nextItem = {
      ...patternItem,
      wins: 0,
      losses: 0,
      currentGreenStreak: 0,
      lastDetectedAt: "",
      lastDetectedRoundId: undefined,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(nextItem));
    void saveServerValidatorPattern(nextItem);
    showNotice("Placar do padrao zerado.");
  }

  function updateSavedPattern(patternItem: SavedValidatorPattern, patch: Partial<SavedValidatorPattern>) {
    const updated = {
      ...patternItem,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(updated));
    void saveServerValidatorPattern(updated);
  }

  function updateAllSavedPatternDelivery(
    destination: ValidatorDestination,
    telegramChannelId: string,
  ) {
    if (!savedPatterns.length) {
      showNotice("Nenhum padrao salvo para configurar.");
      return;
    }
    const needsTelegram = destination === "telegram" || destination === "site_telegram";
    if (needsTelegram && !telegramChannelId) {
      showNotice("Escolha um canal Telegram antes de aplicar em todos.");
      return;
    }

    const now = new Date().toISOString();
    const next = savedPatterns.map((patternItem) => ({
      ...patternItem,
      destination,
      telegramChannelId: needsTelegram ? telegramChannelId : patternItem.telegramChannelId,
      updatedAt: now,
    }));
    writeSavedPatterns(next);
    setSavedPatterns(next);
    void Promise.all(next.map((patternItem) => saveServerValidatorPattern(patternItem)));
    showNotice(`${next.length} padroes atualizados para ${destinationLabel(destination)}.`);
  }

  async function sendLiveHitToTelegram(hit: LiveValidatorHit) {
    const patternItem = hit.pattern;
    if (patternItem.destination === "disabled" || patternItem.destination === "monitor") {
      showNotice("Padrao detectado no site. Telegram nao enviado porque o destino esta monitorar/desativado.");
      return;
    }
    const channel = channels.find((item) => item.id === patternItem.telegramChannelId) ||
      channels.find((item) => item.isActive && item.chatId) ||
      channels[0];
    if (!channel || !channel.isActive) {
      showNotice("Padrao detectado no site. Telegram nao enviado: nenhum canal ativo.");
      return;
    }

    if (!channel.chatId) {
      showNotice("Padrao detectado no site. Telegram nao enviado: canal sem Chat ID.");
      return;
    }

    const sendKey = `${patternItem.id}:${channel.id}:${hit.detectedRoundId}`;
    if (telegramSendKeysRef.current.has(sendKey) || wasTelegramNotificationSent(sendKey)) return;

    telegramSendKeysRef.current.add(sendKey);
    markTelegramNotificationSent(sendKey);
    try {
      await postValidatorLiveHitTelegram({
        patternId: patternItem.id,
        detectedRoundId: hit.detectedRoundId,
      });
      showNotice(`Sinal enviado no Telegram: ${channel.name}.`);
    } catch (error) {
      telegramSendKeysRef.current.delete(sendKey);
      forgetTelegramNotificationSent(sendKey);
      showNotice(error instanceof Error ? error.message : "Falha ao enviar sinal no Telegram.");
    }
  }

  async function saveChannel() {
    if (!planLimits.telegram) {
      showNotice("Telegram fica bloqueado para o plano Free.");
      return false;
    }
    const name = channelForm.name.trim() || "Canal Telegram";
    const token = channelForm.botToken.trim();
    const chatId = channelForm.chatId.trim();
    const buttonLink = channelForm.buttonLink.trim();
    const matchingChannel = channels.find((channel) => {
      const sameName = channel.name.trim().toLowerCase() === name.toLowerCase();
      const sameChat = chatId ? channel.chatId === chatId || !channel.chatId : true;
      return sameName && sameChat;
    });
    if (!token && !matchingChannel?.botTokenMasked) {
      showNotice("Informe o Bot Token para validar o grupo.");
      return false;
    }
    if (!chatId && !matchingChannel?.chatId) {
      showNotice("Informe o Chat ID do grupo para validar.");
      return false;
    }
    const duplicateChannel = chatId
      ? channels.find((channel) =>
          normalizeValidatorChannelCode(channel.chatId) === normalizeValidatorChannelCode(chatId) &&
          channel.id !== matchingChannel?.id
        )
      : null;
    if (duplicateChannel) {
      showNotice("Ja existe um canal com este Chat ID/codigo.");
      return false;
    }
    if (channels.length >= planLimits.channels && !matchingChannel) {
      showNotice(`Seu plano permite ate ${planLimits.channels} canais.`);
      return false;
    }
    const now = new Date().toISOString();
    const channel: ValidatorNotificationChannel = {
      id: matchingChannel?.id || createStorageId("channel"),
      userId: currentUserId(),
      name,
      botTokenMasked: token ? maskBotToken(token) : matchingChannel?.botTokenMasked || "",
      botTokenEncoded: "",
      chatId: chatId || matchingChannel?.chatId || "",
      buttonLink: buttonLink || matchingChannel?.buttonLink || "",
      isActive: channelForm.isActive,
      analyzingEnabled: channelForm.analyzingEnabled,
      analyzingCooldownRounds: Math.max(1, Number(channelForm.analyzingCooldownRounds) || 3),
      templates: {
        ...DEFAULT_MESSAGE_TEMPLATES,
        entry: channelForm.entryTemplate || DEFAULT_MESSAGE_TEMPLATES.entry,
        analyzing: channelForm.analyzingTemplate || DEFAULT_MESSAGE_TEMPLATES.analyzing,
      },
      createdAt: matchingChannel?.createdAt || now,
      updatedAt: now,
    };
    let serverChannel: ValidatorNotificationChannel | null = null;
    setSavingChannel(true);
    setTestingTelegramId("form");
    try {
      if (token) {
        await postValidatorTelegramMessage({
          botToken: token,
          chatId: channel.chatId,
          buttonLink: channel.buttonLink || `${window.location.origin}/app/validador`,
          message: buildValidatorChannelTestMessage(channel.name),
          buttonLabel: "Abrir Sniper Bo IA",
        });
      }
      serverChannel = await saveServerValidatorChannel(channel, token);
      setChannels((current) => {
        const next = upsertValidatorChannelList(current, serverChannel!);
        writeNotificationChannels(next);
        return next;
      });
      setChannelForm((current) => ({ ...current, botToken: "", chatId: "", buttonLink: "" }));
      showNotice("Grupo validado no Telegram e canal salvo para este usuario.");
      return true;
    } catch (error) {
      if (serverChannel?.id && !matchingChannel) {
        void deleteServerValidatorChannel(serverChannel.id);
      }
      showNotice(error instanceof Error
        ? error.message
        : "Nao consegui validar o grupo. Confira se o bot esta no grupo e se o Chat ID esta correto.");
      return false;
    } finally {
      setSavingChannel(false);
      setTestingTelegramId("");
    }
  }

  function updateNotificationChannel(
    channel: ValidatorNotificationChannel,
    patch: Partial<ValidatorNotificationChannel>,
  ) {
    const updated = {
      ...channel,
      ...patch,
      templates: {
        ...DEFAULT_MESSAGE_TEMPLATES,
        ...channel.templates,
        ...patch.templates,
      },
      updatedAt: new Date().toISOString(),
    };
    setChannels((current) => {
      const next = upsertValidatorChannelList(current, updated);
      writeNotificationChannels(next);
      return next;
    });
    void saveServerValidatorChannel(updated).catch((error) => {
      showNotice(error instanceof Error ? error.message : "Falha ao atualizar canal no motor Telegram.");
    });
  }

  async function testChannelFromForm() {
    await saveChannel();
  }

  async function testSavedChannel(channel: ValidatorNotificationChannel) {
    setTestingTelegramId(channel.id);
    try {
      await testServerValidatorChannel(channel.id);
      showNotice("Teste enviado no Telegram.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Canal salvo sem token ou Chat ID no servidor.");
    } finally {
      setTestingTelegramId("");
    }
  }

  async function testTelegramChannel(channel: {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
  }) {
    setTestingTelegramId(channel.id);
    try {
      await postValidatorTelegramMessage({
        botToken: channel.botToken,
        chatId: channel.chatId,
        buttonLink: channel.buttonLink || `${window.location.origin}/app/validador`,
        message: buildValidatorChannelTestMessage(channel.name),
        buttonLabel: "Abrir Sniper Bo IA",
      });
      showNotice("Teste enviado no Telegram.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Falha ao enviar teste no Telegram.");
    } finally {
      setTestingTelegramId("");
    }
  }

  function removeChannel(id: string) {
    const channel = channels.find((item) => item.id === id);
    const idsToRemove = new Set([id]);
    if (channel) {
      const channelKey = validatorChannelDedupeKey(channel);
      for (const item of channels) {
        if (validatorChannelDedupeKey(item) === channelKey) idsToRemove.add(item.id);
      }
    }
    const next = channels.filter((item) => !idsToRemove.has(item.id));
    writeNotificationChannels(next);
    setChannels(next);
    for (const channelId of idsToRemove) {
      removeNotificationChannel(channelId);
      void deleteServerValidatorChannel(channelId);
    }
    showNotice(idsToRemove.size > 1 ? `${idsToRemove.size} canais duplicados removidos.` : "Canal removido.");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-gradient-brand">Validador Neural de Estrategias</h1>
            <AppBadge tone="blue" pulse>Modulo premium</AppBadge>
            <AppBadge tone="green">Motor independente</AppBadge>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Monte, valide, salve e monitore estrategias usando apenas historico real coletado pela plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone={hasHistory ? "green" : "amber"}>
            {hasHistory ? `${historyRounds.length.toLocaleString("pt-BR")} rodadas reais` : "Sem historico real"}
          </AppBadge>
          <AppBadge tone={serverHistory.length ? "green" : serverHistoryStatus === "loading" ? "blue" : "amber"}>
            Banco Validador: {serverHistory.length.toLocaleString("pt-BR")}
          </AppBadge>
          <AppBadge tone={fullAccess ? "green" : "amber"}>{planLimits.label}</AppBadge>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan">
          {notice}
        </div>
      )}

      <SitePatternAlerts
        alerts={siteAlerts}
        onDismiss={(id) => setSiteAlerts((current) => current.filter((hit) => hit.id !== id))}
        onClear={() => setSiteAlerts([])}
      />

      {!hasHistory && (
        <GlassCard className="border-warning/40">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-5 text-warning" />
            <div>
              <div className="text-sm font-black text-warning">Aguardando historico real da mesa</div>
              <p className="mt-1 text-xs text-muted-foreground">
                O validador nao calcula green, red ou assertividade com dados ficticios. Assim que a mesa enviar rodadas reais para o banco do Validador, a validacao fica ativa.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
          <TabsTrigger value="dashboard" className="gap-1.5"><Activity className="size-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="validator" className="gap-1.5"><ShieldCheck className="size-3.5" /> Validador</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Wand2 className="size-3.5" /> IA de Padroes</TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5"><Save className="size-3.5" /> Padroes Salvos</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><Send className="size-3.5" /> Canais</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardTab
            hasHistory={hasHistory}
            liveHits={liveHits}
            savedPatterns={savedPatterns}
            suggestions={suggestions}
            channels={channels}
            historyRounds={historyRounds}
          />
        </TabsContent>

        <TabsContent value="validator" className="space-y-4">
          <ValidatorTab
            pattern={pattern}
            setPattern={setPattern}
            tokenScore={tokenScore}
            setTokenScore={setTokenScore}
            addToken={addToken}
            config={config}
            setConfig={setConfig}
            manualResult={manualResult}
            saveCurrentPattern={saveCurrentPattern}
            saveAndClearPattern={saveAndClearPattern}
            hasHistory={hasValidationHistory}
            savedPatternName={currentSavedPattern?.name ?? ""}
            recentSavedPatterns={savedPatterns.slice(0, 4)}
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AiPatternsTab
            filters={filters}
            setFilters={setFilters}
            suggestions={suggestions}
            hasHistory={hasHistory}
            aiEnabled={planLimits.ai}
            historyLimit={planLimits.history}
            onValidateSuggestion={(suggestion) => {
              setPattern(suggestion.pattern);
              setManualResult(suggestion.validation);
              showNotice("Sugestao carregada no validador.");
            }}
            onSaveSuggestion={saveSuggestion}
          />
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <SavedPatternsTab
            patterns={savedPatterns}
            channels={channels}
            onRemove={removePattern}
            onRefresh={refreshPattern}
            onReset={resetPatternScore}
            onToggle={(patternItem) => {
              const updated = { ...patternItem, isActive: !patternItem.isActive, updatedAt: new Date().toISOString() };
              setSavedPatterns(upsertSavedPattern(updated));
              void saveServerValidatorPattern(updated);
            }}
            onUpdate={updateSavedPattern}
            onBulkDeliveryUpdate={updateAllSavedPatternDelivery}
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <ChannelsTab
            channels={channels}
            channelForm={channelForm}
            setChannelForm={setChannelForm}
            onSave={saveChannel}
            onRemove={removeChannel}
            onTestForm={testChannelFromForm}
            onTestChannel={testSavedChannel}
            onUpdateChannel={updateNotificationChannel}
            telegramEnabled={planLimits.telegram}
            testingTelegramId={testingTelegramId}
            savingChannel={savingChannel}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SitePatternAlerts({
  alerts,
  onDismiss,
  onClear,
}: {
  alerts: LiveValidatorHit[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wide text-neon-cyan">Sinais do site</div>
        {alerts.length > 1 && (
          <Button type="button" size="sm" variant="secondary" onClick={onClear}>
            Limpar sinais
          </Button>
        )}
      </div>
      {alerts.map((hit) => (
        <GlassCard key={hit.id} className="border-neon-cyan/50 bg-neon-cyan/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-neon-cyan">
                <BellRing className="size-4" /> PADRAO SALVO DETECTADO
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Mesa: <span className="font-bold text-foreground">{hit.pattern.tableId || "Bac Bo"}</span>
                <span className="mx-2">|</span>
                Rodada: <span className="font-bold text-foreground">{hit.detectedRoundId}</span>
              </div>
              <div className="mt-2">
                <PatternLine pattern={hit.pattern.pattern} pulledSide={hit.entry} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs">
                Entrada: <SideLabel side={hit.entry} />
                <span className="mx-2 text-muted-foreground">|</span>
                Gale: ate G{hit.pattern.galeLimit}
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => onDismiss(hit.id)}>
                Fechar
              </Button>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function DashboardTab({
  hasHistory,
  liveHits,
  savedPatterns,
  suggestions,
  channels,
  historyRounds,
}: {
  hasHistory: boolean;
  liveHits: LiveValidatorHit[];
  savedPatterns: SavedValidatorPattern[];
  suggestions: PatternSuggestion[];
  channels: ValidatorNotificationChannel[];
  historyRounds: Round[];
}) {
  const activePatterns = savedPatterns.filter((pattern) => pattern.isActive);
  const totalWins = savedPatterns.reduce((sum, pattern) => sum + pattern.wins, 0);
  const totalLosses = savedPatterns.reduce((sum, pattern) => sum + pattern.losses, 0);
  const accuracy = totalWins + totalLosses ? (totalWins / (totalWins + totalLosses)) * 100 : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Metric label="Padroes salvos" value={savedPatterns.length} icon={<Layers3 className="size-4" />} />
        <Metric label="Ativos" value={activePatterns.length} icon={<Eye className="size-4" />} tone="text-neon-cyan" />
        <Metric label="Canais" value={channels.length} icon={<Send className="size-4" />} />
        <Metric label="Rodadas reais" value={historyRounds.length} icon={<History className="size-4" />} tone="text-success" />
        <Metric label="Assertividade" value={formatPercent(accuracy)} icon={<Trophy className="size-4" />} tone="text-neon-cyan" />
      </div>

      {liveHits.length ? (
        <div className="space-y-3">
          {liveHits.map((hit) => (
            <GlassCard key={hit.id} className="border-neon-cyan/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-neon-cyan">
                    <BellRing className="size-4" /> PADRAO SALVO DETECTADO
                  </div>
                  <div className="mt-2 text-sm">
                    Mesa: <span className="font-bold">Bac Bo</span>
                  </div>
                  <div className="mt-1">
                    <PatternLine pattern={hit.pattern.pattern} pulledSide={hit.entry} />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/25 p-3 text-xs">
                  <div>Entrada: <SideLabel side={hit.entry} /></div>
                  <div>Gale: ate G{hit.pattern.galeLimit}</div>
                  <div>Destino: {destinationLabel(hit.pattern.destination)}</div>
                  <div>Detectado na rodada {hit.detectedRoundId}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 text-neon-cyan" />
            <div>
              <div className="text-sm font-black">Monitoramento ao vivo</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasHistory
                  ? "Nenhum padrao salvo apareceu nas ultimas rodadas."
                  : "Aguardando historico real para monitorar os padroes salvos."}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Estrategias quentes da IA" subtitle="Top sugestoes calculadas com o historico real disponivel." />
          <div className="mt-4 space-y-2">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <SuggestionRow key={suggestion.id} suggestion={suggestion} rank={index + 1} />
            ))}
            {!suggestions.length && (
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
                Nenhuma sugestao com amostra suficiente no filtro atual.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Ultimos padroes salvos" subtitle="Contadores proprios, separados dos outros motores." />
          <div className="mt-4 space-y-2">
            {savedPatterns.slice(0, 4).map((pattern) => (
              <div key={pattern.id} className="rounded-xl border border-border/70 bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{pattern.name}</div>
                    <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} compact />
                  </div>
                  <AppBadge tone={pattern.isActive ? "green" : "muted"}>{pattern.isActive ? "ativo" : "inativo"}</AppBadge>
                </div>
              </div>
            ))}
            {!savedPatterns.length && (
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
                Nenhum padrao salvo ainda.
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ValidatorTab(props: {
  pattern: ValidatorPatternToken[];
  setPattern: (pattern: ValidatorPatternToken[]) => void;
  tokenScore: string;
  setTokenScore: (score: string) => void;
  addToken: (side: RoundResult, score?: string) => void;
  config: ValidatorConfig;
  setConfig: (config: ValidatorConfig) => void;
  manualResult: ValidatorResult | null;
  saveCurrentPattern: () => boolean;
  saveAndClearPattern: () => void;
  hasHistory: boolean;
  savedPatternName: string;
  recentSavedPatterns: SavedValidatorPattern[];
}) {
  const {
    pattern,
    setPattern,
    tokenScore,
    setTokenScore,
    addToken,
    config,
    setConfig,
    manualResult,
    saveCurrentPattern,
    saveAndClearPattern,
    hasHistory,
    savedPatternName,
    recentSavedPatterns,
  } = props;

  const [showDetails, setShowDetails] = useState(false);
  const isPatternSaved = Boolean(savedPatternName);
  const canSave = pattern.length >= 1 && !isPatternSaved;
  const totalSignals = manualResult?.totalSignals ?? 0;
  const setGaleLimit = (value: number) => {
    setConfig({ ...config, galeLimit: Math.min(2, Math.max(0, value)) as ValidatorGaleLimit });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-2.5">
      <GlassCard>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.44fr)]">
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-background/30 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Padrao</div>
                    {isPatternSaved && <AppBadge tone="blue">Padrao ja salvo</AppBadge>}
                  </div>
                  <CompactPatternLine
                    pattern={pattern}
                    className="mt-2"
                    onRemove={(index) => setPattern(pattern.filter((_, tokenIndex) => tokenIndex !== index))}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <IconToolButton label="Inverter" onClick={() => setPattern(pattern.map(invertToken))}>
                    <RotateCcw className="size-4" />
                  </IconToolButton>
                  <IconToolButton label="Remover" onClick={() => setPattern(pattern.slice(0, -1))} disabled={!pattern.length}>
                    <Trash2 className="size-4" />
                  </IconToolButton>
                  <IconToolButton label="Limpar" onClick={() => setPattern([])}>
                    <Eraser className="size-4" />
                  </IconToolButton>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <QuickToken side="B" score={tokenScore} label="Banker" onClick={addToken} />
                <QuickToken side="P" score={tokenScore} label="Player" onClick={addToken} />
                <QuickToken side="T" score={tokenScore} label="Tie" onClick={addToken} />
                <Input
                  value={tokenScore}
                  onChange={(event) => setTokenScore(event.target.value)}
                  inputMode="numeric"
                  placeholder="Numero"
                  className="h-8 w-20 bg-secondary/30 text-center text-xs"
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Input
                  value={config.name}
                  onChange={(event) => setConfig({ ...config, name: event.target.value })}
                  placeholder="Nome do padrao"
                  className="h-9 bg-secondary/30 text-sm"
                />
                <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  Apareceu <span className="font-black text-neon-cyan">{totalSignals}</span> vezes
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <SimpleInfoCard label="Entrada">
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <EntrySideButton
                    side="B"
                    selected={config.entryType === "BANKER"}
                    onClick={() => setConfig({ ...config, entryType: "BANKER" })}
                  />
                  <EntrySideButton
                    side="P"
                    selected={config.entryType === "PLAYER"}
                    onClick={() => setConfig({ ...config, entryType: "PLAYER" })}
                  />
                </div>
              </SimpleInfoCard>

              <SimpleInfoCard label="Gale">
                <div className="mt-2 flex h-8 items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2">
                  <button type="button" className="px-2 text-muted-foreground hover:text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) - 1)}>-</button>
                  <span className="text-xs font-black">Ate G{Number(config.galeLimit)}</span>
                  <button type="button" className="px-2 text-muted-foreground hover:text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) + 1)}>+</button>
                </div>
              </SimpleInfoCard>

              <SimpleInfoCard label="Protecao no empate">
                <label className="mt-2 flex h-8 cursor-pointer items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-3 text-xs">
                  <span className="font-black">{config.tieProtection ? "Ativa" : "Inativa"}</span>
                  <Checkbox
                    checked={config.tieProtection}
                    onCheckedChange={(checked) => setConfig({ ...config, tieProtection: checked === true })}
                    className="border-warning data-[state=checked]:bg-warning data-[state=checked]:text-background"
                  />
                </label>
              </SimpleInfoCard>
            </div>

            <div>
              {isPatternSaved && (
                <div className="mb-2 rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-xs font-bold text-neon-cyan">
                  Padrao ja salvo{savedPatternName ? `: ${savedPatternName}` : ""}.
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="btn-primary-grad w-full" onClick={() => saveCurrentPattern()} disabled={!canSave}>
                  {isPatternSaved ? "Padrao ja salvo" : "Salvar Padrao"}
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={saveAndClearPattern} disabled={!canSave}>
                  Salvar e limpar
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <ValidationSummaryPanel
              result={manualResult}
              hasHistory={hasHistory}
              config={config}
              onToggleDetails={() => setShowDetails((value) => !value)}
              showDetails={showDetails}
            />
            <RecentSavedPatternsPanel patterns={recentSavedPatterns} />
          </div>
        </div>
      </GlassCard>

      {showDetails && <ValidationDetailsPanel result={manualResult} config={config} />}
    </div>
  );
}

function RecentSavedPatternsPanel({ patterns }: { patterns: SavedValidatorPattern[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Salvos recentes</div>
        <span className="text-[10px] font-bold text-muted-foreground">{patterns.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="rounded-lg border border-border/50 bg-secondary/15 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-black">{pattern.name}</div>
                <div className="mt-1">
                  <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} compact />
                </div>
              </div>
              <span className="shrink-0 text-xs font-black text-neon-cyan">
                {formatPercent(pattern.validation?.accuracy)}
              </span>
            </div>
          </div>
        ))}
        {!patterns.length && (
          <div className="rounded-lg border border-border/50 bg-secondary/15 px-3 py-2 text-xs text-muted-foreground">
            Nenhum padrao salvo ainda.
          </div>
        )}
      </div>
    </div>
  );
}

function AiPatternsTab({
  filters,
  setFilters,
  suggestions,
  hasHistory,
  aiEnabled,
  historyLimit,
  onValidateSuggestion,
  onSaveSuggestion,
}: {
  filters: PatternMiningFilters;
  setFilters: (filters: PatternMiningFilters) => void;
  suggestions: PatternSuggestion[];
  hasHistory: boolean;
  aiEnabled: boolean;
  historyLimit: number;
  onValidateSuggestion: (suggestion: PatternSuggestion) => void;
  onSaveSuggestion: (suggestion: PatternSuggestion) => void;
}) {
  return (
    <div className="space-y-4">
      <GlassCard>
        <SectionTitle title="Filtros da IA" subtitle="A IA minera apenas o historico real da mesa." />
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Historico">
            <Select value={String(filters.historySize)} onValueChange={(value) => setFilters({ ...filters, historySize: Math.min(Number(value), historyLimit) })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableHistoryOptions(historyLimit).map((option) => <SelectItem key={option} value={String(option)}>{option / 1000}k</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tamanho">
            <Select value={String(filters.patternLength)} onValueChange={(value) => setFilters({ ...filters, patternLength: Number(value) })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value} resultados</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Entrada">
            <Select value={filters.entryType} onValueChange={(value) => setFilters({ ...filters, entryType: value as ValidatorEntryType })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTRY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gale maximo">
            <Select value={String(filters.galeLimit)} onValueChange={(value) => setFilters({ ...filters, galeLimit: Number(value) as ValidatorGaleLimit })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">SG</SelectItem>
                <SelectItem value="1">G1</SelectItem>
                <SelectItem value="2">G2</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assertividade minima">
            <Input type="number" value={filters.minAccuracy} onChange={(event) => setFilters({ ...filters, minAccuracy: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="Minimo aparicoes">
            <Input type="number" value={filters.minOccurrences} onChange={(event) => setFilters({ ...filters, minOccurrences: Number(event.target.value) || 1 })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSwitch label="Incluir Tie" checked={filters.includeTie} onCheckedChange={(checked) => setFilters({ ...filters, includeTie: checked })} />
          <FilterSwitch label="Incluir numeros" checked={filters.includeNumbers} onCheckedChange={(checked) => setFilters({ ...filters, includeNumbers: checked })} />
          <FilterSwitch label="Lado oposto" checked={filters.includeOpposite} onCheckedChange={(checked) => setFilters({ ...filters, includeOpposite: checked })} />
          <FilterSwitch label="Apenas quentes" checked={filters.hotOnly} onCheckedChange={(checked) => setFilters({ ...filters, hotOnly: checked })} />
          <FilterSwitch label="Baixo RED" checked={filters.lowRedOnly} onCheckedChange={(checked) => setFilters({ ...filters, lowRedOnly: checked })} />
        </div>
      </GlassCard>

      {!aiEnabled && (
        <GlassCard className="border-warning/40">
          <div className="text-sm font-black text-warning">IA de Padroes liberada para VIP/Admin.</div>
          <p className="mt-1 text-xs text-muted-foreground">Clientes Free podem validar poucos padroes manualmente, sem mineracao completa.</p>
        </GlassCard>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            rank={index + 1}
            onValidate={() => onValidateSuggestion(suggestion)}
            onSave={() => onSaveSuggestion(suggestion)}
          />
        ))}
      </div>
      {hasHistory && aiEnabled && !suggestions.length && (
        <GlassCard>
          <div className="text-sm text-muted-foreground">Nenhum padrao encontrou a assertividade minima com amostra real suficiente.</div>
        </GlassCard>
      )}
    </div>
  );
}

function SavedPatternsTab({
  patterns,
  channels,
  onRemove,
  onRefresh,
  onReset,
  onToggle,
  onUpdate,
  onBulkDeliveryUpdate,
}: {
  patterns: SavedValidatorPattern[];
  channels: ValidatorNotificationChannel[];
  onRemove: (id: string) => void;
  onRefresh: (pattern: SavedValidatorPattern) => void;
  onReset: (pattern: SavedValidatorPattern) => void;
  onToggle: (pattern: SavedValidatorPattern) => void;
  onUpdate: (pattern: SavedValidatorPattern, patch: Partial<SavedValidatorPattern>) => void;
  onBulkDeliveryUpdate: (destination: ValidatorDestination, telegramChannelId: string) => void;
}) {
  const [bulkDestination, setBulkDestination] = useState<ValidatorDestination>("site_telegram");
  const [bulkChannelId, setBulkChannelId] = useState("");
  const activeChannels = channels.filter((channel) => channel.isActive);
  const selectedBulkChannelId = bulkChannelId || activeChannels[0]?.id || channels[0]?.id || "";
  const bulkNeedsTelegram = bulkDestination === "telegram" || bulkDestination === "site_telegram";

  return (
    <div className="space-y-3">
      <GlassCard className="rounded-xl p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start">
          <SectionTitle
            title="Padroes salvos"
            subtitle="Configure destino, canal e mensagem somente depois que o padrao estiver salvo."
          />
          <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-3">
            <div className="text-xs font-black uppercase tracking-wider text-neon-cyan">
              Envio em massa
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Select
                value={bulkDestination}
                onValueChange={(value) => setBulkDestination(value as ValidatorDestination)}
              >
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">Todos no site</SelectItem>
                  <SelectItem value="telegram">Todos no Telegram</SelectItem>
                  <SelectItem value="site_telegram">Site + Telegram</SelectItem>
                  <SelectItem value="monitor">Apenas monitorar</SelectItem>
                  <SelectItem value="disabled">Desativar envio</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedBulkChannelId || "none"}
                onValueChange={(value) => setBulkChannelId(value === "none" ? "" : value)}
                disabled={!bulkNeedsTelegram}
              >
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum canal</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="btn-primary-grad mt-3 w-full"
              onClick={() => onBulkDeliveryUpdate(bulkDestination, bulkNeedsTelegram ? selectedBulkChannelId : "")}
              disabled={!patterns.length || (bulkNeedsTelegram && !selectedBulkChannelId)}
            >
              Aplicar em todos os padroes
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Atualiza todos os padroes salvos de uma vez. O canal individual pode ser ajustado depois.
            </p>
          </div>
        </div>
      </GlassCard>
      {patterns.map((pattern) => {
        const channel = channels.find((item) => item.id === pattern.telegramChannelId);
        return (
          <GlassCard key={pattern.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black">{pattern.name}</h3>
                  <AppBadge tone={pattern.isActive ? "green" : "muted"}>{pattern.isActive ? "ativo" : "inativo"}</AppBadge>
                  <AppBadge tone="blue">{destinationLabel(pattern.destination)}</AppBadge>
                </div>
                <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} />
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                  <MiniStat label="Entrada" value={sideName(pattern.pulledSide)} />
                  <MiniStat label="Gale" value={`G${pattern.galeLimit}`} />
                  <MiniStat label="Tie" value={pattern.tieProtection ? "protegido" : "normal"} />
                  <MiniStat label="Sinais" value={pattern.validation?.totalSignals ?? 0} />
                  <MiniStat label="Green" value={pattern.wins} tone="text-success" />
                  <MiniStat label="Red" value={pattern.losses} tone="text-destructive" />
                  <MiniStat label="Assert." value={formatPercent(pattern.validation?.accuracy)} tone="text-neon-cyan" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Canal: {channel?.name || "nenhum"} | Ultima deteccao: {pattern.lastDetectedAt ? new Date(pattern.lastDetectedAt).toLocaleString("pt-BR") : "ainda nao detectado"}
                </div>
                <details className="rounded-xl border border-border/60 bg-background/30 p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-muted-foreground">Configurar envio</summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <Input
                      value={pattern.name}
                      onChange={(event) => onUpdate(pattern, { name: event.target.value })}
                      placeholder="Nome da estrategia"
                    />
                    <Input
                      value={pattern.tableId}
                      onChange={(event) => onUpdate(pattern, { tableId: event.target.value })}
                      placeholder="Mesa"
                    />
                    <Select
                      value={pattern.destination}
                      onValueChange={(value) => onUpdate(pattern, { destination: value as ValidatorDestination })}
                    >
                      <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DESTINATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={pattern.telegramChannelId || "none"}
                      onValueChange={(value) => onUpdate(pattern, { telegramChannelId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum canal</SelectItem>
                        {channels.map((channelItem) => (
                          <SelectItem key={channelItem.id} value={channelItem.id}>{channelItem.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={pattern.cooldownRounds}
                      onChange={(event) => onUpdate(pattern, { cooldownRounds: Math.max(0, Number(event.target.value) || 0) })}
                      type="number"
                      placeholder="Cooldown"
                    />
                    <div className="flex min-h-9 items-center rounded-md border border-border/60 bg-secondary/20 px-3 text-xs text-muted-foreground">
                      Destino atual: {destinationLabel(pattern.destination)}
                    </div>
                  </div>
                  <Textarea
                    value={pattern.messageOverride ?? ""}
                    onChange={(event) => onUpdate(pattern, { messageOverride: event.target.value })}
                    placeholder="Mensagem personalizada opcional. Use {{pattern}}, {{entry}}, {{percentage}}, {{table}}"
                    className="mt-3 min-h-20"
                  />
                </details>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => onToggle(pattern)}>
                  {pattern.isActive ? "Desativar" : "Ativar"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onRefresh(pattern)}>
                  Atualizar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onReset(pattern)}>
                  Zerar
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(pattern.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          </GlassCard>
        );
      })}
      {!patterns.length && (
        <GlassCard>
          <div className="text-sm text-muted-foreground">Nenhum padrao salvo ainda. Valide uma estrategia e clique em salvar padrao.</div>
        </GlassCard>
      )}
    </div>
  );
}

function ChannelsTab({
  channels,
  channelForm,
  setChannelForm,
  onSave,
  onRemove,
  onTestForm,
  onTestChannel,
  onUpdateChannel,
  telegramEnabled,
  testingTelegramId,
  savingChannel,
}: {
  channels: ValidatorNotificationChannel[];
  channelForm: {
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
    isActive: boolean;
    entryTemplate: string;
    analyzingEnabled: boolean;
    analyzingCooldownRounds: number;
    analyzingTemplate: string;
  };
  setChannelForm: (form: {
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
    isActive: boolean;
    entryTemplate: string;
    analyzingEnabled: boolean;
    analyzingCooldownRounds: number;
    analyzingTemplate: string;
  }) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  onTestForm: () => void;
  onTestChannel: (channel: ValidatorNotificationChannel) => void;
  onUpdateChannel: (channel: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>) => void;
  telegramEnabled: boolean;
  testingTelegramId: string;
  savingChannel: boolean;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]">
      <GlassCard>
        <SectionTitle title="Meus canais de envio" subtitle="Cada usuario Premium/VIP usa os proprios canais e modelos." />
        {!telegramEnabled && (
          <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
            Telegram bloqueado no plano Free. O alerta no site continua disponivel.
          </div>
        )}
        <div className="mt-4 space-y-3">
          <Field label="Nome do canal">
            <Input value={channelForm.name} onChange={(event) => setChannelForm({ ...channelForm, name: event.target.value })} />
          </Field>
          <Field label="Bot Token">
            <Input value={channelForm.botToken} onChange={(event) => setChannelForm({ ...channelForm, botToken: event.target.value })} placeholder="872946...XNwY" />
          </Field>
          <Field label="Chat ID">
            <Input value={channelForm.chatId} onChange={(event) => setChannelForm({ ...channelForm, chatId: event.target.value })} />
          </Field>
          <Field label="Link do botao">
            <Input value={channelForm.buttonLink} onChange={(event) => setChannelForm({ ...channelForm, buttonLink: event.target.value })} />
          </Field>
          <Field label="Status">
            <div className="flex h-9 items-center justify-between rounded-md border border-input bg-secondary/20 px-3">
              <span className="text-sm">{channelForm.isActive ? "Ativo" : "Inativo"}</span>
              <Switch checked={channelForm.isActive} onCheckedChange={(checked) => setChannelForm({ ...channelForm, isActive: checked })} />
            </div>
          </Field>
          <Field label="Modelo entrada">
            <Textarea value={channelForm.entryTemplate} onChange={(event) => setChannelForm({ ...channelForm, entryTemplate: event.target.value })} className="min-h-36" />
          </Field>
          <div className="rounded-xl border border-border/70 bg-secondary/15 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black">Mensagem sem entrada</div>
                <div className="mt-1 text-xs text-muted-foreground">Envia quando nao tiver entrada validada.</div>
              </div>
              <Switch
                checked={channelForm.analyzingEnabled}
                onCheckedChange={(checked) => setChannelForm({ ...channelForm, analyzingEnabled: checked })}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
              <Textarea
                value={channelForm.analyzingTemplate}
                onChange={(event) => setChannelForm({ ...channelForm, analyzingTemplate: event.target.value })}
                className="min-h-24"
                placeholder={DEFAULT_MESSAGE_TEMPLATES.analyzing}
              />
              <Field label="Intervalo">
                <Input
                  value={channelForm.analyzingCooldownRounds}
                  onChange={(event) => setChannelForm({
                    ...channelForm,
                    analyzingCooldownRounds: Math.max(1, Number(event.target.value) || 1),
                  })}
                  type="number"
                  min={1}
                />
              </Field>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" className="w-full btn-primary-grad" onClick={onSave} disabled={!telegramEnabled || savingChannel}>
              <Save className="size-4" /> {savingChannel ? "Validando..." : "Procurar e salvar grupo"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={onTestForm}
              disabled={!telegramEnabled || savingChannel || testingTelegramId === "form"}
            >
              <Send className="size-4" /> {testingTelegramId === "form" ? "Validando..." : "Validar grupo"}
            </Button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Canais cadastrados" subtitle="Tokens ficam mascarados depois de salvos." />
        <div className="mt-4 space-y-3">
          {channels.map((channel) => (
            <div key={channel.id} className="rounded-xl border border-border/70 bg-secondary/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold">{channel.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Token: {channel.botTokenMasked || "sem token"} | Chat: {channel.chatId || "sem chat"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Status: {channel.isActive ? "ativo" : "inativo"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Sem entrada: {channel.analyzingEnabled ? `ativo a cada ${channel.analyzingCooldownRounds || 3} rodadas` : "inativo"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onTestChannel(channel)}
                    disabled={!telegramEnabled || testingTelegramId === channel.id}
                  >
                    <Send className="size-4" />
                    <span className="hidden sm:inline">{testingTelegramId === channel.id ? "Enviando" : "Testar"}</span>
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(channel.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <details className="mt-3 rounded-xl border border-border/60 bg-background/25 p-3 text-xs">
                <summary className="cursor-pointer font-bold text-muted-foreground">Configurar analisando padrao</summary>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-secondary/15 px-3 py-2">
                    <span className="font-bold">Enviar quando nao tiver entrada</span>
                    <Switch
                      checked={Boolean(channel.analyzingEnabled)}
                      onCheckedChange={(checked) => onUpdateChannel(channel, { analyzingEnabled: checked })}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <Textarea
                      value={channel.templates.analyzing || DEFAULT_MESSAGE_TEMPLATES.analyzing}
                      onChange={(event) => onUpdateChannel(channel, {
                        templates: {
                          ...channel.templates,
                          analyzing: event.target.value,
                        },
                      })}
                      className="min-h-24"
                    />
                    <Field label="Intervalo">
                      <Input
                        value={channel.analyzingCooldownRounds || 3}
                        onChange={(event) => onUpdateChannel(channel, {
                          analyzingCooldownRounds: Math.max(1, Number(event.target.value) || 1),
                        })}
                        type="number"
                        min={1}
                      />
                    </Field>
                  </div>
                </div>
              </details>
            </div>
          ))}
          {!channels.length && (
            <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
              Nenhum canal salvo para este usuario.
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function ValidationSummaryPanel({
  result,
  hasHistory,
  config,
  onToggleDetails,
  showDetails,
}: {
  result: ValidatorResult | null;
  hasHistory: boolean;
  config: ValidatorConfig;
  onToggleDetails: () => void;
  showDetails: boolean;
}) {
  const noSampleText = !hasHistory
    ? "Banco do Validador sem rodadas"
    : !result
      ? "Aguardando validacao"
      : !result.totalValidated
        ? "Padrao sem ocorrencia validada"
        : "";

  if (noSampleText) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resultado</div>
        <div className="mt-3 text-sm font-black text-warning">{noSampleText}</div>
        <div className="mt-3 text-xs text-muted-foreground">
          {!hasHistory
            ? "Envie rodadas reais para o banco do Validador para liberar o calculo."
            : "Esse padrao ainda nao teve amostra finalizada no historico real disponivel."}
        </div>
      </div>
    );
  }

  const greens = result.sgWins + result.g1Wins + result.g2Wins;

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resultado</div>
        <AppBadge tone="green">{result.status}</AppBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <SummaryMetric label="Assertividade" value={formatPercent(result.accuracy)} tone="text-neon-cyan" />
        <SummaryMetric label="Greens" value={greens} tone="text-success" />
        <SummaryMetric label="Reds" value={result.losses} tone="text-destructive" />
        <SummaryMetric label="Seq." value={result.currentGreenStreak} tone="text-neon-cyan" />
        <SummaryMetric label="G1" value={result.g1Wins} />
        <SummaryMetric label="Sinais" value={result.totalSignals} />
      </div>
      <div className="mt-4 rounded-lg border border-border/60 bg-secondary/15 px-3 py-2 text-xs">
        <div className="text-muted-foreground">Protecao no empate</div>
        <div className="mt-1 font-black">{config.tieProtection ? "Ativa" : "Inativa"}</div>
      </div>
      <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onToggleDetails}>
        {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
      </Button>
    </div>
  );
}

function ValidationDetailsPanel({ result, config }: { result: ValidatorResult | null; config: ValidatorConfig }) {
  const selectedEntry = entryTypeToSide(config.entryType) ?? result?.entry ?? null;

  if (!result || !result.totalValidated) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/35 p-4 text-sm text-warning">
        Aguardando validacao
      </div>
    );
  }

  const totalGreen = result.sgWins + result.g1Wins + result.g2Wins;

  return (
    <div className="rounded-xl border border-border/60 bg-background/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black">Detalhes da validacao</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <ResultChip label="Entrada" side={selectedEntry ?? result.entry} />
          <ResultChip label="Empate" value={config.tieProtection ? "ðŸŸ¡ coberto" : "ðŸŸ¡ sem cobertura"} />
          <ResultChip label="Rodadas" value={result.analyzedRounds.toLocaleString("pt-BR")} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <ResultLine label="Total de sinais" value={result.totalSignals} tone="text-neon-cyan" />
        <ResultLine label="Validados" value={result.totalValidated} />
        <ResultLine label="Sem Gale" value={formatCountPercent(result.sgWins, result.totalValidated)} tone="text-success" />
        <ResultLine label="Green G1" value={formatCountPercent(result.g1Wins, result.totalValidated)} tone="text-neon-cyan" />
        <ResultLine label="Green G2" value={formatCountPercent(result.g2Wins, result.totalValidated)} tone="text-neon-cyan" />
        <ResultLine label="Empates" value={result.ties ? result.ties : "Nenhum empate registrado."} tone="text-warning" />
        <ResultLine label="Acertos" value={formatCountPercent(totalGreen, result.totalValidated)} tone="text-success" />
        <ResultLine label="Sequencia desde o ultimo loss" value={result.currentGreenStreak} tone="text-neon-cyan" />
        <ResultLine label="Maior sequencia" value={result.bestGreenStreak} tone="text-success" />
        <ResultLine label="Maior sequencia de loss" value={result.bestLossStreak} tone="text-destructive" />
        <ResultLine label="Erros" value={formatCountPercent(result.losses, result.totalValidated)} tone="text-destructive" />
        <ResultLine label="Assertividade" value={formatPercent(result.accuracy)} tone="text-neon-cyan" />
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {result.details.slice(-24).reverse().map((detail) => (
          <div key={`${detail.roundId}-${detail.status}-${detail.galeUsed}`} className="rounded-lg bg-background/35 px-3 py-2 text-xs">
            {detail.roundLabel} - Entrada <SideLabel side={detail.entry} /> - <span className={detail.status === "RED" ? "text-destructive" : detail.status === "TIE" ? "text-warning" : "text-success"}>{detail.status}</span>
          </div>
        ))}
        {!result.details.length && (
          <div className="rounded-lg bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            Nenhuma rodada validada ainda para este padrao.
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  rank,
  onValidate,
  onSave,
}: {
  suggestion: PatternSuggestion;
  rank: number;
  onValidate: () => void;
  onSave: () => void;
}) {
  return (
    <GlassCard className="rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black">
            Padrao IA Top {rank}
          </div>
          <div className="mt-2"><PatternLine pattern={suggestion.pattern} pulledSide={suggestion.pulledSide} /></div>
        </div>
        <AppBadge tone={suggestion.status === "quente" ? "green" : "blue"}>{suggestion.status}</AppBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <MiniStat label="Apareceu" value={suggestion.occurrences} />
        <MiniStat label="SG" value={suggestion.validation.sgWins} tone="text-success" />
        <MiniStat label="G1" value={suggestion.validation.g1Wins} tone="text-neon-cyan" />
        <MiniStat label="RED" value={suggestion.validation.losses} tone="text-destructive" />
        <MiniStat label="TIE" value={suggestion.validation.ties} tone="text-warning" />
        <MiniStat label="Assert." value={formatPercent(suggestion.validation.accuracy)} tone="text-neon-cyan" />
        <MiniStat label="Risco" value={suggestion.risk} />
        <MiniStat label="Loss max" value={suggestion.validation.bestLossStreak} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" className="btn-primary-grad" onClick={onValidate}>Validar</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onSave}>Salvar padrao</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onSave}>Monitorar ao vivo</Button>
      </div>
    </GlassCard>
  );
}

function SuggestionRow({ suggestion, rank }: { suggestion: PatternSuggestion; rank: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex size-7 items-center justify-center rounded-lg bg-neon-cyan/10 font-black text-neon-cyan">{rank}</span>
        <div className="min-w-0 flex-1"><PatternLine pattern={suggestion.pattern} pulledSide={suggestion.pulledSide} compact /></div>
        <span className="font-black text-neon-cyan">{formatPercent(suggestion.validation.accuracy)}</span>
      </div>
    </div>
  );
}

function PatternLine({
  pattern,
  pulledSide,
  compact = false,
}: {
  pattern: ValidatorPatternToken[];
  pulledSide?: RoundResult | null;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
      <span className="font-semibold text-muted-foreground">Estrategia:</span>
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-center gap-1">
          <TokenPill token={token} />
          {index < pattern.length - 1 && <span className="text-muted-foreground">â†’</span>}
        </span>
      ))}
      <span className="text-muted-foreground">= puxou</span>
      {pulledSide === undefined ? (
        <span className="text-muted-foreground">aguardando validacao</span>
      ) : pulledSide ? (
        <SideLabel side={pulledSide} />
      ) : (
        <span className="text-warning">sem amostra suficiente</span>
      )}
    </div>
  );
}

function TokenPill({ token }: { token: ValidatorPatternToken }) {
  return (
    <span className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${tokenClass(token.side)}`}>
      <span className="text-base leading-none">{sideEmoji(token.side)}</span>
      {token.score ? <span>{token.score}</span> : null}
    </span>
  );
}

function CompactPatternLine({
  pattern,
  className = "",
  onRemove,
}: {
  pattern: ValidatorPatternToken[];
  className?: string;
  onRemove?: (index: number) => void;
}) {
  if (!pattern.length) {
    return (
      <div className={`text-sm font-bold text-muted-foreground ${className}`}>
        Aguardando padrao
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 pt-1 text-base font-black ${className}`}>
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex items-center">
            <span className={sideTone(token.side)}>{sideEmoji(token.side)}{token.score ?? ""}</span>
            {onRemove ? (
              <button
                type="button"
                aria-label={`Remover ${formatToken(token)}`}
                title="Remover bolinha"
                onClick={() => onRemove(index)}
                className="absolute -right-2 -top-2 inline-flex size-4 items-center justify-center rounded-full border border-border/70 bg-background text-[10px] font-black leading-none text-muted-foreground shadow-sm transition hover:border-destructive/70 hover:text-destructive"
              >
                x
              </button>
            ) : null}
          </span>
          {index < pattern.length - 1 && <span className="text-muted-foreground">â†’</span>}
        </span>
      ))}
    </div>
  );
}

function SimpleInfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SideLabel({ side }: { side: RoundResult | null | undefined }) {
  return (
    <span className={`inline-flex items-center gap-1 font-black ${sideTone(side)}`}>
      {side ? <span className="text-base leading-none">{sideEmoji(side)}</span> : null}
      {sideName(side)}
    </span>
  );
}

function QuickToken({
  side,
  score,
  label,
  onClick,
}: {
  side: RoundResult;
  score?: string;
  label: string;
  onClick: (side: RoundResult, score?: string) => void;
}) {
  const scoreText = score?.trim();

  return (
    <button
      type="button"
      onClick={() => onClick(side, score)}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-black transition hover:-translate-y-0.5 ${tokenClass(side)}`}
    >
      <span className="text-base leading-none">{sideEmoji(side)}</span>
      {scoreText ? <span>{scoreText}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function IconToolButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-muted-foreground transition hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function EntrySideButton({ side, selected, onClick }: { side: RoundResult; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-black transition ${
        selected ? `${tokenClass(side)} ring-1 ring-current` : "border-border/70 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
      }`}
    >
      <span className="text-base leading-none">{sideEmoji(side)}</span>
      {sideName(side)}
    </button>
  );
}

function ResultChip({ label, side, value }: { label: string; side?: RoundResult | null; value?: string | number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {side !== undefined ? <SideLabel side={side} /> : <span className="font-black">{value}</span>}
    </div>
  );
}

function ResultLine({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-bold">{label}:</span>
      <span className={`font-black ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone?: string }) {
  return (
    <GlassCard className="rounded-xl p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={tone ?? "text-neon-cyan"}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-xl font-black ${tone ?? ""}`}>{value}</div>
    </GlassCard>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilterSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function buildValidatorChannelTestMessage(channelName: string) {
  return (
    "\u{1F916} ENTRADA CONFIRMADA\n" +
    "\u{1F3B2} Mesa: Bac Bo\n" +
    "\u{1F9E9} Padrao: \u{1F534}10 \u{2192} \u{1F535}7 \u{2192} \u{1F7E1}6\n" +
    "\u{1F3AF} Entrada: \u{1F534} Banker\n" +
    "\u{1F6E1}\u{FE0F} Protecao: Ate G1\n" +
    "\u{1F91D} Protecao Tie: Ativa\n" +
    `\u{1F4E1} Canal: ${channelName}`
  );
}
async function fetchValidatorRoundHistory(limit: number) {
  if (typeof window === "undefined") return [];

  const url = new URL("/validator/round-history", window.location.origin);
  url.searchParams.set("limit", String(limit));
  const session = readUserSession();
  const adminSession = readAdminSession();
  const tokens = [session.clientToken, adminSession?.token].filter(
    (token, index, values): token is string => Boolean(token) && values.indexOf(token) === index,
  );
  const requestTokens = tokens.length ? tokens : [""];
  let lastStatus = 0;

  for (const token of requestTokens) {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    lastStatus = response.status;
    if (!response.ok) continue;

    const payload = await response.json().catch(() => null) as { rounds?: unknown[] } | null;
    return Array.isArray(payload?.rounds) ? payload.rounds.filter(isValidatorRound) : [];
  }

  throw new Error(`Validator history returned ${lastStatus || "unknown"}`);
}

async function validatePatternOnServer(pattern: ValidatorPatternToken[], config: ValidatorConfig) {
  if (typeof window === "undefined") throw new Error("Validador indisponivel.");

  const response = await fetch("/validator/validate", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      tableId: config.tableId,
      pattern,
      entryType: config.entryType,
      galeLimit: config.galeLimit,
      tieProtection: config.tieProtection,
      historySize: config.historySize,
    }),
  });
  const payload = await response.json().catch(() => null) as { result?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "Falha ao validar no servidor.");
  if (!isValidatorResult(payload?.result)) throw new Error("Resultado do Validador invalido.");
  return payload.result;
}

async function fetchServerValidatorPatterns() {
  const response = await fetch("/validator/patterns", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Backend do Validador indisponivel.");
  const data = await response.json().catch(() => null) as { patterns?: SavedValidatorPattern[] } | null;
  return Array.isArray(data?.patterns) ? data.patterns : [];
}

async function saveServerValidatorPattern(pattern: SavedValidatorPattern) {
  const response = await fetch("/validator/patterns", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({ pattern }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as { pattern?: SavedValidatorPattern } | null;
  return data?.pattern ?? null;
}

async function deleteServerValidatorPattern(patternId: string) {
  const response = await fetch(`/validator/patterns/${encodeURIComponent(patternId)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: validatorApiHeaders(),
  }).catch(() => null);
  return Boolean(response?.ok);
}

async function fetchServerValidatorChannels() {
  const response = await fetch("/validator/channels", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Backend do Validador indisponivel.");
  const data = await response.json().catch(() => null) as { channels?: ValidatorNotificationChannel[] } | null;
  return Array.isArray(data?.channels) ? data.channels : [];
}

async function saveServerValidatorChannel(channel: ValidatorNotificationChannel, botToken?: string) {
  const response = await fetch("/validator/channels", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      channel: {
        ...channel,
        ...(botToken?.trim() ? { botToken: botToken.trim() } : {}),
      },
    }),
  });
  const data = await response.json().catch(() => null) as { channel?: ValidatorNotificationChannel; error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao salvar canal no motor Telegram.");
  if (!data?.channel) throw new Error("Motor Telegram nao confirmou o canal.");
  return data.channel;
}

async function deleteServerValidatorChannel(channelId: string) {
  await fetch(`/validator/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: validatorApiHeaders(),
  }).catch(() => null);
}

async function testServerValidatorChannel(channelId: string) {
  const response = await fetch("/validator/channels/test", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({ channelId }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao testar canal salvo.");
}

async function postValidatorLiveHitTelegram(payload: {
  patternId: string;
  detectedRoundId: number;
}) {
  const response = await fetch("/validator/live-hit/send", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao enviar sinal salvo no Telegram.");
}

function validatorApiHeaders(withJson = false) {
  const session = readUserSession();
  const adminSession = readAdminSession();
  const token = session.clientToken || adminSession?.token;
  return {
    Accept: "application/json",
    "X-Validator-User-Id": currentUserId(),
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function mergeValidatorItems<T extends { id: string; updatedAt: string }>(primary: T[], secondary: T[]) {
  const byId = new Map<string, T>();
  for (const item of [...secondary, ...primary]) {
    const existing = byId.get(item.id);
    if (!existing || Date.parse(item.updatedAt || "") >= Date.parse(existing.updatedAt || "")) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function mergeValidatorChannels(primary: ValidatorNotificationChannel[], secondary: ValidatorNotificationChannel[] = []) {
  const byKey = new Map<string, ValidatorNotificationChannel>();
  for (const channel of [...secondary, ...primary]) {
    const key = validatorChannelDedupeKey(channel);
    const existing = byKey.get(key);
    if (!existing || Date.parse(channel.updatedAt || "") >= Date.parse(existing.updatedAt || "")) {
      byKey.set(key, existing ? { ...existing, ...channel } : channel);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function upsertValidatorChannelList(channels: ValidatorNotificationChannel[], channel: ValidatorNotificationChannel) {
  const remaining = channels.filter((item) => item.id !== channel.id);
  return mergeValidatorChannels([channel], remaining);
}

function validatorChannelDedupeKey(channel: Pick<ValidatorNotificationChannel, "id" | "userId" | "name" | "chatId">) {
  const userId = (channel.userId || currentUserId()).trim().toLowerCase();
  const chatId = normalizeValidatorChannelCode(channel.chatId);
  if (chatId) return `${userId}:chat:${chatId}`;
  return `${userId}:name:${channel.name.trim().toLowerCase() || channel.id}`;
}

function normalizeValidatorChannelCode(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function shouldSyncValidatorItem<T extends { id: string; updatedAt: string }>(item: T, serverItems: T[]) {
  const serverItem = serverItems.find((candidate) => candidate.id === item.id);
  if (!serverItem) return true;
  return Date.parse(item.updatedAt || "") > Date.parse(serverItem.updatedAt || "");
}

function autoPrepareAdminTelegramDelivery(
  patterns: SavedValidatorPattern[],
  channels: ValidatorNotificationChannel[],
  enabled: boolean,
) {
  if (!enabled || !patterns.length) return patterns;
  const channel = channels.find((item) => item.isActive) || channels[0];
  if (!channel) return patterns;
  const now = new Date().toISOString();
  return patterns.map((pattern) => {
    if (!pattern.isActive || pattern.destination === "disabled") return pattern;
    if (
      (pattern.destination === "telegram" || pattern.destination === "site_telegram") &&
      pattern.telegramChannelId
    ) {
      return pattern;
    }
    return {
      ...pattern,
      destination: "site_telegram" as ValidatorDestination,
      telegramChannelId: channel.id,
      updatedAt: now,
    };
  });
}

async function postValidatorTelegramMessage(payload: {
  botToken: string;
  chatId: string;
  buttonLink: string;
  message: string;
  buttonLabel: string;
}) {
  if (typeof window === "undefined") return;

  const session = readUserSession();
  const adminSession = readAdminSession();
  const token = session.clientToken || adminSession?.token;
  const response = await fetch("/validator/telegram/send", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || `Telegram retornou ${response.status}.`);
  }
}

function mergeRoundSources(sources: Round[][]) {
  const byKey = new Map<string, Round>();
  for (const source of sources) {
    for (const round of source) byKey.set(roundSourceKey(round), round);
  }
  return [...byKey.values()].sort(compareValidatorRounds);
}

function roundsSignature(rounds: Round[]) {
  const first = rounds[0];
  const last = rounds.at(-1);
  return `${rounds.length}:${first?.id ?? 0}:${last?.id ?? 0}:${last?.result ?? ""}`;
}

function findSavedPattern(
  patterns: SavedValidatorPattern[],
  pattern: ValidatorPatternToken[],
  config: Pick<ValidatorConfig, "entryType" | "galeLimit" | "tableId" | "tieProtection">,
) {
  if (!pattern.length) return null;
  const currentKey = validatorPatternSaveKey(
    pattern,
    config.entryType,
    config.galeLimit,
    config.tieProtection,
    config.tableId,
  );
  return patterns.find((savedPattern) =>
    validatorPatternSaveKey(
      savedPattern.pattern,
      savedPattern.entryType,
      savedPattern.galeLimit,
      savedPattern.tieProtection,
      savedPattern.tableId,
    ) === currentKey
  ) ?? null;
}

function validatorPatternSaveKey(
  pattern: ValidatorPatternToken[],
  entryType: ValidatorEntryType,
  galeLimit: ValidatorGaleLimit,
  tieProtection: boolean,
  tableId: string,
) {
  return [
    pattern.map(formatToken).join(">"),
    entryType,
    Number(galeLimit),
    tieProtection ? "tie-on" : "tie-off",
    tableId.trim().toLowerCase(),
  ].join("|");
}

function isValidatorRound(value: unknown): value is Round {
  const round = value as Partial<Round>;
  return (
    typeof round.id === "number" &&
    (round.result === "B" || round.result === "P" || round.result === "T") &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}

function isValidatorResult(value: unknown): value is ValidatorResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<ValidatorResult>;
  return (
    typeof result.totalSignals === "number" &&
    typeof result.totalValidated === "number" &&
    typeof result.sgWins === "number" &&
    typeof result.g1Wins === "number" &&
    typeof result.g2Wins === "number" &&
    typeof result.losses === "number" &&
    typeof result.ties === "number" &&
    typeof result.tieWins === "number" &&
    typeof result.currentGreenStreak === "number" &&
    typeof result.bestGreenStreak === "number" &&
    typeof result.bestLossStreak === "number" &&
    typeof result.analyzedRounds === "number" &&
    Array.isArray(result.details)
  );
}

function roundSourceKey(round: Round) {
  return `${round.time}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function compareValidatorRounds(a: Round, b: Round) {
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  const timeCompare = a.time.localeCompare(b.time);
  if (timeCompare) return timeCompare;
  return `${a.result}:${a.bankerScore}:${a.playerScore}`.localeCompare(
    `${b.result}:${b.bankerScore}:${b.playerScore}`,
  );
}

function detectLiveHits(patterns: SavedValidatorPattern[], rounds: Round[]): LiveValidatorHit[] {
  const latestRound = rounds.at(-1);
  if (!latestRound) return [];
  return patterns
    .filter((pattern) => pattern.isActive && pattern.destination !== "disabled" && pattern.pattern.length)
    .filter((pattern) => {
      const cooldown = Math.max(0, Number(pattern.cooldownRounds) || 0);
      if (pattern.lastDetectedRoundId && latestRound.id - pattern.lastDetectedRoundId <= cooldown) return false;
      return rounds.length >= pattern.pattern.length &&
        matchesPattern(rounds.slice(-pattern.pattern.length), pattern.pattern);
    })
    .map((pattern) => ({
      id: `hit-${pattern.id}-${latestRound.id}`,
      pattern,
      matchedRounds: rounds.slice(-pattern.pattern.length),
      entry: pattern.pulledSide,
      detectedRoundId: latestRound.id,
      detectedAt: new Date().toISOString(),
    }));
}

function telegramSentStorageKey() {
  return `${TELEGRAM_SENT_KEY}:${currentUserId()}`;
}

function readTelegramSentKeys() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(telegramSentStorageKey()) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function wasTelegramNotificationSent(key: string) {
  return readTelegramSentKeys().includes(key);
}

function markTelegramNotificationSent(key: string) {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set([key, ...readTelegramSentKeys()])).slice(0, 400);
  window.localStorage.setItem(telegramSentStorageKey(), JSON.stringify(next));
}

function forgetTelegramNotificationSent(key: string) {
  if (typeof window === "undefined") return;
  const next = readTelegramSentKeys().filter((item) => item !== key);
  if (next.length) {
    window.localStorage.setItem(telegramSentStorageKey(), JSON.stringify(next));
    return;
  }
  window.localStorage.removeItem(telegramSentStorageKey());
}

function forgetTelegramNotificationsForPattern(patternId: string) {
  if (typeof window === "undefined") return;
  const prefix = `${patternId}:`;
  const next = readTelegramSentKeys().filter((item) => !item.startsWith(prefix));
  if (next.length) {
    window.localStorage.setItem(telegramSentStorageKey(), JSON.stringify(next));
    return;
  }
  window.localStorage.removeItem(telegramSentStorageKey());
}

function invertToken(token: ValidatorPatternToken): ValidatorPatternToken {
  if (token.side === "B") return { ...token, side: "P" };
  if (token.side === "P") return { ...token, side: "B" };
  return token;
}

function sideEmoji(side: RoundResult) {
  if (side === "B") return "ðŸ”´";
  if (side === "P") return "ðŸ”µ";
  return "ðŸŸ¡";
}

function entryTypeToSide(entryType: ValidatorEntryType): RoundResult | null {
  if (entryType === "BANKER") return "B";
  if (entryType === "PLAYER") return "P";
  if (entryType === "TIE") return "T";
  return null;
}

function tokenClass(side: RoundResult) {
  if (side === "B") return "border-banker/40 bg-banker/10 text-banker";
  if (side === "P") return "border-player/40 bg-player/10 text-player";
  return "border-warning/50 bg-warning/10 text-warning";
}

function formatCountPercent(count: number, total: number) {
  if (!total) return String(count);
  return `${count} (${formatPercent((count / total) * 100)})`;
}

function destinationLabel(destination: ValidatorDestination) {
  const option = DESTINATION_OPTIONS.find((item) => item.value === destination);
  return option?.label ?? destination;
}

function planLimitForSession(plan: string, fullAccess: boolean) {
  if (!fullAccess) {
    return { label: "Free", history: 1000, patterns: 3, channels: 0, telegram: false, ai: false };
  }
  if (plan === "vip") {
    return { label: "VIP/Admin", history: 20000, patterns: 80, channels: 10, telegram: true, ai: true };
  }
  return { label: "Premium", history: 10000, patterns: 20, channels: 3, telegram: true, ai: true };
}

function availableHistoryOptions(limit: number) {
  const options = VALIDATOR_HISTORY_OPTIONS.filter((option) => option <= limit);
  return options.length ? options : [limit];
}

