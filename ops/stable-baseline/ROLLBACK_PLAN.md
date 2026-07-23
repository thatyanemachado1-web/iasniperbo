# Rollback Plan

## 1. Voltar Worker Do Site

```bash
wrangler rollback 1237aa3c-37a7-4647-a447-0b76f6d25435 --yes
```

Validar:

```bash
wrangler deployments list --name sniper-bo-ia
```

## 2. Voltar Worker Telegram

Versao registrada:

```text
be9b373b-dbbd-4982-8e25-3c506fa5121c
```

Comando:

```bash
cd cloudflare/telegram-engine
wrangler rollback be9b373b-dbbd-4982-8e25-3c506fa5121c --yes
```

## 3. Conferir D1

```bash
wrangler d1 execute sniperbo-dashboard-results --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Esperado:

- `dashboard_latest_snapshot`
- `dashboard_monthly_tie_stats`
- `dashboard_persistent_results`

## 4. Religar Servicos Da VPS

```bash
sudo systemctl restart sniperbo-prod-api sniperbo-prod-collector sniperbo-prod-bridge sniperbo-prod-publisher
sudo systemctl is-active sniperbo-prod-api sniperbo-prod-collector sniperbo-prod-bridge sniperbo-prod-publisher
```

## 5. Validar Publisher POST 200

```bash
tail -n 80 /opt/sniperbo-official/logs/official_dashboard_publisher.log
```

Esperado:

```text
status_code=200
Published official dashboard
```

## 6. Validar GET /dashboard 200

Usar token oficial sem expor valor:

```bash
curl -sS -H "Authorization: Bearer $SNIPER_ADMIN_TOKEN" https://sniperbo.com/dashboard
```

Esperado:

- HTTP 200
- `rounds` com dados reais
- `updatedAt` recente
- `mockMode=false`

## 7. Validar Sinais No Site

Abrir:

```text
https://sniperbo.com/app
```

Validar:

- API online
- coletor online
- mesa conectada
- fonte recente
- cards recebendo dados

## 8. Validar Telegram

```bash
curl -sS https://sniperbo-telegram-engine.sniperboia.workers.dev/health
```

Depois verificar logs/ultimos envios via endpoint autenticado, sem expor `ENGINE_API_SECRET`.

## 9. Validar F5 Sem Zerar

No dashboard:

1. abrir `ENTRADAS / RESULTADOS`
2. conferir linhas do dia
3. pressionar F5
4. confirmar que as linhas continuam
5. abrir em outro navegador/celular e confirmar mesmo historico

## 10. Confirmar Configuracao Certa

Checklist final:

- Worker site em `1237aa3c-37a7-4647-a447-0b76f6d25435`
- Telegram Worker em `be9b373b-dbbd-4982-8e25-3c506fa5121c`
- VPS com 4 servicos `active`
- Publisher com `status_code=200`
- `/dashboard` com `updatedAt` recente
- Historico diario limitado a 100 por modulo
- Radar de Empate mensal por `monthKey`
