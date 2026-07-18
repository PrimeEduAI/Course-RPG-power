#!/usr/bin/env node
// ============================================================
// 模組化騎士 GLB 契約驗證器(零依賴,直接解析 GLB 二進位)。
//
// 用法:
//   npm run validate:knights            驗證 equipment-manifest.json 列出的所有資產
//   node scripts/validate-knights.mjs --dev        改驗證 dev placeholder(dev/ 目錄)
//   node scripts/validate-knights.mjs a.glb b.glb  驗證指定檔案
//   --strict                            缺檔也視為失敗(CI 用)
//
// 檢查項目:
//   角色:必要節點、穿戴 mesh 是否 skinned、socket 是否為空節點、
//        高度≈targetHeight、原點=腳底中心、Idle/Equip clip、
//        三角面/材質統計、貼圖尺寸 ≤2048、PBR(無 unlit)
//   武器/盾:尺寸合理、原點(握柄)在包圍盒內
// ============================================================
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(PUB, "models/knights/equipment-manifest.json");

const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const DEV = args.includes("--dev");
const fileArgs = args.filter((a) => !a.startsWith("--"));

const WEARABLE_NODES = [
  "Hair", "TorsoArmor", "ShoulderMantle", "Cape", "Belt",
  "Gauntlet_L", "Gauntlet_R", "GreaveBoot_L", "GreaveBoot_R",
];
const SOCKET_NODES = ["Socket_Weapon_R", "Socket_Shield_L", "Socket_Back", "Socket_Hip"];
const MAX_TEXTURE = 2048;

let hadError = false;
let hadMissing = false;

// ---------------- GLB 解析 ----------------

function parseGLB(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("不是 GLB(magic 錯誤)");
  const version = dv.getUint32(4, true);
  if (version !== 2) throw new Error(`不支援的 glTF 版本 ${version}`);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buf.byteLength) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const chunk = buf.subarray(offset + 8, offset + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004e4942) bin = chunk;
    offset += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error("GLB 缺 JSON chunk");
  return { json, bin };
}

// ---------------- 小型矩陣工具(column-major, 同 glTF) ----------------

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++)
        out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function composeTRS(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// ---------------- 幾何/統計 ----------------

function globalMatrices(json) {
  const nodes = json.nodes ?? [];
  const global = new Array(nodes.length).fill(null);
  const roots = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  const walk = (idx, parent) => {
    const n = nodes[idx];
    const local = n.matrix ?? composeTRS(n.translation, n.rotation, n.scale);
    global[idx] = mat4Multiply(parent, local);
    for (const c of n.children ?? []) walk(c, global[idx]);
  };
  for (const r of roots) walk(r, IDENTITY);
  return global;
}

/** 世界包圍盒(以 accessor min/max 近似;skinned mesh 為 bind pose 近似) */
function computeBounds(json) {
  const global = globalMatrices(json);
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  (json.nodes ?? []).forEach((n, i) => {
    if (n.mesh === undefined || !global[i]) return;
    for (const prim of json.meshes[n.mesh].primitives ?? []) {
      const acc = json.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (const cx of [acc.min[0], acc.max[0]])
        for (const cy of [acc.min[1], acc.max[1]])
          for (const cz of [acc.min[2], acc.max[2]]) {
            const p = transformPoint(global[i], [cx, cy, cz]);
            for (let k = 0; k < 3; k++) {
              box.min[k] = Math.min(box.min[k], p[k]);
              box.max[k] = Math.max(box.max[k], p[k]);
            }
          }
    }
  });
  return box;
}

function countTriangles(json) {
  let tris = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const count = prim.indices !== undefined
        ? json.accessors?.[prim.indices]?.count ?? 0
        : json.accessors?.[prim.attributes?.POSITION]?.count ?? 0;
      tris += Math.round(count / 3);
    }
  }
  return tris;
}

