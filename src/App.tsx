import { CSSProperties, PointerEvent as RPointerEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import * as audio from './audio';
import {
  answerCard, card, colors, dotsFor, equation as EQ, font, icons, motion, numberColors, numberWords, opPiece, shadeOf, snap,
  MAX_RESULT, MAX_VALUE, MIN_RESULT, STAGE, tray,
} from './design/tokens';
import { accepts, GameEvent, GameState, initialState, isBuilt, nextEmptySlot, Piece, reduce, SLOT_ORDER, SlotId, Slots, trayMode } from './game';

// ---------- palco ----------
const stage = { el: null as HTMLDivElement | null, s: 1 };
const toStage = (clientX: number, clientY: number) => {
  const r = stage.el!.getBoundingClientRect();
  return { x: (clientX - r.left) / stage.s, y: (clientY - r.top) / stage.s };
};
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function App() {
  const [screen, setScreen] = useState<'start' | 'game'>('start');
  const [box, setBox] = useState({ s: 1, left: 0, top: 0 });
  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(innerWidth / STAGE.width, innerHeight / STAGE.height);
      stage.s = s;
      setBox({ s, left: (innerWidth - STAGE.width * s) / 2, top: (innerHeight - STAGE.height * s) / 2 });
    };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, []);

  const play = () => {
    const loaded = audio.unlock(); // dentro do handler de toque (iOS)
    setScreen('game');
    void loaded.then(() => audio.speak(['vo_intro']));
  };

  return (
    <div
      ref={(el) => (stage.el = el)}
      className="stage"
      style={{ left: box.left, top: box.top, transform: `scale(${box.s})` }}
    >
      {screen === 'start' ? <StartScreen onPlay={play} /> : <Game />}
    </div>
  );
}

// ---------- tela inicial ----------
const DEMO: Slots = {
  a: { kind: 'number', value: 2 },
  op1: { kind: 'op', op: '+' },
  b: { kind: 'number', value: 3 },
  op2: { kind: 'op', op: '=' },
  result: { kind: 'answer', value: 5 },
};

function StartScreen({ onPlay }: { onPlay: () => void }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 80 }}>
      <div style={{ width: 480, height: 213, transform: 'rotate(-4deg)' }}>
        <div style={{ transform: 'scale(0.8)', transformOrigin: '0 0' }}>
          <Equation slots={DEMO} />
        </div>
      </div>
      <button
        aria-label="Jogar"
        onClick={onPlay}
        style={{
          display: 'flex', alignItems: 'center', gap: 20, background: colors.op, color: '#fff', borderRadius: 999,
          padding: '28px 72px 28px 60px', boxShadow: `0 10px 0 ${colors.opShadow}`, fontSize: font.playButton.size,
          fontWeight: font.playButton.weight, lineHeight: 1,
        }}
      >
        <svg aria-hidden="true" focusable="false" width={52} height={52} viewBox="0 0 52 52">
          <path d={icons.play} fill="#fff" stroke="#fff" strokeWidth={6} strokeLinejoin="round" />
        </svg>
        Jogar
      </button>
    </div>
  );
}

