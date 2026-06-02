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

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const LOVABLE_MODEL = "google/gemini-3-flash-preview";

export const generateAIReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as AIReadingSnapshot)
  .handler(async ({ data }) => {
    const userPrompt = `Snapshot atual da mesa (JSON):
${JSON.stringify(data, null, 2)}

Gere AGORA a narracao curta, humana e natural seguindo todas as regras do system.`;

    const geminiText = await runGeminiReading(userPrompt);
    if (geminiText) {
      return { text: geminiText, ok: true as const };
    }

    const lovableText = await runLovableReading(userPrompt);
    if (lovableText) {
      return { text: lovableText, ok: true as const };
    }

    return { text: buildLocalReading(data), ok: false as const };
  });

async function runGeminiReading(userPrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return "";

  const model = resolveGeminiModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 160,
        },
      }),
    });

    if (!res.ok) {
      console.warn(`Falha no Gemini (${res.status}).`);
      return "";
    }

    const json = (await res.json()) as GeminiResponse;
    return readGeminiText(json);
  } catch (err) {
    console.warn(`Erro ao consultar Gemini: ${(err as Error).message}`);
    return "";
  }
}

async function runLovableReading(userPrompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY?.trim();
  if (!apiKey) return "";

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: LOVABLE_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`Falha na leitura IA Lovable (${res.status}).`);
        return "";
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      return text;
    } catch (err) {
      console.warn(`Erro ao consultar IA Lovable: ${(err as Error).message}`);
      return "";
    }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function readGeminiText(json: GeminiResponse) {
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function resolveGeminiModel() {
  const model = (process.env.GEMINI_MODEL_ID || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  if (!model || model === "gemini-3.5-flash") {
    return DEFAULT_GEMINI_MODEL;
  }
  return model;
}

function buildLocalReading(data: AIReadingSnapshot) {
  const name = data.allowUseName && data.userFirstName ? `${data.userFirstName}, ` : "";
  const side = normalizeSide(data.signalSide);
  const status = String(data.signalStatus || "").toLowerCase();
  const hasEntry = side && side !== "TIE" && ["pending", "g1", "active"].includes(status);
  const tieActive = String(data.tieStatus || "").toLowerCase().includes("ativo") ||
    String(data.tieStatus || "").toLowerCase().includes("active");
  const surfSide = normalizeSide(data.surfSide || "");
  const surfAgainst = Boolean(hasEntry && surfSide && surfSide !== side);
  const surfAligned = Boolean(hasEntry && surfSide && surfSide === side);
  const hasPagante = data.paganteNumero !== null && data.paganteNumero !== undefined;
  const paganteText = hasPagante
    ? `numero pagante ${data.paganteNumero}${data.paganteOrigem ? ` em ${normalizeSide(data.paganteOrigem) || data.paganteOrigem}` : ""}`
    : "";

  if (String(data.engineState || "").toUpperCase().includes("BLOQUE")) {
    return `${name}essa eu seguraria. A engine bloqueou por risco, entao melhor observar mais uma rodada e manter gestao.`;
  }

  if (side === "TIE" && ["pending", "g1", "active"].includes(status)) {
    return `${name}Tie entrou na janela. Ele merece atencao, mas continua sendo leitura de risco e pede mao baixa.`;
  }

  if (hasEntry) {
    if (surfAgainst && hasPagante) {
      return `${name}entrada principal em ${side}, mas tem conflito: surf contra e ${paganteText}. Se for entrar, vai com mao baixa.`;
    }
    if (surfAgainst) {
      return `${name}entrada principal em ${side}, so que o surf esta contra. Eu trataria como mao leve e cuidado na protecao.`;
    }
    if (surfAligned && hasPagante) {
      return `${name}agora ficou mais limpa: entrada em ${side}, surf alinhado e ${paganteText}. Ainda assim, entra com gestao.`;
    }
    if (hasPagante) {
      return `${name}entrada principal em ${side}. Tambem tem ${paganteText} no radar, entao acompanha essa leitura sem forcar a mao.`;
    }
    return `${name}entrada principal em ${side}${data.signalProtection ? ` com protecao ${data.signalProtection}` : ""}. Leitura valida, mas sem exagerar na mao.`;
  }

  if (tieActive) {
    return `${name}Tie esta pressionando, mas sem entrada principal limpa agora. Melhor observar e esperar alinhamento.`;
  }

  if (hasPagante) {
    return `${name}${paganteText} apareceu na leitura. Ainda nao tem entrada principal limpa, entao acompanha sem antecipar.`;
  }

  if (surfSide) {
    return `${name}surf esta puxando para ${surfSide}, mas a entrada principal ainda nao confirmou. Melhor aguardar mais uma rodada.`;
  }

  return `${name}sem entrada boa por enquanto. Mesa em observacao, melhor esperar a proxima confirmacao.`;
}

function normalizeSide(value: string) {
  const text = String(value || "").trim().toUpperCase();
  if (text.includes("BANKER") || text.includes("BANCA")) return "BANKER";
  if (text.includes("PLAYER")) return "PLAYER";
  if (text.includes("TIE") || text.includes("EMPATE")) return "TIE";
  return "";
}
