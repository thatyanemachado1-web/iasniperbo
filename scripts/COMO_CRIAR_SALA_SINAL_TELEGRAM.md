# Como criar uma sala de sinal no Telegram (cliente Premium/VIP)

Guia completo para o **cliente Premium ou VIP** configurar a própria **sala de sinais** no Telegram usando o Sniper Bo IA.

> **Importante:** a sala é **o grupo do Telegram do cliente**, conectado via bot. O Sniper Bo não cria o grupo por você — você cria o grupo, conecta seu bot e recebe os sinais automaticamente na nuvem (não precisa deixar o site aberto).

Documentos relacionados:

- [ONBOARDING_TELEGRAM.md](./ONBOARDING_TELEGRAM.md) — checklist do operador
- [PUBLISHER_WINDOWS.md](./PUBLISHER_WINDOWS.md) — infraestrutura de sinais live

---

## Antes de começar

| Requisito | Detalhe |
|-----------|---------|
| Plano | **Premium** ou **VIP** ativo (Free **não** tem Telegram) |
| Conta | Cadastro em **https://sniperbo.com** |
| Telegram | App instalado no celular ou desktop |
| Grupo | Um grupo Telegram seu (pode ser privado) |
| Bot | Criado no @BotFather (grátis, 2 minutos) |

**Limites de salas por plano:**

| Plano | Salas (canais) no Telegram |
|-------|----------------------------|
| Free | 0 — bloqueado |
| Premium | até **3** |
| VIP | até **10** |

---

## Visão geral (3 etapas)

```
1. Telegram     →  Criar bot + grupo + pegar Chat ID
2. Sniper Bo    →  Validador → Central Telegram → conectar e testar
3. Motores      →  Ligar os tipos de sinal que você quer receber
```

Depois disso, os sinais chegam **direto no seu grupo**, 24h, sem manter o site aberto.

---

## Etapa 1 — Preparar o Telegram

### 1.1 Criar o bot

1. Abra o Telegram e busque **@BotFather**
2. Envie `/newbot`
3. Escolha um **nome** (ex: `Sniper Bo Sala João`)
4. Escolha um **username** terminando em `bot` (ex: `sniperbo_joao_bot`)
5. O BotFather envia o **Bot Token** — copie e guarde (formato: `123456789:ABCdef...`)

### 1.2 Criar ou usar um grupo

1. Crie um **grupo** no Telegram (ou use um existente)
2. **Adicione o bot** que você criou ao grupo
3. Recomendado: tornar o bot **administrador** do grupo
   - Configurações do grupo → Administradores → adicionar o bot
   - Permissão de **enviar mensagens** ativa

### 1.3 Descobrir o Chat ID

O Chat ID identifica seu grupo. Grupos/canais costumam começar com **`-100`**.

**Opção A — bot auxiliar (mais fácil)**

1. Adicione **@userinfobot** ou **@getidsbot** ao grupo
2. O bot responde com o ID do grupo
3. Copie o número (ex: `-1004291049001`)
4. Pode remover o bot auxiliar depois

**Opção B — pelo painel Sniper Bo**

1. Cole Bot Token + um Chat ID aproximado
2. Clique em **Procurar grupo** — o painel valida e confirma a conexão

---

## Etapa 2 — Conectar no painel Sniper Bo

### 2.1 Entrar no Validador

1. Acesse **https://sniperbo.com**
2. Faça **login** com seu e-mail
3. Vá em **Validador** (menu do app)
4. Abra a aba **Central Telegram**

### 2.2 Cadastrar a sala

Na seção **Conectar Telegram**, preencha:

| Campo | O que colocar |
|-------|----------------|
| **Nome do canal** | Nome da sua sala (ex: `Sala VIP João`) |
| **Bot Token** | Token copiado do @BotFather |
| **Chat ID** | ID do grupo (ex: `-1004291049001`) |

### 2.3 Validar a conexão

1. Clique em **Procurar grupo**
2. Aguarde a mensagem **"Conexão validada com teste real"**
3. Confira no Telegram se chegou uma **mensagem de teste** no grupo
4. Clique em **Salvar canal**

Se aparecer erro:

| Mensagem | Solução |
|----------|---------|
| "Telegram bloqueado no plano Free" | Ative Premium ou VIP |
| "Informe Bot Token e Chat ID" | Preencha os dois campos |
| "Já existe um canal com este Chat ID" | Esse grupo já está em outra conta |
| Validação falhou | Bot está no grupo? É admin? Token correto? |

