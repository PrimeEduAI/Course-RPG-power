import * as THREE from "three";
import { createStage } from "./scene.ts";
import { Adventurer } from "./character.ts";
import { buildEquip } from "./equipment.ts";
import { ParticleSystem } from "./particles.ts";
import { tween, updateTweens, easeOutBack } from "./tween.ts";
import { setupUI, showToast, updateHud } from "./ui.ts";
import { loadProgress, saveProgress, resetProgress, type Progress } from "./state.ts";
import { CHAPTERS, TALENTS, BRANCH_COLORS, levelFor, type TalentBranch } from "./content.ts";
import { playEquip, playUnequip, playTalent, playLevelUp } from "./sound.ts";

const ALL_ITEMS = CHAPTERS.flatMap((c) => c.items);

// ---------- 場景 ----------
const stage = createStage(document.querySelector("#scene") as HTMLCanvasElement);
const hero = new Adventurer();
stage.scene.add(hero.root);
const particles = new ParticleSystem();
stage.scene.add(particles.group);

// ---------- 進度 ----------
const progress: Progress = loadProgress();
let lastTitle = "";

function exp(): number {
  return progress.equips.length + progress.talents.length;
}

function refreshHud(celebrate: boolean) {
  const e = exp();
  updateHud(e);
  const title = levelFor(e);
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

  const group = buildEquip(id);
  const slotGroup = hero.attach[item.slot];
  slotGroup.add(group);
  hero.equipped.set(id, { group, slot: item.slot });

  if (!animate) return;

  // 從天而降 + 旋轉 + 彈性落定
  const finalY = group.position.y;
  const finalScale = group.scale.x;
  group.position.y = finalY + 2.6;
  group.scale.setScalar(0.15);

  tween(0.9, (k) => {
    group.position.y = finalY + 2.6 * (1 - k);
    const s = 0.15 + (finalScale - 0.15) * k;
    group.scale.setScalar(Math.max(s, 0.001));
    group.rotation.y = (1 - k) * Math.PI * 4;
  }, {
    ease: easeOutBack,
    onDone: () => {
      group.rotation.y = 0;
      const p = new THREE.Vector3();
      group.getWorldPosition(p);
      particles.burst(p, "#ffd166");
      playEquip();
      hero.happyJump();
      showToast(`${item.icon} 獲得「${item.name}」!`);
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
    const node = TALENTS.find((t) => t.id === id);
    if (node) branches.add(node.branch);
  }
  hero.setAura(branches);
}

// ---------- UI 綁定 ----------
setupUI(progress, {
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
    const node = TALENTS.find((t) => t.id === id)!;
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
lastTitle = levelFor(exp());

// ---------- 主迴圈 ----------
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateTweens(dt);
  hero.update(t, dt);
  particles.update(dt);
  for (let i = 0; i < stage.clouds.length; i++) {
    const c = stage.clouds[i];
    c.position.x += dt * 0.12 * (i % 2 ? 1 : -1);
    if (c.position.x > 12) c.position.x = -12;
    if (c.position.x < -12) c.position.x = 12;
  }
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
}
loop();

// 開發偵錯用
(window as any).__quest = { stage, hero, progress };
