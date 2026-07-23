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
  paganteDirecao?: string | null;
  paganteAlert?: string | null;
  paganteAssertiveness?: number | null;
  lastRounds: string;
  assertiveness: number;
  sequencePositive?: number;
  sequenceNegative?: number;
  /** Primeiro nome do usuário logado. Vazio = sem nome. */
  userFirstName?: string;
  /** Se true, a IA pode, mas não precisa, chamar o usuário pelo primeiro nome nesta fala. */
  allowUseName?: boolean;
};

const SYSTEM_PROMPT = `Você é um copiloto humano que acompanha uma mesa de Bac Bo ao vivo junto com o operador.
Seu papel: LER os dados reais do painel e narrar de forma natural, descolada porém responsável, como um amigo experiente sentado do lado.

ESTILO DA FALA (obrigatório):
- Humano, natural, conversacional. NUNCA pareça um robô lendo métricas.
- Frases curtas, no máximo 2 a 3 frases por resposta, até ~55 palavras.
- VARIE as frases. Não repita as mesmas aberturas ("Atenção", "Leitura", "Sinal confirmado") em respostas seguidas.
- Pode usar expressões leves: "olha", "boa", "calma nessa", "essa eu seguraria", "tá bonito agora", "mão baixa", "tá dividida".
- Português do Brasil com acentos corretos. Sem emoji. Sem markdown. Sem listas.

REGRAS DURAS (nunca quebrar):
- NUNCA prometa ganho. NUNCA diga "vai dar", "garantido", "certeza", "entra forte que ganha".
- NUNCA mande dobrar mão, recuperar prejuízo ou aumentar aposta após red.
- Se houver risco (surf contra, tie pressionando, conflito com pagante), sempre lembrar gestão / mão baixa.
- Use SOMENTE os dados reais do snapshot. Não invente número, porcentagem, lado ou motivo.
- Não cite métricas internas cruas (confidence X%, risk Y) a menos que ajude o operador.

O QUE NARRAR (baseado no snapshot):
- engineState BLOQUEADO => deixe claro que está bloqueado por risco, sem forçar.
- signalStatus "pending" ou "g1" com signalSide BANKER ou PLAYER => entrada principal confirmada. Diga lado + proteção (se houver).
- signalSide TIE com status pending/g1 => janela de Tie, atenção, mas sem substituir Banker/Player.
- Fale de número pagante somente quando paganteNumero existir nos dados reais enviados pelo backend.
- Se entrada principal alinhar com paganteNumero e paganteDirecao => pode falar: "hum, essa entrada tá interessando nesse número pagante, viu. Vamos nele: pode entrar no Banker/Player, protege empate."
- Se entrada principal existe MAS surf contra ou pagante conflitando => avisar com cautela, sugerir mão baixa.
- tieStatus ativo sem entrada principal => "Tie pressionando, atenção".
- Sem entrada (waiting, sem signalSide útil) => orientar a observar mais uma ou duas rodadas.

PERSONALIZAÇÃO COM NOME:
- Se userFirstName vier vazio, NUNCA invente nome, NUNCA escreva "[nome]". Fale sem nome, normal.
- Se userFirstName vier preenchido E allowUseName for true, você PODE usar o primeiro nome UMA vez na fala, de forma natural ("Boa, Gabriel.", "Gabriel, essa eu seguraria.").
- Se allowUseName for false, NÃO use o nome do usuário nesta fala.
- Nunca use o nome duas vezes na mesma resposta. Nunca use sobrenome.

EXEMPLOS de tom (apenas referência, NÃO copiar literal):
- "Essa eu seguraria um pouco. A principal até tentou formar, mas ainda não alinhou."
- "Se for nessa, vai com mão baixa. Tem sinal, mas o risco ainda tá no radar."
- "Olha o surf aqui, tá pressionando contra. Mão baixa."
- "Agora ficou mais bonito: principal alinhou com número pagante e surf. Leitura mais limpa."
- "Sem entrada boa por enquanto. Melhor observar mais uma ou duas rodadas."
- "Tie pressionando. Não substitui Banker ou Player, mas merece atenção."

Saída: apenas o texto da narração, sem prefixos, sem aspas.`;

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";

