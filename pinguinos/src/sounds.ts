// Procedural sound effects using Web Audio API — no audio files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  fadeOut = true,
): void {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, c.currentTime);
  gain.gain.setValueAtTime(volume, c.currentTime);
  if (fadeOut) {
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  }
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function playNoise(duration: number, volume = 0.15): void {
  const c = getCtx();
  const bufferSize = c.sampleRate * duration;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  source.connect(gain);
  gain.connect(c.destination);
  source.start();
}

export function playJump(): void {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(250, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.15);
  gain.gain.setValueAtTime(0.2, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.2);
}

export function playLand(): void {
  playNoise(0.12, 0.12);
  playTone(120, 0.1, 'sine', 0.15);
}

export function playKeyPickup(): void {
  // Happy ascending chime
  playTone(523, 0.15, 'sine', 0.25);  // C5
  setTimeout(() => playTone(659, 0.15, 'sine', 0.25), 100);  // E5
  setTimeout(() => playTone(784, 0.3, 'sine', 0.25), 200);   // G5
}

export function playBoulderSlide(): void {
  // Low rumble
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(60, c.currentTime);
  osc.frequency.linearRampToValueAtTime(40, c.currentTime + 1.5);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 1.0);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 1.5);
  playNoise(1.5, 0.08);
}

export function playPortalEnter(): void {
  // Descending magical swirl
  const c = getCtx();
  for (let i = 0; i < 5; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    const startFreq = 800 - i * 100;
    osc.frequency.setValueAtTime(startFreq, c.currentTime + i * 0.15);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, c.currentTime + i * 0.15 + 0.3);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.setValueAtTime(0.15, c.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.15 + 0.3);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + i * 0.15);
    osc.stop(c.currentTime + i * 0.15 + 0.3);
  }
}

export function playEarthquake(): void {
  // Deep rumbling
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(35, c.currentTime);
  gain.gain.setValueAtTime(0.2, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, c.currentTime + 1.5);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 3.0);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 3.0);
  playNoise(3.0, 0.15);
}

export function playAirJump(): void {
  // Softer, higher pitched poof
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.15, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.15);
  playNoise(0.08, 0.1);
}

export function playWaddleStep(): void {
  playTone(180 + Math.random() * 40, 0.06, 'sine', 0.06);
}

export function playSave(): void {
  playTone(440, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(554, 0.15, 'sine', 0.15), 80);
}

export function playLoad(): void {
  playTone(554, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(440, 0.15, 'sine', 0.15), 80);
}
