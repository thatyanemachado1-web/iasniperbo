import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Bot,
  BrainCircuit,
  CheckCircle2,
  DatabaseZap,
  Eraser,
  Eye,
  Flame,
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
import { useEffect, useMemo, useState } from "react";
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
  encodeToken,
  maskBotToken,
  readNotificationChannels,
  readPatternDraft,
  readSavedPatterns,
  readValidatorHistory,
  removeNotificationChannel,
  removeSavedPattern,
  upsertNotificationChannel,
  upsertSavedPattern,
  writePatternDraft,
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
  const fullAccess = hasFullAccess(session);
  const [storageVersion, setStorageVersion] = useState(0);
  const realTimeRounds = mode === "live" && !data.mockMode ? data.rounds : [];
  const historyRounds = useMemo(
    () => readValidatorHistory(realTimeRounds),
    [realTimeRounds, storageVersion],
  );
  const hasHistory = historyRounds.length > 0;
  const planLimits = planLimitForSession(session.plan, fullAccess);
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
  const [savedPatterns, setSavedPatterns] = useState<SavedValidatorPattern[]>(() => readSavedPatterns());
  const [channels, setChannels] = useState<ValidatorNotificationChannel[]>(() => readNotificationChannels());
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [destination, setDestination] = useState<ValidatorDestination>("site");
  const [cooldownRounds, setCooldownRounds] = useState(2);
  const [messageOverride, setMessageOverride] = useState("");
  const [channelForm, setChannelForm] = useState({
    name: "Sala Premium",
    botToken: "",
    chatId: "",
    buttonLink: "",
    isActive: true,
    entryTemplate: DEFAULT_MESSAGE_TEMPLATES.entry,
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

  const historySignature = `${historyRounds.length}:${historyRounds.at(-1)?.id ?? 0}:${historyRounds.at(-1)?.result ?? ""}`;
  const patternSignature = pattern.map(formatToken).join(">");

  const liveHits = useMemo(
    () => detectLiveHits(savedPatterns, historyRounds),
    [savedPatterns, historyRounds],
  );

  useEffect(() => {
    if (!hasHistory || pattern.length < 2) {
      setManualResult(null);
      return;
    }

    setManualResult(engine.validatePattern(historyRounds, pattern, config));
  }, [
    config.entryType,
    config.galeLimit,
    config.historySize,
    config.tableId,
    config.tieProtection,
    hasHistory,
    historySignature,
    patternSignature,
  ]);

  useEffect(() => {
    if (!liveHits.length) return;
    const detectedSignature = liveHits.map((hit) => `${hit.pattern.id}:${hit.detectedRoundId}`).join("|");
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
    setStorageVersion((value) => value + 1);
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

  function saveCurrentPattern(sourceResult = manualResult, sourcePattern = pattern, name = config.name) {
    if (!sourcePattern.length) return;
    if (savedPatterns.length >= planLimits.patterns) {
      showNotice(`Seu plano permite ate ${planLimits.patterns} padroes salvos.`);
      return;
    }
    const validation =
      sourceResult ?? engine.validatePattern(historyRounds, sourcePattern, config);
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
      destination,
      telegramChannelId: selectedChannelId,
      messageOverride,
      cooldownRounds,
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
    showNotice("Padrao salvo para monitoramento ao vivo.");
  }

  function saveSuggestion(suggestion: PatternSuggestion) {
    saveCurrentPattern(
      suggestion.validation,
      suggestion.pattern,
      `IA ${sideName(suggestion.pulledSide)} ${formatPercent(suggestion.validation.accuracy)}`,
    );
  }

  function removePattern(id: string) {
    setSavedPatterns(removeSavedPattern(id));
    showNotice("Padrao removido.");
  }

  function refreshPattern(patternItem: SavedValidatorPattern) {
    const validation = engine.validatePattern(historyRounds, patternItem.pattern, {
      ...config,
      entryType: patternItem.entryType,
      galeLimit: patternItem.galeLimit,
      tieProtection: patternItem.tieProtection,
    });
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
    showNotice("Placar do padrao zerado.");
  }

  function saveChannel() {
    if (!planLimits.telegram) {
      showNotice("Telegram fica bloqueado para o plano Free.");
      return;
    }
    if (channels.length >= planLimits.channels) {
      showNotice(`Seu plano permite ate ${planLimits.channels} canais.`);
      return;
    }
    const now = new Date().toISOString();
    const token = channelForm.botToken.trim();
    const channel: ValidatorNotificationChannel = {
      id: createStorageId("channel"),
      userId: currentUserId(),
      name: channelForm.name || "Canal Telegram",
      botTokenMasked: maskBotToken(token),
      botTokenEncoded: encodeToken(token),
      chatId: channelForm.chatId.trim(),
      buttonLink: channelForm.buttonLink.trim(),
      isActive: channelForm.isActive,
      templates: {
        ...DEFAULT_MESSAGE_TEMPLATES,
        entry: channelForm.entryTemplate || DEFAULT_MESSAGE_TEMPLATES.entry,
      },
      createdAt: now,
      updatedAt: now,
    };
    const next = upsertNotificationChannel(channel);
    setChannels(next);
    setChannelForm((current) => ({ ...current, botToken: "", chatId: "", buttonLink: "" }));
    showNotice("Canal salvo para este usuario. Token fica mascarado depois de salvo.");
  }

  function removeChannel(id: string) {
    setChannels(removeNotificationChannel(id));
    showNotice("Canal removido.");
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
          <AppBadge tone={fullAccess ? "green" : "amber"}>{planLimits.label}</AppBadge>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan">
          {notice}
        </div>
      )}

      {!hasHistory && (
        <GlassCard className="border-warning/40">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-5 text-warning" />
            <div>
              <div className="text-sm font-black text-warning">Aguardando historico real da mesa</div>
              <p className="mt-1 text-xs text-muted-foreground">
                O validador nao calcula green, red ou assertividade com dados ficticios. Assim que o dashboard coletar rodadas reais, a validacao fica ativa.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <Tabs defaultValue="dashboard" className="space-y-4">
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
            destination={destination}
            setDestination={setDestination}
            channels={channels}
            selectedChannelId={selectedChannelId}
            setSelectedChannelId={setSelectedChannelId}
            cooldownRounds={cooldownRounds}
            setCooldownRounds={setCooldownRounds}
            messageOverride={messageOverride}
            setMessageOverride={setMessageOverride}
            manualResult={manualResult}
            saveCurrentPattern={saveCurrentPattern}
            hasHistory={hasHistory}
            historyLimit={planLimits.history}
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
            }}
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <ChannelsTab
            channels={channels}
            channelForm={channelForm}
            setChannelForm={setChannelForm}
            onSave={saveChannel}
            onRemove={removeChannel}
            telegramEnabled={planLimits.telegram}
          />
        </TabsContent>
      </Tabs>
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
  destination: ValidatorDestination;
  setDestination: (destination: ValidatorDestination) => void;
  channels: ValidatorNotificationChannel[];
  selectedChannelId: string;
  setSelectedChannelId: (id: string) => void;
  cooldownRounds: number;
  setCooldownRounds: (value: number) => void;
  messageOverride: string;
  setMessageOverride: (value: string) => void;
  manualResult: ValidatorResult | null;
  saveCurrentPattern: () => void;
  hasHistory: boolean;
  historyLimit: number;
}) {
  const {
    pattern,
    setPattern,
    tokenScore,
    setTokenScore,
    addToken,
    config,
    setConfig,
    destination,
    setDestination,
    channels,
    selectedChannelId,
    setSelectedChannelId,
    cooldownRounds,
    setCooldownRounds,
    messageOverride,
    setMessageOverride,
    manualResult,
    saveCurrentPattern,
    hasHistory,
    historyLimit,
  } = props;

  const canSave = pattern.length >= 2 && hasHistory;
  const selectedEntrySide = entryTypeToSide(config.entryType) ?? "B";
  const historyOptions = availableHistoryOptions(historyLimit);
  const setGaleLimit = (value: number) => {
    setConfig({ ...config, galeLimit: Math.min(2, Math.max(0, value)) as ValidatorGaleLimit });
  };
  const setHistorySize = (value: number) => {
    setConfig({ ...config, historySize: Math.min(historyLimit, Math.max(1, value || 1)) });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <GlassCard>
        <div className="mx-auto max-w-4xl space-y-7 text-center">
          <div>
            <div className="text-base font-black">Ate qual gale voce quer contar?</div>
            <div className="mx-auto mt-3 flex h-9 w-44 items-center justify-between rounded-md border border-border/70 bg-background/50 px-2">
              <button type="button" className="px-2 text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) - 1)}>-</button>
              <span className="text-sm font-black">{Number(config.galeLimit)}</span>
              <button type="button" className="px-2 text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) + 1)}>+</button>
            </div>
          </div>

          <div>
            <div className="text-base font-black">Probabilidades a serem buscadas</div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <QuickToken side="B" score={tokenScore} label="Banker" onClick={addToken} />
              <QuickToken side="P" score={tokenScore} label="Player" onClick={addToken} />
              <QuickToken side="T" score={tokenScore} label="Tie" onClick={addToken} />
              <Input
                value={tokenScore}
                onChange={(event) => setTokenScore(event.target.value)}
                inputMode="numeric"
                placeholder="No."
                className="h-11 w-20 bg-secondary/30 text-center"
              />
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
            <PatternBubbleLine pattern={pattern} className="mt-4 justify-center" />
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <QuickToken side="B" score="10" label="Banker" onClick={addToken} />
              <QuickToken side="P" score="7" label="Player" onClick={addToken} />
              <QuickToken side="T" score="6" label="Tie" onClick={addToken} />
            </div>
          </div>

          <div>
            <div className="text-base font-black">Entrada</div>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
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
            <div className="mt-4 flex justify-center">
              <BigTokenBubble side={selectedEntrySide} />
            </div>
            <label className="mx-auto mt-5 flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-border/70 bg-secondary/20 px-4 py-3 text-xs font-bold">
              <span>Protecao no empate</span>
              <Checkbox
                checked={config.tieProtection}
                onCheckedChange={(checked) => setConfig({ ...config, tieProtection: checked === true })}
                className="border-warning data-[state=checked]:bg-warning data-[state=checked]:text-background"
              />
            </label>
          </div>

          <div className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 p-4">
            <div className="flex flex-col items-center gap-2">
              <BrainCircuit className="size-5 text-neon-cyan" />
              <div className="text-sm font-black">Salvar Padrao</div>
              <div className="text-xs text-muted-foreground">Salve este padrao para notificacoes e monitoramento.</div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_110px]">
              <Input value={config.name} onChange={(event) => setConfig({ ...config, name: event.target.value })} placeholder="Nome da estrategia" />
              <Input value={config.tableId} onChange={(event) => setConfig({ ...config, tableId: event.target.value })} placeholder="Mesa" />
              <Select value={destination} onValueChange={(value) => setDestination(value as ValidatorDestination)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESTINATION_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedChannelId || "none"} onValueChange={(value) => setSelectedChannelId(value === "none" ? "" : value)}>
                <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum canal</SelectItem>
                  {channels.map((channel) => <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={cooldownRounds}
                onChange={(event) => setCooldownRounds(Math.max(0, Number(event.target.value) || 0))}
                type="number"
                placeholder="Cooldown"
              />
            </div>
            <details className="mt-3 rounded-lg border border-border/60 bg-background/25 px-3 py-2 text-left text-xs">
              <summary className="cursor-pointer font-bold text-muted-foreground">Mensagem personalizada opcional</summary>
              <Textarea
                value={messageOverride}
                onChange={(event) => setMessageOverride(event.target.value)}
                placeholder="Opcional. Use {{pattern}}, {{entry}}, {{percentage}}, {{table}}"
                className="mt-3 min-h-20"
              />
            </details>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" className="btn-primary-grad" onClick={saveCurrentPattern} disabled={!canSave}>
                <Save className="size-4" /> Salvar Padrao
              </Button>
              <Button type="button" variant="secondary" onClick={() => writePatternDraft(pattern)}>
                <Save className="size-4" /> Rascunho
              </Button>
            </div>
          </div>

          <div>
            <div className="text-base font-black">Resultados a serem validados</div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {historyOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setHistorySize(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                    config.historySize === option ? "border-neon-cyan bg-neon-cyan/20 text-neon-cyan" : "border-border/70 bg-secondary/20 text-muted-foreground"
                  }`}
                >
                  {formatHistoryOption(option)}
                </button>
              ))}
            </div>
            <div className="mx-auto mt-3 flex h-10 w-56 items-center justify-between rounded-md border border-border/70 bg-background/50 px-2">
              <button type="button" className="px-2 text-neon-cyan" onClick={() => setHistorySize(config.historySize - 1000)}>-</button>
              <Input
                value={config.historySize}
                onChange={(event) => setHistorySize(Number(event.target.value))}
                type="number"
                className="h-7 border-neon-cyan/50 bg-transparent text-center text-sm font-black"
              />
              <button type="button" className="px-2 text-neon-cyan" onClick={() => setHistorySize(config.historySize + 1000)}>+</button>
            </div>
          </div>
        </div>
      </GlassCard>

      <ValidationResultPanel result={manualResult} config={config} />
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
}: {
  patterns: SavedValidatorPattern[];
  channels: ValidatorNotificationChannel[];
  onRemove: (id: string) => void;
  onRefresh: (pattern: SavedValidatorPattern) => void;
  onReset: (pattern: SavedValidatorPattern) => void;
  onToggle: (pattern: SavedValidatorPattern) => void;
}) {
  return (
    <div className="space-y-3">
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
  telegramEnabled,
}: {
  channels: ValidatorNotificationChannel[];
  channelForm: {
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
    isActive: boolean;
    entryTemplate: string;
  };
  setChannelForm: (form: {
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
    isActive: boolean;
    entryTemplate: string;
  }) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  telegramEnabled: boolean;
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
          <Button type="button" className="w-full btn-primary-grad" onClick={onSave} disabled={!telegramEnabled}>
            <Save className="size-4" /> Salvar configuracao
          </Button>
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
                </div>
                <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(channel.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
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

function ValidationResultPanel({ result, config }: { result: ValidatorResult | null; config: ValidatorConfig }) {
  const selectedEntry = entryTypeToSide(config.entryType) ?? result?.entry ?? null;

  if (!result) {
    return (
      <div className="rounded-xl border border-border/70 bg-background/35 p-4">
        <div className="text-sm font-black text-neon-cyan">Resultados da Validacao</div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <ResultChip label="Entrada" side={selectedEntry} />
          <ResultChip label="Empate" value={config.tieProtection ? "🟡 coberto" : "🟡 sem cobertura"} />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          A validacao automatica aparece aqui assim que houver padrao e historico real suficiente.
        </div>
      </div>
    );
  }

  const totalGreen = result.sgWins + result.g1Wins + result.g2Wins;

  return (
    <div className="rounded-xl border border-neon-cyan/25 bg-background/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black text-neon-cyan">Resultados da Validacao</div>
        <AppBadge tone={result.totalValidated ? "green" : "amber"}>{result.status}</AppBadge>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.38fr)_minmax(0,1fr)]">
        <div className="space-y-2 text-xs">
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

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <ResultChip label="Entrada" side={selectedEntry ?? result.entry} />
            <ResultChip label="Empate" value={config.tieProtection ? "🟡 coberto" : "🟡 sem cobertura"} />
            <ResultChip label="Rodadas" value={result.analyzedRounds.toLocaleString("pt-BR")} />
          </div>
          <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-sm">
            {result.pulledSide ? (
              <>Puxou <SideLabel side={result.pulledSide} /></>
            ) : result.totalSignals > 0 ? (
              <span className="text-warning">
                O padrao apareceu {result.totalSignals} vez(es), mas ainda nao teve rodada de entrada suficiente para validar o que puxou.
              </span>
            ) : (
              <span className="text-warning">Padrao detectado, mas ainda sem amostra suficiente para dizer o que puxou.</span>
            )}
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {result.details.slice(-18).reverse().map((detail) => (
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
            <Flame className="size-4 text-warning" /> Padrao IA Top {rank}
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
          {index < pattern.length - 1 && <span className="text-muted-foreground">→</span>}
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

function PatternBubbleLine({ pattern, className = "" }: { pattern: ValidatorPatternToken[]; className?: string }) {
  if (!pattern.length) {
    return (
      <div className={`flex min-h-14 items-center justify-center rounded-xl border border-dashed border-border/70 px-4 text-xs text-muted-foreground ${className}`}>
        Toque nas bolinhas para montar o padrao.
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 ${className}`}>
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-center gap-2">
          <BigTokenBubble side={token.side} score={token.score} />
          {index < pattern.length - 1 && <span className="text-lg font-black text-muted-foreground">→</span>}
        </span>
      ))}
    </div>
  );
}

