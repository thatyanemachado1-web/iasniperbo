# SniperBo Telegram Engine on Cloudflare

Worker independente para guardar canais Telegram por cliente e disparar sinais sem depender do notebook, Chrome, Lovable runtime ou site aberto.

## O que ele faz

- Salva canais por `userId` em Durable Object.
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
- Lista ultimos envios em `GET /validator/notifications`.

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
