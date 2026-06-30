# Publisher oficial no Windows (Sniper Bo IA)

O **publisher** é o processo que mantém o dashboard de produção atualizado. Sem ele, o monitor Telegram V2 não detecta cartões confirmados e **nenhum sinal live chega ao grupo**.

Fluxo:

```
Publisher (Windows) → POST /dashboard/publish → Worker sniper-bo-ia
  → monitor V2 → Telegram Engine → grupo Telegram
```

## Pré-requisitos

1. **Python 3.10+** com `requests` (ou use o `.venv` do projeto)
2. **Node.js** se for rodar frontend/signals-api localmente
3. Arquivo de credenciais com tokens de produção

## Configuração rápida

Crie `scripts/official_publisher.local.env` na raiz do projeto (não commitar):

```env
SNIPER_ADMIN_EMAIL=seu@email.com
SNIPER_ADMIN_PASSWORD=sua_senha
SNIPER_ADMIN_TOKEN=token_admin_longo

# Token que o publisher usa para publicar no dashboard remoto
SNIPER_REMOTE_DASHBOARD_TOKEN=mesmo_valor_de_SNIPER_DASHBOARD_TOKEN_no_Worker
SNIPER_PUBLISHER_TOKEN=opcional_se_diferente

# URL local da signals-api (fonte dos dados)
SNIPER_LOCAL_DASHBOARD_URL=http://127.0.0.1:8787/dashboard
SIGNALS_API_PORT=8787
FRONTEND_PORT=5175
PUBLISHER_INTERVAL=0.7
PYTHON_EXE=python.exe
```

Os tokens `SNIPER_DASHBOARD_TOKEN` / `SNIPER_PUBLISHER_TOKEN` devem coincidir com os secrets configurados no Worker Cloudflare `sniper-bo-ia`.

## Iniciar só o publisher

Na raiz do repositório, no PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start_official_publisher.ps1
```

O script:

- Mata publishers duplicados
- Lê `scripts/official_publisher.local.env` (e fallback para `.env`)
- Sobe `official_dashboard_publisher.py` em background
- Grava log em `official_dashboard_publisher.log`

Para modo silencioso:

```powershell
powershell -File scripts/start_official_publisher.ps1 -Quiet
```

## Watchdog completo (recomendado)

Mantém frontend Vite, signals-api, legacy collector bridge e publisher:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watch_sniperbo_official.ps1
```

Opções úteis:

```powershell
# Checar uma vez e sair
powershell -File scripts/watch_sniperbo_official.ps1 -Once

# Intervalo do watchdog (segundos, default 15)
powershell -File scripts/watch_sniperbo_official.ps1 -IntervalSeconds 20
```

Logs do watchdog: `logs/sniperbo_official_watchdog.log`

## Verificar se está funcionando

### 1. Log local

```powershell
Get-Content official_dashboard_publisher.log -Tail 30
```

Procure linhas com `publish ok` ou POST bem-sucedido em `https://sniperbo.com/dashboard/publish`.

### 2. Script de diagnóstico (qualquer OS)

```bash
SNIPER_DASHBOARD_TOKEN=seu_token \
SNIPER_ENGINE_BRIDGE=seu_bridge \
SNIPER_TEST_USER=seu@email.com \
node scripts/telegram-live-diagnostic.mjs
```

O dashboard deve ter `updatedAt` com menos de **2 minutos**.

### 3. Smoke test Telegram V2

```bash
SNIPER_DASHBOARD_TOKEN=seu_token node scripts/telegram-v2-prod-smoke.mjs
```

## Problemas comuns

| Sintoma | Causa provável | Ação |
|--------|----------------|------|
| Dashboard `updatedAt` antigo (>2 min) | Publisher parado | Rodar `start_official_publisher.ps1` |
| HTTP 401 no publish | Token errado | Alinhar `SNIPER_REMOTE_DASHBOARD_TOKEN` com secret do Worker |
| Motores ON no site mas OFF no Engine | UI Lovable desatualizada | Publicar `main` no Lovable; toggles devem persistir no Engine |
| Diagnóstico OK mas sem sinais | Nenhum cartão confirmado no dashboard | Normal entre entradas; aguardar sinal live |
| `signals api down` no watchdog | Porta 8787 ocupada | `npm run signals:start` ou reiniciar watchdog |

## NPM scripts relacionados

```bash
npm run signals:start      # sobe signals-api (Windows PowerShell)
npm run watchdog:start     # watchdog completo (Windows PowerShell)
```

## Segurança

- Nunca commite `official_publisher.local.env` nem `.env` com tokens reais
- Rotacione tokens se expostos acidentalmente
- O publisher precisa rodar em máquina confiável (seu PC ou VPS Windows)
