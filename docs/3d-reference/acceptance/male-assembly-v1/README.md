# 男性灰模組裝 v1 — 驗收報告(2026-07-17)

來源:`assets/gen-raw/meshy/`(使用者 Meshy 網頁版手動生成;原始 GLB 未修改)。
Checkpoint:`assets/work/knights/male-assembly-v1.blend`(不進版控,可由下列流程重建)。
組裝原則:各部件僅套用 transform(位移/旋轉/縮放/鏡射);多視角融合檔在**場景內**依 X 軸分群取單一實體(Hair→實體2、Torso→0、Mantle→0、Cape→2、Greave→0、Sword→0、Shield→2、Belt→0),原始檔不動。
未做:Rig、Weight Paint、Decimate、Retopology、動畫、契約匯出(等組裝確認)。
`public/models/knights/` 未改動。

## 驗收圖

| 檔案 | 內容 |
|---|---|
| front.png / tq.png / sideL.png / sideR.png / back.png | 正面 / 3/4 / 左側 / 右側 / 背面 |
| face.png | 臉部近照 |
| chest.png | 胸甲+肩甲近照 |
| arms_legs.png | 手部+腿甲近照 |

## 問題表

| 部件 | 比例 | 位置 | 穿模 | 材質一致性 | 是否可修 | 建議 |
|---|---|---|---|---|---|---|
| Body(裸身+制服) | ✅ 約 6.5 頭身 | ✅ | 便鞋鞋尖/鞋跟自 GreaveBoot 露出 | 眼睛虹膜偏黑(參考為棕灰) | 可(後續隱藏 body 足部 mesh + 眼睛貼圖校色) | accept |
| Hair | ✅ | ✅(不遮眼) | 後髮際與 Mantle 領圈輕微接近,無明顯穿插 | ❌ 髮色偏白,參考為淺藍灰 | 可(貼圖校色) | accept+校色 |
| TorsoArmor | ✅ | ✅ 與制服層疊自然 | 無明顯 | ✅ 配色與參考一致 | — | accept |
| ShoulderMantle | ✅ | ✅ 領圈環頸、披甲落肩 | 領圈內緣近下顎,3/4 視角可接受 | ✅ 金/米白與參考一致 | 微調可 | accept;**背面品質待背視圖確認**(取自正視角實體) |
| Cape | ✅ 長度至踝 | ✅ 垂墜在背後 | 側面與肩披甲輕微相接 | ✅ 深藍+銀白鑲邊 | 可 | accept |
| Belt | 帶身偏細(參考為寬腰帶+扣具+寶石) | ✅ 腰位正確、扣具在前 | 無 | 棕色皮革 ✅ | 縮放無法補結構 | **條件接受;建議後續重生成寬版腰帶** |
| GreaveBoot ×2 | ✅ 含膝甲 | ✅(鏡射補右腳) | body 便鞋尖/跟露出(見上) | ✅ 白銀+藍布 | 可 | accept |
| Sword | ✅ 全長約 1.42(0.75 身高) | v1 置於右手側、劍尖向下 | 與披風側緣輕微相交 | ✅ 高品質 | 可 | accept;正式姿勢待 rig 階段掛 Socket |
| Shield | ✅ | v1 貼靠左臂側 | 與披風輕微相交 | ❌ 盾面底色深灰,參考為白銀 | 可(材質校色)或重生成 | 條件接受 |
| **Gauntlets** | — | — | — | — | — | **缺檔,需補生成**(參考 `docs/3d-reference/male/gauntlet_*_corrected.png`);目前露出 body 白手 |

## 已知限制(v1 範圍內不處理)

1. 面數總計約 210 萬 tris(組裝場景)——減面/retopo 屬後續階段。
2. 非流形邊、三角網拓樸——retopo 階段處理。
3. 盾面校色、髮色校色、眼睛貼圖——材質階段處理。
4. Idle 姿勢仍為 A-pose 直立——rig/動畫階段處理。

## 結論

比例與輪廓已達組裝確認標準(6.5 頭身、肩寬協調、英雄輪廓成立),配色與參考圖高度一致。
**等待使用者確認比例後,才進入:補生成手甲/寬腰帶 → retopo/減面 → rig → 動畫 → 契約匯出。**
