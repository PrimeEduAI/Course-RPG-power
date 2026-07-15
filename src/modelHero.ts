// 外部 3D 模型冒險者:載入 public/models/ 的 VRM(首選)或 GLB,
// 把裝備掛點綁到人形骨骼上;找不到模型時由 heroFactory 退回程式化角色。
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM } from "@pixiv/three-vrm";
import type { TalentBranch } from "./content.ts";
import { AuraRig, makeAttachSlots, type Hero, type HeroVariant, type EquippedEntry } from "./heroTypes.ts";

const TARGET_HEIGHT = 2.05; // 世界單位,對齊裝備模型的尺寸假設

interface BoneMap {
  head?: THREE.Object3D;
  handR?: THREE.Object3D;
  handL?: THREE.Object3D;
  chest?: THREE.Object3D;
  hips?: THREE.Object3D;
}

export class ModelHero implements Hero {
  root = new THREE.Group();
  readonly variant: HeroVariant;

  attach = makeAttachSlots();
  equipped = new Map<string, EquippedEntry>();

  private aura = new AuraRig();
  private vrm: VRM | null;
  private jumpT = -1;
  private armL: THREE.Object3D | null = null;
  private armR: THREE.Object3D | null = null;
  private headBone: THREE.Object3D | null = null;
  private baseArmL = new THREE.Euler();
  private baseArmR = new THREE.Euler();

  constructor(variant: HeroVariant, model: THREE.Group, vrm: VRM | null, bones: BoneMap, height: number) {
    this.variant = variant;
    this.vrm = vrm;

    const scale = TARGET_HEIGHT / height;
    model.scale.setScalar(scale);
    // VRM1 原生面向 +Z;VRM0 由 rotateVRM0 對齊成 +Z;一般 GLB 假設 +Z
    this.root.add(model);
    this.root.name = "adventurer";

    // ---- 先放下手臂(VRM 預設 T-pose),再做掛點量測 ----
    if (vrm) {
      this.armL = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
      this.armR = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
      this.headBone = vrm.humanoid.getNormalizedBoneNode("head");
      if (this.armL) this.armL.rotation.z = -1.15;
      if (this.armR) this.armR.rotation.z = 1.15;
      vrm.humanoid.update(); // 把姿勢寫回實際骨架
    } else {
      this.armL = findBone(model, /(left|_l\b|\.l$|_l$)/i, /upperarm|shoulder|arm/i);
      this.armR = findBone(model, /(right|_r\b|\.r$|_r$)/i, /upperarm|shoulder|arm/i);
      if (this.armL) this.armL.rotation.z -= 1.0;
      if (this.armR) this.armR.rotation.z += 1.0;
    }
    if (this.armL) this.baseArmL.copy(this.armL.rotation);
    if (this.armR) this.baseArmR.copy(this.armR.rotation);
    model.updateMatrixWorld(true);

    // ---- 依骨骼實測身形,推算裝備該縮放多少 ----
    // (裝備是照內建 Q 版角色調的:頭高含髮 ≈0.42、肩寬 ≈0.49)
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const box = new THREE.Box3().setFromObject(model);
    const headSize = bones.head ? Math.max(box.max.y - wp(bones.head).y, 0.15) : 0.42;
    const headFactor = THREE.MathUtils.clamp(headSize / 0.42, 0.45, 1.3);
    let chestFactor = headFactor;
    if (bones.handR && bones.handL && bones.chest) {
      // 用左右手骨的水平距離近似肩寬(手臂已放下時略寬,乘 0.8 校正)
      const spread = Math.abs(wp(bones.handR).x - wp(bones.handL).x) * 0.8;
      chestFactor = THREE.MathUtils.clamp(spread / 0.49, 0.45, 1.3);
    }

    // ---- 裝備掛點:綁到骨骼 ----
    // 關鍵:骨骼軸向因模型而異,綁定時「中和」骨骼的世界旋轉與縮放,
    // 讓掛點的座標系跟世界對齊(+Y 上、+Z 前),裝備模型就能沿用同一套姿勢。
    const bind = (
      slot: keyof typeof this.attach,
      bone: THREE.Object3D | undefined,
      worldPos: THREE.Vector3, // 想要的世界位置
      factor: number,
      fallbackY: number
    ) => {
      const g = this.attach[slot];
      g.scale.setScalar(factor);
      if (bone) {
        bone.add(g);
        // 中和旋轉:掛點世界旋轉 = 單位(角色面向 +Z 站直時)
        const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
        g.quaternion.copy(q);
        // 中和縮放
        const ws = bone.getWorldScale(new THREE.Vector3());
        g.scale.set(factor / ws.x, factor / ws.y, factor / ws.z);
        // 指定世界位置
        g.position.copy(bone.worldToLocal(worldPos.clone()));
      } else {
        g.position.set(worldPos.x, fallbackY, worldPos.z);
        this.root.add(g);
      }
    };

    const headPos = bones.head ? wp(bones.head) : new THREE.Vector3(0, 1.75, 0);
    const chestPos = bones.chest ? wp(bones.chest) : new THREE.Vector3(0, 1.34, 0);
    const hipsPos = bones.hips ? wp(bones.hips) : new THREE.Vector3(0, 1.05, 0);

    bind("head", bones.head, headPos.clone().add(new THREE.Vector3(0, headSize * 0.3, 0)), headFactor, 1.75);
    bind("crown", bones.head, headPos.clone().add(new THREE.Vector3(0, headSize * 0.82, 0)), headFactor, 2.0);
    bind("handR", bones.handR, bones.handR ? wp(bones.handR) : new THREE.Vector3(0.3, 1, 0), 1, 1.0);
    bind("handL", bones.handL, bones.handL ? wp(bones.handL) : new THREE.Vector3(-0.3, 1, 0), 1, 1.0);
    bind("chest", bones.chest, chestPos.clone().add(new THREE.Vector3(0, 0.02, 0)), chestFactor, 1.34);
    bind("back", bones.chest, chestPos.clone().add(new THREE.Vector3(0, 0.1, -0.13 * chestFactor)), chestFactor, 1.5);
    bind("belt", bones.hips, hipsPos.clone().add(new THREE.Vector3(0, 0.02, 0)), chestFactor, 1.05);
    // 與骨架無關的掛點
    this.attach.feet.position.set(0, 0, 0);
    this.root.add(this.attach.feet);
    this.attach.companion.position.set(0.78, TARGET_HEIGHT * 0.97, 0.12);
    this.root.add(this.attach.companion);
    this.attach.badge.position.set(0, TARGET_HEIGHT + 0.45, 0);
    this.root.add(this.attach.badge);

    // ---- 天賦光環 ----
    this.aura.group.position.y = TARGET_HEIGHT * 0.55;
    this.root.add(this.aura.group);

    // 陰影
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
      }
    });
  }

  setAura(branches: Set<TalentBranch>) {
    this.aura.set(branches);
  }

  happyJump() {
    this.jumpT = 0;
  }

  update(t: number, dt: number) {
    let bob = Math.sin(t * 2.2) * 0.025;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const k = this.jumpT / 0.55;
      if (k >= 1) this.jumpT = -1;
      else bob += Math.sin(Math.min(k, 1) * Math.PI) * 0.4;
    }
    this.root.position.y = bob;

    // 待機:手臂微擺 + 頭部微轉
    if (this.armL) this.armL.rotation.z = this.baseArmL.z + Math.sin(t * 1.3) * 0.04;
    if (this.armR) this.armR.rotation.z = this.baseArmR.z - Math.sin(t * 1.3) * 0.04;
    if (this.headBone) this.headBone.rotation.y = Math.sin(t * 0.6) * 0.12;

    this.vrm?.update(dt);

    for (const { group, slot } of this.equipped.values()) {
      if (slot === "companion") {
        group.position.y = Math.sin(t * 2.6) * 0.12;
        group.rotation.y = Math.sin(t * 1.4) * 0.5;
      } else if (slot === "back") {
        group.rotation.x = 0.1 + Math.sin(t * 1.8) * 0.05;
      }
    }
    this.aura.update(t);
  }
}

