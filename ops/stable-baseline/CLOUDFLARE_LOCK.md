# Cloudflare Lock

## Worker Site

- Nome: `sniper-bo-ia`
- Versao estavel ativa: `1237aa3c-37a7-4647-a447-0b76f6d25435`
- Rollback aplicado em: `2026-07-09T06:32:31.492116Z`
- Rotas:
  - `sniperbo.com/*`
  - `www.sniperbo.com/*`

Comando de conferencia:

```bash
wrangler deployments list --name sniper-bo-ia
```

## Worker Telegram

- Nome: `sniperbo-telegram-engine`
- Versao registrada ativa: `be9b373b-dbbd-4982-8e25-3c506fa5121c`
- Worker dev URL: `https://sniperbo-telegram-engine.sniperboia.workers.dev`
- Durable Object binding: `TELEGRAM_ENGINE`

Comando de conferencia:

```bash
wrangler deployments list --name sniperbo-telegram-engine
```

## D1

- Banco: `sniperbo-dashboard-results`
- UUID: `12452654-13f8-4b28-8c82-29c77fdfdfb5`
- Tabelas:
  - `_cf_KV`
  - `dashboard_latest_snapshot`
  - `dashboard_monthly_tie_stats`
  - `dashboard_persistent_results`

Comando de conferencia:

```bash
wrangler d1 execute sniperbo-dashboard-results --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

## Regra

Nao publicar novo Worker sem validar primeiro:

1. build local
2. revisar diff
3. confirmar que nao mexeu motor/coletor/publisher/Telegram
4. se publicar e travar fonte, rollback imediato para `1237aa3c-37a7-4647-a447-0b76f6d25435`
