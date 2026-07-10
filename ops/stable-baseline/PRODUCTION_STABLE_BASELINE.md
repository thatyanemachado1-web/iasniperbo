# Production Stable Baseline

Baseline fechada em: 2026-07-09 20:36 BR (America/Sao_Paulo)

Objetivo: congelar a versao que manteve coleta real, publicacao rapida, snapshot persistido no D1 e historicos preservados apos F5.

## Pastas Oficiais

- Fonte usada no deploy atualmente publicado: `C:\Users\Usuario\Documents\Codex\sniperbo_migration\stage\app`
- Repositorio oficial reconciliado: `C:\SNIPERBO\Codex\iasniperbo-lovable-publish`
- Instalacao VPS: `/opt/sniperbo-official`
- App VPS: `/opt/sniperbo-official/app`
- Coletor VPS: `/opt/sniperbo-official/collector`
- Scripts VPS: `/opt/sniperbo-official/scripts`
- Logs VPS: `/opt/sniperbo-official/logs`
- Backup anterior a reconciliacao: `C:\Users\Usuario\Documents\Codex\sniperbo_migration\backups\pre-stable-reconcile-20260709-195516`

## Git E Ponto De Restauracao

- Git: `C:\Users\Usuario\Documents\Codex\.tools\PortableGit\cmd\git.exe`
- Versao: `2.55.0.windows.2`
- Remote: `https://github.com/thatyanemachado1-web/iasniperbo.git`
- Branch: `codex/tie-radar-engine-20260702`
- Commit base remoto: `3b3837f3a34c69b8dffe9117ce87dd9aa673cadd`
- Commit estavel de codigo: `d578f3e18f4fd123fbc53b2a74784065cfa31ae5`
- Mensagem: `stable: lock production signal pipeline after performance hotfix`
- Tag de restauracao: `stable-production-signals-fast-publish-2026-07-09`

## Build Reproduzivel

- O Durable Object `DashboardLatestSnapshotDO` e exportado na origem por `exports.cloudflare.ts`.
- O Nitro detecta esse arquivo como entrypoint Cloudflare e preserva o named export em `.output/server/index.mjs`.
- `npm run build` executa o build e `scripts/verify-cloudflare-build.mjs` automaticamente.
- A verificacao falha se perder o export, o binding D1, o binding Durable Object ou as rotas oficiais.
- O dry-run do Wrangler reconheceu `DashboardLatestSnapshotDO`, `DASHBOARD_RESULTS_DB` e as rotas oficiais.
- `.output` e artefato gerado e nunca deve ser editado manualmente.

Comando de verificacao:

```powershell
npm ci --no-audit --no-fund
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public --dry-run --outdir .wrangler-dry-run --config wrangler.jsonc
```

## Worker E Persistencia

- Worker: `sniper-bo-ia`
- Versao publicada e mantida: `0ae25c3f-65b7-4a12-a509-fae4355530ad`
- Nao houve novo deploy neste fechamento: a versao ativa ja continha o comportamento equivalente e estava validada.
- Rotas: `sniperbo.com/*` e `www.sniperbo.com/*`
- D1: `sniperbo-dashboard-results`
- UUID D1: `12452654-13f8-4b28-8c82-29c77fdfdfb5`
- Binding: `DASHBOARD_RESULTS_DB`
- Durable Object binding: `DASHBOARD_LATEST_SNAPSHOT_DO`
- Snapshot: tabela `dashboard_latest_snapshot`, chave `official`
- Resultados diarios: `dashboard_persistent_results`
- Estatistica mensal de empates: `dashboard_monthly_tie_stats`
- Snapshot D1 final: round `2086`, `updated_at=2026-07-09T23:35:57.790Z`, payload `220643` bytes.

## VPS

Servicos oficiais ativos:

- `sniperbo-prod-api.service`
- `sniperbo-prod-collector.service`
- `sniperbo-prod-bridge.service`
- `sniperbo-prod-publisher.service`

Portas:

- `127.0.0.1:8787`: API local de sinais
- `127.0.0.1:8791`: API admin do coletor

Endpoint do publisher: `https://sniperbo.com/dashboard/publish`

Fluxo: coletor 77super -> API local -> bridge -> publisher -> Worker `sniper-bo-ia` -> D1 -> dashboard web/mobile -> Telegram como espelho do payload publicado.

