"""S3: eye meshes + texture corrections + repack. male2_opt → male2_tex.blend"""
import bpy, bmesh, math, os
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
TMP = os.path.join(SP, "teximg_v2"); os.makedirs(TMP, exist_ok=True)

def img_array(img):
    n = img.size[0] * img.size[1] * 4
    a = np.empty(n, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)

def img_write(img, a):
    img.pixels.foreach_set(a.astype(np.float32).ravel())
    img.update()

def tex_of(obj, node_filter=None):
    m = obj.data.materials[0]
    out = {}
    for n in m.node_tree.nodes:
        if n.type != 'TEX_IMAGE' or not n.image:
            continue
        for l in n.outputs[0].links:
            tgt = l.to_node
            key = None
            if tgt.type == 'BSDF_PRINCIPLED' and l.to_socket.name == 'Base Color':
                key = 'base'
            elif tgt.type == 'NORMAL_MAP':
                key = 'normal'
            elif tgt.type == 'BSDF_PRINCIPLED' and l.to_socket.name in ('Metallic', 'Roughness'):
                key = 'mr'
            elif tgt.type == 'SEPARATE_COLOR' or tgt.type == 'SEPRGB':
                key = 'mr'
            if key:
                out[key] = n.image
    return out

body = bpy.data.objects["Body"]

# ---------- 1) locate painted eyes via texel sampling ----------
base_img = tex_of(body)['base']
arr = img_array(base_img)
Wt, Ht = base_img.size[0], base_img.size[1]
me = body.data
uv = me.uv_layers.active.data
dark_centers = []
for poly in me.polygons:
    c = me.vertices[poly.vertices[0]].co
    if c.z < 1.70 or c.y > 0.02:
        continue
    vals = []
    for li in poly.loop_indices:
        u, v = uv[li].uv
        px, py = int(u * Wt) % Wt, int(v * Ht) % Ht
        vals.append(arr[py, px, :3].mean())
    if np.mean(vals) < 0.16:
        dark_centers.append(list(poly.center))
dark_centers = np.array(dark_centers)
print("dark eye polys:", len(dark_centers))

# face midline from front head verts
vco = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", vco); vco = vco.reshape(-1, 3)
front_face = vco[(vco[:, 2] > 1.72) & (vco[:, 2] < 1.90) & (vco[:, 1] < -0.05)]
mid_x = float(np.median(front_face[:, 0]))
print("face mid_x", mid_x)

def local_yfront(x, z):
    m = (np.abs(vco[:, 0] - x) < 0.022) & (np.abs(vco[:, 2] - z) < 0.022) & (vco[:, 1] < 0)
    return float(vco[m, 1].min()) if m.any() else -0.09

eyes = {}
for side, sgn in (("L", 1), ("R", -1)):
    pts = dark_centers[(dark_centers[:, 0] - mid_x) * sgn > 0.005]
    if not len(pts):
        eyes[side] = None; continue
    pts = pts[pts[:, 1] < np.percentile(pts[:, 1], 60)]
    zmed = np.median(pts[:, 2])
    pts = pts[np.abs(pts[:, 2] - zmed) < 0.035]
    cen = pts.mean(0)
    w = min((pts[:, 0].max() - pts[:, 0].min()) * 1.35, 0.062)
    h = min((pts[:, 2].max() - pts[:, 2].min()) * 1.50, 0.052)
    valid = 1.80 < float(np.median(pts[:, 2])) < 1.94
    eyes[side] = [cen, max(w, 0.030), max(h, 0.024), float(pts[:, 1].min()), valid]
    print(side, cen, w, h, "valid" if valid else "INVALID")

good = [s for s in eyes if eyes[s] and eyes[s][4]]
if not good:
    raise RuntimeError("no valid eye cluster")
if len(good) == 1:
    g = eyes[good[0]]
    other = "L" if good[0] == "R" else "R"
    mx = 2 * mid_x - g[0][0]
    mz = g[0][2]
    yf = local_yfront(mx, mz)
    eyes[other] = [np.array([mx, g[0][1], mz]), g[1], g[2], yf, True]
    print(f"mirrored {other} from {good[0]}: x={mx:.4f} z={mz:.4f} yfront={yf:.4f}")
