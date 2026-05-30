import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CurrentSignalSide,
  DashboardData,
  NeuralReading,
  SurfAlert,
  TieAlert,
} from "@/types/dashboard";
import { getInitialApiUrl, readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";

type DashboardMode = "mock" | "fallback" | "connecting" | "live";
type VoicePriority = 1 | 2 | 3;

interface VoiceEvent {
  key: string;
  text: string;
  priority: VoicePriority;
  bypassCooldown: boolean;
}

const STORAGE_KEY = "sniper_voice_assistant_enabled";
const COMMON_COOLDOWN_MS = 30_000;
const MAX_QUEUE_SIZE = 6;
const OPENAI_VOICE_ENABLED = import.meta.env.VITE_OPENAI_VOICE_ENABLED === "true";

export function useVoiceAssistant(data: DashboardData, mode: DashboardMode) {
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestNarration, setLatestNarration] = useState("");
  const [queueLength, setQueueLength] = useState(0);

  const enabledRef = useRef(false);
  const currentPriorityRef = useRef<VoicePriority | 0>(0);
  const lastNarrationAtRef = useRef(0);
  const latestNarrationRef = useRef("");
  const preferenceLoadedRef = useRef(false);
  const processQueueRef = useRef<() => void>(() => undefined);
  const queueRef = useRef<VoiceEvent[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | undefined>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioFinishRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const playbackIdRef = useRef(0);
  const speakingRef = useRef(false);
  const speechFinishRef = useRef<(() => void) | null>(null);

  const isBrowser = typeof window !== "undefined";
  const speechSupported =
    isBrowser && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  const audioSupported =
    isBrowser && typeof window.Audio !== "undefined" && typeof window.URL !== "undefined";
  const supported = speechSupported || (OPENAI_VOICE_ENABLED && audioSupported);
  const hasLiveBackendData = mode === "live" && data.mockMode === false;
  const events = useMemo(() => buildVoiceEvents(data), [data]);
  const canAutoNarrate = enabled && hasLiveBackendData && supported;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const syncQueueLength = useCallback(() => {
    setQueueLength(queueRef.current.length);
  }, []);

  const disposeAudio = useCallback(() => {
    audioFinishRef.current?.();
    audioFinishRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (audioUrlRef.current && typeof URL !== "undefined") {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
  }, []);

  const finishPlayback = useCallback(
    (playbackId: number, updateCooldown: boolean) => {
      if (playbackIdRef.current !== playbackId) return;
      abortControllerRef.current = null;
      disposeAudio();
      currentPriorityRef.current = 0;
      speakingRef.current = false;
      setIsSpeaking(false);
      if (updateCooldown) lastNarrationAtRef.current = Date.now();
      timerRef.current = window.setTimeout(() => processQueueRef.current(), 0);
    },
    [disposeAudio],
  );

  const stopCurrentPlayback = useCallback(() => {
    clearTimer();
    playbackIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    disposeAudio();
    speechFinishRef.current?.();
    speechFinishRef.current = null;
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    currentPriorityRef.current = 0;
    speakingRef.current = false;
    setIsSpeaking(false);
  }, [clearTimer, disposeAudio, speechSupported]);

  const playBrowserSpeech = useCallback(
    (text: string) =>
      new Promise<boolean>((resolve) => {
        if (!speechSupported) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.voice = selectBestPortugueseVoice();

        const finish = (played: boolean) => {
          speechFinishRef.current = null;
          resolve(played);
        };

        speechFinishRef.current = () => finish(false);
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }),
    [speechSupported],
  );

  const playOpenAiSpeech = useCallback(
    async (text: string) => {
      if (!audioSupported) return false;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const token = readVoiceAuthToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        headers["x-sniper-token"] = token;
      }

      try {
        const response = await fetch(readVoiceApiUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });
        if (!response.ok) return false;

        const blob = await response.blob();
        if (!blob.size) return false;

        const audioUrl = window.URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            audioFinishRef.current = null;
            resolve();
          };
          audioFinishRef.current = finish;
          audio.onended = finish;
          audio.onerror = () => {
            audioFinishRef.current = null;
            reject(new Error("Falha ao tocar a narracao OpenAI."));
          };
          audio.play().catch(reject);
        });

        return true;
      } catch (error) {
        if ((error as { name?: string })?.name !== "AbortError") {
          console.warn("Narracao OpenAI indisponivel, usando voz do navegador.", error);
        }
        return false;
      }
    },
    [audioSupported],
  );

  const speakText = useCallback(
    (text: string, priority: VoicePriority, updateCooldown: boolean) => {
      if (!supported) return;

      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      currentPriorityRef.current = priority;
      speakingRef.current = true;
      setIsSpeaking(true);

      void (async () => {
        let played = OPENAI_VOICE_ENABLED ? await playOpenAiSpeech(text) : false;
        if (!played && playbackIdRef.current === playbackId) {
          played = await playBrowserSpeech(text);
        }
        finishPlayback(playbackId, updateCooldown);
      })();
    },
    [finishPlayback, playBrowserSpeech, playOpenAiSpeech, supported],
  );

  const processQueue = useCallback(() => {
    clearTimer();
    if (!supported || !enabledRef.current || speakingRef.current) return;

    const next = queueRef.current[0];
    if (!next) {
      syncQueueLength();
      return;
    }

    const elapsed = Date.now() - lastNarrationAtRef.current;
    if (!next.bypassCooldown && elapsed < COMMON_COOLDOWN_MS) {
      timerRef.current = window.setTimeout(processQueue, COMMON_COOLDOWN_MS - elapsed);
      syncQueueLength();
      return;
    }

    queueRef.current.shift();
    syncQueueLength();
    speakText(next.text, next.priority, true);
  }, [clearTimer, speakText, supported, syncQueueLength]);
  processQueueRef.current = processQueue;

  const enqueueEvents = useCallback(
    (nextEvents: VoiceEvent[]) => {
      let hasUrgentEvent = false;

      for (const event of nextEvents) {
        if (seenKeysRef.current.has(event.key)) continue;
        seenKeysRef.current.add(event.key);
        latestNarrationRef.current = event.text;
        setLatestNarration(event.text);

        queueRef.current.push(event);
        if (event.priority === 3) hasUrgentEvent = true;
      }

      queueRef.current = queueRef.current
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_QUEUE_SIZE);
      syncQueueLength();

      if (hasUrgentEvent && supported && speakingRef.current && currentPriorityRef.current < 3) {
        stopCurrentPlayback();
      }

      processQueue();
    },
    [processQueue, stopCurrentPlayback, supported, syncQueueLength],
  );

  const replayLastNarration = useCallback(() => {
    if (!supported || !latestNarrationRef.current) return;
    stopCurrentPlayback();
    speakText(latestNarrationRef.current, 3, false);
  }, [speakText, stopCurrentPlayback, supported]);

  useEffect(() => {
    if (!preferenceLoadedRef.current) return;
    enabledRef.current = enabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    }
    if (!enabled && supported) {
      queueRef.current = [];
      syncQueueLength();
      stopCurrentPlayback();
    }
  }, [enabled, stopCurrentPlayback, supported, syncQueueLength]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) === "true";
    enabledRef.current = saved;
    preferenceLoadedRef.current = true;
    setEnabled(saved);
  }, []);

  useEffect(() => {
    if (hasLiveBackendData && events[0]) {
      latestNarrationRef.current = events[0].text;
      setLatestNarration(events[0].text);
    }
  }, [events, hasLiveBackendData]);

  useEffect(() => {
    if (!canAutoNarrate) return;
    enqueueEvents(events);
  }, [canAutoNarrate, enqueueEvents, events]);

  useEffect(() => {
    return () => {
      stopCurrentPlayback();
    };
  }, [stopCurrentPlayback]);

  return {
    enabled,
    setEnabled,
    isSpeaking,
    latestNarration,
    queueLength,
    hasLiveBackendData,
    supported,
    canReplay: supported && Boolean(latestNarration),
    replayLastNarration,
  };
}

