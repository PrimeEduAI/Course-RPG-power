# ============================================================
# 模組化騎士正式資產建置管線 v2(Blender headless)
#
# 依 docs/3d-reference/reference/original_reference.png 重定比例:
#   ~7 頭身修長體型、層疊金領、長披風、細長四肢。
# 契約同 public/models/knights/README.md:
#   - 單一 Armature,Body + 10 個穿戴部件全部 skinned
#   - 4 個 socket 空節點(bind pose 下軸向對齊世界)
#   - Idle / Equip 動畫(NLA tracks)
#
# 用法:
#   blender -b -P scripts/blender/build_knight.py -- \
#     --variant boy --out public/models/knights/hero-boy-modular.glb [--render DIR]
# ============================================================
import bpy
import math
import sys
import os
from mathutils import Vector, Euler, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default

VARIANT = arg("--variant", "boy")
OUT = arg("--out", f"public/models/knights/hero-{VARIANT}-modular.glb")
RENDER_DIR = arg("--render")
GIRL = VARIANT == "girl"

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

# ---------------- 材質 ----------------
def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)

def srgb_to_linear(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) if i < 3 else v
                 for i, v in enumerate(c))

_mats = {}
def M(name, color, metallic=0.0, roughness=0.65, emission=None, emission_strength=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(hexc(color))
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(hexc(emission))
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    m.diffuse_color = srgb_to_linear(hexc(color))
    m.metallic = metallic
    m.roughness = roughness
    _mats[name] = m
    return m

SKIN   = M("Skin", "#ffddc4", 0, 0.6)
NAVY   = M("NavyCloth", "#3d4a7a", 0, 0.8)
NAVY_D = M("NavyDark", "#333e66", 0, 0.8)
CREAM  = M("CreamCloth", "#f2ecdb", 0, 0.75)
WHITE  = M("WhitePants", "#f0ede4", 0, 0.75)
SILVER = M("SilverArmor", "#dde3ec", 0.85, 0.28)
STEEL  = M("SteelTrim", "#b3bdcb", 0.85, 0.35)
GOLD   = M("GoldArmor", "#d9a94e", 0.9, 0.32)
LEATHER= M("Leather", "#7a4e2c", 0, 0.7)
TAN    = M("TanCloth", "#dcc18f", 0, 0.7)
BELTRED= M("BeltRed", "#c23b2e", 0, 0.6)
RUBY   = M("Ruby", "#d94f5c", 0.1, 0.3, emission="#d94f5c", emission_strength=1.2)
SHOE   = M("Shoe", "#2b3350", 0, 0.45)
HAIR   = M("Hair", "#e9be5a" if GIRL else "#9fc3d8", 0, 0.6)
HAIR_HI= M("HairHi", "#f6d98c" if GIRL else "#c3dded", 0, 0.55)
EYE_W  = M("EyeWhite", "#ffffff", 0, 0.4)
IRIS   = M("Iris", "#b98a2e" if GIRL else "#6d5f4e", 0, 0.3, emission="#b98a2e" if GIRL else "#6d5f4e", emission_strength=0.2)
PUPIL  = M("Pupil", "#26211c", 0, 0.4)
GLINT  = M("Glint", "#ffffff", 0, 0.3, emission="#ffffff", emission_strength=2.0)
BROW   = M("Brow", "#7d9cb3" if not GIRL else "#c9a250", 0, 0.6)
MOUTH  = M("Mouth", "#b06550", 0, 0.6)
BLUSH  = M("Blush", "#ffc0a8", 0, 0.7)

# ---------------- 建模輔助 ----------------
def _obj_of(name):
    o = bpy.context.active_object
    o.name = name
    return o

def sphere(r, loc, scale=(1, 1, 1), seg=22, rings=16, name="s"):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=rings, location=loc)
    o = _obj_of(name)
    o.scale = scale
    bpy.ops.object.shade_smooth()
    return o

def octa(r, loc, scale=(1, 1, 1), name="octa"):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=4, ring_count=2, location=loc)
    o = _obj_of(name)
    o.scale = scale
    return o

