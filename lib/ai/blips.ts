"use client";

/**
 * v6 arcade blips — synthesised at runtime, no audio files, no licences.
 * A short square-wave chirp per typed character, a longer pause-tick at
 * punctuation. AudioContext only exists after a user gesture (the Ask
 * submit), so autoplay policies are satisfied by construction.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One 8-bit chirp. Freq varies slightly per char so text doesn't drone. */
export function blip(punctuation = false): void {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "square";
    osc.frequency.value = punctuation ? 220 : 880 + Math.random() * 240;
    const t = ac.currentTime;
    const dur = punctuation ? 0.09 : 0.035;
    gain.gain.setValueAtTime(0.028, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch {
    /* audio blocked — silence is fine */
  }
}
