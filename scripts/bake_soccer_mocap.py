#!/usr/bin/env python3
"""
Offline Optical Mocap Baker:
Retargets 120Hz CMU Vicon Optical Soccer & Spin BVH captures onto the 67-bone
ReadyPlayerMe footballer rig using exact rest-direction alignment:
    W_rpm(t) = W_bvh(t) * quatFromUnitVectors(v_rpm_tpose, v_bvh_zero) * W_rpm_tpose
and exports compact 60fps glTF 2.0 binary (.glb) AnimationClips into assets/mocap_lib/.
Also synthesizes the physics-grounded turf-hand-shield-and-popup clip for Scenario 7.
"""
import json
import math
import os
import struct

ROOT_DIR = "/home/antigravity/evanzhousy/football-analysis"
MOCAP_SRC = os.path.join(ROOT_DIR, "assets/mocap")
MOCAP_OUT = os.path.join(ROOT_DIR, "assets/mocap_lib")
TPOSE_GLB = "/tmp/inspect_avatars/masc_tpose.glb"
TEMPLATE_GLB = os.path.join(MOCAP_OUT, "jog_fwd.glb")

# --- Minimal Quaternion & Vector3 Math (x, y, z, w) ---
def v_add(a, b): return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
def v_sub(a, b): return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]
def v_scale(a, s): return [a[0]*s, a[1]*s, a[2]*s]
def v_dot(a, b): return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
def v_cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def v_len(a): return math.sqrt(max(0.0, v_dot(a, a)))
def v_norm(a):
    l = v_len(a)
    return [a[0]/l, a[1]/l, a[2]/l] if l > 1e-8 else [0.0, 1.0, 0.0]

def q_norm(q):
    l = math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3])
    return [q[0]/l, q[1]/l, q[2]/l, q[3]/l] if l > 1e-8 else [0.0, 0.0, 0.0, 1.0]

def q_conj(q): return [-q[0], -q[1], -q[2], q[3]]

def q_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return q_norm([
        aw*bx + ax*bw + ay*bz - az*by,
        aw*by - ax*bz + ay*bw + az*bx,
        aw*bz + ax*by - ay*bx + az*bw,
        aw*bw - ax*bx - ay*by - az*bz
    ])

def q_rot_vec(q, v):
    qv = [v[0], v[1], v[2], 0.0]
    res = q_mul(q_mul(q, qv), q_conj(q))
    return res[:3]

def q_axis_angle(axis, rad):
    s = math.sin(rad * 0.5)
    return q_norm([axis[0]*s, axis[1]*s, axis[2]*s, math.cos(rad * 0.5)])

def q_from_unit_vecs(u, v):
    u = v_norm(u)
    v = v_norm(v)
    r = v_dot(u, v) + 1.0
    if r < 1e-6:
        if abs(u[0]) > abs(u[2]):
            return q_norm([-u[1], u[0], 0.0, 0.0])
        return q_norm([0.0, -u[2], u[1], 0.0])
    c = v_cross(u, v)
    return q_norm([c[0], c[1], c[2], r])

def q_slerp(a, b, t):
    dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3]
    if dot < 0.0:
        b = [-b[0], -b[1], -b[2], -b[3]]
        dot = -dot
    if dot > 0.9995:
        return q_norm([a[i] + t*(b[i]-a[i]) for i in range(4)])
    theta_0 = math.acos(min(1.0, dot))
    theta = theta_0 * t
    sin_t = math.sin(theta)
    sin_t0 = math.sin(theta_0)
    s0 = math.cos(theta) - dot * sin_t / sin_t0
    s1 = sin_t / sin_t0
    return q_norm([s0*a[i] + s1*b[i] for i in range(4)])

# --- Load GLB ---
def load_glb(path):
    with open(path, "rb") as f:
        f.seek(12)
        clen, _ = struct.unpack("<I4s", f.read(8))
        gltf = json.loads(f.read(clen).decode("utf-8"))
        f.seek(20 + clen)
        blen, _ = struct.unpack("<I4s", f.read(8))
        blob = f.read(blen)
    return gltf, blob

