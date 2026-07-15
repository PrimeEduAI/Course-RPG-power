import * as THREE from "three";
import { toon, mesh } from "./materials.ts";
import type { EquipSlot, TalentBranch } from "./content.ts";
import { AuraRig, makeAttachSlots, type Hero, type HeroVariant, type EquippedEntry } from "./heroTypes.ts";

export type { HeroVariant } from "./heroTypes.ts";

const SKIN = "#ffdcc0";
const TUNIC = "#f2e8d2";   // 奶油色底衣(參考圖)
const NAVY = "#3f4c80";    // 深藍(褲/領/披風系)
const BELT = "#8a5a35";
const GOLD = "#d9a94e";
const BOY_HAIR = "#a7c9db";     // 淺藍灰短髮(底色)
const BOY_HAIR_HI = "#c9e4f2";  // 髮絲亮色
const GIRL_HAIR = "#f3d98e";    // 金色長髮(亮)
const GIRL_HAIR_DK = "#dfbd66"; // 金髮陰影色
const BOY_EYE = "#3f7ac2";      // 少年藍瞳
const GIRL_EYE = "#c2892e";     // 少女金瞳

// 卡通描邊:反向殼(inverted hull),toon 角色質感關鍵
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: "#232b47", side: THREE.BackSide });
function outlined<T extends THREE.Mesh>(m: T, s = 1.05): T {
  const hull = new THREE.Mesh(m.geometry, OUTLINE_MAT);
  hull.scale.setScalar(s);
  m.add(hull);
  return m;
}

/**
 * RO 騎士風少年/少女冒險者(約4頭身 SD 動漫比例),
 * 程式化低多邊形 + toon 材質,含裝備掛點與待機動畫。
 * 若 public/models/ 有外部模型,會改用 modelHero.ts 載入,此為 fallback。
 */
export class Adventurer implements Hero {
  root = new THREE.Group();
  readonly variant: HeroVariant;

  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();

  attach = makeAttachSlots();
  equipped = new Map<string, EquippedEntry>();

