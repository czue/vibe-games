// Tiny synthesized sound effects — no audio files needed.
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur: number, vol: number, cutoff = 900): void {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

export const sfx = {
  jump: () => tone(280, 720, 0.18, 'sine', 0.15),
  gulp: () => {
    tone(520, 140, 0.12, 'sine', 0.25);
    tone(300, 80, 0.15, 'triangle', 0.2, 0.08);
  },
  chomp: () => tone(260, 180, 0.08, 'square', 0.05),
  spit: () => tone(180, 900, 0.12, 'square', 0.08),
  splat: () => {
    noise(0.35, 0.5, 600);
    tone(220, 40, 0.35, 'sawtooth', 0.15);
  },
  hurt: () => tone(620, 180, 0.25, 'square', 0.1),
  heal: () => [660, 880, 1100].forEach((f, i) => tone(f, f, 0.12, 'sine', 0.15, i * 0.09)),
  boing: () => tone(140, 620, 0.3, 'sine', 0.2),
  tooBig: () => tone(220, 140, 0.25, 'triangle', 0.18),
  thud: () => tone(130, 40, 0.2, 'sine', 0.3),
  stomp: () => {
    noise(0.5, 0.6, 300);
    tone(90, 30, 0.5, 'sine', 0.5);
  },
  pop: () => {
    noise(0.2, 0.4, 3000);
    tone(900, 100, 0.3, 'square', 0.1);
  },
  honk: () => {
    tone(392, 392, 0.18, 'square', 0.07);
    tone(330, 330, 0.18, 'square', 0.07);
    tone(392, 392, 0.25, 'square', 0.07, 0.22);
    tone(330, 330, 0.25, 'square', 0.07, 0.22);
  },
  rumble: () => {
    noise(1.2, 0.5, 180);
    tone(60, 35, 1.0, 'sine', 0.3);
  },
  levelUp: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.01, 0.25, 'triangle', 0.2, i * 0.12)),
};
