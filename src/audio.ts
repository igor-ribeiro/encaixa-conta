const NUMBERS = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "catorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
  "vinte",
];
const TEXT: Record<string, string> = {
  ...Object.fromEntries(NUMBERS.map((w, i) => [`num_${i}`, w])),
  vo_intro: "Vamos encaixar a conta?",
  vo_mais: "mais",
  vo_igual: "igual",
  vo_e: "é",
  vo_certo: "Certo!",
  vo_ainda_nao: "Ainda não. Conta as bolinhas!",
  vo_monte_primeiro: "Primeiro monte a conta!",
  vo_outro_numero: "Escolhe outro número!",
};
const SFX = ["sfx_pega", "sfx_clique", "sfx_boing", "sfx_acerto", "sfx_ops"];

const MUTE_KEY = "encaixa-conta:muted";
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === "1";
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
  if (m) tts?.cancel();
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {
    /* ignora */
  }
}

/** Efeitos sintetizados: [freq Hz, duração s] por nota. */
const BEEPS: Record<string, [number, number][]> = {
  sfx_pega: [[880, 0.05]],
  sfx_clique: [[1400, 0.04]],
  sfx_boing: [
    [300, 0.12],
    [200, 0.18],
  ],
  sfx_acerto: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.2],
  ],
  sfx_ops: [
    [392, 0.12],
    [330, 0.2],
  ],
};
function beep(c: AudioContext, name: string): AudioBuffer {
  const notes = BEEPS[name] ?? [[440 + ((name.length * 37) % 400), 0.25]];
  const total = notes.reduce((t, [, d]) => t + d, 0);
  const buf = c.createBuffer(1, Math.ceil(total * c.sampleRate), c.sampleRate);
  const data = buf.getChannelData(0);
  let i = 0;
  for (const [f, d] of notes) {
    const len = Math.floor(d * c.sampleRate);
    for (let k = 0; k < len && i < data.length; k++, i++) {
      data[i] =
        0.3 *
        Math.sin((2 * Math.PI * f * k) / c.sampleRate) *
        Math.min(1, (len - k) / 400);
    }
  }
  return buf;
}

const tts = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
let ptVoice: SpeechSynthesisVoice | undefined;
// A API não informa o gênero da voz: escolhemos pelo nome (Apple, Google, Microsoft).
// ponytail: lista de nomes fixa; se aparecer voz nova, adicionar aqui.
const FEMALE =
  /luciana|joana|francisca|maria|thalita|leila|manuela|brenda|elza|giovanna|leticia|yara|google/i;
const pickVoice = () => {
  const pt =
    tts
      ?.getVoices()
      .filter((v) =>
        v.lang.replace("_", "-").toLowerCase().startsWith("pt-br"),
      ) ?? [];
  ptVoice = pt.find((v) => FEMALE.test(v.name)) ?? pt[0];
};
tts?.addEventListener?.("voiceschanged", pickVoice);

/** Chamar dentro do handler de toque do "Jogar" (regra do iOS). */
export function unlock(): Promise<void> {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  void ctx.resume();
  for (const n of SFX) if (!buffers.has(n)) buffers.set(n, beep(ctx, n));
  // iOS só libera a fala se o 1º speak() acontecer dentro do toque.
  tts?.speak(new SpeechSynthesisUtterance(""));
  pickVoice();
  return Promise.resolve();
}

function play(
  name: string,
  when: number,
  gain = 1,
): AudioBufferSourceNode | null {
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
let voiceToken = 0;

/** Fala a sequência (sfx_* tocam antes); resolve `true` quando termina ou `false` se foi interrompida. */
export function speak(names: string[]): Promise<boolean> {
  const token = ++voiceToken;
  tts?.cancel();
  let lead = 0;
  for (const n of names.filter((n) => n.startsWith("sfx_"))) {
    sfx(n);
    lead += buffers.get(n)?.duration ?? 0;
  }
  const text = names
    .map((n) => TEXT[n])
    .filter(Boolean)
    .join(" ");
  if (!tts || !text || muted) return Promise.resolve(true);
  return new Promise((resolve) => {
    setTimeout(() => {
      if (token !== voiceToken) return resolve(false);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      if (ptVoice) u.voice = ptVoice;
      u.rate = 0.9;
      u.onend = u.onerror = () => resolve(token === voiceToken);
      tts.speak(u);
    }, lead * 1000);
  });
}

export const stopVoice = () => void speak([]);
