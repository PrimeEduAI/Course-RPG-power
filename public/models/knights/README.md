# 模組化騎士資產(正式 GLB 放這裡)

> **現況(2026-07-17)**:6 件 GLB 已由 Blender 腳本管線產出(`npm run make:knights`,
> 原始碼在 `scripts/blender/`)。GLB 不進版控,clone 後執行上述指令即可重建;
> 之後若有更高品質資產,同名替換並通過 `npm run validate:knights` 即可。

參考圖:`docs/3d-reference/`(男女各部件 turnaround + 組裝比例校驗圖)。
資產契約:`equipment-manifest.json`;離線驗證:`npm run validate:knights`。

## 需要的檔案

| 檔案 | 說明 |
|---|---|
| `hero-boy-modular.glb` | 男性模組化角色(共享骨架,含所有穿戴 mesh) |
| `hero-girl-modular.glb` | 女性模組化角色 |
| `props/boy-sword.glb` | 男性劍(原點=握柄中心) |
| `props/boy-shield.glb` | 男性盾(原點=背面把手中心) |
| `props/girl-bow.glb` | 女性弓(原點=握柄中心) |
| `props/girl-shield.glb` | 女性盾(原點=背面把手中心) |

## 角色 GLB 硬性規格

- 節點(名稱精確比對):`Armature, Body, Hair, TorsoArmor, ShoulderMantle, Cape, Belt,
  Gauntlet_L, Gauntlet_R, GreaveBoot_L, GreaveBoot_R,
  Socket_Weapon_R, Socket_Shield_L, Socket_Back, Socket_Hip`。
- 所有穿戴 mesh(含 Hair)與 Body **共用同一個 humanoid armature**(skinned、跟隨骨架變形)。
- `_L` / `_R` 一律為**角色自身解剖學左右**(不是畫面左右)。
- `Socket_Weapon_R` 掛在右手骨、`Socket_Shield_L` 掛在左前臂/左手骨、
  `Socket_Back` 在上背、`Socket_Hip` 在腰側(皆為空節點,+Y 上 +Z 前)。
- Y 軸向上、面向 +Z、腳底中心為原點;站立高度 ≈ **2.05**(世界單位)。
- 動畫 clip:`Idle`(循環)、`Equip`(單次,抬手/接裝備動作);沒有 `Equip` 時程式有 fallback。
- 材質 PBR metallic-roughness,baseColor 為 sRGB;單張貼圖 ≤ 2048。
- 披風上緣藏在肩披甲下方,兩者不可共用同一空間;idle / equip pose 避免明顯穿模。

## 載入順序(heroFactory)

`hero-{boy|girl}-modular.glb` → 舊版 `hero-{variant}.vrm/.glb` → `hero.vrm/.glb` → 內建程序化騎士。

## 開發測試

沒有正式 GLB 時,可執行 `npm run make:devknight` 產生**測試用 placeholder**
(輸出到 `dev/`,只在網址加 `?devknight=1` 時載入,非正式資產、不要當成品)。
