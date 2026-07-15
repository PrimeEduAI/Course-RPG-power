import * as THREE from "three";
import { createStage } from "./scene.ts";
import { Adventurer, type HeroVariant } from "./character.ts";
import { buildEquip } from "./equipment.ts";
import { ParticleSystem } from "./particles.ts";
import { tween, updateTweens, easeOutBack, easeOutCubic } from "./tween.ts";
import { setupUI, showToast, updateHud } from "./ui.ts";
import { loadProgress, saveProgress, resetProgress, type Progress } from "./state.ts";
import { MODELS, BRANCH_COLORS, type TalentBranch } from "./content.ts";
import { loadContent, allItems, totalExp, levelFor, CONTENT_KEY } from "./contentStore.ts";
import { playEquip, playUnequip, playTalent, playLevelUp, playReveal } from "./sound.ts";

// ---------- 課程內容(可在 /edit.html 編輯) ----------
const content = loadContent();
const ALL_ITEMS = allItems(content);
const TOTAL = totalExp(content);

// 編輯器存檔後,冒險頁自動重新載入(進度保留在另一個 key)
addEventListener("storage", (e) => {
  if (e.key === CONTENT_KEY) location.reload();
});

// ---------- 場景 ----------
const stage = createStage(document.querySelector("#scene") as HTMLCanvasElement);
const HERO_KEY = "ai-video-quest-hero-v1";
let heroVariant: HeroVariant = localStorage.getItem(HERO_KEY) === "girl" ? "girl" : "boy";
let hero = new Adventurer(heroVariant);
stage.scene.add(hero.root);
const particles = new ParticleSystem();
stage.scene.add(particles.group);

// 切換少年/少女(按鈕顯示「另一位」的圖示)
const heroBtn = document.querySelector("#btn-hero") as HTMLButtonElement;
function refreshHeroBtn() {
  heroBtn.textContent = heroVariant === "boy" ? "👧" : "👦";
}
refreshHeroBtn();
heroBtn.addEventListener("click", () => {
  heroVariant = heroVariant === "boy" ? "girl" : "boy";
  localStorage.setItem(HERO_KEY, heroVariant);
  stage.scene.remove(hero.root);
  hero = new Adventurer(heroVariant);
  stage.scene.add(hero.root);
  for (const id of progress.equips) equipItem(id, false); // 裝備原樣穿回
  refreshAura();
  refreshHeroBtn();
  particles.burst(new THREE.Vector3(0, 1.3, 0), heroVariant === "girl" ? "#ff9ec4" : "#9fc3d4", 24);
  playTalent();
  showToast(heroVariant === "girl" ? "👧 換成少女冒險者!" : "👦 換成少年冒險者!");
});

// ---------- 進度 ----------
const progress: Progress = loadProgress();
// 內容被編輯過的話,清掉已不存在的 id
progress.equips = progress.equips.filter((id) => ALL_ITEMS.some((i) => i.id === id));
progress.talents = progress.talents.filter((id) => content.talents.some((t) => t.id === id));

let lastTitle = "";

function exp(): number {
  return progress.equips.length + progress.talents.length;
}

function refreshHud(celebrate: boolean) {
  const e = exp();
  updateHud(e, TOTAL);
  const title = levelFor(e, TOTAL);
  if (celebrate && lastTitle && title !== lastTitle && e > 0) {
    playLevelUp();
    showToast(`🎺 升級!你現在是「${title.replace(/^Lv\.\d+ /, "")}」`);
    const p = hero.root.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    particles.burst(p, "#ffd166", 26);
    particles.burst(p, "#ff6fae", 18);
    hero.happyJump();
  }
  lastTitle = title;
}

