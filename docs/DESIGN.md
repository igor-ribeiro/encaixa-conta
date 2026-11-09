# Encaixa Conta — Spec de design

Todas as medidas estão em px no **espaço de design de 1194×834**. Os valores também estão em `src/design/tokens.ts`.

## 1. Escala
- Renderize tudo dentro de um "palco" de 1194×834 e aplique `transform: scale(s)`, com `s = min(viewportW / 1194, viewportH / 834)`, centralizado e com faixas laterais na cor do fundo (`#FFF6E9`).
- As coordenadas de pointer precisam ser convertidas para o espaço do palco: `(clientX - stageLeft) / s`.
- CSS global: `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; overscroll-behavior: none;` no `html`, no `body` e no palco.

## 2. Tipografia
- **Fredoka** (Google Fonts), pesos 400, 500 e 600. Empacote os arquivos localmente (`woff2`) para funcionar offline. Fallback: `system-ui, sans-serif`.
- Número da carta: 108px / 600 / `line-height: 1`.
- Botão "Jogar": 64px / 600.
- Balão de fala: 30px / 500. Pílula de feedback: 24px / 500.

## 3. Cores

| token | valor | uso |
|---|---|---|
| `bg` | `#FFF6E9` | fundo das telas |
| `ink` | `#2A2238` | texto e ícones |
| `inkSoft` | `#5E5468` | texto secundário, realce do lugar-alvo |
| `tray` | `#F3E4CC` | bandeja |
| `trayDivider` | `#E2CFB0` | divisor da bandeja |
| `slotFill` | `#FFFDF8` | interior do lugar vazio |
| `slotStroke` | `#9C8F7C` | borda tracejada do lugar vazio |
| `slotMark` | `#7A6F60` | "?" do resultado |
| `hole` | `#EADCC6` | buraco vazio do símbolo |
| `op` | `#22304F` | peça de símbolo |
| `opShadow` | `#121B30` | "espessura" da peça de símbolo |
| `button` | `#FFFFFF` | botões redondos do topo |
| `buttonShadow` | `#E3D5BF` | espessura dos botões e do balão |
| `successBg` / `successInk` | `#DDF3E1` / `#1C5B2A` | pílula de acerto |
| `tryBg` / `tryInk` | `#FDE8D4` / `#7A3A0B` | pílula de "ainda não" (laranja suave, nunca vermelho) |
| `hintRing` | `#FFD35C` | anel da contagem guiada |

**Cor de cada número.** A carta é preenchida com a cor; número e bolinhas são brancos. Cada número tem sempre a mesma cor.

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| `#64748B` | `#E5484D` | `#D9620A` | `#B88400` | `#3E9B3E` | `#1E9A8A` | `#2F7DD1` | `#5B5BD6` | `#8E4EC6` | `#D6409F` | `#9A5B2E` |

**Sombra da carta** (espessura): a mesma cor com cada canal RGB multiplicado por `0.72`.

## 4. Componentes

### 4.1 Carta de número (`NumberCard`)
- Caixa de **200×266**: a forma tem 200×260 e a sombra fica deslocada 6px para baixo.
- Forma (`assets/card-shape.svg`): retângulo com cantos de raio **24** e um **recorte côncavo em semicírculo de raio 38**, centrado em `y = 130` (meio da altura), **nas bordas esquerda e direita**.
  ```
  M24,0 H176 A24,24 0 0 1 200,24 V92 A38,38 0 0 0 200,168 V236 A24,24 0 0 1 176,260
  H24 A24,24 0 0 1 0,236 V168 A38,38 0 0 0 0,92 V24 A24,24 0 0 1 24,0 Z
  ```
- Camadas: (1) o path com `translate(0,6)` preenchido com a cor de sombra; (2) o path preenchido com a cor do número.
- Número: centralizado horizontalmente, com o topo do bloco de texto em `y = 18`.
- Área das bolinhas: caixa de **128×100** em `(36, 146)`.

### 4.2 Bolinhas
**Padrão "dado"** (padrão para 1 a 9): grade 3×3 com centros em `x ∈ {20, 64, 108}` e `y ∈ {16, 50, 84}`, relativos à área das bolinhas; diâmetro 26. As células são indicadas como `[coluna, linha]`:

| n | células |
|---|---|
| 0 | nenhuma |
| 1 | [1,1] |
| 2 | [0,0] [2,2] |
| 3 | [0,0] [1,1] [2,2] |
| 4 | [0,0] [0,2] [2,0] [2,2] |
| 5 | [0,0] [0,2] [1,1] [2,0] [2,2] |
| 6 | [0,0] [1,0] [2,0] [0,2] [1,2] [2,2] |
| 7 | 6 + [1,1] |
| 8 | todas menos [1,1] |
| 9 | todas |

