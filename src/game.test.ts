import { describe, expect, it } from 'vitest';
import { Action, GameState, initialState, nextEmptySlot, Piece, reduce, SlotId, trayMode } from './game';

const n = (value: number): Piece => ({ kind: 'number', value });
const ans = (value: number): Piece => ({ kind: 'answer', value });
const plus: Piece = { kind: 'op', op: '+' };
const eq: Piece = { kind: 'op', op: '=' };

function run(actions: Action[], from: GameState = initialState) {
  let state = from;
  let events: ReturnType<typeof reduce>['events'] = [];
  for (const a of actions) ({ state, events } = reduce(state, a));
  return { state, events };
}
const drop = (piece: Piece, slot: SlotId): Action => ({ type: 'DROP', piece, slot });
const build = (a: number, b: number) => [drop(n(a), 'a'), drop(plus, 'op1'), drop(n(b), 'b'), drop(eq, 'op2')];

describe('reducer', () => {
  it('accepts pieces in any order', () => {
    const { state, events } = run([drop(eq, 'op2'), drop(n(3), 'b'), drop(plus, 'op1'), drop(n(5), 'a')]);
    expect(state.slots).toMatchObject({ a: n(5), op1: plus, b: n(3), op2: eq, result: null });
    expect(events).toEqual([{ type: 'snap', slot: 'a', piece: n(5) }]);
  });

  it('rejects wrong kind', () => {
    for (const [p, s] of [[n(1), 'op1'], [plus, 'a'], [ans(3), 'a'], [ans(3), 'op2']] as const) {
      const r = reduce(initialState, drop(p, s));
      expect(r.state).toBe(initialState);
      expect(r.events).toEqual([{ type: 'reject', reason: 'wrong-kind' }]);
    }
    for (const [p, s] of [[eq, 'op1'], [plus, 'op2']] as const) {
      expect(reduce(initialState, drop(p, s)).events).toEqual([{ type: 'reject', reason: 'wrong-op' }]);
    }
  });

  it('only answer cards go in the result', () => {
    const built = run(build(5, 3)).state;
    expect(reduce(built, drop(n(8), 'result')).events).toEqual([{ type: 'reject', reason: 'wrong-kind' }]);
    expect(reduce(built, drop(ans(8), 'result')).state.slots.result).toEqual(ans(8));
  });

  it('locks result until the equation is built', () => {
    const r = run([...build(2, 3).slice(0, 3), drop(ans(5), 'result')]);
    expect(r.events).toEqual([{ type: 'reject', reason: 'locked' }]);
    expect(r.state.slots.result).toBeNull();
  });

  it('rejects 0 + 0 (there is no answer card 0)', () => {
    for (const first of ['a', 'b'] as const) {
      const r = run([drop(n(0), first), drop(n(0), first === 'a' ? 'b' : 'a')]);
      expect(r.events).toEqual([{ type: 'reject', reason: 'zero-zero' }]);
    }
    expect(run([drop(n(0), 'a'), drop(n(1), 'b')]).state.slots.b).toEqual(n(1));
  });

  it('10 + 10 = 20 is correct; 5 + 3 = 9 is wrong', () => {
    expect(run([...build(10, 10), drop(ans(20), 'result')]).state.phase).toBe('correct');
    const r = run([...build(5, 3), drop(ans(9), 'result')]);
    expect(r.state.phase).toBe('building');
    expect(r.events[1]).toEqual({ type: 'wrong', hint: false });
  });

  it('tray switches to answers when the equation is built, back when a piece leaves', () => {
    const steps = build(5, 3).map((_, i) => run(build(5, 3).slice(0, i + 1)).state.slots);
    expect(steps.map(trayMode)).toEqual(['build', 'build', 'build', 'answers']);
    const after = run([...build(5, 3), drop(ans(7), 'result'), { type: 'REMOVE', slot: 'b' }]).state;
    expect(trayMode(after.slots)).toBe('build');
    expect(after.slots.result).toBeNull();
  });

  it('replaces a filled slot', () => {
    expect(run([drop(n(2), 'a'), drop(n(6), 'a')]).state.slots.a).toEqual(n(6));
  });

  it('removing a/op clears and relocks the result', () => {
    const base = run([...build(2, 3), drop(ans(4), 'result')]).state;
    expect(base.slots.result).toEqual(ans(4));
    const r = reduce(base, { type: 'REMOVE', slot: 'op1' }).state;
    expect(r.slots.op1).toBeNull();
    expect(r.slots.result).toBeNull();
    expect(reduce(r, drop(ans(5), 'result')).events).toEqual([{ type: 'reject', reason: 'locked' }]);
  });

  it('correct answer freezes the board', () => {
    const r = run([...build(5, 3), drop(ans(8), 'result')]);
    expect(r.state.phase).toBe('correct');
    expect(r.events).toEqual([{ type: 'snap', slot: 'result', piece: ans(8) }, { type: 'correct' }]);
    expect(reduce(r.state, drop(n(1), 'a')).events).toEqual([{ type: 'reject', reason: 'frozen' }]);
    expect(reduce(r.state, { type: 'REMOVE', slot: 'a' }).state).toBe(r.state);
    expect(reduce(r.state, { type: 'NEXT' }).state).toEqual(initialState);
  });

  it('wrong answer counts attempts and hints after 2 in a row', () => {
    let s = run(build(5, 3)).state;
    let r = reduce(s, drop(ans(7), 'result'));
    expect(r.events[1]).toEqual({ type: 'wrong', hint: false });
    s = reduce(r.state, { type: 'REMOVE', slot: 'result' }).state;
    expect(s.wrongAttempts).toBe(1);
    expect(s.slots.a).toEqual(n(5));
    r = reduce(s, drop(ans(9), 'result'));
    expect(r.events[1]).toEqual({ type: 'wrong', hint: true });
    expect(r.state.wrongAttempts).toBe(2);
  });

  it('resets the error counter when a or b changes, not when re-placed', () => {
    let s = run([...build(5, 3), drop(ans(7), 'result'), { type: 'REMOVE', slot: 'result' }]).state;
    expect(reduce(s, drop(n(5), 'a')).state.wrongAttempts).toBe(1);
    s = reduce(s, drop(n(4), 'a')).state;
    expect(s.wrongAttempts).toBe(0);
  });

  it('RESET clears everything', () => {
    expect(run([...build(1, 1), { type: 'RESET' }]).state).toEqual(initialState);
  });

  it('tap-to-place picks the next compatible empty slot', () => {
    const s = run([drop(n(1), 'a')]).state.slots;
    expect(nextEmptySlot(s, n(2))).toBe('b');
    expect(nextEmptySlot(s, eq)).toBe('op2');
    expect(nextEmptySlot(run(build(1, 1)).state.slots, ans(2))).toBe('result');
    expect(nextEmptySlot(s, plus)).toBe('op1');
  });
});
