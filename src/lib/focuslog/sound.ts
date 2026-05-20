// Tiny WebAudio beep — no asset required.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function beep(opts: { freq?: number; durMs?: number; volume?: number; count?: number } = {}) {
  const { freq = 880, durMs = 180, volume = 0.18, count = 1 } = opts;
  const ac = getCtx();
  if (!ac) return;
  try { void ac.resume(); } catch { /* ignore */ }
  for (let i = 0; i < count; i++) {
    const t0 = ac.currentTime + i * (durMs / 1000 + 0.08);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.02);
  }
}
