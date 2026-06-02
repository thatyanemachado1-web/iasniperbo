import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData } from "@/types/dashboard";
import { getInitialApiUrl, readAdminSession } from "@/lib/adminApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { readVoiceResponseError } from "@/lib/voiceApiError";
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
export type BrowserVoiceChoice = "elevenlabs_male_deep";

const STORAGE_KEY = "sniper_voice_assistant_enabled";
const STYLE_STORAGE_KEY = "sniper_voice_assistant_style";
const VOICE_CHOICE_STORAGE_KEY = "sniper_voice_assistant_browser_voice";
const COMMON_COOLDOWN_MS = 30_000;
const MAX_QUEUE_SIZE = 6;
const VOICE_PROVIDER = ((import.meta.env.VITE_VOICE_PROVIDER as string | undefined) || "elevenlabs")
  .trim()
  .toLowerCase();
const ELEVENLABS_ENABLED = VOICE_PROVIDER === "elevenlabs";
const ELEVENLABS_UNAVAILABLE_MESSAGE = "Voz ElevenLabs indisponível no momento.";

export function useVoiceAssistant(data: DashboardData, mode: DashboardMode) {
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [latestNarration, setLatestNarration] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [style, setStyle] = useState<VoiceNarrationStyle>(DEFAULT_VOICE_NARRATION_STYLE);
  const [voiceChoice, setVoiceChoice] = useState<BrowserVoiceChoice>("elevenlabs_male_deep");
  const [voiceError, setVoiceError] = useState("");

  const enabledRef = useRef(false);
  const currentPriorityRef = useRef<VoicePriority | 0>(0);
  const lastNarrationAtRef = useRef(0);
  const latestNarrationRef = useRef("");
  const preferenceLoadedRef = useRef(false);
  const processQueueRef = useRef<() => void>(() => undefined);
  const queueRef = useRef<VoiceEvent[]>([]);
  const seenKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<number | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioFinishRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const playbackIdRef = useRef(0);
  const previousDataRef = useRef<DashboardData | null>(null);
  const speakingRef = useRef(false);

  const isBrowser = typeof window !== "undefined";
  const audioSupported =
    isBrowser && typeof window.Audio !== "undefined" && typeof window.URL !== "undefined";
  const supported = ELEVENLABS_ENABLED && audioSupported;
  const hasLiveBackendData = mode === "live" && data.mockMode === false;
  const events = useMemo(
    () => [
      ...buildVoiceResultEvents(previousDataRef.current, data, style),
      ...buildVoiceEvents(data, style),
    ],
    [data, style],
  );
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
    currentPriorityRef.current = 0;
    speakingRef.current = false;
    setIsSpeaking(false);
  }, [clearTimer, disposeAudio]);

  const speakWithElevenLabs = useCallback(
    async (text: string) => {
      if (!audioSupported || !ELEVENLABS_ENABLED) return ELEVENLABS_UNAVAILABLE_MESSAGE;

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
        if (!response.ok) return readVoiceResponseError(response, ELEVENLABS_UNAVAILABLE_MESSAGE);

        const blob = await response.blob();
        if (!blob.size) return ELEVENLABS_UNAVAILABLE_MESSAGE;

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
            reject(new Error("Falha ao tocar a narracao ElevenLabs."));
          };
          audio.play().catch(reject);
        });

        return true;
      } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") return "";
        return ELEVENLABS_UNAVAILABLE_MESSAGE;
      }
    },
    [audioSupported],
  );

  const speakText = useCallback(
    (text: string, priority: VoicePriority, updateCooldown: boolean) => {
      if (!supported) {
        setVoiceError(ELEVENLABS_UNAVAILABLE_MESSAGE);
        return;
      }

      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      currentPriorityRef.current = priority;
      speakingRef.current = true;
      setIsSpeaking(true);
      setVoiceError("");

      void (async () => {
        const result = await speakWithElevenLabs(text);
        if (result !== true && playbackIdRef.current === playbackId && result) {
          setVoiceError(result);
        }
        finishPlayback(playbackId, updateCooldown);
      })();
    },
    [finishPlayback, speakWithElevenLabs, supported],
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
      const unseenEvents = nextEvents.filter(
        (candidate) => !seenKeysRef.current.has(candidate.key),
      );
      if (!unseenEvents.length) {
        syncQueueLength();
        processQueue();
        return;
      }

      const hasInterruptingEvent = unseenEvents.some(
        (event) => event.priority === 3 && event.bypassCooldown,
      );
      if (hasInterruptingEvent) {
        queueRef.current = [];
      }

      for (const event of unseenEvents) {
        seenKeysRef.current.add(event.key);
        latestNarrationRef.current = event.text;
        setLatestNarration(event.text);
        queueRef.current.push(event);
      }

      queueRef.current = queueRef.current
        .sort((a, b) => b.priority - a.priority)
        .slice(0, MAX_QUEUE_SIZE);
      syncQueueLength();

      if (hasInterruptingEvent && supported && speakingRef.current) {
        stopCurrentPlayback();
      }

      processQueue();
    },
    [processQueue, stopCurrentPlayback, supported, syncQueueLength],
  );

  const replayLastNarration = useCallback(() => {
    if (!supported) {
      setVoiceError(ELEVENLABS_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!latestNarrationRef.current) return;
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
    enabledRef.current = saved;
    preferenceLoadedRef.current = true;
    setEnabled(saved);
    if (isVoiceNarrationStyle(savedStyle)) {
      setStyle(savedStyle);
    }
    setVoiceChoice("elevenlabs_male_deep");
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
    if (hasLiveBackendData) {
      previousDataRef.current = data;
    }
  }, [data, hasLiveBackendData]);

  useEffect(() => {
    if (ELEVENLABS_ENABLED && !audioSupported) {
      setVoiceError(ELEVENLABS_UNAVAILABLE_MESSAGE);
    }
  }, [audioSupported]);

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
    voiceError,
    hasLiveBackendData,
    supported,
    canReplay: supported && Boolean(latestNarration),
    replayLastNarration,
  };
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
  if (hasFullAccess(userSession)) return "sniper-local-admin-token";

  if (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  ) {
    return "sniper-local-admin-token";
  }

  return "";
}
