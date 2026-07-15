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

## 目前的 hero.vrm

pixiv 官方 three-vrm 範例模型(MIT 授權,白色人偶),只是用來驗證載入管線,
找到喜歡的騎士模型後直接覆蓋它即可。

## 授權提醒

收費課程屬於商業使用:CC BY-NC 模型不可用;請選 CC-BY / CC0、
BOOTH 購買(依各商品規約)、或 AI 生成(依平台方案)。
