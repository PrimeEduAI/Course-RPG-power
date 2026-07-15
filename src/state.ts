// localStorage 進度:六小時課程中途重整不掉進度
const KEY = "ai-video-quest-v1";

export interface Progress {
  equips: string[];
  talents: string[];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.equips) && Array.isArray(p.talents)) return p;
    }
  } catch { /* 壞資料就重來 */ }
  return { equips: [], talents: [] };
}

export function saveProgress(p: Progress) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function resetProgress() {
  localStorage.removeItem(KEY);
}
