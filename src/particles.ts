import * as THREE from "three";
import { toon } from "./materials.ts";

interface Spark {
  m: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface Ring {
  m: THREE.Mesh;
  life: number;
  maxLife: number;
}

/** 星星爆光粒子(穿裝備/點天賦時的慶祝效果) */
export class ParticleSystem {
  group = new THREE.Group();
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  private geo = new THREE.TetrahedronGeometry(0.055);
  private ringGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 32);

  burst(pos: THREE.Vector3, color: string, count = 20) {
    const mat = toon(color, { emissive: color, emissiveIntensity: 0.9 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, mat);
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const up = 1.5 + Math.random() * 2.5;
      const r = 0.8 + Math.random() * 1.6;
      const maxLife = 0.7 + Math.random() * 0.5;
      this.sparks.push({
        m,
        v: new THREE.Vector3(Math.cos(a) * r, up, Math.sin(a) * r),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: maxLife,
        maxLife,
      });
      this.group.add(m);
    }
    // 擴散光環
    const ring = new THREE.Mesh(this.ringGeo, toon(color, { emissive: color, emissiveIntensity: 1 }));
    ring.position.copy(pos);
    ring.rotation.x = Math.PI / 2;
    this.rings.push({ m: ring, life: 0.5, maxLife: 0.5 });
    this.group.add(ring);
  }

  update(dt: number) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.group.remove(s.m);
        this.sparks.splice(i, 1);
        continue;
      }
      s.v.y -= 5.5 * dt;
      s.m.position.addScaledVector(s.v, dt);
      s.m.rotation.x += s.spin.x * dt;
      s.m.rotation.y += s.spin.y * dt;
      const k = s.life / s.maxLife;
      s.m.scale.setScalar(Math.max(k, 0.001));
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.group.remove(r.m);
        this.rings.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      r.m.scale.setScalar(0.3 + k * 2.6);
    }
  }
}
