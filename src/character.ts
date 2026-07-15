import * as THREE from "three";
import { toon, mesh } from "./materials.ts";
import type { EquipSlot, TalentBranch } from "./content.ts";
import { BRANCH_COLORS } from "./content.ts";

export type HeroVariant = "boy" | "girl";

const SKIN = "#ffdcc0";
const TUNIC = "#f2e8d2";   // 奶油色底衣(參考圖)
const NAVY = "#3f4c80";    // 深藍(褲/領/披風系)
const BELT = "#8a5a35";
const GOLD = "#d9a94e";
const BOY_HAIR = "#9fc3d4";  // 淺藍灰短髮
const GIRL_HAIR = "#ecd07a"; // 金色長髮

interface EquippedEntry {
  group: THREE.Group;
  slot: EquipSlot;
}

/**
 * RO 騎士風少年/少女冒險者(約4頭身 SD 動漫比例),
 * 程式化低多邊形 + toon 材質,含裝備掛點與待機動畫。
 */
export class Adventurer {
  root = new THREE.Group();
  readonly variant: HeroVariant;

  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();

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

  private jumpT = -1;

  constructor(variant: HeroVariant = "boy") {
    this.variant = variant;
    this.build();
  }

  private build() {
    const g = this.root;
    g.name = "adventurer";

    // ---- 腿(深藍緊身褲) ----
    const legGeo = new THREE.CapsuleGeometry(0.068, 0.72, 6, 10);
    for (const side of [-1, 1]) {
      const leg = mesh(legGeo, toon(NAVY));
      leg.position.set(0.115 * side, 0.5, 0);
      g.add(leg);
      const shoe = mesh(new THREE.SphereGeometry(0.09, 12, 10), toon("#6b5a4a"));
      shoe.scale.set(1, 0.55, 1.5);
      shoe.position.set(0.115 * side, 0.05, 0.045);
      g.add(shoe);
    }

    // ---- 臀部/短裙擺(深藍) ----
    const hip = mesh(new THREE.CylinderGeometry(0.175, 0.215, 0.16, 16), toon(NAVY));
    hip.position.y = 0.97;
    g.add(hip);

    // ---- 軀幹(奶油色騎士底衣) ----
    const torso = mesh(new THREE.CylinderGeometry(0.19, 0.165, 0.58, 16), toon(TUNIC));
    torso.position.y = 1.32;
    g.add(torso);
    // 高領(深藍,像參考圖立領)
    const collar = mesh(new THREE.CylinderGeometry(0.1, 0.135, 0.12, 12), toon(NAVY));
    collar.position.y = 1.62;
    g.add(collar);
    // 腰帶 + 金釦
    const belt = mesh(new THREE.TorusGeometry(0.175, 0.035, 8, 20), toon(BELT));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.05;
    g.add(belt);
    const buckle = mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.25 }));
    buckle.position.set(0, 1.05, 0.17);
    g.add(buckle);
    // 前擺布片(奶油色,騎士 tabard)
    const tabard = mesh(new THREE.BoxGeometry(0.17, 0.5, 0.022), toon(TUNIC));
    tabard.position.set(0, 0.74, 0.15);
    tabard.rotation.x = 0.06;
    g.add(tabard);
    const hem = mesh(new THREE.BoxGeometry(0.17, 0.05, 0.024), toon(GOLD));
    hem.position.set(0, 0.51, 0.165);
    hem.rotation.x = 0.06;
    g.add(hem);
    // 少女:加一圈小裙擺
    if (this.variant === "girl") {
      const skirt = mesh(
        new THREE.CylinderGeometry(0.19, 0.31, 0.24, 16, 1, true),
        new THREE.MeshToonMaterial({ color: TUNIC, side: THREE.DoubleSide })
      );
      skirt.position.y = 0.92;
      g.add(skirt);
    }

    // ---- 手臂(肩樞紐) ----
    for (const side of [-1, 1] as const) {
      const pivot = side === 1 ? this.armR : this.armL;
      pivot.position.set(0.245 * side, 1.52, 0);
      // 肩口小圓(遮接縫)
      const cap = mesh(new THREE.SphereGeometry(0.078, 10, 8), toon(TUNIC));
      pivot.add(cap);
      // 袖(上臂奶油色)
      const sleeve = mesh(new THREE.CapsuleGeometry(0.058, 0.14, 6, 10), toon(TUNIC));
      sleeve.position.y = -0.11;
      pivot.add(sleeve);
      // 前臂(膚色)
      const forearm = mesh(new THREE.CapsuleGeometry(0.048, 0.16, 6, 10), toon(SKIN));
      forearm.position.y = -0.31;
      pivot.add(forearm);
      const hand = mesh(new THREE.SphereGeometry(0.058, 12, 10), toon(SKIN));
      hand.position.y = -0.45;
      pivot.add(hand);
      g.add(pivot);
    }

    // ---- 頸 + 頭 ----
    const neck = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 10), toon(SKIN));
    neck.position.y = 1.66;
    g.add(neck);

    this.head.position.y = 1.93;
    const skull = mesh(new THREE.SphereGeometry(0.27, 24, 20), toon(SKIN));
    skull.scale.set(0.96, 1, 0.96);
    this.head.add(skull);

    this.buildFace();
    if (this.variant === "boy") this.buildBoyHair();
    else this.buildGirlHair();

    g.add(this.head);

    // ---- 裝備掛點 ----
    this.head.add(this.attach.head);
    this.attach.crown.position.set(0, 0.3, 0);
    this.head.add(this.attach.crown);
    this.attach.handR.position.set(0, -0.45, 0);
    this.armR.add(this.attach.handR);
    this.attach.handL.position.set(0, -0.45, 0);
    this.armL.add(this.attach.handL);
    this.attach.back.position.set(0, 1.5, -0.17);
    g.add(this.attach.back);
    this.attach.chest.position.set(0, 1.34, 0);
    g.add(this.attach.chest);
    this.attach.belt.position.set(0, 1.05, 0);
    g.add(this.attach.belt);
    g.add(this.attach.feet);
    this.attach.companion.position.set(0.78, 1.98, 0.12);
    g.add(this.attach.companion);
    this.attach.badge.position.set(0, 2.55, 0);
    g.add(this.attach.badge);

    // ---- 天賦光環 ----
    this.auraGroup.position.y = 1.15;
    g.add(this.auraGroup);
  }

  private buildFace() {
    const irisColor = this.variant === "boy" ? "#5a4a2e" : "#8a6a30";
    for (const side of [-1, 1]) {
      // 大直立橢圓眼(動漫感)
      const eye = mesh(new THREE.SphereGeometry(0.052, 12, 10), toon("#2e2418"), false);
      eye.scale.set(0.82, 1.35, 0.45);
      eye.position.set(0.1 * side, -0.015, 0.235);
      this.head.add(eye);
      const iris = mesh(new THREE.SphereGeometry(0.03, 10, 8), toon(irisColor, { emissive: irisColor, emissiveIntensity: 0.35 }), false);
      iris.scale.set(0.8, 1.1, 0.4);
      iris.position.set(0.1 * side, -0.025, 0.262);
      this.head.add(iris);
      const glint = mesh(new THREE.SphereGeometry(0.013, 8, 6), toon("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.7 }), false);
      glint.position.set(0.1 * side + 0.018, 0.02, 0.278);
      this.head.add(glint);
      // 淡腮紅
      const blush = mesh(new THREE.SphereGeometry(0.035, 10, 8), toon("#ffb9a0"), false);
      blush.scale.z = 0.2;
      blush.position.set(0.165 * side, -0.09, 0.195);
      blush.rotation.y = 0.55 * side;
      this.head.add(blush);
    }
    const smile = mesh(new THREE.TorusGeometry(0.032, 0.009, 8, 16, Math.PI), toon("#a05a48"), false);
    smile.position.set(0, -0.105, 0.25);
    smile.rotation.z = Math.PI;
    this.head.add(smile);
  }

  private buildBoyHair() {
    const mat = toon(BOY_HAIR);
    // 髮罩
    const cap = mesh(new THREE.SphereGeometry(0.29, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), mat);
    cap.position.y = 0.01;
    cap.rotation.x = -0.18;
    this.head.add(cap);
    // 上豎短刺(參考圖的短亂髮)
    const spikes: [number, number, number, number, number][] = [
      // [x, y, z, rotX, rotZ]
      [0, 0.29, 0.08, 0.35, 0],
      [0.11, 0.27, 0.05, 0.3, -0.5],
      [-0.11, 0.27, 0.05, 0.3, 0.5],
      [0.06, 0.28, -0.1, -0.45, -0.25],
      [-0.06, 0.28, -0.1, -0.45, 0.25],
      [0.17, 0.22, -0.05, -0.2, -0.85],
      [-0.17, 0.22, -0.05, -0.2, 0.85],
      [0, 0.26, -0.16, -0.75, 0],
    ];
    for (const [x, y, z, rx, rz] of spikes) {
      const spike = mesh(new THREE.ConeGeometry(0.055, 0.19, 7), mat);
      spike.position.set(x, y, z);
      spike.rotation.x = rx;
      spike.rotation.z = rz;
      this.head.add(spike);
    }
    // 瀏海(短,不遮眼)
    for (let i = -2; i <= 2; i++) {
      const bang = mesh(new THREE.ConeGeometry(0.05, 0.12, 7), mat);
      bang.position.set(i * 0.085, 0.16, 0.21 - Math.abs(i) * 0.015);
      bang.rotation.x = 1.25;
      bang.rotation.z = -i * 0.12;
      this.head.add(bang);
    }
    // 鬢角
    for (const side of [-1, 1]) {
      const burn = mesh(new THREE.ConeGeometry(0.04, 0.14, 7), mat);
      burn.position.set(0.245 * side, -0.03, 0.08);
      burn.rotation.x = Math.PI;
      this.head.add(burn);
    }
  }

  private buildGirlHair() {
    const mat = toon(GIRL_HAIR);
    // 髮罩(更包覆)
    const cap = mesh(new THREE.SphereGeometry(0.295, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
    cap.position.y = 0.02;
    cap.rotation.x = -0.26; // 往後仰,露出額頭與眼睛
    this.head.add(cap);
    // 中分瀏海(貼額頭往兩側斜,不遮眼)
    for (const side of [-1, 1]) {
      const bang = mesh(new THREE.ConeGeometry(0.062, 0.22, 8), mat);
      bang.position.set(0.1 * side, 0.16, 0.2);
      bang.rotation.x = 1.42;
      bang.rotation.z = -side * 0.72;
      this.head.add(bang);
      // 兩側長髮束(垂到肩)
      const lock = mesh(new THREE.CapsuleGeometry(0.05, 0.3, 6, 10), mat);
      lock.position.set(0.235 * side, -0.22, 0.06);
      lock.rotation.z = side * 0.12;
      this.head.add(lock);
    }
    // 後髮量(垂到背)
    const back = mesh(new THREE.SphereGeometry(0.24, 16, 12), mat);
    back.scale.set(0.95, 1.5, 0.72);
    back.position.set(0, -0.18, -0.13);
    this.head.add(back);
    // 側邊辮子(參考圖的麻花辮)
    const braidBeads: [number, number, number, number][] = [
      [0.21, -0.3, -0.06, 0.052],
      [0.25, -0.42, 0.0, 0.047],
      [0.27, -0.53, 0.06, 0.042],
      [0.28, -0.63, 0.11, 0.037],
    ];
    for (const [x, y, z, r] of braidBeads) {
      const bead = mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      bead.position.set(x, y, z);
      this.head.add(bead);
    }
    // 辮尾綁繩
    const tie = mesh(new THREE.ConeGeometry(0.03, 0.09, 7), toon("#fff3d6"));
    tie.position.set(0.285, -0.71, 0.15);
    tie.rotation.x = Math.PI;
    this.head.add(tie);
    // 小呆毛
    const ahoge = mesh(new THREE.ConeGeometry(0.03, 0.14, 7), mat);
    ahoge.position.set(0.02, 0.3, 0.02);
    ahoge.rotation.z = -0.35;
    this.head.add(ahoge);
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
          r: 0.72 + (k % 2) * 0.22,
          h: -0.35 + ((k + i) % 3) * 0.5,
          speed: 0.7 + (k % 3) * 0.25,
        });
      }
      i++;
    }
  }

  update(t: number, dt: number) {
    let bob = Math.sin(t * 2.2) * 0.03;

    if (this.jumpT >= 0) {
      this.jumpT += dt;
      const k = this.jumpT / 0.55;
      if (k >= 1) this.jumpT = -1;
      else bob += Math.sin(Math.min(k, 1) * Math.PI) * 0.4;
    }

    this.root.position.y = bob;
    this.armL.rotation.x = Math.sin(t * 2.2) * 0.12;
    this.armR.rotation.x = -Math.sin(t * 2.2) * 0.12;
    this.armL.rotation.z = 0.08 + Math.sin(t * 1.3) * 0.035;
    this.armR.rotation.z = -0.08 - Math.sin(t * 1.3) * 0.035;
    this.head.rotation.z = Math.sin(t * 1.1) * 0.04;
    this.head.rotation.y = Math.sin(t * 0.6) * 0.11;

    for (const { group, slot } of this.equipped.values()) {
      if (slot === "companion") {
        group.position.y = Math.sin(t * 2.6) * 0.12;
        group.rotation.y = Math.sin(t * 1.4) * 0.5;
      } else if (slot === "back") {
        group.rotation.x = 0.1 + Math.sin(t * 1.8) * 0.05;
      }
    }

    for (const s of this.auraSparks) {
      const a = t * s.speed + s.phase;
      s.m.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 1.8 + s.phase) * 0.1, Math.sin(a) * s.r);
      s.m.rotation.y = a * 2;
    }
  }
}
