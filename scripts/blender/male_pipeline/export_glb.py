"""Script D: export hero-boy-modular.glb + boy-sword.glb + boy-shield.glb (to scratch first)."""
import bpy, math, os
import numpy as np
import mathutils

SP = "/tmp/claude-1000/-home-ubuntu-Course-RPG-power/7314da27-86bd-432d-93c7-687760fb5b7e/scratchpad"
OUT = os.path.join(SP, "export"); os.makedirs(OUT, exist_ok=True)

CHAR_OBJS = ["Armature", "Body", "Hair", "TorsoArmor", "ShoulderMantle", "Cape",
             "Belt", "Gauntlet_L", "Gauntlet_R", "GreaveBoot_L", "GreaveBoot_R",
             "Socket_Weapon_R", "Socket_Shield_L", "Socket_Back", "Socket_Hip"]

def export_selection(names, filepath):
    bpy.ops.object.select_all(action='DESELECT')
    for n in names:
        o = bpy.data.objects[n]
        o.hide_render = False
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.data.objects[names[0]]
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_image_format='JPEG',
        export_jpeg_quality=80,
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_skins=True,
        export_morph=False,
        export_cameras=False,
        export_lights=False,
    )
    print("EXPORTED", filepath, round(os.path.getsize(filepath) / 1e6, 1), "MB")

def verts_np(o):
    n = len(o.data.vertices)
    a = np.empty(n * 3)
    o.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3)

# --- character ---
export_selection(CHAR_OBJS, os.path.join(OUT, "hero-boy-modular.glb"))

# --- sword: grip center at origin, blade +Z (blender) => +Y (gltf) ---
sw = bpy.data.objects["Sword"]
co = verts_np(sw)
zmin, zmax = co[:, 2].min(), co[:, 2].max()
# width per slice to find guard (widest in upper half)
zs = np.linspace(zmin + (zmax - zmin) * 0.5, zmax, 40)
widths = []
for z in zs:
    sl = co[(np.abs(co[:, 2] - z) < (zmax - zmin) / 80)]
    widths.append(sl[:, 0].max() - sl[:, 0].min() if len(sl) else 0)
guard_z = zs[int(np.argmax(widths))]
grip_z = guard_z + (zmax - guard_z) * 0.42
sl = co[np.abs(co[:, 2] - grip_z) < 0.03]
cx, cy = sl[:, 0].mean(), sl[:, 1].mean()
print(f"sword zmin={zmin:.3f} zmax={zmax:.3f} guard_z={guard_z:.3f} grip_z={grip_z:.3f}")
M = (mathutils.Matrix.Rotation(math.pi, 4, 'X') @
     mathutils.Matrix.Translation((-cx, -cy, -grip_z)))
sw.data.transform(M)
sw.data.update()
export_selection(["Sword"], os.path.join(OUT, "boy-sword.glb"))

# --- shield: back handle center at origin, face -Y (blender) => +Z (gltf) ---
sh = bpy.data.objects["Shield"]
co = verts_np(sh)
cx, cz = co[:, 0].mean(), (co[:, 2].min() + co[:, 2].max()) / 2
yback = co[:, 1].max()
M = mathutils.Matrix.Translation((-cx, -(yback - 0.02), -cz))
sh.data.transform(M)
sh.data.update()
export_selection(["Shield"], os.path.join(OUT, "boy-shield.glb"))
print("EXPORT_OK")