// ---------------- 載入 ----------------

function findBone(root: THREE.Object3D, sidePattern: RegExp, partPattern: RegExp): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found || !(o as THREE.Bone).isBone) return;
    const n = o.name.toLowerCase();
    if (partPattern.test(n) && sidePattern.test(n)) found = o;
  });
  return found;
}

function findBoneSimple(root: THREE.Object3D, pattern: RegExp): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found || !(o as THREE.Bone).isBone) return;
    if (pattern.test(o.name.toLowerCase())) found = o;
  });
  return found;
}

function modelHeight(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  return Math.max(box.max.y - box.min.y, 0.1);
}

/** 載入 VRM 或 GLB,回傳 ModelHero;失敗丟出例外 */
export async function loadModelHero(url: string, variant: HeroVariant): Promise<ModelHero> {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm: VRM | undefined = gltf.userData.vrm;

  if (vrm) {
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(vrm); // VRM 0.x 面向修正
    const h = vrm.humanoid;
    // 注意:handR/handL 是「畫面上的左右」(沿用內建角色的視覺配置:劍在畫面右、盾在畫面左),
    // 角色面向 +Z 時,畫面右(+X)其實是模型的解剖學左手。
    const bones: BoneMap = {
      head: h.getRawBoneNode("head") ?? undefined,
      handR: h.getRawBoneNode("leftHand") ?? undefined,
      handL: h.getRawBoneNode("rightHand") ?? undefined,
      chest: h.getRawBoneNode("upperChest") ?? h.getRawBoneNode("chest") ?? undefined,
      hips: h.getRawBoneNode("hips") ?? undefined,
    };
    return new ModelHero(variant, vrm.scene as THREE.Group, vrm, bones, modelHeight(vrm.scene));
  }

  // 一般 GLB:骨骼名稱啟發式(支援 Mixamo / Meshy 常見命名)
  const scene = gltf.scene as THREE.Group;
  // handR/handL 同樣是「畫面上的左右」(見上方 VRM 註解),故左右骨骼對調
  const bones: BoneMap = {
    head: findBoneSimple(scene, /head/i) ?? undefined,
    handR: findBone(scene, /left|_l$|\.l$|_l_/i, /hand/i) ?? undefined,
    handL: findBone(scene, /right|_r$|\.r$|_r_/i, /hand/i) ?? undefined,
    chest: findBoneSimple(scene, /upperchest|chest|spine2|spine02|spine_02/i) ?? undefined,
    hips: findBoneSimple(scene, /hips|pelvis/i) ?? undefined,
  };
  return new ModelHero(variant, scene, null, bones, modelHeight(scene));
}

/** 依序探測可用的模型檔;找不到回傳 null */
export async function probeModelUrl(variant: HeroVariant): Promise<string | null> {
  const candidates = [
    `/models/hero-${variant}.vrm`,
    `/models/hero-${variant}.glb`,
    `/models/hero.vrm`,
    `/models/hero.glb`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && !type.includes("text/html")) return url;
    } catch { /* 繼續下一個 */ }
  }
  return null;
}
