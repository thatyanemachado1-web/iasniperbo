import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { BrainAI } from "@/components/brand/BrainAI";
import { generateAIReading, type AIReadingSnapshot } from "@/lib/aiReader.functions";
import { readAdminSession } from "@/lib/adminApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { readVoiceResponseError } from "@/lib/voiceApiError";
import type { DashboardData } from "@/types/dashboard";
import { Sparkles, RefreshCw, Volume2, VolumeX } from "lucide-react";

type Props = {
  data: DashboardData;
  mode: "mock" | "fallback" | "connecting" | "live";
};

const AI_READING_VOICE_KEY = "sniper_ai_reading_voice_enabled";
const DEFAULT_LOCAL_VOICE = "pt-BR-AntonioNeural";
const VOICE_UNAVAILABLE_MESSAGE = "Voz da leitura IA indisponível no momento.";

function firstNameOf(full?: string) {
  const cleaned = String(full || "").trim();
  if (!cleaned) return "";
  const first = cleaned.split(/\s+/)[0] ?? "";
  // Evita placeholders genericos virarem "nome" na fala.
  if (/^usuario$/i.test(first)) return "";
  return first;
}

function buildSnapshot(
  d: DashboardData,
  userFirstName: string,
  allowUseName: boolean,
): AIReadingSnapshot {
  const lastRounds = d.rounds
    .slice(-12)
    .map((r) => r.result)
    .join("");
  return {
    engineState: d.engineDecision.state,
    engineReason: d.engineDecision.reason,
    signalSide: d.currentSignal.side,
    signalStatus: d.currentSignal.status,
    signalStrength: d.currentSignal.strength,
    signalProtection: d.currentSignal.protection,
    tieStatus: d.currentTieAlert.status,
    tieLevel: d.currentTieAlert.level,
    tieConfidence: d.currentTieAlert.confidence,
    surfPhase: d.currentSurfAlert?.surf_phase,
    surfSide: d.currentSurfAlert?.surf_side,
    surfRisk: d.currentSurfAlert?.surf_risk,
    surfConfidence: d.currentSurfAlert?.surf_confidence,
    paganteNumero: d.neuralReading?.numero ?? null,
    paganteOrigem: d.neuralReading?.origem ?? null,
    paganteAlert: d.neuralReading?.paganteAlert ?? null,
    lastRounds,
    assertiveness: d.mainScoreboard.assertiveness,
    sequencePositive: d.mainScoreboard.sequencePositive,
    sequenceNegative: d.mainScoreboard.sequenceNegative,
    userFirstName,
    allowUseName,
  };
}

