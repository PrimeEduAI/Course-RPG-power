# Modular Knight 3D Reference Pack

這個資料包包含兩名角色的分件建模參考圖、左右裝備獨立圖，以及最終組裝比例校驗圖。

## 使用順序

1. 先用 `base_body_bald_turnaround.png` 生成角色本體 GLB。
2. 頭髮、胸甲／軀幹甲、肩披甲、披風、腰帶、左右手甲、左右腿甲分別生成獨立 GLB。
3. 武器與盾牌各自生成獨立 GLB。
4. 在 Blender 統一尺寸、原點、骨架、權重與材質後再匯出正式 GLB。
5. 使用 `assembly/*_assembly_scale_check.png` 檢查裝備比例與穿戴層級。

## 組裝層級

`base body -> torso/chest armor -> belt -> cape -> shoulder mantle -> gauntlets/boots`

披風的上緣應藏在肩披甲下方，不可與肩披甲共用同一個剛體 Mesh。

## 重要限制

- 圖片是建模參考，不是可直接使用的幾何資料。
- 每個 PNG 應獨立生成模型，避免一次將整個資料夾丟給 3D 生成模型。
- 左右手甲與左右腿甲已拆成獨立檔案。
- 生成後仍需在 Blender 檢查拓撲、厚度、穿模、Pivot、骨架與貼圖。

## 建議座標規格

- Y 軸向上。
- 角色面向 +Z。
- 腳底中心為角色原點 `(0, 0, 0)`。
- 武器 Pivot 位於握把中心。
- 盾牌 Pivot 位於背面握把中心。
- 披風使用獨立布料骨架或 4–8 根簡化披風骨。

