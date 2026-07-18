"""Script A: assembly checkpoint → game-budget meshes (v2 blend).
- apply transforms, scale to 2.05m, per-part decimate, mirror greave,
  placeholder gauntlets from body hands, texture downsize, emissive strip.
Original raw GLBs untouched (works on .blend copy)."""
import bpy, bmesh, math, os
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
TARGET_H = 2.05

BUDGET = {  # object name -> target tris
    "Body": 22000, "Hair": 18000, "TorsoArmor": 14000, "Mantle": 10000,
    "Cape": 7000, "Belt": 3000, "GreaveBoot": 6000, "Sword": 6000, "Shield": 8000,
}

def tri_count(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)

# 1) drop mirror dup (recreated post-decimate)
for o in list(bpy.data.objects):
    if o.name.endswith("_MIR"):
        bpy.data.objects.remove(o, do_unlink=True)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']

# 2) apply world transform into mesh data
for o in meshes:
    o.data = o.data.copy()  # single user
    mw = o.matrix_world.copy()
    o.data.transform(mw)
    o.matrix_world = mathutils.Matrix.Identity(4)

# 3) global scale to 2.05
body = bpy.data.objects["Body"]
co = np.empty(len(body.data.vertices) * 3)
body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
s = TARGET_H / (co[:, 2].max() - co[:, 2].min())
S = mathutils.Matrix.Scale(s, 4)
for o in meshes:
    o.data.transform(S)
print(f"GLOBAL_SCALE={s:.4f}")

# feet to z=0
co = np.empty(len(body.data.vertices) * 3)
body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
dz = -co[:, 2].min()
T = mathutils.Matrix.Translation((0, 0, dz))
for o in meshes:
    o.data.transform(T)

# 3.5) tuck body shoes inward so GreaveBoots fully enclose them
foot_h = 0.10
bco = np.empty(len(body.data.vertices) * 3)
body.data.vertices.foreach_get("co", bco); bco = bco.reshape(-1, 3)
for sgn in (1, -1):
    m = (bco[:, 2] < foot_h) & (bco[:, 0] * sgn > 0)
    if not m.any():
        continue
    cx, cy = bco[m, 0].mean(), bco[m, 1].mean()
    for i in np.where(m)[0]:
        v = body.data.vertices[i]
        fade = 1.0 - v.co.z / foot_h  # 1 at sole, 0 at ankle line
        k = 1.0 - 0.12 * fade
        v.co.x = cx + (v.co.x - cx) * k
        v.co.y = cy + (v.co.y - cy) * k
body.data.update()
print("FOOT_TUCK_OK")

# 4) decimate each to budget
bpy.context.view_layer.update()
for o in meshes:
    t = tri_count(o)
    tgt = BUDGET[o.name]
    if t > tgt:
        mod = o.modifiers.new("dec", 'DECIMATE')
        mod.ratio = tgt / t
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    print(f"DECIMATE {o.name}: {t} -> {tri_count(o)}")

# 5) mirror greave -> L/R
gr = bpy.data.objects["GreaveBoot"]
gr.name = "GreaveBoot_L"  # at +X = anatomical left (faces -Y)
gr2 = gr.copy(); gr2.data = gr.data.copy(); gr2.name = "GreaveBoot_R"
bpy.context.scene.collection.objects.link(gr2)
M = mathutils.Matrix.Diagonal(mathutils.Vector((-1, 1, 1, 1)))
gr2.data.transform(M)
bm = bmesh.new(); bm.from_mesh(gr2.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(gr2.data); bm.free(); gr2.data.update()

# 6) placeholder gauntlets from body hand region (documented interim part)
def extract_region(src, name, xmin, xmax, zmin, zmax):
    dup = src.copy(); dup.data = src.data.copy(); dup.name = name
    bpy.context.scene.collection.objects.link(dup)
    bm = bmesh.new(); bm.from_mesh(dup.data)
    doomed = [v for v in bm.verts
              if not (xmin <= v.co.x <= xmax and zmin <= v.co.z <= zmax)]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    # inflate 3mm along normals to sit over body
    for v in bm.verts:
        v.co += v.normal * 0.003
    bm.to_mesh(dup.data); bm.free(); dup.data.update()
    return dup

extract_region(body, "Gauntlet_L", 0.30, 1.0, 0.90, 1.30)
extract_region(body, "Gauntlet_R", -1.0, -0.30, 0.90, 1.30)
print("GAUNTLET_L tris", tri_count(bpy.data.objects["Gauntlet_L"]))
print("GAUNTLET_R tris", tri_count(bpy.data.objects["Gauntlet_R"]))

# 7) contract renames
bpy.data.objects["Mantle"].name = "ShoulderMantle"

# 8) textures: body keeps 2048; others -> 1024; strip emissive everywhere
keep2k = {img.name for m in body.data.materials for n in m.node_tree.nodes
          if n.type == 'TEX_IMAGE' and (img := n.image)}
for img in bpy.data.images:
    if img.size[0] and img.name not in keep2k and max(img.size) > 1024:
        img.scale(1024, 1024)
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            for inp in (n.inputs.get("Emission Color"), n.inputs.get("Emission Strength")):
                if inp:
                    for l in list(inp.links):
                        m.node_tree.links.remove(l)
            if n.inputs.get("Emission Strength"):
                n.inputs["Emission Strength"].default_value = 0.0
# purge orphaned images
for img in list(bpy.data.images):
    if not img.users:
        bpy.data.images.remove(img)

# rename materials by part
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.materials:
        o.data.materials[0].name = f"M_{o.name.replace('_L','').replace('_R','')}"
print("MATERIALS", sorted({m.name for m in bpy.data.materials}))
total = sum(tri_count(o) for o in bpy.data.objects
            if o.type == 'MESH' and o.name not in ("Sword", "Shield"))
print(f"CHARACTER_TRIS={total}")

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male_v2.blend"))
print("PROCESS_OK")
