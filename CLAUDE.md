# ElysiusRP — Sala de Espera Interativa

## Visão Geral

Sala de espera para servidores FiveM. O jogador vê um mini-jogo isométrico multiplayer enquanto o servidor carrega.

- **Mini-jogo isométrico** multiplayer (canvas 2D, 20×20 tiles)
- **Chat por balões** desenhados no canvas acima dos personagens
- **Nomes gregos** gerados automaticamente pelo servidor (sem input do jogador)
- **Discord webhook** para log de mensagens do chat

Stack: Node.js + Express + ws + HTML/CSS/JS Vanilla. Sem framework frontend.
Capacidade: até **250 jogadores simultâneos**. Sem banco de dados (estado em memória).

---

## Regras Absolutas de Performance — FiveM / CEF

Tudo roda na **CPU** do jogador (CEF = Chromium Embedded Framework).
**Nenhum** dos itens abaixo pode ser usado no jogo ou em qualquer NUI:

### CSS proibido
- `box-shadow`
- `text-shadow`
- `filter` (incluindo `blur`, `brightness`, `drop-shadow`)
- `backdrop-filter`
- `opacity` com valor fracionário (evitar em elementos animados)
- Gradientes complexos em elementos animados

### Canvas proibido
- `globalAlpha` (sem transparência no canvas do jogo)
- `shadowBlur` / `shadowColor`
- `globalCompositeOperation` diferente de `source-over`
- WebGL / OffscreenCanvas

### O que É permitido
- `fillRect`, `fillStyle` com cor sólida
- `beginPath` / `moveTo` / `lineTo` / `closePath` / `fill`
- `quadraticCurveTo` / `bezierCurveTo` (caminhos sólidos)
- `arc` (sem anti-aliasing pesado — `ctx.imageSmoothingEnabled = false`)
- `fillText` (sem text-shadow no CSS externo)
- Diferentes `fillStyle` para simular faces 3D (isométrico natural)

---

## Arquitetura

```
server.js                  → Entry point (Express + WebSocket)
src/
  wsHandler.js             → Protocolo WS: chat + jogo
  roomManager.js           → Estado em memória (players, posições)
  tokenManager.js          → Tokens temporários (não usado ativamente)
  rateLimiter.js           → 1 msg/2s por conexão
  names.js                 → 80 nomes gregos + randomNick()
  webhook.js               → Log de chat via Discord webhook
config/config.js           → Nome do servidor (ElysiusRP)
public/
  index.html               → Jogo completo (único HTML servido)
  js/game.js               → Engine isométrica + chat balão + WS client
fivem-resource/
  fxmanifest.lua           → loadscreen 'http://SEU-IP:3000/' + manual_shutdown
  client.lua               → Exemplo de ShutdownLoadingScreen()
  server.lua               → Vazio (não necessário)
```

### Como funciona a integração FiveM

O loadscreen carrega **antes** de qualquer script Lua, por isso não há como passar dados do jogador.
O fluxo é simples:

1. `fxmanifest.lua` aponta `loadscreen 'http://SEU-IP:3000/'`
2. O FiveM abre o `index.html` como loading screen nativa
3. O cliente conecta ao WebSocket **sem token** → servidor atribui nome grego aleatório
4. Quando o jogador spawnar, o script de spawn chama `ShutdownLoadingScreen()`

**Não há token, não há Lua server-side, não há dados do jogador.**

---

## Protocolo WebSocket

| Direção | Tipo | Payload |
|---------|------|---------|
| C → S | `auth` | `{ token }` |
| S → C | `auth_ok` | `{ nickname, playerCount, gx, gy }` |
| S → C | `auth_error` | `{ message }` |
| C → S | `chat` | `{ message }` |
| S → todos | `chat` | `{ nickname, message, timestamp }` |
| S → todos | `system` | `{ message }` |
| S → todos | `player_count` | `{ count }` |
| C → S | `game_request_state` | `{}` |
| S → C | `game_state` | `{ players: [{nickname, x, y}] }` |
| C → S | `game_move` | `{ x, y }` |
| S → outros | `game_player_update` | `{ nickname, x, y }` |
| S → todos | `game_player_leave` | `{ nickname }` |
| C → S | `game_ball_spawn` | `{ wx, wy, vx, vy }` |
| S → outros | `game_ball_spawn` | `{ ownerNick, wx, wy, vx, vy }` |

---

## Nomes dos Jogadores

