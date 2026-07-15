import type { Hero, HeroVariant } from "./heroTypes.ts";
import { Adventurer } from "./character.ts";
import { probeModelUrl, loadModelHero } from "./modelHero.ts";

export interface HeroResult {
  hero: Hero;
  source: "model" | "builtin";
}

/**
 * 建立冒險者:優先載入 public/models/ 的外部模型
 * (hero-{boy|girl}.vrm/.glb → hero.vrm/.glb),沒有就用內建程式化角色。
 */
export async function createHero(variant: HeroVariant): Promise<HeroResult> {
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
