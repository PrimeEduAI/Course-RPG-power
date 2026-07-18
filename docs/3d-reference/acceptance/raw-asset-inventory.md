# Raw Asset Inventory — assets/gen-raw/meshy/(2026-07-17)

來源:使用者以 Meshy 網頁版手動生成下載(multi-image→3D)。原始 GLB 未做任何修改。

## 總覽

| 檔案(縮寫) | 建議標準名 | 部位 | MB | tris | 3視角實體 | 貼圖 | 骨架/動畫 | 非流形邊 | 判定 |
|---|---|---|---:|---:|:-:|---|:-:|---:|---|
| Brown_Leather_Belt_wi_07 | male-belt.glb | 腰帶 | 13.1 | 169,802 | 3 | 4×2048 | 無/無 | 14,158 | repair |
| Crimson_Crossblade_Tr_07 | boy-sword.glb | 長劍 | 13.5 | 178,518 | 3 | 4×2048 | 無/無 | 9,052 | repair |
| Crimson_Star_Shield_0717 | boy-shield.glb | 盾牌 | 23.5 | 528,562 | 3 | 4×2048 | 無/無 | 20,086 | repair |
| Fleur_de_Lis_Vanguard_07 | male-torso-armor.glb | 胸甲/騎士上衣 | 33.2 | 824,638 | 3 | 4×2048 | 無/無 | 46,408 | repair |
| Gilded_Pauldrons_0717122 | male-shoulder-mantle.glb | 肩披甲+護頸圈 | 21.2 | 424,184 | 3 | 4×2048 | 無/無 | 27,712 | repair |
| Navy_Cape_with_Silver_07 | male-cape.glb | 披風 | 18.6 | 452,590 | 3 | 4×2048 | 無/無 | 20,058 | repair |
| Navy_Ivory_Uniform_Co_07 | male-body-uniform.glb | 男性裸身+制服底衣(含臉、手、便鞋) | 12.8 | 188,164 | 1 | 4×2048 | 無/無 | 12,780 | accept |
| Silver_Knight_Boots_0717 | male-boots-alt.glb | 金屬騎士靴(單腳) | 19.4 | 401,338 | 3 | 4×2048 | 無/無 | 18,212 | spare |
| Snow_Fur_Hat_Three_Vi_07 | male-hair.glb | 男性頭髮 | 25.8 | 602,590 | 3 | 4×2048 | 無/無 | 67,734 | repair |
| White_Knight_Greaves_071 | male-greave-boot.glb | 腿甲+靴(單腳,含膝甲) | 20.7 | 458,390 | 3 | 4×2048 | 無/無 | 20,644 | repair |

## 共通事實

- 每檔:單一 mesh、單一材質、4 張 2048×2048 貼圖(Base Color / Normal / Metallic-Roughness / Emissive 通道齊全)。
- 全部無骨架、無動畫(預期內,rig 屬後續階段)。
- Meshy 匯出已正規化:最長軸 ≈ 1.9 單位;body 為 Z-up 直立,其餘部件沿 X 軸橫向排列 3 個視角實體。
- 非流形邊數普遍偏高(9k~68k),屬 Meshy 三角網常態;**組裝階段不處理**,列入後續 retopo 工作。
- 無 loose vertices、無零面積面;僅 body 有 1 個重複面心(可忽略)。

## 關鍵問題

1. **三視角實體融合**:除 body 外每檔含 3 個獨立視角實體(Meshy 把三視圖表當 3 個物件)。組裝時在場景內依 X 軸分群拆出最完整實體,**原始 GLB 保持不動**。
2. **缺男性手甲(Gauntlets)檔** — 需補生成(參考 `docs/3d-reference/male/gauntlet_*_corrected.png`)。
3. **髮色偏白**,參考為淺藍灰 → 貼圖校色(後續階段)。
4. **盾面底色偏深灰**,參考為白銀 → 材質校色或重生成。
5. **腰帶偏細**,與參考寬腰帶+扣具造型有差距 → 先組裝觀察。
6. boots 與 greaves 兩檔內容重疊,greaves(含膝甲)較符合契約 GreaveBoot 範圍;boots 列備用。

## 逐檔判定

### male-belt.glb — 腰帶

- 原始檔:`Meshy_AI_Brown_Leather_Belt_wi_0717121619_texture.glb`
- SHA-256:`fce13f6daa83f2711647de27772f29104fd300ac68b97cc32336d74ee8671ef3`
- bbox:[1.8982, 1.229, 0.2061] @ min [-0.9502, -0.6161, -0.104];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 14,158、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選;帶身偏細,與參考圖寬腰帶+扣具有差距,可先組裝觀察,不合格再重生成

### boy-sword.glb — 長劍