function imageSizes(json, bin) {
  const out = [];
  for (const img of json.images ?? []) {
    let bytes = null;
    if (img.bufferView !== undefined && bin) {
      const bv = json.bufferViews[img.bufferView];
      bytes = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    } else if (img.uri?.startsWith("data:")) {
      bytes = Buffer.from(img.uri.split(",")[1], "base64");
    }
    if (!bytes) { out.push({ name: img.name ?? img.uri ?? "?", w: null, h: null }); continue; }
    out.push({ name: img.name ?? "(embedded)", ...decodeImageSize(bytes) });
  }
  return out;
}

function decodeImageSize(b) {
  // PNG
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) {
    return { w: readU32BE(b, 16), h: readU32BE(b, 20) };
  }
  // JPEG:掃 SOF0/1/2
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xc2) {
        return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + ((b[i + 2] << 8) | b[i + 3]);
    }
  }
  return { w: null, h: null };
}

function readU32BE(b, o) {
  return (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0;
}

/** 節點名 → {index, skinned, hasMesh(含子孫)} */
function nodeInfo(json) {
  const nodes = json.nodes ?? [];
  const map = new Map();
  const descendantHas = (idx, pred, seen = new Set()) => {
    if (seen.has(idx)) return false;
    seen.add(idx);
    const n = nodes[idx];
    if (pred(n)) return true;
    return (n.children ?? []).some((c) => descendantHas(c, pred, seen));
  };
  nodes.forEach((n, i) => {
    if (!n.name || map.has(n.name)) return;
    map.set(n.name, {
      index: i,
      hasMesh: descendantHas(i, (x) => x.mesh !== undefined),
      skinned: descendantHas(i, (x) => x.mesh !== undefined && x.skin !== undefined),
      selfMesh: n.mesh !== undefined,
    });
  });
  return map;
}

// ---------------- 驗證 ----------------

const icon = { ok: "  ✔", err: "  ✘", warn: "  ⚠" };
function report(kind, msg) {
  if (kind === "err") hadError = true;
  console.log(`${icon[kind]} ${msg}`);
}

async function validateHero(file, spec, targetHeight) {
  console.log(`\n◆ 角色 ${path.relative(ROOT, file)}`);
  const { json, bin } = parseGLB(await readFile(file));
  const info = nodeInfo(json);

  for (const name of spec.requiredNodes ?? []) {
    if (!info.has(name)) { report("err", `缺少節點 ${name}`); continue; }
  }
  for (const name of ["Body", ...WEARABLE_NODES]) {
    const n = info.get(name);
    if (!n) continue;
    if (!n.hasMesh) report("err", `${name} 沒有 mesh`);
    else if (!n.skinned) report("err", `${name} 不是 skinned mesh(必須跟隨骨架變形)`);
    else report("ok", `${name} skinned mesh`);
  }
  for (const name of SOCKET_NODES) {
    const n = info.get(name);
    if (!n) continue;
    if (n.selfMesh) report("warn", `${name} 帶有 mesh(socket 應為空節點)`);
    else report("ok", `${name} 空節點 socket`);
  }

  const box = computeBounds(json);
  if (Number.isFinite(box.min[1])) {
    const h = box.max[1] - box.min[1];
    const okH = Math.abs(h - targetHeight) <= targetHeight * 0.12;
    report(okH ? "ok" : "warn", `高度 ${h.toFixed(3)}(目標 ${targetHeight};bind pose 近似)`);
    const feetOk = Math.abs(box.min[1]) < 0.1;
    report(feetOk ? "ok" : "err", `腳底 y=${box.min[1].toFixed(3)}(原點需在腳底)`);
    const cx = (box.min[0] + box.max[0]) / 2, cz = (box.min[2] + box.max[2]) / 2;
    const centered = Math.abs(cx) < 0.15 && Math.abs(cz) < 0.2;
    report(centered ? "ok" : "warn", `水平中心 (${cx.toFixed(3)}, ${cz.toFixed(3)})`);
  }

  const anims = (json.animations ?? []).map((a) => a.name);
  report(anims.includes(spec.animations?.idle ?? "Idle") ? "ok" : "warn", `Idle clip:${anims.join(", ") || "(無動畫)"}`);
  if (!anims.includes(spec.animations?.equip ?? "Equip")) report("warn", "沒有 Equip clip(程式會用骨骼 fallback 動作)");

  const unlit = (json.materials ?? []).filter((m) => m.extensions?.KHR_materials_unlit).length;
  if (unlit) report("warn", `${unlit} 個材質是 unlit(契約要求 PBR)`);
  for (const img of imageSizes(json, bin)) {
    if (img.w === null) report("warn", `貼圖 ${img.name} 無法判讀尺寸`);
    else report(img.w <= MAX_TEXTURE && img.h <= MAX_TEXTURE ? "ok" : "err", `貼圖 ${img.name} ${img.w}×${img.h}(上限 ${MAX_TEXTURE})`);
  }
  console.log(`  ─ 三角面 ${countTriangles(json).toLocaleString()},材質 ${(json.materials ?? []).length},動畫 [${anims.join(", ") || "無"}]`);
}

async function validateProp(file) {
  console.log(`\n◆ 道具 ${path.relative(ROOT, file)}`);
  const { json, bin } = parseGLB(await readFile(file));
  const box = computeBounds(json);
  if (Number.isFinite(box.min[1])) {
    const dims = box.max.map((v, i) => v - box.min[i]);
    const maxDim = Math.max(...dims);
    report(maxDim > 0.15 && maxDim < 2.2 ? "ok" : "warn", `尺寸 ${dims.map((d) => d.toFixed(2)).join(" × ")}(公尺)`);
    const originInside = box.min.every((v, i) => v <= 0.05 && box.max[i] >= -0.05);
    report(originInside ? "ok" : "err", "原點(握柄/把手)需在模型範圍內");
  }
  for (const img of imageSizes(json, bin)) {
    if (img.w !== null && (img.w > MAX_TEXTURE || img.h > MAX_TEXTURE)) report("err", `貼圖 ${img.name} ${img.w}×${img.h} 超過 ${MAX_TEXTURE}`);
  }
  console.log(`  ─ 三角面 ${countTriangles(json).toLocaleString()},材質 ${(json.materials ?? []).length}`);
}

// ---------------- 入口 ----------------

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
const toFsPath = (url) => {
  const u = DEV
    ? url.replace("/models/knights/props/", "/models/knights/dev/props/")
        .replace(/\/models\/knights\/(hero-)/, "/models/knights/dev/$1")
    : url;
  return path.join(PUB, u);
};

console.log(`模組化騎士資產驗證(契約 v${manifest.version}${DEV ? ",dev placeholder 模式" : ""})`);

if (fileArgs.length) {
  for (const f of fileArgs) {
    const abs = path.resolve(f);
    if (!existsSync(abs)) { console.log(`\n◆ ${f}\n  ✘ 檔案不存在`); hadError = true; continue; }
    if (/hero-/.test(path.basename(abs))) {
      const variant = /girl/.test(abs) ? "girl" : "boy";
      await validateHero(abs, manifest.heroes[variant], manifest.targetHeight);
    } else {
      await validateProp(abs);
    }
  }
} else {
  const missing = [];
  for (const variant of ["boy", "girl"]) {
    const spec = manifest.heroes[variant];
    const file = toFsPath(spec.url);
    if (!existsSync(file)) missing.push(file);
    else await validateHero(file, spec, manifest.targetHeight);
  }
  for (const [key, spec] of Object.entries(manifest.props)) {
    const file = toFsPath(spec.url);
    if (!existsSync(file)) missing.push(file);
    else await validateProp(file);
  }
  if (missing.length) {
    hadMissing = true;
    console.log("\n◇ 尚未提供的正式 GLB(請依 public/models/knights/README.md 契約製作):");
    for (const m of missing) console.log(`  ✧ ${path.relative(ROOT, m)}`);
  }
}

console.log("");
if (hadError) { console.log("結果:✘ 有資產不符合契約"); process.exit(1); }
if (hadMissing && STRICT) { console.log("結果:✘ (--strict) 缺少資產"); process.exit(1); }
console.log(hadMissing ? "結果:✔ 已存在的資產通過(仍有缺件)" : "結果:✔ 全部通過");
