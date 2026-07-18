# GLB Production Brief — 模組化騎士正式資產製作規格

> 交接對象:3D 美術 / 3D 生成工具操作者
> 程式架構已凍結(2026-07-17);**資產做好放入指定路徑即可生效,不需改程式**。
> 參考圖:本資料夾(`docs/3d-reference/`)— 男女各部件 turnaround、
> `assembly/*_assembly_scale_check.png` 比例校驗圖、`reference/` 總覽。
> 最近一次程式驗證結果:[validation-2026-07-17.log](validation-2026-07-17.log)(build ✔、validator ✔)。
>
> ⚠ `public/models/knights/dev/` 內是**程式測試用 placeholder**,不是美術參考、不是正式資產,
> 請勿以它為品質基準;正式檔完成後 dev 目錄可整個刪除。

---

## 1. 需要的 6 個 GLB(精確路徑)

| # | 路徑(相對專案根目錄) | 內容 |
|---|---|---|
| 1 | `public/models/knights/hero-boy-modular.glb` | 男性模組化角色(含所有穿戴部件與骨架) |
| 2 | `public/models/knights/hero-girl-modular.glb` | 女性模組化角色 |
| 3 | `public/models/knights/props/boy-sword.glb` | 男性長劍 |
| 4 | `public/models/knights/props/boy-shield.glb` | 男性盾牌 |
| 5 | `public/models/knights/props/girl-bow.glb` | 女性長弓 |
| 6 | `public/models/knights/props/girl-shield.glb` | 女性盾牌 |

檔名、路徑、節點名稱**逐字元精確比對(區分大小寫)**,由
`public/models/knights/equipment-manifest.json` 契約定義。

---

## 2. 角色 GLB:必要 node / bone / socket

### 2.1 必要節點(15 個,名稱精確比對)

```
Armature            ← 骨架根(容器節點)
Body                ← 裸體+底衣(永遠顯示)
Hair                ← 頭髮
TorsoArmor          ← 胸甲/軀幹甲
ShoulderMantle      ← 肩披甲(含護頸圈)
Cape                ← 披風
Belt                ← 腰帶
Gauntlet_L          ← 左手甲(角色自身解剖學「左」)
Gauntlet_R          ← 右手甲
GreaveBoot_L        ← 左腿甲+靴
GreaveBoot_R        ← 右腿甲+靴
Socket_Weapon_R     ← 武器掛點(空節點)
Socket_Shield_L     ← 盾牌掛點(空節點)
Socket_Back         ← 背部掛點(空節點,預留)
Socket_Hip          ← 腰側掛點(空節點,預留)
```

規則:

- `Body` 與 10 個穿戴節點**每一個都必須是 skinned mesh**,且共用**同一副** Armature
  (程式以顯示/隱藏切換裝備,穿戴 mesh 必須跟著骨架變形;缺 `Body` 會直接載入失敗)。
- 穿戴節點在檔案內不必預先隱藏——程式載入時會自動隱藏 Body 以外的部件。
- `_L` / `_R` 一律以**角色自身**的解剖學左右為準(角色面向 +Z 時,_L 在 +X 側)。
  **不要**用「畫面左右」命名。
- 不可有兩個節點同名;裝備節點不要藏在其他裝備節點底下。

### 2.2 骨架命名(建議,程式可辨識的保險值)

程式用名稱啟發式尋找骨骼(不分大小寫,支援 `Left/Right`、`_L/_R`、`.L/.R` 後綴)。
**建議直接採用下列名稱**,保證可辨識:

```
Hips ─ Spine ─ Chest ─ Neck ─ Head
              ├ UpperArm_L ─ LowerArm_L ─ Hand_L
              └ UpperArm_R ─ LowerArm_R ─ Hand_R
Hips ├ UpperLeg_L ─ LowerLeg_L ─ Foot_L
     └ UpperLeg_R ─ LowerLeg_R ─ Foot_R
```

- 手指、腳趾、表情骨可加可不加(程式不使用)。
- 披風可另加 4–8 根簡化披風骨(必須屬於同一 Armature;擺動可烘進 Idle 動畫)。
- 每頂點骨骼影響數 **≤ 4**(three.js 標準)。

### 2.3 socket 規範(4 個空節點)

| socket | 父骨骼 | 位置 | bind pose 下的軸向 |
|---|---|---|---|
| `Socket_Weapon_R` | `Hand_R`(右手) | 掌心/握拳中心 | +Y 上、+Z 角色前方 |
| `Socket_Shield_L` | `LowerArm_L`(左前臂)或 `Hand_L` | 前臂外側盾牌把手處 | 同上 |
| `Socket_Back` | `Chest` | 上背中央、披風上緣下 | 同上 |
| `Socket_Hip` | `Hips` | 腰側(收劍位,預留) | 同上 |

