# Checklist — Onboarding Telegram (cliente Premium/VIP)

Guia operacional para ativar a sala de sinais de novos clientes no Sniper Bo IA.

## Para você (operador)

- [ ] Cliente com plano **Premium ou VIP ativo** (não expirado)
- [ ] **Publisher rodando** no Windows:
  ```powershell
  powershell -File scripts/start_official_publisher.ps1
  ```
  ou watchdog completo:
  ```powershell
  powershell -File scripts/watch_sniperbo_official.ps1
  ```
- [ ] Log do publisher atualizando (`official_dashboard_publisher.log`)
- [ ] Diagnóstico OK (opcional):
  ```bash
  SNIPER_DASHBOARD_TOKEN=seu_token \
  SNIPER_ENGINE_BRIDGE=seu_bridge \
  SNIPER_TEST_USER=email@cliente.com \
  npm run diag:telegram
  ```
  → `updatedAt` do dashboard com **menos de 2 minutos**

Mais detalhes do publisher: [PUBLISHER_WINDOWS.md](./PUBLISHER_WINDOWS.md) · VPS 24/7: [PUBLISHER_VPS_CHECKLIST.md](./PUBLISHER_VPS_CHECKLIST.md)

---

## Para o cliente (passo a passo)

### 1. Conta e acesso

- [ ] Criar conta em **https://sniperbo.com**
- [ ] Fazer login e confirmar que entrou no painel
- [ ] Plano **Premium ou VIP** ativo (Free **não** tem Telegram)

### 2. Criar bot no Telegram

- [ ] Abrir o **@BotFather** no Telegram
- [ ] Criar bot novo (`/newbot`)
- [ ] Copiar o **Bot Token** (guardar em local seguro)
- [ ] Adicionar o bot ao **grupo** onde os sinais vão sair
- [ ] Tornar o bot **administrador** do grupo (recomendado)

### 3. Pegar o Chat ID do grupo

- [ ] Adicionar o bot `@userinfobot` ou `@getidsbot` no grupo **ou**
- [ ] Usar o Chat ID que o painel pede após o teste
- [ ] Grupos costumam começar com **`-100`**

### 4. Configurar no painel

- [ ] Entrar em **Validador → aba Canais / Central Telegram**
- [ ] Preencher:
  - Nome do canal (ex: "Sala VIP João")
  - **Bot Token**
  - **Chat ID**
- [ ] Clicar em **Testar / Validar grupo**
- [ ] Confirmar mensagem de teste no grupo do Telegram
- [ ] Salvar o canal

### 5. Ativar os motores

Ligar só o que o cliente quiser receber:

- [ ] **Números Pagantes**
- [ ] **Padrões IA**
- [ ] **Surf Alert**
- [ ] **Empates**
- [ ] **Validador** (padrões que ele salvar no painel)

→ Status deve mostrar **Canal conectado** + **Motor ativo**

### 6. Teste final

- [ ] Aguardar um sinal live **ou** pedir teste operacional
- [ ] Confirmar mensagem no grupo do cliente
- [ ] Se não chegar: verificar se o motor está **ON** e o publisher está rodando

---

## Limites por plano

| Plano | Telegram | Canais |
|-------|----------|--------|
| Free | ❌ | 0 |
| Premium | ✅ | até 3 |
| VIP | ✅ | até 10 |

---

## Problemas comuns

| Sintoma | O que verificar |
|---------|-----------------|
| "Telegram bloqueado no plano Free" | Plano precisa ser Premium/VIP |
| Botão de motor não salva | Testar o canal antes; plano ativo |
| Sinais não chegam | Publisher parado **ou** motor desligado |
| "Chat ID já existe" | Grupo já usado por outro cliente |
| Login travado | Limpar cache / tentar de novo |

---

## Mensagem pronta para enviar ao cliente

> **Configurar sua sala de sinais no Telegram**
>
> 1. Crie um bot no @BotFather e adicione ao seu grupo
> 2. Entre em sniperbo.com → Validador → Central Telegram
> 3. Cole o Bot Token e o Chat ID do grupo
> 4. Clique em **Testar** e confirme a mensagem no grupo
> 5. Ative os motores que deseja receber (Números Pagantes, IA, Surf, etc.)
>
> Pronto — os sinais chegam direto no seu grupo, sem precisar deixar o site aberto.
