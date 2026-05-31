import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { BrainAI } from "@/components/brand/BrainAI";
import { generateAIReading, type AIReadingSnapshot } from "@/lib/aiReader.functions";
import { readUserSession } from "@/lib/userSession";
import type { DashboardData } from "@/types/dashboard";
import { Sparkles, RefreshCw } from "lucide-react";

type Props = {
  data: DashboardData;
  mode: "mock" | "fallback" | "connecting" | "live";
};

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
  const lastRounds = d.rounds.slice(-12).map((r) => r.result).join("");
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

  const { data: reading, isFetching, refetch } = useQuery({
    queryKey: ["ai-reading", stateKey],
    queryFn: () => callReading({ data: snapshot }),
    enabled: liveReady,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: false,
  });

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
          {liveReady ? (isFetching ? "Analisando" : "Ao vivo") : "Standby"}
        </AppBadge>
      </div>

      <div className="min-h-[4.5rem] rounded-xl border border-neon-purple/20 bg-background/30 px-3 py-2.5 text-sm leading-relaxed text-foreground">
        {liveReady
          ? reading?.text ?? "Aguardando primeira leitura da IA..."
          : "A leitura automatica inicia quando os dados ao vivo estiverem conectados."}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mr-1 inline size-3 text-neon-purple" />
          Atualiza a cada ~20s ou quando a mesa muda de estado. Nao prometer ganho.
        </p>
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
    </GlassCard>
  );
}
