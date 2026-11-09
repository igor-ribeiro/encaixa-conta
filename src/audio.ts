const VOICE = [
  ...Array.from({ length: 21 }, (_, i) => `num_${i}`),
  'vo_intro', 'vo_mais', 'vo_igual', 'vo_e', 'vo_certo', 'vo_ainda_nao', 'vo_monte_primeiro', 'vo_outro_numero',
];
const SFX = ['sfx_pega', 'sfx_clique', 'sfx_boing', 'sfx_acerto', 'sfx_ops'];
export const AUDIO_FILES = [...VOICE, ...SFX];

const MUTE_KEY = 'encaixa-conta:muted';
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* sem storage: padrão com som */
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<string, AudioBuffer>();

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 1;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignora */
  }
}

/** Placeholder (beeps) para arquivos que faltam: [freq Hz, duração s] por nota. */
const BEEPS: Record<string, [number, number][]> = {
  sfx_pega: [[880, 0.05]],
  sfx_clique: [[1400, 0.04]],
  sfx_boing: [[300, 0.12], [200, 0.18]],
  sfx_acerto: [[523, 0.1], [659, 0.1], [784, 0.2]],
  sfx_ops: [[392, 0.12], [330, 0.2]],
};
function beep(c: AudioContext, name: string): AudioBuffer {
  const notes = BEEPS[name] ?? [[440 + (name.length * 37) % 400, 0.25]];
  const total = notes.reduce((t, [, d]) => t + d, 0);
  const buf = c.createBuffer(1, Math.ceil(total * c.sampleRate), c.sampleRate);
  const data = buf.getChannelData(0);
  let i = 0;
  for (const [f, d] of notes) {
    const len = Math.floor(d * c.sampleRate);
    for (let k = 0; k < len && i < data.length; k++, i++) {
      data[i] = 0.3 * Math.sin((2 * Math.PI * f * k) / c.sampleRate) * Math.min(1, (len - k) / 400);
    }
  }
  return buf;
}

/** Chamar dentro do handler de toque do "Jogar" (regra do iOS). */
export function unlock(): Promise<void> {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  void ctx.resume();
  const c = ctx;
  return Promise.all(
    AUDIO_FILES.filter((n) => !buffers.has(n)).map(async (name) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}audio/${name}.m4a`);
        if (!res.ok) throw new Error(res.statusText);
        buffers.set(name, await c.decodeAudioData(await res.arrayBuffer()));
      } catch {
        buffers.set(name, beep(c, name));
      }
    }),
  ).then(() => undefined);
}

function play(name: string, when: number, gain = 1): AudioBufferSourceNode | null {
  const buf = buffers.get(name);
  if (!ctx || !master || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(when);
  return src;
}

export function sfx(name: string, gain = 1) {
  if (ctx) play(name, ctx.currentTime, gain);
}

// Fila única de voz: uma fala nova interrompe a anterior.
let voice: AudioBufferSourceNode[] = [];
let voiceToken = 0;

/** Toca a sequência; resolve `true` quando termina ou `false` se foi interrompida. */
export function speak(names: string[]): Promise<boolean> {
  voice.forEach((s) => s.stop());
  voice = [];
  const token = ++voiceToken;
  if (!ctx) return Promise.resolve(true);
  let t = ctx.currentTime + 0.02;
  for (const n of names) {
    const src = play(n, t);
    if (src) voice.push(src);
    t += buffers.get(n)?.duration ?? 0;
  }
  const ms = (t - ctx.currentTime) * 1000;
  return new Promise((resolve) => setTimeout(() => resolve(token === voiceToken), ms));
}

export const stopVoice = () => void speak([]);