- socket 必須是**空節點**(不掛 mesh),掛在指定骨骼底下。
- 軸向:在 bind pose 下 socket 的世界旋轉 = 單位(即 +Y 朝上、+Z 朝角色面向)。
  武器以「劍刃朝 +Y」建模後,掛上去零旋轉就是直立握劍;
  微調不必回 Blender——`equipment-manifest.json` 的 `props.*.position/rotation/scale`
  可做每件道具的掛載校正(弧度、XYZ 順序)。
- 交付前用 `?debug3d=1` 檢查 socket 軸(紅X 綠Y 藍Z)與左右標記(紅字=R、藍字=L)。

---

## 3. 座標、bind pose、高度與原點

| 項目 | 規範 | 驗證 |
|---|---|---|
| 單位 | 公尺(glTF 標準) | — |
| 上方向 | +Y | validator |
| 面向 | +Z(Blender 內面向 -Y,匯出 +Y up 即得) | 眼睛/胸甲徽章應朝 +Z |
| 原點 | **雙腳腳底中心 = (0, 0, 0)** | validator:`腳底 y` 誤差 < 0.1 為過 |
| 站立高度 | **2.05**(±12% 內 validator 給過,請盡量貼近 2.05) | validator:`高度` |
| 水平置中 | X/Z 中心偏移 < 0.15 / 0.2 | validator:`水平中心` |
| bind pose | A-pose 或 T-pose 皆可(**建議 A-pose**,腋下穿模較少);Idle 第 0 幀應接近 bind pose | 目視 |
| 比例 | 依 `assembly/male(female)_assembly_scale_check.png`;男女身高一致(皆 2.05) | 比例校驗圖 |

---

## 4. 各裝備節點的身體覆蓋範圍

以站高 2.05 換算(參考各部件 turnaround 圖;高度為近似指引):

| 節點 | 覆蓋範圍 | 備註 |
|---|---|---|
| `Hair` | 頭頂至後頸,不遮眼 | 戴皇冠(legacy 道具)時頂部會被覆蓋,頂部勿過尖 |
| `TorsoArmor` | 鎖骨下(≈1.55)→ 腰(≈1.15),含腹甲、胸口徽章 | 與 Body 保持 ≥5mm 間隙防 z-fighting |
| `ShoulderMantle` | 雙肩+護頸圈(≈1.55–1.75) | **必須蓋住披風上緣**;權重綁 Chest(可加 Shoulder) |
| `Cape` | 上背(≈1.6,上緣藏於肩披甲下)→ 小腿(≈0.35) | **不得與肩披甲共用空間**;雙面材質 |
| `Belt` | 骨盆一圈(≈1.05–1.15),壓在胸甲下緣外 | 權重綁 Hips |
| `Gauntlet_L/R` | 肘下(≈1.35)→ 手(≈1.0),含手背甲 | 權重綁 LowerArm+Hand;左右**分開兩個節點** |
| `GreaveBoot_L/R` | 膝下(≈0.55)→ 腳底(0),含整隻靴 | 權重綁 LowerLeg+Foot;左右分開 |

穿戴層級(由內而外):`Body → TorsoArmor → Belt → Cape → ShoulderMantle → Gauntlets/Boots`。
Idle 與 Equip 全程不得明顯穿模(QA 表 §8)。

---

## 5. 動畫規範(角色 GLB 內)

| clip 名稱 | 長度 | 內容 | 播放方式(程式端) |
|---|---|---|---|
| `Idle` | 2–4 秒 | 站姿呼吸/微擺,**首尾同 pose 可無縫循環** | 常駐 loop |
| `Equip` | 0.8–1.2 秒 | 抬右手/轉身接裝備,**結尾回到 Idle 起始 pose** | 裝備飛入時單次播放,0.15s crossFade 進出 |

- clip 名稱精確為 `Idle`、`Equip`(程式先精確比對、再不分大小寫比對)。
- 動畫軌道只作用於骨骼(bones);不要對裝備 mesh 節點本身做位移/縮放動畫。
- 不要 root motion(位移由程式控制)。
- 沒有 `Equip` 時程式有簡易抬手 fallback,但正式資產**必須**提供,體驗差很多。

---

## 6. 材質與貼圖限制

| 項目 | 限制 |
|---|---|
| 材質模型 | **PBR metallic-roughness**(glTF 標準);**禁用** `KHR_materials_unlit` |
| baseColor 貼圖 | sRGB(glTF 匯出預設即正確) |
| normal / ORM 貼圖 | Linear(匯出器自動處理) |
| 單張貼圖尺寸 | **≤ 2048 × 2048**(validator 硬性檢查) |
| 貼圖格式 | PNG 或 JPEG;**禁用 WebP / KTX2 / Basis**(執行端未配置解碼器) |
| 幾何壓縮 | **禁用 Draco / meshopt**(執行端未配置解碼器,載入會直接失敗) |
| 建議三角面 | 角色含全部件 ≤ 50k tris;單一道具 ≤ 8k(手機要跑,非硬性) |
| 建議材質數 | 角色 ≤ 12 個(降低 draw call,非硬性) |
| 透明 | 盡量避免 alpha blend;需要時用 alpha clip(mask) |