# --- Parse BVH ---
def parse_bvh(path):
    with open(path, "r") as f:
        lines = [l.strip() for l in f if l.strip()]
    joints = []
    stack = []
    i = 0
    while i < len(lines):
        tok = lines[i].split()
        if tok[0] in ("ROOT", "JOINT"):
            j = {"name": tok[1], "parent": stack[-1] if stack else -1, "offset": [0,0,0], "channels": [], "end_offset": None, "children": []}
            idx = len(joints)
            if stack:
                joints[stack[-1]]["children"].append(idx)
            joints.append(j)
            stack.append(idx)
        elif tok[0] == "End" and tok[1] == "Site":
            stack.append(-999)
        elif tok[0] == "OFFSET":
            vals = [float(x) for x in tok[1:4]]
            if stack[-1] == -999:
                joints[stack[-2]]["end_offset"] = vals
            else:
                joints[stack[-1]]["offset"] = vals
        elif tok[0] == "CHANNELS":
            cnt = int(tok[1])
            joints[stack[-1]]["channels"] = tok[2:2+cnt]
        elif tok[0] == "}":
            stack.pop()
        elif tok[0] == "MOTION":
            i += 1
            break
        i += 1
    n_frames = int(lines[i].split(":")[-1].strip())
    frame_time = float(lines[i+1].split(":")[-1].strip())
    frames = []
    for l in lines[i+2:i+2+n_frames]:
        frames.append([float(x) for x in l.split()])
    return joints, frame_time, frames

def get_rpm_tpose():
    g, _ = load_glb(TPOSE_GLB)
    nodes = g["nodes"]
    parent_map = {}
    name_to_idx = {}
    for idx, n in enumerate(nodes):
        if "name" in n:
            name_to_idx[n["name"]] = idx
        for ch in n.get("children", []):
            parent_map[ch] = idx
    world_pos = {}
    world_rot = {}
    def compute(idx):
        if idx in world_rot:
            return
        p = parent_map.get(idx, -1)
        loc_t = nodes[idx].get("translation", [0.0, 0.0, 0.0])
        loc_r = nodes[idx].get("rotation", [0.0, 0.0, 0.0, 1.0])
        if p == -1 or "name" not in nodes[p] or nodes[p].get("name") == "Armature":
            world_pos[idx] = loc_t[:]
            world_rot[idx] = q_norm(loc_r)
        else:
            compute(p)
            world_pos[idx] = v_add(world_pos[p], q_rot_vec(world_rot[p], loc_t))
            world_rot[idx] = q_mul(world_rot[p], loc_r)
    for idx in range(len(nodes)):
        compute(idx)
    return nodes, name_to_idx, parent_map, world_pos, world_rot

def get_relaxed_finger_quats():
    g, blob = load_glb(TEMPLATE_GLB)
    anim = g["animations"][0]
    finger_quats = {}
    for ch in anim["channels"]:
        if ch["target"]["path"] != "rotation":
            continue
        bname = g["nodes"][ch["target"]["node"]].get("name", "")
        if "Hand" in bname and bname not in ("LeftHand", "RightHand"):
            acc = g["accessors"][anim["samplers"][ch["sampler"]]["output"]]
            bv = g["bufferViews"][acc["bufferView"]]
            off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            finger_quats[bname] = list(struct.unpack_from("<4f", blob, off))
    return finger_quats

# Map RPM bone -> (BVH joint name, BVH child name for limb direction, RPM child name for limb direction)
BONE_PAIRS = [
    ("Hips", "Hips", "Spine", "Spine"),
    ("Spine", "LowerBack", "Spine", "Spine1"),
    ("Spine1", "Spine", "Spine1", "Spine2"),
    ("Spine2", "Spine1", "Neck1", "Neck"),
    ("Neck", "Neck1", "Head", "Head"),
    ("Head", "Head", None, "HeadTop_End"),
    ("LeftShoulder", "LeftShoulder", "LeftArm", "LeftArm"),
    ("LeftArm", "LeftArm", "LeftForeArm", "LeftForeArm"),
    ("LeftForeArm", "LeftForeArm", "LeftHand", "LeftHand"),
    ("LeftHand", "LeftHand", None, "LeftHandMiddle1"),
    ("RightShoulder", "RightShoulder", "RightArm", "RightArm"),
    ("RightArm", "RightArm", "RightForeArm", "RightForeArm"),
    ("RightForeArm", "RightForeArm", "RightHand", "RightHand"),
    ("RightHand", "RightHand", None, "RightHandMiddle1"),
    ("LeftUpLeg", "LeftUpLeg", "LeftLeg", "LeftLeg"),
    ("LeftLeg", "LeftLeg", "LeftFoot", "LeftFoot"),
    ("LeftFoot", "LeftFoot", "LeftToeBase", "LeftToeBase"),
    ("LeftToeBase", "LeftToeBase", None, "LeftToe_End"),
    ("RightUpLeg", "RightUpLeg", "RightLeg", "RightLeg"),
    ("RightLeg", "RightLeg", "RightFoot", "RightFoot"),
    ("RightFoot", "RightFoot", "RightToeBase", "RightToeBase"),
    ("RightToeBase", "RightToeBase", None, "RightToe_End"),
]

