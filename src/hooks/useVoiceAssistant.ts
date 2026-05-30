import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/types/dashboard";
import { getInitialApiUrl, readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import {
  DEFAULT_VOICE_NARRATION_STYLE,
  buildVoiceEvents,
  isVoiceNarrationStyle,
  type VoiceEvent,
  type VoiceNarrationStyle,
  type VoicePriority,
} from "@/lib/voiceNarrative";

type DashboardMode = "mock" | "fallback" | "connecting" | "live";
export type BrowserVoiceChoice = "automatic" | "julio" | "feminine" | "masculine";

const STORAGE_KEY = "sniper_voice_assistant_enabled";
const STYLE_STORAGE_KEY = "sniper_voice_assistant_style";
const VOICE_CHOICE_STORAGE_KEY = "sniper_voice_assistant_browser_voice";
const COMMON_COOLDOWN_MS = 30_000;
const MAX_QUEUE_SIZE = 6;
const OPENAI_VOICE_ENABLED = import.meta.env.VITE_OPENAI_VOICE_ENABLED === "true";

export function useVoiceAssistant(data: DashboardData, mode: DashboardMode) {
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestNarration, setLatestNarration] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [style, setStyle] = useState<VoiceNarrationStyle>(DEFAULT_VOICE_NARRATION_STYLE);
  const [voiceChoice, setVoiceChoice] = useState<BrowserVoiceChoice>("automatic");

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
  const events = useMemo(() => buildVoiceEvents(data, style), [data, style]);
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
        utterance.voice = selectBestPortugueseVoice(voiceChoice);

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
    [speechSupported, voiceChoice],
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
      const event = nextEvents.find((candidate) => !seenKeysRef.current.has(candidate.key));
      if (!event) {
        syncQueueLength();
        processQueue();
        return;
      }

      seenKeysRef.current.add(event.key);
      latestNarrationRef.current = event.text;
      setLatestNarration(event.text);

      if (event.priority === 3 && event.bypassCooldown) {
        queueRef.current = [];
      }

      queueRef.current.push(event);
      queueRef.current = queueRef.current
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_QUEUE_SIZE);
      syncQueueLength();

      if (
        event.priority === 3 &&
        event.bypassCooldown &&
        supported &&
        speakingRef.current
      ) {
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
    const savedStyle = window.localStorage.getItem(STYLE_STORAGE_KEY);
    const savedVoiceChoice = window.localStorage.getItem(VOICE_CHOICE_STORAGE_KEY);
    enabledRef.current = saved;
    preferenceLoadedRef.current = true;
    setEnabled(saved);
    if (isVoiceNarrationStyle(savedStyle)) {
      setStyle(savedStyle);
    }
    if (isBrowserVoiceChoice(savedVoiceChoice)) {
      setVoiceChoice(savedVoiceChoice);
    }
  }, []);

  useEffect(() => {
    if (!preferenceLoadedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(STYLE_STORAGE_KEY, style);
  }, [style]);

  useEffect(() => {
    if (!preferenceLoadedRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(VOICE_CHOICE_STORAGE_KEY, voiceChoice);
  }, [voiceChoice]);

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
    style,
    setStyle,
    voiceChoice,
    setVoiceChoice,
    hasLiveBackendData,
    supported,
    canReplay: supported && Boolean(latestNarration),
    replayLastNarration,
  };
}

function isBrowserVoiceChoice(value: unknown): value is BrowserVoiceChoice {
  return (
    value === "automatic" ||
    value === "julio" ||
    value === "feminine" ||
    value === "masculine"
  );
}

function selectBestPortugueseVoice(choice: BrowserVoiceChoice) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const julioVoice = bestMatchingVoice(voices, isJulioVoice);
  if ((choice === "automatic" || choice === "julio") && julioVoice) {
    return julioVoice;
  }

  if (choice === "feminine") {
    const feminineVoice = bestMatchingVoice(voices, isFeminineVoice);
    if (feminineVoice) return feminineVoice;
  }

  if (choice === "masculine") {
    const masculineVoice = bestMatchingVoice(voices, isMasculineVoice);
    if (masculineVoice) return masculineVoice;
  }

  const scoredVoices = voices
    .map((voice) => ({ voice, score: scorePortugueseVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredVoices[0]?.voice ?? null;
}

function bestMatchingVoice(
  voices: SpeechSynthesisVoice[],
  predicate: (voice: SpeechSynthesisVoice) => boolean,
) {
  return voices
    .map((voice) => ({ voice, score: scorePortugueseVoice(voice) }))
    .filter((item) => item.score > 0 && predicate(item.voice))
    .sort((a, b) => b.score - a.score)[0]?.voice ?? null;
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

function isJulioVoice(voice: SpeechSynthesisVoice) {
  return normalizeVoiceText(voice.name).includes("julio");
}

function isFeminineVoice(voice: SpeechSynthesisVoice) {
  const name = normalizeVoiceText(`${voice.name} ${voice.lang}`);
  return [
    "female",
    "feminina",
    "mulher",
    "woman",
    "maria",
    "francisca",
    "luciana",
    "helena",
    "leticia",
    "vitoria",
  ].some((token) => name.includes(token));
}

function isMasculineVoice(voice: SpeechSynthesisVoice) {
  const name = normalizeVoiceText(`${voice.name} ${voice.lang}`);
  return [
    "male",
    "masculina",
    "masculino",
    "homem",
    "man",
    "julio",
    "antonio",
    "daniel",
    "rafael",
    "ricardo",
  ].some((token) => name.includes(token));
}

function normalizeVoiceText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