def cone(r1, r2, depth, loc, verts=16, open_ends=False, name="c"):
    bpy.ops.mesh.primitive_cone_add(
        radius1=r1, radius2=r2, depth=depth, vertices=verts, location=loc,
        end_fill_type="NOTHING" if open_ends else "NGON")
    o = _obj_of(name)
    bpy.ops.object.shade_smooth()
    return o

def boxb(size, loc, rot=(0, 0, 0), bevel=0.006, name="b"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = _obj_of(name)
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return o

def torus(major, minor, loc, rot=(0, 0, 0), name="t"):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     location=loc, rotation=rot,
                                     major_segments=28, minor_segments=10)
    o = _obj_of(name)
    bpy.ops.object.shade_smooth()
    return o

def limb(p1, p2, r1, r2, verts=12, inset=(0.0, 0.0), name="limb"):
    a, b = Vector(p1), Vector(p2)
    d = b - a
    a2 = a + d * inset[0]
    b2 = b - d * inset[1]
    d2 = b2 - a2
    mid = (a2 + b2) / 2
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=d2.length,
                                    vertices=verts, location=mid)
    o = _obj_of(name)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d2.to_track_quat("Z", "Y")
    bpy.ops.object.shade_smooth()
    return o

def solidify(o, t=0.011):
    mod = o.modifiers.new("sol", "SOLIDIFY")
    mod.thickness = t
    mod.offset = 0
    return o

