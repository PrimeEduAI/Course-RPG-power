"""Male Art Repair v2 — S1: rebuild from untouched raw GLBs.
Integrity analysis → conservative per-part weld (0.1mm, cannot bridge panel gaps)
→ approved fit transforms → 2.05m → foot tuck → mirror/placeholders/renames.
NO decimation here. Saves male2_hq.blend + integrity report JSON."""
import bpy, bmesh, math, os, json, glob
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
RAW = "/home/ubuntu/Course-RPG-power/assets/gen-raw/meshy"
CFG = json.load(open(os.path.join(SP, "fit_config.json")))
TARGET_H = 2.05

PARTS = {
    "Body":       ("Navy_Ivory_Uniform", None),
    "Hair":       ("Snow_Fur_Hat", 2),
    "TorsoArmor": ("Fleur_de_Lis_Vanguard", 0),
    "Mantle":     ("Gilded_Pauldrons", 0),
    "Cape":       ("Navy_Cape_with_Silver", 2),
    "Belt":       ("Brown_Leather_Belt", 0),
    "GreaveBoot": ("White_Knight_Greaves", 0),
    "Sword":      ("Crimson_Crossblade", 0),
    "Shield":     ("Crimson_Star_Shield", 2),
}

bpy.ops.wm.read_factory_settings(use_empty=True)

def cluster_ranges(xs):
    hist, edges = np.histogram(xs, bins=np.arange(xs.min(), xs.max() + 0.01, 0.01))
    cuts, run = [], None
    for i, h in enumerate(hist):
        if h == 0:
            run = i if run is None else run
        else:
            if run is not None and (i - run) >= 2:
                cuts.append((edges[run] + edges[i]) / 2)
            run = None
    ranges, lo = [], xs.min() - 1
    for c in cuts:
        ranges.append((lo, c)); lo = c
    ranges.append((lo, xs.max() + 1))
    return ranges

def integrity(bm):
    comp = 0
    seen = set()
    for v in bm.verts:
        if v.index in seen:
            continue
        comp += 1
        stack = [v]
        while stack:
            u = stack.pop()
            if u.index in seen:
                continue
            seen.add(u.index)
            for e in u.link_edges:
                o = e.other_vert(u)
                if o.index not in seen:
                    stack.append(o)
    coords = {}
    dup = 0
    for v in bm.verts:
        k = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
        if k in coords:
            dup += 1
        coords[k] = 1
    nm = sum(1 for e in bm.edges if not e.is_manifold)
    deg = sum(1 for f in bm.faces if f.calc_area() < 1e-10)
    # inward-normal heuristic
    c = mathutils.Vector((0, 0, 0))
    for v in bm.verts:
        c += v.co
    c /= max(1, len(bm.verts))
    inward = sum(1 for f in bm.faces if f.normal.dot(f.calc_center_median() - c) < 0)
    return {"components": comp, "dupVerts": dup, "nonManifoldEdges": nm,
            "degenerateFaces": deg, "inwardNormalFrac": round(inward / max(1, len(bm.faces)), 3)}

report = {}
for name, (key, keep) in PARTS.items():
    before = set(bpy.data.objects)
    f = glob.glob(os.path.join(RAW, f"*{key}*.glb"))[0]
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
    obj = new[0]
    obj.parent = None
    for o in set(bpy.data.objects) - before:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    obj.name = name
    me = obj.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    if keep is not None:
        lo, hi = cluster_ranges(co[:, 0])[keep]
        bm = bmesh.new(); bm.from_mesh(me)
        doomed = [v for v in bm.verts if not (lo <= v.co.x < hi)]
        bmesh.ops.delete(bm, geom=doomed, context='VERTS')
        bm.to_mesh(me); bm.free(); me.update()

    # integrity before weld
    bm = bmesh.new(); bm.from_mesh(me)
    stat_before = integrity(bm)
    v0, f0 = len(bm.verts), len(bm.faces)
    # conservative weld: 0.1mm in raw scale — merges only coincident seam
    # duplicates; real panel gaps / hair layers are orders of magnitude wider.
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0001)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
    stat_after = integrity(bm)
    v1, f1 = len(bm.verts), len(bm.faces)
    bm.to_mesh(me); bm.free(); me.update()
    report[name] = {"before": stat_before, "after": stat_after,
                    "vertsMerged": v0 - v1, "facesRemoved": f0 - f1}
    print(name, json.dumps(report[name]))

    # center like prepare_assembly
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    mn, mx = co.min(0), co.max(0)
    center = (mn + mx) / 2
    shift = mathutils.Vector((center[0], center[1], mn[2] if name == "Body" else center[2]))
    for v in me.vertices:
        v.co -= shift
    me.update()
    obj.matrix_world = mathutils.Matrix.Identity(4)