**10** (e o modo alternativo "fileira" para todos os números): grade 5×2, diâmetro 22, `left = (k % 5) * 26.5` e `top = k < 5 ? 22 : 58`, preenchendo da esquerda para a direita, primeiro a linha de cima. No modo "fileira", as posições vazias aparecem como anel `2px solid rgba(255,255,255,0.55)`. **A v1 usa "dado"**; deixe "fileira" como opção de configuração.

### 4.2.1 Carta de resposta (`AnswerCard`)
- Valores 1 a 20. Entra só no `result`.
- Caixa de **200×266** (forma 200×260 + espessura 6px), cantos de raio 24.
- **Recorte só à esquerda** (semicírculo de raio 38 em `y = 130`, onde encaixa o `=`); **direita reta**, porque a carta fecha a conta.
  ```
  M24,0 H176 A24,24 0 0 1 200,24 V236 A24,24 0 0 1 176,260
  H24 A24,24 0 0 1 0,236 V168 A38,38 0 0 0 0,92 V24 A24,24 0 0 1 24,0 Z
  ```
- Camadas: (1) path com `translate(0,6)`, fill `answerShade` `#D9CFC0`; (2) path com fill `answerFill` `#FFFFFF`, stroke `answerStroke` `#E3D5BF` de 3.
- Número: 108px / 600 / `line-height: 1`, cor `ink`, centralizado, topo em `y = 76`. Dois dígitos usam o mesmo tamanho.
- **Sem bolinhas** e sem cor por número: a criança conta as bolinhas da conta, e a cor não entrega a resposta.
- Referência: `assets/answer-card-shape.svg`.

### 4.3 Peça de símbolo (`OpPiece`)
- Círculo de **74px de diâmetro**, cor `op`, `box-shadow: 0 5px 0 opShadow`.
- Glifo: SVG com `viewBox 0 0 36 36` desenhado em 40×40, traço branco de 6, `stroke-linecap: round`.
  - `+`: `M18 6 V30 M6 18 H30`
  - `=`: `M7 12 H29 M7 24 H29`
  - (v2) `−`: `M7 18 H29` · `×`: `M9 9 L27 27 M27 9 L9 27` · `÷`: `M7 18 H29` + círculos `r=3.5` em `(18,7)` e `(18,29)`
- **Encaixe:** duas cartas lado a lado **se encostam (gap 0)**, e os dois meio-recortes formam um círculo de raio 38 centrado na emenda. A peça (raio 37) fica centrada nesse ponto: `left = emendaX − 37`, `top = 130 − 37 = 93`.
- Na bandeja, a peça aparece maior (**88px**, glifo 44, sombra `0 6px 0`), para facilitar o toque.

### 4.4 Lugar vazio (`Slot`)
- Mesmo path da carta, com fill `slotFill`, stroke `slotStroke` de 4, `stroke-dasharray: 14 10` e `linecap round`.
- Lugar do resultado: usa o **path da carta de resposta** (reto à direita; `assets/result-slot-shape.svg`), com "?" de 108px / 500 na cor `slotMark`, centralizado, topo em `y = 74`. Travado: "?" a 40%. Liberado: "?" a 100% e um pulso único de escala 1 → 1.04 → 1 em 300ms.
- Buraco do símbolo vazio: círculo de 74px na cor `hole`, desenhado **atrás** dos lugares, na emenda.
- Lugar-alvo durante o arrasto: stroke `inkSoft`.

### 4.5 Área de montagem (`Equation`)
- A fileira tem 600×266 no espaço natural: `a` em x=0, `b` em x=200, `result` em x=400, e buracos nas emendas x=200 e x=400.
- Renderizada com `scale(0.9)`, ocupando **540×240**, posicionada em **left 327, top 145** (centralizada na faixa entre o topo e a bandeja).
- A borda esquerda de `a` mantém o meio-recorte, como parte da identidade da peça. A borda direita de `result` é reta (carta de resposta).

### 4.6 Bandeja (`Tray`)
- Retângulo em **top 450**, largura total, **altura 384**, cor `tray`, `border-radius: 40px 40px 0 0`, padding 24/32.
- Mostra **um conjunto por vez** (veja `README.md`, 4.2.1), com cross-fade de 250ms entre eles. O conjunto oculto fica invisível para toque e leitor de tela.
- **Montagem** (`build`), conteúdo centralizado com gap 48:
  - Cartas 0 a 10 em `scale(0.6)` (caixa 120×160), num container de **790px** com `flex-wrap`, gap 16 (vertical) / 14 (horizontal): 0 a 5 na 1ª linha e 6 a 10 na 2ª.
  - Divisor vertical de 3×280, cor `trayDivider`.
  - Coluna com `+` e `=` (88px), gap 32.
