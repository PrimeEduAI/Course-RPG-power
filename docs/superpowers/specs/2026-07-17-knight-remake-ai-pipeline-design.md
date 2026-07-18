# 高精緻日系模組化騎士重製 — AI 生成 + Blender 整合管線設計

日期:2026-07-17(rev.2,依負責人 10 點修正意見改版)
狀態:方向通過;**僅批准執行 Phase 0(供應商 A/B 品質驗證)**,未經負責人確認不得進 Phase 1
前置文件:[GLB-PRODUCTION-BRIEF.md](../../3d-reference/GLB-PRODUCTION-BRIEF.md)(GLB 契約,凍結不變)

## 1. 目標

以 `docs/3d-reference/reference/original_reference.png` 為唯一美術基準,重製男女模組化騎士全部 6 個 GLB,達到可用於正式日系奇幻 RPG 的中高品質。保留現有全部功能契約:模組化換裝、性別切換、單一骨架、Idle/Equip 動畫、四個 Socket、瀏覽器即時渲染、課程獎勵飛入。

**明確不再採用**:primitive 拼裝作為最終建模方式、純色無 UV 材質、單骨 rigid weight、以 validator log 代替視覺驗收。

## 2. 現況差距(實測 2026-07-17)

現有正式 GLB 為 UV Sphere 頭 + Cone/Cylinder 四肢的原始幾何拼裝,約 4 頭身,男 21,340 / 女 30,928 tris,20 個純色材質、零貼圖。差距為建模方法論層級,程序化 primitive 路線無法達標,必須換管線。

## 3. 生成策略:完整角色優先(master-first)

> 核心原則:先確立完整角色,再拆成模組;不是先生成一堆零件,再嘗試拼成人。

逐部件完全獨立生成會導致比例不一、風格不一致、接縫不貼合、厚度與人體不匹配——**禁止直接將 11 個獨立生成的部件拼成人物**。

順序:

1. **男性完整全裝 A-pose 母版**:比例、臉部、材質風格、細節密度的唯一基準。
2. **男性基礎身體**(裸身+底衣,與母版同風格)。
3. **模組裝備**:優先從母版分離/分割;不可分離時,以母版為比例與風格基準逐件重建或重生成,並在 Blender 端對齊母版校驗。
4. **獨立道具**(劍、盾、弓)才採獨立生成。
5. **女性角色**重複相同流程(非縮小版男性)。

## 4. 管線架構

```
turnaround 圖 (docs/3d-reference/)
   │ ① 生成:Meshy / Tripo multi-image-to-3D(master-first 策略)
   ▼
raw 資產 (assets/gen-raw/,Git LFS)+ 生成 manifest(一般 Git)
   │ ② 整合:Blender headless(下述固定順序)
   ▼
6 個契約 GLB (public/models/knights/)
   │ ③ 驗收:Cycles 渲染驗收圖 + validator + 瀏覽器實測
   ▼
docs/3d-reference/acceptance/ + 評分表
```

### ② 整合層固定作業順序(不得跳步)

1. 原始模型清理(non-manifold、重疊面、破碎件、法線)。
2. 判斷拓樸是否可用(關節處變形環線、服裝與人體是否黏連)。
3. 必要時 Remesh / Retopology。
4. UV 與材質保留或重新投射(Base Color / Normal / Roughness / Metallic)。
5. 最後才做**小幅** Decimate(面數預算內、保輪廓)。**Decimate 不是主要拓樸方案**。
6. Rig 與逐關節變形測試。
7. 匯出網頁版本(壓縮評估見 §6)。

### 蒙皮(誠實化)

Automatic Weights **只作為初始結果**。肩、肘、腕、髖、膝、踝必須逐關節做姿勢測試;允許人工 Weight Paint(bpy 腳本逐頂點修正)、拓樸修補或整件重新生成。無法修復時**禁止繼續**,回報負責人。不宣稱 headless 腳本能自動修復所有生成拓樸與權重問題。

### 臉部(誠實化)

PIL 僅用於貼圖校色、眼睛貼圖、腮紅與局部補強。臉型錯誤、鼻樑缺失、眼窩結構錯誤、嘴巴漂浮、頭髮幾何粗糙屬**幾何問題**,必須重新生成、更換頭部 Base Mesh 或人工修模,不得以貼圖掩蓋、不得以「後製可修復」作為驗收通過理由。

## 5. 資產與版本管理

- `assets/gen-raw/`(GLB/FBX/大型貼圖)以 **Git LFS** 管理(remote 為 GitHub,支援 LFS;本機未裝,Phase 0 前 `apt install git-lfs` + `.gitattributes` 設定)。
- 一般 Git 只保存生成 manifest(`assets/gen-manifest.json`),每筆資產記錄:

```json
{
  "provider": "meshy",
  "model": "meshy-6",
  "taskId": "...",
  "inputImages": ["front.png", "side.png", "back.png"],
  "generationDate": "2026-07-17",
  "creditsSpent": 30,
  "licensePlan": "paid",
  "sha256": "...",
  "accepted": false
}
```

- 未被 `accepted` 的中間產物留在 LFS 歷史但不進整合層。

## 6. 網頁效能門檻(凍結)

