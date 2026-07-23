# VPS Services Lock

## Instalacao

- Root: `/opt/sniperbo-official`
- App: `/opt/sniperbo-official/app`
- Coletor: `/opt/sniperbo-official/collector`
- Scripts: `/opt/sniperbo-official/scripts`
- Logs: `/opt/sniperbo-official/logs`
- Profile 77super: `/opt/sniperbo-official/browser_profile_77super`

## Servicos Systemd Oficiais

- `sniperbo-prod-api`
- `sniperbo-prod-collector`
- `sniperbo-prod-bridge`
- `sniperbo-prod-publisher`

Status esperado:

```bash
systemctl is-active sniperbo-prod-api sniperbo-prod-collector sniperbo-prod-bridge sniperbo-prod-publisher
```

Todos devem responder `active`.

## Portas

- `127.0.0.1:8787`: API local dashboard/signals
- `127.0.0.1:8791`: coletor Python

## Health

```bash
curl -sS http://127.0.0.1:8787/health
```

Esperado:

```text
status=online service=signals-api port=8787
```

## Logs Bons

Publisher:

```text
Published official dashboard: rounds=30 signal=... side=...
status_code=200
```

Coletor:

```text
[NEW ROUND]
```

## Arquivos De Ambiente

Nao salvar valores, apenas nomes esperados:

- `SNIPER_ADMIN_EMAIL`
- `SNIPER_ADMIN_PASSWORD`
- `SNIPER_ADMIN_TOKEN`
- `SNIPER_PUBLISHER_TOKEN`
- `SNIPER_DASHBOARD_TOKEN`
- `SNIPER_LOCAL_DASHBOARD_URL`
- `SNIPER_REMOTE_DASHBOARD_URL`
- `SNIPER_REMOTE_DASHBOARD_TOKEN`
- `TELEGRAM_ENGINE_URL`
- `TELEGRAM_ENGINE_SECRET`
