# Encaixa Conta — Spec: cartas de resposta

Esta spec cobre só a parte de resposta do jogo. O resto (cartas de número, símbolos, arrasto, áudio em geral) continua como está em `README.md` e `DESIGN.md`.

## 1. Resumo

O resultado da conta passa a ter **cartas próprias**, separadas das cartas de número:

| | Carta de número | **Carta de resposta** |
|---|---|---|
| Valores | 0 a 10 | **1 a 20** |
| Onde entra | `a` e `b` | **somente `result`** |
| Bolinhas | sim | **não** |
| Recorte | esquerda e direita | **só esquerda; direita reta** |
| Cor | uma cor por número | **branca, número escuro** |

Motivo: a maior conta possível é `10 + 10 = 20`, então o resultado precisa ir até 20. A carta não tem bolinhas porque a criança deve **contar as bolinhas das cartas da conta** para achar a resposta. Ela é branca para ficar claro que é "a carta da resposta" e para não dar a resposta pela cor.

## 2. Visual

### 2.1 Forma
- Caixa de **200×266**: a forma tem 200×260 e a espessura fica 6px para baixo.
- Cantos de raio **24**.
- **Lado esquerdo:** recorte côncavo em semicírculo de raio **38**, centrado em `y = 130`, igual ao das cartas de número. É onde encaixa a peça `=`.
- **Lado direito: reto**, sem recorte, porque a carta fecha a conta.

```
M24,0 H176 A24,24 0 0 1 200,24 V236 A24,24 0 0 1 176,260
H24 A24,24 0 0 1 0,236 V168 A38,38 0 0 0 0,92 V24 A24,24 0 0 1 24,0 Z
```

Arquivo de referência: `assets/answer-card-shape.svg`.

### 2.2 Camadas e cores
1. Espessura: o path com `translate(0,6)` e fill `#D9CFC0`.
2. Carta: o path com fill `#FFFFFF`, stroke `#E3D5BF` e `stroke-width: 3`.
3. Número: Fredoka 108px / peso 600 / `line-height: 1`, cor `#2A2238`, centralizado horizontalmente, com o topo do texto em `y = 76` (centralizado na altura). Números de dois dígitos (11 a 20) usam o mesmo tamanho; "20" cabe com folga.

### 2.3 Lugar vazio do resultado
- Mesmo path da carta de resposta (reto à direita).
- Fill `#FFFDF8`, stroke `#9C8F7C` de 4px, `stroke-dasharray: 14 10` e `stroke-linecap: round`.
- "?" central de 108px / 500, cor `#7A6F60`, topo em `y = 74`.
- **Travado** (conta incompleta): "?" a 40% de opacidade.
- **Liberado:** "?" a 100% e um pulso único de escala 1 → 1.04 → 1 em 300ms.
- **Alvo do arrasto** (carta de resposta perto do lugar): stroke `#5E5468`.

Arquivo de referência: `assets/result-slot-shape.svg`.

### 2.4 Na conta
A fileira da conta é `a`(x=0) · `b`(x=200) · `result`(x=400), com as cartas encostadas. A carta de resposta encaixa em `x = 400` e a peça `=` fica centrada na emenda `x = 400`, `y = 130`, preenchendo o recorte esquerdo da resposta e o direito de `b`.

### 2.5 Na bandeja
- Escala `0.45` (caixa 90×120).
- Container de **1008px** com `flex-wrap`, gap 18 (vertical) / 12 (horizontal), **10 por linha**: 1 a 10 em cima, 11 a 20 embaixo, centralizado na bandeja.
- Cada carta é um `<button aria-label="Resposta N">`.
- Durante o arrasto, a carta de origem fica com `opacity: 0.3`, e a cópia arrastada usa o mesmo estilo de arrasto das outras peças (`rotate(-6deg) scale(0.94)` + sombra).

## 3. Funcionamento

### 3.1 Bandeja contextual
A bandeja mostra **um conjunto por vez**, derivado do estado:

```ts
const trayMode = slots.a && slots.op1 && slots.b && slots.op2 ? 'answers' : 'build';
```

| `trayMode` | a bandeja mostra |
|---|---|
| `build` | cartas de número 0 a 10 + peças `+` e `=` |
| `answers` | cartas de resposta 1 a 20 |

- A troca é um cross-fade de **250ms**.
- Se a criança retira qualquer peça da conta (`a`, `op1`, `b`, `op2`), `trayMode` volta para `build`. Se havia carta no `result`, ela sai junto.

