# SniperBo Telegram Engine on Cloudflare

Worker independente para guardar canais Telegram por cliente e disparar sinais sem depender do notebook, Chrome, Lovable runtime ou site aberto.

URL publicada:

```text
https://sniperbo-telegram-engine.sniperboia.workers.dev
```

## O que ele faz

- Salva ate 3 salas por `userId` no Durable Object existente.
- Criptografa o Bot Token antes de persistir.
- Valida canal mandando `oi` no Telegram.
- Bloqueia canal duplicado pelo mesmo Chat ID/codigo.
- Apaga canal com tombstone para canal antigo nao voltar sozinho.
- Guarda configuracoes dos 5 modulos:
  - `ai_patterns`
  - `paying_numbers`
  - `surf_alert`
  - `ties_only`
  - `validator`
- Dispara sinais via `POST /engine/signal`.
- Liquida apenas os sinais pendentes via `POST /engine/results`, sem recriar entradas.
- Lista ultimos envios em `GET /validator/notifications`.
- Registra ultimo sucesso, ultimo erro e teste de conexao por sala.

## Secrets obrigatorios

```bash
wrangler secret put ENGINE_API_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
```

Use valores longos e aleatorios. O `ENGINE_API_SECRET` tambem e usado pelo site/publisher para autenticar chamadas na API do Worker.

## Deploy

```bash
cd cloudflare/telegram-engine
wrangler deploy
```

## Endpoints principais

- `GET /health`
- `POST /validator/channels/validate`
- `GET /validator/channels`
- `POST /validator/channels`
- `PATCH /validator/channels/:id`
- `DELETE /validator/channels/:id`
- `POST /validator/channels/test`
- `GET /validator/notifications`
- `POST /engine/signal`
- `POST /engine/results`
- `GET /engine/results/status`

O publisher deve chamar `POST /engine/results` depois de aceitar um novo snapshot oficial:

```json
{
  "source": "official_dashboard_publisher",
  "dashboard": {
    "rounds": [
      { "id": 12345, "result": "BANKER" }
    ]
  }
}
```

Essa rota processa somente notificacoes de entrada ja enviadas. Ela pode mandar
`GREEN SG`, aviso de `G1`, `GREEN G1`, `RED` ou `EMPATE`, preservando as chaves
de deduplicacao do sinal original. O monitor completo legado continua separado.

O site expoe as salas ao cliente em `/app/salas` sem revelar Bot Token. O cadastro com segredo fica restrito ao painel administrativo em `/app/admin/telegram`.

Todas as rotas, exceto `/health`, exigem:

```http
Authorization: Bearer <ENGINE_API_SECRET>
X-Validator-User-Id: cliente@email.com
```

## Exemplo de sinal

```json
{
  "moduleKey": "paying_numbers",
  "signalKey": "round-12345-paying-banker",
  "roundId": 12345,
  "entry": "BANKER",
  "message": "<b>ENTRADA CONFIRMADA</b>\n\n<b>Entrada:</b> B Banker",
  "variables": {
    "entry": "B Banker"
  }
}
```
