# Encaixa Conta

Jogo de tablet para crianças de ~5 anos aprenderem soma montando a conta como um quebra-cabeça: cartas de número com encaixes laterais, peças redondas de símbolo (`+`, `=`) que entram entre elas e cartas de resposta para o resultado. A criança arrasta as peças, ouve cada uma ser falada e recebe retorno quando coloca o resultado.

Este pacote é a especificação para implementação:

| Arquivo | Conteúdo |
|---|---|
| `README.md` | Funcionamento, regras de negócio, áudio, critérios de aceite (este arquivo) |
| `DESIGN.md` | Spec visual: tokens, componentes, medidas exatas, telas e animações |
| `src/design/tokens.ts` | Tokens e constantes prontos para importar (cores, tamanhos, padrões de bolinhas, paths SVG) |
| `assets/*.svg` | Formas de referência: carta de número, carta de resposta, lugares vazios, peças de símbolo |
| `docs/SPEC-cartas-de-resposta.md` | Spec original das cartas de resposta (já incorporada aqui e no `DESIGN.md`) |

---

## 1. Stack

- **React + TypeScript**, build com **Vite**.
- Renderização em **DOM/SVG**. Não usar `<canvas>`.
- Arrastar com **Pointer Events** (`pointerdown/move/up` + `setPointerCapture`), ou **dnd-kit** com sensor de toque. **Não usar a API nativa de HTML5 Drag and Drop**, porque ela funciona mal no Safari do iPad.
- Áudio com **Web Audio API** (`AudioContext` + `AudioBuffer` pré-carregados). Não usar `speechSynthesis`: as falas são arquivos gravados.
- Distribuído como **PWA**: manifest com `display: fullscreen` e `orientation: landscape`, service worker com cache offline de todos os assets e áudios.
- Sem backend, sem login, sem coleta de dados.

## 2. Telas

1. **Tela inicial.** Ilustração da conta `2 + 3 = 5` montada e um botão grande "Jogar".
2. **Tela de jogo.** Área de montagem em cima (3 lugares de carta e 2 buracos de símbolo) e bandeja embaixo (cartas de número 0 a 10 e peças `+` e `=` enquanto a conta é montada; cartas de resposta 1 a 20 quando ela está completa). Botões de som e de recomeçar no canto superior direito. Não há botão de voltar ou início.