export function AIReadingCard({ data, mode }: Props) {
  const callReading = useServerFn(generateAIReading);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const lastSpokenKeyRef = useRef("");
  const playbackIdRef = useRef(0);

  // Nome do usuario logado (so primeiro nome). Vazio se nao houver.
  const userFirstName = useMemo(() => {
    const session = readUserSession();
    return firstNameOf(session.name) || firstNameOf(session.email.split("@")[0]);
  }, []);

  // Rotacao do nome: usar no maximo 1x a cada 3 falas.
  const callCountRef = useRef(0);
  const lastNameAtRef = useRef(-99);
  callCountRef.current += 1;
  const turnsSinceName = callCountRef.current - lastNameAtRef.current;
  const allowUseName = Boolean(userFirstName) && turnsSinceName >= 3;
  if (allowUseName) {
    // Marca este turno como "o nome pode ter sido usado". A IA decide se usa.
    lastNameAtRef.current = callCountRef.current;
  }

  const snapshot = useMemo(
    () => buildSnapshot(data, userFirstName, allowUseName),
    [data, userFirstName, allowUseName],
  );

  // Chave de cache estavel: muda sempre que o estado relevante muda
  const stateKey = `${snapshot.engineState}|${snapshot.signalSide}|${snapshot.signalStatus}|${snapshot.tieStatus}|${snapshot.surfPhase ?? "-"}|${snapshot.paganteNumero ?? "-"}|${snapshot.lastRounds}`;

  const liveReady = mode === "live" && data.mockMode === false;

  const {
    data: reading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["ai-reading", stateKey],
    queryFn: () => callReading({ data: snapshot }),
    enabled: liveReady,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });

  const disposeAudio = useCallback(() => {
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

  const stopVoice = useCallback(() => {
    playbackIdRef.current += 1;
    disposeAudio();
    setIsSpeaking(false);
  }, [disposeAudio]);

  const speakReading = useCallback(
    async (text: string) => {
      if (typeof window === "undefined") {
        setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
        return;
      }
      const audioSupported = typeof window.Audio !== "undefined" && typeof window.URL !== "undefined";
      const browserVoiceSupported =
        typeof window.speechSynthesis !== "undefined" &&
        typeof window.SpeechSynthesisUtterance !== "undefined";
      if (!audioSupported && !browserVoiceSupported) {
        setVoiceError(VOICE_UNAVAILABLE_MESSAGE);
        return;
      }

      const playbackId = playbackIdRef.current + 1;
      playbackIdRef.current = playbackId;
      disposeAudio();
      setIsSpeaking(true);
      setVoiceError("");

      try {
        const token = readVoiceAuthToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
          headers["x-sniper-token"] = token;
        }

        const response = await fetch(readVoiceApiUrl(), {
          method: "POST",
          headers,
          body: JSON.stringify({
            text,
            provider: "edge-tts",
            voice: DEFAULT_LOCAL_VOICE,
            language: "pt-BR",
            volume: 0.9,
            rate: 1,
            pitch: 0.95,
          }),
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) {
          const fallback = await speakWithBrowserVoice(text);
          if (fallback === true) return;
          throw new Error(await readVoiceResponseError(response, VOICE_UNAVAILABLE_MESSAGE));
        }
        if (contentType.includes("application/json")) {
          const payload = (await response.json().catch(() => ({}))) as { reason?: string; error?: string };
          const fallback = await speakWithBrowserVoice(text);
          if (fallback === true) return;
          throw new Error(payload.error || payload.reason || VOICE_UNAVAILABLE_MESSAGE);
        }
        const blob = await response.blob();
        if (!blob.size) {
          const fallback = await speakWithBrowserVoice(text);
          if (fallback === true) return;
          throw new Error(VOICE_UNAVAILABLE_MESSAGE);
        }

        const audioUrl = window.URL.createObjectURL(blob);
        audioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error(VOICE_UNAVAILABLE_MESSAGE));
          audio.play().catch(reject);
        });
      } catch (error) {
        if (playbackIdRef.current === playbackId) {
          const fallback = await speakWithBrowserVoice(text);
          setVoiceError(fallback === true ? "" : (error as Error)?.message || VOICE_UNAVAILABLE_MESSAGE);
        }
      } finally {
        if (playbackIdRef.current === playbackId) {
          disposeAudio();
          setIsSpeaking(false);
        }
      }
    },
    [disposeAudio],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVoiceEnabled(window.localStorage.getItem(AI_READING_VOICE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AI_READING_VOICE_KEY, voiceEnabled ? "true" : "false");
    if (!voiceEnabled) stopVoice();
  }, [stopVoice, voiceEnabled]);

  useEffect(() => {
    const text = reading?.text?.trim();
    if (!voiceEnabled || !liveReady || !text || lastSpokenKeyRef.current === stateKey) return;
    lastSpokenKeyRef.current = stateKey;
    void speakReading(text);
  }, [liveReady, reading?.text, speakReading, stateKey, voiceEnabled]);

  useEffect(() => stopVoice, [stopVoice]);

  return (
    <GlassCard className="relative space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BrainAI size={28} speaking={isFetching} />
          <div>
            <div className="text-sm font-bold">Leitura IA das entradas</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Copiloto ao vivo
            </div>
          </div>
        </div>
        <AppBadge tone={liveReady ? "green" : "amber"} pulse={isFetching}>
          {isSpeaking ? "Falando" : liveReady ? (isFetching ? "Analisando" : "Ao vivo") : "Standby"}
        </AppBadge>
      </div>

      <div className="min-h-[4.5rem] rounded-xl border border-neon-purple/20 bg-background/30 px-3 py-2.5 text-sm leading-relaxed text-foreground">
        {liveReady
          ? (reading?.text ?? "Aguardando primeira leitura da IA...")
          : "A leitura automatica inicia quando os dados ao vivo estiverem conectados."}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mr-1 inline size-3 text-neon-purple" />
          Atualiza a cada ~20s ou quando a mesa muda de estado. Não prometer ganho.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => {
              const nextEnabled = !voiceEnabled;
              setVoiceEnabled(nextEnabled);
              if (!nextEnabled) stopVoice();
            }}
            disabled={!liveReady}
            className="inline-flex items-center gap-1 rounded-lg border border-neon-purple/30 px-2 py-1 text-[11px] font-bold text-neon-purple transition hover:bg-neon-purple/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {voiceEnabled ? <Volume2 className="size-3" /> : <VolumeX className="size-3" />}
            {isSpeaking ? "Falando" : voiceEnabled ? "Voz ON" : "Voz OFF"}
          </button>
          <button
            type="button"
            onClick={() => {
              const text = reading?.text?.trim();
              if (text) void speakReading(text);
            }}
            disabled={!liveReady || !reading?.text || isSpeaking}
            className="inline-flex items-center gap-1 rounded-lg border border-neon-cyan/30 px-2 py-1 text-[11px] font-bold text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Volume2 className="size-3" />
            Ouvir
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!liveReady || isFetching}
            className="inline-flex items-center gap-1 rounded-lg border border-neon-cyan/30 px-2 py-1 text-[11px] font-bold text-neon-cyan transition hover:bg-neon-cyan/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>
      {voiceError && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {voiceError}
        </div>
      )}
    </GlassCard>
  );
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

async function speakWithBrowserVoice(text: string) {
  if (
    typeof window === "undefined" ||
    typeof window.speechSynthesis === "undefined" ||
    typeof window.SpeechSynthesisUtterance === "undefined"
  ) {
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.volume = 0.9;
    utterance.rate = 1;
    utterance.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find((voice) => voice.name === DEFAULT_LOCAL_VOICE) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("pt-br")) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("pt")) ??
      null;

    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => resolve();
      utterance.onerror = () => reject(new Error(VOICE_UNAVAILABLE_MESSAGE));
      window.speechSynthesis.speak(utterance);
    });
    return true;
  } catch {
    return false;
  }
}