function buildVoiceEvents(data: DashboardData): VoiceEvent[] {
  const events: VoiceEvent[] = [];
  const signal = data.currentSignal;
  const decision = data.engineDecision;

  if (
    signal.status === "green" ||
    signal.status === "green_g1" ||
    data.currentSignal.lastResult?.status?.startsWith("green")
  ) {
    const result =
      signal.status === "green_g1" || data.currentSignal.lastResult?.status === "green_g1"
        ? "Green G1"
        : "Green";
    events.push(
      urgent(
        `result:${signal.id}:${signal.status}:${data.currentSignal.lastResult?.id ?? ""}`,
        `${result} confirmado em ${sideLabel(data.currentSignal.lastResult?.side ?? signal.side)}.`,
      ),
    );
  }

  if (signal.status === "red" || data.currentSignal.lastResult?.status === "red") {
    events.push(
      urgent(
        `red:${signal.id}:${data.currentSignal.lastResult?.id ?? ""}`,
        `Red registrado em ${sideLabel(data.currentSignal.lastResult?.side ?? signal.side)}.`,
      ),
    );
  }

  if (decision.state === "BLOQUEADO") {
    events.push(
      urgent(
        `blocked:${decision.reason}:${decision.confidence}`,
        `Entrada bloqueada por risco alto. Motivo: ${decision.reason}`,
      ),
    );
  }

  if (
    (signal.status === "pending" || signal.status === "g1") &&
    (signal.side === "BANKER" || signal.side === "PLAYER")
  ) {
    events.push(
      urgent(
        `entry:${signal.id}:${signal.side}:${signal.status}:${signal.protection}`,
        `Entrada confirmada em ${sideLabel(signal.side)}. Motivo: ${decision.reason}`,
      ),
    );
  }

  if (
    (signal.status === "pending" || signal.status === "g1" || signal.status === "tie_watch") &&
    signal.side === "TIE"
  ) {
    events.push(
      urgent(
        `entry-tie:${signal.id}:${signal.status}`,
        `Entrada confirmada em Tie. Motivo: ${decision.reason}`,
      ),
    );
  }

  const tieEvent = buildTieEvent(data.currentTieAlert);
  if (tieEvent) events.push(tieEvent);

  const surfEvent = buildSurfEvent(data.currentSurfAlert);
  if (surfEvent) events.push(surfEvent);

  const neuralEvent = buildNeuralEvent(data.neuralReading);
  if (neuralEvent) events.push(neuralEvent);

  if (signal.status === "waiting" && decision.state !== "BLOQUEADO") {
    const lastRoundId = data.rounds[data.rounds.length - 1]?.id ?? "sem-rodada";
    events.push(
      common(
        `observing:${lastRoundId}:${decision.state}:${decision.reason}`,
        `Mesa em observação sem entrada confirmada. ${decision.reason}`,
      ),
    );
  }

  return events;
}

