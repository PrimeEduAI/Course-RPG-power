#!/usr/bin/env node
// ============================================================
// dev placeholder 產生器:輸出「符合資產契約」的測試用模組化騎士 GLB,
// 供在正式美術資產到位前,端對端驗證 loader / 裝備 / 動畫管線。
//
//   ⚠ 這不是正式資產!只在網址加 ?devknight=1 時載入(dev/ 目錄),
//     一般使用者仍看到內建程式化騎士。正式 GLB 規格見
//     public/models/knights/README.md。
//
// 用法:npm run make:devknight
// 輸出:public/models/knights/dev/hero-{boy,girl}-modular.glb
//       public/models/knights/dev/props/{boy-sword,boy-shield,girl-bow,girl-shield}.glb
// ============================================================
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// GLTFExporter 在 Node 需要 FileReader(讀 Blob 用)
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); this.onload?.(); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((r) => {
        this.result = "data:application/octet-stream;base64," + Buffer.from(r).toString("base64");
        this.onloadend?.(); this.onload?.();
      });
    }
  };
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/models/knights/dev");

// ---------------- 材質 ----------------
const COLORS = {
  skin: 0xffdcc0,
  silver: 0xdfe6ee,
  steel: 0xb8c4d4,
  gold: 0xd9a94e,
  navy: 0x3f4c80,
  cream: 0xf2e8d2,
  leather: 0x8a5a35,
  ruby: 0xd94f5c,
  boyHair: 0xa7c9db,
  girlHair: 0xf3d98e,
  dark: 0x222833,
};
const mat = (c, opts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.1, ...opts });
const metal = (c) => mat(c, { roughness: 0.35, metalness: 0.75 });

// ---------------- 骨架 ----------------
function bone(name, x, y, z, parent) {
  const b = new THREE.Bone();
  b.name = name;
  b.position.set(x, y, z);
  parent?.add(b);
  return b;
}

function buildSkeleton() {
  const hips = bone("Hips", 0, 1.08, 0, null);
  const spine = bone("Spine", 0, 0.14, 0, hips);
  const chest = bone("Chest", 0, 0.2, 0, spine);
  const neck = bone("Neck", 0, 0.26, 0, chest);
  const head = bone("Head", 0, 0.12, 0, neck);
  // 解剖學左 = 角色面向 +Z 時的 +X 側
  const upperArmL = bone("UpperArm_L", 0.24, 0.18, 0, chest);
  const lowerArmL = bone("LowerArm_L", 0, -0.25, 0, upperArmL);
  const handL = bone("Hand_L", 0, -0.25, 0, lowerArmL);
  const upperArmR = bone("UpperArm_R", -0.24, 0.18, 0, chest);
  const lowerArmR = bone("LowerArm_R", 0, -0.25, 0, upperArmR);
  const handR = bone("Hand_R", 0, -0.25, 0, lowerArmR);
  const upperLegL = bone("UpperLeg_L", 0.1, -0.08, 0, hips);
  const lowerLegL = bone("LowerLeg_L", 0, -0.45, 0, upperLegL);
  const footL = bone("Foot_L", 0, -0.45, 0, lowerLegL);
  const upperLegR = bone("UpperLeg_R", -0.1, -0.08, 0, hips);
  const lowerLegR = bone("LowerLeg_R", 0, -0.45, 0, upperLegR);
  const footR = bone("Foot_R", 0, -0.45, 0, lowerLegR);
  const bones = [
    hips, spine, chest, neck, head,
    upperArmL, lowerArmL, handL, upperArmR, lowerArmR, handR,
    upperLegL, lowerLegL, footL, upperLegR, lowerLegR, footR,
  ];
  const index = Object.fromEntries(bones.map((b, i) => [b.name, i]));
  return { bones, index, byName: Object.fromEntries(bones.map((b) => [b.name, b])) };
}

// ---------------- skinned 幾何工具 ----------------
/** 把幾何綁到單一骨頭(權重 1),並平移到模型空間位置 */
function bindGeo(geo, x, y, z, boneIdx) {
  geo.translate(x, y, z);
  const n = geo.getAttribute("position").count;
  const si = new Uint16Array(n * 4);
  const sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = boneIdx; sw[i * 4] = 1; }
  geo.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  return geo;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sphere = (r, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2));

function skinnedMesh(name, geos, material, skeleton, rootBone) {
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.name = name;
  mesh.updateMatrixWorld(true);
  mesh.bind(skeleton, mesh.matrixWorld.clone());
  void rootBone;
  return mesh;
}

