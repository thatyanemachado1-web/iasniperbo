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
  /** Primeiro nome do usu??rio logado. Vazio = sem nome. */
  userFirstName?: string;
  /** Se true, a IA pode, mas n??o precisa, chamar o usu??rio pelo primeiro nome nesta fala. */
  allowUseName?: boolean;
};

const SYSTEM_PROMPT = `Voc?? ?? um copiloto humano que acompanha uma mesa de Bac Bo ao vivo junto com o operador.
Seu papel: LER os dados reais do painel e narrar de forma natural, descolada por??m respons??vel, como um amigo experiente sentado do lado.

ESTILO DA FALA (obrigat??rio):
- Humano, natural, conversacional. NUNCA pare??a um rob?? lendo m??tricas.
- Frases curtas, no m??ximo 2 a 3 frases por resposta, at?? ~55 palavras.
- VARIE as frases. N??o repita as mesmas aberturas ("Aten????o", "Leitura", "Sinal confirmado") em respostas seguidas.
- Pode usar express??es leves: "olha", "boa", "calma nessa", "essa eu seguraria", "t?? bonito agora", "m??o baixa", "t?? dividida".
- Portugu??s do Brasil com acentos corretos. Sem emoji. Sem markdown. Sem listas.

REGRAS DURAS (nunca quebrar):
- NUNCA prometa ganho. NUNCA diga "vai dar", "garantido", "certeza", "entra forte que ganha".
- NUNCA mande dobrar m??o, recuperar preju??zo ou aumentar aposta ap??s red.
- Se houver risco (surf contra, tie pressionando, conflito com pagante), sempre lembrar gest??o / m??o baixa.
- Use SOMENTE os dados reais do snapshot. N??o invente n??mero, porcentagem, lado ou motivo.
- N??o cite m??tricas internas cruas (confidence X%, risk Y) a menos que ajude o operador.

O QUE NARRAR (baseado no snapshot):
- engineState BLOQUEADO => deixe claro que est?? bloqueado por risco, sem for??ar.
- signalStatus "pending" ou "g1" com signalSide BANKER ou PLAYER => entrada principal confirmada. Diga lado + prote????o (se houver).
- signalSide TIE com status pending/g1 => janela de Tie, aten????o, mas sem substituir Banker/Player.
- Fale de n??mero pagante somente quando paganteNumero existir nos dados reais enviados pelo backend.
- Se entrada principal alinhar com paganteNumero e paganteDirecao => pode falar: "hum, essa entrada t?? interessando nesse n??mero pagante, viu. Vamos nele: pode entrar no Banker/Player, protege empate."
- Se entrada principal existe MAS surf contra ou pagante conflitando => avisar com cautela, sugerir m??o baixa.
- tieStatus ativo sem entrada principal => "Tie pressionando, aten????o".
- Sem entrada (waiting, sem signalSide ??til) => orientar a observar mais uma ou duas rodadas.

PERSONALIZA????O COM NOME:
- Se userFirstName vier vazio, NUNCA invente nome, NUNCA escreva "[nome]". Fale sem nome, normal.
- Se userFirstName vier preenchido E allowUseName for true, voc?? PODE usar o primeiro nome UMA vez na fala, de forma natural ("Boa, Gabriel.", "Gabriel, essa eu seguraria.").
- Se allowUseName for false, N??O use o nome do usu??rio nesta fala.
- Nunca use o nome duas vezes na mesma resposta. Nunca use sobrenome.

EXEMPLOS de tom (apenas refer??ncia, N??O copiar literal):
- "Essa eu seguraria um pouco. A principal at?? tentou formar, mas ainda n??o alinhou."
- "Se for nessa, vai com m??o baixa. Tem sinal, mas o risco ainda t?? no radar."
- "Olha o surf aqui, t?? pressionando contra. M??o baixa."
- "Agora ficou mais bonito: principal alinhou com n??mero pagante e surf. Leitura mais limpa."
- "Sem entrada boa por enquanto. Melhor observar mais uma ou duas rodadas."
- "Tie pressionando. N??o substitui Banker ou Player, mas merece aten????o."

Sa??da: apenas o texto da narra????o, sem prefixos, sem aspas.`;

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";

