export type Op = '+' | '=';
export type Piece =
  | { kind: 'number'; value: number } // 0..10 → a, b
  | { kind: 'answer'; value: number } // 1..20 → result
  | { kind: 'op'; op: Op };
export type SlotId = 'a' | 'op1' | 'b' | 'op2' | 'result';
export type Slots = Record<SlotId, Piece | null>;

export interface GameState {
  slots: Slots;
  phase: 'building' | 'correct';
  wrongAttempts: number; // na conta atual
}

export type Action =
  | { type: 'DROP'; piece: Piece; slot: SlotId }
  | { type: 'REMOVE'; slot: SlotId }
  | { type: 'NEXT' }
  | { type: 'RESET' };

export type RejectReason = 'wrong-kind' | 'wrong-op' | 'locked' | 'zero-zero' | 'frozen';

export type GameEvent =
  | { type: 'snap'; slot: SlotId; piece: Piece }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'correct' }
  | { type: 'wrong'; hint: boolean };

export const SLOT_ORDER: SlotId[] = ['a', 'op1', 'b', 'op2', 'result'];

const EMPTY: Slots = { a: null, op1: null, b: null, op2: null, result: null };
export const initialState: GameState = { slots: EMPTY, phase: 'building', wrongAttempts: 0 };

/** v2: adicionar '−', '×', '÷' aqui (na subtração a regra equivalente é a ≥ b). */
export function compute(a: number, op: Op, b: number): number {
  if (op !== '+') throw new Error(`operação não suportada: ${op}`);
  return a + b;
}

const ACCEPTS: Record<SlotId, Piece['kind']> = { a: 'number', b: 'number', op1: 'op', op2: 'op', result: 'answer' };
const SLOT_OP: Partial<Record<SlotId, Op>> = { op1: '+', op2: '=' };

export function accepts(slot: SlotId, p: Piece): boolean {
  return p.kind === ACCEPTS[slot] && (p.kind !== 'op' || p.op === SLOT_OP[slot]);
}

const num = (p: Piece | null) => (p && p.kind !== 'op' ? p.value : null);
const opOf = (p: Piece | null): Op => (p?.kind === 'op' ? p.op : '+');

export const isBuilt = (s: Slots) => !!(s.a && s.op1 && s.b && s.op2);

/** A bandeja mostra as cartas de número até a conta estar montada; depois, as respostas. */
export const trayMode = (s: Slots): 'build' | 'answers' => (isBuilt(s) ? 'answers' : 'build');

/** Próximo lugar compatível vazio, na ordem a → op1 → b → op2 → result (tap-to-place). */
export const nextEmptySlot = (s: Slots, p: Piece) => SLOT_ORDER.find((id) => !s[id] && accepts(id, p)) ?? null;

export function reduce(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const reject = (reason: RejectReason) => ({ state, events: [{ type: 'reject', reason } as GameEvent] });
  const { slots } = state;

  switch (action.type) {
    case 'DROP': {
      const { piece, slot } = action;
      if (state.phase === 'correct') return reject('frozen');
      if (slot === 'result' && piece.kind !== 'op' && !isBuilt(slots)) return reject('locked');
      if (!accepts(slot, piece)) return reject(piece.kind === 'op' && ACCEPTS[slot] === 'op' ? 'wrong-op' : 'wrong-kind');
      const v = num(piece)!;
      // não existe carta de resposta 0
      if ((slot === 'a' || slot === 'b') && v === 0 && num(slots[slot === 'a' ? 'b' : 'a']) === 0) return reject('zero-zero');
      const next = { ...slots, [slot]: piece };
      const changedNumber = (slot === 'a' || slot === 'b') && num(slots[slot]) !== v;
      const wrongAttempts = changedNumber ? 0 : state.wrongAttempts;
      const snap: GameEvent = { type: 'snap', slot, piece };

      if (slot !== 'result') return { state: { ...state, slots: next, wrongAttempts }, events: [snap] };

      if (v === compute(num(slots.a)!, opOf(slots.op1), num(slots.b)!)) {
        return { state: { ...state, slots: next, phase: 'correct' }, events: [snap, { type: 'correct' }] };
      }
      const w = wrongAttempts + 1;
      return { state: { ...state, slots: next, wrongAttempts: w }, events: [snap, { type: 'wrong', hint: w >= 2 }] };
    }

    case 'REMOVE': {
      if (state.phase === 'correct') return reject('frozen');
      if (!slots[action.slot]) return { state, events: [] };
      const next = { ...slots, [action.slot]: null };
      if (action.slot !== 'result') next.result = null; // a conta desmontou: resultado volta a travar
      const wrongAttempts = action.slot === 'a' || action.slot === 'b' ? 0 : state.wrongAttempts;
      return { state: { ...state, slots: next, wrongAttempts }, events: [] };
    }

    case 'NEXT':
    case 'RESET':
      return { state: initialState, events: [] };
  }
}