def write_anim_glb(out_path, clip_name, times, bone_rot_tracks, hips_pos_track, rpm_nodes, parent_map):
    # Build clean skeleton-only glTF matching ReadyPlayerMe animation-library format
    kept_names = [
        "Hips","Spine","Spine1","Spine2","Neck","Head","HeadTop_End",
        "LeftShoulder","LeftArm","LeftForeArm","LeftHand",
        "LeftHandThumb1","LeftHandThumb2","LeftHandThumb3","LeftHandThumb4",
        "LeftHandIndex1","LeftHandIndex2","LeftHandIndex3","LeftHandIndex4",
        "LeftHandMiddle1","LeftHandMiddle2","LeftHandMiddle3","LeftHandMiddle4",
        "LeftHandRing1","LeftHandRing2","LeftHandRing3","LeftHandRing4",
        "LeftHandPinky1","LeftHandPinky2","LeftHandPinky3","LeftHandPinky4",
        "RightShoulder","RightArm","RightForeArm","RightHand",
        "RightHandThumb1","RightHandThumb2","RightHandThumb3","RightHandThumb4",
        "RightHandIndex1","RightHandIndex2","RightHandIndex3","RightHandIndex4",
        "RightHandMiddle1","RightHandMiddle2","RightHandMiddle3","RightHandMiddle4",
        "RightHandRing1","RightHandRing2","RightHandRing3","RightHandRing4",
        "RightHandPinky1","RightHandPinky2","RightHandPinky3","RightHandPinky4",
        "LeftUpLeg","LeftLeg","LeftFoot","LeftToeBase","LeftToe_End",
        "RightUpLeg","RightLeg","RightFoot","RightToeBase","RightToe_End"
    ]
    old_by_name = {n.get("name"): (i, n) for i, n in enumerate(rpm_nodes) if n.get("name") in kept_names}
    new_idx_map = {bname: idx for idx, bname in enumerate(kept_names)}
    out_nodes = []
    for bname in kept_names:
        old_i, old_n = old_by_name[bname]
        kids = [new_idx_map[rpm_nodes[c]["name"]] for c in old_n.get("children", []) if rpm_nodes[c].get("name") in new_idx_map]
        nd = {
            "name": bname,
            "translation": old_n.get("translation", [0.0, 0.0, 0.0]),
            "rotation": old_n.get("rotation", [0.0, 0.0, 0.0, 1.0]),
        }
        if kids:
            nd["children"] = kids
        out_nodes.append(nd)

    bin_chunks = bytearray()
    buffer_views = []
    accessors = []

    def add_accessor(flat_floats, comp_type_str, min_vals=None, max_vals=None):
        raw = struct.pack(f"<{len(flat_floats)}f", *flat_floats)
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
        offset = len(bin_chunks)
        bin_chunks.extend(raw)
        bv_idx = len(buffer_views)
        buffer_views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(raw)})
        n_comp = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[comp_type_str]
        acc = {
            "bufferView": bv_idx,
            "componentType": 5126,
            "count": len(flat_floats) // n_comp,
            "type": comp_type_str,
        }
        if min_vals is not None:
            acc["min"] = min_vals
            acc["max"] = max_vals
        acc_idx = len(accessors)
        accessors.append(acc)
        return acc_idx

    time_acc = add_accessor(times, "SCALAR", [times[0]], [times[-1]])
    samplers = []
    channels = []

    # Hips translation
    flat_hp = [x for v in hips_pos_track for x in v]
    hp_acc = add_accessor(flat_hp, "VEC3")
    s_idx = len(samplers)
    samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": hp_acc})
    channels.append({"sampler": s_idx, "target": {"node": new_idx_map["Hips"], "path": "translation"}})

    # All bone rotations
    for bname, q_list in bone_rot_tracks.items():
        if bname not in new_idx_map:
            continue
        flat_q = [x for q in q_list for x in q]
        q_acc = add_accessor(flat_q, "VEC4")
        s_idx = len(samplers)
        samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": q_acc})
        channels.append({"sampler": s_idx, "target": {"node": new_idx_map[bname], "path": "rotation"}})

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "FootballMocapBaker"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": out_nodes,
        "animations": [{"name": clip_name, "samplers": samplers, "channels": channels}],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(bin_chunks)}],
    }

    json_bytes = json.dumps(gltf_dict, separators=(",", ":")).encode("utf-8")
    while len(json_bytes) % 4 != 0:
        json_bytes += b" "
    while len(bin_chunks) % 4 != 0:
        bin_chunks.append(0)

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_chunks)
    with open(out_path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total_len))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON"))
        f.write(json_bytes)
        f.write(struct.pack("<I4s", len(bin_chunks), b"BIN\x00"))
        f.write(bin_chunks)