eyes = {s: tuple(v[:4]) for s, v in eyes.items()}

# ---------- 1.5) erase old painted eyes with nearby skin tone ----------
# skin tone: bright texels sampled on face front at eye height
skin_samples = []
eraser_polys = []
for poly in me.polygons:
    c = me.vertices[poly.vertices[0]].co
    if not (1.78 < c.z < 1.95 and c.y < 0.0):
        continue
    near_eye = any(abs(c.z - e[0][2]) < 0.020 and abs(c.x - e[0][0]) < 0.050
                   for e in eyes.values())
    texels = []
    for li in poly.loop_indices:
        u, v = uv[li].uv
        texels.append(((int(u * Wt) % Wt), (int(v * Ht) % Ht)))
    vals = [arr[py, px, :3] for px, py in texels]
    mean_val = np.mean([v.mean() for v in vals])
    if mean_val > 0.55:
        skin_samples.append(np.mean(vals, axis=0))
    elif mean_val < 0.30 and near_eye:
        eraser_polys.append(texels)
skin = np.median(np.array(skin_samples), axis=0) if skin_samples else np.array([0.93, 0.82, 0.74])
R_ER = 14
yy, xx = np.mgrid[-R_ER:R_ER + 1, -R_ER:R_ER + 1]
disk = (xx ** 2 + yy ** 2) <= R_ER ** 2
stamped = 0
for texels in eraser_polys:
    for px, py in texels:
        x0, x1 = max(0, px - R_ER), min(Wt, px + R_ER + 1)
        y0, y1 = max(0, py - R_ER), min(Ht, py + R_ER + 1)
        sub = disk[(y0 - py + R_ER):(y1 - py + R_ER), (x0 - px + R_ER):(x1 - px + R_ER)]
        region = arr[y0:y1, x0:x1, :3]
        region[sub] = skin
        stamped += 1
img_write(base_img, arr)
print(f"erased old eyes: {len(eraser_polys)} polys, {stamped} stamps, skin={skin.round(3)}")

# ---------- 2) build eye patches, join into Body ----------
eye_mat = bpy.data.materials.new("M_Eyes")
eye_mat.use_nodes = True
bsdf = eye_mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Specular IOR Level"].default_value = 0.3
tex = eye_mat.node_tree.nodes.new("ShaderNodeTexImage")
eye_img = bpy.data.images.load(os.path.join(SP, "eye_L.png"))
eye_img.pack()
tex.image = eye_img
eye_mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
eye_mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
eye_mat.blend_method = 'CLIP'