// ---------- peças ----------
function CardShape({ fill, stroke, dashed, path = card.path, shade = shadeOf(fill), strokeWidth = 0 }: {
  fill: string; stroke?: string; dashed?: boolean; path?: string; shade?: string; strokeWidth?: number;
}) {
  return (
    <svg aria-hidden="true" focusable="false" width={card.width} height={card.height + card.shadowOffset} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      {!dashed && <path d={path} transform={`translate(0,${card.shadowOffset})`} fill={shade} />}
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={dashed ? 4 : strokeWidth}
        strokeDasharray={dashed ? '14 10' : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function NumberCard({ value, lit = 0 }: { value: number; lit?: number }) {
  return (
    <div style={{ position: 'relative', width: card.width, height: card.height + card.shadowOffset }}>
      <CardShape fill={numberColors[value]} />
      <div
        style={{
          position: 'absolute', top: card.numberTop, width: '100%', textAlign: 'center', color: '#fff',
          fontSize: font.cardNumber.size, fontWeight: font.cardNumber.weight, lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ position: 'absolute', ...card.dotsBox }}>
        {dotsFor(value).map((d, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: d.x, top: d.y, width: d.size, height: d.size, borderRadius: '50%',
              background: d.filled ? colors.dot : 'transparent',
              border: d.filled ? undefined : `2px solid ${colors.dotEmptyRing}`,
              transform: i < lit ? 'scale(1.3)' : undefined,
              boxShadow: i < lit ? `0 0 0 4px ${colors.hintRing}` : undefined,
              transition: 'transform 150ms',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function OpPiece({ op, size = opPiece.diameter, glyph = opPiece.glyphSize, shadow = 5 }: { op: '+' | '='; size?: number; glyph?: number; shadow?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', background: colors.op, boxShadow: `0 ${shadow}px 0 ${colors.opShadow}`,
        display: 'grid', placeItems: 'center',
      }}
    >
      <svg aria-hidden="true" focusable="false" width={glyph} height={glyph} viewBox="0 0 36 36">
        <path d={opPiece.glyphs[op].path} stroke="#fff" strokeWidth={opPiece.glyphStroke} strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

/** Carta de resposta: branca, sem bolinhas, reta à direita. */
function AnswerCard({ value }: { value: number }) {
  return (
    <div style={{ position: 'relative', width: card.width, height: card.height + card.shadowOffset }}>
      <CardShape path={answerCard.path} fill={colors.answerFill} shade={colors.answerShade} stroke={colors.answerStroke} strokeWidth={answerCard.strokeWidth} />
      <div
        style={{
          position: 'absolute', top: answerCard.numberTop, width: '100%', textAlign: 'center', color: colors.ink,
          fontSize: font.cardNumber.size, fontWeight: font.cardNumber.weight, lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const PieceView = ({ piece, lit }: { piece: Piece; lit?: number }) =>
  piece.kind === 'number' ? <NumberCard value={piece.value} lit={lit} /> : piece.kind === 'answer' ? <AnswerCard value={piece.value} /> : <OpPiece op={piece.op} />;

// ---------- área de montagem ----------
const isCardSlot = (id: SlotId): id is 'a' | 'b' | 'result' => id === 'a' || id === 'b' || id === 'result';
/** Canto superior esquerdo do lugar, no espaço natural (600×266) da conta. */
const slotPos = (id: SlotId) =>
  isCardSlot(id)
    ? { left: EQ.slotX[id], top: 0 }
    : { left: EQ.seamX[id] - opPiece.diameter / 2, top: card.notchCenterY - opPiece.diameter / 2 };
/** Centro do lugar, no espaço do palco. */
const slotCenter = (id: SlotId) =>
  isCardSlot(id)
    ? { x: EQ.left + (EQ.slotX[id] + card.width / 2) * EQ.scale, y: EQ.top + ((card.height + card.shadowOffset) / 2) * EQ.scale }
    : { x: EQ.left + EQ.seamX[id] * EQ.scale, y: EQ.top + card.notchCenterY * EQ.scale };

type Ghost = { id: number; slot: SlotId; piece: Piece; kind: 'fade' | 'clear' };

interface EquationProps {
  slots: Slots;
  highlight?: SlotId | null;
  hidden?: SlotId | null;
  lit?: number;
  celebrate?: number;
  shake?: number;
  ghosts?: Ghost[];
  onGhostDone?: (id: number) => void;
  onPiecePointerDown?: (slot: SlotId, e: RPointerEvent) => void;
}

function Equation({ slots, highlight, hidden, lit = 0, celebrate = 0, shake = 0, ghosts = [], onGhostDone, onPiecePointerDown }: EquationProps) {
  const built = isBuilt(slots);
  const a = slots.a?.kind === 'number' ? slots.a.value : 0;
  const litFor = (id: SlotId) => (id === 'a' ? Math.min(lit, a) : id === 'b' ? Math.max(0, lit - a) : 0);
  const abs = (id: SlotId, extra?: CSSProperties): CSSProperties => ({ position: 'absolute', ...slotPos(id), ...extra });

  const piece = (id: SlotId) => {
    const p = slots[id];
    if (!p || hidden === id) return null;
    const i = SLOT_ORDER.indexOf(id);
    const cls = celebrate ? 'jump' : id === 'result' && shake ? 'shake' : '';
    return (
      <div
        key={`${id}-${celebrate}-${shake}`}
        className={cls}
        style={abs(id, { animationDelay: celebrate ? `${i * motion.celebrate.staggerMs}ms` : undefined, zIndex: isCardSlot(id) ? 1 : 2 })}
        onPointerDown={(e) => onPiecePointerDown?.(id, e)}
      >
        <PieceView piece={p} lit={litFor(id)} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: EQ.naturalWidth, height: EQ.naturalHeight }}>
      {(['op1', 'op2'] as const).map((id) => (
        <div
          key={id}
          style={abs(id, {
            width: opPiece.diameter, height: opPiece.diameter, borderRadius: '50%', background: colors.hole,
            outline: highlight === id ? `4px dashed ${colors.inkSoft}` : undefined, outlineOffset: 2,
          })}
        />
      ))}
      {(['a', 'b', 'result'] as const).map((id) =>
        slots[id] && hidden !== id ? null : (
          <div key={id + (id === 'result' && built)} className={id === 'result' && built ? 'pulse-once' : ''} style={abs(id, { width: card.width, height: card.height })}>
            <CardShape path={id === 'result' ? answerCard.path : card.path} fill={colors.slotFill} stroke={highlight === id ? colors.inkSoft : colors.slotStroke} dashed />
            {id === 'result' && (
              <div
                style={{
                  position: 'absolute', top: 74, width: '100%', textAlign: 'center', fontSize: 108, fontWeight: 500, lineHeight: 1,
                  color: colors.slotMark, opacity: built ? 1 : 0.4,
                }}
              >
                ?
              </div>
            )}
          </div>
        ),
      )}
      {SLOT_ORDER.map(piece)}
      {ghosts.map((g) => (
        <div key={g.id} className={`ghost-${g.kind}`} style={abs(g.slot, { zIndex: 3, pointerEvents: 'none' })} onAnimationEnd={() => onGhostDone?.(g.id)}>
          <PieceView piece={g.piece} />
        </div>
      ))}
    </div>
  );
}

// ---------- jogo ----------
const pieceKey = (p: Piece) => (p.kind === 'op' ? p.op : `${p.kind}${p.value}`);
const NUMBERS = Array.from({ length: MAX_VALUE + 1 }, (_, v) => ({ kind: 'number', value: v }) as Piece);
const ANSWERS = Array.from({ length: MAX_RESULT - MIN_RESULT + 1 }, (_, i) => ({ kind: 'answer', value: MIN_RESULT + i }) as Piece);
const TRAY_SCALE = { number: tray.cardScale, answer: tray.answers.scale, op: opPiece.trayDiameter / opPiece.diameter };
const OPS: Piece[] = [{ kind: 'op', op: '+' }, { kind: 'op', op: '=' }];
const LIFT = { rot: motion.pickUp.rotate, s: EQ.scale * motion.pickUp.scale };

type Fly = { piece: Piece; x: number; y: number; s: number; rot: number; lifted: boolean };
type Origin = { kind: 'tray' } | { kind: 'slot'; slot: SlotId };
type Drag = { id: number; piece: Piece; origin: Origin; home: Pick<Fly, 'x' | 'y' | 's'>; downX: number; downY: number; downT: number; offX: number; offY: number; moved: boolean };

function Game() {
  const [gs, setGs] = useState<GameState>(initialState);
  const gsRef = useRef(gs);
  const [fly, setFlyState] = useState<Fly | null>(null);
  const flyRef = useRef<Fly | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [dimKey, setDimKey] = useState<string | null>(null);
  const [hiddenSlot, setHiddenSlot] = useState<SlotId | null>(null);
  const [highlight, setHighlight] = useState<SlotId | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [balloon, setBalloon] = useState<{ id: number; text: string; slot: SlotId } | null>(null);
  const [pill, setPill] = useState<'correct' | 'try' | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const [shake, setShake] = useState(0);
  const [lit, setLit] = useState(0);
  const [muted, setMutedState] = useState(audio.isMuted());
  const trayEls = useRef(new Map<string, HTMLElement>());
  const drag = useRef<Drag | null>(null);
  const busy = useRef(false);
  const seq = useRef(0); // incrementa em Recomeçar/Próxima para cancelar sequências em andamento
  const ids = useRef(0);

  const setFly = (f: Fly | null) => {
    flyRef.current = f;
    flushSync(() => setFlyState(f));
  };

  const apply = (action: Parameters<typeof reduce>[1], ghostKind: Ghost['kind'] | null) => {
    const prev = gsRef.current;
    const r = reduce(prev, action);
    if (ghostKind) {
      const gone = SLOT_ORDER.filter((id) => prev.slots[id] && prev.slots[id] !== r.state.slots[id]);
      setGhosts((g) => [...g, ...gone.map((slot) => ({ id: ++ids.current, slot, piece: prev.slots[slot]!, kind: ghostKind }))]);
    }
    gsRef.current = r.state;
    setGs(r.state);
    return r;
  };

  const trayHome = (p: Piece) => {
    const el = trayEls.current.get(pieceKey(p))!;
    const r = el.getBoundingClientRect();
    const c = toStage(r.left + r.width / 2, r.top + r.height / 2);
    return { ...c, s: TRAY_SCALE[p.kind] };
  };

  /** Move a peça voadora até `to`; resolve quando termina. */
  const animateFly = async (to: Partial<Fly>, ms: number, easing: string) => {
    const from = flyRef.current!;
    const next = { ...from, ...to };
    setFly(next);
    const tr = (f: Fly) => `translate(${f.x}px, ${f.y}px)`;
    const inner = (f: Fly) => `translate(-50%, -50%) rotate(${f.rot}deg) scale(${f.s})`;
    const anims = reducedMotion()
      ? [innerRef.current!.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 150 })]
      : [
          outerRef.current!.animate([{ transform: tr(from) }, { transform: tr(next) }], { duration: ms, easing }),
          innerRef.current!.animate([{ transform: inner(from) }, { transform: inner(next) }], { duration: ms, easing }),
        ];
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
  };
  const shakeFly = () =>
    innerRef.current?.animate(
      [0, -8, 8, -8, 0].map((dx) => ({ translate: `${dx}px 0` })),
      { duration: 200 },
    ).finished.catch(() => undefined);
  const fadeFly = () => innerRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.catch(() => undefined);

  const endDrag = () => {
    drag.current = null;
    setFly(null);
    setDimKey(null);
    setHiddenSlot(null);
    setHighlight(null);
    busy.current = false;
  };

  const sayNumber = (n: number, slot: SlotId) => {
    const id = ++ids.current;
    setBalloon({ id, text: numberWords[n], slot });
    const done = audio.speak([`num_${n}`]);
    void done.then(() => setBalloon((b) => (b?.id === id ? null : b)));
    return done;
  };

  const onReject = (reason: string) => {
    if (reason === 'frozen') return;
    audio.sfx('sfx_boing');
    if (reason === 'locked') audio.speak(['vo_monte_primeiro']);
    if (reason === 'zero-zero') audio.speak(['vo_outro_numero']);
  };

  /** Validação e falas depois que a peça encaixou. */
  const afterSnap = async (events: GameEvent[], slot: SlotId, piece: Piece, my: number) => {
    audio.sfx('sfx_clique');
    if (piece.kind === 'op') return void audio.speak([piece.op === '+' ? 'vo_mais' : 'vo_igual']);
    const said = sayNumber(piece.value, slot);
    if (slot !== 'result') return;

    busy.current = true;
    await said;
    if (my !== seq.current) return;
    const { a, b } = gsRef.current.slots;
    const va = a?.kind === 'number' ? a.value : 0;
    const vb = b?.kind === 'number' ? b.value : 0;

    if (events.some((e) => e.type === 'correct')) {
      setCelebrate((k) => k + 1);
      setPill('correct');
      await audio.speak(['sfx_acerto', 'vo_certo', `num_${va}`, 'vo_mais', `num_${vb}`, 'vo_e', `num_${piece.value}`]);
      if (my !== seq.current) return;
      setShowNext(true);
      busy.current = false;
      return;
    }

    const hint = events.some((e) => e.type === 'wrong' && e.hint);
    setShake((k) => k + 1);
    audio.sfx('sfx_ops');
    setPill('try');
    const voice = audio.speak(['vo_ainda_nao']);
    if (hint) {
      await voice;
      for (let k = 1; k <= va + vb; k++) {
        if (my !== seq.current) return;
        setLit(k);
        audio.speak([`num_${k}`]);
        await wait(motion.hintStepMs);
      }
    }
    await wait(motion.wrongReturnDelayMs);
    if (my !== seq.current) return;
    setLit(0);
    setPill(null);
    // a carta volta para a bandeja
    const c = slotCenter('result');
    apply({ type: 'REMOVE', slot: 'result' }, null);
    setFly({ piece, x: c.x, y: c.y, s: EQ.scale, rot: 0, lifted: false });
    await animateFly(trayHome(piece), motion.returnMs, motion.returnEasing);
    if (my !== seq.current) return;
    endDrag();
  };

  /** Solta `piece` em `slot`. Se recusar: `fail` = volta para a origem ou some. */
  const dropAt = async (d: Drag, slot: SlotId | null, fail: 'home' | 'vanish') => {
    busy.current = true;
    const my = seq.current;
    const back = async () => {
      if (fail === 'home') await animateFly({ ...d.home, rot: 0, lifted: false }, motion.returnMs, motion.returnEasing);
      else await fadeFly();
    };
    if (!slot) {
      await back();
    } else {
      const r = reduce(gsRef.current, { type: 'DROP', piece: d.piece, slot });
      const rej = r.events.find((e) => e.type === 'reject');
      if (rej && rej.type === 'reject') {
        onReject(rej.reason);
        await shakeFly();
        await back();
      } else {
        const c = slotCenter(slot);
        await animateFly({ x: c.x, y: c.y, s: EQ.scale, rot: 0, lifted: false }, motion.snapMs, 'ease-out');
        if (my !== seq.current) return;
        const { events } = apply({ type: 'DROP', piece: d.piece, slot }, 'fade');
        endDrag();
        void afterSnap(events, slot, d.piece, my);
        return;
      }
    }
    if (my !== seq.current) return;
    endDrag();
  };

  const targetAt = (p: Piece, x: number, y: number) => {
    const radius = p.kind === 'op' ? snap.opRadius : snap.cardRadius;
    let ok: SlotId | null = null, okD = Infinity, bad: SlotId | null = null, badD = Infinity;
    for (const id of SLOT_ORDER) {
      const c = slotCenter(id);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist > radius) continue;
      if (accepts(id, p)) {
        if (dist < okD) [ok, okD] = [id, dist];
      } else if (dist < badD) [bad, badD] = [id, dist];
    }
    return { ok, bad };
  };

  const start = (e: RPointerEvent, piece: Piece, origin: Origin) => {
    e.preventDefault();
    if (drag.current || busy.current || gsRef.current.phase === 'correct') return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const home = origin.kind === 'tray' ? trayHome(piece) : { ...slotCenter(origin.slot), s: EQ.scale };
    const p = toStage(e.clientX, e.clientY);
    drag.current = { id: e.pointerId, piece, origin, home, downX: p.x, downY: p.y, downT: performance.now(), offX: home.x - p.x, offY: home.y - p.y, moved: false };
    if (origin.kind === 'tray') setDimKey(pieceKey(piece));
    else setHiddenSlot(origin.slot);
    setFly({ piece, ...home, rot: 0, lifted: false });
  };

  // listeners globais com o handler mais recente
  const handlers = useRef({ move: (_e: PointerEvent) => {}, up: (_e: PointerEvent, _cancel: boolean) => {} });
  handlers.current.move = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || busy.current) return;
    const p = toStage(e.clientX, e.clientY);
    if (!d.moved && Math.hypot(p.x - d.downX, p.y - d.downY) < snap.tapMaxMove) return;
    if (!d.moved) {
      d.moved = true;
      audio.sfx('sfx_pega', 0.3);
    }
    const k = LIFT.s / d.home.s;
    const x = p.x + d.offX * k;
    const y = p.y + d.offY * k;
    setFly({ piece: d.piece, x, y, ...LIFT, lifted: true });
    setHighlight(targetAt(d.piece, x, y).ok);
  };
  handlers.current.up = (e, cancel) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id || busy.current) return;
    const tap = !d.moved && performance.now() - d.downT < snap.tapMaxMs;
    setHighlight(null);
    if (cancel || (!d.moved && !tap) || (tap && d.origin.kind === 'slot')) return void dropAt(d, null, 'home');
    if (tap) return void dropAt(d, nextEmptySlot(gsRef.current.slots, d.piece), 'home');

    const f = flyRef.current!;
    const { ok, bad } = targetAt(d.piece, f.x, f.y);
    const target = ok ?? bad;
    if (d.origin.kind === 'tray') return void dropAt(d, target, 'home');
    if (target === d.origin.slot) return void dropAt(d, null, 'home');
    apply({ type: 'REMOVE', slot: d.origin.slot }, null); // retirada: some se não encaixar em outro lugar
    setHiddenSlot(null);
    void dropAt(d, target, 'vanish');
  };
  useEffect(() => {
    const move = (e: PointerEvent) => handlers.current.move(e);
    const up = (e: PointerEvent) => handlers.current.up(e, false);
    const cancel = (e: PointerEvent) => handlers.current.up(e, true);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    return () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
    };
  }, []);

  /** Teclado (Enter/Espaço num botão da bandeja): mesmo que tocar. */
  const keyPlace = (piece: Piece) => {
    if (drag.current || busy.current || gsRef.current.phase === 'correct') return;
    const home = trayHome(piece);
    const d: Drag = { id: -1, piece, origin: { kind: 'tray' }, home, downX: 0, downY: 0, downT: 0, offX: 0, offY: 0, moved: false };
    drag.current = d;
    setDimKey(pieceKey(piece));
    setFly({ piece, ...home, rot: 0, lifted: false });
    void dropAt(d, nextEmptySlot(gsRef.current.slots, piece), 'home');
  };

  const clearAll = (action: 'NEXT' | 'RESET') => {
    seq.current++;
    audio.stopVoice();
    endDrag();
    apply({ type: action }, 'clear');
    setBalloon(null);
    setPill(null);
    setShowNext(false);
    setCelebrate(0);
    setShake(0);
    setLit(0);
  };

  const toggleMute = () => {
    audio.setMuted(!muted);
    setMutedState(!muted);
  };

  const { slots } = gs;
  const mode = trayMode(slots);
  const trayBtn = (p: Piece) => (
    <TrayButton key={pieceKey(p)} piece={p} dim={dimKey === pieceKey(p)} els={trayEls.current} onDown={start} onKey={keyPlace} />
  );
  const words = (id: SlotId) => {
    const p = slots[id];
    return p && p.kind !== 'op' ? numberWords[p.value] : '';
  };
  const sentence = `Certo! ${cap(words('a'))} mais ${words('b')} é ${words('result')}.`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* topo */}
      <div style={{ position: 'absolute', top: 24, right: 32, display: 'flex', gap: 16 }}>
        <RoundButton label={muted ? 'Ligar som' : 'Desligar som'} onClick={toggleMute}>
          <path d={muted ? icons.soundMuted : icons.sound} />
        </RoundButton>
        <RoundButton label="Recomeçar" onClick={() => clearAll('RESET')}>
          <path d={icons.restart} />
        </RoundButton>
      </div>

      {/* área de montagem */}
      <div style={{ position: 'absolute', left: EQ.left, top: EQ.top, transform: `scale(${EQ.scale})`, transformOrigin: '0 0' }}>
        <Equation
          slots={slots}
          highlight={highlight}
          hidden={hiddenSlot}
          lit={lit}
          celebrate={celebrate}
          shake={shake}
          ghosts={ghosts}
          onGhostDone={(id) => setGhosts((g) => g.filter((x) => x.id !== id))}
          onPiecePointerDown={(slot, e) => slots[slot] && start(e, slots[slot]!, { kind: 'slot', slot })}
        />
      </div>

      {balloon && <Balloon text={balloon.text} slot={balloon.slot} />}

      {pill && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 400, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 24px', borderRadius: 999, whiteSpace: 'nowrap', fontSize: font.pill.size, fontWeight: font.pill.weight,
            background: pill === 'correct' ? colors.successBg : colors.tryBg, color: pill === 'correct' ? colors.successInk : colors.tryInk,
          }}
        >
          <svg aria-hidden="true" focusable="false" width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            {pill === 'correct' ? <path d={icons.check} /> : <path d="M7 14 H7.01 M14 14 H14.01 M21 14 H21.01" strokeWidth={5} />}
          </svg>
          {pill === 'correct' ? sentence : 'Ainda não. Conta as bolinhas!'}
        </div>
      )}

      {showNext && (
        <button
          aria-label="Próxima"
          className="next"
          onClick={() => clearAll('NEXT')}
          style={{ position: 'absolute', left: 900, top: 220, width: 88, height: 88, borderRadius: '50%', background: colors.op, boxShadow: `0 6px 0 ${colors.opShadow}`, display: 'grid', placeItems: 'center' }}
        >
          <svg aria-hidden="true" focusable="false" width={44} height={44} viewBox="0 0 36 36" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
            <path d={icons.next} />
          </svg>
        </button>
      )}

      {/* bandeja */}
      <div
        style={{
          position: 'absolute', left: 0, top: tray.top, width: STAGE.width, height: tray.height, background: colors.tray,
          borderRadius: `${tray.radius}px ${tray.radius}px 0 0`,
        }}
      >
        <TrayLayer show={mode === 'build'}>
          <div style={{ width: tray.cardsWidth, display: 'flex', flexWrap: 'wrap', rowGap: tray.rowGap, columnGap: tray.colGap }}>
            {NUMBERS.map(trayBtn)}
          </div>
          <div style={{ width: tray.divider.width, height: tray.divider.height, background: colors.trayDivider, borderRadius: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: tray.opsGap }}>{OPS.map(trayBtn)}</div>
        </TrayLayer>
        <TrayLayer show={mode === 'answers'}>
          <div style={{ width: tray.answers.width, display: 'flex', flexWrap: 'wrap', rowGap: tray.answers.rowGap, columnGap: tray.answers.colGap }}>
            {ANSWERS.map(trayBtn)}
          </div>
        </TrayLayer>
      </div>

      {/* peça arrastada / voando */}
      {fly && (
        <div ref={outerRef} style={{ position: 'absolute', left: 0, top: 0, zIndex: 100, pointerEvents: 'none', transform: `translate(${fly.x}px, ${fly.y}px)` }}>
          <div
            ref={innerRef}
            style={{
              width: 'max-content', transform: `translate(-50%, -50%) rotate(${fly.rot}deg) scale(${fly.s})`,
              transition: fly.lifted ? `transform ${motion.pickUp.ms}ms` : undefined, filter: fly.lifted ? motion.dragShadow : undefined,
            }}
          >
            <PieceView piece={fly.piece} />
          </div>
        </div>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Um conjunto da bandeja; os dois ficam empilhados e trocam com cross-fade. Oculto = invisível para toque e leitor de tela. */
function TrayLayer({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: tray.groupGap,
        opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden', transition: `opacity ${tray.fadeMs}ms, visibility ${tray.fadeMs}ms`,
      }}
    >
      {children}
    </div>
  );
}

