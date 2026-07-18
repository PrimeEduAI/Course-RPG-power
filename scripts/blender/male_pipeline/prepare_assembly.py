"""One-time scene prep: import body + selected clusters of each part, center each part
at origin (rest transform identity), measure body landmarks, save cache .blend.
Original GLBs on disk are never modified."""
import bpy, bmesh, sys, os, json, math
import numpy as np
import mathutils

RAW = "/home/ubuntu/Course-RPG-power/assets/gen-raw/meshy"
SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
CACHE = os.path.join(SP, "male_parts_cache.blend")

PARTS = {  # name: (file key, keep cluster index or None=single instance)
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

def find_file(key):
    import glob as g
    return g.glob(os.path.join(RAW, f"*{key}*.glb"))[0]

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

info = {}
for name, (key, keep) in PARTS.items():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=find_file(key))
    new = [o for o in set(bpy.data.objects) - before if o.type == 'MESH']
    obj = new[0]
    # flatten any importer transform
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
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    mn, mx = co.min(0), co.max(0)
    center = (mn + mx) / 2
    # move geometry so part is centered at origin, bottom at z for body
    shift = mathutils.Vector((center[0], center[1], mn[2] if name == "Body" else center[2]))
    for v in me.vertices:
        v.co -= shift
    me.update()
    obj.location = (0, 0, 0)
    co -= np.array(shift)
    info[name] = {"dims": (mx - mn).round(4).tolist(),
                  "zmin": float(co[:, 2].min()), "zmax": float(co[:, 2].max())}
    print(f"{name}: dims={info[name]['dims']}")

# body landmarks (facing -Y assumed)
body = bpy.data.objects["Body"]
co = np.empty(len(body.data.vertices) * 3)
body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
H = co[:, 2].max()
def width_at(z, tol=0.01):
    sl = co[np.abs(co[:, 2] - z) < tol]
    return float(sl[:, 0].max() - sl[:, 0].min()) if len(sl) else 0.0
landmarks = {
    "height": float(H),
    "headTop": float(H),
    "headWidth": width_at(H - 0.10),
    "neckZ": H - 0.30,
    "shoulderZ": H - 0.36,
    "shoulderWidth": width_at(H - 0.38),
    "chestZ": H - 0.55,
    "waistZ": H - 0.78,
    "waistWidth": width_at(H - 0.78),
    "hipZ": H - 0.95,
    "hipWidth": width_at(H - 0.95),
    "kneeZ": H * 0.30,
    "ankleZ": H * 0.05,
    "legX": 0.09,
}
info["landmarks"] = landmarks
print(json.dumps(landmarks, indent=1))
with open(os.path.join(SP, "male_parts_info.json"), "w") as f:
    json.dump(info, f, indent=1)

bpy.ops.wm.save_as_mainfile(filepath=CACHE)
print("PREPARE_OK", CACHE)
