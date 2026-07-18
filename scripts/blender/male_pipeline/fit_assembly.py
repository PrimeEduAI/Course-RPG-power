"""Apply transform config to cached parts scene, render check views.
Usage: blender -b cache.blend --python fit_assembly.py -- config.json outdir [views...] [--save path]"""
import bpy, sys, os, json, math
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
cfg_path, outdir = argv[0], argv[1]
save_path = None
if "--save" in argv:
    save_path = argv[argv.index("--save") + 1]
views = [a for a in argv[2:] if not a.startswith("--") and a != save_path] or ["front", "tq", "sideL", "back"]

cfg = json.load(open(cfg_path))

def M(loc, rot_deg, scale):
    T = mathutils.Matrix.Translation(mathutils.Vector(loc))
    R = mathutils.Euler([math.radians(a) for a in rot_deg], 'XYZ').to_matrix().to_4x4()
    S = mathutils.Matrix.Diagonal(mathutils.Vector(list(scale) + [1]))
    return T @ R @ S

# remove stale mirror duplicates from previous runs
for o in list(bpy.data.objects):
    if o.name.endswith("_MIR"):
        bpy.data.objects.remove(o, do_unlink=True)

for name, t in cfg.items():
    obj = bpy.data.objects.get(name)
    if obj is None:
        print("WARN missing part:", name); continue
    sc = t["scale"] if isinstance(t["scale"], list) else [t["scale"]] * 3
    obj.matrix_world = M(t["loc"], t.get("rot", [0, 0, 0]), sc)
    obj.hide_render = obj.hide_viewport = not t.get("show", True)
    if t.get("mirrorX"):
        dup = obj.copy()  # linked mesh copy — no mesh data duplication
        dup.name = name + "_MIR"
        bpy.context.scene.collection.objects.link(dup)
        mir = mathutils.Matrix.Diagonal(mathutils.Vector((-1, 1, 1, 1)))
        dup.matrix_world = mir @ obj.matrix_world
        dup.hide_render = dup.hide_viewport = obj.hide_render

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 40
scene.cycles.use_denoising = False
scene.render.resolution_x = 720
scene.render.resolution_y = 1080
if not scene.world:
    scene.world = bpy.data.worlds.new("W")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.88, 0.88, 0.9, 1)
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)
key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", 'SUN'))
key.data.energy = 3.0; key.rotation_euler = (math.radians(55), 0, math.radians(35))
scene.collection.objects.link(key)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", 'SUN'))
fill.data.energy = 1.0; fill.rotation_euler = (math.radians(70), 0, math.radians(-120))
scene.collection.objects.link(fill)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam")); cam.data.lens = 58
scene.collection.objects.link(cam); scene.camera = cam

center = mathutils.Vector((0, 0, 0.95))
VIEWS = {"front": 0, "tq": 40, "sideL": 90, "sideR": -90, "back": 180}
CLOSE = {"face": (0.32, 1.72, 60), "chest": (0.55, 1.35, 55), "arms_legs": (0.9, 0.75, 50)}
for v in views:
    if v in VIEWS:
        a = math.radians(VIEWS[v]); dist = 4.2
        cam.data.lens = 58
        cam.location = (center.x + dist*math.sin(a), center.y - dist*math.cos(a), center.z + 0.12)
        look = center
    else:
        size, z, lens = CLOSE[v]
        cam.data.lens = lens
        a = math.radians(25)
        dist = size * 3.2
        cam.location = (dist*math.sin(a), -dist*math.cos(a), z)
        look = mathutils.Vector((0, 0, z))
    d = look - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(outdir, f"{v}.png")
    bpy.ops.render.render(write_still=True)

if save_path:
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=save_path)
    print("SAVED", save_path)
print("FIT_OK")