def grid_mesh(name, verts, faces, mat_indices=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    if mat_indices:
        for poly, mi in zip(me.polygons, mat_indices):
            poly.material_index = mi
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.shade_smooth()
    return o

_parts = []
def P(obj, material, bone):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    vg = obj.vertex_groups.new(name=bone)
    vg.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    _parts.append(obj)
    return obj

def finish_part(name, armature):
    global _parts
    bpy.ops.object.select_all(action="DESELECT")
    for o in _parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = _parts[0]
    if len(_parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.parent = armature
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = armature
    _parts = []
    return o

# ---------------- 骨架(v2 修長比例)----------------
# Blender:Z 上、面向 -Y;glTF 匯出後面向 +Z;解剖學左 = +X。
def build_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "Armature"
    arm.data.name = "Armature"
    eb = arm.data.edit_bones
    for b in list(eb):
        eb.remove(b)

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone("Hips", (0, 0, 1.14), (0, 0, 1.26))
    bone("Spine", (0, 0, 1.26), (0, 0, 1.44), "Hips", True)
    bone("Chest", (0, 0, 1.44), (0, 0, 1.66), "Spine", True)
    bone("Neck", (0, 0, 1.66), (0, 0, 1.78), "Chest", True)
    bone("Head", (0, 0, 1.78), (0, 0, 2.02), "Neck", True)
    for s, sx in (("L", 1), ("R", -1)):
        bone(f"UpperArm_{s}", (sx * 0.175, 0, 1.635), (sx * 0.215, 0, 1.41), "Chest")
        bone(f"LowerArm_{s}", (sx * 0.215, 0, 1.41), (sx * 0.245, 0, 1.17), f"UpperArm_{s}", True)
        bone(f"Hand_{s}", (sx * 0.245, 0, 1.17), (sx * 0.258, 0, 1.06), f"LowerArm_{s}", True)
        bone(f"UpperLeg_{s}", (sx * 0.075, 0, 1.15), (sx * 0.075, 0, 0.62), "Hips")
        bone(f"LowerLeg_{s}", (sx * 0.075, 0, 0.62), (sx * 0.075, 0, 0.12), f"UpperLeg_{s}", True)
        bone(f"Foot_{s}", (sx * 0.075, 0, 0.12), (sx * 0.075, -0.135, 0.03), f"LowerLeg_{s}", True)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm

ARM = build_armature()

def arm_pts(sx):
    sh = Vector((sx * 0.175, 0, 1.635))
    el = Vector((sx * 0.215, 0, 1.41))
    wr = Vector((sx * 0.245, 0, 1.17))
    hd = Vector((sx * 0.258, 0, 1.06))
    return sh, el, wr, hd

# ============================================================
# Body:便服(navy 立領長袖 + 奶油前襟 + 白褲 + 深藍鞋)
# ============================================================
# 頭(小頭、下巴微收)
P(sphere(0.148, (0, 0, 1.90), scale=(0.86, 0.90, 1.03), seg=26, rings=20, name="head"), SKIN, "Head")
for sx in (1, -1):
    P(sphere(1, (sx * 0.052, -0.121, 1.905), scale=(0.028, 0.011, 0.037), name="sclera"), EYE_W, "Head")
    P(sphere(1, (sx * 0.052, -0.129, 1.903), scale=(0.018, 0.008, 0.026), name="iris"), IRIS, "Head")
    P(sphere(1, (sx * 0.052, -0.134, 1.901), scale=(0.009, 0.006, 0.014), name="pupil"), PUPIL, "Head")
    P(sphere(1, (sx * 0.044, -0.137, 1.915), scale=(0.006, 0.004, 0.007), name="glint"), GLINT, "Head")
    P(boxb((0.042, 0.010, 0.009), (sx * 0.052, -0.127, 1.951), rot=(0, sx * -0.12, sx * -0.10), bevel=0, name="brow"), BROW, "Head")
    if GIRL:
        P(sphere(1, (sx * 0.090, -0.101, 1.862), scale=(0.022, 0.008, 0.013), name="blush"), BLUSH, "Head")
P(boxb((0.024, 0.008, 0.007), (0, -0.130, 1.833), bevel=0, name="mouth"), MOUTH, "Head")
# 頸
P(limb((0, 0, 1.70), (0, 0, 1.83), 0.035, 0.031, name="neck"), SKIN, "Neck")
# 軀幹便服(修身)
P(cone(0.135, 0.104, 0.40, (0, 0, 1.47), verts=18, name="coat"), NAVY, "Chest")
P(boxb((0.075, 0.014, 0.36), (0, -0.126, 1.46), bevel=0.003, name="coat_front"), CREAM, "Chest")
P(solidify(cone(0.062, 0.076, 0.08, (0, 0, 1.755), verts=14, open_ends=True, name="collar"), 0.009), NAVY, "Neck")
P(cone(0.137, 0.131, 0.16, (0, 0, 1.21), verts=18, name="hipwrap"), NAVY if not GIRL else CREAM, "Hips")
if GIRL:
    P(solidify(cone(0.20, 0.138, 0.20, (0, 0, 1.06), verts=18, open_ends=True, name="skirt_base"), 0.009), CREAM, "Hips")
# 手臂
for s, sx in (("L", 1), ("R", -1)):
    sh, el, wr, hd = arm_pts(sx)
    P(sphere(0.050, sh + Vector((sx * 0.008, 0, 0.008)), name="shoulder"), NAVY, f"UpperArm_{s}")
    P(limb(sh, el, 0.042, 0.036, inset=(0.05, 0.0), name="sleeve_u"), NAVY, f"UpperArm_{s}")
    P(limb(el, wr, 0.036, 0.030, name="sleeve_l"), NAVY, f"LowerArm_{s}")
    P(sphere(0.032, hd, scale=(1, 1, 1.3), name="hand"), SKIN, f"Hand_{s}")
# 腿與鞋
for s, sx in (("L", 1), ("R", -1)):
    P(limb((sx * 0.075, 0, 1.15), (sx * 0.075, 0, 0.40), 0.062, 0.047, name="pant_u"), WHITE, f"UpperLeg_{s}")
    P(limb((sx * 0.075, 0, 0.46), (sx * 0.075, 0, 0.09), 0.047, 0.041, name="pant_l"), WHITE, f"LowerLeg_{s}")
    P(boxb((0.082, 0.20, 0.065), (sx * 0.075, -0.028, 0.034), bevel=0.022, name="shoe"), SHOE, f"Foot_{s}")
Body = finish_part("Body", ARM)

# ============================================================
# Hair
# ============================================================
P(sphere(0.158 if GIRL else 0.162, (0, 0.018, 1.925), scale=(0.93, 0.95, 0.89) if GIRL else (0.94, 0.96, 0.90), seg=26, rings=20, name="haircap"), HAIR, "Head")
if not GIRL:
    # 參考圖:銀藍短髮,往上後梳、貼頭皮的細髮束
    strands = [
        # (x, y, z, rx, rz, r, h, hi)
        (0.00, -0.10, 2.02, 0.42, 0.0, 0.030, 0.12, 1),
        (0.06, -0.09, 2.01, 0.45, -0.35, 0.027, 0.11, 0),
        (-0.06, -0.09, 2.01, 0.45, 0.35, 0.027, 0.11, 0),
        (0.11, -0.05, 1.99, 0.55, -0.7, 0.025, 0.10, 0),
        (-0.11, -0.05, 1.99, 0.55, 0.7, 0.025, 0.10, 1),
        (0.00, 0.00, 2.055, 0.30, 0.0, 0.028, 0.11, 0),
        (0.075, 0.02, 2.03, 0.55, -0.55, 0.026, 0.10, 1),
        (-0.075, 0.02, 2.03, 0.55, 0.55, 0.026, 0.10, 0),
        (0.03, 0.09, 2.02, 0.85, -0.25, 0.027, 0.11, 0),
        (-0.03, 0.09, 2.02, 0.85, 0.25, 0.027, 0.11, 0),
        (0.10, 0.10, 1.97, 1.0, -0.8, 0.024, 0.09, 0),
        (-0.10, 0.10, 1.97, 1.0, 0.8, 0.024, 0.09, 1),
        (0.00, 0.145, 1.95, 1.25, 0.0, 0.026, 0.10, 0),
    ]
    for x, y, z, rx, rz, r, h, hi in strands:
        o = cone(r, 0.003, h, (x, y, z), verts=8, name="strand")
        o.rotation_euler = Euler((rx, 0, rz))
        P(o, HAIR_HI if hi else HAIR, "Head")
    # 前額短瀏海(貼額頭)
    for x, rz, sz in [(-0.085, 0.30, 0.9), (-0.03, 0.10, 1.0), (0.03, -0.10, 1.0), (0.085, -0.30, 0.9)]:
        o = cone(0.022 * sz, 0.003, 0.075 * sz, (x, -0.118, 1.985), verts=8, name="bang")
        o.rotation_euler = Euler((math.pi * 0.93, 0, rz))
        P(o, HAIR, "Head")
    for sx in (1, -1):  # 鬢角
        o = cone(0.018, 0.003, 0.08, (sx * 0.132, -0.035, 1.855), verts=8, name="sideburn")
        o.rotation_euler = Euler((math.pi, 0, 0))
        P(o, HAIR, "Head")
else:
    # 參考圖:金色中分、後長髮、左肩前側辮
    for x, rz, sz in [(-0.095, 0.26, 0.95), (-0.048, 0.10, 1.05), (0.0, 0.0, 1.0), (0.048, -0.10, 1.05), (0.095, -0.26, 0.95)]:
        o = cone(0.028 * sz, 0.003, 0.10 * sz, (x, -0.122, 1.975), verts=8, name="bang")
        o.rotation_euler = Euler((math.pi * 0.94, 0, rz))
        P(o, HAIR_HI if abs(x) < 0.04 else HAIR, "Head")
    for sx in (1, -1):  # 側髮(細長)
        P(sphere(0.028, (sx * 0.122, -0.028, 1.79), scale=(1, 1, 2.9), name="sidelock"), HAIR, "Head")
    # 後髮(收攏、垂到背中)
    P(sphere(0.112, (0, 0.085, 1.83), scale=(0.88, 0.66, 2.0), name="backhair"), HAIR, "Head")
    P(sphere(0.07, (0, 0.10, 1.54), scale=(0.8, 0.55, 1.5), name="backhair2"), HAIR, "Head")
    # 解剖學右肩前辮子(-X;避開左手盾牌側)
    braid = [(-0.095, -0.045, 1.74, 0.030), (-0.115, -0.065, 1.64, 0.027), (-0.13, -0.075, 1.55, 0.024), (-0.14, -0.08, 1.47, 0.021), (-0.147, -0.082, 1.40, 0.017)]
    for x, y, z, r in braid:
        P(sphere(r, (x, y, z), name="braid"), HAIR_HI, "Head")
    o = cone(0.014, 0.003, 0.07, (0.015, 0.005, 2.065), verts=8, name="ahoge")
    o.rotation_euler = Euler((0.5, 0, -0.35))
    P(o, HAIR, "Head")
Hair = finish_part("Hair", ARM)

# ============================================================
# TorsoArmor:男 = 奶油軍裝背心 + navy 裙擺 + 白前擺;女 = 金胸甲
# ============================================================
VEST_M = GOLD if GIRL else CREAM
P(cone(0.148, 0.116, 0.38, (0, 0, 1.47), verts=18, name="vest"), VEST_M, "Chest")
for sx in (1, -1):
    P(boxb((0.05, 0.21, 0.32), (sx * 0.118, 0, 1.46), bevel=0.014, name="sidepanel"), GOLD if GIRL else NAVY, "Chest")
    P(boxb((0.05, 0.16, 0.10), (sx * 0.118, 0, 1.30), rot=(0, sx * 0.15, 0), bevel=0.012, name="waistplate"), GOLD if GIRL else SILVER, "Spine")
P(torus(0.118, 0.010, (0, 0, 1.655), name="necktrim"), STEEL if not GIRL else GOLD, "Chest")
# 大衣裙擺(過膝)
P(solidify(cone(0.245, 0.148, 0.42, (0, 0, 1.075), verts=18, open_ends=True, name="skirt"), 0.011), NAVY_D, "Hips")
# 白色前擺(垂到膝)
P(boxb((0.095, 0.013, 0.40), (0, -0.252, 0.90), rot=(0.10, 0, 0), bevel=0.003, name="tabard"), CREAM, "Hips")
P(boxb((0.095, 0.015, 0.026), (0, -0.272, 0.708), rot=(0.10, 0, 0), bevel=0.002, name="tabard_hem"), GOLD, "Hips")
P(boxb((0.22, 0.013, 0.026), (0, 0.248, 0.875), bevel=0.002, name="back_hem"), GOLD, "Hips")
# 胸口徽
if GIRL:
    P(octa(0.030, (0, -0.135, 1.545), scale=(0.6, 0.45, 1.4), name="emblem"), STEEL, "Chest")
    P(octa(0.030, (0, -0.135, 1.545), scale=(1.2, 0.4, 0.55), name="emblem2"), STEEL, "Chest")
else:
    P(octa(0.032, (0, -0.135, 1.50), scale=(1, 0.45, 1), name="emblem"), GOLD, "Chest")
    P(octa(0.015, (0, -0.143, 1.50), scale=(1, 0.5, 1), name="emblem_gem"), RUBY, "Chest")
TorsoArmor = finish_part("TorsoArmor", ARM)

# ============================================================
# ShoulderMantle:參考圖層疊金領(兩層 + 護頸 + 前寶石)
# ============================================================
P(solidify(cone(0.205, 0.112, 0.115, (0, 0, 1.655), verts=18, open_ends=True, name="mantle1"), 0.012), TAN, "Chest")
P(torus(0.198, 0.010, (0, 0, 1.60), name="rim1"), GOLD, "Chest")
P(solidify(cone(0.150, 0.092, 0.095, (0, 0, 1.735), verts=16, open_ends=True, name="mantle2"), 0.011), TAN, "Chest")
P(torus(0.144, 0.009, (0, 0, 1.69), name="rim2"), GOLD, "Chest")
P(solidify(cone(0.070, 0.082, 0.065 if GIRL else 0.085, (0, 0, 1.795 if GIRL else 1.815), verts=14, open_ends=True, name="gorget"), 0.010), GOLD, "Neck")
P(octa(0.016, (0, -0.152, 1.70), scale=(1, 0.6, 1), name="mantlegem"), RUBY, "Chest")
if GIRL:  # 小型金肩甲
    for sx in (1, -1):
        o = sphere(0.055, (sx * 0.185, 0, 1.645), scale=(1.1, 0.95, 0.8), name="pauldron")
        o.rotation_euler = Euler((0, sx * -0.35, 0))
        P(o, GOLD, "Chest")
ShoulderMantle = finish_part("ShoulderMantle", ARM)

# ============================================================
# Cape:長披風(領下垂至腳踝)
# ============================================================
def build_cape():
    rows, cols = 13, 9
    z_top, z_bot = 1.63, 0.24
    verts, faces, matidx = [], [], []
    for i in range(rows):
        t = i / (rows - 1)
        z = z_top + (z_bot - z_top) * t
        r = 0.125 + 0.215 * (t ** 1.2)
        for j in range(cols):
            u = j / (cols - 1) * 2 - 1
            th = u * 1.2
            x = math.sin(th) * r * 1.02
            y = math.cos(th) * r * 0.70 + 0.035 + 0.02 * math.sin(t * math.pi)
            verts.append((x, y, z))
    for i in range(rows - 1):
        for j in range(cols - 1):
            a = i * cols + j
            faces.append((a, a + 1, a + cols + 1, a + cols))
            matidx.append(1 if i >= rows - 2 else 0)
    o = grid_mesh("cape_grid", verts, faces, matidx)
    solidify(o, 0.010)
    return o

cape_o = build_cape()
cape_o.data.materials.append(NAVY_D)
cape_o.data.materials.append(CREAM if GIRL else STEEL)
vg = cape_o.vertex_groups.new(name="Chest")
vg.add(list(range(len(cape_o.data.vertices))), 1.0, "REPLACE")
_parts.append(cape_o)
Cape = finish_part("Cape", ARM)

# ============================================================
# Belt
# ============================================================
BELT_M = BELTRED if GIRL else LEATHER
P(torus(0.152, 0.017, (0, 0, 1.315), name="belt"), BELT_M, "Hips")
P(torus(0.148, 0.010, (0, 0, 1.272), rot=(0.08, 0, 0), name="belt2"), BELT_M, "Hips")
P(boxb((0.042, 0.015, 0.042), (0, -0.168, 1.315), bevel=0.005, name="buckle"), GOLD, "Hips")
if GIRL:
    P(octa(0.016, (0, -0.180, 1.315), scale=(1, 0.6, 1), name="beltgem"), RUBY, "Hips")
Belt = finish_part("Belt", ARM)

# ============================================================
# Gauntlet_L / Gauntlet_R
# ============================================================
def build_gauntlet(s, sx):
    sh, el, wr, hd = arm_pts(sx)
    P(limb(el, wr, 0.048, 0.040, inset=(0.08, -0.05), name="bracer"), SILVER, f"LowerArm_{s}")
    P(limb(el, wr, 0.054, 0.050, inset=(0.02, 0.74), name="cuff"), NAVY, f"LowerArm_{s}")
    P(sphere(0.040, hd + Vector((0, 0, 0.006)), scale=(1.0, 1.05, 1.25), name="handplate"), SILVER, f"Hand_{s}")
    P(torus(0.036, 0.008, tuple(wr), rot=(0, sx * 0.12, 0), name="wristtrim"), GOLD, f"Hand_{s}")
    return finish_part(f"Gauntlet_{s}", ARM)

Gauntlet_L = build_gauntlet("L", 1)
Gauntlet_R = build_gauntlet("R", -1)

# ============================================================
# GreaveBoot_L / GreaveBoot_R
# ============================================================
def build_greave(s, sx):
    P(limb((sx * 0.075, 0, 0.66), (sx * 0.075, 0, 0.11), 0.060, 0.050, name="shin"), SILVER, f"LowerLeg_{s}")
    P(torus(0.058, 0.010, (sx * 0.075, 0, 0.645), name="greavetrim"), NAVY, f"LowerLeg_{s}")
    P(sphere(0.052, (sx * 0.075, -0.008, 0.66), scale=(1, 1, 0.82), name="knee"), SILVER, f"LowerLeg_{s}")
    P(boxb((0.095, 0.235, 0.085), (sx * 0.075, -0.040, 0.045), bevel=0.028, name="boot"), SILVER, f"Foot_{s}")
    return finish_part(f"GreaveBoot_{s}", ARM)

GreaveBoot_L = build_greave("L", 1)
GreaveBoot_R = build_greave("R", -1)

# ============================================================
# Sockets
# ============================================================
def socket(name, bone, world_pos):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.06
    bpy.context.collection.objects.link(e)
    e.parent = ARM
    e.parent_type = "BONE"
    e.parent_bone = bone
    bpy.context.view_layer.update()
    e.matrix_world = Matrix.Translation(Vector(world_pos))
    return e

socket("Socket_Weapon_R", "Hand_R", (-0.258, -0.015, 1.03))
socket("Socket_Shield_L", "LowerArm_L", (0.29, 0.0, 1.28))
socket("Socket_Back", "Chest", (0, 0.15, 1.58))
socket("Socket_Hip", "Hips", (-0.17, 0.015, 1.24))

# ============================================================
# 動畫
# ============================================================
def make_action(name, keys):
    act = bpy.data.actions.new(name)
    ad = ARM.animation_data_create()
    ad.action = act
    for bone, kfs in keys.items():
        pb = ARM.pose.bones[bone]
        pb.rotation_mode = "XYZ"
        for frame, rot in kfs:
            pb.rotation_euler = Euler(rot, "XYZ")
            pb.keyframe_insert("rotation_euler", frame=frame)
    ad.action = None
    for pb in ARM.pose.bones:
        pb.rotation_euler = Euler((0, 0, 0))
    return act

Z = (0.0, 0.0, 0.0)
idle = make_action("Idle", {
    "Chest": [(1, Z), (29, (0.028, 0, 0)), (58, Z)],
    "Head": [(1, Z), (18, (0.01, 0.09, 0)), (40, (-0.008, -0.07, 0)), (58, Z)],
    "UpperArm_L": [(1, Z), (29, (0.02, 0, -0.04)), (58, Z)],
    "UpperArm_R": [(1, Z), (29, (0.02, 0, 0.04)), (58, Z)],
    "Spine": [(1, Z), (29, (0.010, 0, 0)), (58, Z)],
})
equip = make_action("Equip", {
    "UpperArm_R": [(1, Z), (8, (-1.25, 0.15, 0.35)), (14, (-1.25, 0.15, 0.35)), (22, Z)],
    "LowerArm_R": [(1, Z), (8, (-0.35, 0, 0)), (14, (-0.35, 0, 0)), (22, Z)],
    "Chest": [(1, Z), (8, (0.03, -0.18, 0)), (22, Z)],
    "Head": [(1, Z), (8, (-0.06, -0.15, 0)), (22, Z)],
})

ad = ARM.animation_data
for act in (idle, equip):
    tr = ad.nla_tracks.new()
    tr.name = act.name
    strip = tr.strips.new(act.name, 1, act)
    if hasattr(strip, "action_slot") and len(act.slots):
        strip.action_slot = act.slots[0]

# ============================================================
# 預覽渲染
# ============================================================
if RENDER_DIR:
    os.makedirs(RENDER_DIR, exist_ok=True)
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 560
    scene.render.resolution_y = 860
    scene.world = bpy.data.worlds.new("w")
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    views = {"front": (0, -4.6, 1.15), "side": (4.6, 0, 1.15), "back": (0, 4.6, 1.15),
             "three4": (2.9, -3.4, 1.5)}
    for vname, pos in views.items():
        cam.location = pos
        d = Vector((0, 0, 1.02)) - Vector(pos)
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = os.path.join(RENDER_DIR, f"{VARIANT}-{vname}.png")
        bpy.ops.render.render(write_still=True)
    ad.action = equip
    if hasattr(ad, "action_slot") and equip.slots:
        ad.action_slot = equip.slots[0]
    scene.frame_set(11)
    cam.location = views["three4"]
    d = Vector((0, 0, 1.1)) - Vector(views["three4"])
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(RENDER_DIR, f"{VARIANT}-equip-pose.png")
    bpy.ops.render.render(write_still=True)
    ad.action = None
    scene.frame_set(1)
    for pb in ARM.pose.bones:
        pb.rotation_euler = Euler((0, 0, 0))
    bpy.data.objects.remove(cam)

# ============================================================
# 匯出 GLB
# ============================================================
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=os.path.abspath(OUT),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_skins=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print(f"[build_knight] 匯出完成:{OUT}")
