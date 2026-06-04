import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readAdminSession } from "@/lib/adminApi";
import { requestLocalAiCommentary } from "@/lib/localAiApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { readVoiceResponseError } from "@/lib/voiceApiError";
import type { AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";
import type { DashboardData } from "@/types/dashboard";
import {
  DEFAULT_VOICE_NARRATION_STYLE,
  buildVoiceEvents,
  buildVoiceResultEvents,
  isVoiceNarrationStyle,
  type VoiceEvent,
  type VoiceNarrationStyle,
  type VoicePriority,
} from "@/lib/voiceNarrative";

type DashboardMode = "mock" | "fallback" | "connecting" | "live";
export type VoiceProvider = "browser" | "edge-tts" | "elevenlabs" | "piper";
export type BrowserVoiceChoice = "browser_auto" | "pt-BR-AntonioNeural";

const STORAGE_KEY = "sniper_voice_assistant_enabled";
const STYLE_STORAGE_KEY = "sniper_voice_assistant_style";
const VOICE_PROVIDER_STORAGE_KEY = "sniper_voice_assistant_provider";
const VOICE_CHOICE_STORAGE_KEY = "sniper_voice_assistant_browser_voice";
const VOICE_VOLUME_STORAGE_KEY = "sniper_voice_assistant_volume";
const VOICE_RATE_STORAGE_KEY = "sniper_voice_assistant_rate";
const VOICE_PITCH_STORAGE_KEY = "sniper_voice_assistant_pitch";
const COMMON_COOLDOWN_MS = 8_000;
const MAX_QUEUE_SIZE = 3;
const VOICE_COORDINATION_EVENT = "sniper-voice-stop";
const VOICE_ASSISTANT_SOURCE = "voice-assistant";
const DEFAULT_PROVIDER = normalizeVoiceProvider(
  (import.meta.env.VITE_VOICE_PROVIDER as string | undefined) || "edge-tts",
);
const DEFAULT_VOICE = "pt-BR-AntonioNeural";

export function useVoiceAssistant(
  data: DashboardData,
  mode: DashboardMode,
  adaptiveSnapshot?: AdaptiveStrategySnapshot,
) {
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestNarration, setLatestNarration] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [style, setStyle] = useState<VoiceNarrationStyle>(DEFAULT_VOICE_NARRATION_STYLE);
  const [provider, setProvider] = useState<VoiceProvider>(DEFAULT_PROVIDER);
  const [voiceChoice, setVoiceChoice] = useState<BrowserVoiceChoice>(DEFAULT_VOICE);
  const [volume, setVolume] = useState(0.9);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(0.95);
  const [voiceError, setVoiceError] = useState("");

  const enabledRef = useRef(false);
  const lastNarrationAtRef = useRef(0);
  const latestNarrationRef = useRef("");
  const preferenceLoadedRef = useRef(false);
  const previousDataRef = useRef<DashboardData | null>(null);
  const queueRef = useRef<VoiceEvent[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const lastQueuedTextRef = useRef("");
  const timerRef = useRef<number | undefined>(undefined);
  const speakingRef = useRef(false);
  const processQueueRef = useRef<() => void>(() => undefined);
  const playbackIdRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const isBrowser = typeof window !== "undefined";
  const audioSupported = isBrowser && typeof window.Audio !== "undefined" && typeof URL !== "undefined";
  const speechSupported =
    isBrowser &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined";
  const supported = provider === "browser" ? speechSupported : audioSupported || speechSupported;
  const hasLiveBackendData = mode === "live" && data.mockMode === false;
  const events = useMemo(() => {
    const resultEvents = buildVoiceResultEvents(previousDataRef.current, data, style);
    if (resultEvents.length) return resultEvents;
    return buildVoiceEvents(data, style, adaptiveSnapshot);
  }, [adaptiveSnapshot, data, style]);
  const canAutoNarrate = enabled && hasLiveBackendData && supported;

  const syncQueueLength = useCallback(() => setQueueLength(queueRef.current.length), []);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = undefined;
  }, []);

  const disposePlayback = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = "";
    }
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  const finishPlayback = useCallback(
    (playbackId: number, updateCooldown: boolean) => {
      if (playbackIdRef.current !== playbackId) return;
      disposePlayback();
      speakingRef.current = false;
      setIsSpeaking(false);
      if (updateCooldown) lastNarrationAtRef.current = Date.now();
      timerRef.current = window.setTimeout(() => processQueueRef.current(), 0);
    },
    [disposePlayback],
  );

  const stopCurrentPlayback = useCallback(() => {
    clearTimer();
    playbackIdRef.current += 1;
    disposePlayback();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, [clearTimer, disposePlayback]);

  const speakWithBrowser = useCallback(
    async (text: string) => {
      if (!speechSupported) return "Web Speech API indisponível neste navegador.";
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "pt-BR";
        utterance.volume = clamp(volume, 0, 1);
        utterance.rate = clamp(rate, 0.7, 1.35);
        utterance.pitch = clamp(pitch, 0.6, 1.45);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice =
          voices.find((voice) => voice.name === voiceChoice) ??
          voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-br")) ??
          voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ??
          null;

        await new Promise<void>((resolve, reject) => {
          utterance.onend = () => resolve();
          utterance.onerror = () => reject(new Error("Falha ao narrar pelo navegador."));
          window.speechSynthesis.speak(utterance);
        });
        return true;
      } catch {
        return "Falha ao narrar pelo navegador.";
      }
    },
    [pitch, rate, speechSupported, voiceChoice, volume],
  );

  const speakWithBackendVoice = useCallback(
    async (text: string) => {
      if (provider === "browser") return speakWithBrowser(text);
      if (!audioSupported) return speakWithBrowser(text);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const token = readVoiceAuthToken();
      try {
        const response = await fetch(readVoiceApiUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}`, "x-sniper-token": token } : {}),
          },
          body: JSON.stringify({
            text,
            provider,
            voice: voiceChoice || DEFAULT_VOICE,
            language: "pt-BR",
            volume,
            rate,
            pitch,
          }),
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) {
          const error = await readVoiceResponseError(response, "Falha ao gerar voz local.");
          const fallback = await speakWithBrowser(text);
          return fallback === true ? true : error;
        }
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => ({}))) as { fallback?: string; error?: string };
          if (payload.fallback === "browser") return speakWithBrowser(text);
          if (payload.error) return payload.error;
          return speakWithBrowser(text);
        }

        const blob = await response.blob();
        if (!blob.size) return speakWithBrowser(text);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audio.volume = clamp(volume, 0, 1);
        audioRef.current = audio;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Falha ao tocar voz local."));
          audio.play().catch(reject);
        });
        return true;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return "";
        return speakWithBrowser(text);
      }
    },
    [audioSupported, pitch, provider, rate, speakWithBrowser, voiceChoice, volume],
  );

  const speakText = useCallback(
    (text: string, priority: VoicePriority, updateCooldown: boolean) => {
      if (!supported) {
        setVoiceError("Voz indisponível no momento.");
        return;
      }
      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      broadcastVoiceStop(VOICE_ASSISTANT_SOURCE);
      speakingRef.current = true;
      setIsSpeaking(true);
      setVoiceError("");

      void (async () => {
        let narration = text;
        if (priority === 3) {
          try {
            const ai = await requestLocalAiCommentary({
              event: "narracao",
              fallbackText: text,
              adaptiveSnapshot,
            });
            narration = ai.commentary || text;
            latestNarrationRef.current = narration;
            setLatestNarration(narration);
          } catch {
            narration = text;
          }
        }
        if (playbackIdRef.current !== playbackId) return;
        const result = await speakWithBackendVoice(narration);
        if (result !== true && result) setVoiceError(result);
        finishPlayback(playbackId, updateCooldown);
      })();
    },
    [adaptiveSnapshot, finishPlayback, speakWithBackendVoice, supported],
  );

  const processQueue = useCallback(() => {
    clearTimer();
    if (!enabledRef.current || speakingRef.current || !supported) return;
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
      const unseenEvents = nextEvents.filter((event) => !seenKeysRef.current.has(event.key));
      if (!unseenEvents.length) {
        syncQueueLength();
        processQueue();
        return;
      }

      const interrupt = unseenEvents.some((event) => event.priority >= 4 && event.bypassCooldown);
      if (interrupt) queueRef.current = [];

      for (const event of unseenEvents) {
        seenKeysRef.current.add(event.key);
        if (event.text === lastQueuedTextRef.current) continue;
        lastQueuedTextRef.current = event.text;
        latestNarrationRef.current = event.text;
        setLatestNarration(event.text);
        queueRef.current.push(event);
      }

      queueRef.current = queueRef.current
        .sort((left, right) => right.priority - left.priority)
        .slice(0, MAX_QUEUE_SIZE);
      syncQueueLength();
      if (interrupt && speakingRef.current) stopCurrentPlayback();
      processQueue();
    },
    [processQueue, stopCurrentPlayback, syncQueueLength],
  );

  const replayLastNarration = useCallback(() => {
    if (!latestNarrationRef.current) return;
    stopCurrentPlayback();
    speakText(latestNarrationRef.current, 5, false);
  }, [speakText, stopCurrentPlayback]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) === "true";
    const savedStyle = window.localStorage.getItem(STYLE_STORAGE_KEY);
    enabledRef.current = saved;
    preferenceLoadedRef.current = true;
    setEnabled(saved);
    if (isVoiceNarrationStyle(savedStyle)) setStyle(savedStyle);
    else if (savedStyle === "balanced") setStyle("professional");
    setProvider(normalizeVoiceProvider(window.localStorage.getItem(VOICE_PROVIDER_STORAGE_KEY)));
    setVoiceChoice(normalizeVoiceChoice(window.localStorage.getItem(VOICE_CHOICE_STORAGE_KEY)));
    setVolume(readStoredNumber(VOICE_VOLUME_STORAGE_KEY, 0.9, 0, 1));
    setRate(readStoredNumber(VOICE_RATE_STORAGE_KEY, 1, 0.7, 1.35));
    setPitch(readStoredNumber(VOICE_PITCH_STORAGE_KEY, 0.95, 0.6, 1.45));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onVoiceStop = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== VOICE_ASSISTANT_SOURCE) stopCurrentPlayback();
    };
    window.addEventListener(VOICE_COORDINATION_EVENT, onVoiceStop);
    return () => window.removeEventListener(VOICE_COORDINATION_EVENT, onVoiceStop);
  }, [stopCurrentPlayback]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!preferenceLoadedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    if (!enabled) {
      queueRef.current = [];
      syncQueueLength();
      stopCurrentPlayback();
    }
  }, [enabled, stopCurrentPlayback, syncQueueLength]);

  useEffect(() => {
    if (!preferenceLoadedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(STYLE_STORAGE_KEY, style);
  }, [style]);

  useEffect(() => {
    if (!preferenceLoadedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(VOICE_PROVIDER_STORAGE_KEY, provider);
    window.localStorage.setItem(VOICE_CHOICE_STORAGE_KEY, voiceChoice);
    window.localStorage.setItem(VOICE_VOLUME_STORAGE_KEY, String(volume));
    window.localStorage.setItem(VOICE_RATE_STORAGE_KEY, String(rate));
    window.localStorage.setItem(VOICE_PITCH_STORAGE_KEY, String(pitch));
  }, [pitch, provider, rate, voiceChoice, volume]);

  useEffect(() => {
    if (hasLiveBackendData && events[0]) {
      latestNarrationRef.current = events[0].text;
      setLatestNarration(events[0].text);
    }
  }, [events, hasLiveBackendData]);

  useEffect(() => {
    if (canAutoNarrate) enqueueEvents(events);
  }, [canAutoNarrate, enqueueEvents, events]);

  useEffect(() => {
    if (hasLiveBackendData) previousDataRef.current = data;
  }, [data, hasLiveBackendData]);

  useEffect(() => () => stopCurrentPlayback(), [stopCurrentPlayback]);

  return {
    enabled,
    setEnabled,
    isSpeaking,
    latestNarration,
    queueLength,
    style,
    setStyle,
    provider,
    setProvider,
    voiceChoice,
    setVoiceChoice,
    volume,
    setVolume,
    rate,
    setRate,
    pitch,
    setPitch,
    voiceError,
    hasLiveBackendData,
    supported,
    speechSupported,
    canReplay: supported && Boolean(latestNarration),
    replayLastNarration,
  };
}

function readVoiceApiUrl() {
  const adminSession = readAdminSession();
  if (adminSession?.apiUrl) {
    return `${adminSession.apiUrl.replace(/\/+$/, "")}/api/voice/speak`;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin.replace(/\/+$/, "")}/api/voice/speak`;
  }
  return "/api/voice/speak";
}

function readVoiceAuthToken() {
  const adminSession = readAdminSession();
  if (adminSession?.token) return adminSession.token;

  const userSession = readUserSession();
  if (userSession.clientToken) return userSession.clientToken;
  if (hasFullAccess(userSession)) return "sniper-local-admin-token";
  if (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  ) {
    return "sniper-local-admin-token";
  }
  return "";
}

function normalizeVoiceProvider(value: unknown): VoiceProvider {
  const text = String(value || "").trim().toLowerCase();
  if (text === "browser" || text === "edge-tts" || text === "elevenlabs" || text === "piper") {
    return text;
  }
  return "edge-tts";
}

function normalizeVoiceChoice(value: unknown): BrowserVoiceChoice {
  const text = String(value || "").trim();
  if (text === "browser_auto" || text === "pt-BR-AntonioNeural") return text;
  return DEFAULT_VOICE;
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") return fallback;
  const number = Number(window.localStorage.getItem(key));
  return Number.isFinite(number) ? clamp(number, min, max) : fallback;
}

function broadcastVoiceStop(source: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VOICE_COORDINATION_EVENT, { detail: { source } }));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