export const generateAIReading = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as AIReadingSnapshot)
  .handler(async ({ data }) => {
    const userPrompt = `Snapshot atual da mesa (JSON):
${JSON.stringify(data, null, 2)}

Gere AGORA a narra????o curta, humana e natural seguindo todas as regras do sistema.`;

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
    .replace(/lucro certo/gi, "gest??o")
    .trim();
}

function readEnvBoolean(name: string, fallback: boolean) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  if (["1", "true", "yes", "on", "sim"].includes(value)) return true;
  if (["0", "false", "no", "off", "nao", "n??o"].includes(value)) return false;
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
    ? `n??mero pagante ${data.paganteNumero}${paganteSide ? ` puxando ${sideLabel(paganteSide)}` : ""}`
    : "";

  if (String(data.engineState || "").toUpperCase().includes("BLOQUE")) {
    return `${name}essa eu seguraria. A engine bloqueou por risco, ent??o melhor observar mais uma rodada e manter gest??o.`;
  }

  if (side === "TIE" && ["pending", "g1", "active"].includes(status)) {
    return `${name}Tie entrou na janela. Ele merece aten????o, mas continua sendo leitura de risco e pede m??o baixa.`;
  }

  if (hasEntry) {
    if (surfAgainst && hasPagante) {
      return `${name}tem ${paganteText}, mas o surf est?? contra. Se for nessa, vai com m??o baixa e protege empate.`;
    }
    if (hasPagante && paganteSide === side) {
      return `${name}hum, essa entrada t?? interessando nesse n??mero pagante ${data.paganteNumero}, viu. Vamos nele: pode entrar no ${sideLabel(side)}, protege empate${data.signalProtection ? ` at?? ${data.signalProtection}` : ""}.`;
    }
    if (hasPagante && paganteSide && paganteSide !== side) {
      return `${name}tem ${paganteText}, mas ele n??o est?? alinhado com a entrada em ${sideLabel(side)}. Eu seguraria e esperaria outra confirma????o.`;
    }
    if (surfAgainst) {
      return `${name}entrada principal em ${side}, s?? que o surf est?? contra. Eu trataria como m??o leve e cuidado na prote????o.`;
    }
    if (surfAligned && hasPagante) {
      return `${name}agora ficou mais limpa: entrada em ${side}, surf alinhado e ${paganteText}. Ainda assim, entra com gest??o.`;
    }
    if (hasPagante) {
      return `${name}entrada principal em ${side}. Tamb??m tem ${paganteText} no radar, ent??o acompanha essa leitura sem for??ar a m??o.`;
    }
    return `${name}entrada principal em ${side}${
      data.signalProtection ? ` com prote????o ${data.signalProtection}` : ""
    }. Leitura v??lida, mas sem exagerar na m??o.`;
  }

  if (tieActive) {
    return `${name}Tie est?? pressionando, mas sem entrada principal limpa agora. Melhor observar e esperar alinhamento.`;
  }

  if (hasPagante) {
    return `${name}hum, ${paganteText} apareceu na leitura. Ainda n??o tem entrada principal limpa, ent??o espera confirma????o antes de ir.`;
  }

  if (surfSide) {
    return `${name}surf est?? puxando para ${surfSide}, mas a entrada principal ainda n??o confirmou. Melhor aguardar mais uma rodada.`;
  }

  return `${name}sem entrada boa por enquanto. Mesa em observa????o, melhor esperar a pr??xima confirma????o.`;
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
    ["n????o", "n??o"],
    ["N????o", "N??o"],
    ["aten????????o", "aten????o"],
    ["Aten????????o", "Aten????o"],
    ["pain????is", "pain??is"],
    ["indispon????vel", "indispon??vel"],
  ] as const) {
    mojibakeFixed = replaceLiteralText(mojibakeFixed, search, replacement);
  }

  return [
    ["voce", "voc??"],
    ["nao", "n??o"],
    ["atencao", "aten????o"],
    ["observacao", "observa????o"],
    ["narracao", "narra????o"],
    ["analise", "an??lise"],
    ["numero", "n??mero"],
    ["padrao", "padr??o"],
    ["gestao", "gest??o"],
    ["confianca", "confian??a"],
    ["direcao", "dire????o"],
    ["protecao", "prote????o"],
    ["confirmacao", "confirma????o"],
    ["proxima", "pr??xima"],
    ["forcar", "for??ar"],
    ["modulos", "m??dulos"],
    ["metricas", "m??tricas"],
    ["estatisticas", "estat??sticas"],
    ["usuario", "usu??rio"],
    ["usuarios", "usu??rios"],
    ["responsavel", "respons??vel"],
    ["prejuizo", "preju??zo"],
    ["apos", "ap??s"],
    ["ate", "at??"],
    ["esta", "est??"],
    ["ta", "t??"],
    ["so", "s??"],
    ["mao", "m??o"],
    ["tambem", "tamb??m"],
    ["valida", "v??lida"],
    ["possivel", "poss??vel"],
    ["saida", "sa??da"],
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
