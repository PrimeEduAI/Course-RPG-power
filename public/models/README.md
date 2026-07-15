# 外部冒險者模型放這裡

把下載好的模型檔改名放進這個資料夾,重新整理網頁就會自動換角色:

| 檔名 | 用途 |
|---|---|
| `hero-boy.vrm` / `hero-boy.glb` | 少年專用模型 |
| `hero-girl.vrm` / `hero-girl.glb` | 少女專用模型 |
| `hero.vrm` / `hero.glb` | 兩位共用(沒有專用檔時的後備) |

探測順序:`hero-{角色}.vrm` → `hero-{角色}.glb` → `hero.vrm` → `hero.glb`,都沒有就用內建的程式化騎士。

## 格式建議

- **VRM(首選)**:有標準人形骨骼,裝備(劍/皇冠/披風…)會自動綁到正確的骨頭上。
  來源:VRoid Hub、BOOTH、VRoid Studio 自製輸出。
- **GLB**:用骨骼名稱猜測掛點(支援 Mixamo / Meshy 常見命名),不保證每隻模型都完美。
  來源:Sketchfab(下載時選 glTF)、Meshy AI 生成。

## 目前的模型

- `hero-girl.glb` + `hero-girl.json`:**"Girl knight" by Sool**
  (來源 [Sketchfab](https://sketchfab.com/3d-models/girl-knight-084e97be8dc3428ba23665686747831f),
  授權 **CC BY-NC 4.0**——需標註作者(冒險頁左欄底部已標註)、**不可商業使用**;
  收費課程請換成可商用的模型,檔案同名替換即可)。
- `hero-boy.glb` + `hero-boy.json`:**"Anime Sword Boy" by CalvinQuan**
  (來源 [Sketchfab](https://sketchfab.com/3d-models/anime-sword-boy-9e1bdb4f137d44228e6b8876af8bcfc6),
  授權 **CC BY 4.0**——需標註作者(已標註),**可商業使用**)。

## 每模型設定檔(模型同名 .json,選用)

```json
{
  "hide": ["要移除的節點名稱"],
  "extraScale": 1.5,
  "anchors": { "head": { "pos": [0, 1.9, 0], "scale": 0.5 } }
}
```
- `hide`:移除展示用節點(例:Girl knight 附帶一套並排展示的空盔甲)
- `extraScale`:自動等高失準時手動校正
- `anchors`:各裝備掛點的世界座標與縮放(無骨骼的靜態模型必用)

## 授權提醒

收費課程屬於商業使用:CC BY-NC 模型不可用;請選 CC-BY / CC0、
BOOTH 購買(依各商品規約)、或 AI 生成(依平台方案)。
