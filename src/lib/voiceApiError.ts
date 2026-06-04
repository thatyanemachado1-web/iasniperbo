const VOICE_CONFIG_ERROR =
  "Voz local sem configuração no backend. Configure EDGE_TTS_URL ou use Web Speech API no navegador.";

export async function readVoiceResponseError(response: Response, fallback: string) {
  const detail = await readResponseErrorDetail(response);

  if (/ELEVENLABS_(API_KEY|TTS_API_KEY|VOICE_ID)/i.test(detail)) {
    return "Voz ElevenLabs sem configuracao no backend. Configure ELEVENLABS_TTS_API_KEY e ELEVENLABS_VOICE_ID.";
  }

  if (/nao autorizado|sessao|não autorizado|sessão/i.test(detail)) {
    return "Voz indisponível: sessão sem autorização para o backend.";
  }

  if (response.status === 429) {
    return "Voz em espera: muitas solicitações em pouco tempo.";
  }

  return detail || fallback;
}

async function readResponseErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response
      .clone()
      .json()
      .catch(() => null);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      return String((payload as { error?: unknown }).error || "").trim();
    }
  }

  return response
    .clone()
    .text()
    .then((text) => text.trim())
    .catch(() => "");
}