export const generateAIReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as AIReadingSnapshot)
  .handler(async ({ data }) => {
    const userPrompt = `Snapshot atual da mesa (JSON):
${JSON.stringify(data, null, 2)}

Gere AGORA a narração curta, humana e natural seguindo todas as regras do sistema.`;

    const ollamaText = await runOllamaReading(userPrompt);
    if (ollamaText) {
      return { text: cleanAiText(ollamaText), ok: true as const };
    }

    return { text: buildLocalReading(data), ok: false as const };
  });

async function runOllamaReading(userPrompt: string) {
  if (readEnvBoolean("AI_LOCAL_ENABLED", true) === false) return "";

  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).trim().replace(/\/+$/, "");
  const model = (process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL).trim() || DEFAULT_OLLAMA_MODEL;
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
        options: {
          temperature: 0.72,
          num_predict: 150,
        },
      }),
    });

    if (!res.ok) {
      console.warn(`Falha no Ollama (${res.status}).`);
      return "";
    }

    const json = (await res.json()) as { response?: string };
    return String(json.response || "").trim();
  } catch (err) {
    console.warn(`Erro ao consultar Ollama: ${(err as Error).message}`);
    return "";
  }
}

function cleanAiText(value: string) {
  return beautifyPortugueseText(value)
    .replace(/entrada garantida/gi, "entrada confirmada")
    .replace(/\bgarantid[ao]s?\b/gi, "confirmado")
    .replace(/\bcerteza\b/gi, "leitura")
    .replace(/lucro certo/gi, "gestão")
    .trim();
}

function readEnvBoolean(name: string, fallback: boolean) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(value)) return true;
  if (["0", "false", "no", "off", "nao", "não"].includes(value)) return false;
  return fallback;
}

function buildLocalReading(data: AIReadingSnapshot) {
  const name = data.allowUseName && data.userFirstName ? `${data.userFirstName}, ` : "";
  const side = normalizeSide(data.signalSide);
  const status = String(data.signalStatus || "").toLowerCase();
  const hasEntry = side && side !== "TIE" && ["pending", "g1", "active"].includes(status);
  const tieActive =
    String(data.tieStatus || "").toLowerCase().includes("ativo") ||
    String(data.tieStatus || "").toLowerCase().includes("active");
  const surfSide = normalizeSide(data.surfSide || "");
  const surfAgainst = Boolean(hasEntry && surfSide && surfSide !== side);
  const surfAligned = Boolean(hasEntry && surfSide && surfSide === side);
  const paganteSide = normalizeSide(data.paganteDirecao || data.paganteOrigem || "");
  const hasPagante = data.paganteNumero !== null && data.paganteNumero !== undefined;
  const paganteText = hasPagante
    ? `número pagante ${data.paganteNumero}${paganteSide ? ` puxando ${sideLabel(paganteSide)}` : ""}`
    : "";

  if (String(data.engineState || "").toUpperCase().includes("BLOQUE")) {
    return `${name}essa eu seguraria. A engine bloqueou por risco, então melhor observar mais uma rodada e manter gestão.`;
  }

  if (side === "TIE" && ["pending", "g1", "active"].includes(status)) {
    return `${name}Tie entrou na janela. Ele merece atenção, mas continua sendo leitura de risco e pede mão baixa.`;
  }

  if (hasEntry) {
    if (surfAgainst && hasPagante) {
      return `${name}tem ${paganteText}, mas o surf está contra. Se for nessa, vai com mão baixa e protege empate.`;
    }
    if (hasPagante && paganteSide === side) {
      return `${name}hum, essa entrada tá interessando nesse número pagante ${data.paganteNumero}, viu. Vamos nele: pode entrar no ${sideLabel(side)}, protege empate${data.signalProtection ? ` até ${data.signalProtection}` : ""}.`;
    }
    if (hasPagante && paganteSide && paganteSide !== side) {
      return `${name}tem ${paganteText}, mas ele não está alinhado com a entrada em ${sideLabel(side)}. Eu seguraria e esperaria outra confirmação.`;
    }
    if (surfAgainst) {
      return `${name}entrada principal em ${side}, só que o surf está contra. Eu trataria como mão leve e cuidado na proteção.`;
    }
    if (surfAligned && hasPagante) {
      return `${name}agora ficou mais limpa: entrada em ${side}, surf alinhado e ${paganteText}. Ainda assim, entra com gestão.`;
    }
    if (hasPagante) {
      return `${name}entrada principal em ${side}. Também tem ${paganteText} no radar, então acompanha essa leitura sem forçar a mão.`;
    }
    return `${name}entrada principal em ${side}${
      data.signalProtection ? ` com proteção ${data.signalProtection}` : ""
    }. Leitura válida, mas sem exagerar na mão.`;
  }

  if (tieActive) {
    return `${name}Tie está pressionando, mas sem entrada principal limpa agora. Melhor observar e esperar alinhamento.`;
  }

  if (hasPagante) {
    return `${name}hum, ${paganteText} apareceu na leitura. Ainda não tem entrada principal limpa, então espera confirmação antes de ir.`;
  }

  if (surfSide) {
    return `${name}surf está puxando para ${surfSide}, mas a entrada principal ainda não confirmou. Melhor aguardar mais uma rodada.`;
  }

  return `${name}sem entrada boa por enquanto. Mesa em observação, melhor esperar a próxima confirmação.`;
}

