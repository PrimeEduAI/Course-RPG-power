"""Fix skinning: rigid assignments for armor parts; unparent props; re-run pose tests."""
import bpy, math, os
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
rig = bpy.data.objects["Armature"]

def rigid(obj_name, bone, clear=True):
    o = bpy.data.objects[obj_name]
    if clear:
        for vg in list(o.vertex_groups):
            o.vertex_groups.remove(vg)
    vg = o.vertex_groups.new(name=bone)
    vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

# props: unbind from armature entirely
for name in ("Sword", "Shield"):
    o = bpy.data.objects[name]
    o.parent = None
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    for vg in list(o.vertex_groups):
        o.vertex_groups.remove(vg)

rigid("Hair", "Head")
rigid("ShoulderMantle", "Chest")

# torso: keep only torso bones then normalize
torso = bpy.data.objects["TorsoArmor"]
keep = {"Chest", "Spine", "Hips"}
for vg in list(torso.vertex_groups):
    if vg.name not in keep:
        torso.vertex_groups.remove(vg)
bpy.context.view_layer.objects.active = torso
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

# greaves: LowerLeg above ankle, Foot below, blend 0.10-0.18
for side in ("L", "R"):
    o = bpy.data.objects[f"GreaveBoot_{side}"]
    for vg in list(o.vertex_groups):
        o.vertex_groups.remove(vg)
    vg_leg = o.vertex_groups.new(name=f"LowerLeg_{side}")
    vg_foot = o.vertex_groups.new(name=f"Foot_{side}")
    for v in o.data.vertices:
        z = v.co.z
        t = max(0.0, min(1.0, (z - 0.10) / 0.08))  # 0 at ankle, 1 above
        if t > 0:
            vg_leg.add([v.index], t, 'REPLACE')
        if t < 1:
            vg_foot.add([v.index], 1 - t, 'REPLACE')

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male_v3.blend"))

# ---- pose tests again ----
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = False
scene.render.resolution_x = 640; scene.render.resolution_y = 960
if not scene.world:
    w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.88, 0.88, 0.9, 1)
if "Sun" not in bpy.data.objects:
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("S", 'SUN'))
    sun.data.energy = 3.0; sun.rotation_euler = (math.radians(55), 0, math.radians(35))
    scene.collection.objects.link(sun)
cam = bpy.data.objects.get("Cam")
if cam is None:
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("C")); cam.data.lens = 58
    scene.collection.objects.link(cam)
scene.camera = cam
a = math.radians(30)
cam.location = (4.5*math.sin(a), -4.5*math.cos(a), 1.12)
d = mathutils.Vector((0, 0, 1.02)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

# hide props for pose tests
for name in ("Sword", "Shield"):
    bpy.data.objects[name].hide_render = True

def set_pose(rots):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
    for bone, r in rots.items():
        rig.pose.bones[bone].rotation_euler = tuple(math.radians(v) for v in r)

outdir = os.path.join(SP, "posetest2"); os.makedirs(outdir, exist_ok=True)
tests = {
    "elbow": {"LowerArm_L": (0, 0, 45), "LowerArm_R": (0, 0, -45)},
    "knee":  {"UpperLeg_L": (-30, 0, 0), "LowerLeg_L": (50, 0, 0)},
    "head_shoulder": {"Head": (0, 0, 25), "UpperArm_R": (0, 0, -60)},
}
for name, rots in tests.items():
    set_pose(rots)
    scene.render.filepath = os.path.join(outdir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
set_pose({})
print("FIX_OK")
