import bpy
import numpy as np
# 1) eye material: kill specular edge glints
m = bpy.data.materials.get("M_Eyes")
bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bsdf.inputs["Roughness"].default_value = 0.5
if bsdf.inputs.get("Specular IOR Level"):
    bsdf.inputs["Specular IOR Level"].default_value = 0.05
# 2) erase dark smudges under the eyes on body basecolor
body = bpy.data.objects["Body"]
me = body.data
img = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image:
        for l in n.outputs[0].links:
            if l.to_socket.name == 'Base Color':
                img = n.image
W, H = img.size
a = np.empty(W*H*4, np.float32); img.pixels.foreach_get(a); a = a.reshape(H, W, 4)
uvd = me.uv_layers.active.data
EYES = [(0.0523, 1.8728), (-0.0515, 1.8728)]
skin = np.array([0.985, 0.885, 0.775], np.float32)
R = 15
yy, xx = np.mgrid[-R:R+1, -R:R+1]; disk = (xx**2+yy**2) <= R**2
count = 0
for poly in me.polygons:
    c = poly.center
    near = any(abs(c.x-ex) < 0.055 and (ez-0.080) < c.z < (ez+0.005) for ex, ez in EYES)
    if not near or c.y > 0:
        continue
    for li in poly.loop_indices:
        u, v = uvd[li].uv
        px, py = int(u*W)%W, int(v*H)%H
        if a[py, px, :3].mean() < 0.70:
            x0,x1 = max(0,px-R), min(W,px+R+1); y0,y1 = max(0,py-R), min(H,py+R+1)
            sub = disk[(y0-py+R):(y1-py+R),(x0-px+R):(x1-px+R)]
            a[y0:y1, x0:x1, :3][sub] = skin
            count += 1
img.pixels.foreach_set(a.ravel()); img.update(); img.pack()
print("smudge stamps:", count)
bpy.ops.wm.save_mainfile()
print("POLISH_OK")