// ---------------- 角色 ----------------
function buildHero(variant) {
  const scene = new THREE.Scene();
  scene.name = `hero-${variant}-modular`;
  const armature = new THREE.Object3D();
  armature.name = "Armature";
  scene.add(armature);

  const { bones, index: BI, byName } = buildSkeleton();
  armature.add(bones[0]);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  const girl = variant === "girl";

  // ---- Body(膚色 + 底衣;含眼睛標記面向 +Z) ----
  const bodyGeos = [
    bindGeo(sphere(0.16, 16), 0, 1.87, 0, BI.Head),
    bindGeo(box(0.05, 0.03, 0.03), 0.06, 1.9, 0.14, BI.Head),   // 左眼(+X)
    bindGeo(box(0.05, 0.03, 0.03), -0.06, 1.9, 0.14, BI.Head),  // 右眼
    bindGeo(box(0.07, 0.08, 0.07), 0, 1.72, 0, BI.Neck),
    bindGeo(box(girl ? 0.3 : 0.34, 0.5, 0.2), 0, 1.42, 0, BI.Chest),
    bindGeo(box(0.32, 0.2, 0.21), 0, 1.06, 0, BI.Hips),
    // 手臂
    bindGeo(box(0.1, 0.3, 0.1), 0.24, 1.46, 0, BI.UpperArm_L),
    bindGeo(box(0.09, 0.28, 0.09), 0.24, 1.2, 0, BI.LowerArm_L),
    bindGeo(sphere(0.055), 0.24, 1.02, 0, BI.Hand_L),
    bindGeo(box(0.1, 0.3, 0.1), -0.24, 1.46, 0, BI.UpperArm_R),
    bindGeo(box(0.09, 0.28, 0.09), -0.24, 1.2, 0, BI.LowerArm_R),
    bindGeo(sphere(0.055), -0.24, 1.02, 0, BI.Hand_R),
    // 腿
    bindGeo(box(0.13, 0.42, 0.14), 0.1, 0.79, 0, BI.UpperLeg_L),
    bindGeo(box(0.11, 0.42, 0.12), 0.1, 0.33, 0, BI.LowerLeg_L),
    bindGeo(box(0.12, 0.09, 0.24), 0.1, 0.045, 0.04, BI.Foot_L),
    bindGeo(box(0.13, 0.42, 0.14), -0.1, 0.79, 0, BI.UpperLeg_R),
    bindGeo(box(0.11, 0.42, 0.12), -0.1, 0.33, 0, BI.LowerLeg_R),
    bindGeo(box(0.12, 0.09, 0.24), -0.1, 0.045, 0.04, BI.Foot_R),
  ];
  scene.add(skinnedMesh("Body", bodyGeos, mat(COLORS.skin), skeleton));

  // ---- Hair ----
  const hairColor = girl ? COLORS.girlHair : COLORS.boyHair;
  const hairGeos = [bindGeo(sphere(0.175, 14), 0, 1.92, -0.01, BI.Head)];
  if (girl) {
    hairGeos.push(bindGeo(box(0.26, 0.5, 0.1), 0, 1.68, -0.14, BI.Head));   // 後長髮
    hairGeos.push(bindGeo(box(0.07, 0.3, 0.07), 0.17, 1.75, 0.02, BI.Head)); // 側髮
    hairGeos.push(bindGeo(box(0.07, 0.3, 0.07), -0.17, 1.75, 0.02, BI.Head));
  } else {
    hairGeos.push(bindGeo(box(0.1, 0.1, 0.1), 0, 2.02, -0.02, BI.Head));    // 短髮束
    hairGeos.push(bindGeo(box(0.08, 0.08, 0.08), 0.1, 1.99, -0.05, BI.Head));
    hairGeos.push(bindGeo(box(0.08, 0.08, 0.08), -0.1, 1.99, -0.05, BI.Head));
  }
  scene.add(skinnedMesh("Hair", hairGeos, mat(hairColor), skeleton));

  // ---- TorsoArmor ----
  scene.add(skinnedMesh("TorsoArmor", [
    bindGeo(box(girl ? 0.36 : 0.4, 0.52, 0.26), 0, 1.42, 0, BI.Chest),
    bindGeo(box(0.1, 0.1, 0.05), 0, 1.52, 0.14, BI.Chest), // 胸口紋章
  ], metal(girl ? COLORS.gold : COLORS.silver), skeleton));

  // ---- ShoulderMantle ----
  scene.add(skinnedMesh("ShoulderMantle", [
    bindGeo(box(0.2, 0.12, 0.24), 0.29, 1.64, 0, BI.Chest),
    bindGeo(box(0.2, 0.12, 0.24), -0.29, 1.64, 0, BI.Chest),
    bindGeo(box(0.3, 0.1, 0.28), 0, 1.7, 0, BI.Chest), // 護頸圈
  ], metal(COLORS.gold), skeleton));

  // ---- Cape(在肩披甲「下方」、貼背,避免同空間重疊) ----
  scene.add(skinnedMesh("Cape", [
    bindGeo(box(0.44, 0.95, 0.03), 0, 1.14, -0.17, BI.Chest),
  ], mat(COLORS.navy, { side: THREE.DoubleSide }), skeleton));

  // ---- Belt ----
  scene.add(skinnedMesh("Belt", [
    bindGeo(box(0.36, 0.07, 0.25), 0, 1.12, 0, BI.Hips),
    bindGeo(box(0.08, 0.09, 0.03), 0, 1.12, 0.13, BI.Hips), // 金釦
  ], mat(girl ? COLORS.ruby : COLORS.leather), skeleton));

  // ---- Gauntlets(解剖學左右) ----
  scene.add(skinnedMesh("Gauntlet_L", [
    bindGeo(box(0.12, 0.3, 0.12), 0.24, 1.2, 0, BI.LowerArm_L),
    bindGeo(sphere(0.07), 0.24, 1.02, 0, BI.Hand_L),
  ], metal(COLORS.steel), skeleton));
  scene.add(skinnedMesh("Gauntlet_R", [
    bindGeo(box(0.12, 0.3, 0.12), -0.24, 1.2, 0, BI.LowerArm_R),
    bindGeo(sphere(0.07), -0.24, 1.02, 0, BI.Hand_R),
  ], metal(COLORS.steel), skeleton));

  // ---- GreaveBoots ----
  scene.add(skinnedMesh("GreaveBoot_L", [
    bindGeo(box(0.14, 0.44, 0.15), 0.1, 0.33, 0, BI.LowerLeg_L),
    bindGeo(box(0.15, 0.11, 0.28), 0.1, 0.055, 0.05, BI.Foot_L),
  ], metal(COLORS.silver), skeleton));
  scene.add(skinnedMesh("GreaveBoot_R", [
    bindGeo(box(0.14, 0.44, 0.15), -0.1, 0.33, 0, BI.LowerLeg_R),
    bindGeo(box(0.15, 0.11, 0.28), -0.1, 0.055, 0.05, BI.Foot_R),
  ], metal(COLORS.silver), skeleton));

  // ---- Sockets(空節點;bind pose 下軸向對齊世界 +Y 上 +Z 前) ----
  const socket = (name, parent, x, y, z) => {
    const s = new THREE.Object3D();
    s.name = name;
    s.position.set(x, y, z);
    parent.add(s);
    return s;
  };
  socket("Socket_Weapon_R", byName.Hand_R, 0, -0.06, 0.03);
  socket("Socket_Shield_L", byName.LowerArm_L, 0.08, -0.1, 0);
  socket("Socket_Back", byName.Chest, 0, 0.12, -0.2);
  socket("Socket_Hip", byName.Hips, -0.2, 0, 0.04);

  // ---- 動畫:Idle(循環微動)、Equip(右臂抬起接裝備) ----
  const qe = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const q0 = new THREE.Quaternion();
  const idle = new THREE.AnimationClip("Idle", 2.4, [
    new THREE.QuaternionKeyframeTrack("Chest.quaternion",
      [0, 1.2, 2.4], [...q0.toArray(), ...qe(0.035, 0, 0).toArray(), ...q0.toArray()]),
    new THREE.QuaternionKeyframeTrack("Head.quaternion",
      [0, 0.8, 1.6, 2.4], [...q0.toArray(), ...qe(0, 0.12, 0).toArray(), ...qe(0, -0.1, 0).toArray(), ...q0.toArray()]),
    new THREE.QuaternionKeyframeTrack("UpperArm_L.quaternion",
      [0, 1.2, 2.4], [...q0.toArray(), ...qe(0, 0, -0.05).toArray(), ...q0.toArray()]),
    new THREE.QuaternionKeyframeTrack("UpperArm_R.quaternion",
      [0, 1.2, 2.4], [...q0.toArray(), ...qe(0, 0, 0.05).toArray(), ...q0.toArray()]),
  ]);
  const equip = new THREE.AnimationClip("Equip", 0.9, [
    new THREE.QuaternionKeyframeTrack("UpperArm_R.quaternion",
      [0, 0.3, 0.6, 0.9],
      [...q0.toArray(), ...qe(-1.2, 0, 0.25).toArray(), ...qe(-1.2, 0, 0.25).toArray(), ...q0.toArray()]),
    new THREE.QuaternionKeyframeTrack("Chest.quaternion",
      [0, 0.3, 0.9], [...q0.toArray(), ...qe(0.05, -0.15, 0).toArray(), ...q0.toArray()]),
  ]);

  return { scene, animations: [idle, equip] };
}

