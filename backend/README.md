# Sniper BO IA FastAPI Hubla

Backend FastAPI isolado para receber webhooks da Hubla, controlar assinatura, gerar senha temporaria e liberar acesso via JWT.

## Rodar local

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

## Webhook Hubla

Configure na Hubla:

- URL: `https://sniperbo.com/api/webhooks/hubla`
- Header enviado pela Hubla: `x-hubla-token`
- Secret local: `HUBLA_WEBHOOK_TOKEN`

O endpoint aceita `paid`, `refunded`, `chargeback` e `canceled`.

Tambem existe o alias antigo `POST /api/webhook/hubla` para compatibilidade.

## Planos Hubla

Configure os IDs dos produtos:

- `HUBLA_MENSAL_PRODUCT_IDS`
- `HUBLA_TRIMESTRAL_PRODUCT_IDS`
- `HUBLA_ANUAL_PRODUCT_IDS`

Se o ID nao bater, o sistema tenta identificar pelo nome do produto: Mensal, Trimestral ou Anual.

## Email automatico

Configure SMTP:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Quando o pagamento aprovado chegar, o usuario recebe:

- Email de acesso
- Senha temporaria somente se for cadastro novo ou se a conta ainda nao tiver senha
- Link de login

Se o comprador ja tinha cadastro no modo demo, a senha cadastrada e preservada. A compra apenas atualiza plano, validade e libera o dashboard.

## Rotas principais

- `POST /api/webhooks/hubla`
- `POST /api/auth/login`
- `GET /api/me/subscription`
- `GET /api/payments/history`
- `GET /api/analyses/live`

As rotas `/api/me/subscription`, `/api/payments/history` e `/api/analyses/live` exigem `Authorization: Bearer <jwt>`.
