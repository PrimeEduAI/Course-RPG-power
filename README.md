# Course-RPG-power · AI 影片冒險者

六小時兒童課程「用 AI 做影片」的課堂互動 3D 網站——**上課＝冒險，知識點＝裝備，導演思維＝天賦技能樹**。

老師每教完一個知識點,在左欄打勾,裝備就會在鏡頭前亮相、飛到冒險者身上;
思維類內容(色彩/分鏡/節奏)在右欄的天賦技能樹點亮,冒險者獲得思維光環。
全部點完,角色從「新手冒險者」升級成「AI 大導演」。

## 特色

- 日系奇幻 RPG 風:暮藍浮空石遺跡、魔法陣、漂浮水晶;深藍墨面板+金飾線 UI
- 程式化 toon 渲染少年/少女騎士(卡通描邊),左下角一鍵切換
- 裝備出場動畫:鏡頭前放大亮相自轉 → 飛到角色身上落定(粒子+合成音效)
- 課程內容可視化編輯器(`/edit.html`):章節、知識點、天賦全部免改程式
- 進度存 localStorage,課程中途重新整理不掉進度
- 支援外部 3D 模型(VRM/GLB)替換主角,見 `public/models/README.md`
- **模組化騎士系統**:共享骨架的模組化角色 GLB,頭髮/胸甲/肩披甲/披風/腰帶/左右手甲/左右腿甲
  可各自獨立裝卸,武器/盾牌透過 socket 掛載;含 preview→飛行→attach 裝備動畫狀態機。
  資產契約與缺件清單見 `public/models/knights/README.md`,參考圖在 `docs/3d-reference/`

## 模組化騎士

- **`npm run make:knights`**:以 Blender headless 腳本(`scripts/blender/`)重建全部 6 件正式 GLB
  (男/女角色 + 劍/弓/雙盾;GLB 不進版控,clone 後跑一次即可)。需 `apt install blender python3-numpy`。
- 找不到正式 GLB 時,自動退回內建程式化騎士(fallback)。
- `npm run validate:knights`:離線驗證 GLB 是否符合契約(節點、skinning、尺寸、貼圖…)。
- `npm run make:devknight`:產生 dev 測試資產;網址加 `?devknight=1` 可端對端試跑整條裝備管線。
- 網址加 `?debug3d=1`:骨架、socket 座標軸與左右標記、包圍盒、節點/面數/材質面板。
- 製作規格與驗收清單:`docs/3d-reference/GLB-PRODUCTION-BRIEF.md`。

## 開發

```bash
bun install
bun run dev      # http://localhost:5173
bun run build    # 型別檢查 + 產出 dist/
```

技術:Vite + TypeScript + Three.js + @pixiv/three-vrm。

## 內容編輯

課程文字(章節/知識點/天賦)預設值在 `src/content.ts`;
上課前用 `/edit.html` 視覺化編輯即可,儲存後冒險頁自動更新。
