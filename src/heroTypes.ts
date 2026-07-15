import * as THREE from "three";
import { toon, mesh } from "./materials.ts";
import type { EquipSlot, TalentBranch } from "./content.ts";
import { BRANCH_COLORS } from "./content.ts";

export type HeroVariant = "boy" | "girl";

export interface EquippedEntry {
  group: THREE.Group;
  slot: EquipSlot;
}

/** 冒險者的共用介面:程式化角色與外部模型(VRM/GLB)都實作它 */
export interface Hero {
  root: THREE.Group;
  readonly variant: HeroVariant;
  attach: Record<EquipSlot, THREE.Group>;
  equipped: Map<string, EquippedEntry>;
  setAura(branches: Set<TalentBranch>): void;
  happyJump(): void;
  update(t: number, dt: number): void;
}

export function makeAttachSlots(): Record<EquipSlot, THREE.Group> {
  return {
    head: new THREE.Group(),
    crown: new THREE.Group(),
    handR: new THREE.Group(),
    handL: new THREE.Group(),
    back: new THREE.Group(),
    chest: new THREE.Group(),
    feet: new THREE.Group(),
    belt: new THREE.Group(),
    companion: new THREE.Group(),
    badge: new THREE.Group(),
  };
}

/** 天賦光環粒子(繞角色環繞的發光碎片) */
export class AuraRig {
  group = new THREE.Group();
  private sparks: { m: THREE.Mesh; phase: number; r: number; h: number; speed: number }[] = [];

  set(branches: Set<TalentBranch>) {
    for (const s of this.sparks) this.group.remove(s.m);
    this.sparks = [];
    let i = 0;
    for (const b of branches) {
      const color = BRANCH_COLORS[b];
      for (let k = 0; k < 4; k++) {
        const m = mesh(
          new THREE.OctahedronGeometry(0.045),
          toon(color, { emissive: color, emissiveIntensity: 0.9 }),
          false
        );
        this.group.add(m);
        this.sparks.push({
          m,
          phase: (i * 4 + k) * 1.7,
          r: 0.72 + (k % 2) * 0.22,
          h: -0.35 + ((k + i) % 3) * 0.5,
          speed: 0.7 + (k % 3) * 0.25,
        });
      }
      i++;
    }
  }

  update(t: number) {
    for (const s of this.sparks) {
      const a = t * s.speed + s.phase;
      s.m.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 1.8 + s.phase) * 0.1, Math.sin(a) * s.r);
      s.m.rotation.y = a * 2;
    }
  }
}
