import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { toon, mesh } from "./materials.ts";

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  clouds: THREE.Group[];
}

/** 舞台:草地圓台、藍天、雲、小樹小蘑菇 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#a8dcff");
  scene.fog = new THREE.Fog("#a8dcff", 14, 30);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(3.4, 2.4, 5.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.05, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.6;
  controls.maxDistance = 11;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minPolarAngle = Math.PI * 0.15;

  // ---- 光 ----
  scene.add(new THREE.HemisphereLight("#cfeaff", "#e8d8b0", 1.1));
  const sun = new THREE.DirectionalLight("#fff4d6", 1.6);
  sun.position.set(4, 7, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  scene.add(sun);

  // ---- 草地圓台 ----
  const grass = mesh(new THREE.CylinderGeometry(4.2, 4.3, 0.35, 40), toon("#7ec850"), false);
  grass.position.y = -0.175;
  grass.receiveShadow = true;
  scene.add(grass);
  const dirt = mesh(new THREE.CylinderGeometry(4.3, 3.6, 1.4, 40), toon("#a9793f"), false);
  dirt.position.y = -1.05;
  scene.add(dirt);

  // ---- 裝飾:樹 ----
  const treeSpots: [number, number, number][] = [[-2.8, 0, -1.6], [2.6, 0, -2.2]];
  for (const [x, , z] of treeSpots) {
    const tree = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.8, 10), toon("#8a5a2b"));
    trunk.position.y = 0.4;
    tree.add(trunk);
    for (let i = 0; i < 3; i++) {
      const leaf = mesh(new THREE.SphereGeometry(0.55 - i * 0.12, 14, 12), toon(i % 2 ? "#5aa63e" : "#6cbb4a"));
      leaf.position.y = 1.0 + i * 0.38;
      tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  // ---- 裝飾:蘑菇 ----
  const shroomSpots: [number, number][] = [[-1.9, 1.4], [2.1, 1.1], [-0.6, -2.6]];
  for (const [x, z] of shroomSpots) {
    const g = new THREE.Group();
    const stem = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 10), toon("#fff3e0"));
    stem.position.y = 0.11;
    g.add(stem);
    const cap = mesh(new THREE.SphereGeometry(0.2, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), toon("#e85d5d"));
    cap.position.y = 0.2;
    g.add(cap);
    for (let i = 0; i < 3; i++) {
      const dot = mesh(new THREE.SphereGeometry(0.035, 8, 6), toon("#ffffff"));
      const a = i * 2.1 + x;
      dot.position.set(Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12);
      g.add(dot);
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // ---- 裝飾:路牌 ----
  const sign = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), toon("#8a5a2b"));
  post.position.y = 0.5;
  sign.add(post);
  const plank = mesh(new THREE.BoxGeometry(0.7, 0.24, 0.06), toon("#c99a5b"));
  plank.position.y = 0.85;
  plank.rotation.y = -0.5;
  sign.add(plank);
  sign.position.set(2.6, 0, 1.2);
  sign.rotation.y = -0.3;
  scene.add(sign);

  // ---- 石頭 ----
  for (const [x, z, s] of [[-1.2, 2.3, 0.16], [3.1, 0.4, 0.2], [-3.2, 0.6, 0.14]] as [number, number, number][]) {
    const rock = mesh(new THREE.DodecahedronGeometry(s), toon("#b8b0a0"));
    rock.position.set(x, s * 0.6, z);
    rock.rotation.set(x, z, 0);
    scene.add(rock);
  }

  // ---- 雲(緩慢飄動) ----
  const clouds: THREE.Group[] = [];
  const cloudMat = new THREE.MeshToonMaterial({ color: "#ffffff" });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5 - j * 0.1, 12, 10), cloudMat);
      puff.position.set(j * 0.55 - 0.55, (j % 2) * 0.12, 0);
      puff.scale.y = 0.62;
      c.add(puff);
    }
    const a = (i / 5) * Math.PI * 2;
    c.position.set(Math.cos(a) * (6 + i), 3.2 + (i % 3) * 0.9, Math.sin(a) * (6 + i * 0.7));
    scene.add(c);
    clouds.push(c);
  }

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return { scene, camera, renderer, controls, clouds };
}
