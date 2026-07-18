# ============================================================
# 模組化騎士 props(武器/盾牌)建置管線(Blender headless)
#
# 座標(Blender,匯出 +Y up 後轉 glTF):
#   - Blender +Z(上)→ glTF +Y;Blender -Y(前)→ glTF +Z
#   - 劍:刃沿 Blender +Z,握柄中心 = 原點
#   - 盾:面朝 Blender -Y(glTF +Z),背面把手中心 = 原點
#   - 弓:弓臂沿 ±Z 對稱,握把中心 = 原點,弦在 +Y 側(glTF -Z,靠角色)
#
# 用法:
#   blender -b -P scripts/blender/build_props.py -- --prop boy-sword \
#     --out public/models/knights/props/boy-sword.glb [--render DIR]
# ============================================================
import bpy
import math
import sys
import os
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default

PROP = arg("--prop", "boy-sword")
OUT = arg("--out", f"public/models/knights/props/{PROP}.glb")
RENDER_DIR = arg("--render")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------- 材質 ----------------
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)

def srgb_to_linear(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) if i < 3 else v
                 for i, v in enumerate(c))

_mats = {}
def M(name, color, metallic=0.0, roughness=0.6, emission=None, emission_strength=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb_to_linear(hexc(color))
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if emission:
        b.inputs["Emission Color"].default_value = srgb_to_linear(hexc(emission))
        b.inputs["Emission Strength"].default_value = emission_strength
    m.diffuse_color = srgb_to_linear(hexc(color))
    m.metallic = metallic
    m.roughness = roughness
    _mats[name] = m
    return m

SILVER = M("Blade", "#e2e8f0", 0.9, 0.22)
STEEL  = M("Steel", "#aeb9c8", 0.85, 0.35)
GOLD   = M("Gold", "#d9a94e", 0.9, 0.3)
RED    = M("GuardRed", "#c8452f", 0.3, 0.45)
RUBY   = M("Ruby", "#d94f5c", 0.1, 0.3, emission="#d94f5c", emission_strength=1.4)
SAPH   = M("SteelBlue", "#7ea6c8", 0.6, 0.35)
GRIP   = M("Grip", "#4a3524", 0, 0.7)
WOOD   = M("Wood", "#6e4326", 0, 0.6)
CREAM  = M("CreamWrap", "#f0e8d4", 0, 0.7)

def A(obj, material, smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj

def sphere(r, loc, scale=(1, 1, 1), seg=18):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=max(6, seg - 4), location=loc)
    o = bpy.context.active_object
    o.scale = scale
    return o

def octa(r, loc, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=4, ring_count=2, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    return o

def cyl(r1, r2, depth, loc, rot=(0, 0, 0), verts=14):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=verts,
                                    location=loc, rotation=rot)
    return bpy.context.active_object

def boxb(size, loc, rot=(0, 0, 0), bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return o

def torus(major, minor, loc, rot=(0, 0, 0), seg=28):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc,
                                     rotation=rot, major_segments=seg, minor_segments=10)
    return bpy.context.active_object

objs = []
def add(o):
    objs.append(o)
    return o

# ============================================================
def build_sword(girl=False):
    """參考圖:細長銀刃、金十字護手(紅色內嵌)+ 中央紅寶石、深棕握柄、金柄頭。全長 ≈0.98"""
    # 握柄(原點)
    add(A(cyl(0.015, 0.017, 0.15, (0, 0, 0)), GRIP))
    add(A(torus(0.016, 0.004, (0, 0, 0.04)), GOLD))
    add(A(torus(0.016, 0.004, (0, 0, -0.028)), GOLD))
    # 柄頭
    add(A(sphere(0.023, (0, 0, -0.092)), GOLD))
    add(A(octa(0.012, (0, 0, -0.112), scale=(1, 1, 1.3)), RUBY))
    # 金十字護手 + 紅內嵌 + 下垂端翼
    add(A(boxb((0.175, 0.026, 0.038), (0, 0, 0.092), bevel=0.008), GOLD))
    add(A(boxb((0.125, 0.028, 0.020), (0, 0, 0.092), bevel=0.004), RED))
    for sx in (1, -1):
        wing = cyl(0.016, 0.004, 0.05, (sx * 0.096, 0, 0.078), verts=8)
        wing.rotation_euler = (0, sx * 2.6, 0)
        add(A(wing, GOLD))
    add(A(octa(0.022, (0, -0.020, 0.092), scale=(1, 0.7, 1)), RUBY))
    # 護手上緣的刃根飾(參考圖紅色劍柄座)
    add(A(cyl(0.030, 0.016, 0.05, (0, 0, 0.128), verts=8), RED))
    # 刃(細長菱形斷面)+ 中脊 + 尖
    blade = cyl(0.026, 0.020, 0.66, (0, 0, 0.475), verts=4)
    blade.scale = (1, 0.24, 1)
    add(A(blade, SILVER))
    ridge = cyl(0.008, 0.005, 0.66, (0, 0, 0.475), verts=4)
    ridge.scale = (1.1, 0.5, 1)
    add(A(ridge, STEEL))
    tip = cyl(0.020, 0.001, 0.075, (0, 0, 0.843), verts=4)
    tip.scale = (1, 0.24, 1)
    add(A(tip, SILVER))

def build_shield(girl=False):
    """參考圖:白銀鳶盾(上寬下尖)+ 金色花形十字 + 中央紅寶石;女版金緣。面朝 -Y,把手原點。"""
    FACE = M("ShieldFace", "#eef1f5", 0.55, 0.35)
    rim_m = GOLD if girl else STEEL
    face_y = -0.040
    # 盾面:上段(寬)+ 下段(收尖),壓扁錐體
    top = cyl(0.185, 0.150, 0.26, (0, face_y, 0.155), verts=24)
    top.scale = (1, 0.15, 1)
    add(A(top, FACE))
    low = cyl(0.012, 0.185, 0.42, (0, face_y, -0.185), verts=24)
    low.scale = (1, 0.15, 1)
    add(A(low, FACE))
    # 上緣(貼合盾頂的橢圓)
    rim = torus(0.178, 0.015, (0, face_y - 0.002, 0.155), rot=(math.pi / 2, 0, 0), seg=24)
    rim.scale = (1, 0.62, 1)
    add(A(rim, rim_m))
    # 金色花形十字:縱橫桿 + 四端花飾 + 中央金環紅寶石
    add(A(boxb((0.034, 0.026, 0.46), (0, face_y - 0.024, -0.02), bevel=0.007), GOLD))
    add(A(boxb((0.19, 0.026, 0.034), (0, face_y - 0.024, 0.09), bevel=0.007), GOLD))
    add(A(octa(0.026, (0, face_y - 0.026, 0.21), scale=(1, 0.5, 1.5)), GOLD))
    add(A(octa(0.026, (0, face_y - 0.026, -0.25), scale=(1, 0.5, 1.5)), GOLD))
    for sx in (1, -1):
        add(A(octa(0.026, (sx * 0.105, face_y - 0.026, 0.09), scale=(1.5, 0.5, 1)), GOLD))
    ring = torus(0.045, 0.010, (0, face_y - 0.028, 0.09), rot=(math.pi / 2, 0, 0), seg=20)
    add(A(ring, GOLD))
    add(A(octa(0.032, (0, face_y - 0.040, 0.09), scale=(1, 0.6, 1)), RUBY))
    # 背面把手(原點)
    add(A(boxb((0.030, 0.045, 0.12), (0, -0.006, 0), bevel=0.007), GRIP))
    add(A(boxb((0.13, 0.018, 0.028), (0, -0.028, 0.085), bevel=0.004), WOOD))
    add(A(boxb((0.13, 0.018, 0.028), (0, -0.028, -0.085), bevel=0.004), WOOD))

def build_bow():
    """參考圖(女):金色長弓、白色握把纏繞。弓臂沿 ±Z,弦在 +Y 側,握把原點。全高 ≈0.9"""
    # 弓臂:圓環弧段(在 YZ 平面,凸向 -Y)
    limb = torus(0.44, 0.016, (0, 0.44 * 0 - 0, 0), rot=(0, math.pi / 2, 0), seg=40)
    # 旋轉後主平面 = YZ;移到讓弧經過原點:弧心放在 +Y 側
    limb.location = (0, 0.44, 0)
    # 只留 -Y 側弧?圓環整圈太多 —— 改:縮放橢圓並靠 bisect 太複雜,改用兩段彎管近似
    bpy.data.objects.remove(limb)
    seg_n = 14
    pts = []
    for i in range(seg_n + 1):
        t = i / seg_n * 2 - 1  # -1..1
        z = t * 0.44
        y = -0.15 * (1 - t * t) - 0.004 + 0.03 * (t * t) ** 3  # 主弧凸向 -Y,末端微反曲
        pts.append(Vector((0, y, z)))
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        mid = (a + b) / 2
        d = b - a
        tt = abs((i + 0.5) / seg_n * 2 - 1)  # 0 中央 → 1 端點
        r = 0.016 - 0.007 * tt  # 中央粗、末端細
        o = cyl(r, r, d.length * 1.35, mid, verts=10)
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = d.to_track_quat("Z", "Y")
        add(A(o, GOLD))
    # 弓臂端飾
    for sz in (1, -1):
        add(A(octa(0.020, (0, 0.026, sz * 0.452), scale=(1, 1, 1.6)), GOLD))
    # 握把(原點,棕色皮革纏繞;貼合弓臂中央弧深)
    add(A(cyl(0.018, 0.018, 0.13, (0, -0.150, 0)), WOOD))
    add(A(torus(0.019, 0.004, (0, -0.150, 0.045)), GOLD))
    add(A(torus(0.019, 0.004, (0, -0.150, -0.045)), GOLD))
    # 弦(+Y 側直線,連接兩端)
    add(A(cyl(0.004, 0.004, 0.90, (0, 0.026, 0), verts=6), CREAM))

if PROP == "boy-sword":
    build_sword()
elif PROP == "boy-shield":
    build_shield(girl=False)
elif PROP == "girl-shield":
    build_shield(girl=True)
elif PROP == "girl-bow":
    build_bow()
else:
    raise SystemExit(f"未知 prop:{PROP}")

# 命名根物件:合併為單一 mesh,名稱 = prop 名
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
if len(objs) > 1:
    bpy.ops.object.join()
root = bpy.context.view_layer.objects.active
root.name = PROP
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------------- 預覽渲染 ----------------
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 460
    scene.render.resolution_y = 700
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    for vname, pos in {"front": (0, -1.7, 0.1), "three4": (1.1, -1.3, 0.35)}.items():
        cam.location = pos
        d = Vector((0, 0, 0.05)) - Vector(pos)
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(RENDER_DIR, f"{PROP}-{vname}.png")
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

# ---------------- 匯出 ----------------
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_materials="EXPORT",
)
print(f"[build_props] 匯出完成:{OUT}")
