// ============================================================
// ModularHero:共享骨架的模組化騎士角色。
// - 載入 public/models/knights/hero-{boy|girl}-modular.glb
// - 穿戴部件 = GLB 內建 skinned 節點(顯示/隱藏),武器/盾 = socket prop
// - 左右一律「解剖學左右」;legacy 掛點(handR/handL=畫面左右)由這裡轉換,
//   舊道具視覺位置不變、新裝備不會左右交換。
// - 動畫:優先 GLB Idle/Equip clip(AnimationMixer + crossFade);
//   沒有 clip 才用手動骨骼微動(絕不與 mixer 搶同一根骨頭)。
// ============================================================
import * as THREE from "three";
import type { TalentBranch } from "./content.ts";
import { AuraRig, makeAttachSlots, type Hero, type HeroVariant, type EquippedEntry } from "./heroTypes.ts";
import {
  KNIGHT_PARTS, partVariant,
  type EquipmentDefinition, type PartId,
} from "./equipmentRegistry.ts";
import {
  instantiateGLB, loadKnightManifest, manifestPropFor, probeUrl, validateHeroScene,
  type HeroValidation, type KnightManifest, type ManifestPropSpec,
} from "./equipmentLoader.ts";
import type { EquipAnimator } from "./equipAnimator.ts";
import { tween, easeOutCubic } from "./tween.ts";

export type PartState =
  | "unequipped" | "previewing" | "flying" | "attaching" | "equipped" | "unequipping";

export interface EquipOptions {
  animate?: boolean;
}

interface HeroBones {
  head?: THREE.Object3D;
  chest?: THREE.Object3D;
  hips?: THREE.Object3D;
  /** 解剖學左右手 */
  handAnatL?: THREE.Object3D;
  handAnatR?: THREE.Object3D;
  upperArmAnatR?: THREE.Object3D;
}

const TARGET_HEIGHT_FALLBACK = 2.05;

export class ModularHero implements Hero {
  root = new THREE.Group();
  readonly variant: HeroVariant;

  /** legacy 道具掛點(crown、helmet、clapper、bell、badge…) */
  attach = makeAttachSlots();
  /** legacy 道具狀態(模組化部件另由 partStates 管理) */
  equipped = new Map<string, EquippedEntry>();

  readonly model: THREE.Group;
  readonly manifest: KnightManifest;
  readonly validation: HeroValidation;
  readonly sourceUrl: string;

  /** partId → GLB 內建穿戴節點 */
  private partNodes = new Map<PartId, THREE.Object3D[]>();
  private socketMap = new Map<string, THREE.Object3D>();
  /** 已掛上的 socket prop 實例 */
  private propInstances = new Map<PartId, THREE.Object3D>();
  private partStates = new Map<PartId, PartState>();

  private animator: EquipAnimator | null = null;

  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private equipAction: THREE.AnimationAction | null = null;
  private gestureBusy = false;

  private aura = new AuraRig();
  private jumpT = -1;
  private bones: HeroBones;
  private baseArmR = new THREE.Euler();
  private manualSway: { armL?: THREE.Object3D; armR?: THREE.Object3D; head?: THREE.Object3D } = {};
  private baseSway = { armL: new THREE.Euler(), armR: new THREE.Euler(), head: new THREE.Euler() };

