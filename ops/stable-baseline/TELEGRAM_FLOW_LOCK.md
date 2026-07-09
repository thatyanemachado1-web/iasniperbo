# Telegram Flow Lock

## Workers

- Site: `sniper-bo-ia`
- Telegram: `sniperbo-telegram-engine`
- Telegram Engine URL: `https://sniperbo-telegram-engine.sniperboia.workers.dev`

## Modulos Globais Espelhados Do Site

Lidos em `src/lib/telegramAutoV2.ts`:

- `ai_patterns`
- `paying_numbers`
- `surf_alert`
- `ties_only`

O validador usa fluxo separado por cliente/estrategia.

## Endpoints Telegram Engine

- `GET /health`
- `POST /validator/channels/validate`
- `GET /validator/channels`
- `POST /validator/channels`
- `PATCH /validator/channels/:id`
- `DELETE /validator/channels/:id`
- `POST /validator/channels/test`
- `GET /validator/notifications`
- `POST /engine/signal`

## Variaveis / Secrets

Registrar somente nomes:

- `ENGINE_API_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `TELEGRAM_ENGINE_SECRET`
- `CLOUDFLARE_TELEGRAM_ENGINE_SECRET`
- `SNIPER_ENGINE_BRIDGE`
- `SNIPER_PUBLISHER_TOKEN`
- `SNIPER_DASHBOARD_TOKEN`
- `SNIPER_ADMIN_TOKEN`
- `SNIPER_DASHBOARD_URL`

## Dedupe

O Telegram Engine reserva chaves no Durable Object:

- `sent:{userId}:{channelId}:{moduleKey}:{signalKey}`
- chaves de entrada/resultado/recentes derivadas do sinal
- monitor usa chaves `dashboard-monitor:*`

TTL/lock observado:

- monitor lock: 15000 ms
- dedupe do validador no site: `VALIDATOR_TELEGRAM_DEDUPE_RESERVATION_TTL_MS = 30000`

## Tipos De Mensagem

Representados no fluxo como eventos de entrada e resultado:

- ENTRY
- G1_ACTIVE
- RESULT_GREEN_SG
- RESULT_GREEN_G1
- RESULT_TIE
- RESULT_RED

Nao alterar Telegram nesta baseline.