### 2.4 Confirmar status

Após salvar, os badges devem mostrar:

- **Canal conectado** (verde)
- Nome da sala no seletor de canais

---

## Etapa 3 — Ativar os motores de sinal

Na **Central Telegram**, ligue os motores que você quer receber. Cada card tem um toggle:

| Motor no painel | O que envia |
|-----------------|-------------|
| **SEGUIR NÚMEROS PAGANTES** | Entradas confirmadas de números pagantes |
| **SEGUIR PADRÕES IA** | Entradas quando a IA confirmar padrão |
| **SEGUIR AVISO DE SURF** | Alertas de Surf confirmados |
| **SEGUIR SOMENTE EMPATES** | Possíveis empates |
| **SEGUIR VALIDADOR** | Padrões que **você** salvou no Validador |

1. Selecione seu canal no dropdown
2. Clique no toggle de cada motor desejado (**ON**)
3. Aguarde a confirmação: *"[Motor] ativado e salvo no servidor"*
4. Badge **Motor ativo** deve ficar verde

**Dica:** pode ligar todos ou só os que preferir. Sem motor ativo = nenhum sinal daquele tipo.

### Configuração avançada (opcional)

Em cada motor, clique em **Configurar** para ajustar:

- Templates das mensagens (entrada, green, red, gale)
- Proteção (G1, G2…)
- Botões com link

---

## Etapa 4 — Testar

1. Clique em **Testar** ao lado do canal selecionado
2. Deve chegar uma mensagem de preview no grupo
3. Aguarde um **sinal live** real (depende da mesa estar operando)
4. Não precisa manter o site ou celular com o app aberto

---

## Como funciona depois de configurado

```
Mesa ao vivo → Publisher (servidor) → sniperbo.com
       ↓
Monitor detecta sinal confirmado
       ↓
Telegram Engine → SEU grupo (via SEU bot)
```

- Cada cliente Premium/VIP recebe no **próprio grupo**
- Sinais oficiais (Pagantes, IA, Surf, Empates) são os mesmos da plataforma
- Módulo **Validador** envia só os padrões que você salvou
- Funciona **24h na nuvem** — feche o navegador tranquilo

---

## Perguntas frequentes

**Preciso deixar o site aberto?**  
Não. Depois de configurar, roda na nuvem.

**Posso ter mais de uma sala?**  
Sim. Premium: até 3. VIP: até 10. Cada uma com bot + grupo diferente.

**Posso usar o mesmo bot em grupos diferentes?**  
Sim, mas cada sala no painel precisa de um **Chat ID** diferente (um cadastro por grupo).

**Free pode criar sala?**  
Não. Telegram fica bloqueado no plano Free.

**Os sinais são instantâneos?**  
Sim, em tempo real, quando há entrada confirmada na mesa e o motor está ativo.

**Configurei tudo e não chega sinal live?**  
Confira: motor **ON**, canal **conectado**, plano **ativo**, e aguarde próxima entrada confirmada. Use **Testar** para validar o grupo.

---

## Mensagem pronta (copiar e enviar ao cliente)

```
📲 COMO CRIAR SUA SALA DE SINAL NO TELEGRAM — SNIPER BO IA

✅ Requisito: plano Premium ou VIP ativo

PASSO 1 — TELEGRAM
1. Abra @BotFather → /newbot → crie seu bot
2. Copie o Bot Token
3. Crie um grupo e adicione o bot (de preferência como admin)
4. Pegue o Chat ID do grupo com @userinfobot (número que começa com -100)

PASSO 2 — PAINEL
1. Entre em sniperbo.com → Validador → aba Central Telegram
2. Preencha: Nome, Bot Token e Chat ID
3. Clique Procurar grupo → confirme a mensagem de teste no Telegram
4. Clique Salvar canal

PASSO 3 — MOTORES
Ligue os sinais que quer receber:
• Números Pagantes
• Padrões IA
• Surf Alert
• Empates
• Validador (seus padrões salvos)

Pronto! Os sinais chegam direto no seu grupo, sem precisar deixar o site aberto. 🎯
```

---

## Checklist rápido

- [ ] Plano Premium/VIP ativo
- [ ] Bot criado no @BotFather
- [ ] Bot adicionado ao grupo (admin recomendado)
- [ ] Chat ID copiado
- [ ] Canal salvo em Validador → Central Telegram
- [ ] Teste recebido no grupo
- [ ] Motores desejados ligados (ON)
- [ ] Status: Canal conectado + Motor ativo
