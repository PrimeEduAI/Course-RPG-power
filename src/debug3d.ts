// ============================================================
// 3D 偵錯模式:網址加 ?debug3d=1 啟用。
// 顯示 SkeletonHelper、socket 座標軸與左右標記、bounding box、
// GLB 節點名稱、目前裝備狀態、模型尺寸/三角面數/材質數。
// ============================================================
import * as THREE from "three";
import type { Stage } from "./scene.ts";
import type { Hero } from "./heroTypes.ts";
import { ModularHero } from "./modularHero.ts";

export interface Debug3D {
  /** 角色更換後重建 helper */
  refresh(): void;
  /** 每幀更新(bounding box 追蹤、面板節流更新) */
  update(dt: number): void;
}

export function setupDebug3D(stage: Stage, getHero: () => Hero): Debug3D | null {
  if (!new URLSearchParams(location.search).has("debug3d")) return null;

  const helpers = new THREE.Group();
  helpers.name = "debug3d-helpers";
  stage.scene.add(helpers);
  /** 掛在模型骨骼/socket 內的 helper(refresh 時要拆乾淨) */
  let attached: THREE.Object3D[] = [];

  const panel = document.createElement("pre");
  panel.id = "debug3d-panel";
  panel.style.cssText = [
    "position:fixed", "left:8px", "bottom:8px", "z-index:99",
    "max-height:46vh", "max-width:min(92vw,460px)", "overflow:auto",
    "background:rgba(10,14,28,.82)", "color:#9fd0ff", "padding:8px 10px",
    "font:11px/1.45 ui-monospace,monospace", "border:1px solid #3d4a7c",
    "border-radius:8px", "white-space:pre-wrap", "pointer-events:auto",
  ].join(";");
  document.body.appendChild(panel);

  const bbox = new THREE.Box3();
  const boxHelper = new THREE.Box3Helper(bbox, new THREE.Color("#ffd166"));
  helpers.add(boxHelper);

  function label(text: string, color: string): THREE.Sprite {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 48;
    const ctx = c.getContext("2d")!;
    ctx.font = "bold 30px monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 26);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(0.4, 0.15, 1);
    return sp;
  }

  function refresh() {
    for (const o of attached) o.removeFromParent();
    attached = [];
    helpers.clear();
    helpers.add(boxHelper);

    const hero = getHero();
    hero.root.updateMatrixWorld(true);

    // SkeletonHelper(有骨架才有)
    let hasBones = false;
    hero.root.traverse((o) => { if ((o as THREE.Bone).isBone) hasBones = true; });
    if (hasBones) {
      const sk = new THREE.SkeletonHelper(hero.root);
      helpers.add(sk);
    }

    // socket axes + 左右標記(模組化騎士)
    if (hero instanceof ModularHero) {
      for (const [name, socket] of hero.sockets()) {
        const axes = new THREE.AxesHelper(0.22);
        (axes.material as THREE.Material).depthTest = false;
        socket.add(axes);
        attached.push(axes);
        const isL = /_L$/.test(name);
        const isR = /_R$/.test(name);
        const tag = label(name.replace("Socket_", ""), isL ? "#54c1ff" : isR ? "#ff6f6f" : "#ffd166");
        tag.position.y = 0.14;
        socket.add(tag);
        attached.push(tag);
      }
    }
    // legacy 掛點的左右手/腳標記(handR/handL 是畫面左右)
    for (const key of ["handR", "handL", "feet"] as const) {
      const g = hero.attach[key];
      if (!g) continue;
      const axes = new THREE.AxesHelper(0.15);
      (axes.material as THREE.Material).depthTest = false;
      g.add(axes);
      attached.push(axes);
      const tag = label(key, key === "handR" ? "#ffb56b" : key === "handL" ? "#8be28b" : "#cccccc");
      tag.position.y = 0.12;
      g.add(tag);
      attached.push(tag);
    }
    panelDirty = 0; // 立即重畫面板
  }

  let panelDirty = 0;

  function renderPanel() {
    const hero = getHero();
    let tris = 0, meshes = 0;
    const mats = new Set<THREE.Material>();
    const nodeNames: string[] = [];
    hero.root.updateMatrixWorld(true);
    hero.root.traverse((o) => {
      if (o.name && !o.name.startsWith("debug")) nodeNames.push(`${o.name}${(o as THREE.SkinnedMesh).isSkinnedMesh ? " [skinned]" : (o as THREE.Mesh).isMesh ? " [mesh]" : (o as THREE.Bone).isBone ? " [bone]" : ""}`);
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        meshes++;
        const idx = m.geometry.getIndex();
        tris += Math.round((idx ? idx.count : m.geometry.getAttribute("position")?.count ?? 0) / 3);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat as THREE.Material);
      }
    });
    bbox.setFromObject(hero.root);
    const size = bbox.getSize(new THREE.Vector3());

    const lines: string[] = [];
    lines.push(`◤ debug3d ─ hero: ${hero.constructor.name} (${hero.variant})`);
    if (hero instanceof ModularHero) {
      lines.push(`source: ${hero.sourceUrl}`);
      const v = hero.validation;
      lines.push(`契約節點: ${v.ok ? "✔ 完整" : "✘ 缺 " + v.missing.join(", ")}`);
      lines.push(`裝備中部件: ${hero.getEquippedItems().join(", ") || "(無)"}`);
      lines.push(`sockets: ${[...hero.sockets().keys()].join(", ") || "(無)"}`);
      lines.push(`標記: 紅字=R(解剖右) 藍字=L(解剖左);軸 紅X 綠Y 藍Z`);
    }
    lines.push(`legacy 裝備: ${[...hero.equipped.keys()].join(", ") || "(無)"}`);
    lines.push(`尺寸: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`);
    lines.push(`三角面: ${tris.toLocaleString()}  mesh: ${meshes}  材質: ${mats.size}`);
    lines.push(`─ 節點(${nodeNames.length}) ─`);
    lines.push(nodeNames.slice(0, 80).join("\n"));
    if (nodeNames.length > 80) lines.push(`… 其餘 ${nodeNames.length - 80} 個節點省略`);
    panel.textContent = lines.join("\n");
  }

  refresh();

  return {
    refresh,
    update(dt: number) {
      const hero = getHero();
      bbox.setFromObject(hero.root);
      panelDirty -= dt;
      if (panelDirty <= 0) {
        panelDirty = 0.5; // 每 0.5s 更新面板即可
        renderPanel();
      }
    },
  };
}