  constructor(
    variant: HeroVariant,
    model: THREE.Group,
    animations: THREE.AnimationClip[],
    manifest: KnightManifest,
    validation: HeroValidation,
    sourceUrl: string
  ) {
    this.variant = variant;
    this.model = model;
    this.manifest = manifest;
    this.validation = validation;
    this.sourceUrl = sourceUrl;
    this.root.name = "adventurer";
    this.root.add(model);

    // ---- 正規化:等高 + 腳底中心對齊原點 ----
    model.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(model);
    const height = Math.max(bb.max.y - bb.min.y, 0.1);
    const target = manifest.targetHeight || TARGET_HEIGHT_FALLBACK;
    const scale = target / height;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const bb2 = new THREE.Box3().setFromObject(model);
    model.position.x -= (bb2.min.x + bb2.max.x) / 2;
    model.position.y -= bb2.min.y;
    model.position.z -= (bb2.min.z + bb2.max.z) / 2;
    model.updateMatrixWorld(true);

    // ---- 收集部件節點與 socket ----
    const byName = new Map<string, THREE.Object3D>();
    model.traverse((o) => {
      if (o.name && !byName.has(o.name)) byName.set(o.name, o);
      if (o.name.startsWith("Socket_")) this.socketMap.set(o.name, o);
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    for (const def of Object.values(KNIGHT_PARTS)) {
      if (def.mode !== "skinned-node" || !def.nodes) continue;
      const nodes = def.nodes.map((n) => byName.get(n)).filter(Boolean) as THREE.Object3D[];
      if (nodes.length) this.partNodes.set(def.id, nodes);
      // 契約:除 Body 外的穿戴 mesh 預設隱藏
      for (const n of nodes) n.visible = false;
      this.partStates.set(def.id, "unequipped");
    }
    this.partStates.set("weapon", "unequipped");
    this.partStates.set("shield", "unequipped");

    // ---- 骨骼辨識(解剖學左右) ----
    this.bones = {
      head: findBone(model, /head/i) ?? undefined,
      chest: findBone(model, /upperchest|chest|spine2|spine02|spine_02|spine\.002/i) ?? findBone(model, /spine/i) ?? undefined,
      hips: findBone(model, /hips|pelvis/i) ?? undefined,
      handAnatL: findSideBone(model, "L", /hand/i) ?? undefined,
      handAnatR: findSideBone(model, "R", /hand/i) ?? undefined,
      upperArmAnatR: findSideBone(model, "R", /upperarm|upper_arm|arm/i) ?? undefined,
    };

    // ---- 動畫 clip ----
    const animCfg = manifest.heroes[variant]?.animations;
    const idleClip = pickClip(animations, animCfg?.idle ?? "Idle");
    const equipClip = pickClip(animations, animCfg?.equip ?? "Equip");
    if (idleClip || equipClip) {
      this.mixer = new THREE.AnimationMixer(model);
      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.play();
      }
      if (equipClip) {
        this.equipAction = this.mixer.clipAction(equipClip);
        this.equipAction.setLoop(THREE.LoopOnce, 1);
        this.equipAction.clampWhenFinished = true;
      }
    }
    // 沒有任何 clip 才啟用手動微動(避免與 mixer 搶骨頭)
    if (!this.mixer) {
      this.manualSway.armR = this.bones.upperArmAnatR;
      this.manualSway.armL = findSideBone(model, "L", /upperarm|upper_arm|arm/i) ?? undefined;
      this.manualSway.head = this.bones.head;
      if (this.manualSway.armL) this.baseSway.armL.copy(this.manualSway.armL.rotation);
      if (this.manualSway.armR) this.baseSway.armR.copy(this.manualSway.armR.rotation);
      if (this.manualSway.head) this.baseSway.head.copy(this.manualSway.head.rotation);
    }
    if (this.bones.upperArmAnatR) this.baseArmR.copy(this.bones.upperArmAnatR.rotation);

    // ---- legacy 掛點(沿用 modelHero 的「中和骨骼旋轉」作法) ----
    this.bindLegacySlots(target);

    // ---- 天賦光環 ----
    this.aura.group.position.y = target * 0.55;
    this.root.add(this.aura.group);

    // 頭髮屬於角色外觀預設:直接顯示(仍可用 unequip("hair") 隱藏)
    this.setPartVisible("hair", true);
    this.partStates.set("hair", "equipped");
  }

  // ------------------------------------------------------------
  // 部件 API(底層,每個部件獨立操作)
  // ------------------------------------------------------------

  setAnimator(a: EquipAnimator) {
    this.animator = a;
  }

  partState(id: PartId): PartState {
    return this.partStates.get(id) ?? "unequipped";
  }

  setPartState(id: PartId, s: PartState) {
    this.partStates.set(id, s);
  }

  isEquipped(id: PartId): boolean {
    const s = this.partState(id);
    return s === "equipped" || s === "previewing" || s === "flying" || s === "attaching";
  }

  getEquippedItems(): PartId[] {
    return [...this.partStates.entries()]
      .filter(([, s]) => s === "equipped")
      .map(([id]) => id);
  }

  /** 裝備單一部件;animate 時走 preview→flying→attach 狀態機 */
  async equip(id: PartId, opts: EquipOptions = {}): Promise<void> {
    const def = KNIGHT_PARTS[id];
    if (!def || this.isEquipped(id)) return;
    if (opts.animate && this.animator) {
      await this.animator.equipPart(this, def);
      return;
    }
    await this.equipInstant(def);
  }

  /** 卸下單一部件;animate 時播放反向縮小淡出 */
  async unequip(id: PartId, opts: EquipOptions = {}): Promise<void> {
    const def = KNIGHT_PARTS[id];
    if (!def) return;
    if (opts.animate && this.animator) {
      await this.animator.unequipPart(this, def);
      return;
    }
    if (this.animator) this.animator.cancelPart(id); // 進行中的動畫立即作廢
    this.resetPart(id);
  }

  /** 立即裝上(不播動畫;還原進度、男女切換用) */
  async equipInstant(def: EquipmentDefinition): Promise<void> {
    if (def.mode === "skinned-node") {
      this.setPartVisible(def.id, true);
      this.partStates.set(def.id, "equipped");
      return;
    }
    const prop = await this.loadPropInstance(def);
    if (!prop) return;
    this.mountProp(def, prop.object, prop.spec);
    this.partStates.set(def.id, "equipped");
  }

  /** 強制回到未裝備狀態(隱藏節點、移除 prop);冪等,供取消/卸下共用 */
  resetPart(id: PartId) {
    this.setPartVisible(id, false);
    const prop = this.propInstances.get(id);
    if (prop) {
      prop.removeFromParent(); // geometry/material 與快取共用,不 dispose
      this.propInstances.delete(id);
    }
    this.partStates.set(id, "unequipped");
  }

  // ---- 供 equipAnimator 使用的低階操作 ----

  nodesOf(id: PartId): THREE.Object3D[] {
    return this.partNodes.get(id) ?? [];
  }

  setPartVisible(id: PartId, visible: boolean) {
    for (const n of this.partNodes.get(id) ?? []) n.visible = visible;
  }

  socket(name: string | undefined): THREE.Object3D | null {
    if (!name) return null;
    return this.socketMap.get(name) ?? null;
  }

  sockets(): ReadonlyMap<string, THREE.Object3D> {
    return this.socketMap;
  }

  registerProp(id: PartId, obj: THREE.Object3D) {
    this.propInstances.set(id, obj);
  }

  propOf(id: PartId): THREE.Object3D | null {
    return this.propInstances.get(id) ?? null;
  }

  /** 載入部件的 socket prop GLB 實例(含 manifest 校正) */
  async loadPropInstance(def: EquipmentDefinition): Promise<{ object: THREE.Object3D; spec: ManifestPropSpec } | null> {
    const v = partVariant(def, this.variant);
    if (!v.assetUrl) return null;
    const url = this.resolvePropUrl(v.assetUrl);
    try {
      const { scene } = await instantiateGLB(url);
      scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      const manifestSpec = manifestPropFor(this.manifest, v.assetUrl);
      const spec: ManifestPropSpec = {
        url,
        socket: manifestSpec?.socket ?? def.socket ?? "Socket_Weapon_R",
        position: manifestSpec?.position ?? v.position ?? [0, 0, 0],
        rotation: manifestSpec?.rotation ?? v.rotation ?? [0, 0, 0],
        scale: manifestSpec?.scale ?? v.scale ?? [1, 1, 1],
        previewScale: manifestSpec?.previewScale ?? v.previewScale ?? 1,
      };
      return { object: scene, spec };
    } catch (e) {
      console.warn(`[knights] 無法載入 prop ${url}`, e);
      return null;
    }
  }

  /** dev placeholder 模式下,props 改讀 dev/ 目錄 */
  private resolvePropUrl(url: string): string {
    if (this.sourceUrl.includes("/dev/")) {
      return url.replace("/models/knights/props/", "/models/knights/dev/props/");
    }
    return url;
  }

  /** 把 prop 以最終局部座標放進 socket(瞬時掛載用) */
  mountProp(def: EquipmentDefinition, obj: THREE.Object3D, spec: ManifestPropSpec) {
    const socket = this.socket(spec.socket) ?? this.socket(def.socket ?? undefined);
    if (!socket) {
      console.warn(`[knights] 找不到 socket ${spec.socket},prop 掛到 root`);
      this.root.add(obj);
    } else {
      socket.add(obj);
      const f = this.finalPropTransform(socket, spec);
      obj.position.copy(f.position);
      obj.quaternion.copy(f.quaternion);
      obj.scale.copy(f.scale);
    }
    this.registerProp(def.id, obj);
  }

  /**
   * prop 在 socket 內的最終局部變換。
   * 縮放以「世界尺寸」為準:除以 socket 的世界縮放,
   * 抵銷角色等高正規化造成的縮放,武器不會忽大忽小。
   */
  finalPropTransform(socket: THREE.Object3D, spec: ManifestPropSpec) {
    const pos = new THREE.Vector3(...(spec.position ?? [0, 0, 0]));
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rotation ?? [0, 0, 0])));
    const s = spec.scale ?? [1, 1, 1];
    const sws = socket.getWorldScale(new THREE.Vector3());
    const scale = new THREE.Vector3(s[0] / (sws.x || 1), s[1] / (sws.y || 1), s[2] / (sws.z || 1));
    return { position: pos, quaternion: quat, scale };
  }

  /** 部件目前的世界包圍盒中心(飛行動畫目標點) */
  partWorldCenter(id: PartId): THREE.Vector3 {
    const def = KNIGHT_PARTS[id];
    if (def?.mode === "socket-prop") {
      const socket = this.socket(def.socket ?? undefined);
      if (socket) return socket.getWorldPosition(new THREE.Vector3());
    }
    const nodes = this.partNodes.get(id);
    if (nodes?.length) {
      this.root.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const n of nodes) box.expandByObject(n);
      if (!box.isEmpty()) return box.getCenter(new THREE.Vector3());
    }
    return this.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.2, 0));
  }

  // ------------------------------------------------------------
  // 角色動畫
  // ------------------------------------------------------------

  /** 裝備動作:優先 GLB Equip clip,否則右臂骨骼簡單抬手 fallback */
  playEquipGesture() {
    if (this.equipAction && this.mixer && this.idleAction) {
      if (this.gestureBusy) return;
      this.gestureBusy = true;
      this.equipAction.reset();
      this.equipAction.crossFadeFrom(this.idleAction.reset().play(), 0.15, false);
      this.equipAction.play();
      const onFinish = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== this.equipAction) return;
        this.mixer?.removeEventListener("finished", onFinish as never);
        this.idleAction?.reset().play();
        this.idleAction && this.equipAction?.crossFadeTo(this.idleAction, 0.2, false);
        this.gestureBusy = false;
      };
      this.mixer.addEventListener("finished", onFinish as never);
      return;
    }
    if (this.mixer) return; // 有 mixer 但沒 Equip clip:不徒手轉骨頭,避免打架
    const arm = this.bones.upperArmAnatR;
    if (!arm || this.gestureBusy) return;
    this.gestureBusy = true;
    const base = this.baseArmR.clone();
    // 抬手 → 停 → 放下(總長 ≈ 0.85s,配合飛行時間)
    tween(0.3, (k) => { arm.rotation.x = base.x - 1.1 * k; }, {
      ease: easeOutCubic,
      onDone: () => {
        tween(0.3, (k) => { arm.rotation.x = base.x - 1.1 * (1 - k); }, {
          ease: easeOutCubic,
          delay: 0.25,
          onDone: () => { arm.rotation.copy(base); this.gestureBusy = false; },
        });
      },
    });
  }

  happyJump() {
    this.jumpT = 0;
  }

  setAura(branches: Set<TalentBranch>) {
    this.aura.set(branches);
  }

  update(t: number, dt: number) {
    let bob = Math.sin(t * 2.2) * 0.02;
    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const k = this.jumpT / 0.55;
      if (k >= 1) this.jumpT = -1;
      else bob += Math.sin(Math.min(k, 1) * Math.PI) * 0.4;
    }
    this.root.position.y = bob;

    if (this.mixer) {
      this.mixer.update(dt);
    } else if (!this.gestureBusy) {
      // 手動待機微動(僅在完全沒有動畫 clip 時)
      const s = this.manualSway;
      if (s.armL) s.armL.rotation.z = this.baseSway.armL.z + Math.sin(t * 1.3) * 0.04;
      if (s.armR) s.armR.rotation.z = this.baseSway.armR.z - Math.sin(t * 1.3) * 0.04;
      if (s.head) s.head.rotation.y = this.baseSway.head.y + Math.sin(t * 0.6) * 0.1;
    }

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

  // ------------------------------------------------------------
  // legacy 掛點(crown/helmet/clapper/bell/badge 沿用舊視覺配置)
  // ------------------------------------------------------------
  private bindLegacySlots(targetHeight: number) {
    const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);

    const headPos = this.bones.head ? wp(this.bones.head) : new THREE.Vector3(0, targetHeight * 0.85, 0);
    const chestPos = this.bones.chest ? wp(this.bones.chest) : new THREE.Vector3(0, targetHeight * 0.65, 0);
    const hipsPos = this.bones.hips ? wp(this.bones.hips) : new THREE.Vector3(0, targetHeight * 0.51, 0);
    // 頭部道具定位:以 Head bone + Hair(或整體)包圍盒推算,不再用固定 headFactor。
    const hairObj = this.model.getObjectByName("Hair");
    let hairTopY = box.max.y;
    let hairWidth = 0.3;
    if (hairObj) {
      const hb = new THREE.Box3().setFromObject(hairObj);
      hairTopY = hb.max.y;
      hairWidth = Math.max(hb.max.x - hb.min.x, 0.2);
    }
    const headWidthEst = THREE.MathUtils.clamp(hairWidth * 0.72, 0.18, 0.34);
    const bandFactor = (headWidthEst * 1.18) / 0.6; // 頭帶 torus 直徑 0.6(scale 1)
    const crownFactor = (headWidthEst * 0.95) / 0.32; // 皇冠環直徑 0.32(scale 1)
    const headSize = this.bones.head ? Math.max(box.max.y - headPos.y, 0.15) : 0.42;
    let chestFactor = THREE.MathUtils.clamp(headSize / 0.56, 0.4, 1.3);
    if (this.bones.handAnatL && this.bones.handAnatR) {
      const spread = Math.abs(wp(this.bones.handAnatL).x - wp(this.bones.handAnatR).x) * 0.8;
      if (spread > 0.05) chestFactor = THREE.MathUtils.clamp(spread / 0.49, 0.45, 1.3);
    }

    const bind = (
      slot: keyof typeof this.attach,
      bone: THREE.Object3D | undefined,
      worldPos: THREE.Vector3,
      factor: number,
      fallbackY: number
    ) => {
      const g = this.attach[slot];
      g.scale.setScalar(factor);
      if (bone) {
        bone.add(g);
        // 中和骨骼世界旋轉/縮放,掛點座標系對齊世界(+Y 上、+Z 前)
        const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
        g.quaternion.copy(q);
        const ws = bone.getWorldScale(new THREE.Vector3());
        g.scale.set(factor / ws.x, factor / ws.y, factor / ws.z);
        g.position.copy(bone.worldToLocal(worldPos.clone()));
      } else {
        g.position.set(worldPos.x, fallbackY, worldPos.z);
        this.root.add(g);
      }
    };

    // 頭帶環繞額頭(Head bone 與髮頂之間 42% 高度);皇冠落在髮頂上方,髮型換裝後重綁仍成立
    const foreheadY = headPos.y + (hairTopY - headPos.y) * 0.42;
    bind("head", this.bones.head, new THREE.Vector3(headPos.x, foreheadY, headPos.z + 0.015), bandFactor, targetHeight * 0.85);
    bind("crown", this.bones.head, new THREE.Vector3(headPos.x, hairTopY + 0.015, headPos.z), crownFactor, targetHeight * 0.98);
    // 注意:legacy handR/handL 是「畫面左右」——handR(畫面右、+X)= 解剖學左手
    bind("handR", this.bones.handAnatL, this.bones.handAnatL ? wp(this.bones.handAnatL) : new THREE.Vector3(0.3, 1, 0), 1, 1.0);
    bind("handL", this.bones.handAnatR, this.bones.handAnatR ? wp(this.bones.handAnatR) : new THREE.Vector3(-0.3, 1, 0), 1, 1.0);
    bind("chest", this.bones.chest, chestPos.clone().add(new THREE.Vector3(0, 0.02, 0)), chestFactor, targetHeight * 0.65);
    bind("back", this.bones.chest, chestPos.clone().add(new THREE.Vector3(0, 0.1, -0.13 * chestFactor)), chestFactor, targetHeight * 0.73);
    bind("belt", this.bones.hips, hipsPos.clone().add(new THREE.Vector3(0, 0.02, 0)), chestFactor, targetHeight * 0.51);

    this.attach.feet.position.set(0, 0, 0);
    this.root.add(this.attach.feet);
    this.attach.companion.position.set(0.78, targetHeight * 0.97, 0.12);
    this.root.add(this.attach.companion);
    this.attach.badge.position.set(0, targetHeight + 0.45, 0);
    this.root.add(this.attach.badge);
  }
}

