# Male Art Review v2(2026-07-18)— Male Art Repair v2 成果

基準與 v1 完全相同:同鏡頭、同三燈、同背景、同 A-pose、同解析度(`male-art-review-v2/01~10`)。
並排對比:`compare_face_v1_v2.png`、`compare_mantle_chest_v1_v2.png`、`compare_waist_v1_v2.png`、`compare_raw_vs_optimized.png`、`compare_mantle_raw_vs_opt.png`。

**結論先講:加權 75.5%,仍未達 80% 門檻。A 路線(本地修復)已把管線缺陷全數修掉;剩餘缺口全部卡在 raw 資產品質上限與 B 資產缺件,需要你裁決 B 重生清單。**

## 一、管線缺陷修復(根因與結果)

| 缺陷 | 根因(實證) | 修復 | 結果 |
|---|---|---|---|
| 全身黑色裂縫 | raw 為未焊接三角湯(Hair 367 孤島/13,547 重複頂點)直接 decimate | 從 untouched raw 重建 → 每部件 0.1mm 保守焊接(只合併重合縫頂點,無法橋接刻意甲片縫隙)→ Hair 降至 2 島/0 重複 | ✔ v2 全視角無裂縫 |
| 肩甲金飾崩壞 | 同上 + 無保護減面 | 兩段式保護減面(飾件/膝甲/盾徽/臉/手 2.5× 密度) | ✔ 飾件結構完整(raw 原生粗糙度仍在) |
| 肩甲藍色楔形 | **減面把不同 UV 島頂點焊進同一三角形**,UV 掃過深藍區(UV-as-color debug 實證) | 跨島面 UV 收斂 209 面 | ✔ 消失 |
| 臉頰棱面 | 減面過度 | Body 保護區(頭/手)+ 24k 預算 | ✔ 平滑 |
| 純黑眼睛 | 貼圖僅畫黑色塊 | UV 圖塊旋轉不可靠 → 依規範改**獨立 anime eye mesh/material**(眼白/虹膜/瞳孔/眼線/雙高光,alpha clip,骨權重 Head) | ✔ 但精緻度尚未到 8 分 |
| 髮色純白 | 貼圖 | 校色至淺藍灰(×0.78/0.84/0.97) | ✔ |
| 盾面深灰 | 貼圖 | 低飽和暗區提亮至銀白 | ✔ |
| 金屬過曝噪點 | roughness 過低 | 銀甲/劍/盾/肩甲 roughness 下限 0.36 | ✔ 收斂 |
| Legacy 皇冠/頭帶跑位 | 固定 headFactor 按舊頭圍校準 | `modularHero.ts` 改 Head bone + Hair 包圍盒定位,頭帶/皇冠各自縮放(頭帶環額頭、皇冠落髮頂) | ✔ `legacy_props_fixed_ingame.png` |

減面原則遵循「品質優先」:總 tris 107,592(門檻 60k~120k 內、高於 v1 的 89k),保護區未犧牲輪廓;`compare_raw_vs_optimized.png` 目視輪廓無退化。

## 二、量化統計(v1 → v2)

| 指標 | v1 | v2 |
|---|---|---|
| 角色三角面 | 89,270 | 107,592(門檻內) |
| 角色 GLB | 8.4 MB | 7.9 MB(≤25 ✔) |
| 材質數 | 7 | 8(+M_Eyes,≤12 ✔) |
| Draw calls(角色+雙道具) | ~13 | ~13(≤20 ✔) |
| 貼圖 | body 2K + 部件 1K | 同左 + 眼睛 512(≤2048 ✔) |
| 貼圖 GPU 記憶體(RGBA8+mip 估) | ~135 MB | ~135 MB |
| validator | 全過 | 全過 |
| 瀏覽器 Console | 0 錯誤 | 0 錯誤(`ingame_full_equip.png`) |
| 黑色裂縫/Decimate 崩壞 | 多處 | 目視無 |
| Legacy 道具 | 干擾驗收 | 已修定位;未出現在驗收圖 |

## 三、量化評分(v1 → v2,證據=同名圖檔)

| 維度 | 權重 | v1 | v2 | 說明 |
|---|---:|---:|---:|---|
| 輪廓與比例 | 25% | 8.0 | **8.0** | 01/02 與參考一致 |
| 裝備結構 | 25% | 6.5 | **7.0** | 肩甲/胸甲/披風結構恢復;**手甲暫代、腰帶細**仍扣分 |
| 臉部與頭髮 | 20% | 6.5 | **7.5** | 髮 8.5(色/型/無裂縫);臉 7(真眼睛但小殘影+精緻度) |
| 配色與材質 | 15% | 6.5 | **8.0** | 髮淺藍灰、盾銀白、roughness 分層 |
| 細節密度 | 10% | 6.5 | **7.5** | 裂縫清零;保護區細節保留 |
| 姿勢與氣質 | 5% | 7.0 | **7.0** | A-pose 中性(Idle/Equip 存在) |
| **加權** | | **69%** | **75.5%** | **未達 80%,不宣告完成** |

### 8 分門檻逐項

| 部位 | v2 | 過門檻? | 缺口原因 |
|---|---:|:-:|---|
| 臉部與頭髮 | 7.5 | ✗ | 眼睛精緻度、左頰幾何陰影殘影(raw 網格),髮已達標 |
| 肩甲 | 7.5 | ✗ | 結構已修復;前飾件 raw 原生粗糙(生成品質上限) |
| 胸甲 | 8.0 | ✔ | 邊緣乾淨、層次與參考一致 |
| 左右手甲 | — | ✗ | **B 資產缺件**(暫代 body 手) |
| 腿甲 | 8.0 | ✔ | 含膝甲、無裂縫、金屬質感收斂 |

## 四、待裁決:B 重生清單(A 路線已到頂)

| 優先 | 部件 | 理由 | 輸入圖 |
|---|---|---|---|
| 必要 | 左右手甲 | 缺件,門檻直接不過 | `male/gauntlet_left/right_corrected.png` |
| 必要 | 寬版腰帶 | 結構性缺失(側袋/寶石),縮放不可修 | `male/belt_turnaround.png` |
| 建議 | 頭部(含臉) | 臉 7→8 需更好的 raw 面部幾何;現有臉的頰部陰影是網格層級 | `male/base_body_bald_turnaround.png`(頭部特寫裁切) |
| 建議 | 肩甲 | 前飾件 raw 原生粗糙,保護減面已保留其全部細節 | `male/shoulder_mantle_turnaround.png` |

新檔到 `assets/gen-raw/meshy/` 後走 v2 管線(`scripts/blender/male_pipeline/v2/`):無破壞匯入 → 四視圖穿模檢查 → 保守焊接+保護減面 → 接回契約。

## 五、重建方式

```
raw:assets/gen-raw/meshy/(LFS,未修改)
v2 管線:scripts/blender/male_pipeline/v2/
  v2_rebuild_hq → v2_optimize(before/after)→ v2_texture_repair → fix_wedge_final
  → rig_skin → v2_fix_weights → anim_socket → eye_polish → export_glb
工作檔:assets/work/knights/male2_hq.blend(未減面)、male_v4.blend(定稿)
完整性報告:v2_integrity.json(管線輸出)
```

依裁決規範:**報告到此停止,等待使用者決定 B 重生清單。未經確認不進入女性角色階段。**
