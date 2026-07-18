"""Script B: contract armature + auto weights + per-joint pose test renders → male_v3.blend"""
import bpy, math, os, sys
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"

body = bpy.data.objects["Body"]
co = np.empty(len(body.data.vertices) * 3)
body.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)

def region_centroid(mask):
    pts = co[mask]
    return pts.mean(axis=0) if len(pts) else None

# arm measurements (left = +X)
def arm_point(zlo, zhi, xlo=0.14):
    m = (co[:, 2] > zlo) & (co[:, 2] < zhi) & (co[:, 0] > xlo)
    c = region_centroid(m)
    return c

shoulderL = arm_point(1.48, 1.56)
elbowL   = arm_point(1.22, 1.30, 0.20)
wristL   = arm_point(1.02, 1.10, 0.26)
handL    = arm_point(0.88, 1.02, 0.28)
print("shoulder", shoulderL, "elbow", elbowL, "wrist", wristL, "hand", handL)

hipL = np.array([0.093, 0.0, 1.00])
kneeL = region_centroid((co[:, 2] > 0.54) & (co[:, 2] < 0.60) & (co[:, 0] > 0.03))
ankleL = region_centroid((co[:, 2] > 0.10) & (co[:, 2] < 0.16) & (co[:, 0] > 0.03))
toeL = region_centroid((co[:, 2] < 0.05) & (co[:, 0] > 0.03) & (co[:, 1] < -0.05))
print("knee", kneeL, "ankle", ankleL, "toe", toeL)

arm = bpy.data.armatures.new("Armature")
rig = bpy.data.objects.new("Armature", arm)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')

def add(name, head, tail, parent=None, connect=False):
    b = arm.edit_bones.new(name)
    b.head = mathutils.Vector(head); b.tail = mathutils.Vector(tail)
    if parent:
        b.parent = arm.edit_bones[parent]
        b.use_connect = connect
    return b

V = lambda a: (float(a[0]), float(a[1]), float(a[2]))
add("Hips",  (0, 0.01, 1.02), (0, 0.01, 1.14))
add("Spine", (0, 0.01, 1.14), (0, 0.005, 1.30), "Hips", True)
add("Chest", (0, 0.005, 1.30), (0, 0, 1.55), "Spine", True)
add("Neck",  (0, 0, 1.60), (0, 0, 1.70), "Chest")
add("Head",  (0, 0, 1.70), (0, 0, 2.00), "Neck", True)
for side, sgn in (("L", 1), ("R", -1)):
    sh = np.array(V(shoulderL)) * [sgn, 1, 1]
    el = np.array(V(elbowL)) * [sgn, 1, 1]
    wr = np.array(V(wristL)) * [sgn, 1, 1]
    hd = np.array(V(handL)) * [sgn, 1, 1]
    add(f"UpperArm_{side}", V(sh), V(el), "Chest")
    add(f"LowerArm_{side}", V(el), V(wr), f"UpperArm_{side}", True)
    add(f"Hand_{side}", V(wr), V(hd - [0, 0, 0.06]), f"LowerArm_{side}", True)
    hp = hipL * [sgn, 1, 1]
    kn = np.array(V(kneeL)) * [sgn, 1, 1]
    an = np.array(V(ankleL)) * [sgn, 1, 1]
    to = np.array(V(toeL)) * [sgn, 1, 1]
    add(f"UpperLeg_{side}", V(hp), V(kn), "Hips")
    add(f"LowerLeg_{side}", V(kn), V(an), f"UpperLeg_{side}", True)
    add(f"Foot_{side}", V(an), V(to), f"LowerLeg_{side}", True)
# cape chain (back, y+)
add("CapeRoot", (0, 0.13, 1.52), (0, 0.16, 1.30), "Chest")
add("Cape_1", (0, 0.16, 1.30), (0, 0.19, 1.00), "CapeRoot", True)
add("Cape_2", (0, 0.19, 1.00), (0, 0.22, 0.65), "Cape_1", True)
add("Cape_3", (0, 0.22, 0.65), (0, 0.25, 0.30), "Cape_2", True)
bpy.ops.object.mode_set(mode='OBJECT')

# auto weights per mesh
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True); rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    print("skinned", o.name)

# belt: force to Hips only (rigid accessory)
belt = bpy.data.objects["Belt"]
for vg in list(belt.vertex_groups):
    belt.vertex_groups.remove(vg)
vg = belt.vertex_groups.new(name="Hips")
vg.add(range(len(belt.data.vertices)), 1.0, 'REPLACE')

# limit influences to 4 + normalize
for o in meshes:
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male_v3.blend"))

# ---- pose test renders ----
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = False
scene.render.resolution_x = 640; scene.render.resolution_y = 960
w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.88, 0.88, 0.9, 1)
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("S", 'SUN'))
sun.data.energy = 3.0; sun.rotation_euler = (math.radians(55), 0, math.radians(35))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("C")); cam.data.lens = 58
scene.collection.objects.link(cam); scene.camera = cam

def look(dist, ang, z):
    a = math.radians(ang)
    cam.location = (dist*math.sin(a), -dist*math.cos(a), z + 0.1)
    d = mathutils.Vector((0, 0, z)) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def set_pose(rots):  # {bone: (rx,ry,rz) deg}
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    for bone, r in rots.items():
        rig.pose.bones[bone].rotation_euler = tuple(math.radians(v) for v in r)

outdir = os.path.join(SP, "posetest"); os.makedirs(outdir, exist_ok=True)
tests = {
    "elbow": {"LowerArm_L": (0, 0, 45), "LowerArm_R": (0, 0, -45)},
    "knee":  {"UpperLeg_L": (-30, 0, 0), "LowerLeg_L": (50, 0, 0)},
    "head_shoulder": {"Head": (0, 0, 25), "UpperArm_R": (0, 0, -60)},
}
look(4.5, 30, 1.02)
for name, rots in tests.items():
    set_pose(rots)
    scene.render.filepath = os.path.join(outdir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
set_pose({})
print("RIG_OK")