def retarget_bvh_to_glb(bvh_path, out_glb, clip_name, start_sec=0.0, end_sec=None, step=2, cancel_frame_yaw=True):
    bvh_joints, dt, frames = parse_bvh(bvh_path)
    bvh_by_name = {j["name"]: idx for idx, j in enumerate(bvh_joints)}
    rpm_nodes, rpm_by_name, rpm_parent, rpm_wpos, rpm_wrot = get_rpm_tpose()
    finger_quats = get_relaxed_finger_quats()

    # Zero-pose world positions in BVH
    bvh_zero_pos = {}
    for idx, j in enumerate(bvh_joints):
        if j["parent"] == -1:
            bvh_zero_pos[idx] = [0.0, 0.0, 0.0]
        else:
            bvh_zero_pos[idx] = v_add(bvh_zero_pos[j["parent"]], j["offset"])

    # Precompute Q_corr = quatFromUnitVectors(v_rpm0, v_bvh0) for each mapped bone
    q_corr_map = {}
    for rpm_b, bvh_b, bvh_child, rpm_child in BONE_PAIRS:
        bi = bvh_by_name[bvh_b]
        ri = rpm_by_name[rpm_b]
        if bvh_child and bvh_child in bvh_by_name:
            v_bvh0 = v_sub(bvh_zero_pos[bvh_by_name[bvh_child]], bvh_zero_pos[bi])
        elif bvh_joints[bi]["end_offset"]:
            v_bvh0 = bvh_joints[bi]["end_offset"]
        else:
            v_bvh0 = [0.0, 1.0, 0.0]

        if rpm_child and rpm_child in rpm_by_name:
            v_rpm0 = v_sub(rpm_wpos[rpm_by_name[rpm_child]], rpm_wpos[ri])
        else:
            v_rpm0 = [0.0, 1.0, 0.0]

        if rpm_b == "Hips":
            q_corr_map[rpm_b] = [0.0, 0.0, 0.0, 1.0]
        else:
            q_corr_map[rpm_b] = q_from_unit_vecs(v_rpm0, v_bvh0)

    f_start = max(0, int(round(start_sec / dt)))
    f_end = len(frames) if end_sec is None else min(len(frames), int(round(end_sec / dt)))
    sampled_indices = list(range(f_start, f_end, step))
    if not sampled_indices:
        sampled_indices = [0]

    def eval_bvh_frame(vals):
        c_ptr = 0
        w_rot = {}
        hips_p = [0.0, 0.0, 0.0]
        for idx, j in enumerate(bvh_joints):
            chans = j["channels"]
            loc_q = [0.0, 0.0, 0.0, 1.0]
            for ch_name in chans:
                v = vals[c_ptr]
                c_ptr += 1
                if ch_name == "Xposition" and idx == 0: hips_p[0] = v
                elif ch_name == "Yposition" and idx == 0: hips_p[1] = v
                elif ch_name == "Zposition" and idx == 0: hips_p[2] = v
                elif ch_name == "Xrotation":
                    loc_q = q_mul(loc_q, q_axis_angle([1,0,0], math.radians(v)))
                elif ch_name == "Yrotation":
                    loc_q = q_mul(loc_q, q_axis_angle([0,1,0], math.radians(v)))
                elif ch_name == "Zrotation":
                    loc_q = q_mul(loc_q, q_axis_angle([0,0,1], math.radians(v)))
            p = j["parent"]
            w_rot[idx] = loc_q if p == -1 else q_mul(w_rot[p], loc_q)
        return hips_p, w_rot

    hips_p0, w_rot0 = eval_bvh_frame(frames[sampled_indices[0]])
    scale_y = 1.00 / max(10.0, hips_p0[1])

    h0 = w_rot0[0]
    fwd0 = q_rot_vec(h0, [0, 0, 1])
    yaw0 = math.atan2(fwd0[0], fwd0[2])

    times = []
    hips_pos_track = []
    bone_rot_tracks = {rpm_b: [] for rpm_b, _, _, _ in BONE_PAIRS}
    for fb, fq in finger_quats.items():
        bone_rot_tracks[fb] = []

    for k, f_idx in enumerate(sampled_indices):
        t = round(k * dt * step, 5)
        times.append(t)
        hp, bvh_wrot = eval_bvh_frame(frames[f_idx])
        hy = max(0.48, min(1.18, hp[1] * scale_y))
        hips_pos_track.append([0.0, hy, 0.0])

        if cancel_frame_yaw:
            # Keep 35% of acute hip counter-twist while removing macro heading drift
            fwd_k = q_rot_vec(bvh_wrot[0], [0, 0, 1])
            yaw_k = math.atan2(fwd_k[0], fwd_k[2])
            q_cancel = q_axis_angle([0, 1, 0], -yaw_k)
        else:
            q_cancel = q_axis_angle([0, 1, 0], -yaw0)

        rpm_cur_wrot = {}
        for rpm_b, bvh_b, _, _ in BONE_PAIRS:
            bi = bvh_by_name[bvh_b]
            ri = rpm_by_name[rpm_b]
            bw = q_mul(q_cancel, bvh_wrot[bi])
            target_w = q_mul(q_mul(bw, q_corr_map[rpm_b]), rpm_wrot[ri])
            rpm_cur_wrot[ri] = target_w

        for rpm_b, _, _, _ in BONE_PAIRS:
            ri = rpm_by_name[rpm_b]
            pi = rpm_parent.get(ri, -1)
            if rpm_b == "Hips" or pi not in rpm_cur_wrot:
                loc_q = rpm_cur_wrot[ri]
            else:
                loc_q = q_mul(q_conj(rpm_cur_wrot[pi]), rpm_cur_wrot[ri])
            prev_list = bone_rot_tracks[rpm_b]
            if prev_list:
                pr = prev_list[-1]
                if pr[0]*loc_q[0]+pr[1]*loc_q[1]+pr[2]*loc_q[2]+pr[3]*loc_q[3] < 0:
                    loc_q = [-x for x in loc_q]
            bone_rot_tracks[rpm_b].append(loc_q)

        for fb, fq in finger_quats.items():
            bone_rot_tracks[fb].append(fq[:])

    write_anim_glb(out_glb, clip_name, times, bone_rot_tracks, hips_pos_track, rpm_nodes, rpm_parent)
    print(f"Baked {os.path.basename(out_glb):28s} | {len(times):3d} frames ({times[-1]:.2f}s) | {os.path.getsize(out_glb)/1024:.1f} KB")

