import * as THREE from "three";
import { toon, mesh } from "./materials.ts";

const GOLD = "#f4b942";
const SILVER = "#d7e0ea";

/**
 * 每件裝備一個建模函式(低多邊形、toon 材質)。
 * 回傳的 group 的 position/rotation 即穿在掛點上的最終姿勢。
 */
export const EQUIP_BUILDERS: Record<string, () => THREE.Group> = {
  // 冒險者頭帶(RO 初心者風紅頭帶)
  helmet() {
    const g = new THREE.Group();
    const band = mesh(new THREE.TorusGeometry(0.475, 0.065, 10, 28), toon("#e63946"));
    band.rotation.x = Math.PI / 2;
    g.add(band);
    const knotL = mesh(new THREE.ConeGeometry(0.055, 0.26, 8), toon("#e63946"));
    knotL.position.set(-0.07, -0.22, -0.46);
    knotL.rotation.x = Math.PI * 0.92;
    knotL.rotation.z = 0.25;
    g.add(knotL);
    const knotR = knotL.clone();
    knotR.position.x = 0.07;
    knotR.rotation.z = -0.25;
    g.add(knotR);
    const star = mesh(new THREE.OctahedronGeometry(0.07), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.5 }));
    star.position.set(0, 0.02, 0.5);
    g.add(star);
    g.position.y = 0.16;
    g.rotation.x = 0.03; // 微微前傾,壓在瀏海上
    return g;
  },

  // 智慧之盾
  shield() {
    const g = new THREE.Group();
    const face = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 20), toon("#5b8fd4"));
    face.rotation.z = Math.PI / 2;
    g.add(face);
    const rim = mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 24), toon(GOLD));
    rim.rotation.y = Math.PI / 2;
    g.add(rim);
    const gem = mesh(new THREE.OctahedronGeometry(0.07), toon("#ffe9a8", { emissive: "#ffd166", emissiveIntensity: 0.6 }));
    gem.position.x = -0.05;
    g.add(gem);
    g.position.set(-0.12, 0.05, 0.02);
    return g;
  },

  // 咒語之劍
  sword() {
    const g = new THREE.Group();
    const blade = mesh(new THREE.BoxGeometry(0.075, 0.5, 0.022), toon(SILVER, { emissive: "#9fc4ff", emissiveIntensity: 0.25 }));
    blade.position.y = 0.42;
    g.add(blade);
    const tip = mesh(new THREE.ConeGeometry(0.052, 0.12, 4), toon(SILVER, { emissive: "#9fc4ff", emissiveIntensity: 0.25 }));
    tip.scale.z = 0.3;
    tip.position.y = 0.72;
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
    const guard = mesh(new THREE.BoxGeometry(0.2, 0.045, 0.05), toon(GOLD));
    guard.position.y = 0.16;
    g.add(guard);
    const grip = mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.16, 10), toon("#7a4a2f"));
    grip.position.y = 0.07;
    g.add(grip);
    const pommel = mesh(new THREE.SphereGeometry(0.04, 10, 8), toon(GOLD));
    pommel.position.y = -0.02;
    g.add(pommel);
    g.position.set(0.04, -0.02, 0.06);
    g.rotation.x = -0.3;
    g.rotation.z = -0.55; // 往外斜,避免藏在大頭後面
    return g;
  },

  // 魔法披風
  cape() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.3, 0.52, 0.8, 18, 1, true, 0, Math.PI * 1.25);
    const cloth = mesh(geo, new THREE.MeshToonMaterial({ color: "#d64550", side: THREE.DoubleSide }));
    (cloth.material as THREE.MeshToonMaterial).gradientMap = null;
    cloth.rotation.y = Math.PI - Math.PI * 1.25 / 2; // 開口朝前
    cloth.position.y = -0.42;
    g.add(cloth);
    const clasp = mesh(new THREE.SphereGeometry(0.05, 10, 8), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.4 }));
    clasp.position.set(0, -0.02, 0.3);
    g.add(clasp);
    g.position.set(0, 0.02, 0.06);
    g.rotation.x = 0.12;
    return g;
  },

  // 故事護甲(胸甲 + 肩甲)
  armor() {
    const g = new THREE.Group();
    const plate = mesh(new THREE.CylinderGeometry(0.245, 0.335, 0.42, 16), toon("#8fb3d9"));
    plate.position.y = 0.03;
    g.add(plate);
    const trim = mesh(new THREE.TorusGeometry(0.25, 0.03, 8, 20), toon(GOLD));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.22;
    g.add(trim);
    for (const side of [-1, 1]) {
      const pad = mesh(new THREE.SphereGeometry(0.13, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), toon("#6f96c2"));
      pad.position.set(0.3 * side, 0.2, 0);
      pad.rotation.z = -0.4 * side;
      g.add(pad);
    }
    const emblem = mesh(new THREE.OctahedronGeometry(0.06), toon("#ffe9a8", { emissive: "#ffd166", emissiveIntensity: 0.6 }));
    emblem.scale.z = 0.5;
    emblem.position.set(0, 0.08, 0.3);
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
    // 小眼睛讓它像精靈
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

  // 疾風之靴
  boots() {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const boot = new THREE.Group();
      const shaft = mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.2, 12), toon("#c2703d"));
      shaft.position.y = 0.16;
      boot.add(shaft);
      const foot = mesh(new THREE.SphereGeometry(0.12, 12, 10), toon("#c2703d"));
      foot.scale.set(1, 0.62, 1.4);
      foot.position.set(0, 0.065, 0.05);
      boot.add(foot);
      const wing = mesh(new THREE.ConeGeometry(0.04, 0.14, 6), toon("#ffffff", { emissive: "#dff1ff", emissiveIntensity: 0.4 }));
      wing.position.set(0.1 * side, 0.18, -0.05);
      wing.rotation.z = side * -1.9;
      boot.add(wing);
      boot.position.set(0.13 * side, 0, 0.01);
      g.add(boot);
    }
    return g;
  },

  // 音樂魔鈴(腰帶 + 金鈴鐺)
  bell() {
    const g = new THREE.Group();
    const belt = mesh(new THREE.TorusGeometry(0.315, 0.042, 8, 24), toon("#7a4a2f"));
    belt.rotation.x = Math.PI / 2;
    g.add(belt);
    const bell = mesh(new THREE.SphereGeometry(0.09, 12, 10), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.45 }));
    bell.position.set(0.24, 0.02, 0.22);
    g.add(bell);
    const slit = mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02), toon("#7a4a2f"));
    slit.position.set(0.24, -0.03, 0.28);
    g.add(slit);
    const note = mesh(new THREE.SphereGeometry(0.035, 8, 6), toon("#ff6fae", { emissive: "#ff6fae", emissiveIntensity: 0.6 }));
    note.position.set(-0.2, 0.06, 0.26);
    g.add(note);
    return g;
  },

  // 大導演皇冠
  crown() {
    const g = new THREE.Group();
    const ring = mesh(new THREE.CylinderGeometry(0.19, 0.21, 0.11, 16, 1, true), new THREE.MeshToonMaterial({ color: GOLD, side: THREE.DoubleSide }));
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.045, 0.14, 6), toon(GOLD, { emissive: GOLD, emissiveIntensity: 0.35 }));
      spike.position.set(Math.cos(a) * 0.195, 0.11, Math.sin(a) * 0.195);
      g.add(spike);
    }
    const gem = mesh(new THREE.OctahedronGeometry(0.055), toon("#ff5d73", { emissive: "#ff5d73", emissiveIntensity: 0.7 }));
    gem.position.set(0, 0.06, 0.21);
    g.add(gem);
    g.position.y = 0.05;
    g.rotation.x = -0.08;
    return g;
  },

  // 通用發光徽章(未指定模型的知識點)
  badge() {
    const g = new THREE.Group();
    const star = mesh(new THREE.OctahedronGeometry(0.1), toon("#ffd166", { emissive: "#ffd166", emissiveIntensity: 0.8 }));
    g.add(star);
    return g;
  },
};

export function buildEquip(id: string): THREE.Group {
  const builder = EQUIP_BUILDERS[id] ?? EQUIP_BUILDERS.badge;
  const group = builder();
  group.name = `equip-${id}`;
  return group;
}
