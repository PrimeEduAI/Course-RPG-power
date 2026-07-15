// ============================================================
// 課程內容設定檔 — 對照簡報改這裡的文字即可，不用動 3D 程式。
// equip.id 對應 equipment.ts 的建模函式;新增知識點時若沒有
// 專屬模型,slot 填 "badge" 會掛上通用發光徽章。
// ============================================================

export type EquipSlot =
  | "head" | "crown" | "handR" | "handL" | "back"
  | "chest" | "feet" | "belt" | "companion" | "badge";

export interface EquipItem {
  id: string;
  icon: string;       // 清單用 emoji
  name: string;       // 裝備名(遊戲感)
  knowledge: string;  // 對應課程知識點
  slot: EquipSlot;
}

export interface Chapter {
  id: string;
  title: string;
  items: EquipItem[];
}

export const CHAPTERS: Chapter[] = [
  {
    id: "ch1",
    title: "第一章 · 認識 AI 影片魔法",
    items: [
      { id: "helmet", icon: "🪖", name: "冒險者頭帶", knowledge: "什麼是 AI 影片?魔法從哪裡來", slot: "head" },
      { id: "shield", icon: "🛡️", name: "智慧之盾", knowledge: "AI 安全與版權:不能亂用別人的作品", slot: "handL" },
    ],
  },
  {
    id: "ch2",
    title: "第二章 · 咒語師修煉(Prompt)",
    items: [
      { id: "sword", icon: "🗡️", name: "咒語之劍", knowledge: "寫出好 Prompt:主角+動作+場景+風格", slot: "handR" },
      { id: "cape", icon: "🧣", name: "魔法披風", knowledge: "認識 AI 影片工具與它們的專長", slot: "back" },
    ],
  },
  {
    id: "ch3",
    title: "第三章 · 導演的秘密基地",
    items: [
      { id: "armor", icon: "🥋", name: "故事護甲", knowledge: "三幕劇:開頭、冒險、結局", slot: "chest" },
      { id: "clapper", icon: "🎬", name: "精靈場記板", knowledge: "分鏡腳本:先畫格子再拍片", slot: "companion" },
    ],
  },
  {
    id: "ch4",
    title: "第四章 · 剪輯與配樂工坊",
    items: [
      { id: "boots", icon: "👢", name: "疾風之靴", knowledge: "剪輯與節奏:什麼時候快、什麼時候慢", slot: "feet" },
      { id: "bell", icon: "🔔", name: "音樂魔鈴", knowledge: "AI 音樂與配音:幫影片加上聲音魔法", slot: "belt" },
    ],
  },
  {
    id: "ch5",
    title: "最終章 · 大導演的加冕",
    items: [
      { id: "crown", icon: "👑", name: "大導演皇冠", knowledge: "成果發表:向大家介紹你的作品", slot: "crown" },
    ],
  },
];

// ---------------- 導演天賦(技能樹) ----------------

export type TalentBranch = "root" | "color" | "shot" | "rhythm";

export interface TalentNode {
  id: string;
  icon: string;
  name: string;
  desc: string;
  branch: TalentBranch;
  x: number; // SVG viewBox 720x460 座標
  y: number;
  parent?: string;
}

export const BRANCH_COLORS: Record<TalentBranch, string> = {
  root: "#ffd166",
  color: "#ff6fae",
  shot: "#54c1ff",
  rhythm: "#ffa245",
};

export const TALENTS: TalentNode[] = [
  { id: "soul", icon: "🎯", name: "導演之魂", desc: "導演用眼睛說故事", branch: "root", x: 360, y: 396 },

  { id: "c1", icon: "🎨", name: "色彩情緒", desc: "顏色會說話:紅色熱血、藍色安靜", branch: "color", x: 140, y: 300, parent: "soul" },
  { id: "c2", icon: "🌈", name: "冷暖色調", desc: "整部片的顏色要像同一家人", branch: "color", x: 110, y: 186, parent: "c1" },
  { id: "c3", icon: "💡", name: "光影魔法", desc: "光從哪裡來,影子就會說故事", branch: "color", x: 150, y: 74, parent: "c2" },

  { id: "s1", icon: "🔭", name: "鏡頭遠近", desc: "遠景看世界、特寫看心情", branch: "shot", x: 360, y: 286 },
  { id: "s2", icon: "🖼️", name: "黃金構圖", desc: "主角放哪裡,畫面最好看", branch: "shot", x: 360, y: 174, parent: "s1" },
  { id: "s3", icon: "🎥", name: "運鏡魔法", desc: "鏡頭會移動:推、拉、搖、跟", branch: "shot", x: 360, y: 64, parent: "s2" },

  { id: "r1", icon: "🥁", name: "快慢節奏", desc: "緊張要快、感動要慢", branch: "rhythm", x: 580, y: 300, parent: "soul" },
  { id: "r2", icon: "🎵", name: "音畫同步", desc: "畫面跟著音樂的拍子跳舞", branch: "rhythm", x: 610, y: 186, parent: "r1" },
  { id: "r3", icon: "🎢", name: "情緒起伏", desc: "故事要有高有低才好看", branch: "rhythm", x: 570, y: 74, parent: "r2" },
];

// s1 的 parent 是 soul(畫線用)
TALENTS.find((t) => t.id === "s1")!.parent = "soul";

// ---------------- 等級稱號 ----------------

export const TOTAL_EXP = CHAPTERS.reduce((n, c) => n + c.items.length, 0) + TALENTS.length;

export const LEVELS: { need: number; title: string }[] = [
  { need: 0, title: "Lv.1 新手冒險者" },
  { need: 4, title: "Lv.2 見習冒險者" },
  { need: 8, title: "Lv.3 勇敢冒險者" },
  { need: 13, title: "Lv.4 見習導演" },
  { need: TOTAL_EXP, title: "Lv.5 AI 大導演 🎉" },
];

export function levelFor(exp: number): string {
  let title = LEVELS[0].title;
  for (const l of LEVELS) if (exp >= l.need) title = l.title;
  return title;
}
