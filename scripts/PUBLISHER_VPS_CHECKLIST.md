# Checklist — Publisher 24/7 na VPS (Windows)

Guia para manter o **publisher oficial** sempre ligado na VPS, alimentando `https://sniperbo.com/dashboard/publish` com dados live.

Sem isso, o dashboard de produção para de atualizar e **nenhum sinal oficial live chega** aos clientes Premium/VIP.

Fluxo na VPS:

```
Scraper/coletor → signals-api (:8787) → publisher → sniperbo.com/dashboard/publish
                                                      ↓
                                            Telegram V2 → grupos dos clientes
```

Documentos relacionados:

- [PUBLISHER_WINDOWS.md](./PUBLISHER_WINDOWS.md) — configuração e comandos
- [ONBOARDING_TELEGRAM.md](./ONBOARDING_TELEGRAM.md) — onboarding de clientes

---

## 1. Setup inicial (fazer uma vez)

### VPS e software

- [ ] VPS **Windows** com IP fixo e acesso RDP
- [ ] Repositório clonado (ex: `C:\sniperbo\iasniperbo`)
- [ ] **Python 3.10+** instalado (`python --version`)
- [ ] **Node.js 22+** instalado (`node --version`)
- [ ] Dependências instaladas:
  ```powershell
  cd C:\sniperbo\iasniperbo
  npm ci
  pip install requests truststore
  ```
- [ ] Firewall da VPS permite **saída HTTPS** (443) para `sniperbo.com` e Cloudflare

### Credenciais (não commitar)

- [ ] Arquivo `scripts/official_publisher.local.env` criado com:
  - `SNIPER_ADMIN_EMAIL`
  - `SNIPER_ADMIN_PASSWORD`
  - `SNIPER_ADMIN_TOKEN`
  - `SNIPER_REMOTE_DASHBOARD_TOKEN` (= secret `SNIPER_DASHBOARD_TOKEN` no Worker)
  - `SNIPER_LOCAL_DASHBOARD_URL=http://127.0.0.1:8787/dashboard`
  - `SIGNALS_API_PORT=8787`
  - `PUBLISHER_INTERVAL=0.7`
- [ ] Tokens conferidos no Cloudflare Worker `sniper-bo-ia`

### Teste manual antes de automatizar

- [ ] Subir stack completa uma vez:
  ```powershell
  cd C:\sniperbo\iasniperbo
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watch_sniperbo_official.ps1 -Once
  ```
- [ ] Log do publisher sem erro:
  ```powershell
  Get-Content official_dashboard_publisher.log -Tail 30
  ```
- [ ] Signals-api respondendo:
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8787/health
  ```
  → `status: online`, `service: signals-api`
- [ ] Dashboard remoto fresco (`updatedAt` < 2 min):
  ```bash
  SNIPER_DASHBOARD_TOKEN=seu_token npm run diag:telegram
  ```

---

## 2. Watchdog 24/7 (recomendado)

O watchdog mantém **scraper + signals-api + publisher** vivos e reinicia se cair.

- [ ] Escolher intervalo (default 15s):
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watch_sniperbo_official.ps1 -IntervalSeconds 15
  ```
- [ ] Confirmar log do watchdog:
  ```powershell
  Get-Content logs\sniperbo_official_watchdog.log -Tail 20
  ```
  Procure linhas como `publisher ok`, `signals api ok`
- [ ] **Não** rodar publisher manual duplicado enquanto o watchdog estiver ativo

---

## 3. Iniciar automaticamente ao ligar a VPS

### Opção A — Agendador de Tarefas (nativo Windows)

- [ ] Abrir **Agendador de Tarefas** → Criar tarefa
- [ ] Nome: `SniperBo Official Watchdog`
- [ ] Gatilho: **Ao iniciar o computador**
- [ ] Ação: Iniciar programa
  - Programa: `powershell.exe`
  - Argumentos:
    ```
    -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\sniperbo\iasniperbo\scripts\watch_sniperbo_official.ps1" -IntervalSeconds 15
    ```
  - Iniciar em: `C:\sniperbo\iasniperbo`
- [ ] Marcar: **Executar estiver o usuário conectado ou não**
- [ ] Marcar: **Executar com privilégios mais altos** (se necessário para portas)
- [ ] Configurações: **Reiniciar a tarefa a cada 1 minuto** se falhar (até 3 vezes)
- [ ] Reiniciar a VPS e confirmar que o watchdog subiu sozinho

### Opção B — NSSM (serviço Windows)

Use se quiser um **serviço** em vez de tarefa agendada.