function normalizeSide(value: string) {
  const text = String(value || "").trim().toUpperCase();
  if (text.includes("BANKER") || text.includes("BANCA")) return "BANKER";
  if (text.includes("PLAYER")) return "PLAYER";
  if (text.includes("TIE") || text.includes("EMPATE")) return "TIE";
  return "";
}

function sideLabel(value: string) {
  const side = normalizeSide(value);
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "mesa";
}

function beautifyPortugueseText(value: string) {
  let mojibakeFixed = value;
  for (const [search, replacement] of [
    ["n????o", "não"],
    ["N????o", "Não"],
    ["aten????????o", "atenção"],
    ["Aten????????o", "Atenção"],
    ["pain????is", "painéis"],
    ["indispon????vel", "indisponível"],
  ] as const) {
    mojibakeFixed = replaceLiteralText(mojibakeFixed, search, replacement);
  }

  return [
    ["voce", "você"],
    ["nao", "não"],
    ["atencao", "atenção"],
    ["observacao", "observação"],
    ["narracao", "narração"],
    ["analise", "análise"],
    ["numero", "número"],
    ["padrao", "padrão"],
    ["gestao", "gestão"],
    ["confianca", "confiança"],
    ["direcao", "direção"],
    ["protecao", "proteção"],
    ["confirmacao", "confirmação"],
    ["proxima", "próxima"],
    ["forcar", "forçar"],
    ["modulos", "módulos"],
    ["metricas", "métricas"],
    ["estatisticas", "estatísticas"],
    ["usuario", "usuário"],
    ["usuarios", "usuários"],
    ["responsavel", "responsável"],
    ["prejuizo", "prejuízo"],
    ["apos", "após"],
    ["ate", "até"],
    ["esta", "está"],
    ["ta", "tá"],
    ["so", "só"],
    ["mao", "mão"],
    ["tambem", "também"],
    ["valida", "válida"],
    ["possivel", "possível"],
    ["saida", "saída"],
  ].reduce((text, [plain, accented]) => replaceWord(text, plain, accented), mojibakeFixed);
}

function replaceLiteralText(value: string, search: string, replacement: string) {
  return search ? value.split(search).join(replacement) : value;
}

function replaceWord(text: string, plain: string, accented: string) {
  return text.replace(new RegExp(`\\b${plain}\\b`, "gi"), (match) =>
    match[0] === match[0]?.toUpperCase()
      ? `${accented[0]?.toUpperCase() ?? ""}${accented.slice(1)}`
      : accented,
  );
}
