import type { Hero, HeroVariant } from "./heroTypes.ts";
import { Adventurer } from "./character.ts";
import { probeModelUrl, loadModelHero } from "./modelHero.ts";
import { probeModularHero, loadModularHero } from "./modularHero.ts";

export interface HeroResult {
  hero: Hero;
  source: "modular" | "model" | "builtin";
}

/**
 * 建立冒險者,優先序:
 * 1. 模組化騎士 public/models/knights/hero-{boy|girl}-modular.glb
 *    (網址帶 ?devknight=1 時改讀 dev/ 測試資產)
 * 2. 舊版外部模型 hero-{boy|girl}.vrm/.glb → hero.vrm/.glb
 * 3. 內建程式化角色(fallback,永遠可用)
 */
export async function createHero(variant: HeroVariant): Promise<HeroResult> {
  const dev = new URLSearchParams(location.search).has("devknight");
  const modularUrl = await probeModularHero(variant, dev);
  if (modularUrl) {
    try {
      const hero = await loadModularHero(variant, modularUrl);
      console.info(`[hero] 使用模組化騎士 ${modularUrl}`);
      return { hero, source: "modular" };
    } catch (e) {
      console.warn(`[hero] 模組化騎士 ${modularUrl} 載入失敗,嘗試舊模型`, e);
    }
  }

  const url = await probeModelUrl(variant);
  if (url) {
    try {
      const hero = await loadModelHero(url, variant);
      console.info(`[hero] 使用外部模型 ${url}`);
      return { hero, source: "model" };
    } catch (e) {
      console.warn(`[hero] 模型 ${url} 載入失敗,改用內建角色`, e);
    }
  }
  return { hero: new Adventurer(variant), source: "builtin" };
}