function TrayButton({ piece, dim, els, onDown, onKey }: {
  piece: Piece; dim: boolean; els: Map<string, HTMLElement>;
  onDown: (e: RPointerEvent, p: Piece, o: Origin) => void; onKey: (p: Piece) => void;
}) {
  const key = pieceKey(piece);
  const isCard = piece.kind !== 'op';
  const s = TRAY_SCALE[piece.kind];
  return (
    <button
      ref={(el) => void (el ? els.set(key, el) : els.delete(key))}
      aria-label={piece.kind === 'op' ? opPiece.glyphs[piece.op].label : `${piece.kind === 'answer' ? 'Resposta' : 'Carta'} ${piece.value}`}
      onPointerDown={(e) => onDown(e, piece, { kind: 'tray' })}
      onClick={(e) => e.detail === 0 && onKey(piece)}
      style={{
        width: isCard ? card.width * s : opPiece.trayDiameter,
        height: isCard ? (card.height + card.shadowOffset) * s : opPiece.trayDiameter + 6,
        opacity: dim ? 0.3 : 1, padding: 0, display: 'block',
      }}
    >
      {isCard ? (
        <div style={{ transform: `scale(${s})`, transformOrigin: '0 0' }}>
          <PieceView piece={piece} />
        </div>
      ) : (
        <OpPiece op={piece.op} size={opPiece.trayDiameter} glyph={opPiece.trayGlyphSize} shadow={6} />
      )}
    </button>
  );
}

function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{ width: 56, height: 56, borderRadius: '50%', background: colors.button, boxShadow: `0 4px 0 ${colors.buttonShadow}`, display: 'grid', placeItems: 'center' }}
    >
      <svg aria-hidden="true" focusable="false" width={28} height={28} viewBox="0 0 28 28" fill="none" stroke={colors.ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function Balloon({ text, slot }: { text: string; slot: SlotId }) {
  const left = EQ.left + (slotPos(slot).left + card.width) * EQ.scale + 12;
  const top = EQ.top + (card.height / 3) * EQ.scale;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', left, top, transform: 'translateY(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 10,
        background: '#fff', borderRadius: 28, padding: '14px 24px', boxShadow: `0 6px 0 ${colors.buttonShadow}`,
        fontSize: font.speech.size, fontWeight: font.speech.weight, color: colors.ink, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}
    >
      <svg aria-hidden="true" focusable="false" width={30} height={30} viewBox="0 0 28 28" fill="none" stroke={colors.speechIcon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={icons.sound} />
      </svg>
      “{text}”
    </div>
  );
}
