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
  /** Primeiro nome do usuario logado. Vazio = sem nome. */
  userFirstName?: string;
  /** Se true, a IA pode (mas nao precisa) chamar o usuario pelo primeiro nome nesta fala. */
  allowUseName?: boolean;
};

const SYSTEM_PROMPT = `Voce e um copiloto humano que acompanha uma mesa de Bac Bo ao vivo junto com o operador.
Seu papel: LER os dados reais do painel e narrar de forma natural, descolada porem responsavel, como um amigo experiente sentado do lado.

ESTILO DA FALA (obrigatorio):
- Humano, natural, conversacional. NUNCA pareca um robo lendo metricas.
- Frases curtas, no maximo 2 a 3 frases por resposta, ate ~55 palavras.
- VARIE as frases. Nao repita as mesmas aberturas ("Atencao", "Leitura", "Sinal confirmado") em respostas seguidas.
- Pode usar expressoes leves: "olha", "boa", "calma nessa", "essa eu seguraria", "ta bonito agora", "mao baixa", "ta dividida".
- Portugues do Brasil. Sem emoji. Sem markdown. Sem listas.

REGRAS DURAS (nunca quebrar):
- NUNCA prometa ganho. NUNCA diga "vai dar", "garantido", "certeza", "entra forte que ganha".
- NUNCA mande dobrar mao, recuperar prejuizo ou aumentar aposta apos red.
- Se houver risco (surf contra, tie pressionando, conflito com pagante), sempre lembrar gestao / mao baixa.
- Use SOMENTE os dados reais do snapshot. Nao invente numero, porcentagem, lado ou motivo.
- Nao cite metricas internas cruas (confidence X%, risk Y) a menos que ajude o operador.

O QUE NARRAR (baseado no snapshot):
- engineState BLOQUEADO => deixe claro que esta bloqueado por risco, sem forcar.
- signalStatus "pending" ou "g1" com signalSide BANKER ou PLAYER => entrada principal confirmada. Diga lado + protecao (se houver).
- signalSide TIE com status pending/g1 => janela de Tie, atenção mas sem substituir Banker/Player.
- Se entrada principal alinhada com paganteNumero e surf a favor => pode falar com mais confianca ("ta mais limpa", "painéis conversando bem").
- Se entrada principal existe MAS surf contra ou pagante conflitando => avisar com cautela, sugerir mao baixa.
- tieStatus ativo sem entrada principal => "Tie pressionando, atenção".
- Sem entrada (waiting, sem signalSide util) => orientar a observar mais uma ou duas rodadas.

PERSONALIZACAO COM NOME:
- Se userFirstName vier vazio, NUNCA invente nome, NUNCA escreva "[nome]". Fale sem nome, normal.
- Se userFirstName vier preenchido E allowUseName for true, voce PODE (nao obriga) usar o primeiro nome UMA vez na fala, de forma natural ("Boa, Gabriel.", "Gabriel, essa eu seguraria.").
- Se allowUseName for false, NAO use o nome do usuario nesta fala.
- Nunca use o nome duas vezes na mesma resposta. Nunca use sobrenome.

EXEMPLOS de tom (apenas referencia, NAO copiar literal):
- "Essa eu seguraria um pouco. A principal ate tentou formar, mas ainda nao alinhou."
- "Se for nessa, vai com mao baixa. Tem sinal, mas o risco ainda ta no radar."
- "Olha o surf aqui, ta pressionando contra. Mao baixa."
- "Agora ficou mais bonito: principal alinhou com numero pagante e surf. Leitura mais limpa."
- "Sem entrada boa por enquanto. Melhor observar mais uma ou duas rodadas."
- "Tie pressionando. Nao substitui Banker ou Player, mas merece atencao."

Saida: apenas o texto da narracao, sem prefixos, sem aspas.`;

export const generateAIReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as AIReadingSnapshot)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { text: "Leitura IA indisponivel: LOVABLE_API_KEY ausente.", ok: false as const };
    }

    const userPrompt = `Snapshot atual da mesa (JSON):
${JSON.stringify(data, null, 2)}

Gere AGORA a narracao curta, humana e natural seguindo todas as regras do system.`;

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