# apply fit transforms into mesh data
def M(t):
    sc = t["scale"] if isinstance(t["scale"], list) else [t["scale"]] * 3
    T = mathutils.Matrix.Translation(mathutils.Vector(t["loc"]))
    R = mathutils.Euler([math.radians(a) for a in t.get("rot", [0, 0, 0])], 'XYZ').to_matrix().to_4x4()
    S = mathutils.Matrix.Diagonal(mathutils.Vector(sc + [1]))
    return T @ R @ S

for name in PARTS:
    o = bpy.data.objects[name]
    o.data.transform(M(CFG[name]))

# global scale to 2.05, feet to 0
body = bpy.data.objects["Body"]
co = np.empty(len(body.data.vertices) * 3); body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
s = TARGET_H / (co[:, 2].max() - co[:, 2].min())
S = mathutils.Matrix.Scale(s, 4)
for name in PARTS:
    bpy.data.objects[name].data.transform(S)
co = np.empty(len(body.data.vertices) * 3); body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
T = mathutils.Matrix.Translation((0, 0, -co[:, 2].min()))
for name in PARTS:
    bpy.data.objects[name].data.transform(T)

# foot tuck (v1.1 fix retained)
foot_h = 0.10
bco = np.empty(len(body.data.vertices) * 3); body.data.vertices.foreach_get("co", bco); bco = bco.reshape(-1, 3)
for sgn in (1, -1):
    m = (bco[:, 2] < foot_h) & (bco[:, 0] * sgn > 0)
    if m.any():
        cx, cy = bco[m, 0].mean(), bco[m, 1].mean()
        for i in np.where(m)[0]:
            v = body.data.vertices[i]
            fade = 1.0 - v.co.z / foot_h
            k = 1.0 - 0.12 * fade
            v.co.x = cx + (v.co.x - cx) * k
            v.co.y = cy + (v.co.y - cy) * k
body.data.update()

# mirror greave, placeholder gauntlets, renames (as approved pipeline)
gr = bpy.data.objects["GreaveBoot"]; gr.name = "GreaveBoot_L"
gr2 = gr.copy(); gr2.data = gr.data.copy(); gr2.name = "GreaveBoot_R"
bpy.context.scene.collection.objects.link(gr2)
gr2.data.transform(mathutils.Matrix.Diagonal(mathutils.Vector((-1, 1, 1, 1))))
bm = bmesh.new(); bm.from_mesh(gr2.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(gr2.data); bm.free()

def extract_region(src, name, xmin, xmax, zmin, zmax):
    dup = src.copy(); dup.data = src.data.copy(); dup.name = name
    bpy.context.scene.collection.objects.link(dup)
    bm = bmesh.new(); bm.from_mesh(dup.data)
    doomed = [v for v in bm.verts if not (xmin <= v.co.x <= xmax and zmin <= v.co.z <= zmax)]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    for v in bm.verts:
        v.co += v.normal * 0.003
    bm.to_mesh(dup.data); bm.free()

extract_region(body, "Gauntlet_L", 0.30, 1.0, 0.90, 1.30)
extract_region(body, "Gauntlet_R", -1.0, -0.30, 0.90, 1.30)
bpy.data.objects["Mantle"].name = "ShoulderMantle"
for o in bpy.data.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = True
        if o.data.materials:
            o.data.materials[0].name = f"M_{o.name.replace('_L','').replace('_R','')}"

total = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
print(f"HQ_TOTAL_TRIS={total}")
with open(os.path.join(SP, "v2_integrity.json"), "w") as fjson:
    json.dump(report, fjson, indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male2_hq.blend"))
print("S1_OK")
