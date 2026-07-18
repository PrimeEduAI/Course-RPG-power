"""Script C: sockets + Idle/Equip actions → male_v4.blend, QA renders of keyframes."""
import bpy, math, os
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
rig = bpy.data.objects["Armature"]
scene = bpy.context.scene
scene.render.fps = 24

# ---------- sockets ----------
SOCKETS = {
    "Socket_Weapon_R": ("Hand_R", (-0.49, -0.02, 0.97)),
    "Socket_Shield_L": ("LowerArm_L", (0.47, 0.02, 1.14)),
    "Socket_Back":     ("Chest", (0, 0.12, 1.45)),
    "Socket_Hip":      ("Hips", (0.20, 0.03, 1.05)),
}
for name, (bone, loc) in SOCKETS.items():
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.08
    scene.collection.objects.link(e)
    e.parent = rig
    e.parent_type = 'BONE'
    e.parent_bone = bone
    bpy.context.view_layer.update()
    # world transform: identity rotation, at loc (bind pose)
    e.matrix_world = mathutils.Matrix.Translation(mathutils.Vector(loc))
print("sockets done")

# ---------- helpers ----------
def key_all(action_bones, frame):
    for bname in action_bones:
        pb = rig.pose.bones[bname]
        pb.keyframe_insert("rotation_euler", frame=frame)
        if bname == "Hips":
            pb.keyframe_insert("location", frame=frame)

def set_rot(bname, deg, frame=None):
    pb = rig.pose.bones[bname]
    pb.rotation_mode = 'XYZ'
    pb.rotation_euler = tuple(math.radians(v) for v in deg)
    if frame is not None:
        pb.keyframe_insert("rotation_euler", frame=frame)

def zero_all():
    for pb in rig.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

rig.animation_data_create()

# ---------- Idle: 72 frames, loop ----------
zero_all()
idle = bpy.data.actions.new("Idle")
rig.animation_data.action = idle
BONES = ["Chest", "Head", "Neck", "UpperArm_L", "UpperArm_R", "Hips",
         "Cape_1", "Cape_2", "Cape_3"]
def idle_pose(phase):  # phase 0..1
    s = math.sin(phase * 2 * math.pi)
    s2 = math.sin(phase * 2 * math.pi + 1.2)
    set_rot("Chest", (1.6 * s, 0, 0))
    set_rot("Neck", (-0.8 * s, 0, 0.5 * s2))
    set_rot("Head", (-0.5 * s, 0, 0.8 * s2))
    set_rot("UpperArm_L", (0, 0, 1.8 * s))
    set_rot("UpperArm_R", (0, 0, -1.8 * s))
    set_rot("Hips", (0.4 * s, 0, 0))
    rig.pose.bones["Hips"].location = (0, 0, -0.006 * (1 - math.cos(phase * 2 * math.pi)) / 2)
    set_rot("Cape_1", (1.5 * s2, 0, 0))
    set_rot("Cape_2", (2.0 * math.sin(phase * 2 * math.pi + 2.0), 0, 0))
    set_rot("Cape_3", (2.5 * math.sin(phase * 2 * math.pi + 2.8), 0, 0))

for f in (1, 19, 37, 55, 72):
    idle_pose((f - 1) / 71.0)
    key_all(BONES, f)
idle.use_fake_user = True

# ---------- Equip: 24 frames ----------
zero_all()
equip = bpy.data.actions.new("Equip")
rig.animation_data.action = equip
EB = ["UpperArm_R", "LowerArm_R", "Chest", "Head", "Hips"]
# f1 = bind/idle start
for b in EB:
    set_rot(b, (0, 0, 0), 1)
# f6 anticipation: slight crouch + arm back
set_rot("Chest", (2.5, 0, -4), 6)
set_rot("Head", (0, 0, 3), 6)
set_rot("UpperArm_R", (10, 0, 8), 6)
set_rot("LowerArm_R", (0, 0, -10), 6)
set_rot("Hips", (1.5, 0, 0), 6)
rig.pose.bones["Hips"].location = (0, 0, -0.015); rig.pose.bones["Hips"].keyframe_insert("location", frame=6)
# f13 reach up: raise right arm to catch gear
set_rot("Chest", (-3, 0, 6), 13)
set_rot("Head", (-4, 0, -4), 13)
set_rot("UpperArm_R", (-55, 15, -35), 13)
set_rot("LowerArm_R", (0, 0, -45), 13)
set_rot("Hips", (-1, 0, 0), 13)
rig.pose.bones["Hips"].location = (0, 0, 0.006); rig.pose.bones["Hips"].keyframe_insert("location", frame=13)
# f18 settle: weight lands
set_rot("Chest", (1.5, 0, 1), 18)
set_rot("Head", (1, 0, 0), 18)
set_rot("UpperArm_R", (-10, 4, -8), 18)
set_rot("LowerArm_R", (0, 0, -12), 18)
set_rot("Hips", (0.8, 0, 0), 18)
rig.pose.bones["Hips"].location = (0, 0, -0.008); rig.pose.bones["Hips"].keyframe_insert("location", frame=18)
# f24 back to idle start pose
for b in EB:
    set_rot(b, (0, 0, 0), 24)
rig.pose.bones["Hips"].location = (0, 0, 0); rig.pose.bones["Hips"].keyframe_insert("location", frame=24)
equip.use_fake_user = True

# stash both to NLA for gltf export
rig.animation_data.action = None
for act in (idle, equip):
    tr = rig.animation_data.nla_tracks.new()
    tr.name = act.name
    tr.strips.new(act.name, 1, act)
    tr.mute = True

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SP, "male_v4.blend"))

# ---------- QA renders ----------
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
for name in ("Sword", "Shield"):
    bpy.data.objects[name].hide_render = True

outdir = os.path.join(SP, "animqa"); os.makedirs(outdir, exist_ok=True)
for label, act, frame in [("idle_f37", idle, 37), ("equip_f13", equip, 13), ("equip_f18", equip, 18)]:
    rig.animation_data.action = act
    scene.frame_set(frame)
    scene.render.filepath = os.path.join(outdir, f"{label}.png")
    bpy.ops.render.render(write_still=True)
rig.animation_data.action = None
print("ANIM_OK")