patches = []
for side, (cen, w, h, yfront) in eyes.items():
    bm = bmesh.new()
    NU, NV = 16, 12
    verts = []
    for j in range(NV + 1):
        for i in range(NU + 1):
            u = i / NU; v = j / NV
            x = (u - 0.5) * w
            z = (v - 0.5) * h
            r2 = ((u - 0.5) * 2) ** 2 + ((v - 0.5) * 2) ** 2
            y = 0.0045 * r2  # dome toward -Y at center
            verts.append(bm.verts.new((cen[0] + x, yfront - 0.0035 + y, cen[2] + z)))
    bm.verts.ensure_lookup_table()
    faces = []
    for j in range(NV):
        for i in range(NU):
            a = j * (NU + 1) + i
            f = bm.faces.new([verts[a], verts[a + 1], verts[a + NU + 2], verts[a + NU + 1]])
            faces.append((f, i, j))
    uvl = bm.loops.layers.uv.new("UVMap")
    for f, i, j in faces:
        for loop in f.loops:
            vi = [k for k, vv in enumerate(verts) if vv == loop.vert][0]
            uu = (vi % (NU + 1)) / NU
            vv2 = (vi // (NU + 1)) / NV
            if side == "R":
                uu = 1.0 - uu
            loop[uvl].uv = (uu, 1.0 - vv2)
    mesh = bpy.data.meshes.new(f"Eye_{side}")
    bm.to_mesh(mesh); bm.free()
    ob = bpy.data.objects.new(f"Eye_{side}", mesh)
    mesh.materials.append(eye_mat)
    bpy.context.scene.collection.objects.link(ob)
    for p in mesh.polygons:
        p.use_smooth = True
    patches.append(ob)

bpy.ops.object.select_all(action='DESELECT')
for p in patches:
    p.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
print("eyes joined; body materials:", [m.name for m in body.data.materials])

# ---------- 3) hair tint to light blue-grey ----------
hair = bpy.data.objects["Hair"]
himg = tex_of(hair)['base']
a = img_array(himg)
a[:, :, 0] *= 0.78; a[:, :, 1] *= 0.84; a[:, :, 2] *= 0.97
img_write(himg, np.clip(a, 0, 1))
print("hair tinted")

# ---------- 4) shield field silver-white ----------
sh = bpy.data.objects["Shield"]
simg = tex_of(sh)['base']
a = img_array(simg)
rgb = a[:, :, :3]
mx, mn = rgb.max(2), rgb.min(2)
sat = (mx - mn) / np.maximum(mx, 1e-4)
mask = (sat < 0.18) & (mx > 0.08) & (mx < 0.62)
lift = np.where(mask, 0.30 + 0.85 * mx, mx)
scale = np.where(mx > 1e-4, lift / np.maximum(mx, 1e-4), 1.0)
a[:, :, :3] = np.clip(rgb * scale[:, :, None], 0, 1)
img_write(simg, a)
print("shield recolored", int(mask.sum()))

# ---------- 5) roughness floor on silver metals ----------
for part in ("GreaveBoot_L", "Shield", "Sword", "ShoulderMantle"):
    o = bpy.data.objects[part]
    t = tex_of(o)
    if 'mr' not in t:
        # find any image linked via separate nodes: fallback by name Image_2
        continue
    mrimg = t['mr']
    a = img_array(mrimg)
    a[:, :, 1] = np.maximum(a[:, :, 1], 0.36)  # G = roughness floor
    img_write(mrimg, a)
    print("roughness floor", part)

# ---------- 6) cape poke-through fix at shoulders ----------
cape = bpy.data.objects["Cape"]
for v in cape.data.vertices:
    if v.co.z > 1.46:
        f = min(1.0, (v.co.z - 1.46) / 0.12)
        v.co.x *= (1.0 - 0.035 * f)
        v.co.y += 0.006 * f
cape.data.update()
print("cape tucked")

# ---------- 7) resize + strip emissive + repack ----------
normal_imgs = set()
for m in bpy.data.materials:
    if m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == 'NORMAL_MAP':
                for l in n.inputs["Color"].links:
                    if l.from_node.type == 'TEX_IMAGE' and l.from_node.image:
                        normal_imgs.add(l.from_node.image.name)
body_imgs = {n.image.name for mm in body.data.materials if mm and mm.use_nodes
             for n in mm.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image}
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
for img in list(bpy.data.images):
    if not img.users:
        bpy.data.images.remove(img); continue
    if not img.size[0]:
        continue
    is_normal = img.name in normal_imgs
    target = 2048 if (img.name in body_imgs and not is_normal) else 1024
    if img.name.startswith("eye_"):
        target = min(512, img.size[0])
    if max(img.size) > target:
        img.scale(target, target)
    safe = "".join(c if c.isalnum() else "_" for c in img.name)
    if is_normal or img.name.startswith("eye_"):
        img.file_format = 'PNG'; path = os.path.join(TMP, safe + ".png")
    else:
        img.file_format = 'JPEG'; path = os.path.join(TMP, safe + ".jpg")
    img.filepath_raw = path
    img.save()
    img.source = 'FILE'; img.filepath = path
    img.reload(); img.pack()

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male2_tex.blend"))
print("S3_OK")