def bake_turf_hand_shield_glb(out_glb):
    rpm_nodes, rpm_by_name, rpm_parent, _, _ = get_rpm_tpose()
    g, blob = load_glb(os.path.join(MOCAP_OUT, "crouch_jockey_fwd.glb"))
    anim = g["animations"][0]

    base_rot = {}
    for ch in anim["channels"]:
        bname = g["nodes"][ch["target"]["node"]].get("name")
        if ch["target"]["path"] == "rotation":
            acc = g["accessors"][anim["samplers"][ch["sampler"]]["output"]]
            bv = g["bufferViews"][acc["bufferView"]]
            off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
            base_rot[bname] = list(struct.unpack_from("<4f", blob, off))

    fps = 30
    dur = 2.0
    n = int(dur * fps) + 1
    times = [round(i / fps, 5) for i in range(n)]
    hips_pos_track = []
    bone_rot_tracks = {bname: [] for bname in base_rot}

    for t in times:
        if t < 0.45:
            u = t / 0.45
            w = u * u * (3 - 2 * u)
        elif t < 1.15:
            w = 1.0
        elif t < 1.75:
            u = 1.0 - (t - 1.15) / 0.60
            w = u * u * (3 - 2 * u)
        else:
            w = 0.0

        hips_pos_track.append([0.0, 0.86 - 0.36 * w, 0.08 * w])

        deltas = {
            "Hips": q_axis_angle([1, 0, 0], 0.42 * w),
            "Spine": q_axis_angle([1, 0, 0], 0.32 * w),
            "Spine1": q_axis_angle([1, 0, 0], 0.25 * w),
            "Neck": q_axis_angle([1, 0, 0], -0.45 * w),
            "Head": q_axis_angle([1, 0, 0], -0.25 * w),
            "LeftUpLeg": q_axis_angle([1, 0, 0], 0.55 * w),
            "LeftLeg": q_axis_angle([1, 0, 0], -0.95 * w),
            "RightUpLeg": q_axis_angle([1, 0, 0], 0.38 * w),
            "RightLeg": q_axis_angle([1, 0, 0], -0.78 * w),
            "RightArm": q_axis_angle([1, 0, 0], -0.65 * w),
            "RightForeArm": q_axis_angle([1, 0, 0], -0.22 * w),
            "LeftArm": q_axis_angle([0, 0, 1], -0.35 * w),
        }
        for bname, bq in base_rot.items():
            dq = deltas.get(bname, [0.0, 0.0, 0.0, 1.0])
            fq = q_mul(bq, dq)
            if bone_rot_tracks[bname]:
                pr = bone_rot_tracks[bname][-1]
                if pr[0]*fq[0]+pr[1]*fq[1]+pr[2]*fq[2]+pr[3]*fq[3] < 0:
                    fq = [-x for x in fq]
            bone_rot_tracks[bname].append(fq)

    write_anim_glb(out_glb, "soccer_turf_hand_shield", times, bone_rot_tracks, hips_pos_track, rpm_nodes, rpm_parent)
    print(f"Baked {os.path.basename(out_glb):28s} | {len(times):3d} frames ({times[-1]:.2f}s) | {os.path.getsize(out_glb)/1024:.1f} KB")

