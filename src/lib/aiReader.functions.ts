import { createServerFn } from "@tanstack/react-start";

export type AIReadingSnapshot = {
  engineState: string;
  engineReason?: string;
  signalSide: string;
  signalStatus: string;
  signalStrength: number;
  signalProtection?: string;
  tieStatus: string;
  tieLevel?: string;
  tieConfidence?: number;
  surfPhase?: string;
  surfSide?: string;
  surfRisk?: number;
  surfConfidence?: number;
  paganteNumero?: number | null;
  paganteOrigem?: string | null;
  paganteAlert?: string | null;
  lastRounds: string;
  assertiveness: number;
  sequencePositive?: number;
  sequenceNegative?: number;
};

const SYSTEM_PROMPT = `Voce e um analista de Bac Bo que apenas LE a mesa em tempo real para o operador.

Regras obrigatorias:
- Use SEMPRE os dados reais do snapshot recebido. Nao invente nada.
- Nao prometa ganho, nao garanta resultado, nao diga "vai dar".
- Nao mande apostar valor X, nao sugira gestao financeira.
- Texto em portugues do Brasil, neutro, tecnico, curto: 2 a 3 frases, no maximo 60 palavras.
- Quando houver entrada principal confirmada (signalStatus pending ou g1 com side BANKER ou PLAYER), descreva claramente lado + protecao.
- Quando NAO houver entrada, diga "mesa em observacao" e explique brevemente o motivo (engine aguardando, surf sem direcao, tie ativo, pagante so vigilancia, etc).
- Se engineState for BLOQUEADO, deixe claro que esta bloqueado por risco.
- Nao cite numeros internos como confidence/risco em porcentagem a menos que ajude. Foque no que o operador precisa fazer agora: ENTRAR, AGUARDAR ou BLOQUEADO.`;

export const generateAIReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as AIReadingSnapshot)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { text: "Leitura IA indisponivel: LOVABLE_API_KEY ausente.", ok: false as const };
    }

    const userPrompt = `Snapshot da mesa (JSON):\n${JSON.stringify(data, null, 2)}\n\nGere a leitura curta agora.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (status === 429) {
          return { text: "Limite de requisicoes atingido. Tente novamente em instantes.", ok: false as const };
        }
        if (status === 402) {
          return { text: "Creditos da IA esgotados. Adicione creditos para continuar.", ok: false as const };
        }
        const body = await res.text().catch(() => "");
        return { text: `Falha na leitura IA (${status}). ${body.slice(0, 120)}`, ok: false as const };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { text: "Sem resposta da IA neste ciclo.", ok: false as const };
      return { text, ok: true as const };
    } catch (err) {
      return { text: `Erro ao consultar IA: ${(err as Error).message}`, ok: false as const };
    }
  });
