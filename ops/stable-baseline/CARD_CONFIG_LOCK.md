# Card Config Lock

Config congelada em 2026-07-09.

## Configuracao Global Do Dashboard

- Polling frontend: `DEFAULT_POLLING_MS = 1500`
- Backoff em erro: `ERROR_BACKOFF_POLLING_MS = 2000`
- Requests simultaneos: `MAX_IN_FLIGHT_REQUESTS = 1`
- Stream/SSE: `STREAM_ENABLED = false`
- Tempo de exibicao de resultado rapido: `DASHBOARD_REALTIME_RESULT_VISIBLE_MS = 900`
- Janela de entrada atrasada bloqueada: `LATE_ENTRY_BLOCK_SECONDS = 1.0`
- Maximo diario por modulo no payload publico: `MAX_DAILY_RESULTS_PER_MODULE = 100`
- Busca persistida diaria: `limit=500`, depois corta para 100 por modulo

## Leitura Neural / Numero Pagante

- Module key: `LEITURA_NEURAL_NUMERO_PAGANTE`
- Campos principais:
  - `neuralReading`
  - `neuralEntryState`
  - `neuralEntryLastResult`
  - `neuralScoreboard`
  - `dailyResultsByModule.LEITURA_NEURAL_NUMERO_PAGANTE`
- Historico visual: `MAX_NEURAL_ENTRY_HISTORY = 100`
- Cabecalho de historico: contador simples `N no ciclo`
- Validade visual: G1
- Resultados aceitos: GREEN SG, GREEN G1, RED, EMPATE, EMPATE G1
- Reset: `dayKey` America/Sao_Paulo
- Persistencia: `dashboard_persistent_results`

## Surf Analyzer

- Module key: `SURF_ANALYZER`
- Campos principais:
  - `currentSurfAlert`
  - `surfAnalyzerScoreboard`
  - `dailyResultsByModule.SURF_ANALYZER`
- Cabecalho de historico: contador simples `N no ciclo`
- Resultado: GREEN SG, RED SG, EMPATE
- Reset: `dayKey` America/Sao_Paulo
- Persistencia: `dashboard_persistent_results`

## Padroes IA

- Module key: `PADROES_IA`
- Campos principais:
  - `patternMinerSnapshot`
  - `patternHotSignal`
  - `aiPatternSignal`
  - `patternIaServerCycle`
  - `dailyResultsByModule.PADROES_IA`
- Historico visual: `VISIBLE_PATTERN_IA_HISTORY = 500`
- Cabecalho de historico: contador simples `N no ciclo`
- Resultado: GREEN SG, GREEN G1, RED, EMPATE, EMPATE G1
- Reset: `dayKey` America/Sao_Paulo
- Persistencia: `dashboard_persistent_results`

## Radar De Empate

- Module key visual: Radar de Empate / `ties_only` no Telegram global
- Campos principais:
  - `currentTieAlert`
  - `tieAlertScoreboard`
  - `tieRadarHistory`
  - `monthlyTieStats`
- Historico mensal:
  - `dashboard_monthly_tie_stats`
  - `monthKey` no formato `YYYY-MM`
- Contadores:
  - 4x
  - 6x
  - 10x
  - 25x
  - 88x
- Reset: troca de `monthKey`, nao por reload e nao por login/logout.

## Regra Do Limite De Resultados

Manter 100 resultados por modulo no dia para o cliente ver o momento da mesa sem sobrecarregar mobile/web.