// ---------- 裝備 ----------
function equipItem(id: string, animate: boolean) {
  if (hero.equipped.has(id)) return;
  const item = ALL_ITEMS.find((i) => i.id === id);
  if (!item) return;

  const slot = (MODELS[item.model] ?? MODELS.badge).slot;
  const group = buildEquip(item.model);
  const slotGroup = hero.attach[slot];
  // 多個徽章時左右錯開,避免疊在同一點
  if (slot === "badge") {
    const n = [...hero.equipped.values()].filter((e) => e.slot === "badge").length;
    group.position.x += (n % 2 === 0 ? 1 : -1) * Math.ceil(n / 2) * 0.45;
  }
  // 建模函式定義的最終姿勢(slot-local)
  const finalPos = group.position.clone();
  const finalQuat = group.quaternion.clone();
  const finalScale = group.scale.x;

  hero.equipped.set(id, { group, slot });

  if (!animate) {
    slotGroup.add(group);
    return;
  }

  // ===== 出場動畫:先在鏡頭正前方亮相,再飛到角色身上 =====
  const dir = stage.camera.getWorldDirection(new THREE.Vector3());
  const showPos = stage.camera.position.clone().addScaledVector(dir, 3.4);
  stage.scene.add(group);
  group.position.copy(showPos);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(0.01);
  playReveal();
  particles.burst(showPos, "#9fd0ff", 12);

  // 階段1:放大亮相 + 緩慢自轉展示
  tween(1.25, (k) => {
    const grow = Math.min(k * 2.4, 1); // 前 40% 放大,其餘持續旋轉
    group.scale.setScalar(Math.max(0.01 + (1.1 - 0.01) * grow, 0.001));
    group.rotation.y = k * Math.PI * 3;
  }, {
    ease: easeOutCubic,
    onDone: () => {
      // 階段2:保持世界姿勢轉入裝備槽,飛向角色落定
      slotGroup.attach(group);
      const startPos = group.position.clone();
      const startQuat = group.quaternion.clone();
      const startScale = group.scale.x;
      tween(0.55, (k) => {
        group.position.lerpVectors(startPos, finalPos, k);
        group.quaternion.slerpQuaternions(startQuat, finalQuat, k);
        group.scale.setScalar(Math.max(startScale + (finalScale - startScale) * k, 0.001));
      }, {
        ease: easeOutCubic,
        onDone: () => {
          const p = new THREE.Vector3();
          group.getWorldPosition(p);
          particles.burst(p, "#ffd166");
          playEquip();
          hero.happyJump();
          showToast(`${item.icon} 獲得「${item.name}」!`);
        },
      });
    },
  });
}

function unequipItem(id: string) {
  const entry = hero.equipped.get(id);
  if (!entry) return;
  hero.equipped.delete(id);
  const { group } = entry;
  playUnequip();
  tween(0.3, (k) => {
    group.scale.setScalar(Math.max(1 - k, 0.001));
  }, {
    onDone: () => group.parent?.remove(group),
  });
}

// ---------- 天賦 ----------
function refreshAura() {
  const branches = new Set<TalentBranch>();
  for (const id of progress.talents) {
    const node = content.talents.find((t) => t.id === id);
    if (node) branches.add(node.branch);
  }
  hero.setAura(branches);
}

// ---------- UI 綁定 ----------
setupUI(content, progress, {
  onEquipToggle(id, on) {
    if (on) {
      if (!progress.equips.includes(id)) progress.equips.push(id);
      equipItem(id, true);
    } else {
      progress.equips = progress.equips.filter((e) => e !== id);
      unequipItem(id);
    }
    saveProgress(progress);
    refreshHud(on);
  },
  onTalentToggle(id, on) {
    const node = content.talents.find((t) => t.id === id)!;
    if (on) {
      if (!progress.talents.includes(id)) progress.talents.push(id);
      playTalent();
      const p = hero.root.position.clone().add(new THREE.Vector3(0, 1.1, 0));
      particles.burst(p, BRANCH_COLORS[node.branch], 16);
      showToast(`${node.icon} 領悟「${node.name}」— ${node.desc}`);
    } else {
      progress.talents = progress.talents.filter((t) => t !== id);
    }
    refreshAura();
    saveProgress(progress);
    refreshHud(on);
  },
  onReset() {
    resetProgress();
    location.reload();
  },
});

// 還原已存進度(不播動畫)
for (const id of progress.equips) equipItem(id, false);
refreshAura();
refreshHud(false);
lastTitle = levelFor(exp(), TOTAL);

// ---------- 主迴圈 ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateTweens(dt);
  hero.update(t, dt);
  particles.update(dt);
  stage.update(t, dt);
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
}
loop();

// 開發偵錯用
(window as any).__quest = { stage, hero, progress, content };
