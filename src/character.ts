import * as THREE from "three";
import { toon, mesh } from "./materials.ts";
import type { EquipSlot, TalentBranch } from "./content.ts";
import { BRANCH_COLORS } from "./content.ts";

const SKIN = "#ffd9b3";
const HAIR = "#b5652f";
const CLOTH = "#f4e7c6";
const PANTS = "#8fbf6b";

interface EquippedEntry {
  group: THREE.Group;
  slot: EquipSlot;
}

/**
 * Q版 RO 風冒險者:程式化 chibi(大頭小身),含裝備掛點與待機動畫。
 */
export class Adventurer {
  root = new THREE.Group();

  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private bodyGroup = new THREE.Group();

  // 裝備掛點
  attach: Record<EquipSlot, THREE.Group> = {
    head: new THREE.Group(),
    crown: new THREE.Group(),
    handR: new THREE.Group(),
    handL: new THREE.Group(),
    back: new THREE.Group(),
    chest: new THREE.Group(),
    feet: new THREE.Group(),
    belt: new THREE.Group(),
    companion: new THREE.Group(),
    badge: new THREE.Group(),
  };

  equipped = new Map<string, EquippedEntry>();

  private auraGroup = new THREE.Group();
  private auraSparks: { m: THREE.Mesh; phase: number; r: number; h: number; speed: number }[] = [];

  private jumpT = -1; // >=0 表示跳躍動畫進行中

  constructor() {
    this.build();
  }

  private build() {
    const g = this.root;
    g.name = "adventurer";

    // ---- 腿 ----
    const legGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.3, 12);
    for (const side of [-1, 1]) {
      const leg = mesh(legGeo, toon(PANTS));
      leg.position.set(0.13 * side, 0.15, 0);
      g.add(leg);
      const foot = mesh(new THREE.SphereGeometry(0.11, 12, 10), toon("#a9714b"));
      foot.scale.set(1, 0.6, 1.3);
      foot.position.set(0.13 * side, 0.06, 0.04);
      g.add(foot);
    }

    // ---- 身體(初心者布衣) ----
    this.bodyGroup.position.y = 0;
    const body = mesh(new THREE.CylinderGeometry(0.22, 0.31, 0.55, 16), toon(CLOTH));
    body.position.y = 0.57;
    this.bodyGroup.add(body);
    // 腰帶(布)
    const sash = mesh(new THREE.CylinderGeometry(0.305, 0.315, 0.07, 16), toon("#c96f4a"));
    sash.position.y = 0.38;
    this.bodyGroup.add(sash);
    g.add(this.bodyGroup);

    // ---- 手臂(肩膀樞紐,可擺動) ----
    const armGeo = new THREE.CapsuleGeometry(0.07, 0.2, 6, 10);
    for (const side of [-1, 1] as const) {
      const pivot = side === 1 ? this.armR : this.armL;
      pivot.position.set(0.27 * side, 0.8, 0);
      const arm = mesh(armGeo, toon(CLOTH));
      arm.position.y = -0.16;
      pivot.add(arm);
      const hand = mesh(new THREE.SphereGeometry(0.075, 12, 10), toon(SKIN));
      hand.position.y = -0.31;
      pivot.add(hand);
      g.add(pivot);
    }

    // ---- 頭(大頭 chibi) ----
    this.head.position.y = 1.28;
    const skull = mesh(new THREE.SphereGeometry(0.42, 24, 20), toon(SKIN));
    skull.scale.y = 0.94;
    this.head.add(skull);