- 原始檔:`Meshy_AI_Crimson_Crossblade_Tr_0717121545_texture.glb`
- SHA-256:`eac37e4b1e4b5913647077ecef0c5fcb04b98115c719821eb2082db042ddef0a`
- bbox:[1.8991, 0.3206, 1.8885] @ min [-0.9505, -0.1594, -0.9461];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 9,052、loose 0、零面積面 0
- **判定:repair** — 3 實體(同設計異尺寸)拆選;護手/劍格/柄結構完整,品質高

### boy-shield.glb — 盾牌

- 原始檔:`Meshy_AI_Crimson_Star_Shield_0717121626_texture.glb`
- SHA-256:`72b1fe44d24943073e0bc99526122f3a0d759f0cffb52ca41bd9493fc425ebb8`
- bbox:[1.8993, 0.8172, 1.2484] @ min [-0.9506, -0.4076, -0.6251];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 20,086、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選(中間為側視薄片,不可用);盾面底色偏深灰,與參考白銀色不符,需材質校色

### male-torso-armor.glb — 胸甲/騎士上衣

- 原始檔:`Meshy_AI_Fleur_de_Lis_Vanguard_0717122050_texture.glb`
- SHA-256:`8d72c5e4ba41fddecacb30a8e741a7607d70a0c49a47834d2fabc356bf48382b`
- bbox:[1.8989, 0.555, 0.9729] @ min [-0.9504, -0.2764, -0.4901];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 46,408、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選;無袖設計與 body 制服袖層疊合理;面數 82 萬全場最高,後續需大幅減面

### male-shoulder-mantle.glb — 肩披甲+護頸圈

- 原始檔:`Meshy_AI_Gilded_Pauldrons_0717122020_texture.glb`
- SHA-256:`7a157d7fe8e12fe8a23e2e424e3a6405fb728d259f2ad75c2dddd2f3bd80fad2`
- bbox:[1.8995, 0.5224, 0.3539] @ min [-0.9506, -0.2602, -0.1774];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 27,712、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選;造型與參考圖金色高領披甲相符

### male-cape.glb — 披風

- 原始檔:`Meshy_AI_Navy_Cape_with_Silver_0717121644_texture.glb`
- SHA-256:`7629e43b4ae3691091991012b84d1b010c0fa7b1ecc66089b3371f81d14ae6bb`
- bbox:[1.8986, 0.8099, 0.9391] @ min [-0.9502, -0.4041, -0.4712];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 20,058、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選(右側實體最完整);銀白鑲邊與參考一致

### male-body-uniform.glb — 男性裸身+制服底衣(含臉、手、便鞋)

- 原始檔:`Meshy_AI_Navy_Ivory_Uniform_Co_0717121401_texture.glb`
- SHA-256:`33139457f2144940cd53582d90263e2d45e83c806f287e7b0f0b313329ddfe0d`
- bbox:[0.9629, 0.2963, 1.8994] @ min [-0.4828, -0.145, -0.9508];最長軸 Z;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 12,780、loose 0、零面積面 0
- **判定:accept** — 品質良好:anime 臉部、完整手掌、6.5~7 頭身;非流形邊需在 retopo 階段處理

### male-boots-alt.glb — 金屬騎士靴(單腳)

- 原始檔:`Meshy_AI_Silver_Knight_Boots_0717121603_texture.glb`
- SHA-256:`b9176d8c054ed3e47c719a88dd7fd8e6c6d037cbe385fd3f9bc27b9f2d327849`
- bbox:[1.899, 0.55, 0.85] @ min [-0.9505, -0.2756, -0.4249];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 18,212、loose 0、零面積面 0
- **判定:spare** — 與 greaves 檔內容重疊(較矮版本);先保留備用,不進組裝

### male-hair.glb — 男性頭髮

- 原始檔:`Meshy_AI_Snow_Fur_Hat_Three_Vi_0717121632_texture.glb`
- SHA-256:`3e2b31b10f31c7d9645d23587a4a305b1013b408b14a0465892efcd5222e8db0`
- bbox:[1.8989, 0.5796, 0.5541] @ min [-0.9504, -0.2888, -0.2771];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 67,734、loose 0、零面積面 0
- **判定:repair** — 3 視角實體需拆選;髮色偏白,需往淺藍灰校色(貼圖階段)

### male-greave-boot.glb — 腿甲+靴(單腳,含膝甲)

- 原始檔:`Meshy_AI_White_Knight_Greaves_0717121611_texture.glb`
- SHA-256:`b7ae05c38f32729b68b3b2eae226f7a21f2c10f9f032aead250d89102c51b680`
- bbox:[1.8994, 0.6457, 0.9358] @ min [-0.9507, -0.3214, -0.4693];最長軸 X;origin [0.0, 0.0, 0.0]
- 完整性:非流形邊 20,644、loose 0、零面積面 0
- **判定:repair** — 3 實體拆選 + 鏡射出另一腳;含膝甲,覆蓋範圍與參考相符

