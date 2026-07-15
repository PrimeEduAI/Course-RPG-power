import * as THREE from "three";
import { toon, mesh } from "./materials.ts";

// 參考圖配色:銀白甲 + 金飾 + 紅寶石 + 深藍披風
const GOLD = "#d9a94e";
const SILVER = "#dfe6ee";
const STEEL = "#b8c4d4";
const NAVY = "#4d5a94";
const RUBY = "#d94f5c";

/**
 * 每件裝備一個建模函式(低多邊形、toon 材質)。
 * 尺寸對齊 4 頭身少年/少女身形(頭 r0.27、手掛點在臂長 -0.45)。
 */
export const EQUIP_BUILDERS: Record<string, () => THREE.Group> = {
  // 冒險者頭帶(RO 初心者紅頭帶)
  helmet() {
    const g = new THREE.Group();
    const band = mesh(new THREE.TorusGeometry(0.3, 0.045, 10, 28), toon("#e63946"));
    band.rotation.x = Math.PI / 2;
    g.add(band);
    const knotL = mesh(new THREE.ConeGeometry(0.04, 0.18, 8), toon("#e63946"));
    knotL.position.set(-0.05, -0.15, -0.29);
    knotL.rotation.x = Math.PI * 0.92;
    knotL.rotation.z = 0.25;
    g.add(knotL);
    const knotR = knotL.clone();
    knotR.position.x = 0.05;
    knotR.rotation.z = -0.25;
    g.add(knotR);
    const star = mesh(new THREE.OctahedronGeometry(0.05), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.5 }));
    star.position.set(0, 0.02, 0.31);
    g.add(star);
    g.position.y = 0.08;
    g.rotation.x = 0.05;
    return g;
  },

  // 智慧之盾(參考圖:銀白盾 + 金十字 + 紅寶石)
  shield() {
    const g = new THREE.Group();
    // 盾面(上圓下尖的鳶形:圓盤 + 下尖錐)
    const face = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.045, 20), toon(SILVER));
    face.rotation.z = Math.PI / 2;
    g.add(face);
    const tip = mesh(new THREE.ConeGeometry(0.2, 0.3, 4), toon(SILVER));
    tip.position.set(0, -0.3, 0);
    tip.rotation.x = Math.PI;
    tip.rotation.y = Math.PI / 4;
    tip.scale.set(0.22, 1, 1); // 沿盾面法線壓扁,貼合盾身
    g.add(tip);
    // 銀邊
    const rim = mesh(new THREE.TorusGeometry(0.23, 0.028, 8, 24), toon(STEEL));
    rim.rotation.y = Math.PI / 2;
    g.add(rim);
    // 金十字
    const crossV = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.045), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.25 }));
    crossV.position.x = -0.035;
    g.add(crossV);
    const crossH = mesh(new THREE.BoxGeometry(0.05, 0.045, 0.2), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.25 }));
    crossH.position.set(-0.035, 0.04, 0);
    g.add(crossH);
    // 紅寶石
    const gem = mesh(new THREE.OctahedronGeometry(0.055), toon(RUBY, { emissive: RUBY, emissiveIntensity: 0.6 }));
    gem.position.set(-0.055, 0.04, 0);
    g.add(gem);
    g.position.set(-0.1, 0.06, 0.02);
    return g;
  },

  // 咒語之劍(參考圖:銀刃 + 紅十字護手)
  sword() {
    const g = new THREE.Group();
    const blade = mesh(new THREE.BoxGeometry(0.08, 0.62, 0.02), toon(SILVER, { emissive: "#bcd2f0", emissiveIntensity: 0.2 }));
    blade.position.y = 0.5;
    g.add(blade);
    const ridge = mesh(new THREE.BoxGeometry(0.02, 0.62, 0.024), toon(STEEL));
    ridge.position.y = 0.5;
    g.add(ridge);
    const bladeTip = mesh(new THREE.ConeGeometry(0.057, 0.12, 4), toon(SILVER, { emissive: "#bcd2f0", emissiveIntensity: 0.2 }));
    bladeTip.scale.z = 0.25;
    bladeTip.position.y = 0.87;
    bladeTip.rotation.y = Math.PI / 4;
    g.add(bladeTip);
    // 紅十字護手(橫桿 + 中央菱形)
    const guard = mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), toon(RUBY));
    guard.position.y = 0.17;
    g.add(guard);
    const guardGem = mesh(new THREE.OctahedronGeometry(0.05), toon(RUBY, { emissive: RUBY, emissiveIntensity: 0.5 }));
    guardGem.position.y = 0.17;
    guardGem.scale.z = 0.6;
    g.add(guardGem);
    const grip = mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.16, 10), toon("#6e4326"));
    grip.position.y = 0.07;
    g.add(grip);
    const pommel = mesh(new THREE.SphereGeometry(0.038, 10, 8), toon(GOLD));
    pommel.position.y = -0.03;
    g.add(pommel);
    g.position.set(0.04, -0.02, 0.05);
    g.rotation.x = -0.3;
    g.rotation.z = -0.55; // 往外斜,避免藏在頭後面
    return g;
  },

  // 魔法披風(參考圖:深藍長披風 + 銀邊 + 金釦)
  cape() {
    const g = new THREE.Group();
    const cloth = mesh(
      new THREE.CylinderGeometry(0.22, 0.52, 1.05, 18, 1, true, 0, Math.PI * 1.3),
      new THREE.MeshToonMaterial({ color: NAVY, side: THREE.DoubleSide })
    );
    cloth.rotation.y = Math.PI - (Math.PI * 1.3) / 2; // 開口朝前
    cloth.position.y = -0.55;
    g.add(cloth);
    // 銀色下緣
    const trim = mesh(
      new THREE.CylinderGeometry(0.505, 0.525, 0.06, 18, 1, true, 0, Math.PI * 1.3),
      new THREE.MeshToonMaterial({ color: STEEL, side: THREE.DoubleSide })
    );
    trim.rotation.y = Math.PI - (Math.PI * 1.3) / 2;
    trim.position.y = -1.05;
    g.add(trim);
    const clasp = mesh(new THREE.SphereGeometry(0.042, 10, 8), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.4 }));
    clasp.position.set(0, 0, 0.22);
    g.add(clasp);
    g.position.set(0, 0.02, 0.03);
    g.rotation.x = 0.1;
    return g;
  },

  // 故事護甲(參考圖:金色胸甲 + 大墊肩)
  armor() {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.4, 16), toon("#e3cf96"));
    plate.position.y = 0.0;
    g.add(plate);
    const trim = mesh(new THREE.TorusGeometry(0.215, 0.028, 8, 20), toon(GOLD));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.18;
    g.add(trim);
    // 大墊肩(參考圖的金色方肩甲)
    for (const side of [-1, 1]) {
      const pad = mesh(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), toon("#e3cf96"));
      pad.scale.set(1.15, 0.9, 1.15);
      pad.position.set(0.27 * side, 0.19, 0);
      pad.rotation.z = -0.35 * side;
      g.add(pad);
      const padTrim = mesh(new THREE.TorusGeometry(0.13, 0.02, 8, 16), toon(GOLD));
      padTrim.rotation.x = Math.PI / 2;
      padTrim.rotation.z = -0.35 * side;
      padTrim.position.set(0.285 * side, 0.13, 0);
      g.add(padTrim);
    }
    const emblem = mesh(new THREE.OctahedronGeometry(0.05), toon(RUBY, { emissive: RUBY, emissiveIntensity: 0.6 }));
    emblem.scale.z = 0.5;
    emblem.position.set(0, 0.05, 0.23);
    g.add(emblem);
    return g;
  },

  // 精靈場記板(飄浮小夥伴)
  clapper() {
    const g = new THREE.Group();
    const board = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.035), toon("#2e2e3e"));
    g.add(board);
    const flap = new THREE.Group();
    flap.position.set(-0.15, 0.1, 0);
    const flapBar = mesh(new THREE.BoxGeometry(0.3, 0.06, 0.035), toon("#2e2e3e"));
    flapBar.position.x = 0.15;
    flap.add(flapBar);
    for (let i = 0; i < 4; i++) {
      const stripe = mesh(new THREE.BoxGeometry(0.045, 0.062, 0.037), toon("#ffffff"));
      stripe.position.set(0.045 + i * 0.075, 0, 0);
      stripe.rotation.z = 0.5;
      stripe.scale.y = 0.8;
      flap.add(stripe);
    }
    flap.rotation.z = 0.35;
    g.add(flap);
    for (const side of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.022, 8, 6), toon("#ffffff", { emissive: "#ffffff", emissiveIntensity: 0.8 }));
      eye.position.set(0.06 * side, -0.02, 0.03);
      g.add(eye);
    }
    const wing = mesh(new THREE.ConeGeometry(0.05, 0.14, 6), toon("#bfe8ff", { emissive: "#bfe8ff", emissiveIntensity: 0.4 }));
    wing.position.set(-0.19, 0.02, 0);
    wing.rotation.z = 1.2;
    g.add(wing);
    const wing2 = wing.clone();
    wing2.position.x = 0.19;
    wing2.rotation.z = -1.2;
    g.add(wing2);
    return g;
  },

  // 疾風之靴(參考圖:銀色鎧靴)
  boots() {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const boot = new THREE.Group();
      const shaft = mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.3, 12), toon(STEEL));
      shaft.position.y = 0.21;
      boot.add(shaft);
      const cuff = mesh(new THREE.TorusGeometry(0.088, 0.02, 8, 14), toon(GOLD));
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = 0.35;
      boot.add(cuff);
      const foot = mesh(new THREE.SphereGeometry(0.1, 12, 10), toon(SILVER));
      foot.scale.set(1, 0.6, 1.45);
      foot.position.set(0, 0.06, 0.05);
      boot.add(foot);
      const wing = mesh(new THREE.ConeGeometry(0.035, 0.13, 6), toon("#ffffff", { emissive: "#dff1ff", emissiveIntensity: 0.4 }));
      wing.position.set(0.09 * side, 0.24, -0.04);
      wing.rotation.z = side * -1.9;
      boot.add(wing);
      boot.position.set(0.115 * side, 0, 0.01);
      g.add(boot);
    }
    return g;
  },

  // 音樂魔鈴(腰帶 + 金鈴鐺)
  bell() {
    const g = new THREE.Group();
    const belt = mesh(new THREE.TorusGeometry(0.195, 0.032, 8, 24), toon("#6e4326"));
    belt.rotation.x = Math.PI / 2;
    g.add(belt);
    const bell = mesh(new THREE.SphereGeometry(0.07, 12, 10), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.45 }));
    bell.position.set(0.15, -0.05, 0.13);
    g.add(bell);
    const slit = mesh(new THREE.BoxGeometry(0.016, 0.05, 0.016), toon("#6e4326"));
    slit.position.set(0.15, -0.09, 0.18);
    g.add(slit);
    const note = mesh(new THREE.SphereGeometry(0.03, 8, 6), toon("#ff6fae", { emissive: "#ff6fae", emissiveIntensity: 0.6 }));
    note.position.set(-0.15, 0.04, 0.14);
    g.add(note);
    return g;
  },

  // 大導演皇冠
  crown() {
    const g = new THREE.Group();
    const ring = mesh(
      new THREE.CylinderGeometry(0.145, 0.16, 0.09, 16, 1, true),
      new THREE.MeshToonMaterial({ color: GOLD, side: THREE.DoubleSide })
    );
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.035, 0.11, 6), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.35 }));
      spike.position.set(Math.cos(a) * 0.15, 0.09, Math.sin(a) * 0.15);
      g.add(spike);
    }
    const gem = mesh(new THREE.OctahedronGeometry(0.045), toon(RUBY, { emissive: RUBY, emissiveIntensity: 0.7 }));
    gem.position.set(0, 0.05, 0.16);
    g.add(gem);
    g.position.y = 0.06;
    g.rotation.x = -0.05;
    return g;
  },

  // 通用發光徽章
  badge() {
    const g = new THREE.Group();
    const star = mesh(new THREE.OctahedronGeometry(0.09), toon("#ffd166", { emissive: "#ffd166", emissiveIntensity: 0.8 }));
    g.add(star);
    return g;
  },
};

export function buildEquip(model: string): THREE.Group {
  const builder = EQUIP_BUILDERS[model] ?? EQUIP_BUILDERS.badge;
  const group = builder();
  group.name = `equip-${model}`;
  return group;
}
