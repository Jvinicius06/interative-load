# ElysiusRP — Sala de Espera Interativa

Sala de espera multiplayer para servidores FiveM. Exibida como loading screen nativa enquanto o servidor carrega.

![Node.js](https://img.shields.io/badge/Node.js-20-green) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## Funcionalidades

- **Mini-jogo isométrico** — até 250 jogadores simultâneos se movendo no mapa em tempo real
- **Chat por balões** — pressione Enter para digitar, balão aparece acima do personagem
- **Nomes gregos** — atribuídos automaticamente pelo servidor (sem input do jogador)
- **Log no Discord** — registra conexões e mensagens de chat em lote via webhook

---

## Stack

- **Backend:** Node.js + Express + ws (WebSocket)
- **Frontend:** HTML/CSS/JS Vanilla — sem frameworks
- **Infra:** Docker

---

## Configuração

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta do servidor (padrão: `3000`) |
| `SERVER_NAME` | Nome exibido no HUD (padrão: `ElysiusRP`) |
| `SERVER_SECRET` | Segredo para autenticar chamadas do resource FiveM |
| `DISCORD_WEBHOOK_URL` | URL do webhook para logs de chat e conexão |

### 2. Rodar localmente

```bash
npm install
npm start
# ou com hot-reload:
npm run dev
```

Acesse `http://localhost:3000`

### 3. Rodar com Docker

```bash
docker build -t elysius-loadscreen .
docker run -d -p 3000:3000 --env-file .env elysius-loadscreen
```

---

## Integração FiveM

### `fivem-resource/fxmanifest.lua`

Aponte o `loadscreen` para o endereço do servidor Node.js:

```lua
loadscreen 'http://SEU-IP:3000/'
loadscreen_manual_shutdown 'yes'
```

### `fivem-resource/server.lua`

Loga IP + identifier + nome FiveM no Discord quando o jogador conecta.  
Preencha `WAITING_ROOM_URL` e `SERVER_SECRET` no topo do arquivo.

### Fechar o loadscreen

No script de spawn do seu servidor, chame:

```lua
ShutdownLoadingScreen()
ShutdownLoadingScreenNui()
```

---

## Chat

| Ação | Tecla |
|------|-------|
| Abrir input | `Enter` |
| Enviar mensagem | `Enter` |
| Cancelar | `Esc` |

Balões expiram automaticamente após 6 segundos.

---

## Logs no Discord

Dois tipos de embed são enviados em lote a cada 3 segundos:

**Conexão** — quando um jogador entra na sala de espera:
> 🔗 João Silva — `license:abc123` — IP: `1.2.3.4`

**Chat** — quando uma mensagem é enviada:
> 💬 Zorythas — `license:abc123` — IP: `1.2.3.4`
> ```oi galera```

---

## Estrutura

```
server.js              → Entry point (Express + WebSocket)
src/
  wsHandler.js         → Protocolo WebSocket
  roomManager.js       → Estado em memória dos players
  tokenManager.js      → Tokens temporários
  rateLimiter.js       → Rate limit: 1 msg/2s por conexão
  names.js             → 80 nomes gregos + gerador aleatório
  webhook.js           → Fila de logs para Discord
config/
  config.js            → Nome do servidor
public/
  index.html           → Loading screen (único HTML)
  js/game.js           → Engine isométrica + chat + WebSocket client
fivem-resource/
  fxmanifest.lua       → Manifest do resource
  server.lua           → Log de conexão via playerConnecting
  client.lua           → Exemplo de ShutdownLoadingScreen
```

---

## Performance (FiveM/CEF)

O frontend roda na CPU do jogador via CEF. Regras seguidas:

- Sem `box-shadow`, `text-shadow`, `filter`, `backdrop-filter`
- Sem `globalAlpha`, `shadowBlur` ou WebGL no canvas
- Arte 100% `fillRect` + `beginPath/fill` — cores sólidas apenas