場景使用 ACES tone mapping + RoomEnvironment IBL,金屬材質 metalness/roughness 正常設定即可。

---

## 7. Blender 匯出 GLB 設定

`File ▸ Export ▸ glTF 2.0 (.glb/.gltf)`:

- **Format**:glTF Binary(`.glb`)
- **Transform ▸ +Y Up**:✔(Blender 內 Z-up 照常作業;角色面向 **-Y** 建模,匯出即面向 +Z)
- **Data ▸ Mesh**:Apply Modifiers ✔、UVs ✔、Normals ✔
- **Data ▸ Material**:Export;Images:Automatic(輸出 PNG/JPEG)
- **Compression(Draco)**:✘ **務必關閉**
- **Data ▸ Armature**:Export Deformation Bones Only 可勾(socket 空物件不是骨,不受影響)
- **Animation**:Animation Mode = Actions;兩個 Action 命名 `Idle`、`Equip`;
  Bake All Objects Animations 視情況;Sampling ✔
- 匯出前:所有物件 Apply All Transforms(Ctrl+A),單位 = 公尺、Unit Scale = 1.0
- socket 作法:建立 Empty(Plain Axes)→ 命名 `Socket_...` → `Ctrl+P ▸ Bone` 綁到對應骨骼,
  在 bind pose 下把 Empty 的世界旋轉歸零

---

## 8. validate:knights 使用方式(交付前必跑)

```bash
npm run validate:knights            # 驗證 public/models/knights/ 的 6 個正式檔
node scripts/validate-knights.mjs 某檔案.glb   # 驗證任意單檔(檔名含 hero- 走角色規則)
node scripts/validate-knights.mjs --strict     # 缺檔也算失敗(CI 用)
node scripts/validate-knights.mjs --dev        # 驗證 dev placeholder(僅供工具自測)
```

- 零依賴、離線執行;檢查:節點齊全、skinned、socket 為空節點、高度/原點/置中、
  `Idle`/`Equip` clip、貼圖 ≤2048、unlit 警告、三角面/材質統計。
- **exit code 0 且無 ✘ 才算通過**;⚠ 為警告,需在交付說明中解釋。
- 通過後的執行期驗證:`npm run dev` → 開 `http://localhost:5173/?debug3d=1`,
  確認 console 無 `[knights]` 缺節點警告、debug 面板顯示「契約節點: ✔ 完整」。

---

## 9. 第一件資產驗收表 — `hero-boy-modular.glb`

逐項打勾;「驗證方式」欄:V=validator 輸出行、D=?debug3d=1 畫面/面板、M=手動目視。

| # | 檢查項 | 通過標準 | 驗證方式 | ✔ |
|---|---|---|---|---|
| 1 | 檔案路徑 | `public/models/knights/hero-boy-modular.glb` | V(不再列於缺件) | ☐ |
| 2 | 格式 | GLB(glTF 2.0),無 Draco/meshopt/KTX2 | V 可解析 + 瀏覽器可載入 | ☐ |
| 3 | 15 個必要節點 | §2.1 全部存在、名稱逐字元一致 | V | ☐ |
| 4 | `Body` skinned | `✔ Body skinned mesh` | V | ☐ |
| 5 | 10 個穿戴節點 skinned | 每項 `✔ ... skinned mesh`(共用同一 Armature) | V | ☐ |
| 6 | 4 個 socket 為空節點 | `✔ Socket_... 空節點 socket` | V | ☐ |
| 7 | socket 父骨骼 | Weapon_R→右手骨、Shield_L→左前臂、Back→Chest、Hip→Hips | D(SkeletonHelper+標記) | ☐ |
| 8 | socket 軸向 | bind pose 下 +Y 上、+Z 前(debug 軸紅X綠Y藍Z) | D | ☐ |
| 9 | 左右不反 | Gauntlet_R 在角色**解剖右**(面向鏡頭時的畫面左) | D(紅字=R 標記) | ☐ |
| 10 | 高度 | 2.05(validator ±12% 內) | V | ☐ |
| 11 | 原點 | 腳底中心;`腳底 y` \< 0.1、水平中心過 | V | ☐ |
| 12 | 面向 | 臉/胸口徽章朝 +Z | M | ☐ |
| 13 | `Idle` clip | 存在、可無縫循環、只動骨骼 | V + M | ☐ |
| 14 | `Equip` clip | 存在、0.8–1.2s、結尾回 Idle pose | V + M | ☐ |
| 15 | 材質 | PBR、無 unlit 警告 | V | ☐ |
| 16 | 貼圖 | 每張 ≤2048,PNG/JPEG | V | ☐ |
| 17 | 規模 | 三角面 ≤ 50k、材質 ≤ 12(建議) | V 統計行 | ☐ |
| 18 | 載入無警告 | console 無 `[knights] ... 缺少契約節點` | D/console | ☐ |
| 19 | debug 面板 | 「契約節點: ✔ 完整」、裝備狀態列表正常 | D | ☐ |
| 20 | 穿模 | Idle/Equip 全程無明顯穿模(§4 層級) | M(§10 QA) | ☐ |