### 3.2 Regras de encaixe
| ação | resultado |
|---|---|
| carta de resposta → `result` liberado | encaixa (`sfx_clique` + `num_N`) e valida (3.3) |
| carta de resposta → `a`, `b`, `op1` ou `op2` | recusa: volta para a bandeja + `sfx_boing` (na prática não acontece, porque a bandeja de respostas só aparece com a conta completa) |
| carta de número → `result` | recusa: volta + `sfx_boing` |
| qualquer carta → `result` travado | recusa: volta + `sfx_boing` + `vo_monte_primeiro` |
| toque rápido numa carta de resposta (tap-to-place) | vai direto para o `result`, com as mesmas regras |

### 3.3 Validação
Acontece quando uma carta de resposta encaixa no `result`.

**Certo** (`value === a + b`):
- A carta fica no lugar e a conta trava para edição.
- As 5 peças fazem um "pulo" em sequência (scale 1 → 1.08 → 1, 220ms, 60ms de intervalo).
- Áudio: `sfx_acerto`, depois `vo_certo` + `num_a` + `vo_mais` + `num_b` + `vo_e` + `num_result` ("Certo! Cinco mais três é oito!").
- Aparece a pílula verde "Certo! … é …" e, quando a voz termina, o botão **Próxima** (seta, sem texto, com pulso).

**Errado:**
- A carta treme (±10px × 3, 300ms), toca `sfx_ops` + `vo_ainda_nao` ("Ainda não. Conta as bolinhas!") e aparece a pílula laranja "Ainda não. Conta as bolinhas!".
- Depois de 600ms, a carta volta para a bandeja de respostas; a conta continua montada e a bandeja continua em `answers`.
- `wrongAttempts += 1`.
- **Com 2 erros seguidos**, antes de a carta voltar, roda a contagem guiada: as bolinhas de `a` e de `b` acendem uma a uma (anel `#FFD35C`, scale 1.3, a cada 600ms) enquanto a voz conta de `num_1` até `num_(a+b)`. O contador zera quando `a` ou `b` muda.

### 3.4 Caso `0 + 0`
Não existe carta de resposta 0. Por isso, soltar `0` em `a` ou `b` com `0` já no outro lugar é **recusado**: a carta volta, toca `sfx_boing` e a voz diz `vo_outro_numero` ("Escolhe outro número!"). Motivo do `reject`: `zero-zero`.

> Alternativa, se preferir: incluir uma carta de resposta 0 (faixa 0 a 20) e remover esta regra.

## 4. Áudio adicional
- Números novos: `num_11` "onze", `num_12` "doze", `num_13` "treze", `num_14` "catorze", `num_15` "quinze", `num_16` "dezesseis", `num_17` "dezessete", `num_18` "dezoito", `num_19` "dezenove", `num_20` "vinte".
- Voz nova: `vo_outro_numero` "Escolhe outro número!".
- Removida: `vo_muito_grande` (não existe mais limite de soma).

## 5. Modelo de estado

```ts
type Piece =
  | { kind: 'number'; value: number }   // 0..10 → a, b
  | { kind: 'answer'; value: number }   // 1..20 → result
  | { kind: 'op'; op: '+' | '=' };

const ACCEPTS: Record<SlotId, Piece['kind']> = {
  a: 'number', b: 'number', op1: 'op', op2: 'op', result: 'answer',
};

type RejectReason = 'wrong-kind' | 'wrong-op' | 'locked' | 'zero-zero';
```

Tokens: `answerCard`, `tray.answers`, `MIN_RESULT = 1`, `MAX_RESULT = 20` e as cores `answerFill`, `answerStroke` e `answerShade` em `src/design/tokens.ts`.

## 6. Critérios de aceite
1. A bandeja mostra as cartas de número enquanto a conta está incompleta e troca para as respostas 1 a 20 quando `a`, `+`, `b` e `=` estão no lugar; volta para as cartas de número se alguma peça sair.
2. A carta de resposta não tem bolinhas, é reta à direita e encaixa a peça `=` no recorte esquerdo sem folga visível.
3. Só a carta de resposta entra no `result`; carta de número no `result` é recusada.
4. `10 + 10 = 20` valida como certo; `5 + 3` com resposta `9` valida como errado e a carta volta.
5. Dois erros seguidos disparam a contagem guiada até `a + b`.
6. `0 + 0` é recusado com `vo_outro_numero`.
7. Testes do reducer cobrem os itens 1, 3, 4, 5 e 6.
