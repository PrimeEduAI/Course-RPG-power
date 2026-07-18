// ============================================================
// 裝備 Registry:模組化騎士部件(單一資料來源)。
// - skinned-node:與角色共用骨架的穿戴 mesh(GLB 內建節點,顯示/隱藏切換)
// - socket-prop :獨立 GLB,掛到角色 socket 空節點(武器、盾牌)
// - legacy      :參考包尚未涵蓋的課程道具,沿用 equipment.ts 程序化建模
// ============================================================
import type { HeroVariant } from "./heroTypes.ts";
import type { EquipSlot } from "./content.ts";

/** 模組化部件 id(底層 API 以此為單位獨立操作) */
export type PartId =
  | "hair"
  | "torsoArmor"
  | "shoulderMantle"
  | "cape"
  | "belt"
  | "gauntletLeft"
  | "gauntletRight"
  | "greaveBootLeft"
  | "greaveBootRight"
  | "weapon"
  | "shield";

export interface VariantEquipment {
  /** socket-prop 專用:GLB 路徑 */
  assetUrl?: string;
  /** 鏡頭前展示的縮放 */
  previewScale?: number;
  /** 掛上 socket 後的局部校正 */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export type EquipmentDefinition = {
  id: PartId;
  label: string;
  mode: "skinned-node" | "socket-prop";
  variants: {
    boy: VariantEquipment;
    girl: VariantEquipment;
  };
  /** skinned-node:GLB 內要切換顯示的節點名稱(精確比對) */
  nodes?: string[];
  /** socket-prop:掛載的 socket 節點名稱(anatomical 左右) */
  socket?: string;
  /** 同組互斥(目前保留欄位,尚無互斥需求) */
  conflictGroup?: string;
};

const none: VariantEquipment = {};

/** 模組化騎士部件定義 */
export const KNIGHT_PARTS: Record<PartId, EquipmentDefinition> = {
  hair: {
    id: "hair", label: "頭髮", mode: "skinned-node",
    nodes: ["Hair"], variants: { boy: none, girl: none },
  },
  torsoArmor: {
    id: "torsoArmor", label: "胸甲", mode: "skinned-node",
    nodes: ["TorsoArmor"], variants: { boy: none, girl: none },
  },
  shoulderMantle: {
    id: "shoulderMantle", label: "肩披甲", mode: "skinned-node",
    nodes: ["ShoulderMantle"], variants: { boy: none, girl: none },
  },
  cape: {
    id: "cape", label: "披風", mode: "skinned-node",
    nodes: ["Cape"], variants: { boy: none, girl: none },
    conflictGroup: "back-cloth",
  },
  belt: {
    id: "belt", label: "腰帶", mode: "skinned-node",
    nodes: ["Belt"], variants: { boy: none, girl: none },
  },
  gauntletLeft: {
    id: "gauntletLeft", label: "左手甲", mode: "skinned-node",
    nodes: ["Gauntlet_L"], variants: { boy: none, girl: none },
  },
  gauntletRight: {
    id: "gauntletRight", label: "右手甲", mode: "skinned-node",
    nodes: ["Gauntlet_R"], variants: { boy: none, girl: none },
  },
  greaveBootLeft: {
    id: "greaveBootLeft", label: "左腿甲靴", mode: "skinned-node",
    nodes: ["GreaveBoot_L"], variants: { boy: none, girl: none },
  },
  greaveBootRight: {
    id: "greaveBootRight", label: "右腿甲靴", mode: "skinned-node",
    nodes: ["GreaveBoot_R"], variants: { boy: none, girl: none },
  },
  weapon: {
    id: "weapon", label: "武器", mode: "socket-prop",
    socket: "Socket_Weapon_R",
    variants: {
      boy: { assetUrl: "/models/knights/props/boy-sword.glb", previewScale: 1 },
      girl: { assetUrl: "/models/knights/props/girl-bow.glb", previewScale: 0.85 },
    },
  },
  shield: {
    id: "shield", label: "盾牌", mode: "socket-prop",
    socket: "Socket_Shield_L",
    variants: {
      boy: { assetUrl: "/models/knights/props/boy-shield.glb", previewScale: 0.9 },
      girl: { assetUrl: "/models/knights/props/girl-shield.glb", previewScale: 0.9 },
    },
  },
};

/** 取得部件在指定性別下的 variant 設定 */
export function partVariant(part: EquipmentDefinition, variant: HeroVariant): VariantEquipment {
  return part.variants[variant] ?? {};
}

// ------------------------------------------------------------
// 課程獎勵(content.ts 的 model key)→ 模組化部件群組。
// 一個獎勵可同時裝一組部件,但底層 API 仍以 PartId 分開控制。
// 沒列在這裡的 model key 走 legacy 路徑(equipment.ts 程序化建模)。
// ------------------------------------------------------------
export const MODEL_TO_PARTS: Record<string, PartId[]> = {
  sword: ["weapon"],
  shield: ["shield"],
  cape: ["cape"],
  armor: ["torsoArmor", "shoulderMantle"],
  boots: ["greaveBootLeft", "greaveBootRight"],
  gauntlets: ["gauntletLeft", "gauntletRight"],
  beltArmor: ["belt"],
};

/** legacy 課程道具(參考包未涵蓋):維持既有程序化建模與掛點 */
export interface LegacyEquipment {
  legacy: true;
  model: string;   // equipment.ts EQUIP_BUILDERS key
  slot: EquipSlot; // heroTypes attach slot(注意 handR/handL 為畫面左右)
}

export const LEGACY_MODELS: Record<string, LegacyEquipment> = {
  helmet: { legacy: true, model: "helmet", slot: "head" },
  crown: { legacy: true, model: "crown", slot: "crown" },
  clapper: { legacy: true, model: "clapper", slot: "companion" },
  bell: { legacy: true, model: "bell", slot: "belt" },
  badge: { legacy: true, model: "badge", slot: "badge" },
};

export const ALL_PART_IDS = Object.keys(KNIGHT_PARTS) as PartId[];
