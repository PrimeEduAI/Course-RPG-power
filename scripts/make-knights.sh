#!/usr/bin/env bash
# 一鍵重建 6 個正式模組化騎士 GLB(需要 blender、python3-numpy)
# 用法:npm run make:knights
set -euo pipefail
cd "$(dirname "$0")/.."

command -v blender >/dev/null || { echo "需要 Blender(sudo apt install blender python3-numpy)"; exit 1; }

blender -b -P scripts/blender/build_knight.py -- --variant boy  --out public/models/knights/hero-boy-modular.glb
blender -b -P scripts/blender/build_knight.py -- --variant girl --out public/models/knights/hero-girl-modular.glb
blender -b -P scripts/blender/build_props.py  -- --prop boy-sword   --out public/models/knights/props/boy-sword.glb
blender -b -P scripts/blender/build_props.py  -- --prop boy-shield  --out public/models/knights/props/boy-shield.glb
blender -b -P scripts/blender/build_props.py  -- --prop girl-bow    --out public/models/knights/props/girl-bow.glb
blender -b -P scripts/blender/build_props.py  -- --prop girl-shield --out public/models/knights/props/girl-shield.glb

node scripts/validate-knights.mjs