Layout projetado para **tablet na horizontal, 1194×834** (iPad Pro 11"). Veja a seção "Escala" em `DESIGN.md`.

## 3. Fluxo do jogo

```
[Tela inicial] --toque em Jogar--> desbloqueia áudio + pré-carrega sons
      --> fala "Vamos encaixar a conta?" --> [Jogo: vazio]

[Jogo: vazio] --criança arrasta peças--> [Montando]
[Montando] --A, +, B e = preenchidos--> o lugar do resultado é liberado e a bandeja troca para as respostas
[Montando] --solta carta de resposta no resultado--> validação
      certo  --> [Acertou] --toca em Próxima--> [Jogo: vazio]
      errado --> [Errou] --a carta volta para a bandeja--> [Montando]
```

## 4. Regras de negócio

### 4.1 Peças
- **Cartas de número:** valores de `0` a `10` (`MAX_VALUE = 10`). Entram só em `a` e `b`. Têm bolinhas e uma cor por número.
- **Cartas de resposta:** valores de `1` a `20` (`MIN_RESULT = 1`, `MAX_RESULT = 20`), porque a maior conta é `10 + 10 = 20`. Entram só no `result`. São brancas, sem bolinhas, para a criança contar as bolinhas da conta e não tirar a resposta pela cor.
- **Peças de símbolo:** `+` e `=`. As peças `−`, `×` e `÷` existem no design, mas **não entram na v1**.
- **As peças são infinitas.** Arrastar uma carta da bandeja cria uma cópia; a bandeja nunca esvazia. Isso permite contas como `5 + 5`.
- Enquanto uma carta é arrastada, a carta de origem na bandeja fica com `opacity: 0.3`.

### 4.2 Lugares (slots)
A conta tem 5 lugares fixos, da esquerda para a direita:

| id | aceita | observação |
|---|---|---|
| `a` | carta de número | 1º número |
| `op1` | somente a peça `+` | buraco entre `a` e `b` |
| `b` | carta de número | 2º número |
| `op2` | somente a peça `=` | buraco entre `b` e `result` |
| `result` | somente carta de resposta | travado até `a`, `op1`, `b` e `op2` estarem preenchidos |

- `a`, `op1`, `b` e `op2` podem ser preenchidos **em qualquer ordem**.
- **Tipo errado** (número num buraco de símbolo, carta de número no `result`, carta de resposta em `a`/`b`, `=` no lugar do `+` e similares): a peça volta para a bandeja, toca `sfx_boing` e nada muda.
- **Resultado travado:** se a criança solta qualquer carta no `result` antes de a conta estar montada, a carta volta, toca `sfx_boing` e a voz diz `vo_monte_primeiro` ("Primeiro monte a conta!"). O lugar travado aparece com o "?" a 40% de opacidade; quando libera, o "?" vai a 100% e o lugar pulsa de leve uma vez.
- **Soltar sobre um lugar já preenchido** (exceto `result` depois de um acerto): substitui a peça. A antiga some com fade, sem animação de volta.
- **Retirar uma peça colocada:** ela pode ser arrastada de volta para a bandeja ou para fora da área de montagem e então some. Se `a`, `b`, `op1` ou `op2` for retirado, o `result` volta a travar e, se tiver carta, ela também sai.
- **Sem limite de soma:** as respostas vão até 20, então qualquer `a + b` com cartas de 0 a 10 é válido.
- **Caso `0 + 0`:** não existe carta de resposta 0. Soltar `0` em `a` ou `b` com `0` já no outro lugar é recusado: a carta volta, toca `sfx_boing` e a voz diz `vo_outro_numero` ("Escolhe outro número!").

### 4.2.1 Bandeja contextual
A bandeja mostra um conjunto por vez, derivado do estado: `trayMode = a && op1 && b && op2 ? 'answers' : 'build'`.

| `trayMode` | a bandeja mostra |
|---|---|
| `build` | cartas de número 0 a 10 + peças `+` e `=` |
| `answers` | cartas de resposta 1 a 20 |

A troca é um cross-fade de 250ms. Se qualquer peça da conta sai, volta para `build` (e a carta do `result`, se houver, sai junto).

### 4.3 Encaixe (snap)
- Ao soltar, calcule a distância entre o **centro da peça arrastada** e o **centro de cada lugar compatível e livre ou substituível**.
- Se a menor distância for `≤ SNAP_RADIUS` (cartas: 140px; símbolos: 90px, em coordenadas de design), a peça encaixa: anima até a posição exata em 180ms com `ease-out` e toca `sfx_clique`.
- Caso contrário, volta para a origem na bandeja em 250ms e não toca som.
- O lugar compatível mais próximo fica realçado durante o arrasto (borda tracejada mais escura, `#5E5468`), para mostrar onde a peça vai cair.

### 4.4 Alternativa por toque (tap-to-place)
Para facilitar a coordenação motora: **tocar** numa peça da bandeja (pointerdown e pointerup com menos de 8px de movimento e menos de 250ms) coloca a peça no **próximo lugar compatível vazio**, na ordem `a → op1 → b → op2 → result`, com a mesma animação, som e regras de validação do arrasto.

### 4.5 Validação
Acontece **somente** quando uma carta de resposta é encaixada no `result`.

- **Certo** (`result === a + b`):
  - A carta fica no lugar. As 5 peças fazem um "pulo" de comemoração em sequência (escala 1 → 1.08 → 1, 60ms de intervalo entre elas).
  - Toca `sfx_acerto` e, em seguida, a frase completa: `vo_certo` + `num_a` + `vo_mais` + `num_b` + `vo_e` + `num_result` ("Certo! Cinco mais três é oito!").
  - Aparece a pílula de sucesso (veja `DESIGN.md`) e, depois que a voz termina, o botão **Próxima** (ícone de seta, sem texto) com pulso suave.
  - Neste estado, a montagem fica travada: nada pode ser arrastado para dentro ou para fora.
  - Tocar em Próxima limpa os 5 lugares (as peças somem com fade e um leve movimento para baixo, 250ms) e volta ao estado vazio.
- **Errado:**
  - A carta do resultado treme (shake horizontal ±10px, 3 ciclos, 300ms), toca `sfx_ops` e a voz diz `vo_ainda_nao` ("Hmm, ainda não. Conta as bolinhas!").
  - Depois de 600ms, a carta volta para a bandeja de respostas. `a`, `+`, `b` e `=` continuam no lugar e a bandeja continua em `answers`.
  - O contador de erros da conta atual é incrementado.
- **Dica depois de 2 erros seguidos na mesma conta:** antes de a carta voltar, roda a **contagem guiada**. As bolinhas de `a` e depois as de `b` acendem uma de cada vez (escala 1.3 e anel amarelo `#FFD35C`), a cada 600ms, enquanto a voz conta `num_1`, `num_2`, … até `a + b`. Isso não revela a carta certa na bandeja; só conta. O contador zera quando `a` ou `b` muda.

### 4.6 Recomeçar e som
- **Recomeçar** (ícone de seta circular): limpa todos os lugares, zera o contador de erros e volta ao estado vazio. Não pede confirmação.
- **Som** (ícone de alto-falante): alterna entre mudo e com som; com mudo, o ícone mostra o alto-falante riscado. A preferência é salva em `localStorage` (`encaixa-conta:muted`), lida em `try/catch`, com padrão "com som".
- **Não existem:** pontuação, tempo, vidas, derrota nem mensagens negativas.

### 4.7 Fala ao colocar cada peça
| evento | áudio |
|---|---|
| pegar uma peça (início do arrasto) | `sfx_pega` (bem baixo) |
| encaixar carta `n` em `a` ou `b` | `sfx_clique` + `num_n` |
| encaixar `+` | `sfx_clique` + `vo_mais` |
| encaixar `=` | `sfx_clique` + `vo_igual` |
| encaixar no `result` | `sfx_clique` + `num_n`, depois a validação (4.5) |
| peça recusada | `sfx_boing` (+ fala, quando a regra pedir) |

- A voz usa uma **fila única**: uma fala nova **interrompe** a anterior. Assim, uma criança que encaixa rápido sempre ouve a peça mais recente.
- Enquanto a voz fala um número recém-colocado, mostre o balão de fala perto da peça (ícone de alto-falante + palavra entre aspas, por exemplo "oito"), que some quando o áudio termina.

## 5. Áudio: lista de arquivos

Formato `.m4a` (AAC), mono, 44.1kHz, normalizado em -16 LUFS, sem silêncio no começo e no fim. Pasta: `public/audio/`.

**Números:** `num_0` "zero", `num_1` "um", `num_2` "dois", `num_3` "três", `num_4` "quatro", `num_5` "cinco", `num_6` "seis", `num_7` "sete", `num_8` "oito", `num_9` "nove", `num_10` "dez", `num_11` "onze", `num_12` "doze", `num_13` "treze", `num_14` "catorze", `num_15` "quinze", `num_16` "dezesseis", `num_17` "dezessete", `num_18` "dezoito", `num_19` "dezenove", `num_20` "vinte".

**Voz:**
| arquivo | fala |
|---|---|
| `vo_intro` | "Vamos encaixar a conta?" |
| `vo_mais` | "mais" |
| `vo_igual` | "igual" |
| `vo_e` | "é" |
| `vo_certo` | "Certo!" |
| `vo_ainda_nao` | "Hmm, ainda não. Conta as bolinhas!" |
| `vo_monte_primeiro` | "Primeiro monte a conta!" |
| `vo_outro_numero` | "Escolhe outro número!" |

**Efeitos:** `sfx_pega`, `sfx_clique`, `sfx_boing`, `sfx_acerto`, `sfx_ops`.

Para desenvolvimento, gere placeholders (beeps) para os arquivos que faltarem; o jogo não pode quebrar se um áudio não existir.

**Regra do iOS:** o `AudioContext` só é criado ou retomado (`resume()`) dentro do handler de toque do botão "Jogar". É nesse momento que todos os buffers são decodificados.

## 6. Modelo de estado (sugestão)

```ts
type Op = '+' | '=';
type Piece =
  | { kind: 'number'; value: number } // 0..10 → a, b
  | { kind: 'answer'; value: number } // 1..20 → result
  | { kind: 'op'; op: Op };
type SlotId = 'a' | 'op1' | 'b' | 'op2' | 'result';

interface GameState {
  screen: 'start' | 'game';
  slots: Record<SlotId, Piece | null>;
  phase: 'building' | 'correct';
  wrongAttempts: number;   // na conta atual
  muted: boolean;
}

type Action =
  | { type: 'START' }
  | { type: 'DROP'; piece: Piece; slot: SlotId }
  | { type: 'REMOVE'; slot: SlotId }
  | { type: 'NEXT' }
  | { type: 'RESET' }
  | { type: 'TOGGLE_MUTE' };
```

- Toda a regra (aceitação, `0 + 0`, validação, modo da bandeja) mora num **reducer puro** com testes unitários. Animações e áudio são efeitos disparados pelo resultado da ação (por exemplo, o reducer devolve `{ state, events: ['snap','speak:num_5'] }`).
- O reducer recusa uma ação devolvendo o mesmo estado e o evento `reject` com um motivo (`wrong-kind`, `wrong-op`, `locked`, `zero-zero`), e a UI mapeia o motivo para o som e a fala certos.
- Pensando no futuro: deixe o operador como dado (`op1: '+' | '−' | '×' | '÷'`) e a validação como `compute(a, op, b)`, para a v2 trocar a operação sem reescrever a lógica. Na subtração, a regra equivalente ao limite da soma é `a ≥ b`.

## 7. Critérios de aceite (v1)

1. Abre na tela inicial; o toque em "Jogar" toca `vo_intro` no iPad (Safari e PWA instalada).
2. Arrastar com o dedo funciona sem rolar nem dar zoom na página, e vários toques simultâneos não quebram o estado (só o primeiro ponteiro arrasta).
3. Todas as regras da seção 4 funcionam, cobertas por testes do reducer: tipo errado, resultado travado, `0 + 0`, troca da bandeja, substituição, retirada, certo (incluindo `10 + 10 = 20`), errado e dica depois de 2 erros.
4. Cada encaixe fala a peça certa; uma fala nova interrompe a anterior.
5. O visual bate com `DESIGN.md` e com o canvas de design; as peças `+` e `=` preenchem exatamente o buraco entre duas cartas.
6. Funciona offline depois da primeira abertura (PWA).
7. O layout escala para outros tablets na horizontal, sem cortar nada.
8. Mudo persiste entre sessões.

## 8. Fora do escopo da v1
`−`, `×`, `÷`; contas com mais de dois números; níveis ou contas sugeridas pelo jogo; perfis; modo retrato; telefones.
