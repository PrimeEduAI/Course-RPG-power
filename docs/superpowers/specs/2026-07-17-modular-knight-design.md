# 模組化騎士角色系統 — 設計與實作計畫(2026-07-17)

## 目標

把程序化人物與 primitive 裝備,升級為「共享骨架的模組化騎士 GLB」架構:
所有裝備(頭髮、胸甲、肩披甲、披風、腰帶、左右手甲、左右腿甲、武器、盾牌)
可獨立裝備/卸下,並有完整的 preview → 飛行 → attach 裝備動畫。

## 環境限制(audit 結果)

- 本機沒有 Blender、Meshy、Tripo、Rodin 或任何 image-to-3D 工具。
- `public/models/` 目前沒有任何 GLB(僅 README)。
- 因此本次交付:**完整程式架構 + 資產契約(manifest)+ 驗證工具 + 動畫狀態機 + debug 模式**,
  並在最後列出缺少的正式 GLB 規格清單;不以低品質程序化替代品冒充正式資產。
- `character.ts` 程序化騎士保留為載入失敗 fallback(不動)。
- 為了在沒有正式資產下驗證整條管線,提供 `scripts/` 下的 **dev placeholder GLB 產生器**
  (符合資產契約的測試用模型,僅在 `?devknight=1` 時載入,不進 git、不冒充成品)。

## 架構

```
public/models/knights/
  hero-boy-modular.glb      (缺,由 3D 工具補齊)
  hero-girl-modular.glb     (缺)
  props/boy-sword.glb       (缺)
  props/boy-shield.glb      (缺)
  props/girl-bow.glb        (缺)
  props/girl-shield.glb     (缺)
  equipment-manifest.json   (本次建立:資產契約 + socket 校正)

src/equipmentRegistry.ts    裝備定義(skinned-node / socket-prop / legacy)
src/equipmentLoader.ts      GLB 快取、SkeletonUtils.clone、manifest 載入與節點驗證
src/modularHero.ts          ModularHero:骨架/節點辨識、sockets、AnimationMixer、部件 API
src/equipAnimator.ts        裝備動畫狀態機(preview→flying→attaching→equipped→unequipping)
src/debug3d.ts              ?debug3d=1 偵錯視圖
scripts/validate-knights.mjs 無依賴 GLB 契約驗證器(node)
scripts/make-dev-knight.mjs  dev placeholder 產生器(node + three)
```

### 部件與節點對應(單一共享骨架)

| partId | mode | GLB 節點 / socket |
|---|---|---|
| hair | skinned-node | `Hair` |
| torsoArmor | skinned-node | `TorsoArmor` |
| shoulderMantle | skinned-node | `ShoulderMantle` |
| cape | skinned-node | `Cape` |
| belt | skinned-node | `Belt` |
| gauntletLeft / Right | skinned-node | `Gauntlet_L` / `Gauntlet_R`(解剖學左右) |
| greaveBootLeft / Right | skinned-node | `GreaveBoot_L` / `GreaveBoot_R` |
| weapon | socket-prop | `Socket_Weapon_R`;boy=sword、girl=bow |
| shield | socket-prop | `Socket_Shield_L` |

- Body 永遠顯示;其餘 skinned 節點預設 `visible=false`。
- 左右一律 anatomical;與舊 `handR/handL`(畫面左右)之間由 ModularHero 內部轉換,
  legacy 道具維持舊視覺位置,新武器/盾牌掛 anatomical 正確手。
- 課程獎勵 → 部件群組:`armor → [torsoArmor, shoulderMantle]`、`boots → [greaveBootLeft, greaveBootRight]`、
  `sword → [weapon]`、`shield → [shield]`、`cape → [cape]`;新增可選 model key:`gauntlets`、`beltArmor`、`hairStyle`。
- crown、helmet、clapper、bell、badge 維持 legacy(Registry 標示 `legacy: true`,沿用 equipment.ts 建模)。

### 裝備動畫狀態機(equipAnimator)

`unequipped → previewing(0.35–0.5s 放大旋轉) → 停 0.15s → flying(0.55–0.7s 弧線)
→ attaching(粒子/閃光/音效, Object3D.attach) → equipped → unequipping(反向縮小淡出)`

- skinned 部件:飛行用 **preview clone**(靜態幾何複製),抵達時隱藏 preview、顯示骨架上的正式 mesh。
- socket 部件:實體 prop 直接飛,`attach()` 保世界座標再 tween 到 manifest 校正位。
- 每個 partId 一個 **animation token**;新操作立即取消舊 tween 鏈並清理 preview,
  快速連點不產生重複/孤兒物件。tween.ts 增加 `cancel()`。
- 角色同步裝備動作:優先 GLB `Equip` clip(AnimationMixer + crossFade),
  無 clip 時骨架旋轉 fallback;有 mixer 時停用手動 idle 骨骼動畫,避免搶骨頭。
- `happyJump` 保留(root 位移,不佔骨頭)。

### 渲染與 debug

- `outputColorSpace = SRGBColorSpace`、`ACESFilmicToneMapping`、`toneMappingExposure ≈ 1.05`;
  保留 RoomEnvironment、陰影、主光與 rim light。
- `?debug3d=1`:SkeletonHelper、socket axes(含 L/R 標記)、bounding box、
  節點名稱、目前裝備狀態、尺寸/三角面/材質數 overlay。

### 相容性保證

- 課程勾選、天賦樹、localStorage(`ai-video-quest-v1` / content key)、男女切換、UI 全部不動介面。
- 男女切換沿用 main.ts 既有流程:重建 hero 後以 `progress.equips` 重新裝備(等價裝備自動換性別 variant)。
- 找不到 modular GLB → 依序退回舊 hero-*.vrm/.glb → 程序化 Adventurer,並在 console 顯示明確訊息。

## 驗收對應

prompt 的驗收條件中,凡需要正式 GLB 的項目(新角色載入外觀、穿模檢查)以 dev placeholder
驗證管線正確性,並在最終回報標示「等待正式資產」;其餘(獨立裝備 API、動畫、狀態保存、
build 通過、fallback)直接驗證。
