import bpy
import numpy as np
o = bpy.data.objects["ShoulderMantle"]
me = o.data
uv = me.uv_layers.active.data
targets = [(0.329, 0.200), (0.788, 0.459), (0.329, 0.800), (0.788, 0.541)]
cream = (0.664, 0.4386)
fixed = 0
for poly in me.polygons:
    c = poly.center
    if not (-0.60 < c.x < 0.0 and c.y < 0.15 and 1.35 < c.z < 1.75):
        continue
    hit = False
    for li in poly.loop_indices:
        u, v = uv[li].uv
        for tu, tv in targets:
            if abs(u - tu) < 0.04 and abs(v - tv) < 0.04:
                hit = True
    if hit:
        for li in poly.loop_indices:
            uv[li].uv = cream
        fixed += 1
print("faces re-uv'd:", fixed)
me.update()
bpy.ops.wm.save_mainfile()
print("FINAL_OK")
