# Telegram Templates Flow

## Fonte de verdade

As configuracoes de cada sala e modulo ficam no Durable Object `TelegramEngine`,
na chave `channel:{userId}:{channelId}`, dentro de `signalModules`.

O espelho persistente existente continua em `templates_json.signalModules`. Nao
foi criado Worker, banco ou tabela paralela.

## Tipos controlados

Cada modulo pode habilitar ou desabilitar separadamente:

- entrada
- protecao G1
- green SG
- green G1
- red
- empate como protecao
- empate confirmado
- empate 4x, 6x, 10x, 25x e 88x

Os textos de entrada, G1, green SG, green G1, red, empate, empate 25x e empate
88x sao armazenados no mesmo contrato do modulo. A leitura ocorre no Telegram
Engine imediatamente antes do envio.

## Botao por template

Cada template possui `buttonEnabled`, `buttonText` e `buttonUrl`. O Engine aceita
apenas URL iniciada por `https://`. Quando habilitado, o bot envia um inline
keyboard; quando desabilitado, a mensagem e enviada sem botao.

## Ciclo G1

`g1MessageBehavior` aceita:

- `keep`: mantem a mensagem G1.
- `delete_on_final`: envia o resultado final e apaga a mensagem G1.
- `edit_to_final`: edita a mensagem G1 para o resultado final.

O `telegram_message_id` do G1 fica temporariamente no Durable Object, vinculado
ao cliente, sala, modulo e raiz do sinal. Falha de permissao para editar ou
apagar nao interrompe o resultado final; o Engine salva `lastError`.

## Fluxos oficiais

Os modulos globais continuam no publisher oficial:

`publisher -> /engine/signal -> TelegramEngine -> Telegram Bot API`

O Validador continua com sua deteccao individual. Para salas Cloudflare, somente
a entrega foi encaixada no mesmo `/engine/signal`, para respeitar templates,
filtros, botoes e comportamento G1. A deteccao e a assertividade nao mudaram.

## Validacao e rollback

Validacao local:

```text
npm run test:telegram-v2
python scripts/official_dashboard_publisher_telegram.test.py
npm run build
```

Rollback deve restaurar juntos o Worker `sniperbo-telegram-engine`, o Worker
`sniper-bo-ia` e o script do publisher da VPS para as versoes registradas no
baseline anterior. Nunca editar `.output` manualmente.
