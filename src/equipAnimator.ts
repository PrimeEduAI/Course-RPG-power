// ============================================================
// 裝備動畫狀態機:
//   unequipped → previewing(鏡頭前放大旋轉) → (停頓) → flying(弧線)
//   → attaching(粒子/音效/attach) → equipped → unequipping(縮小淡出)
//
// - skinned 部件不從骨架拆下飛行:以「preview clone(靜態幾何)」飛行,
//   抵達瞬間隱藏 preview、顯示骨架上的正式 mesh。
// - 武器/盾牌(socket prop)實體飛行,Object3D.attach 保世界座標,
//   再以短 tween 收斂到 manifest 校正的 socket 局部變換。
// - 每個 partId 一個 animation token:快速連點時舊動畫立即作廢並清理,
//   不會產生重複物件、孤兒物件或壞狀態。
// ============================================================
import * as THREE from "three";
import { tween, easeOutCubic, easeInCubic, easeInOutCubic, linear, TokenSource, type AnimToken } from "./tween.ts";
import type { ModularHero } from "./modularHero.ts";
import type { EquipmentDefinition, PartId } from "./equipmentRegistry.ts";

export interface AnimatorHooks {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** 裝備出現在鏡頭前 */
  onReveal?: (pos: THREE.Vector3) => void;
  /** 接觸角色瞬間(粒子/閃光/音效) */
  onImpact?: (pos: THREE.Vector3) => void;
  /** 卸下時 */
  onUnequip?: (pos: THREE.Vector3) => void;
}

const PREVIEW_DIST = 3.2;     // 鏡頭前展示距離
const PREVIEW_GROW = 0.45;    // 由小放大 + 旋轉展示(0.35~0.5s)
const PREVIEW_HOLD = 0.15;    // 停頓
const FLY_TIME = 0.62;        // 弧線飛行(0.55~0.7s)
const SNAP_TIME = 0.12;       // attach 後收斂到 socket 局部變換
const UNEQUIP_TIME = 0.32;    // 反向縮小淡出

interface Preview {
  group: THREE.Group;
  /** 部件在角色身上的世界中心(飛行目標) */
  center: THREE.Vector3;
  dispose(): void;
}

export class EquipAnimator {
  private tokens = new TokenSource();

  constructor(private hooks: AnimatorHooks) {}

  /** 立刻作廢某部件進行中的動畫(其 tween 於下一幀觸發 onCancel 清理) */
  cancelPart(id: PartId) {
    this.tokens.next(id);
  }

