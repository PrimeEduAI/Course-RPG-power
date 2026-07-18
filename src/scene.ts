import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { toon, mesh } from "./materials.ts";

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** 場景環境動畫(魔法陣、水晶、光塵…) */
  update: (t: number, dt: number) => void;
}

const STONE = "#7e88a2";
const STONE_DARK = "#565f78";
const ROCK = "#39415a";
const CYAN = "#7fd4ff";
const VIOLET = "#b48aff";

/** 日系奇幻 RPG 舞台:暮藍天空、浮空石造遺跡、魔法陣、漂浮水晶 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#3d4a7c");
  scene.fog = new THREE.Fog("#3d4a7c", 13, 34);

  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
  camera.position.set(3.4, 2.4, 5.2);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // PBR 外部模型的正確顯色:sRGB 輸出 + 電影感 tone mapping(不靠 bloom)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  // 外部模型常用 PBR 金屬材質,需要環境貼圖才不會一片黑
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.05, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.6;
  controls.maxDistance = 11;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.minPolarAngle = Math.PI * 0.15;

  // ---- 光:冷色天光 + 暖金主光 + 背後金色輪廓光 ----
  scene.add(new THREE.HemisphereLight("#b4c4f2", "#2c3248", 0.95));
  const sun = new THREE.DirectionalLight("#ffeecf", 1.35);
  sun.position.set(4, 7, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  scene.add(sun);
  const rim = new THREE.DirectionalLight("#ffcf8e", 0.7);
  rim.position.set(-3, 4, -5);
  scene.add(rim);

  const animated: ((t: number, dt: number) => void)[] = [];

  // ---- 浮空石台 ----
  const top = mesh(new THREE.CylinderGeometry(4.2, 4.35, 0.42, 48), toon(STONE), false);
  top.position.y = -0.21;
  top.receiveShadow = true;
  scene.add(top);
  // 邊緣飾環
  const trim = mesh(new THREE.TorusGeometry(4.18, 0.055, 8, 64), toon(STONE_DARK), false);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.005;
  scene.add(trim);
  // 底部岩體(倒錐,像浮空島)
  const base = mesh(new THREE.CylinderGeometry(4.32, 1.0, 2.6, 14), toon(ROCK), false);
  base.position.y = -1.72;
  scene.add(base);
  const tail = mesh(new THREE.ConeGeometry(1.0, 1.6, 10), toon(ROCK), false);
  tail.rotation.x = Math.PI;
  tail.position.y = -3.8;
  scene.add(tail);
  // 邊緣立石(八方位)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const stone = mesh(new THREE.BoxGeometry(0.34, 0.3 + (i % 3) * 0.12, 0.26), toon(STONE_DARK));
    stone.position.set(Math.cos(a) * 3.85, 0.14, Math.sin(a) * 3.85);
    stone.rotation.y = -a;
    scene.add(stone);
  }

  // ---- 魔法陣(角色腳下,緩慢旋轉) ----
  const circle = new THREE.Group();
  const circleMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const ringOuter = new THREE.Mesh(new THREE.RingGeometry(1.46, 1.58, 48), circleMat);
  circle.add(ringOuter);
  const ringInner = new THREE.Mesh(new THREE.RingGeometry(0.88, 0.94, 40), circleMat);
  circle.add(ringInner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const diamond = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), circleMat);
    diamond.position.set(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0);
    diamond.rotation.z = Math.PI / 4 + a;
    circle.add(diamond);
  }
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.015;
  scene.add(circle);
  animated.push((t) => { circle.rotation.z = t * 0.18; });

  // ---- 石柱遺跡 ----
  function pillar(x: number, z: number, h: number, broken = false, tilt = 0) {
    const g = new THREE.Group();
    const foot = mesh(new THREE.BoxGeometry(0.62, 0.18, 0.62), toon(STONE_DARK));
    foot.position.y = 0.09;
    g.add(foot);
    const shaft = mesh(new THREE.CylinderGeometry(0.2, 0.24, h, 12), toon(STONE));
    shaft.position.y = 0.18 + h / 2;
    g.add(shaft);
    if (!broken) {
      const cap = mesh(new THREE.BoxGeometry(0.56, 0.15, 0.56), toon(STONE_DARK));
      cap.position.y = 0.18 + h + 0.075;
      g.add(cap);
    } else {
      // 斷口:頂端一圈碎石
      const crack = mesh(new THREE.DodecahedronGeometry(0.2), toon(STONE));
      crack.position.y = 0.18 + h;
      crack.scale.y = 0.5;
      g.add(crack);
    }
    g.position.set(x, 0, z);
    g.rotation.z = tilt;
    scene.add(g);
  }
  pillar(-2.75, -1.5, 1.7);
  pillar(2.55, -2.05, 1.7);
  pillar(2.95, 1.5, 0.85, true, 0.07);
  pillar(-2.4, 2.1, 0.6, true, -0.05);

  // ---- 漂浮水晶(發光、浮動、自轉) ----
  function crystal(x: number, z: number, baseY: number, color: string, scale = 1) {
    const rock = mesh(new THREE.DodecahedronGeometry(0.24 * scale), toon(ROCK));
    rock.position.set(x, 0.1, z);
    rock.scale.y = 0.55;
    scene.add(rock);
    const c = mesh(
      new THREE.OctahedronGeometry(0.2 * scale),
      toon(color, { emissive: color, emissiveIntensity: 0.85 })
    );
    c.scale.y = 1.75;
    scene.add(c);
    const phase = x * 3.1 + z;
    animated.push((t) => {
      c.position.set(x, baseY + Math.sin(t * 1.1 + phase) * 0.12, z);
      c.rotation.y = t * 0.6 + phase;
    });
  }
  crystal(-1.95, 1.65, 0.75, CYAN);
  crystal(2.1, 2.35, 0.65, VIOLET, 0.8);
  crystal(-2.9, -2.5, 0.9, VIOLET, 1.1);
  crystal(1.6, -2.8, 0.6, CYAN, 0.7);

  // ---- 微光塵埃(緩緩上飄) ----
  const moteMat = new THREE.MeshBasicMaterial({ color: "#cfe0ff", transparent: true, opacity: 0.75 });
  const moteGeo = new THREE.SphereGeometry(0.028, 6, 5);
  const motes: { m: THREE.Mesh; speed: number; sway: number; phase: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(moteGeo, moteMat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.6 + Math.random() * 3.2;
    m.position.set(Math.cos(a) * r, Math.random() * 3.2, Math.sin(a) * r);
    scene.add(m);
    motes.push({ m, speed: 0.12 + Math.random() * 0.22, sway: 0.15 + Math.random() * 0.3, phase: i * 1.3 });
  }
  animated.push((t, dt) => {
    for (const mo of motes) {
      mo.m.position.y += mo.speed * dt;
      mo.m.position.x += Math.sin(t * 0.8 + mo.phase) * mo.sway * dt;
      if (mo.m.position.y > 3.4) mo.m.position.y = 0.05;
    }
  });

  // ---- 遠景浮島剪影 ----
  function floatIsland(x: number, y: number, z: number, s: number, color: string) {
    const g = new THREE.Group();
    const body = mesh(new THREE.ConeGeometry(1.0 * s, 1.5 * s, 8), toon("#465070"), false);
    body.rotation.x = Math.PI;
    g.add(body);
    const cap = mesh(new THREE.CylinderGeometry(1.0 * s, 1.05 * s, 0.22 * s, 8), toon("#5a6684"), false);
    cap.position.y = 0.85 * s;
    g.add(cap);
    const c = mesh(new THREE.OctahedronGeometry(0.3 * s), toon(color, { emissive: color, emissiveIntensity: 0.7 }), false);
    c.scale.y = 1.6;
    c.position.y = 1.35 * s;
    g.add(c);
    g.position.set(x, y, z);
    scene.add(g);
    animated.push((t) => {
      g.position.y = y + Math.sin(t * 0.4 + x) * 0.25;
      g.rotation.y = t * 0.05 + x;
    });
  }
  floatIsland(-13, 4.5, -11, 0.85, CYAN);
  floatIsland(14, 5.5, -12, 1.0, VIOLET);
  floatIsland(3, 6.5, -17, 0.7, CYAN);

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  return {
    scene, camera, renderer, controls,
    update(t, dt) {
      for (const fn of animated) fn(t, dt);
    },
  };
}
