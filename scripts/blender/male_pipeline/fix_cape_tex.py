"""Fix Cape weights (z-band manual) + really downsize/repack textures → male_v5.blend"""
import bpy, os
import numpy as np

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
TMP = os.path.join(SP, "teximg"); os.makedirs(TMP, exist_ok=True)

# ---------- cape weights ----------
cape = bpy.data.objects["Cape"]
rig = bpy.data.objects["Armature"]
for vg in list(cape.vertex_groups):
    cape.vertex_groups.remove(vg)
# ensure armature modifier exists
if not any(m.type == 'ARMATURE' for m in cape.modifiers):
    mod = cape.modifiers.new("Armature", 'ARMATURE')
    mod.object = rig
cape.parent = rig

BANDS = [  # (bone, z_top, z_bottom) — linear blend between neighbours
    ("Chest",    9.99, 1.42),
    ("CapeRoot", 1.42, 1.24),
    ("Cape_1",   1.24, 0.96),
    ("Cape_2",   0.96, 0.60),
    ("Cape_3",   0.60, -9.9),
]
groups = {b: cape.vertex_groups.new(name=b) for b, _, _ in BANDS}
centers = [(t + b) / 2 for _, t, b in BANDS]
centers[0] = 1.50
centers[-1] = 0.35
names = [b for b, _, _ in BANDS]
for v in cape.data.vertices:
    z = v.co.z
    if z >= centers[0]:
        groups[names[0]].add([v.index], 1.0, 'REPLACE'); continue
    if z <= centers[-1]:
        groups[names[-1]].add([v.index], 1.0, 'REPLACE'); continue
    for i in range(len(centers) - 1):
        c0, c1 = centers[i], centers[i + 1]
        if c1 <= z <= c0:
            t = (z - c1) / (c0 - c1)
            if t > 0:
                groups[names[i]].add([v.index], t, 'REPLACE')
            if t < 1:
                groups[names[i + 1]].add([v.index], 1 - t, 'REPLACE')
            break
print("cape weights done")

# ---------- textures ----------
# classify normal maps per material node graph
normal_imgs = set()
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'NORMAL_MAP':
            for l in n.inputs["Color"].links:
                if l.from_node.type == 'TEX_IMAGE' and l.from_node.image:
                    normal_imgs.add(l.from_node.image.name)

body_imgs = {n.image.name for m in bpy.data.objects["Body"].data.materials
             for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}

for img in list(bpy.data.images):
    if not img.size[0]:
        continue
    is_normal = img.name in normal_imgs
    target = 2048 if (img.name in body_imgs and not is_normal) else 1024
    if max(img.size) > target:
        img.scale(target, target)
    safe = "".join(c if c.isalnum() else "_" for c in img.name)
    if is_normal:
        img.file_format = 'PNG'
        path = os.path.join(TMP, safe + ".png")
    else:
        img.file_format = 'JPEG'
        path = os.path.join(TMP, safe + ".jpg")
    img.filepath_raw = path
    img.save()
    img.source = 'FILE'
    img.filepath = path
    img.reload()
    img.pack()
    print("repacked", img.name, "->", os.path.basename(path), img.size[0])

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male_v5.blend"))
print("FIXTEX_OK")