function BigTokenBubble({ side, score }: { side: RoundResult; score?: number }) {
  return (
    <span className={`inline-flex size-11 items-center justify-center rounded-full border text-sm font-black shadow-lg ${bubbleClass(side)}`}>
      <span className="sr-only">{sideName(side)}</span>
      <span aria-hidden className="text-xl leading-none">{sideEmoji(side)}</span>
      {score ? <span className="-ml-1 text-[11px] text-white">{score}</span> : null}
    </span>
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
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-black transition hover:-translate-y-0.5 ${tokenClass(side)}`}
    >
      <span className="text-xl leading-none">{sideEmoji(side)}</span>
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
      className="inline-flex size-11 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-muted-foreground transition hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-45"
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
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition ${
        selected ? `${tokenClass(side)} ring-1 ring-current` : "border-border/70 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
      }`}
    >
      <span className="text-xl leading-none">{sideEmoji(side)}</span>
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

function invertToken(token: ValidatorPatternToken): ValidatorPatternToken {
  if (token.side === "B") return { ...token, side: "P" };
  if (token.side === "P") return { ...token, side: "B" };
  return token;
}

function sideEmoji(side: RoundResult) {
  if (side === "B") return "🔴";
  if (side === "P") return "🔵";
  return "🟡";
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

function bubbleClass(side: RoundResult) {
  if (side === "B") return "border-banker/50 bg-banker/20 shadow-banker/20";
  if (side === "P") return "border-player/50 bg-player/20 shadow-player/20";
  return "border-warning/60 bg-warning/20 shadow-warning/20";
}

function formatHistoryOption(value: number) {
  return value >= 1000 ? `${value / 1000}k` : String(value);
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