function buildNeuralEvent(reading?: NeuralReading): VoiceEvent | null {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return null;

  const side = reading.direcao ?? reading.origem;
  const details = [
    `${sideLabel(side)} ${reading.numero}`,
    reading.validade ? `validade ${reading.validade}` : "",
    reading.paganteStatus ? `status ${reading.paganteStatus}` : "",
    reading.paganteAlert ?? "",
  ].filter(Boolean);

  return medium(
    `neural:${reading.mode}:${reading.numero}:${reading.origem ?? ""}:${reading.direcao ?? ""}:${reading.paganteStatus ?? ""}:${reading.alertas ?? ""}`,
    `Número pagante identificado. ${details.join(", ")}.`,
  );
}

function buildSurfEvent(alert?: SurfAlert): VoiceEvent | null {
  if (!alert || (!alert.surf_alert && alert.surf_phase === "SEM_RISCO")) return null;

  const breakRisk = alert.surf_break_risk ?? alert.surf_risk;
  const risk = riskLabel(breakRisk);
  const side = sideLabel(
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side,
  );
  const status = alert.surf_status ?? phaseLabel(alert.surf_phase);

  return medium(
    `surf:${alert.surf_phase}:${alert.surf_side}:${alert.surf_prediction_side ?? ""}:${alert.surf_prediction_status ?? ""}:${breakRisk}:${alert.surf_confidence}`,
    `Leitura de surf detectada. ${side} em ${status}, com risco ${risk} de quebra.`,
  );
}

function buildTieEvent(alert: TieAlert): VoiceEvent | null {
  if (alert.status !== "active") return null;
  return urgent(
    `tie:${alert.id}:${alert.status}:${alert.level}:${alert.validityRounds}`,
    `Atenção para empate. Mesa com pressão de Tie, validade até ${alert.validityRounds} rodadas.`,
  );
}

function urgent(key: string, text: string): VoiceEvent {
  return { key, text, priority: 3, bypassCooldown: true };
}

function medium(key: string, text: string): VoiceEvent {
  return { key, text, priority: 2, bypassCooldown: false };
}

function common(key: string, text: string): VoiceEvent {
  return { key, text, priority: 1, bypassCooldown: false };
}

function selectBestPortugueseVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const scoredVoices = voices
    .map((voice) => ({ voice, score: scorePortugueseVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredVoices[0]?.voice ?? null;
}

function scorePortugueseVoice(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let score = 0;

  if (lang === "pt-br") score += 120;
  else if (lang.startsWith("pt")) score += 80;

  if (name.includes("natural")) score += 45;
  if (name.includes("online")) score += 35;
  if (name.includes("microsoft")) score += 30;
  if (name.includes("google")) score += 20;
  if (name.includes("maria") || name.includes("francisca") || name.includes("antonio")) {
    score += 20;
  }
  if (name.includes("brasil") || name.includes("brazil") || name.includes("portuguese")) {
    score += 15;
  }
  if (voice.default) score += 5;

  return score;
}

function readVoiceApiUrl() {
  const adminSession = readAdminSession();
  const apiUrl = adminSession?.apiUrl || getInitialApiUrl();
  return `${apiUrl.replace(/\/+$/, "")}/voice/narration`;
}

function readVoiceAuthToken() {
  const adminSession = readAdminSession();
  if (adminSession?.token) return adminSession.token;

  const userSession = readUserSession();
  if (userSession.clientToken) return userSession.clientToken;

  if (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  ) {
    return "sniper-local-admin-token";
  }

  return "";
}

function sideLabel(side?: CurrentSignalSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "mesa";
}

function riskLabel(value: number) {
  if (value >= 70) return "alto";
  if (value >= 40) return "médio";
  return "baixo";
}

function phaseLabel(phase: SurfAlert["surf_phase"]) {
  return phase.toLowerCase().replace(/_/g, " ");
}