// ---------------- 武器 / 盾 ----------------
function buildSword() {
  const g = new THREE.Group();
  g.name = "boy-sword";
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 10), mat(COLORS.leather));
  g.add(grip); // 原點 = 握柄中心
  const pommel = new THREE.Mesh(sphere(0.03, 10), metal(COLORS.gold));
  pommel.position.y = -0.1;
  g.add(pommel);
  const guard = new THREE.Mesh(box(0.18, 0.035, 0.045), mat(COLORS.ruby));
  guard.position.y = 0.1;
  g.add(guard);
  const blade = new THREE.Mesh(box(0.05, 0.62, 0.014), metal(COLORS.silver));
  blade.position.y = 0.43;
  g.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.1, 4), metal(COLORS.silver));
  tip.position.y = 0.79;
  tip.rotation.y = Math.PI / 4;
  tip.scale.z = 0.3;
  g.add(tip);
  return g;
}

function buildShield(variant) {
  const g = new THREE.Group();
  g.name = `${variant}-shield`;
  const handle = new THREE.Mesh(box(0.03, 0.14, 0.05), mat(COLORS.leather));
  g.add(handle); // 原點 = 背面把手中心
  const plate = new THREE.Mesh(box(0.42, 0.56, 0.045), metal(variant === "girl" ? COLORS.gold : COLORS.silver));
  plate.position.z = 0.05;
  g.add(plate);
  const rimTop = new THREE.Mesh(box(0.46, 0.06, 0.05), metal(COLORS.gold));
  rimTop.position.set(0, 0.3, 0.05);
  g.add(rimTop);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), mat(COLORS.ruby, { emissive: COLORS.ruby, emissiveIntensity: 0.4 }));
  gem.position.z = 0.09;
  gem.scale.z = 0.5;
  g.add(gem);
  return g;
}

