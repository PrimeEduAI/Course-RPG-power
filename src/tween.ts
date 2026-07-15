// 極簡 tween:免依賴 gsap
export type Ease = (t: number) => number;

export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Ease = (t) => t * t * t;
export const linear: Ease = (t) => t;

interface Tween {
  t: number;
  dur: number;
  ease: Ease;
  onUpdate: (k: number) => void;
  onDone?: () => void;
}

const active: Tween[] = [];

export function tween(
  dur: number,
  onUpdate: (k: number) => void,
  opts: { ease?: Ease; onDone?: () => void; delay?: number } = {}
) {
  const tw: Tween = { t: -(opts.delay ?? 0), dur, ease: opts.ease ?? easeOutCubic, onUpdate, onDone: opts.onDone };
  active.push(tw);
}

export function updateTweens(dt: number) {
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate(tw.ease(k));
    if (k >= 1) {
      active.splice(i, 1);
      tw.onDone?.();
    }
  }
}
