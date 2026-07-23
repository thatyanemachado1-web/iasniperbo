# Telegram Rooms Flow

## Fluxo Oficial

`/dashboard/publish` -> D1/dashboard aceito -> publisher oficial (`publisher:*`) -> Telegram Engine -> filtro por cliente/sala/modulo -> Telegram.

O Telegram Engine rejeita sinais globais de caminhos paralelos. O monitor do `/dashboard` permanece como fallback oficial, sem substituir o caminho rapido que ja funciona em producao.

Os modulos globais continuam site-first:

- `paying_numbers`
- `surf_alert`
- `ai_patterns`
- `ties_only`

O modulo `validator` continua individual, associado ao cliente, estrategia e sala selecionada.

## Armazenamento Reutilizado

- Worker: `sniperbo-telegram-engine`
- Durable Object: `TelegramEngine`
- Binding: `TELEGRAM_ENGINE`
- Chave de sala: `channel:{userId}:{channelId}`
- Notificacao: `notification:{userId}:{notificationId}`
- Dedupe: cliente + sala + modulo + message type + signal/round/result
- Limite: 3 salas por cliente

Nao foi criada nova tabela, banco ou Worker.

## Paineis

- Cliente: `/app/salas`
- Admin: `/app/admin/telegram`
- Validador: permanece em `/app/validador`, usando apenas o modulo individual.

O cliente nao recebe nem visualiza Bot Token. O cadastro inicial com token fica no painel administrativo autenticado e a resposta publica retorna apenas token mascarado.

O monitor oficial le o `/dashboard` e filtra os quatro modulos globais por sala: Numeros Pagantes, Surf Analyzer, Padroes IA e Radar de Empate. O Validador segue no fluxo individual.

## Catalogador 50K - Proxima Etapa

Nao implementado nesta entrega.

Quando aprovado, deve executar em processo de background separado da renderizacao, consumir snapshots persistidos em lotes e publicar apenas resultados catalogados. Nunca deve carregar ou minerar 50.000 rodadas no React, no polling do dashboard ou no caminho critico de publicacao ao vivo.
