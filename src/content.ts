// ============================================================
// 課程內容:型別、3D 模型清單、預設內容。
// 實際顯示的內容可在「編輯器頁面(/edit.html)」修改,
// 存在 localStorage;沒有自訂時使用這裡的預設值。
// ============================================================

export type EquipSlot =
  | "head" | "crown" | "handR" | "handL" | "back"
  | "chest" | "feet" | "belt" | "companion" | "badge";

/** 可用的 3D 裝備模型(對應 equipment.ts 的建模函式) */
export const MODELS: Record<string, { label: string; slot: EquipSlot }> = {
  helmet: { label: "🪖 冒險者頭帶(戴頭上)", slot: "head" },
  crown: { label: "👑 皇冠(頭頂)", slot: "crown" },
  sword: { label: "🗡️ 長劍(右手)", slot: "handR" },
  shield: { label: "🛡️ 圓盾(左手)", slot: "handL" },
  cape: { label: "🧣 披風(背後)", slot: "back" },
  armor: { label: "🥋 胸甲+肩甲(身上)", slot: "chest" },
  clapper: { label: "🎬 場記板小精靈(飄浮)", slot: "companion" },
  boots: { label: "👢 靴子(腳上)", slot: "feet" },
  bell: { label: "🔔 腰帶鈴鐺(腰間)", slot: "belt" },
  badge: { label: "⭐ 發光徽章(頭上飄浮)", slot: "badge" },
};

export interface EquipItem {
  id: string;
  icon: string;       // 清單用 emoji
  name: string;       // 裝備名(遊戲感)
  knowledge: string;  // 對應課程知識點
  model: string;      // MODELS 的 key
}

export interface Chapter {
  id: string;
  title: string;
  items: EquipItem[];
}

export type TalentBranch = "root" | "color" | "shot" | "rhythm";

export interface TalentNode {
  id: string;
  icon: string;
  name: string;
  desc: string;
  branch: TalentBranch;
}

export interface ContentData {
  chapters: Chapter[];
  branches: Record<Exclude<TalentBranch, "root">, string>; // 分支顯示名稱
  talents: TalentNode[];
}

export const BRANCH_COLORS: Record<TalentBranch, string> = {
  root: "#ffd166",
  color: "#ff6fae",
  shot: "#54c1ff",
  rhythm: "#ffa245",
};

// ---------------- 預設內容 ----------------

export const DEFAULT_CONTENT: ContentData = {
  chapters: [
    {
      id: "ch1",
      title: "第一章 · 認識 AI 影片魔法",
      items: [
        { id: "helmet", icon: "🪖", name: "冒險者頭帶", knowledge: "什麼是 AI 影片?魔法從哪裡來", model: "helmet" },
        { id: "shield", icon: "🛡️", name: "智慧之盾", knowledge: "AI 安全與版權:不能亂用別人的作品", model: "shield" },
      ],
    },
    {
      id: "ch2",
      title: "第二章 · 咒語師修煉(Prompt)",
      items: [
        { id: "sword", icon: "🗡️", name: "咒語之劍", knowledge: "寫出好 Prompt:主角+動作+場景+風格", model: "sword" },
        { id: "cape", icon: "🧣", name: "魔法披風", knowledge: "認識 AI 影片工具與它們的專長", model: "cape" },
      ],
    },
    {
      id: "ch3",
      title: "第三章 · 導演的秘密基地",
      items: [
        { id: "armor", icon: "🥋", name: "故事護甲", knowledge: "三幕劇:開頭、冒險、結局", model: "armor" },
        { id: "clapper", icon: "🎬", name: "精靈場記板", knowledge: "分鏡腳本:先畫格子再拍片", model: "clapper" },
      ],
    },
    {
      id: "ch4",
      title: "第四章 · 剪輯與配樂工坊",
      items: [
        { id: "boots", icon: "👢", name: "疾風之靴", knowledge: "剪輯與節奏:什麼時候快、什麼時候慢", model: "boots" },
        { id: "bell", icon: "🔔", name: "音樂魔鈴", knowledge: "AI 音樂與配音:幫影片加上聲音魔法", model: "bell" },
      ],
    },
    {
      id: "ch5",
      title: "最終章 · 大導演的加冕",
      items: [
        { id: "crown", icon: "👑", name: "大導演皇冠", knowledge: "成果發表:向大家介紹你的作品", model: "crown" },
      ],
    },
  ],
  branches: {
    color: "色彩之眼",
    shot: "分鏡之眼",
    rhythm: "節奏之心",
  },
  talents: [
    { id: "soul", icon: "🎯", name: "導演之魂", desc: "導演用眼睛說故事", branch: "root" },

    { id: "c1", icon: "🎨", name: "色彩情緒", desc: "顏色會說話:紅色熱血、藍色安靜", branch: "color" },
    { id: "c2", icon: "🌈", name: "冷暖色調", desc: "整部片的顏色要像同一家人", branch: "color" },
    { id: "c3", icon: "💡", name: "光影魔法", desc: "光從哪裡來,影子就會說故事", branch: "color" },

    { id: "s1", icon: "🔭", name: "鏡頭遠近", desc: "遠景看世界、特寫看心情", branch: "shot" },
    { id: "s2", icon: "🖼️", name: "黃金構圖", desc: "主角放哪裡,畫面最好看", branch: "shot" },
    { id: "s3", icon: "🎥", name: "運鏡魔法", desc: "鏡頭會移動:推、拉、搖、跟", branch: "shot" },

    { id: "r1", icon: "🥁", name: "快慢節奏", desc: "緊張要快、感動要慢", branch: "rhythm" },
    { id: "r2", icon: "🎵", name: "音畫同步", desc: "畫面跟著音樂的拍子跳舞", branch: "rhythm" },
    { id: "r3", icon: "🎢", name: "情緒起伏", desc: "故事要有高有低才好看", branch: "rhythm" },
  ],
};