function buildBow() {
  const g = new THREE.Group();
  g.name = "girl-bow";
  // 弓臂:半圓弧(垂直),握把在弧上、位於原點
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 28, Math.PI), metal(COLORS.gold));
  limb.rotation.z = -Math.PI / 2; // 弧經過 +X,上下對稱
  limb.position.x = -0.42;
  g.add(limb);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 10), mat(COLORS.leather));
  g.add(grip); // 原點 = 握柄中心
  const string = new THREE.Mesh(box(0.006, 0.84, 0.006), mat(0xf5f2e8));
  string.position.x = -0.42;
  g.add(string);
  return g;
}

// ---------------- 匯出 ----------------
const exporter = new GLTFExporter();

async function exportGLB(object, animations, file) {
  const scene = object.isScene ? object : new THREE.Scene().add(object);
  const glb = await exporter.parseAsync(scene, { binary: true, animations });
  await writeFile(file, Buffer.from(glb));
  console.log(`✔ ${path.relative(ROOT, file)} (${(glb.byteLength / 1024).toFixed(1)} KB)`);
}

await mkdir(path.join(OUT, "props"), { recursive: true });
for (const variant of ["boy", "girl"]) {
  const { scene, animations } = buildHero(variant);
  await exportGLB(scene, animations, path.join(OUT, `hero-${variant}-modular.glb`));
}
await exportGLB(buildSword(), [], path.join(OUT, "props/boy-sword.glb"));
await exportGLB(buildShield("boy"), [], path.join(OUT, "props/boy-shield.glb"));
await exportGLB(buildBow(), [], path.join(OUT, "props/girl-bow.glb"));
await exportGLB(buildShield("girl"), [], path.join(OUT, "props/girl-shield.glb"));

console.log("\n完成:dev placeholder 已輸出到 public/models/knights/dev/");
console.log("      這是管線測試資產,只在 ?devknight=1 時載入;正式 GLB 請依 README 契約製作。");
