// Encaixa Conta — design tokens. Todas as medidas em px no espaço de design de 1194×834.

export const STAGE = { width: 1194, height: 834 } as const;

export const MAX_VALUE = 10;

export const colors = {
  bg: '#FFF6E9',
  ink: '#2A2238',
  inkSoft: '#5E5468',
  tray: '#F3E4CC',
  trayDivider: '#E2CFB0',
  slotFill: '#FFFDF8',
  slotStroke: '#9C8F7C',
  slotMark: '#7A6F60',
  hole: '#EADCC6',
  op: '#22304F',
  opShadow: '#121B30',
  button: '#FFFFFF',
  buttonShadow: '#E3D5BF',
  speechIcon: '#2F5FB3',
  successBg: '#DDF3E1',
  successInk: '#1C5B2A',
  tryBg: '#FDE8D4',
  tryInk: '#7A3A0B',
  hintRing: '#FFD35C',
  dot: '#FFFFFF',
  dotEmptyRing: 'rgba(255,255,255,0.55)',
} as const;

/** Cor de preenchimento de cada número (índice = valor). */
export const numberColors = [
  '#64748B', // 0
  '#E5484D', // 1
  '#D9620A', // 2
  '#B88400', // 3
  '#3E9B3E', // 4
  '#1E9A8A', // 5
  '#2F7DD1', // 6
  '#5B5BD6', // 7
  '#8E4EC6', // 8
  '#D6409F', // 9
  '#9A5B2E', // 10
] as const;

/** Cor da "espessura" da carta: cada canal RGB × 0.72. */
export function shadeOf(hex: string, factor = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * factor);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export const font = {
  family: "'Fredoka', system-ui, sans-serif",
  cardNumber: { size: 108, weight: 600 },
  playButton: { size: 64, weight: 600 },
  speech: { size: 30, weight: 500 },
  pill: { size: 24, weight: 500 },
} as const;

export const card = {
  width: 200,
  height: 260,
  shadowOffset: 6,
  cornerRadius: 24,
  notchRadius: 38,
  notchCenterY: 130,
  numberTop: 18,
  dotsBox: { left: 36, top: 146, width: 128, height: 100 },
  /** Contorno com cantos de raio 24 e recortes côncavos de raio 38 nas duas laterais. */
  path:
    'M24,0 H176 A24,24 0 0 1 200,24 V92 A38,38 0 0 0 200,168 V236 A24,24 0 0 1 176,260 ' +
    'H24 A24,24 0 0 1 0,236 V168 A38,38 0 0 0 0,92 V24 A24,24 0 0 1 24,0 Z',
} as const;

export const slot = {
  strokeWidth: 4,
  dash: '14 10',
  markTop: 74,
  lockedMarkOpacity: 0.4,
} as const;

export const opPiece = {
  diameter: 74, // no buraco da conta (raio 37 dentro do recorte de raio 38)
  trayDiameter: 88,
  glyphSize: 40,
  trayGlyphSize: 44,
  glyphStroke: 6,
  shadow: `0 5px 0 ${'#121B30'}`,
  glyphs: {
    '+': { path: 'M18 6 V30 M6 18 H30', label: 'mais' },
    '=': { path: 'M7 12 H29 M7 24 H29', label: 'igual' },
    // v2
    '−': { path: 'M7 18 H29', label: 'menos' },
    '×': { path: 'M9 9 L27 27 M27 9 L9 27', label: 'vezes' },
    '÷': { path: 'M7 18 H29', label: 'dividido por', dots: [[18, 7], [18, 29]] as const },
  },
} as const;

/** Fileira da conta no espaço natural (600×266), renderizada com escala 0.9. */
export const equation = {
  naturalWidth: 600,
  naturalHeight: 266,
  scale: 0.9,
  left: 327,
  top: 145,
  slotX: { a: 0, b: 200, result: 400 },
  /** x da emenda onde fica cada buraco de símbolo. */
  seamX: { op1: 200, op2: 400 },
} as const;

export const tray = {
  top: 450,
  height: 384,
  radius: 40,
  cardScale: 0.6, // carta 120×160
  cardsWidth: 790,
  rowGap: 16,
  colGap: 14,
  groupGap: 48,
  opsGap: 32,
  divider: { width: 3, height: 280 },
} as const;

export const topBar = { top: 24, right: 32, gap: 16, buttonSize: 56, iconSize: 28 } as const;

export const icons = {
  sound: 'M4 11 V17 H9 L15 22 V6 L9 11 Z M19 10 Q22 14 19 18 M22 7 Q27 14 22 21',
  soundMuted: 'M4 11 V17 H9 L15 22 V6 L9 11 Z M19 11 L25 17 M25 11 L19 17',
  restart: 'M6 14 A8 8 0 1 0 9 7.8 M9 3 V8 H4',
  check: 'M6 14.5 L11.5 20 L22 8.5',
  next: 'M8 18 H28 M20 10 L28 18 L20 26', // viewBox 36
  play: 'M16 9 L42 26 L16 43 Z', // viewBox 52
} as const;

export const snap = { cardRadius: 140, opRadius: 90, tapMaxMove: 8, tapMaxMs: 250 } as const;

export const motion = {
  pickUp: { ms: 120, rotate: -6, scale: 0.94 },
  dragShadow: 'drop-shadow(0 22px 18px rgba(42,34,56,0.28))',
  snapMs: 180,
  returnMs: 250,
  returnEasing: 'cubic-bezier(.2,.8,.2,1)',
  shake: { px: 10, cycles: 3, ms: 300 },
  wrongReturnDelayMs: 600,
  celebrate: { scale: 1.08, ms: 220, staggerMs: 60 },
  clearMs: 250,
  hintStepMs: 600,
  nextPulseMs: 1200,
} as const;

/** Padrão "dado": células [coluna, linha] numa grade 3×3. */
export const DICE_CELLS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
  7: [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]],
  8: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  9: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
};

export interface Dot { x: number; y: number; size: number; filled: boolean }

/** Posições das bolinhas, relativas à área de 128×100 da carta. */
export function dotsFor(n: number, layout: 'dice' | 'row' = 'dice'): Dot[] {
  if (layout === 'row' || n === 10) {
    const out: Dot[] = [];
    for (let k = 0; k < 10; k++) {
      const filled = k < n;
      if (!filled && layout !== 'row') continue;
      out.push({ x: (k % 5) * 26.5, y: k < 5 ? 22 : 58, size: 22, filled });
    }
    return out;
  }
  const cx = [20, 64, 108];
  const cy = [16, 50, 84];
  return (DICE_CELLS[n] ?? []).map(([c, r]) => ({ x: cx[c] - 13, y: cy[r] - 13, size: 26, filled: true }));
}

export const numberWords = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'] as const;