| 指標 | 門檻 |
|---|---:|
| 單一完整角色 GLB | ≤ 25 MB |
| 角色三角面 | 60k~120k |
| 同時顯示角色 | 1 |
| 材質 Draw Calls | ≤ 20 |
| 單張貼圖 | 最大 2K |
| 桌機 1920×1080 平均 FPS | ≥ 55 |
| 裝備切換 | ≤ 300 ms |
| 首次角色載入(指定測試網路) | ≤ 3 秒 |
| Console | 零 Error |
| 穿模 | 四視圖無明顯穿模 |

匯出階段須做 **KTX2(貼圖)、Meshopt / Draco(幾何)壓縮評估**,以壓縮後檔案量測載入門檻。

## 7. 相似度評分(取代單一「80%」)

| 維度 | 權重 |
|---|---:|
| 輪廓與比例 | 25% |
| 裝備結構 | 25% |
| 臉部與頭髮 | 20% |
| 配色與材質 | 15% |
| 細節密度 | 10% |
| 姿勢與氣質 | 5% |

加權總分 ≥ 80% 為必要條件;**最終硬性 Gate 為負責人人工確認**,不得以 CLIP 分數或 Agent 自評代替。原 prompt 十二節的逐項 8/10、7/10 門檻不變。

## 8. 分階段驗收

### Phase 0 — 供應商 A/B 品質驗證(目前唯一批准的階段)

目的:**先花少量 credits 證明「臉部與完整輪廓能做到」,再投資自動化管線**。不建立完整整合管線、不逐部件生成。

- 測試對象(風險最高項,不是小道具):
  - 男性完整全裝 A-pose(母版候選)
  - 頭部、臉部與頭髮
  - 胸甲與肩甲結構
  - 正面、側面、背面一致性
- 方法:同一組多視角輸入,分別測 **Meshy 6 Multi-Image**(第一選擇,多圖含貼圖 30 credits/次)與 **Tripo P1/v3.1**(A/B,注意 front/left/back/right 固定排列要求);每供應商**最多 2 次正式試生成**。
- 每次生成記錄:模型版本、參數、seed、task ID、credits、耗時、輸出 SHA-256(入 manifest)。
- 產出:兩家旋轉預覽圖(Cycles 低取樣)、成本實測、風險判斷、建議供應商。
- **停止條件:臉部、人體比例或盔甲任一低於 7/10 → 立即停止並回報**,不得以「後製可修復」為通過理由;不預先承諾總成本(實際成本取決於重試次數,Phase 0 結束時以實測數據估算)。

### Phase 1 之後(需負責人逐階段確認)

| 階段 | 產出 | 門檻 |
|---|---|---|
| 1 | 男性母版定稿 + 灰模四視圖 | 6.5~7 頭身、肩寬 2.2~2.5 頭寬、英雄輪廓 |
| 2 | 頭/髮/臉近照(正/側/3/4) | 臉部與頭髮 8/10 |
| 3 | 模組拆分 + 全裝四視圖 + 細節近照 | 盔甲 8/10、材質 8/10、武器盾 8/10 |
| 4 | Rig 逐關節變形測試圖 + Idle/Equip 關鍵影格 | Rig 8/10、動畫 7/10 |
| 5 | 女性角色(重複 1~4) | 同上 |
| 6 | 契約整合 + 瀏覽器實測 | validator 全過 + §6 全部效能門檻 |
| 7 | 14 張驗收圖 + 評分表 + 授權清單 | §7 加權 ≥80% + 逐項門檻 + 負責人確認 |

最終報告分列:技術驗收、美術驗收、未達標項目、資產來源與授權(如實,不美化)。

## 9. Secret 防護

- API key 只從環境變數讀取(`.env` 由 dotenv 載入),不寫入程式、log、commit、報告或錯誤訊息(錯誤輸出一律遮蔽)。
- 執行任何生成前先確認 `.gitignore` 已排除 `.env`(**目前尚未排除,Phase 0 第一步補上**)。
- 建議 key 設用途與額度限制。

## 10. 風險

| 風險 | 緩解 |
|---|---|
| AI 生成 anime 臉品質不穩 | Phase 0 先驗證再投資管線;頭部獨立重生成擇優;7/10 停止條件 |
| 生成拓撲亂 → 蒙皮變形差 | §4 固定順序 + 逐關節測試;無法修復即停止回報 |
| 部件拆分不可行(mesh 黏連) | master-first:以母版為基準重建/重生成部件,Blender 端對齊 |
| 面數/檔案量爆表 | §6 凍結門檻 + KTX2/Meshopt/Draco 評估 |
| 無 GPU、渲染慢 | Cycles 低取樣 + nice;只在驗收點渲染 |
| 生成資產商用授權 | 依訂閱方案確認條款,記入 manifest 與最終授權清單 |

## 11. 環境事實(2026-07-17 盤點)

Blender 5.0.1 headless(EEVEE 不可用,僅 Cycles CPU)、PIL 12.3 + numpy、網路暢通、有 sudo。**待辦前置**:安裝 git-lfs、`.gitignore` 補 `.env` 與 `assets/gen-raw`(LFS 追蹤)、取得 MESHY_API_KEY 與 TRIPO_API_KEY(Phase 0 A/B 兩家都需要)、Playwright(階段 6 前)。
