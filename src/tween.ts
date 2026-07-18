// 極簡 tween:免依賴 gsap
export type Ease = (t: number) => number;

export const easeOutBack: Ease = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Ease = (t) => t * t * t;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const linear: Ease = (t) => t;

interface Tween {
  t: number;
  dur: number;
  ease: Ease;
  onUpdate: (k: number) => void;
  onDone?: () => void;
  onCancel?: () => void;
  cancelled: boolean;
}

/** tween 控制把手:cancel 後不再更新、不觸發 onDone */
export interface TweenHandle {
  cancel(): void;
  readonly cancelled: boolean;
}

const active: Tween[] = [];

export function tween(
  dur: number,
  onUpdate: (k: number) => void,
  opts: { ease?: Ease; onDone?: () => void; onCancel?: () => void; delay?: number } = {}
): TweenHandle {
  const tw: Tween = {
    t: -(opts.delay ?? 0),
    dur,
    ease: opts.ease ?? easeOutCubic,
    onUpdate,
    onDone: opts.onDone,
    onCancel: opts.onCancel,
    cancelled: false,
  };
  active.push(tw);
  return {
    cancel: () => { tw.cancelled = true; },
    get cancelled() { return tw.cancelled; },
  };
}

export function updateTweens(dt: number) {
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i];
    if (tw.cancelled) {
      active.splice(i, 1);
      tw.onCancel?.();
      continue;
    }
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate(tw.ease(k));
    if (k >= 1) {
      active.splice(i, 1);
      if (!tw.cancelled) tw.onDone?.();
    }
  }
}

/**
 * animation token:同一個 key 的新動畫會使舊 token 失效。
 * 用法:const tok = tokens.next("cape"); ... if (!tok.alive) return;
 */
export class TokenSource {
  private current = new Map<string, { alive: boolean; handles: TweenHandle[] }>();

  /** 取得新 token,同時取消同 key 的舊 token 與其掛載的 tween */
  next(key: string): AnimToken {
    const prev = this.current.get(key);
    if (prev) {
      prev.alive = false;
      for (const h of prev.handles) h.cancel();
    }
    const state = { alive: true, handles: [] as TweenHandle[] };
    this.current.set(key, state);
    return {
      get alive() { return state.alive; },
      track(h: TweenHandle) { state.handles.push(h); return h; },
    };
  }
}

export interface AnimToken {
  readonly alive: boolean;
  /** 登記 tween,token 失效時自動 cancel */
  track(h: TweenHandle): TweenHandle;
}