- [ ] Baixar [NSSM](https://nssm.cc/download) na VPS
- [ ] Instalar serviço:
  ```powershell
  nssm install SniperBoWatchdog "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
  nssm set SniperBoWatchdog AppParameters "-NoProfile -ExecutionPolicy Bypass -File `"C:\sniperbo\iasniperbo\scripts\watch_sniperbo_official.ps1`" -IntervalSeconds 15"
  nssm set SniperBoWatchdog AppDirectory "C:\sniperbo\iasniperbo"
  nssm set SniperBoWatchdog Start SERVICE_AUTO_START
  nssm set SniperBoWatchdog AppStdout "C:\sniperbo\iasniperbo\logs\watchdog-service.log"
  nssm set SniperBoWatchdog AppStderr "C:\sniperbo\iasniperbo\logs\watchdog-service.err.log"
  nssm start SniperBoWatchdog
  ```
- [ ] Confirmar no **services.msc**: status `Running`

---

## 4. Monitoramento diário (2 minutos)

### Check rápido na VPS

- [ ] Processos ativos:
  ```powershell
  Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -like "*official_dashboard_publisher.py*" -or
    $_.CommandLine -like "*watch_sniperbo_official.ps1*"
  } | Select-Object ProcessId, Name
  ```
- [ ] Log do publisher recente (< 5 min):
  ```powershell
  (Get-Item official_dashboard_publisher.log).LastWriteTime
  Get-Content official_dashboard_publisher.log -Tail 10
  ```
- [ ] Health local:
  ```powershell
  Invoke-RestMethod http://127.0.0.1:8787/health
  ```

### Check remoto (de qualquer máquina)

- [ ] Diagnóstico:
  ```bash
  SNIPER_DASHBOARD_TOKEN=seu_token npm run diag:telegram
  ```
  → `[x] Publisher atualizando dashboard (< 2 min)`

---

## 5. Alertas se parar (opcional mas recomendado)

### Alerta simples — script na VPS (Task Scheduler a cada 5 min)

Crie `scripts/check_publisher_health.ps1` localmente na VPS (não precisa estar no repo):

```powershell
$Log = "C:\sniperbo\iasniperbo\official_dashboard_publisher.log"
$MaxAgeSeconds = 180
$WebhookUrl = "SEU_WEBHOOK_TELEGRAM_OU_DISCORD"

if (-not (Test-Path $Log)) { $msg = "Publisher log missing"; goto alert }
$age = ((Get-Date) - (Get-Item $Log).LastWriteTime).TotalSeconds
if ($age -gt $MaxAgeSeconds) {
  $msg = "Publisher stale: log age ${age}s (max ${MaxAgeSeconds}s)"
  goto alert
}
try {
  $h = Invoke-RestMethod http://127.0.0.1:8787/health -TimeoutSec 3
  if ($h.status -ne "online") { $msg = "signals-api not online"; goto alert }
} catch {
  $msg = "signals-api unreachable: $($_.Exception.Message)"
  goto alert
}
exit 0

:alert
# Exemplo: POST para webhook (Telegram/Discord/Slack)
if ($WebhookUrl) {
  Invoke-RestMethod -Uri $WebhookUrl -Method POST -Body (@{ text = "[SNIPERBO VPS] $msg" } | ConvertTo-Json) -ContentType "application/json"
}
Write-EventLog -LogName Application -Source "SniperBo" -EventId 5001 -EntryType Warning -Message $msg -ErrorAction SilentlyContinue
exit 1
```

- [ ] Agendar `check_publisher_health.ps1` a cada **5 minutos**
- [ ] Testar alerta parando o publisher manualmente e confirmando notificação

### Alerta externo (UptimeRobot / Better Stack)

- [ ] Criar monitor HTTP em `https://sniperbo.com/dashboard` com header `Authorization: Bearer SEU_TOKEN`
- [ ] Alerta se resposta falhar **ou** JSON `updatedAt` older than 3 min (check manual/script)

---

## 6. Recuperação quando cair

| Sintoma | Ação |
|---------|------|
| Log parado há > 3 min | Reiniciar watchdog: `nssm restart SniperBoWatchdog` ou matar processos e rodar `watch_sniperbo_official.ps1` |
| `signals api down` no watchdog log | `npm run signals:start` ou reiniciar watchdog |
| HTTP 401 no publisher log | Corrigir `SNIPER_REMOTE_DASHBOARD_TOKEN` no `.env` local |
| Porta 8787 ocupada | `scripts/sniper_port_guard.ps1` ou reiniciar VPS |
| VPS reiniciou | Confirmar tarefa agendada / serviço NSSM subiu sozinho |
| Sinais voltaram mas dashboard velho | Publisher parado — prioridade máxima |

Comando de recuperação rápida:

```powershell
cd C:\sniperbo\iasniperbo
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/watch_sniperbo_official.ps1 -Once
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start_official_publisher.ps1
```

---

## 7. Manutenção semanal

- [ ] Conferir espaço em disco (`logs/`, `official_dashboard_publisher.log`)
- [ ] `git pull origin main` na VPS se houver update de scripts
- [ ] Rodar `npm run diag:telegram` e confirmar tudo verde
- [ ] Verificar se a VPS recebeu updates do Windows (reboot agendado → watchdog sobe sozinho?)
- [ ] Rotacionar tokens se houve exposição

---

## 8. O que **não** precisa ficar na VPS

| Item | Onde roda |
|------|-----------|
| Site `sniperbo.com` (UI) | Lovable / Hostinger |
| Worker + Telegram Engine | Cloudflare |
| Bot/grupo de cada cliente | Telegram do cliente |
| Publisher + scraper + signals-api | **VPS (ou PC servidor)** ← este checklist |

---

## Mensagem pronta (equipe)

> **Publisher VPS — check diário**
>
> 1. Log `official_dashboard_publisher.log` atualizado nos últimos 2 min?
> 2. `http://127.0.0.1:8787/health` → online?
> 3. `npm run diag:telegram` → dashboard < 2 min?
>
> Se algum falhar: reiniciar watchdog ou serviço NSSM `SniperBoWatchdog`.
