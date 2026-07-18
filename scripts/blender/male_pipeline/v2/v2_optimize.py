"""S2: protected-region decimation with before/after renders. male2_hq → male2_opt.blend"""
import bpy, bmesh, math, os, sys
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
OUT = os.path.join(SP, "v2_compare"); os.makedirs(OUT, exist_ok=True)
stage = sys.argv[sys.argv.index("--") + 1]  # "before" or "after"

def tri(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)

# ---------- render setup (identical both stages) ----------
def setup_and_render(tag):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = False
    w = scene.world or bpy.data.worlds.new("W")
    scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.97, 0.97, 0.97, 1)
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)
    def sun(name, e, rx, rz):
        s = bpy.data.objects.new(name, bpy.data.lights.new(name, 'SUN'))
        s.data.energy = e; s.rotation_euler = (math.radians(rx), 0, math.radians(rz))
        scene.collection.objects.link(s)
    sun("Key", 2.6, 55, 35); sun("Fill", 0.9, 65, -110); sun("Rim", 1.2, 40, 175)
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("C"))
    scene.collection.objects.link(cam); scene.camera = cam
    def shoot(name, ang, z, dist, lens, res):
        scene.render.resolution_x, scene.render.resolution_y = res
        cam.data.lens = lens
        a = math.radians(ang)
        cam.location = (dist * math.sin(a), -dist * math.cos(a), z)
        d = mathutils.Vector((0, 0, z)) - cam.location
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(OUT, f"{name}_{tag}.png")
        bpy.ops.render.render(write_still=True)
    shoot("cmp_front", 0, 1.03, 7.5, 90, (600, 880))
    shoot("cmp_face", 18, 1.80, 1.6, 85, (600, 700))
    shoot("cmp_mantle", 15, 1.55, 1.15, 80, (600, 600))
    shoot("cmp_shield", 35, 0.95, 1.6, 80, (600, 700))

if stage == "before":
    setup_and_render("before")
    print("S2_BEFORE_OK")
    raise SystemExit

# ---------- protected-region decimation ----------
# rebuild mirror after decimating L
bpy.data.objects.remove(bpy.data.objects["GreaveBoot_R"], do_unlink=True)

BUDGET = {"Body": 30000, "Hair": 26000, "TorsoArmor": 18000, "ShoulderMantle": 19000,
          "Cape": 9000, "Belt": 4000, "GreaveBoot_L": 11000,
          "Gauntlet_L": 2500, "Gauntlet_R": 2500, "Sword": 8000, "Shield": 17000}

def protect_mask(o):
    """Return per-vertex protect bool (True = keep detail)."""
    n = len(o.data.vertices)
    co = np.empty(n * 3); o.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    m = np.zeros(n, bool)
    if o.name == "Body":
        m = co[:, 2] > 1.58                       # head + face
        m |= (np.abs(co[:, 0]) > 0.30) & (co[:, 2] < 1.15) & (co[:, 2] > 0.88)  # hands/fingers
    elif o.name == "ShoulderMantle":
        ymin = co[:, 1].min()
        m = (co[:, 1] < ymin + 0.35 * (co[:, 1].max() - ymin)) & (np.abs(co[:, 0]) < 0.13)  # front ornament + straps
    elif o.name == "Shield":
        ymin = co[:, 1].min()
        m = co[:, 1] < ymin + 0.45 * (co[:, 1].max() - ymin)   # raised emblem side
    elif o.name == "GreaveBoot_L":
        m = co[:, 2] > 0.52                        # knee poleyn
    elif o.name == "Hair":
        r = co - co.mean(0)
        m = np.linalg.norm(r, axis=1) > np.percentile(np.linalg.norm(r, axis=1), 80)  # strand tips
    return m

for name, tgt in BUDGET.items():
    o = bpy.data.objects[name]
    t0 = tri(o)
    if t0 <= tgt:
        print(f"SKIP {name} {t0}")
        continue
    m = protect_mask(o)
    p = float(m.mean())
    K = 2.5  # protected regions keep ~2.5x density of the rest
    tp_target = tgt * (p * K) / max(1e-6, p * K + (1 - p)) if p > 0 else 0
    tu_target = tgt - tp_target
    bpy.context.view_layer.objects.active = o
    # pass 1: global gentle decimate so protected region lands on its own budget
    if p > 0:
        r1 = min(1.0, max(0.02, tp_target / max(1, t0 * p)))
        mod = o.modifiers.new("dec1", 'DECIMATE')
        mod.ratio = r1; mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    else:
        r1 = 1.0
    t_mid = tri(o)
    # pass 2: finish reduction on unprotected verts only
    m2 = protect_mask(o)  # recompute on new topology
    vg = o.vertex_groups.new(name="decim")
    vg.add([i for i in range(len(o.data.vertices)) if not m2[i]], 1.0, 'REPLACE')
    unprot_mid = t_mid * (1 - float(m2.mean()))
    r2 = min(1.0, max(0.02, tu_target / max(1.0, unprot_mid)))
    mod = o.modifiers.new("dec2", 'DECIMATE')
    mod.ratio = r2
    mod.vertex_group = "decim"
    mod.vertex_group_factor = 10.0
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.vertex_groups.remove(o.vertex_groups["decim"])
    print(f"DECIMATE {name}: {t0} -> {tri(o)} (protected {p:.0%}, r1={r1:.3f}, r2={r2:.3f})")

# re-mirror greave
gr = bpy.data.objects["GreaveBoot_L"]
gr2 = gr.copy(); gr2.data = gr.data.copy(); gr2.name = "GreaveBoot_R"
bpy.context.scene.collection.objects.link(gr2)
gr2.data.transform(mathutils.Matrix.Diagonal(mathutils.Vector((-1, 1, 1, 1))))
bm = bmesh.new(); bm.from_mesh(gr2.data)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(gr2.data); bm.free()
gr2.data.materials.clear()
for mslot in gr.data.materials:
    gr2.data.materials.append(mslot)
for p in gr2.data.polygons:
    p.use_smooth = True

total = sum(tri(o) for o in bpy.data.objects
            if o.type == 'MESH' and o.name not in ("Sword", "Shield"))
print(f"OPT_CHARACTER_TRIS={total}")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male2_opt.blend"))
setup_and_render("after")
print("S2_OK")
