"""Male Art Repair v3 — 新 B 資產單獨檢收(整合前必跑;不修改原始 GLB)。

用法:
  blender -b -noaudio --python v3_intake.py -- <raw.glb> <outdir>

輸出:
  <outdir>/<name>_stats.json           統計+完整性(孤島/重複頂點/非流形/退化面)
  <outdir>/<name>_c<i>_{front,tq,side,back}.png  每個視角實體的四視圖
(Meshy 多視角融合檔會自動以 X 軸分群;單實體檔輸出一組。)
"""
import bpy, bmesh, sys, os, json, math, hashlib
import numpy as np
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
glb_path, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)
name = os.path.splitext(os.path.basename(glb_path))[0][:40]

h = hashlib.sha256()
with open(glb_path, "rb") as f:
    for chunk in iter(lambda: f.read(1 << 20), b""):
        h.update(chunk)

def import_fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    return [o for o in bpy.data.objects if o.type == 'MESH']

meshes = import_fresh()
obj = meshes[0]
me = obj.data
n = len(me.vertices)
co = np.empty(n * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)

def cluster_ranges(xs):
    hist, edges = np.histogram(xs, bins=np.arange(xs.min(), xs.max() + 0.01, 0.01))
    cuts, run = [], None
    for i, hh in enumerate(hist):
        if hh == 0:
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

ranges = cluster_ranges(co[:, 0])
bm = bmesh.new(); bm.from_mesh(me)
coords = set(); dup = 0
for v in bm.verts:
    k = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
    dup += k in coords
    coords.add(k)
stats = {
    "file": os.path.basename(glb_path),
    "sha256": h.hexdigest(),
    "sizeBytes": os.path.getsize(glb_path),
    "meshObjects": len(meshes),
    "triangles": (me.calc_loop_triangles() or len(me.loop_triangles)),
    "materials": len(bpy.data.materials),
    "textures": [{"name": i.name, "w": i.size[0], "h": i.size[1]} for i in bpy.data.images if i.size[0]],
    "viewInstances": len(ranges),
    "dupVerts": dup,
    "nonManifoldEdges": sum(1 for e in bm.edges if not e.is_manifold),
    "degenerateFaces": sum(1 for f in bm.faces if f.calc_area() < 1e-10),
    "dimensions": [round(float(v), 4) for v in (co.max(0) - co.min(0))],
}
bm.free()
with open(os.path.join(outdir, f"{name}_stats.json"), "w") as f:
    json.dump(stats, f, ensure_ascii=False, indent=1)
print("STATS", json.dumps(stats)[:400])

for ci, (lo, hi) in enumerate(ranges):
    obj = import_fresh()[0]
    bm = bmesh.new(); bm.from_mesh(obj.data)
    doomed = [v for v in bm.verts if not (lo <= v.co.x < hi)]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    vs = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", vs); vs = vs.reshape(-1, 3)
    dims = vs.max(0) - vs.min(0)
    center = mathutils.Vector(((vs.max(0) + vs.min(0)) / 2).tolist())
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = False
    scene.render.resolution_x = 560; scene.render.resolution_y = 640
    w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.95, 0.95, 0.96, 1)
    for e_, rx, rz, nm in [(2.6, 55, 35, "K"), (0.9, 65, -110, "F"), (1.2, 40, 175, "R")]:
        s = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'SUN'))
        s.data.energy = e_; s.rotation_euler = (math.radians(rx), 0, math.radians(rz))
        scene.collection.objects.link(s)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("C")); cam.data.lens = 70
    scene.collection.objects.link(cam); scene.camera = cam
    size = float(max(dims)); dist = size * 2.3
    for vname, ang in [("front", 0), ("tq", 40), ("side", 90), ("back", 180)]:
        a = math.radians(ang)
        cam.location = (center.x + dist * math.sin(a), center.y - dist * math.cos(a), center.z + size * 0.1)
        d = center - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(outdir, f"{name}_c{ci}_{vname}.png")
        bpy.ops.render.render(write_still=True)
print("INTAKE_OK")