  private aura = new AuraRig();
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
      g.add(outlined(leg));
      const shoe = mesh(new THREE.SphereGeometry(0.09, 12, 10), toon("#6b5a4a"));
      shoe.scale.set(1, 0.55, 1.5);
      shoe.position.set(0.115 * side, 0.05, 0.045);
      g.add(outlined(shoe, 1.07));
    }

    // ---- 臀部/短裙擺(深藍) ----
    const hip = mesh(new THREE.CylinderGeometry(0.175, 0.215, 0.16, 16), toon(NAVY));
    hip.position.y = 0.97;
    g.add(outlined(hip));

    // ---- 軀幹(奶油色騎士底衣) ----
    const torso = mesh(new THREE.CylinderGeometry(0.19, 0.165, 0.58, 16), toon(TUNIC));
    torso.position.y = 1.32;
    g.add(outlined(torso, 1.04));
    // 高領(深藍,像參考圖立領)
    const collar = mesh(new THREE.CylinderGeometry(0.1, 0.135, 0.12, 12), toon(NAVY));
    collar.position.y = 1.62;
    g.add(outlined(collar, 1.06));
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
      pivot.add(outlined(cap, 1.07));
      // 袖(上臂奶油色)
      const sleeve = mesh(new THREE.CapsuleGeometry(0.058, 0.14, 6, 10), toon(TUNIC));
      sleeve.position.y = -0.11;
      pivot.add(outlined(sleeve, 1.06));
      // 前臂(膚色)
      const forearm = mesh(new THREE.CapsuleGeometry(0.048, 0.16, 6, 10), toon(SKIN));
      forearm.position.y = -0.31;
      pivot.add(outlined(forearm, 1.06));
      const hand = mesh(new THREE.SphereGeometry(0.058, 12, 10), toon(SKIN));
      hand.position.y = -0.45;
      pivot.add(outlined(hand, 1.07));
      g.add(pivot);
    }

    // ---- 頸 + 頭 ----
    const neck = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 10), toon(SKIN));
    neck.position.y = 1.66;
    g.add(outlined(neck, 1.08));

    this.head.position.y = 1.93;
    const skull = mesh(new THREE.SphereGeometry(0.27, 24, 20), toon(SKIN));
    skull.scale.set(0.96, 1, 0.96);
    this.head.add(outlined(skull, 1.035));

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
    this.aura.group.position.y = 1.15;
    g.add(this.aura.group);
  }

  private buildFace() {
    const irisColor = this.variant === "boy" ? BOY_EYE : GIRL_EYE;
    const browColor = this.variant === "boy" ? "#7fa3b8" : "#c9a250";
    for (const side of [-1, 1]) {
      // 動漫大眼:眼白 + 彩色虹膜 + 瞳孔 + 高光
      const sclera = mesh(new THREE.SphereGeometry(0.06, 14, 12), toon("#ffffff"), false);
      sclera.scale.set(0.85, 1.28, 0.36);
      sclera.position.set(0.1 * side, -0.02, 0.235);
      this.head.add(sclera);
      const iris = mesh(new THREE.SphereGeometry(0.044, 12, 10), toon(irisColor, { emissive: irisColor, emissiveIntensity: 0.4 }), false);
      iris.scale.set(0.82, 1.12, 0.4);
      iris.position.set(0.1 * side, -0.024, 0.256);
      this.head.add(iris);
      const pupil = mesh(new THREE.SphereGeometry(0.021, 10, 8), toon("#221708"), false);
      pupil.scale.set(0.9, 1.15, 0.4);
      pupil.position.set(0.1 * side, -0.026, 0.272);
      this.head.add(pupil);
      const glint = mesh(new THREE.SphereGeometry(0.012, 8, 6), toon("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.9 }), false);
      glint.position.set(0.1 * side + 0.016, 0.004, 0.281);
      this.head.add(glint);
      // 眉毛
      const brow = mesh(new THREE.BoxGeometry(0.082, 0.014, 0.012), toon(browColor), false);
      brow.position.set(0.1 * side, 0.08, 0.243);
      brow.rotation.z = -side * 0.16;
      brow.rotation.y = -side * 0.35;
      this.head.add(brow);
      // 淡腮紅
      const blush = mesh(new THREE.SphereGeometry(0.032, 10, 8), toon("#ffb9a0"), false);
      blush.scale.z = 0.18;
      blush.position.set(0.168 * side, -0.095, 0.19);
      blush.rotation.y = 0.55 * side;
      this.head.add(blush);
    }
    const smile = mesh(new THREE.TorusGeometry(0.03, 0.009, 8, 16, Math.PI), toon("#a05a48"), false);
    smile.position.set(0, -0.108, 0.252);
    smile.rotation.z = Math.PI;
    this.head.add(smile);
  }

  private buildBoyHair() {
    const base = toon(BOY_HAIR);
    const hi = toon(BOY_HAIR_HI);
    // 髮罩(帶描邊)
    const cap = mesh(new THREE.SphereGeometry(0.288, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), base);
    cap.position.y = 0.015;
    cap.rotation.x = -0.22;
    this.head.add(outlined(cap, 1.045));
    // 往後上掃的髮刺(雙色、大小錯落)
    const spikes: [number, number, number, number, number, number][] = [
      // [x, y, z, rotX, rotZ, size]
      [0, 0.3, 0.02, 0.5, 0, 1.25],
      [0.12, 0.28, 0, 0.45, -0.55, 1.05],
      [-0.12, 0.28, 0, 0.45, 0.55, 1.05],
      [0.06, 0.29, -0.12, -0.5, -0.3, 1.15],
      [-0.06, 0.29, -0.12, -0.5, 0.3, 1.15],
      [0.18, 0.22, -0.08, -0.35, -0.9, 0.9],
      [-0.18, 0.22, -0.08, -0.35, 0.9, 0.9],
      [0, 0.25, -0.2, -0.9, 0, 1.0],
      [0.1, 0.25, 0.13, 0.85, -0.35, 0.8],
      [-0.1, 0.25, 0.13, 0.85, 0.35, 0.8],
    ];
    spikes.forEach(([x, y, z, rx, rz, s], i) => {
      const spike = mesh(new THREE.ConeGeometry(0.055 * s, 0.22 * s, 7), i % 3 === 0 ? hi : base);
      spike.position.set(x, y, z);
      spike.rotation.x = rx;
      spike.rotation.z = rz;
      this.head.add(spike);
    });
    // 前瀏海(尖端朝下垂蓋額頭,遮住髮罩硬邊,鋸齒動漫感)
    const bangs: [number, number, number, number, number][] = [
      // [x, y, z, rz(外撇), size]
      [-0.17, 0.14, 0.215, 0.45, 1.0],
      [-0.09, 0.17, 0.248, 0.2, 0.9],
      [0, 0.18, 0.258, 0, 1.1],
      [0.09, 0.17, 0.248, -0.2, 0.9],
      [0.17, 0.14, 0.215, -0.45, 1.0],
    ];
    bangs.forEach(([x, y, z, rz, s], i) => {
      const bang = mesh(new THREE.ConeGeometry(0.052 * s, 0.19 * s, 7), i % 2 ? base : hi);
      bang.position.set(x, y, z);
      bang.rotation.x = Math.PI * 0.9; // 尖端朝下、微微外翻
      bang.rotation.z = rz;
      this.head.add(bang);
    });
    // 鬢角
    for (const side of [-1, 1]) {
      const burn = mesh(new THREE.ConeGeometry(0.038, 0.16, 7), base);
      burn.position.set(0.25 * side, -0.05, 0.07);
      burn.rotation.x = Math.PI;
      this.head.add(burn);
    }
  }

  private buildGirlHair() {
    const base = toon(GIRL_HAIR);
    const dk = toon(GIRL_HAIR_DK);
    // 髮罩(帶描邊,往後仰露出額頭)
    const cap = mesh(new THREE.SphereGeometry(0.295, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), base);
    cap.position.y = 0.02;
    cap.rotation.x = -0.26;
    this.head.add(outlined(cap, 1.045));
    for (const side of [-1, 1]) {
      // 中分瀏海(內側大片,尖端朝下垂蓋額頭)
      const bang = mesh(new THREE.ConeGeometry(0.06, 0.22, 8), base);
      bang.position.set(0.08 * side, 0.16, 0.245);
      bang.rotation.x = Math.PI * 0.92;
      bang.rotation.z = -side * 0.35;
      this.head.add(bang);
      // 側瀏海(外側小片,陰影色,垂在臉頰旁)
      const bang2 = mesh(new THREE.ConeGeometry(0.048, 0.18, 8), dk);
      bang2.position.set(0.185 * side, 0.12, 0.205);
      bang2.rotation.x = Math.PI * 0.88;
      bang2.rotation.z = -side * 0.6;
      this.head.add(bang2);
      // 兩側長髮束(兩段,帶弧度垂到肩)
      const lockA = mesh(new THREE.CapsuleGeometry(0.05, 0.24, 6, 10), base);
      lockA.position.set(0.235 * side, -0.17, 0.06);
      lockA.rotation.z = side * 0.1;
      this.head.add(outlined(lockA, 1.06));
      const lockB = mesh(new THREE.CapsuleGeometry(0.04, 0.2, 6, 10), dk);
      lockB.position.set(0.25 * side, -0.4, 0.08);
      lockB.rotation.z = -side * 0.08;
      this.head.add(lockB);
    }
    // 後髮量(垂到背,帶描邊)
    const back = mesh(new THREE.SphereGeometry(0.24, 16, 12), base);
    back.scale.set(0.95, 1.55, 0.74);
    back.position.set(0, -0.2, -0.13);
    this.head.add(outlined(back, 1.04));
    // 側邊辮子(陰影色,參考圖的麻花辮)
    const braidBeads: [number, number, number, number][] = [
      [0.21, -0.3, -0.06, 0.052],
      [0.25, -0.42, 0.0, 0.047],
      [0.27, -0.53, 0.06, 0.042],
      [0.28, -0.63, 0.11, 0.037],
    ];
    for (const [x, y, z, r] of braidBeads) {
      const bead = mesh(new THREE.SphereGeometry(r, 10, 8), dk);
      bead.position.set(x, y, z);
      this.head.add(bead);
    }
    // 辮尾綁繩
    const tie = mesh(new THREE.ConeGeometry(0.03, 0.09, 7), toon("#fff3d6"));
    tie.position.set(0.285, -0.71, 0.15);
    tie.rotation.x = Math.PI;
    this.head.add(tie);
    // 小呆毛
    const ahoge = mesh(new THREE.ConeGeometry(0.03, 0.14, 7), base);
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
    this.aura.set(branches);
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

    this.aura.update(t);
  }
}