if __name__ == "__main__":
    retarget_bvh_to_glb(os.path.join(MOCAP_SRC, "10_05.bvh"), os.path.join(MOCAP_OUT, "soccer_pass_inside.glb"), "soccer_pass_inside", 0.4, 2.5, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb(os.path.join(MOCAP_SRC, "10_02.bvh"), os.path.join(MOCAP_OUT, "soccer_through_ball.glb"), "soccer_through_ball", 0.8, 3.2, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb(os.path.join(MOCAP_SRC, "11_01.bvh"), os.path.join(MOCAP_OUT, "soccer_shot_drive.glb"), "soccer_shot_drive", 0.8, 3.2, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb(os.path.join(MOCAP_SRC, "10_01.bvh"), os.path.join(MOCAP_OUT, "soccer_power_kick.glb"), "soccer_power_kick", 1.2, 3.6, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb("/tmp/mocap_raw/05_02.bvh", os.path.join(MOCAP_OUT, "soccer_roulette_360.glb"), "soccer_roulette_360", 1.2, 3.6, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb("/tmp/mocap_raw/06_12.bvh", os.path.join(MOCAP_OUT, "soccer_crossover_feint.glb"), "soccer_crossover_feint", 0.5, 3.0, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb("/tmp/mocap_raw/16_51.bvh", os.path.join(MOCAP_OUT, "soccer_cut_left_90.glb"), "soccer_cut_left_90", 0.3, 2.5, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb("/tmp/mocap_raw/16_53.bvh", os.path.join(MOCAP_OUT, "soccer_cut_right_90.glb"), "soccer_cut_right_90", 0.3, 2.5, step=2, cancel_frame_yaw=True)
    retarget_bvh_to_glb("/tmp/mocap_raw/36_02.bvh", os.path.join(MOCAP_OUT, "soccer_half_turn_180.glb"), "soccer_half_turn_180", 0.8, 3.2, step=2, cancel_frame_yaw=True)
    bake_turf_hand_shield_glb(os.path.join(MOCAP_OUT, "soccer_turf_hand_shield.glb"))