- **Respostas** (`answers`): cartas de resposta 1 a 20 em `scale(0.45)` (caixa 90×120), num container de **1008px** com `flex-wrap`, gap 18 (vertical) / 12 (horizontal), 10 por linha: 1 a 10 em cima, 11 a 20 embaixo.
- Cada peça da bandeja é um `<button>` com `aria-label` ("Carta 5", "Resposta 8", "mais", "igual").

### 4.7 Topo
- Botões redondos de **56px**, fundo `button`, `box-shadow: 0 4px 0 buttonShadow`, ícone de traço de 28px na cor `ink`.
- Alinhados à direita: top 24, right 32, gap 16. Ordem: **Som**, **Recomeçar**. Não há botão de início.
- Ícones (viewBox 28):
  - Som: `M4 11 V17 H9 L15 22 V6 L9 11 Z M19 10 Q22 14 19 18 M22 7 Q27 14 22 21` (mudo: trocar as ondas por um `×`: `M19 11 L25 17 M25 11 L19 17`)
  - Recomeçar: `M6 14 A8 8 0 1 0 9 7.8 M9 3 V8 H4`

### 4.8 Balão de fala
- Pílula branca com `border-radius: 28px`, padding 14/24, `box-shadow: 0 6px 0 buttonShadow`, contendo o ícone de som em `#2F5FB3` (30px) e a palavra entre aspas.
- Posição: à direita da peça recém-colocada, alinhada ao terço superior dela.

### 4.9 Feedback
- Pílula centralizada abaixo da área de montagem (top ≈ 405): padding 12/24, `border-radius: 999px`, ícone de 28px + texto.
  - Certo: `successBg` / `successInk`, ícone de check `M6 14.5 L11.5 20 L22 8.5`, texto "Certo! Cinco mais três é oito." (gerado a partir da conta).
  - Ainda não: `tryBg` / `tryInk`, texto "Ainda não. Conta as bolinhas!"
- Botão **Próxima**: círculo de 88px na cor `op`, com seta branca (`M8 18 H28 M20 10 L28 18 L20 26`, viewBox 36, traço 6), à direita do resultado (left ≈ 900, top ≈ 220), com pulso de escala 1 ↔ 1.06 a cada 1.2s.

## 5. Estados de arrasto e animação

| estado | visual |
|---|---|
| arrastando | a peça segue o dedo com o ponto de toque mantido; `rotate(-6deg) scale(0.94)` ao pegar (120ms); `filter: drop-shadow(0 22px 18px rgba(42,34,56,0.28))`; z-index acima de tudo |
| origem na bandeja | `opacity: 0.3` enquanto a cópia é arrastada |
| encaixar | 180ms `ease-out` até a posição exata; rotação volta a 0 |
| voltar | 250ms `cubic-bezier(.2,.8,.2,1)` até a origem |
| recusar | 250ms de volta + um pequeno shake da peça antes |
| acerto | "pulo" em sequência das 5 peças (scale 1→1.08→1, 220ms cada, 60ms de intervalo) |
| erro | shake ±10px × 3 (300ms) na carta do resultado |
| limpar | fade + translateY(12px) em 250ms |

Respeite `prefers-reduced-motion`: troque deslocamentos e escalas por fades.

## 6. Telas

### 6.1 Tela inicial (1194×834)
- Fundo `bg`, conteúdo centralizado em coluna com gap 80.
- Ilustração: a conta `2 + 3 = 5` montada (cartas e peças reais) em `scale(0.8)` (480×213), com `rotate(-4deg)`.
- Botão "Jogar": pílula `op`, padding 28/72/28/60, `box-shadow: 0 10px 0 opShadow`, ícone de play branco de 52px (`M16 9 L42 26 L16 43 Z`, com cantos arredondados via stroke 6 + `linejoin round`) + texto "Jogar" de 64px branco.

### 6.2 Tela de jogo
Composição: topo (4.7) + área de montagem (4.5) + bandeja (4.6). Estados de referência no canvas de design: **Jogo — início** (tudo vazio) e **Jogo — arrastando a resposta** (5 + 3 = montado, bandeja de respostas, carta de resposta 8 sendo arrastada sobre o resultado, balão "oito").

## 7. Acessibilidade
- Todos os controles são `<button>` com `aria-label`.
- Alvos de toque de no mínimo 56px (cartas de 120×160, peças de 88px).
- Cor nunca é o único sinal: o número e as bolinhas sempre aparecem; o feedback combina ícone, texto, som e movimento.