## Validacao De 15 Minutos

- Janela: `2026-07-09T23:16:53.056Z` a `2026-07-09T23:31:53.056Z`.
- Browser autenticado: `378` GETs `/dashboard`, todos HTTP `200`, `0` erros de corpo.
- Rounds vistos no browser: `2058` ate `2081`; latencia maxima de headers `1090.2ms`.
- Cada payload conferido continha `30` rounds, historicos diarios `100/100/100` e estatistica mensal de empates.
- VPS na mesma janela: `399` respostas HTTP `200`, `0` status `401/403/429`, `0` `Read timed out`.
- Publicacoes: `332` dashboards, `27` urgentes e `40` sinais diretos; maior upload observado `1567ms`.
- Telegram: `24` logs de espelhamento direto do payload publicado.
- Ultima rodada do coletor dentro da janela: `B11 x P9`, Banker, `2026-07-09T23:31:35.349Z`.
- F5: round `2081` antes; rounds `2082/2083` depois; historicos `100/100/100` e empates mensais preservados.
- O status mostrou `Fonte atrasada` durante a recuperacao do F5 e voltou para `Tudo ok` ao receber o snapshot seguinte.
- A leitura final apos F5 continha GREEN, RED e EMPATE e o dashboard continuou atualizando sem intervencao.

Observacao: `Published official dashboard: rounds=0 signal=None side=None` e um log legado do cliente publisher. O hotfix passou a responder ACK curto sem devolver o dashboard inteiro, e esse log ainda tenta ler os campos removidos da resposta. Nao representa payload vazio: o timing traz o round, o POST retorna 200, o D1 avanca e o GET autenticado entrega 30 rounds.

## Regra De Rollback

Executar rollback somente com autorizacao operacional:

```powershell
git fetch --tags origin
git checkout tags/stable-production-signals-fast-publish-2026-07-09
npm ci --no-audit --no-fund
npm run build
npx wrangler deploy .output/server/index.mjs --assets .output/public --config wrangler.jsonc
```

Antes de publicar, conferir `wrangler.jsonc`, bindings, rotas, Worker de destino e executar o dry-run. Nunca restaurar ou corrigir editando `.output/server/index.mjs` manualmente.

## Extensao Salas Telegram - 2026-07-10

- Fonte do deploy: `C:\SNIPERBO\Codex\iasniperbo-lovable-publish`
- Commit de codigo implantado: `ac5262f847bc1ce539051125b5d7913d55adc4bd`
- Worker site: `sniper-bo-ia`
- Versao site: `23f66da4-fc12-4e77-8ffd-3a97159a9fad`
- Worker Telegram existente: `sniperbo-telegram-engine`
- Versao Telegram: `a5589888-af16-44df-8f5c-5a3035c9a8f8`
- Durable Object reutilizado: `TelegramEngine`, chave `channel:{userId}:{channelId}`
- Limite: tres salas por cliente
- Painel cliente: `/app/salas`
- Painel administrativo: `/app/admin/telegram`
- Modulos globais autorizaveis: Numeros Pagantes, Surf Analyzer, Padroes IA e Radar de Empate
- Validador permanece individual
- Fluxo rapido preservado: somente candidatos globais `publisher:*`, derivados do ultimo dashboard aceito, passam pelo Telegram Engine
- Dedupe preservado por cliente, sala, modulo, tipo de mensagem, sinal, round e resultado
- Build e `test:telegram-v2` aprovados
- Sete rounds conferidos visualmente: `2433` a `2439`; o painel avancou ate `2442`
- F5 preservou historicos do Surf, Padroes IA e Radar mensal; `/dashboard` respondeu HTTP 200
- Teste da sala existente persistiu corretamente o erro externo `Bad Request: need administrator rights in the channel chat`; o bot precisa ser administrador do canal para o teste real concluir

O deploy do site deve sempre incluir `--assets .output/public`. Publicar apenas o entrypoint do Worker deixa os bundles fora da versao e causa respostas 404 em `/assets/*`.

## Escopo Preservado

Neste fechamento nao foram alterados motor, coletor, regras de entrada, assertividade, Telegram Engine, clientes, login, planos, pagamentos, layout, secrets, tokens ou dados D1. O commit congela o estado de producao que ja estava no worktree e adiciona apenas a correcao de build na origem, verificacao automatica e documentacao operacional.
