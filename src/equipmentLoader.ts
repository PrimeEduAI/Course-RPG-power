// ============================================================
// 模組化騎士資產載入層:
// - equipment-manifest.json 載入(資產契約 + socket 校正)
// - GLB 快取(同一 URL 只下載/解析一次)
// - 需要獨立實例時用 SkeletonUtils.clone(共用 geometry/material,
//   絕不 dispose 快取資源;移除實例只需 removeFromParent)
// ============================================================
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import type { HeroVariant } from "./heroTypes.ts";

export interface ManifestPropSpec {
  url: string;
  socket: string;
  origin?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  previewScale?: number;
}

export interface ManifestHeroSpec {
  url: string;
  requiredNodes: string[];
  animations?: { idle?: string; equip?: string };
}

export interface KnightManifest {
  version: number;
  targetHeight: number;
  heroes: Record<HeroVariant, ManifestHeroSpec>;
  props: Record<string, ManifestPropSpec>;
}

export const KNIGHT_REQUIRED_NODES = [
  "Armature", "Body", "Hair", "TorsoArmor", "ShoulderMantle", "Cape", "Belt",
  "Gauntlet_L", "Gauntlet_R", "GreaveBoot_L", "GreaveBoot_R",
  "Socket_Weapon_R", "Socket_Shield_L", "Socket_Back", "Socket_Hip",
] as const;

/** manifest 讀不到時的內建預設(與 public/models/knights/equipment-manifest.json 同步) */
const DEFAULT_MANIFEST: KnightManifest = {
  version: 1,
  targetHeight: 2.05,
  heroes: {
    boy: { url: "/models/knights/hero-boy-modular.glb", requiredNodes: [...KNIGHT_REQUIRED_NODES] },
    girl: { url: "/models/knights/hero-girl-modular.glb", requiredNodes: [...KNIGHT_REQUIRED_NODES] },
  },
  props: {},
};

const MANIFEST_URL = "/models/knights/equipment-manifest.json";

let manifestPromise: Promise<KnightManifest> | null = null;

export function loadKnightManifest(): Promise<KnightManifest> {
  manifestPromise ??= (async () => {
    try {
      const res = await fetch(MANIFEST_URL);
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && !type.includes("text/html")) {
        const raw = await res.json();
        if (raw && typeof raw === "object" && raw.heroes?.boy?.url && raw.heroes?.girl?.url) {
          return {
            version: Number(raw.version ?? 1),
            targetHeight: Number(raw.targetHeight ?? 2.05),
            heroes: raw.heroes,
            props: raw.props ?? {},
          } as KnightManifest;
        }
        console.warn("[knights] equipment-manifest.json 格式不完整,使用內建預設");
      }
    } catch (e) {
      console.warn("[knights] 無法讀取 equipment-manifest.json,使用內建預設", e);
    }
    return DEFAULT_MANIFEST;
  })();
  return manifestPromise;
}

/** 依 assetUrl 反查 manifest 的 prop 校正(key 為檔名去副檔名,例:boy-sword) */
export function manifestPropFor(manifest: KnightManifest, assetUrl: string): ManifestPropSpec | null {
  const base = assetUrl.split("/").pop()?.replace(/\.(glb|gltf)$/i, "") ?? "";
  const byKey = manifest.props[base];
  if (byKey) return byKey;
  for (const spec of Object.values(manifest.props)) {
    if (spec.url === assetUrl) return spec;
  }
  return null;
}

// ---------------- GLB 快取 ----------------

const loader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF>>();

/** 載入並快取 GLB(同 URL 共用一次下載/解析;失敗會從快取移除以便重試) */
export function loadGLB(url: string): Promise<GLTF> {
  let p = gltfCache.get(url);
  if (!p) {
    p = loader.loadAsync(url).catch((e) => {
      gltfCache.delete(url);
      throw e;
    });
    gltfCache.set(url, p);
  }
  return p;
}

/**
 * 取得 GLB 的獨立實例(SkeletonUtils.clone:骨架/SkinnedMesh 正確重綁,
 * geometry 與 material 仍與快取共用 —— 不得 dispose)。
 */
export async function instantiateGLB(url: string): Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }> {
  const gltf = await loadGLB(url);
  const scene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
  return { scene, animations: gltf.animations };
}

/** HEAD 探測資源是否存在(dev server 對缺檔會回 index.html,需排除) */
export async function probeUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const type = res.headers.get("content-type") ?? "";
    return res.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

// ---------------- 節點驗證 ----------------

export interface HeroValidation {
  ok: boolean;
  missing: string[];
  extras: { skinnedWearables: string[]; sockets: string[] };
}

/** 依 manifest requiredNodes 驗證角色 GLB 節點;缺節點時回報清單 */
export function validateHeroScene(scene: THREE.Object3D, requiredNodes: string[]): HeroValidation {
  const names = new Set<string>();
  scene.traverse((o) => names.add(o.name));
  const missing = requiredNodes.filter((n) => !names.has(n));
  const skinnedWearables: string[] = [];
  const sockets: string[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.name !== "Body") skinnedWearables.push(o.name);
    if (o.name.startsWith("Socket_")) sockets.push(o.name);
  });
  return { ok: missing.length === 0, missing, extras: { skinnedWearables, sockets } };
}