  // ------------------------------------------------------------
  // 裝備
  // ------------------------------------------------------------
  async equipPart(hero: ModularHero, def: EquipmentDefinition): Promise<boolean> {
    const id = def.id;
    const token = this.tokens.next(id);
    hero.resetPart(id); // 冪等歸零(清掉半途狀態)

    // ---- 準備飛行物件 ----
    let flying: THREE.Object3D;
    let previewScale = 1;
    let disposePreview: (() => void) | null = null;
    let prop: Awaited<ReturnType<ModularHero["loadPropInstance"]>> = null;

    if (def.mode === "socket-prop") {
      prop = await hero.loadPropInstance(def);
      if (!token.alive) return false;
      if (!prop) {
        console.warn(`[knights] 部件 ${id} 缺少資產,無法裝備`);
        return false;
      }
      flying = prop.object;
      previewScale = prop.spec.previewScale ?? 1;
    } else {
      const preview = buildSkinnedPreview(hero, id);
      if (!preview) {
        console.warn(`[knights] 部件 ${id} 在模型中沒有對應節點,無法裝備`);
        return false;
      }
      flying = preview.group;
      disposePreview = preview.dispose;
    }

    const cleanup = () => {
      flying.removeFromParent();
      disposePreview?.();
      if (hero.partState(id) !== "equipped") hero.setPartState(id, "unequipped");
    };

    // ---- previewing:鏡頭正前方由小放大 + 旋轉 ----
    hero.setPartState(id, "previewing");
    const dir = this.hooks.camera.getWorldDirection(new THREE.Vector3());
    const showPos = (this.hooks.camera as THREE.PerspectiveCamera).position.clone().addScaledVector(dir, PREVIEW_DIST);
    this.hooks.scene.add(flying);
    flying.position.copy(showPos);
    flying.rotation.set(0, 0, 0);
    flying.scale.setScalar(0.01);
    this.hooks.onReveal?.(showPos);

    let ok = await this.tweenAsync(token, PREVIEW_GROW, (k) => {
      flying.scale.setScalar(Math.max(0.01 + (previewScale - 0.01) * k, 0.001));
      flying.rotation.y = k * Math.PI * 2.5;
    }, easeOutCubic);
    if (!ok) { cleanup(); return false; }

    ok = await this.tweenAsync(token, PREVIEW_HOLD, () => {}, linear);
    if (!ok) { cleanup(); return false; }

    // ---- flying:弧線飛向部位,角色同步做裝備動作 ----
    hero.setPartState(id, "flying");
    hero.playEquipGesture();

    const target = def.mode === "socket-prop" && prop
      ? this.propTargetWorld(hero, def, prop.spec)
      : { pos: hero.partWorldCenter(id), quat: null as THREE.Quaternion | null, scale: 1 };

    const p0 = flying.position.clone();
    const p2 = target.pos.clone();
    const mid = p0.clone().lerp(p2, 0.5);
    const side = new THREE.Vector3().subVectors(p2, p0).setY(0);
    const sideLen = side.length();
    const perp = sideLen > 1e-3
      ? new THREE.Vector3(-side.z / sideLen, 0, side.x / sideLen)
      : new THREE.Vector3(1, 0, 0);
    const p1 = mid.add(new THREE.Vector3(0, 0.85, 0)).addScaledVector(perp, 0.5);

    const startQuat = flying.quaternion.clone();
    const startRotY = flying.rotation.y;
    const startScale = flying.scale.x;
    const endScale = def.mode === "socket-prop" ? target.scale : 1;

    ok = await this.tweenAsync(token, FLY_TIME, (k) => {
      // 二次貝茲弧線
      const a = p0.clone().lerp(p1, k);
      const b = p1.clone().lerp(p2, k);
      flying.position.copy(a.lerp(b, k));
      if (target.quat) flying.quaternion.slerpQuaternions(startQuat, target.quat, k);
      else flying.rotation.y = startRotY * (1 - k); // skinned preview 轉回原方向
      flying.scale.setScalar(Math.max(startScale + (endScale - startScale) * k, 0.001));
    }, easeInOutCubic);
    if (!ok) { cleanup(); return false; }

    // ---- attaching:接觸瞬間 ----
    hero.setPartState(id, "attaching");
    this.hooks.onImpact?.(p2);

    if (def.mode === "skinned-node") {
      // preview 不落到骨架:隱藏 preview,顯示已綁定骨架的正式 mesh
      flying.removeFromParent();
      disposePreview?.();
      hero.setPartVisible(id, true);
      hero.setPartState(id, "equipped");
      return true;
    }

    // socket prop:attach 保世界座標 → 短 tween 收斂到 socket 局部變換
    const socket = hero.socket(prop!.spec.socket) ?? hero.socket(def.socket ?? undefined);
    if (!socket) {
      hero.mountProp(def, flying, prop!.spec);
      hero.setPartState(id, "equipped");
      return true;
    }
    socket.attach(flying);
    hero.registerProp(id, flying);
    const final = hero.finalPropTransform(socket, prop!.spec);
    const sp = flying.position.clone();
    const sq = flying.quaternion.clone();
    const ss = flying.scale.clone();
    ok = await this.tweenAsync(token, SNAP_TIME, (k) => {
      flying.position.lerpVectors(sp, final.position, k);
      flying.quaternion.slerpQuaternions(sq, final.quaternion, k);
      flying.scale.lerpVectors(ss, final.scale, k);
    }, easeOutCubic);
    if (!ok) {
      // 被取消:新操作已 resetPart(prop 已移除),不再收尾
      return false;
    }
    hero.setPartState(id, "equipped");
    return true;
  }

