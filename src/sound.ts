// WebAudio 合成音效:無音檔
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(freq: number, at: number, dur = 0.18, type: OscillatorType = "triangle", gain = 0.12) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

/** 裝備出場亮相:上行琶音 */
export function playReveal() {
  note(523, 0, 0.12, "sine", 0.09);
  note(659, 0.08, 0.12, "sine", 0.09);
  note(784, 0.16, 0.28, "sine", 0.1);
  note(1047, 0.26, 0.4, "triangle", 0.08);
}

/** 穿裝備:叮-叮! */
export function playEquip() {
  note(784, 0);        // G5
  note(1175, 0.09, 0.3); // D6
}

/** 卸下裝備 */
export function playUnequip() {
  note(523, 0, 0.12, "sine", 0.08);
  note(392, 0.08, 0.2, "sine", 0.08);
}

/** 點亮天賦:星星琶音 */
export function playTalent() {
  note(659, 0, 0.15, "sine");
  note(880, 0.08, 0.15, "sine");
  note(1319, 0.16, 0.35, "sine");
}

/** 升級! */
export function playLevelUp() {
  [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.1, 0.25, "triangle", 0.14));
}
