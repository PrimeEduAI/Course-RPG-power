// 課程內容的儲存層:編輯器存 localStorage,冒險頁讀取(無自訂時用預設)
import {
  DEFAULT_CONTENT, MODELS,
  type ContentData, type TalentNode, type EquipItem, type Chapter,
} from "./content.ts";

export const CONTENT_KEY = "ai-video-quest-content-v1";

function sanitize(raw: any): ContentData | null {
  if (!raw || !Array.isArray(raw.chapters) || !Array.isArray(raw.talents) || typeof raw.branches !== "object") return null;
  const chapters: Chapter[] = raw.chapters.map((c: any, i: number) => ({
    id: String(c?.id ?? `ch-${i}`),
    title: String(c?.title ?? ""),
    items: (Array.isArray(c?.items) ? c.items : []).map((it: any, j: number): EquipItem => ({
      id: String(it?.id ?? `item-${i}-${j}`),
      icon: String(it?.icon ?? "⭐"),
      name: String(it?.name ?? ""),
      knowledge: String(it?.knowledge ?? ""),
      model: MODELS[it?.model] ? String(it.model) : "badge",
    })),
  }));
  const talents: TalentNode[] = raw.talents
    .map((t: any, i: number): TalentNode => ({
      id: String(t?.id ?? `t-${i}`),
      icon: String(t?.icon ?? "✨"),
      name: String(t?.name ?? ""),
      desc: String(t?.desc ?? ""),
      branch: ["root", "color", "shot", "rhythm"].includes(t?.branch) ? t.branch : "color",
    }));
  return {
    chapters,
    talents,
    branches: {
      color: String(raw.branches.color ?? DEFAULT_CONTENT.branches.color),
      shot: String(raw.branches.shot ?? DEFAULT_CONTENT.branches.shot),
      rhythm: String(raw.branches.rhythm ?? DEFAULT_CONTENT.branches.rhythm),
    },
  };
}

export function loadContent(): ContentData {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) {
      const parsed = sanitize(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch { /* 壞資料回預設 */ }
  return structuredClone(DEFAULT_CONTENT);
}

export function saveContent(data: ContentData) {
  localStorage.setItem(CONTENT_KEY, JSON.stringify(data));
}

export function resetContent() {
  localStorage.removeItem(CONTENT_KEY);
}

// ---------------- 衍生資料 ----------------

export function allItems(c: ContentData): EquipItem[] {
  return c.chapters.flatMap((ch) => ch.items);
}

export function totalExp(c: ContentData): number {
  return allItems(c).length + c.talents.length;
}

export const TITLES = [
  "Lv.1 新手冒險者",
  "Lv.2 見習冒險者",
  "Lv.3 勇敢冒險者",
  "Lv.4 見習導演",
  "Lv.5 AI 大導演 🎉",
];

const TITLE_FRACTIONS = [0, 0.2, 0.45, 0.7, 1];

export function levelFor(exp: number, total: number): string {
  if (total <= 0) return TITLES[0];
  let title = TITLES[0];
  TITLES.forEach((t, i) => {
    if (exp >= Math.max(i, Math.round(TITLE_FRACTIONS[i] * total))) title = t;
  });
  return title;
}

// ---------------- 技能樹自動排版(直式側欄,SVG viewBox 360x740) ----------------

export const TREE_VIEWBOX = { w: 360, h: 740 };

export interface PositionedTalent {
  node: TalentNode;
  x: number;
  y: number;
  parentId?: string;
}

const BRANCH_X: Record<string, number[]> = {
  color: [62, 52, 72, 58],
  shot: [180, 180, 180, 180],
  rhythm: [298, 308, 288, 302],
};

export function talentLayout(c: ContentData): PositionedTalent[] {
  const out: PositionedTalent[] = [];
  const root = c.talents.find((t) => t.branch === "root");
  if (root) out.push({ node: root, x: 180, y: 668 });
  for (const b of ["color", "shot", "rhythm"] as const) {
    const nodes = c.talents.filter((t) => t.branch === b);
    nodes.forEach((n, i) => {
      // 由下往上長:第一節點靠近根,越後面越高
      const y = nodes.length === 1 ? 350 : 540 - i * (410 / (nodes.length - 1));
      out.push({
        node: n,
        x: BRANCH_X[b][i % BRANCH_X[b].length],
        y,
        parentId: i === 0 ? root?.id : nodes[i - 1].id,
      });
    });
  }
  return out;
}