Gerados automaticamente em `src/names.js` — 80 nomes gregos fictícios (ex: `Zorythas`, `Nyxaris`, `Drakion`).
O jogador **não escolhe** o próprio nome. O nome é atribuído no momento em que o token é criado (`POST /api/token`).
Em `DEV_MODE`, o nome também é gerado aleatoriamente por `randomNick()`.

---

## Chat por Balões

- Pressionar **Enter** → abre barra de input na parte inferior da tela
- Digitando → balão de prévia aparece acima do personagem (estilo "typing", cor fria)
- **Enter** no input → envia mensagem, balão muda para cor cheia, fecha o input automaticamente
- **ESC** → cancela sem enviar
- Balões remotos aparecem ao receber mensagem `chat` via WS
- Balões expiram após **6 segundos**
- Arte 100% canvas: `fillRect` para caixa + `beginPath/fill` para triângulo cauda — sem transparência

---

## Jogo Isométrico — Especificações Técnicas

### Mapa
- Grade **20×20 tiles** isométrica
- Geração determinística (seed `0xdeadbeef`) — mesmo mapa para todos
- Tipos: `SAND`, `DARK_SAND`, `ROCK`
- Tiles de borda são sempre `ROCK`

### Projeção Isométrica
```
screenX = (wx - wy) * (TILE_W / 2)
screenY = (wx + wy) * (TILE_H / 2)
```

### Constantes do Jogo
- `TILE_W = 64`, `TILE_H = 32`, `TILE_D = 12`
- `MAP_W = 20`, `MAP_H = 20`
- `SPEED = 0.07` tiles/frame
- `SYNC_MS = 50` ms entre broadcasts de posição
- `INTERP = 0.22` fator de interpolação dos remotos

### Spawn
Posição aleatória em `[1.5, 18.5]` para X e Y — evita tiles de borda (ROCK).

### Controles (WASD = direções cardinais na tela)
| Tecla | Movimento isométrico |
|-------|---------------------|
| W / ↑ | wx -= step, wy -= step |
| S / ↓ | wx += step, wy += step |
| A / ← | wx -= step, wy += step |
| D / → | wx += step, wy -= step |

### Render — Dois Passes (z-ordering correto)
1. **Passo 1**: todos os tiles + gosmas em ordem de row (`tx + ty` crescente)
2. **Passo 2**: todos os jogadores ordenados por `wx + wy` crescente, sempre sobre os tiles

Após `drawChar`, desenha `drawBubble` se o player tiver bubble ativa.

### Gosmas (Slimes)
8 objetos estáticos decorativos. Arte com `quadraticCurveTo`. Posições fixas em `SLIMES[]`.

### Personagens
Arte 100% `fillRect`. Cor determinística por nickname (hash → `PALETTE[]`).

---

## Paleta de Cores do Jogo

### Tiles
| Tipo | Top | Lado Direito | Lado Esquerdo |
|------|-----|-------------|---------------|
| SAND | `#c8a85a` | `#a88838` | `#b89848` |
| DARK | `#b09040` | `#906828` | `#a07830` |
| ROCK | `#8a7a5e` | `#6a5a3e` | `#7a6a4e` |

### Jogadores
```javascript
const PALETTE = [
  '#e84848', '#4898e8', '#48d848', '#e8c838',
  '#e848b0', '#48e8c8', '#e88038', '#9848e8',
];
```

### Background do canvas
`#281408` — marrom escuro (body CSS, canvas usa `clearRect`)

---

## Discord Webhook

Configurar `DISCORD_WEBHOOK_URL` no `.env` para receber logs de chat.
Cada mensagem gera um embed com: nickname, identifier, IP do jogador e texto.
Se a variável estiver vazia, o webhook é silenciosamente ignorado.

---

## Dev Mode

Conexão sem token já funciona em produção (é o fluxo padrão).
URL de teste: `http://localhost:3000/`
Nome é gerado automaticamente via `randomNick()`.

---

## Como Rodar

```bash
cp .env.example .env   # preencher SERVER_SECRET e DISCORD_WEBHOOK_URL
npm install
npm start              # ou npm run dev com nodemon
```

Sala de espera: `http://localhost:3000/`
Health: `http://localhost:3000/api/health`

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta HTTP/WS |
| `SERVER_NAME` | `ElysiusRP` | Nome exibido no HUD |
| `SERVER_SECRET` | — | Segredo para autenticar chamadas Lua → `/api/token` |
| `DEV_MODE` | `false` | Permite conexão sem token |
| `DISCORD_WEBHOOK_URL` | — | URL do webhook para log de chat |
