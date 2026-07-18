# 男性騎士契約整合 v1 — 驗收報告(2026-07-18)

比例確認(男性灰模組裝 v1)後的整合成果:Meshy raw 資產 → 減面 → 契約骨架蒙皮 → Idle/Equip 動畫 → Socket → 匯出 → 遊戲實測。

## 技術驗收(全過)

| 項目 | 結果 |
|---|---|
| `npm run validate:knights` | ✔ 全部通過(hero-boy-modular + boy-sword + boy-shield) |
| 契約節點 15 個 | ✔ 完整(`?debug3d=1` 面板確認) |
| 11 部件 skinned + 共用單一 Armature | ✔ |
| 尺寸 | 1.32 × 2.05 × 0.92,腳底原點,面向 +Z |
| 三角面 | 角色 89,270(門檻 60k~120k ✔)/ 劍 6,000 / 盾 7,999 |
| 材質 | 角色 7(≤12 ✔);貼圖 body 2K、部件 1K(≤2048 ✔) |
| 檔案大小 | 角色 8.4 MB(≤25 ✔)/ 劍 0.7 / 盾 0.8 |
| 動畫 clip | `Idle`(3s 循環)、`Equip`(1s)皆匯出且遊戲可播 |
| 瀏覽器 Console | 0 錯誤(playwright 實測,全裝備狀態) |
| Draco / unlit / WebP | 未使用 ✔ |

## 美術驗收(本階段狀態)

- 逐關節姿勢測試(elbow / knee / head+shoulder):無撕裂、無爆炸,見 `male-integration-v1/` 渲染圖。
- Equip 關鍵影格(f13 抬手接裝備、f18 落位)動作成立。
- 遊戲內全裝截圖:`boy_full.png`;debug 檢視:`boy_ingame.png`。

## 已知未達標項目(誠實列出)

1. **手甲為暫代件**(body 手部複製+外擴 3mm)——等 Meshy 網頁版補生成正式手甲後替換。
2. **腰帶偏細**(結構問題,縮放不可修)——建議重生成寬版腰帶。
3. **髮色偏白**(參考為淺藍灰)、**盾面底色偏深灰**(參考白銀)——待貼圖校色階段。
4. 部件貼圖轉 JPEG q80(Normal 保留 PNG)——近距離可能有輕微壓縮痕跡。
5. Decimate 為主要減面手段(rev.2 設計偏好 remesh/retopo)——因 AI 網格重烘焙成本過高的務實妥協;近照 Hair/Mantle 有輕微裂痕,遊戲鏡頭距離不可見。
6. bind pose 高度 2.134(A-pose 手臂略張,validator 以近似規則通過;站高 2.05 正確)。
7. 女性角色尚未開始(raw 資產未生成)。
8. 課程 legacy 道具(皇冠/頭帶等 primitive)仍以舊樣式疊加在新角色頭上——屬遊戲內容層,不在 GLB 契約範圍。

## 重建方式

```
raw 資產:assets/gen-raw/meshy/(Git LFS)
管線腳本:scripts/blender/male_pipeline/(依序:prepare_assembly → fit_assembly(fit_config.json)
  → process_mesh → rig_skin → fix_weights → anim_socket → fix_cape_tex → export_glb)
工作檔:assets/work/knights/male_v5.blend(最終定稿,不進版控)
```

## 資產來源與授權

全部 10 件 raw mesh+貼圖:Meshy 網頁版(使用者帳號手動生成,2026-07-17),商用授權依使用者訂閱方案;骨架、權重、動畫、Socket、匯出為本地 Blender 管線產物。

## 修正記錄 v1.1(2026-07-18)

使用者回報:披風上緣浮空、腿甲靴未包住 body 便鞋。修正:
- Cape 貼近背部並前傾 5°(fit_config);ShoulderMantle 蓋住上緣。
- GreaveBoot Y 向加深(scale 0.85)+ process 階段 body 便鞋內縮 12%(裸體狀態無感)。
- 重跑全管線重新部署;validator 全過、Console 0 錯誤。
- 驗證圖:`fit_side_fixed.png`(Blender 側視)、`ingame_side_fixed.png`(遊戲內旋轉視角)。