  // ------------------------------------------------------------
  // 卸下
  // ------------------------------------------------------------
  async unequipPart(hero: ModularHero, def: EquipmentDefinition): Promise<boolean> {
    const id = def.id;
    const token = this.tokens.next(id); // 作廢進行中的裝備動畫
    if (hero.partState(id) !== "equipped") {
      hero.resetPart(id); // 半途取消 → 直接歸零(舊動畫下一幀自行清理)
      return true;
    }
    hero.setPartState(id, "unequipping");

    if (def.mode === "skinned-node") {
      const preview = buildSkinnedPreview(hero, id);
      hero.setPartVisible(id, false);
      if (!preview) {
        hero.resetPart(id);
        return true;
      }
      this.hooks.scene.add(preview.group);
      preview.group.position.copy(preview.center);
      this.hooks.onUnequip?.(preview.center);
      const done = await this.tweenAsync(token, UNEQUIP_TIME, (k) => {
        preview.group.scale.setScalar(Math.max(1 - k, 0.001));
        setPreviewOpacity(preview.group, 1 - k);
      }, easeInCubic);
      preview.group.removeFromParent();
      preview.dispose();
      if (done) hero.resetPart(id);
      return done;
    }

    const propObj = hero.propOf(id);
    if (!propObj) {
      hero.resetPart(id);
      return true;
    }
    const worldPos = propObj.getWorldPosition(new THREE.Vector3());
    this.hooks.onUnequip?.(worldPos);
    this.hooks.scene.attach(propObj); // 脫離 socket,保世界座標
    const s0 = propObj.scale.clone();
    const done = await this.tweenAsync(token, UNEQUIP_TIME, (k) => {
      propObj.scale.copy(s0).multiplyScalar(Math.max(1 - k, 0.001));
      propObj.position.y = worldPos.y + k * 0.25;
    }, easeInCubic);
    propObj.removeFromParent();
    if (done) hero.resetPart(id);
    return done;
  }

  // ------------------------------------------------------------

  /** socket prop 的飛行目標(世界座標/旋轉/尺寸) */
  private propTargetWorld(hero: ModularHero, def: EquipmentDefinition, spec: { socket: string; rotation?: [number, number, number]; scale?: [number, number, number] }) {
    const socket = hero.socket(spec.socket) ?? hero.socket(def.socket ?? undefined);
    if (!socket) {
      return { pos: hero.partWorldCenter(def.id), quat: null, scale: 1 };
    }
    hero.root.updateMatrixWorld(true);
    const pos = socket.getWorldPosition(new THREE.Vector3());
    const quat = socket.getWorldQuaternion(new THREE.Quaternion())
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rotation ?? [0, 0, 0]))));
    const scale = (spec.scale ?? [1, 1, 1])[0]; // 世界尺寸(prop 依契約以公尺建模)
    return { pos, quat, scale };
  }

  /** tween 包成 Promise:完成 true;被 token 取消 false */
  private tweenAsync(
    token: AnimToken,
    dur: number,
    onUpdate: (k: number) => void,
    ease: (t: number) => number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!token.alive) { resolve(false); return; }
      token.track(tween(dur, onUpdate, {
        ease,
        onDone: () => resolve(true),
        onCancel: () => resolve(false),
      }));
    });
  }
}

// ------------------------------------------------------------
// skinned 部件的 preview clone(靜態幾何,材質為複製品可淡出)
// ------------------------------------------------------------
function buildSkinnedPreview(hero: ModularHero, id: PartId): Preview | null {
  const nodes = hero.nodesOf(id);
  if (!nodes.length) return null;
  hero.root.updateMatrixWorld(true);

  const group = new THREE.Group();
  const cloned: THREE.Material[] = [];
  const box = new THREE.Box3();

  for (const node of nodes) {
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = Array.isArray(m.material) ? m.material : [m.material];
      const mats = src.map((mat) => {
        const c = (mat as THREE.Material).clone();
        c.transparent = true;
        cloned.push(c);
        return c;
      });
      const staticMesh = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? mats : mats[0]);
      staticMesh.matrixAutoUpdate = false;
      staticMesh.matrix.copy(m.matrixWorld);
      group.add(staticMesh);
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) {
        box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld));
      }
    });
  }
  if (!group.children.length) return null;

  const center = box.isEmpty() ? hero.partWorldCenter(id) : box.getCenter(new THREE.Vector3());
  // 把幾何平移到 group 原點 = 部件中心,方便縮放/飛行
  const shift = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z);
  for (const child of group.children) {
    (child as THREE.Mesh).matrix.premultiply(shift);
  }

  return {
    group,
    center,
    // 只 dispose 複製的材質;geometry/貼圖與快取共用,不可動
    dispose: () => { for (const m of cloned) m.dispose(); },
  };
}

function setPreviewOpacity(group: THREE.Group, opacity: number) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) (mat as THREE.Material & { opacity: number }).opacity = opacity;
  });
}
