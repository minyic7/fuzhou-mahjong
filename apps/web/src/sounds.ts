// Web Audio API sound engine — synthesized sounds, no external files

const MUTE_KEY = "fuzhou-mahjong-muted";

let audioCtx: AudioContext | null = null;
let muted = typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "true";

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  // Resume suspended context (mobile browsers require user-gesture activation)
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, String(m)); } catch { /* SSR / private mode */ }
}
export function isMuted() { return muted; }

function playTone(freq: number, duration: number, type: OscillatorType = "sine", volume = 0.3) {
  if (muted) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playNoise(duration: number, volume = 0.15) {
  if (muted) return;
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

export const sounds = {
  discard() {
    // Short clack — like tile hitting table
    playTone(800, 0.08, "square", 0.2);
    setTimeout(() => playTone(400, 0.06, "square", 0.15), 30);
  },

  draw() {
    // Soft slide
    playTone(600, 0.1, "sine", 0.1);
    playTone(900, 0.08, "sine", 0.08);
  },

  peng() {
    // Sharp double tap
    playTone(500, 0.1, "square", 0.25);
    setTimeout(() => playTone(700, 0.1, "square", 0.25), 100);
  },

  chi() {
    // Quick ascending sequence
    playTone(400, 0.08, "triangle", 0.2);
    setTimeout(() => playTone(500, 0.08, "triangle", 0.2), 60);
    setTimeout(() => playTone(600, 0.08, "triangle", 0.2), 120);
  },

  gang() {
    // Heavy thud
    playTone(200, 0.15, "square", 0.3);
    playNoise(0.1, 0.2);
  },

  hu() {
    // Victory fanfare — ascending chord
    playTone(523, 0.3, "triangle", 0.2);  // C
    setTimeout(() => playTone(659, 0.3, "triangle", 0.2), 100);  // E
    setTimeout(() => playTone(784, 0.3, "triangle", 0.2), 200);  // G
    setTimeout(() => playTone(1047, 0.5, "triangle", 0.25), 300); // C5
  },

  gameStart() {
    // Shuffle sound — noise burst
    playNoise(0.3, 0.1);
    setTimeout(() => playNoise(0.2, 0.08), 200);
  },

  yourTurn() {
    // Gentle notification
    playTone(880, 0.15, "sine", 0.15);
    setTimeout(() => playTone(1100, 0.12, "sine", 0.12), 100);
  },

  claim() {
    // Alert — something available
    playTone(660, 0.1, "triangle", 0.2);
    setTimeout(() => playTone(880, 0.12, "triangle", 0.2), 80);
  },

  goldFlip() {
    // Shimmering reveal — ascending sparkle
    playTone(1200, 0.12, "sine", 0.15);
    setTimeout(() => playTone(1500, 0.1, "sine", 0.18), 80);
    setTimeout(() => playTone(1800, 0.15, "sine", 0.12), 160);
  },

  gameDraw() {
    // Flat, deflating tone — descending notes
    playTone(500, 0.2, "triangle", 0.15);
    setTimeout(() => playTone(400, 0.2, "triangle", 0.12), 150);
    setTimeout(() => playTone(300, 0.3, "triangle", 0.1), 300);
  },

  error() {
    // Low buzz — something went wrong
    playTone(150, 0.2, "sawtooth", 0.15);
  },

  warning() {
    // Gentle two-tone alert — low wall count
    playTone(880, 0.1, "sine", 0.12);
    setTimeout(() => playTone(660, 0.12, "sine", 0.1), 120);
  },

  buttonTap() {
    playTone(600, 0.04, "sine", 0.1);
  },

  confirm() {
    playTone(800, 0.08, "sine", 0.12);
    setTimeout(() => playTone(1000, 0.06, "sine", 0.1), 60);
  },

  toggle() {
    playTone(500, 0.05, "triangle", 0.08);
  },
};