    // 頭髮:後腦杓髮罩 + 瀏海
    const hairMat = toon(HAIR);
    const hairCap = mesh(new THREE.SphereGeometry(0.445, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairCap.scale.y = 0.96;
    hairCap.position.y = 0.015;
    hairCap.rotation.x = -0.22; // 往後仰,露出額頭
    this.head.add(hairCap);
    for (let i = -2; i <= 2; i++) {
      const tuft = mesh(new THREE.ConeGeometry(0.07, 0.2, 8), hairMat);
      tuft.position.set(i * 0.13, 0.3, 0.3 - Math.abs(i) * 0.03);
      tuft.rotation.x = 0.95;
      tuft.rotation.z = -i * 0.18;
      this.head.add(tuft);
    }
    const ahoge = mesh(new THREE.ConeGeometry(0.05, 0.22, 8), hairMat); // 呆毛
    ahoge.position.set(0.02, 0.44, 0);
    ahoge.rotation.z = -0.4;
    this.head.add(ahoge);

    // 眼睛(大圓眼 + 高光)
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.06, 12, 10), toon("#3a2a1e"), false);
      eye.scale.z = 0.5;
      eye.position.set(0.155 * side, -0.02, 0.375);
      this.head.add(eye);
      const glint = mesh(new THREE.SphereGeometry(0.018, 8, 6), toon("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.6 }), false);
      glint.position.set(0.155 * side + 0.025, 0.015, 0.42);
      this.head.add(glint);
      // 腮紅
      const blush = mesh(new THREE.SphereGeometry(0.05, 10, 8), toon("#ffab97"), false);
      blush.scale.z = 0.25;
      blush.position.set(0.26 * side, -0.12, 0.3);
      blush.rotation.y = 0.5 * side;
      this.head.add(blush);
    }
    // 微笑
    const smile = mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16, Math.PI), toon("#8a4a3a"), false);
    smile.position.set(0, -0.13, 0.385);
    smile.rotation.z = Math.PI;
    this.head.add(smile);

    g.add(this.head);

    // ---- 裝備掛點 ----
    this.head.add(this.attach.head);
    this.attach.crown.position.set(0, 0.33, 0);
    this.head.add(this.attach.crown);
    this.attach.handR.position.set(0, -0.31, 0);
    this.armR.add(this.attach.handR);
    this.attach.handL.position.set(0, -0.31, 0);
    this.armL.add(this.attach.handL);
    this.attach.back.position.set(0, 0.8, -0.24);
    this.bodyGroup.add(this.attach.back);
    this.attach.chest.position.set(0, 0.62, 0);
    this.bodyGroup.add(this.attach.chest);
    this.attach.belt.position.set(0, 0.4, 0);
    this.bodyGroup.add(this.attach.belt);
    g.add(this.attach.feet);
    this.attach.companion.position.set(0.85, 1.65, 0.15);
    g.add(this.attach.companion);
    this.attach.badge.position.set(0, 2.0, 0);
    g.add(this.attach.badge);

    // ---- 天賦光環 ----
    this.auraGroup.position.y = 1.0;
    g.add(this.auraGroup);
  }

  /** 開心跳一下(穿上新裝備時) */
  happyJump() {
    this.jumpT = 0;
  }

  /** 依已點亮的天賦分支更新光環粒子 */
  setAura(branches: Set<TalentBranch>) {
    for (const s of this.auraSparks) this.auraGroup.remove(s.m);
    this.auraSparks = [];
    let i = 0;
    for (const b of branches) {
      const color = BRANCH_COLORS[b];
      for (let k = 0; k < 4; k++) {
        const m = mesh(
          new THREE.OctahedronGeometry(0.045),
          toon(color, { emissive: color, emissiveIntensity: 0.9 }),
          false
        );
        this.auraGroup.add(m);
        this.auraSparks.push({
          m,
          phase: (i * 4 + k) * 1.7,
          r: 0.75 + (k % 2) * 0.2,
          h: -0.25 + ((k + i) % 3) * 0.45,
          speed: 0.7 + (k % 3) * 0.25,
        });
      }
      i++;
    }
  }

  update(t: number, dt: number) {
    // 待機:呼吸浮動 + 手臂擺動 + 頭微傾
    let bob = Math.sin(t * 2.2) * 0.03;

    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const k = this.jumpT / 0.55;
      if (k >= 1) this.jumpT = -1;
      else bob += Math.sin(Math.min(k, 1) * Math.PI) * 0.4;
    }

    this.root.position.y = bob;
    this.armL.rotation.x = Math.sin(t * 2.2) * 0.14;
    this.armR.rotation.x = -Math.sin(t * 2.2) * 0.14;
    this.armL.rotation.z = 0.1 + Math.sin(t * 1.3) * 0.04;
    this.armR.rotation.z = -0.1 - Math.sin(t * 1.3) * 0.04;
    this.head.rotation.z = Math.sin(t * 1.1) * 0.045;
    this.head.rotation.y = Math.sin(t * 0.6) * 0.12;

    // 裝備的持續動畫
    for (const { group, slot } of this.equipped.values()) {
      if (slot === "companion") {
        group.position.y = Math.sin(t * 2.6) * 0.12;
        group.rotation.y = Math.sin(t * 1.4) * 0.5;
      } else if (slot === "back") {
        group.rotation.x = 0.12 + Math.sin(t * 1.8) * 0.05;
      }
    }

    // 光環粒子環繞
    for (const s of this.auraSparks) {
      const a = t * s.speed + s.phase;
      s.m.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 1.8 + s.phase) * 0.1, Math.sin(a) * s.r);
      s.m.rotation.y = a * 2;
    }
  }
}