// ---------------- 骨骼辨識 ----------------

function findBone(root: THREE.Object3D, pattern: RegExp): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found || !(o as THREE.Bone).isBone) return;
    if (pattern.test(o.name.toLowerCase())) found = o;
  });
  return found;
}

/** 依解剖學左右找骨骼:side = "L" | "R"(比對 _L/.L/Left 等常見命名) */
function findSideBone(root: THREE.Object3D, side: "L" | "R", partPattern: RegExp): THREE.Object3D | null {
  const sidePattern = side === "L"
    ? /(left|_l\b|\.l$|_l$|_l_)/i
    : /(right|_r\b|\.r$|_r$|_r_)/i;
  let found: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (found || !(o as THREE.Bone).isBone) return;
    const n = o.name.toLowerCase();
    if (partPattern.test(n) && sidePattern.test(n)) found = o;
  });
  return found;
}

function pickClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | null {
  return clips.find((c) => c.name === name)
    ?? clips.find((c) => c.name.toLowerCase() === name.toLowerCase())
    ?? null;
}

// ---------------- 載入 ----------------

export function modularHeroUrl(manifest: KnightManifest, variant: HeroVariant, dev: boolean): string {
  if (dev) return `/models/knights/dev/hero-${variant}-modular.glb`;
  return manifest.heroes[variant]?.url ?? `/models/knights/hero-${variant}-modular.glb`;
}

/** 探測模組化騎士 GLB 是否存在 */
export async function probeModularHero(variant: HeroVariant, dev: boolean): Promise<string | null> {
  const manifest = await loadKnightManifest();
  const url = modularHeroUrl(manifest, variant, dev);
  return (await probeUrl(url)) ? url : null;
}

/** 載入模組化騎士;節點不合契約時警告,缺 Body 直接失敗丟例外 */
export async function loadModularHero(variant: HeroVariant, url: string): Promise<ModularHero> {
  const manifest = await loadKnightManifest();
  const { scene, animations } = await instantiateGLB(url);
  const required = manifest.heroes[variant]?.requiredNodes ?? [];
  const validation = validateHeroScene(scene, required);
  if (!validation.ok) {
    console.warn(`[knights] ${url} 缺少契約節點:${validation.missing.join(", ")}`);
  }
  let hasBody = false;
  scene.traverse((o) => { if (o.name === "Body") hasBody = true; });
  if (!hasBody) throw new Error(`模組化角色 ${url} 缺少 Body 節點,不符合資產契約`);
  return new ModularHero(variant, scene, animations, manifest, validation, url);
}