驗收指令:
`npm run validate:knights && npm run dev` → `http://localhost:5173/?debug3d=1`
(此時尚無 props,武器/盾裝備會在 console 提示缺資產,屬預期)。

---

## 10. 正式資產接入後的視覺 QA checklist

環境:`npm run dev`;正式資產就位後**不加** `?devknight`。
先「🔄 新的冒險(重置進度)」清空,再依序測試。桌面 + 手機(或 DevTools 裝置模擬)各跑一輪。

**A. 三視角外觀(拖曳旋轉鏡頭)**
- ☐ 正面:臉、髮、胸甲徽章朝鏡頭;無破面
- ☐ 側面:披風垂墜自然、胸甲厚度合理、腳掌朝前
- ☐ 背面:披風上緣藏於肩披甲下、背部無穿透

**B. 動作**
- ☐ Idle 循環無跳幀、無滑步、裝備跟隨骨架不抖動
- ☐ 勾任一裝備:Equip 動作播放(抬手/轉身)、與飛入時機同步、結束平滑回 Idle
- ☐ 升級時 happyJump 正常(角色整體彈跳,不變形)

**C. 左右部件(逐一勾選/取消課程項或用 console `__quest.hero.equip(...)`)**
- ☐ `gauntletLeft` 只出現在解剖左手(畫面右)、`gauntletRight` 反之;可各自獨立裝卸
- ☐ `greaveBootLeft` / `greaveBootRight` 同上;`boots` 獎勵一次裝上左右兩件
- ☐ 快速連點同一項 5+ 次:最終狀態與勾選一致、場景無殘留漂浮物件

**D. 部件碰撞/層級**
- ☐ 胸甲 vs 肩披甲:肩披甲蓋住胸甲上緣,轉動鏡頭無 z-fighting
- ☐ 肩披甲 vs 披風:披風上緣完全藏於肩披甲下,Idle 擺動時不互穿
- ☐ 腰帶壓在胸甲下緣外側,不閃爍

**E. 武器與盾**
- ☐ 劍(男)握點在掌心、劍刃朝上,不插進前臂/軀幹
- ☐ 弓(女)握在右手、弓臂直立,弦不穿身體
- ☐ 盾(男女)貼左前臂、面朝外,不遮擋鏡頭主視角
- ☐ 掛點偏差時:改 `equipment-manifest.json` 的 position/rotation/scale 校正,重新整理生效

**F. 男女切換(左下 👧/👦 按鈕)**
- ☐ 切換後等價裝備自動換成對應性別部件(劍↔弓),已勾清單不變
- ☐ 連續快速切換 3+ 次無殘影、無雙重角色
- ☐ 切換後重新整理,進度與裝備完整還原(localStorage)

**G. 畫面/裝置**
- ☐ 桌面:全裝備 60fps 附近、無 console 錯誤
- ☐ 手機(≤ 900px 寬):側欄預設收合、觸控可旋轉、可勾裝備;幀率可接受
- ☐ 課程勾選、天賦樹、編輯器(/edit.html)、legacy 道具(頭帶/皇冠/場記板/魔鈴/徽章)全部照常

---

## 11. 現況(2026-07-17 更新:6/6 已產出)

- **§1 全部 6 件 GLB 已產出並通過驗證**,製作方式:Blender 5.0.1 headless 腳本化建模
  (`scripts/blender/build_knight.py`、`scripts/blender/build_props.py`),
  依本規格書與參考圖逐件建置。一鍵重建:`npm run make:knights`。
- `npm run build`:✔;`npm run validate:knights`:✔ 全部通過。
  完整輸出:[validation-2026-07-17-assets.log](validation-2026-07-17-assets.log)
  (資產產出前的基線:[validation-2026-07-17.log](validation-2026-07-17.log))。
- GLB 檔不進版控(.gitignore);要調整外觀請改 `scripts/blender/*.py` 後重跑
  `npm run make:knights`,或以更高品質的手工/生成資產**同名替換**(仍需過 validator 與 §9/§10)。
- 製作順序實錄:hero-boy(§9 驗收)→ boy props → hero-girl → girl props → §10 QA。
