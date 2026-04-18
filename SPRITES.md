# ElysiusRP — Guia de Sprites para o Artista

## Contexto

O jogo é uma **sala de espera isométrica** — visão de cima em 45°, estilo clássico de jogos como Habbo Hotel ou RPGs antigos.
O mapa é um deserto com tiles de areia e pedra. Os personagens andam pelo mapa em tempo real com outros jogadores.

**Estilo visual:** Pixel art limpa, sem sombras, sem brilhos, sem transparências graduais.
Cores sólidas e bem definidas. Pense em pixel art estilo SNES/GBA.

---

## 1. TILES (o chão)

O chão é feito de blocos isométricos — cada bloco tem **face superior** (o topo plano) e **duas faces laterais** (dão a ilusão de volume).

### Dimensão total do tile
**64 × 44 pixels**

```
         A
        /|\
       / | \
      /  |  \        ← Face superior: 64 × 32px
     /   |   \          (losango — diamond shape)
    B----+----C
    |         |      ← Faces laterais: 12px de altura
    |         |         (lado direito e lado esquerdo)
    D----+----E
```

### Medidas exatas
- **Largura total:** 64px
- **Altura da face superior (diamond):** 32px
- **Altura das faces laterais:** 12px
- **Altura total do tile:** 44px (32 + 12)

### Tipos de tile (3 variações)
| Tipo | Uso no mapa | Cor sugerida |
|------|------------|--------------|
| **Areia clara** (`SAND`) | Maioria do chão | Tons de bege/dourado |
| **Areia escura** (`DARK`) | Variação do chão | Bege mais acinzentado |
| **Pedra** (`ROCK`) | Bordas do mapa e obstáculos | Cinza/marrom pedra |

Cada tipo precisa de **3 cores distintas** para as 3 faces:
- Face superior → cor mais clara
- Face lateral direita → cor média
- Face lateral esquerda → cor mais escura

### Entrega
3 arquivos PNG, um por tipo: `tile_sand.png`, `tile_dark.png`, `tile_rock.png`
Cada um: **64 × 44px**, fundo transparente.

---

## 2. PERSONAGENS

Os personagens são vistos de frente/diagonal — visão isométrica padrão.
Cada jogador tem uma **cor de roupa única** gerada pelo jogo (não precisa fazer variações de cor — o código aplica a cor automaticamente sobre uma silhueta).

> **Opção A — Silhueta neutra:** Faça o personagem com uma cor neutra (ex: cinza) nas roupas.
> O jogo vai recolorir automaticamente. Mais fácil de produzir.
>
> **Opção B — Sprite colorido:** Faça o personagem com uma cor definida. O jogo usa como está,
> sem recolorir. Exige uma versão por cor (8 cores no total).

### Dimensão do frame
**32 × 48 pixels** por frame

### Animação de caminhada
O personagem tem **4 frames** de walk cycle em um único arquivo (spritesheet horizontal):

```
┌────────┬────────┬────────┬────────┐
│        │        │        │        │
│  idle  │ walk1  │ walk2  │ walk3  │   ← 48px de altura
│        │        │        │        │
└────────┴────────┴────────┴────────┘
   32px    32px    32px    32px
   ←————————— 128px total ————————→
```

**Arquivo final:** `character.png` — **128 × 48px**, fundo transparente

### Âncora (ponto de referência)
O ponto de "encaixe" no chão é o **centro inferior** do sprite — os pés do personagem.
Deixe os pés posicionados na borda inferior central da imagem.

```
┌────────────────┐
│                │
│   personagem   │  48px
│                │
│       ↑        │
└───────+────────┘ ← pé aqui (centro, linha 48)
        centro
        32px
```

### Proporção sugerida do personagem
```
cabeça:  ~12px de largura, ~14px de altura
corpo:   ~14px de largura, ~12px de altura
pernas:  ~10px de largura, ~10px de altura
total:   ~32px de altura (dentro dos 48px — sobra espaço em cima)
```

---

## 3. GOSMAS (slimes decorativos)

São criaturas blob espalhadas pelo mapa. Ficam paradas — **sem animação**.
Visual orgânico, estilo gosma/geleia.

### Dimensão
**32 × 32 pixels** por gosma, fundo transparente.

### Cores (8 gosmas no mapa)
Cada gosma tem sua própria cor. Sugestão de paleta:
- Amarelo dourado
- Azul médio
- Verde limão
- Roxo
- Vermelho
- Ciano/turquesa
- Laranja
- Rosa/magenta

O artista pode escolher as cores exatas — só manter cores **saturadas e vivas** para contrastar com o chão de areia.

### Entrega
8 arquivos PNG: `slime_1.png` ... `slime_8.png` — cada um **32 × 32px**.
Ou um único spritesheet `slimes.png` — **256 × 32px** (8 colunas, 1 linha).

---

## 4. REGRAS TÉCNICAS IMPORTANTES

> Estas regras existem porque o jogo roda dentro do FiveM (motor Chromium embarcado na CPU do jogador).
> Efeitos pesados travam o jogo para todos.

| ✅ Pode usar | ❌ Não pode usar |
|-------------|----------------|
| Cores sólidas | Sombras (drop shadow) |
| Transparência total (recorte do fundo) | Transparência parcial / gradiente com alpha |
| Contornos definidos | Glow / bloom |
| Anti-aliasing suave nas bordas do PNG | Blur de qualquer tipo |
| Pixel art limpa | Filtros de brilho/saturação |

**Resumo:** Pixel art clássica, sem efeitos digitais modernos. O que você vê é o que aparece — sem pós-processamento.

---

## 5. RESUMO DE ENTREGAS

| Asset | Arquivo | Dimensão | Frames |
|-------|---------|----------|--------|
| Tile areia clara | `tile_sand.png` | 64 × 44px | 1 |
| Tile areia escura | `tile_dark.png` | 64 × 44px | 1 |
| Tile pedra | `tile_rock.png` | 64 × 44px | 1 |
| Personagem (spritesheet) | `character.png` | 128 × 48px | 4 (walk) |
| Gosmas | `slimes.png` | 256 × 32px | 8 estáticas |

**Formato:** PNG, fundo transparente em todos.
**Modo de cor:** RGB, 8 bits por canal é suficiente.

---

## 6. REFERÊNCIAS VISUAIS

Jogos com estilo visual próximo ao que buscamos:
- **Habbo Hotel** — tiles isométricos simples, personagens pequenos
- **Pokemon Mystery Dungeon** (GBA) — pixel art isométrica limpa
- **Stardew Valley** — proporção de personagem e tiles
- **CrossCode** — tiles isométricos modernos mas com leitura clara

O diferencial do ElysiusRP é a **temática grega/mitológica** — o deserto pode ter elementos como ruínas, colunas quebradas, areia dourada. Os personagens podem ter togas, elmos, sandálias.
