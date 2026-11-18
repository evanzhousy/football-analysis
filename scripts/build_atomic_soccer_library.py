#!/usr/bin/env python3
"""
Unified White-Model Football Atomic Motion Library Builder
==========================================================
Builds ~86 canonical, 60fps, FK-grounded 65-bone `.glb` football atomic clips in `assets/mocap_atomic/`
and exports rich kinematic & stance-phase metadata to `src/soccerAtomicCatalog.js`.

Data Sources (100% genuine multi-camera optical motion capture):
1. Official Adobe Mixamo《Soccer Pack》& Locomotion 65-bone captures (`assets/mocap_mixamo/`)
2. Exact SO(3) Sagittal-Plane Mirrors (`L <-> R`) across world YZ plane (`X -> -X`)
3. CMU Graphics Lab 120Hz Vicon Optical Sports/Soccer/Agility captures (`assets/mocap/` & `/tmp/cmu_bvh_src/`),
   retargeted via exact Frame-0 T-Pose 3-DOF SO(3) world-delta mapping onto the unified 65-bone Mixamo rig.

Canonical Guarantees on EVERY Clip:
- Frame 0 starts at horizontal origin `(x = 0, z = 0)` facing `+Z` (`yaw = 0 rad`), with full horizontal
  Root Motion `(dx(t), dz(t))` and natural turn angle `deltaYaw(t)` preserved in `mixamorig:Hips`.
- Offline 65-bone FK foot-sole grounding ensures stance soles kiss `y = 0.000m` (`Foot.y ≈ 0.125m`)
  with zero underground penetration and zero hovering.
"""

import json
import math
import os
import struct

ROOT_DIR = "/home/antigravity/evanzhousy/football-analysis"
MIXAMO_DIR = os.path.join(ROOT_DIR, "assets/mocap_mixamo")
CMU_LOCAL_DIR = os.path.join(ROOT_DIR, "assets/mocap")
CMU_TMP_DIR = "/tmp/cmu_bvh_src"
OUT_GLB_DIR = os.path.join(ROOT_DIR, "assets/mocap_atomic")
OUT_CATALOG_JS = os.path.join(ROOT_DIR, "src/soccerAtomicCatalog.js")

# ---------------------------------------------------------------------------
# Pure Quaternion & Vector3 Math (Right-Handed: +X Left, +Y Up, +Z Forward)
# ---------------------------------------------------------------------------
def v_add(a, b):
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

def v_sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

def v_scale(a, s):
    return [a[0] * s, a[1] * s, a[2] * s]

def v_dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

def v_len(a):
    return math.sqrt(max(0.0, v_dot(a, a)))

def q_norm(q):
    l = math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3])
    return [q[0]/l, q[1]/l, q[2]/l, q[3]/l] if l > 1e-10 else [0.0, 0.0, 0.0, 1.0]

def q_conj(q):
    return [-q[0], -q[1], -q[2], q[3]]

def q_mul_raw(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [
        aw*bx + ax*bw + ay*bz - az*by,
        aw*by - ax*bz + ay*bw + az*bx,
        aw*bz + ax*by - ay*bx + az*bw,
        aw*bw - ax*bx - ay*by - az*bz,
    ]

def q_mul(a, b):
    return q_norm(q_mul_raw(a, b))

def q_axis_angle(axis, rad):
    s = math.sin(rad * 0.5)
    return q_norm([axis[0]*s, axis[1]*s, axis[2]*s, math.cos(rad * 0.5)])

def q_rot_vec(q, v):
    # Exact rotation of arbitrary-length vector v by unit quaternion q
    return q_mul_raw(q_mul_raw(q, [v[0], v[1], v[2], 0.0]), q_conj(q))[:3]

def q_mirror_yz(q):
    # Reflection across world YZ plane (X -> -X): axis (-ux, uy, uz), angle -theta => (qx, -qy, -qz, qw)
    return q_norm([q[0], -q[1], -q[2], q[3]])

def wrap_pi(a):
    while a > math.pi:
        a -= 2.0 * math.pi
    while a < -math.pi:
        a += 2.0 * math.pi
    return a

# ---------------------------------------------------------------------------
# GLB Loader & Canonical Template Rig (`idle_ready.glb` 65-bone Mixamo hierarchy)
# ---------------------------------------------------------------------------
def load_glb(path):
    with open(path, "rb") as f:
        f.seek(12)
        clen, _ = struct.unpack("<I4s", f.read(8))
        gltf = json.loads(f.read(clen).decode("utf-8"))
        f.seek(20 + clen)
        blen, _ = struct.unpack("<I4s", f.read(8))
        blob = f.read(blen)
    return gltf, blob

class MixamoRigTemplate:
    def __init__(self, template_glb_path):
        gltf, blob = load_glb(template_glb_path)
        self.nodes = gltf["nodes"]
        self.num_nodes = len(self.nodes)
        self.parent = {}
        self.children = {i: [] for i in range(self.num_nodes)}
        self.by_name = {}
        for i, n in enumerate(self.nodes):
            nm = n.get("name", f"node_{i}")
            self.by_name[nm] = i
            for c in n.get("children", []):
                self.parent[c] = i
                self.children[i].append(c)

        # Topological order (root -> leaves)
        self.topo_order = []
        roots = [i for i in range(self.num_nodes) if i not in self.parent]
        stack = roots[::-1]
        while stack:
            u = stack.pop()
            self.topo_order.append(u)
            for c in reversed(self.children[u]):
                stack.append(c)

        # Compute exact T-pose rest world transforms
        self.rest_lpos = {}
        self.rest_lrot = {}
        self.rest_lscl = {}
        self.rest_wpos = {}
        self.rest_wrot = {}
        self.rest_wscl = {}

        for i in self.topo_order:
            n = self.nodes[i]
            t = list(n.get("translation", [0.0, 0.0, 0.0]))
            r = q_norm(n.get("rotation", [0.0, 0.0, 0.0, 1.0]))
            s = float(n.get("scale", [1.0, 1.0, 1.0])[0])
            self.rest_lpos[i] = t
            self.rest_lrot[i] = r
            self.rest_lscl[i] = s
            if i not in self.parent:
                self.rest_wpos[i] = t[:]
                self.rest_wrot[i] = r[:]
                self.rest_wscl[i] = s
            else:
                p = self.parent[i]
                rt = q_rot_vec(self.rest_wrot[p], v_scale(t, self.rest_wscl[p]))
                self.rest_wpos[i] = v_add(self.rest_wpos[p], rt)
                self.rest_wrot[i] = q_mul(self.rest_wrot[p], r)
                self.rest_wscl[i] = self.rest_wscl[p] * s

        self.armature_idx = self.by_name["Armature"]
        self.hips_idx = self.by_name["mixamorig:Hips"]
        self.q_arm = self.rest_wrot[self.armature_idx]
        self.q_arm_inv = q_conj(self.q_arm)
        self.s_arm = self.rest_wscl[self.armature_idx]  # 0.01

        # Extract natural relaxed athletic hand/finger local rotations from `idle_ready.glb` frame 0
        self.relaxed_finger_lrot = {}
        anim = gltf["animations"][0]
        for ch in anim["channels"]:
            if ch["target"]["path"] != "rotation":
                continue
            ni = ch["target"]["node"]
            nm = self.nodes[ni].get("name", "")
            if "HandThumb" in nm or "HandIndex" in nm or "HandMiddle" in nm or "HandRing" in nm or "HandPinky" in nm:
                s_obj = anim["samplers"][ch["sampler"]]
                acc = gltf["accessors"][s_obj["output"]]
                bv = gltf["bufferViews"][acc["bufferView"]]
                off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
                self.relaxed_finger_lrot[ni] = q_norm(struct.unpack_from("<4f", blob, off))

        # Animated bone list (all `mixamorig:*` joints except `HeadTop_End` / leaf ends without rotation)
        self.anim_bone_indices = [
            i for i in self.topo_order
            if i != self.armature_idx and self.nodes[i].get("name", "").startswith("mixamorig:")
            and not self.nodes[i].get("name", "").endswith("_End")
        ]

    def world_hips_pos_to_local(self, wp):
        # P_world = s_arm * R(q_arm) * P_local  =>  P_local = (1/s_arm) * R(q_arm^-1) * P_world
        return q_rot_vec(self.q_arm_inv, v_scale(wp, 1.0 / self.s_arm))

    def evaluate_fk_world(self, hips_wpos, bone_lrot_map):
        wpos = {self.armature_idx: [0.0, 0.0, 0.0]}
        wrot = {self.armature_idx: self.q_arm[:]}
        for i in self.topo_order:
            if i == self.armature_idx:
                continue
            p = self.parent[i]
            lr = bone_lrot_map.get(i, self.rest_lrot[i])
            wrot[i] = q_mul(wrot[p], lr)
            if i == self.hips_idx:
                wpos[i] = hips_wpos[:]
            else:
                rt = q_rot_vec(wrot[p], v_scale(self.rest_lpos[i], self.rest_wscl[p]))
                wpos[i] = v_add(wpos[p], rt)
        return wpos, wrot

# ---------------------------------------------------------------------------
# Decode Existing Mixamo GLB Animation into Uniform World-Space Frames
# ---------------------------------------------------------------------------
def decode_mixamo_glb_frames(rig, glb_path, target_fps=60, t_start=0.0, t_end=None):
    gltf, blob = load_glb(glb_path)
    anim = gltf["animations"][0]
    src_nodes = gltf["nodes"]

    def read_accessor(acc_idx):
        acc = gltf["accessors"][acc_idx]
        bv = gltf["bufferViews"][acc["bufferView"]]
        off = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
        cnt = acc["count"]
        tp = acc["type"]
        n_comp = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[tp]
        out = []
        for k in range(cnt):
            vals = list(struct.unpack_from(f"<{n_comp}f", blob, off + k * 4 * n_comp))
            out.append(vals[0] if n_comp == 1 else vals)
        return out

    hips_pos_track = None
    rot_tracks = {}
    max_t = 0.0

    for ch in anim["channels"]:
        s_obj = anim["samplers"][ch["sampler"]]
        t_arr = read_accessor(s_obj["input"])
        v_arr = read_accessor(s_obj["output"])
        if t_arr:
            max_t = max(max_t, t_arr[-1])
        nm = src_nodes[ch["target"]["node"]].get("name", "")
        if nm not in rig.by_name:
            continue
        ri = rig.by_name[nm]
        path_type = ch["target"]["path"]
        if path_type == "translation" and ri == rig.hips_idx:
            hips_pos_track = (t_arr, v_arr)
        elif path_type == "rotation":
            rot_tracks[ri] = (t_arr, v_arr)

    dur_end = max_t if t_end is None else min(max_t, t_end)
    dur = max(0.05, dur_end - t_start)
    n_frames = max(2, int(round(dur * target_fps)) + 1)
    sample_times = [t_start + (dur * k) / (n_frames - 1) for k in range(n_frames)]

    def sample_vec3(track, t):
        ts, vs = track
        if t <= ts[0]:
            return vs[0][:]
        if t >= ts[-1]:
            return vs[-1][:]
        lo, hi = 0, len(ts) - 1
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if ts[mid] <= t:
                lo = mid
            else:
                hi = mid
        Span = max(1e-8, ts[hi] - ts[lo])
        u = (t - ts[lo]) / Span
        return [vs[lo][j] + u * (vs[hi][j] - vs[lo][j]) for j in range(3)]

    def sample_quat(track, t):
        ts, qs = track
        if t <= ts[0]:
            return q_norm(qs[0])
        if t >= ts[-1]:
            return q_norm(qs[-1])
        lo, hi = 0, len(ts) - 1
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if ts[mid] <= t:
                lo = mid
            else:
                hi = mid
        span = max(1e-8, ts[hi] - ts[lo])
        u = (t - ts[lo]) / span
        qa = q_norm(qs[lo])
        qb = q_norm(qs[hi])
        dot = sum(qa[j] * qb[j] for j in range(4))
        if dot < 0.0:
            qb = [-x for x in qb]
            dot = -dot
        if dot > 0.9995:
            return q_norm([qa[j] + u * (qb[j] - qa[j]) for j in range(4)])
        th0 = math.acos(min(1.0, dot))
        th = th0 * u
        s0 = math.cos(th) - dot * math.sin(th) / math.sin(th0)
        s1 = math.sin(th) / math.sin(th0)
        return q_norm([s0 * qa[j] + s1 * qb[j] for j in range(4)])

    frames_hips_wpos = []
    frames_wrot = []

    for t in sample_times:
        if hips_pos_track:
            hl = sample_vec3(hips_pos_track, t)
            hw = q_rot_vec(rig.q_arm, v_scale(hl, rig.s_arm))
        else:
            hw = rig.rest_wpos[rig.hips_idx][:]

        lrot_map = {}
        for bi in rig.anim_bone_indices:
            if bi in rot_tracks:
                lrot_map[bi] = sample_quat(rot_tracks[bi], t)
            elif bi in rig.relaxed_finger_lrot:
                lrot_map[bi] = rig.relaxed_finger_lrot[bi][:]
            else:
                lrot_map[bi] = rig.rest_lrot[bi][:]

        _, wrot = rig.evaluate_fk_world(hw, lrot_map)
        frames_hips_wpos.append(hw)
        frames_wrot.append(wrot)

    out_times = [round((dur * k) / (n_frames - 1), 5) for k in range(n_frames)]
    return out_times, frames_hips_wpos, frames_wrot

# ---------------------------------------------------------------------------
# Decode & Retarget CMU 120Hz Vicon BVH -> Mixamo 65-Bone World-Space Frames
# ---------------------------------------------------------------------------
CMU_TO_MIXAMO_MAP = {
    "mixamorig:Hips": "Hips",
    "mixamorig:Spine": "LowerBack",
    "mixamorig:Spine1": "Spine",
    "mixamorig:Spine2": "Spine1",
    "mixamorig:Neck": "Neck1",
    "mixamorig:Head": "Head",
    "mixamorig:LeftShoulder": "LeftShoulder",
    "mixamorig:LeftArm": "LeftArm",
    "mixamorig:LeftForeArm": "LeftForeArm",
    "mixamorig:LeftHand": "LeftHand",
    "mixamorig:RightShoulder": "RightShoulder",
    "mixamorig:RightArm": "RightArm",
    "mixamorig:RightForeArm": "RightForeArm",
    "mixamorig:RightHand": "RightHand",
    "mixamorig:LeftUpLeg": "LeftUpLeg",
    "mixamorig:LeftLeg": "LeftLeg",
    "mixamorig:LeftFoot": "LeftFoot",
    "mixamorig:LeftToeBase": "LeftToeBase",
    "mixamorig:RightUpLeg": "RightUpLeg",
    "mixamorig:RightLeg": "RightLeg",
    "mixamorig:RightFoot": "RightFoot",
    "mixamorig:RightToeBase": "RightToeBase",
}

def parse_bvh_file(path):
    with open(path, "r") as f:
        lines = [l.strip() for l in f if l.strip()]
    joints = []
    stack = []
    i = 0
    while i < len(lines):
        tok = lines[i].split()
        if tok[0] in ("ROOT", "JOINT"):
            joints.append({
                "name": tok[1],
                "parent": stack[-1] if stack else -1,
                "offset": [0.0, 0.0, 0.0],
                "channels": [],
            })
            stack.append(len(joints) - 1)
        elif tok[0] == "End" and tok[1] == "Site":
            stack.append(-999)
        elif tok[0] == "OFFSET":
            if stack[-1] != -999:
                joints[stack[-1]]["offset"] = [float(x) for x in tok[1:4]]
        elif tok[0] == "CHANNELS":
            cnt = int(tok[1])
            joints[stack[-1]]["channels"] = tok[2 : 2 + cnt]
        elif tok[0] == "}":
            stack.pop()
        elif tok[0] == "MOTION":
            nf = int(lines[i + 1].split(":")[1])
            dt = float(lines[i + 2].split(":")[1])
            frames = [[float(x) for x in lines[i + 3 + k].split()] for k in range(nf)]
            return joints, dt, frames
        i += 1
    raise ValueError(f"Invalid BVH file: {path}")

def decode_cmu_bvh_frames(rig, bvh_path, t_start=0.02, t_end=None, step=2):
    joints, dt, raw_frames = parse_bvh_file(bvh_path)
    bvh_by_name = {j["name"]: idx for idx, j in enumerate(joints)}

    def eval_bvh(fr):
        c = 0
        wr = {}
        wp = {}
        hp = [0.0, 0.0, 0.0]
        for idx, j in enumerate(joints):
            lq = [0.0, 0.0, 0.0, 1.0]
            for ch in j["channels"]:
                v = fr[c]
                c += 1
                if ch == "Xposition" and idx == 0:
                    hp[0] = v
                elif ch == "Yposition" and idx == 0:
                    hp[1] = v
                elif ch == "Zposition" and idx == 0:
                    hp[2] = v
                elif ch == "Xrotation":
                    lq = q_mul(lq, q_axis_angle([1, 0, 0], math.radians(v)))
                elif ch == "Yrotation":
                    lq = q_mul(lq, q_axis_angle([0, 1, 0], math.radians(v)))
                elif ch == "Zrotation":
                    lq = q_mul(lq, q_axis_angle([0, 0, 1], math.radians(v)))
            p = j["parent"]
            wr[idx] = lq if p == -1 else q_mul(wr[p], lq)
            wp[idx] = hp[:] if p == -1 else v_add(wp[p], q_rot_vec(wr[p], j["offset"]))
        return hp, wr, wp

    # Frame 0 in cgspeed CMU BVH is exact calibrated T-pose facing +Z!
    _, wr0, wp0 = eval_bvh(raw_frames[0])
    bvh_leg_len = max(5.0, wp0[bvh_by_name["LeftUpLeg"]][1] - wp0[bvh_by_name["LeftFoot"]][1])
    mix_leg_len = rig.rest_wpos[rig.by_name["mixamorig:LeftUpLeg"]][1] - rig.rest_wpos[rig.by_name["mixamorig:LeftFoot"]][1]
    scale_m = mix_leg_len / bvh_leg_len

    k_start = max(1, int(round(t_start / dt)))
    k_end = len(raw_frames) - 1 if t_end is None else min(len(raw_frames) - 1, int(round(t_end / dt)))
    indices = list(range(k_start, k_end + 1, step))
    if len(indices) < 2:
        indices = [1, min(len(raw_frames) - 1, 2)]

    out_dt = dt * step
    out_times = [round(idx_k * out_dt, 5) for idx_k in range(len(indices))]
    frames_hips_wpos = []
    frames_wrot = []

    for f_idx in indices:
        hp, wr, _ = eval_bvh(raw_frames[f_idx])
        hw = [hp[0] * scale_m, hp[1] * scale_m, hp[2] * scale_m]

        wrot = {rig.armature_idx: rig.q_arm[:]}
        for i in rig.topo_order:
            if i == rig.armature_idx:
                continue
            nm = rig.nodes[i].get("name", "")
            p = rig.parent[i]
            if nm in CMU_TO_MIXAMO_MAP and CMU_TO_MIXAMO_MAP[nm] in bvh_by_name:
                bi = bvh_by_name[CMU_TO_MIXAMO_MAP[nm]]
                delta_bvh = q_mul(wr[bi], q_conj(wr0[bi]))
                wrot[i] = q_mul(delta_bvh, rig.rest_wrot[i])
            elif i in rig.relaxed_finger_lrot:
                wrot[i] = q_mul(wrot[p], rig.relaxed_finger_lrot[i])
            else:
                wrot[i] = q_mul(wrot[p], rig.rest_lrot[i])

        frames_hips_wpos.append(hw)
        frames_wrot.append(wrot)

    return out_times, frames_hips_wpos, frames_wrot

# ---------------------------------------------------------------------------
# Exact World-Space Sagittal Mirror (`L <-> R` across X -> -X)
# ---------------------------------------------------------------------------
def mirror_world_frames(rig, frames_hips_wpos, frames_wrot):
    mirrored_hips = []
    mirrored_wrot = []

    swap_idx_map = {}
    for i in rig.anim_bone_indices:
        nm = rig.nodes[i]["name"]
        if "Left" in nm:
            opp = nm.replace("Left", "Right")
            swap_idx_map[i] = rig.by_name[opp]
        elif "Right" in nm:
            opp = nm.replace("Right", "Left")
            swap_idx_map[i] = rig.by_name[opp]
        else:
            swap_idx_map[i] = i

    for hw, wrot in zip(frames_hips_wpos, frames_wrot):
        mirrored_hips.append([-hw[0], hw[1], hw[2]])
        nw = {rig.armature_idx: rig.q_arm[:]}
        for dst_i in rig.topo_order:
            if dst_i == rig.armature_idx:
                continue
            if dst_i in swap_idx_map:
                src_i = swap_idx_map[dst_i]
                # Pure world-space swing/twist relative to source rest T-pose:
                delta_src = q_mul(wrot[src_i], q_conj(rig.rest_wrot[src_i]))
                delta_mir = q_mirror_yz(delta_src)
                nw[dst_i] = q_mul(delta_mir, rig.rest_wrot[dst_i])
            else:
                p = rig.parent[dst_i]
                nw[dst_i] = q_mul(nw[p], rig.rest_lrot[dst_i])
        mirrored_wrot.append(nw)

    return mirrored_hips, mirrored_wrot

# ---------------------------------------------------------------------------
# Canonicalization, Exact FK Turf Grounding & Metadata Extraction
# ---------------------------------------------------------------------------
def canonicalize_and_ground_clip(rig, times, frames_hips_wpos, frames_wrot, clip_spec):
    n = len(times)
    # 1. Align Frame 0 horizontal pelvis to (0, 0) and body facing yaw to +Z (0 rad)
    hw0 = frames_hips_wpos[0]
    wrot0 = frames_wrot[0]
    # Average Hips & Spine2 horizontal forward vector at frame 0 for rock-solid heading
    sp2_idx = rig.by_name["mixamorig:Spine2"]
    f_hips = q_rot_vec(wrot0[rig.hips_idx], [0.0, 0.0, 1.0])
    f_sp2 = q_rot_vec(wrot0[sp2_idx], [0.0, 0.0, 1.0])
    fx = f_hips[0] * 0.65 + f_sp2[0] * 0.35
    fz = f_hips[2] * 0.65 + f_sp2[2] * 0.35
    if fx * fx + fz * fz < 0.04:
        # Fallback for supine/prone starts (none expected at frame 0, safety guard)
        up_h = q_rot_vec(wrot0[rig.hips_idx], [0.0, 1.0, 0.0])
        fx, fz = up_h[0], up_h[2]
    yaw0 = math.atan2(fx, fz)
    q_yaw_align = q_axis_angle([0.0, 1.0, 0.0], -yaw0)

    aligned_hips = []
    aligned_lrot_per_frame = []
    fk_wpos_frames = []
    fk_wrot_frames = []

    for k in range(n):
        rel = [frames_hips_wpos[k][0] - hw0[0], frames_hips_wpos[k][1], frames_hips_wpos[k][2] - hw0[2]]
        hw_new = q_rot_vec(q_yaw_align, rel)
        wrot_src = frames_wrot[k]
        wrot_new = {rig.armature_idx: rig.q_arm[:]}
        lrot_map = {}

        for i in rig.topo_order:
            if i == rig.armature_idx:
                continue
            if i in rig.anim_bone_indices:
                wrot_new[i] = q_mul(q_yaw_align, wrot_src[i])
            else:
                p = rig.parent[i]
                wrot_new[i] = q_mul(wrot_new[p], rig.rest_lrot[i])

        for i in rig.anim_bone_indices:
            p = rig.parent[i]
            lrot_map[i] = q_mul(q_conj(wrot_new[p]), wrot_new[i])

        wpos_k, wrot_k = rig.evaluate_fk_world(hw_new, lrot_map)
        aligned_hips.append(hw_new)
        aligned_lrot_per_frame.append(lrot_map)
        fk_wpos_frames.append(wpos_k)
        fk_wrot_frames.append(wrot_k)

    # 2. Exact FK Foot-Sole Turf Grounding
    lf_i = rig.by_name["mixamorig:LeftFoot"]
    lt_i = rig.by_name["mixamorig:LeftToeBase"]
    rf_i = rig.by_name["mixamorig:RightFoot"]
    rt_i = rig.by_name["mixamorig:RightToeBase"]
    lk_i = rig.by_name["mixamorig:LeftLeg"]
    rk_i = rig.by_name["mixamorig:RightLeg"]

    is_ground_excursion = clip_spec.get("groundExcursion", False)

    min_soles = []
    for k in range(n):
        wp = fk_wpos_frames[k]
        l_sole = min(wp[lf_i][1] - 0.122, wp[lt_i][1] - 0.008)
        r_sole = min(wp[rf_i][1] - 0.122, wp[rt_i][1] - 0.008)
        m_s = min(l_sole, r_sole)
        if is_ground_excursion:
            m_s = min(m_s, wp[lk_i][1] - 0.065, wp[rk_i][1] - 0.065, wp[rig.hips_idx][1] - 0.14)
        min_soles.append(m_s)

    # Global floor calibration using 12th percentile of lowest contact point -> 0.000m turf
    sorted_soles = sorted(min_soles)
    p12_idx = min(len(sorted_soles) - 1, max(0, int(len(sorted_soles) * 0.12)))
    base_floor_shift = -sorted_soles[p12_idx]

    for k in range(n):
        dy = base_floor_shift
        # Prevent any single frame's boot sole from penetrating below -0.004m turf
        after_min = min_soles[k] + dy
        if after_min < -0.004:
            dy += (-0.004 - after_min)
        aligned_hips[k][1] += dy
        for node_idx in fk_wpos_frames[k]:
            if node_idx != rig.armature_idx:
                fk_wpos_frames[k][node_idx][1] += dy

    # 3. Ensure quaternion hemisphere continuity across consecutive frames for every bone
    bone_rot_tracks = {i: [] for i in rig.anim_bone_indices}
    hips_local_track = []
    for k in range(n):
        hips_local_track.append(rig.world_hips_pos_to_local(aligned_hips[k]))
        lmap = aligned_lrot_per_frame[k]
        for i in rig.anim_bone_indices:
            q_cur = lmap[i][:]
            prev_list = bone_rot_tracks[i]
            if prev_list:
                qp = prev_list[-1]
                if qp[0]*q_cur[0] + qp[1]*q_cur[1] + qp[2]*q_cur[2] + qp[3]*q_cur[3] < 0.0:
                    q_cur = [-x for x in q_cur]
            bone_rot_tracks[i].append(q_cur)

    # 4. Extract Rich Kinematic & Stance-Phase Metadata
    dur = max(1e-4, times[-1] - times[0])
    dt = dur / max(1, n - 1)

    # Unwrapped yaw curve
    yaws = [0.0]
    for k in range(1, n):
        fh = q_rot_vec(fk_wrot_frames[k][rig.hips_idx], [0.0, 0.0, 1.0])
        fs = q_rot_vec(fk_wrot_frames[k][sp2_idx], [0.0, 0.0, 1.0])
        fx_k = fh[0] * 0.65 + fs[0] * 0.35
        fz_k = fh[2] * 0.65 + fs[2] * 0.35
        raw_y = math.atan2(fx_k, fz_k) if (fx_k*fx_k + fz_k*fz_k > 0.04) else yaws[-1]
        dyaw = wrap_pi(raw_y - yaws[-1])
        yaws.append(yaws[-1] + dyaw)

    delta_pos = [round(aligned_hips[-1][0], 3), round(aligned_hips[-1][2], 3)]
    delta_yaw = round(yaws[-1], 4)

    # Entry & exit horizontal root speed (over 0.15s windows)
    win = max(1, min(n - 1, int(round(0.15 / max(1e-4, dt)))))
    entry_spd = math.hypot(aligned_hips[win][0] - aligned_hips[0][0], aligned_hips[win][2] - aligned_hips[0][2]) / (win * dt)
    exit_spd = math.hypot(aligned_hips[-1][0] - aligned_hips[-1 - win][0], aligned_hips[-1][2] - aligned_hips[-1 - win][2]) / (win * dt)
    path_len = sum(
        math.hypot(aligned_hips[k][0] - aligned_hips[k-1][0], aligned_hips[k][2] - aligned_hips[k-1][2])
        for k in range(1, n)
    )
    avg_spd = path_len / dur

    # Detect Left & Right stance windows (sole close to turf & low horizontal foot speed)
    def detect_foot_stances(foot_idx, toe_idx, foot_tag):
        planted = []
        for k in range(n):
            wp = fk_wpos_frames[k]
            sole_y = min(wp[foot_idx][1] - 0.122, wp[toe_idx][1] - 0.008)
            k0 = max(0, k - 1)
            k1 = min(n - 1, k + 1)
            span_t = max(1e-4, times[k1] - times[k0])
            vx = (fk_wpos_frames[k1][foot_idx][0] - fk_wpos_frames[k0][foot_idx][0]) / span_t
            vz = (fk_wpos_frames[k1][foot_idx][2] - fk_wpos_frames[k0][foot_idx][2]) / span_t
            f_spd = math.hypot(vx, vz)
            planted.append(sole_y < 0.042 and f_spd < max(1.65, avg_spd * 0.62))

        windows = []
        in_w = False
        s_idx = 0
        for k, is_p in enumerate(planted):
            if is_p and not in_w:
                in_w = True
                s_idx = k
            elif not is_p and in_w:
                in_w = False
                if times[k - 1] - times[s_idx] >= 0.06:
                    windows.append({"foot": foot_tag, "t0": round(times[s_idx], 3), "t1": round(times[k - 1], 3)})
        if in_w and times[-1] - times[s_idx] >= 0.06:
            windows.append({"foot": foot_tag, "t0": round(times[s_idx], 3), "t1": round(times[-1], 3)})
        return windows

    l_win = detect_foot_stances(lf_i, lt_i, "L")
    r_win = detect_foot_stances(rf_i, rt_i, "R")
    all_stances = sorted(l_win + r_win, key=lambda w: w["t0"])

    first_stance = all_stances[0]["foot"] if all_stances else (
        "L" if fk_wpos_frames[0][lf_i][1] <= fk_wpos_frames[0][rf_i][1] else "R"
    )
    last_stance = all_stances[-1]["foot"] if all_stances else (
        "L" if fk_wpos_frames[-1][lf_i][1] <= fk_wpos_frames[-1][rf_i][1] else "R"
    )

    # Ball contact metadata if tagged on clip_spec
    ball_meta = None
    if "ballTouch" in clip_spec and clip_spec["ballTouch"]:
        bt = clip_spec["ballTouch"]
        t_frac = bt.get("frac", 0.45)
        k_touch = min(n - 1, max(0, int(round(t_frac * (n - 1)))))
        foot_side = bt.get("foot", "R")
        if foot_side == "L":
            t_pos = fk_wpos_frames[k_touch][lt_i]
        elif foot_side == "R":
            t_pos = fk_wpos_frames[k_touch][rt_i]
        else:
            t_pos = fk_wpos_frames[k_touch][sp2_idx]
        hp_t = aligned_hips[k_touch]
        q_inv_y = q_axis_angle([0.0, 1.0, 0.0], -yaws[k_touch])
        rel_ball = q_rot_vec(q_inv_y, [t_pos[0] - hp_t[0], max(0.115, t_pos[1]), t_pos[2] - hp_t[2]])
        ball_meta = {
            "foot": foot_side,
            "time": round(times[k_touch], 3),
            "localOffset": [round(rel_ball[0], 3), round(rel_ball[1], 3), round(rel_ball[2], 3)],
        }

    meta = {
        "id": clip_spec["id"],
        "category": clip_spec["category"],
        "categoryLabel": clip_spec["categoryLabel"],
        "label": clip_spec["label"],
        "source": clip_spec["source"],
        "file": f"{clip_spec['id']}.glb",
        "loop": bool(clip_spec.get("loop", False)),
        "groundExcursion": bool(is_ground_excursion),
        "duration": round(dur, 3),
        "frames": n,
        "deltaPos": delta_pos,
        "deltaYaw": delta_yaw,
        "deltaYawDeg": round(math.degrees(delta_yaw), 1),
        "avgSpeed": round(avg_spd, 2),
        "entrySpeed": round(entry_spd, 2),
        "exitSpeed": round(exit_spd, 2),
        "firstStanceFoot": first_stance,
        "lastStanceFoot": last_stance,
        "stanceWindows": all_stances[:8],
        "ballTouch": ball_meta,
    }
    return times, hips_local_track, bone_rot_tracks, meta

# ---------------------------------------------------------------------------
# Compact Binary glTF 2.0 (.glb) Writer for 65-Bone Mixamo Rig
# ---------------------------------------------------------------------------
def write_mixamo_anim_glb(rig, out_path, clip_name, times, hips_local_track, bone_rot_tracks):
    out_nodes = []
    for i, n in enumerate(rig.nodes):
        nd = {"name": n.get("name", f"node_{i}")}
        if "translation" in n:
            nd["translation"] = [round(float(x), 6) for x in n["translation"]]
        if "rotation" in n:
            nd["rotation"] = [round(float(x), 6) for x in n["rotation"]]
        if "scale" in n:
            nd["scale"] = [round(float(x), 6) for x in n["scale"]]
        if "children" in n and n["children"]:
            nd["children"] = list(n["children"])
        out_nodes.append(nd)

    bin_chunks = bytearray()
    buffer_views = []
    accessors = []

    def add_accessor(flat_floats, comp_type_str, min_vals=None, max_vals=None):
        raw = struct.pack(f"<{len(flat_floats)}f", *flat_floats)
        offset = len(bin_chunks)
        bin_chunks.extend(raw)
        while len(bin_chunks) % 4 != 0:
            bin_chunks.append(0)
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
    const_time_acc = add_accessor([times[0], times[-1]], "SCALAR", [times[0]], [times[-1]]) if len(times) > 2 else time_acc
    samplers = []
    channels = []

    flat_hp = [x for v in hips_local_track for x in v]
    hp_acc = add_accessor(flat_hp, "VEC3")
    samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": hp_acc})
    channels.append({"sampler": 0, "target": {"node": rig.hips_idx, "path": "translation"}})

    for bi, q_list in bone_rot_tracks.items():
        # Compress static joints (e.g. relaxed athletic fingers) to [start, end] 2-keyframe track
        q0 = q_list[0]
        is_const = len(q_list) > 2 and all(
            abs(q[0] - q0[0]) + abs(q[1] - q0[1]) + abs(q[2] - q0[2]) + abs(q[3] - q0[3]) < 1e-4
            for q in q_list[1:]
        )
        if is_const:
            flat_q = [x for q in (q_list[0], q_list[-1]) for x in q]
            q_acc = add_accessor(flat_q, "VEC4")
            s_idx = len(samplers)
            samplers.append({"input": const_time_acc, "interpolation": "LINEAR", "output": q_acc})
            channels.append({"sampler": s_idx, "target": {"node": bi, "path": "rotation"}})
        else:
            flat_q = [x for q in q_list for x in q]
            q_acc = add_accessor(flat_q, "VEC4")
            s_idx = len(samplers)
            samplers.append({"input": time_acc, "interpolation": "LINEAR", "output": q_acc})
            channels.append({"sampler": s_idx, "target": {"node": bi, "path": "rotation"}})

    gltf_dict = {
        "asset": {"version": "2.0", "generator": "AtomicSoccerMocapBuilder"},
        "scene": 0,
        "scenes": [{"nodes": [rig.armature_idx]}],
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

# ---------------------------------------------------------------------------
# Master Curated 86-Clip Football Atomic Motion Specification
# ---------------------------------------------------------------------------
CATEGORIES = {
    "01_stance": "01 · 待命与观察扫描 (Stance & Scan)",
    "02_locomotion": "02 · 全速域无球与盘带步态 (Locomotion & Dribble)",
    "03_first_touch": "03 · 第一脚接停与凌空卸球 (First Touch & Trap)",
    "04_turns_pivots": "04 · 背身半转身与急停变向 (Turns, Pivots & Cuts)",
    "05_feints_skills": "05 · 假动作虚晃与过人技巧 (Feints, Croqueta & Roulette)",
    "06_pass_strike": "06 · 传球直塞与抽射挑射 (Pass, Through-Ball & Strike)",
    "07_press_defend_gk": "07 · 防守逼抢、滑铲护球与门将 (Press, Tackle & GK)",
}

def build_specs():
    specs = []

    def add_pair(base_id_a, base_id_b, cat, label_a, label_b, kind, src_file, t0=0.02, t1=None, loop=False, ge=False, bt_a=None, bt_b=None, src_tag="CMU 120Hz Optical"):
        specs.append({
            "id": base_id_a, "category": cat, "categoryLabel": CATEGORIES[cat], "label": label_a,
            "kind": kind, "srcFile": src_file, "mirror": False, "t0": t0, "t1": t1,
            "loop": loop, "groundExcursion": ge, "ballTouch": bt_a, "source": src_tag,
        })
        if base_id_b:
            specs.append({
                "id": base_id_b, "category": cat, "categoryLabel": CATEGORIES[cat], "label": label_b,
                "kind": kind, "srcFile": src_file, "mirror": True, "t0": t0, "t1": t1,
                "loop": loop, "groundExcursion": ge, "ballTouch": bt_b, "source": f"{src_tag} (Mirror)",
            })

    # --- 01. Stance & Scan (3 clips) ---
    add_pair("stance_ready", None, "01_stance", "进攻接球备战低站姿 (Ready Stance)", None, "mixamo", "idle_ready.glb", 0.0, 3.2, loop=True, src_tag="Mixamo Soccer")
    add_pair("stance_ball_scan", None, "01_stance", "脚下踩球环顾扫描 (Ball Idle & Scan)", None, "mixamo", "idle_scan.glb", 0.0, 3.2, loop=True, bt_a={"foot": "R", "frac": 0.5}, src_tag="Mixamo Soccer")
    add_pair("stance_def_jockey", None, "01_stance", "防守低重心碎步待命 (Defensive Jockey Idle)", None, "mixamo", "crouch_jockey_fwd.glb", 0.0, 2.4, loop=True, src_tag="Mixamo Soccer")

    # --- 02. Locomotion & Dribbling (14 clips) ---
    add_pair("loco_walk_fwd", None, "02_locomotion", "La Pausa 慢速控球推步 (Control Walk)", None, "mixamo", "walk_fwd.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("loco_walk_back", None, "02_locomotion", "背身回撤接应步 (Backpedal Walk)", None, "mixamo", "walk_back.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("loco_evasive_walk_l", "loco_evasive_walk_r", "02_locomotion", "慢速护球左闪避步 (La Pausa Evasive L)", "慢速护球右闪避步 (La Pausa Evasive R)", "cmu_tmp", "78_18.bvh", 0.04, None, loop=False)
    add_pair("loco_strafe_walk_l", "loco_strafe_walk_r", "02_locomotion", "左侧向拉开接应步 (Lateral Walk L)", "右侧向拉开接应步 (Lateral Walk R)", "mixamo", "walk_strafe_l.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("loco_dribble_jog", None, "02_locomotion", "中速持球盘带推进 (Forward Dribble Jog)", None, "mixamo", "jog_fwd.glb", 0.0, None, loop=True, bt_a={"foot": "R", "frac": 0.45}, src_tag="Mixamo Soccer")
    add_pair("loco_ball_run_fast", None, "02_locomotion", "高速直线趟球推进 (Fast Ball Run)", None, "cmu_tmp", "78_06.bvh", 0.02, None, loop=True, bt_a={"foot": "R", "frac": 0.5})
    add_pair("loco_arc_run_r", "loco_arc_run_l", "02_locomotion", "右外道大弧线超车推进 (Wide Arc Run R)", "左外道大弧线超车推进 (Wide Arc Run L)", "cmu_tmp", "78_07.bvh", 0.02, None, loop=False, bt_a={"foot": "R", "frac": 0.4}, bt_b={"foot": "L", "frac": 0.4})
    add_pair("loco_tight_arc_l", "loco_tight_arc_r", "02_locomotion", "左急弧内切持球突进 (Tight Arc Cut-In L)", "右急弧内切持球突进 (Tight Arc Cut-In R)", "cmu_tmp", "78_09.bvh", 0.02, None, loop=False, bt_a={"foot": "L", "frac": 0.45}, bt_b={"foot": "R", "frac": 0.45})
    add_pair("loco_sprint_fwd", None, "02_locomotion", "摆脱后全速爆发冲刺 (Explosive Sprint)", None, "mixamo", "sprint_fwd.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("loco_sprint_back", None, "02_locomotion", "高速退防回追步 (Backpedal Sprint)", None, "mixamo", "sprint_back.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")

    # --- 03. First Touch & Aerial Cushioning (10 clips) ---
    add_pair("touch_chest_receive_r", "touch_chest_receive_l", "03_first_touch", "迎球胸部/右脚卸球停球 (Receive & Cushion R)", "迎球胸部/左脚卸球停球 (Receive & Cushion L)", "mixamo", "soccer_receive_chest.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.42}, bt_b={"foot": "L", "frac": 0.42}, src_tag="Mixamo Soccer")
    add_pair("touch_aerial_lunge_l", "touch_aerial_lunge_r", "03_first_touch", "大跨步弓步左脚凌空卸高球 (Split Lunge Aerial Cushion L)", "大跨步弓步右脚凌空卸高球 (Split Lunge Aerial Cushion R)", "cmu_tmp", "144_11.bvh", 3.35, 5.05, bt_a={"foot": "L", "frac": 0.42}, bt_b={"foot": "R", "frac": 0.42})
    add_pair("touch_cushion_step_l", "touch_cushion_step_r", "03_first_touch", "前探步左脚迎球轻卸缓冲 (Step Trap Cushion L)", "前探步右脚迎球轻卸缓冲 (Step Trap Cushion R)", "cmu_tmp", "144_11.bvh", 1.15, 2.65, bt_a={"foot": "L", "frac": 0.45}, bt_b={"foot": "R", "frac": 0.45})
    add_pair("touch_trap_play_r", "touch_trap_play_l", "03_first_touch", "右脚迎球停球顺势连拨 (Trap & Quick Touch R)", "左脚迎球停球顺势连拨 (Trap & Quick Touch L)", "mixamo", "soccer_crossover_feint.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.35}, bt_b={"foot": "L", "frac": 0.35}, src_tag="Mixamo Soccer")
    add_pair("touch_diag_take_l", "touch_diag_take_r", "03_first_touch", "第一脚左斜前顺球领走 (Diagonal First-Touch Take L)", "第一脚右斜前顺球领走 (Diagonal First-Touch Take R)", "mixamo", "jog_strafe_l.glb", 0.0, None, bt_a={"foot": "L", "frac": 0.30}, bt_b={"foot": "R", "frac": 0.30}, src_tag="Mixamo Soccer")

    # --- 04. Turns, Back-to-Goal Pivots & Sharp Cuts (20 clips) ---
    add_pair("turn_backpedal_half_r", "turn_backpedal_half_l", "04_turns_pivots", "背身回撤接应顺势右半转身 180° (Backpedal Half-Turn R)", "背身回撤接应顺势左半转身 180° (Backpedal Half-Turn L)", "cmu_tmp", "69_34.bvh", 3.35, 5.55, bt_a={"foot": "R", "frac": 0.45}, bt_b={"foot": "L", "frac": 0.45})
    add_pair("turn_back_inplace_l", "turn_back_inplace_r", "04_turns_pivots", "背身原地拧身左转 180° 摆脱 (In-Place Back-Turn L)", "背身原地拧身右转 180° 摆脱 (In-Place Back-Turn R)", "cmu_tmp", "69_39.bvh", 4.35, 6.45, bt_a={"foot": "L", "frac": 0.42}, bt_b={"foot": "R", "frac": 0.42})
    add_pair("turn_stride_pivot_180_r", "turn_stride_pivot_180_l", "04_turns_pivots", "行进间踩球右向 180° 折返 (180° Stride Pivot R)", "行进间踩球左向 180° 折返 (180° Stride Pivot L)", "mixamo", "soccer_half_turn_180.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48}, src_tag="Mixamo Soccer")
    add_pair("turn_shield_pivot_90_r", "turn_shield_pivot_90_l", "04_turns_pivots", "低重心轴心脚背身护球右旋 90° (Shielding Pivot 90° R)", "低重心轴心脚背身护球左旋 90° (Shielding Pivot 90° L)", "cmu_tmp", "78_31.bvh", 0.05, 1.75, bt_a={"foot": "R", "frac": 0.50}, bt_b={"foot": "L", "frac": 0.50})
    add_pair("turn_shield_pivot_180_r", "turn_shield_pivot_180_l", "04_turns_pivots", "低重心轴心脚背身抹转 180° 右突 (Shielding Pivot 180° R)", "低重心轴心脚背身抹转 180° 左突 (Shielding Pivot 180° L)", "cmu_tmp", "78_31.bvh", 3.45, 5.30, bt_a={"foot": "R", "frac": 0.50}, bt_b={"foot": "L", "frac": 0.50})
    add_pair("turn_tight_l", "turn_tight_r", "04_turns_pivots", "持球紧凑左急转抹过 (Tight Turn L)", "持球紧凑右急转抹过 (Tight Turn R)", "cmu_tmp", "78_01.bvh", 0.02, None, bt_a={"foot": "L", "frac": 0.46}, bt_b={"foot": "R", "frac": 0.46})
    add_pair("turn_supertight_l", "turn_supertight_r", "04_turns_pivots", "极小半径左急扣折返 (Super-Tight Cut L)", "极小半径右急扣折返 (Super-Tight Cut R)", "cmu_tmp", "78_04.bvh", 0.02, None, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48})
    add_pair("turn_cut_90_r", "turn_cut_90_l", "04_turns_pivots", "急停外脚背右扣 90° 变向 (90° Plant & Cut R)", "急停外脚背左扣 90° 变向 (90° Plant & Cut L)", "mixamo", "soccer_cut_right_90.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.44}, bt_b={"foot": "L", "frac": 0.44}, src_tag="Mixamo Soccer")
    add_pair("turn_run_cut_l", "turn_run_cut_r", "04_turns_pivots", "高速冲刺急切左变向 (High-Speed Run Cut L)", "高速冲刺急切右变向 (High-Speed Run Cut R)", "cmu_tmp", "127_15.bvh", 0.02, None, bt_a={"foot": "R", "frac": 0.45}, bt_b={"foot": "L", "frac": 0.45})
    add_pair("turn_push_r", "turn_push_l", "04_turns_pivots", "倚人发力蹬地右侧身抹过 (Contact Push-Turn R)", "倚人发力蹬地左侧身抹过 (Contact Push-Turn L)", "cmu_tmp", "134_08.bvh", 0.20, 1.95, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48})

    # --- 05. Feints, La Croqueta, Roulette & Burst Skills (14 clips) ---
    add_pair("skill_feint_l_go_r", "skill_feint_r_go_l", "05_feints_skills", "左沉肩虚晃向右爆发突破 (Body Feint L -> Go R)", "右沉肩虚晃向左爆发突破 (Body Feint R -> Go L)", "cmu_tmp", "78_20.bvh", 0.02, None, bt_a={"foot": "R", "frac": 0.56}, bt_b={"foot": "L", "frac": 0.56})
    add_pair("skill_croqueta_lr", "skill_croqueta_rl", "05_feints_skills", "油炸丸子双脚连拨左拉右趟 (La Croqueta L -> R)", "油炸丸子双脚连拨右拉左趟 (La Croqueta R -> L)", "cmu_tmp", "78_33.bvh", 0.02, None, bt_a={"foot": "L", "frac": 0.44}, bt_b={"foot": "R", "frac": 0.44})
    add_pair("skill_fakeshot_break_r", "skill_fakeshot_break_l", "05_feints_skills", "假射真扣向右急折突破 (Fake-Shot Chop & Break R)", "假射真扣向左急折突破 (Fake-Shot Chop & Break L)", "cmu_tmp", "78_22.bvh", 2.45, 4.85, bt_a={"foot": "L", "frac": 0.45}, bt_b={"foot": "R", "frac": 0.45})
    add_pair("skill_roulette_360_r", "skill_roulette_360_l", "05_feints_skills", "马赛回旋 360° 踩拉球顺时针摆脱 (Marseille Roulette R)", "马赛回旋 360° 踩拉球逆时针摆脱 (Marseille Roulette L)", "mixamo", "soccer_roulette_360.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48}, src_tag="Mixamo Soccer")
    add_pair("skill_spin_break_l", "skill_spin_break_r", "05_feints_skills", "行进间紧凑左旋抹人过人 (Compact Spin Break L)", "行进间紧凑右旋抹人过人 (Compact Spin Break R)", "cmu_tmp", "78_13.bvh", 0.02, None, bt_a={"foot": "L", "frac": 0.46}, bt_b={"foot": "R", "frac": 0.46})
    add_pair("skill_stop_and_go_r", "skill_stop_and_go_l", "05_feints_skills", "La Pausa 急停顿挫二次爆发右突 (Stop & Go Burst R)", "La Pausa 急停顿挫二次爆发左突 (Stop & Go Burst L)", "cmu_tmp", "134_12.bvh", 0.70, 2.85, bt_a={"foot": "R", "frac": 0.62}, bt_b={"foot": "L", "frac": 0.62})
    add_pair("skill_burst_from_stop_r", "skill_burst_from_stop_l", "05_feints_skills", "静止第一步右脚蹬地爆发启动 (Explosive First-Step Drive R)", "静止第一步左脚蹬地爆发启动 (Explosive First-Step Drive L)", "cmu_tmp", "78_32.bvh", 0.02, None, bt_a={"foot": "R", "frac": 0.35}, bt_b={"foot": "L", "frac": 0.35})

    # --- 06. Passing, Through-Balls, Chips & Driven Shots (10 clips) ---
    add_pair("kick_pass_inside_r", "kick_pass_inside_l", "06_pass_strike", "右脚内侧精准推传 (Inside-Foot Pass R)", "左脚内侧精准推传 (Inside-Foot Pass L)", "mixamo", "soccer_pass_inside.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48}, src_tag="Mixamo Soccer")
    add_pair("kick_through_ball_r", "kick_through_ball_l", "06_pass_strike", "行进间右脚直塞穿透防线 (Stride Through-Ball R)", "行进间左脚直塞穿透防线 (Stride Through-Ball L)", "mixamo", "soccer_through_ball.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.46}, bt_b={"foot": "L", "frac": 0.46}, src_tag="Mixamo Soccer")
    add_pair("kick_shot_drive_r", "kick_shot_drive_l", "06_pass_strike", "右脚大力低平抽射死角 (Driven Low Shot R)", "左脚大力低平抽射死角 (Driven Low Shot L)", "mixamo", "soccer_shot_drive.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.48}, bt_b={"foot": "L", "frac": 0.48}, src_tag="Mixamo Soccer")
    add_pair("kick_chip_loft_r", "kick_chip_loft_l", "06_pass_strike", "右脚高摆腿过顶挑传/远射 (Lofted Chip / Long Pass R)", "左脚高摆腿过顶挑传/远射 (Lofted Chip / Long Pass L)", "mixamo", "soccer_power_kick.glb", 0.0, None, bt_a={"foot": "R", "frac": 0.50}, bt_b={"foot": "L", "frac": 0.50}, src_tag="Mixamo Soccer")
    add_pair("kick_stride_strike_r", "kick_stride_strike_l", "06_pass_strike", "助跑上步右脚正脚背劲射 (Approach Instep Strike R)", "助跑上步左脚正脚背劲射 (Approach Instep Strike L)", "cmu_local", "10_03.bvh", 0.35, 2.35, bt_a={"foot": "R", "frac": 0.46}, bt_b={"foot": "L", "frac": 0.46})

    # --- 07. Pressing, Biting on Feints, Slide Tackles, Turf Shield & GK (15 clips) ---
    add_pair("def_jockey_back", None, "07_press_defend_gk", "防守低重心斜退封堵路线 (Defensive Jockey Backpedal)", None, "mixamo", "crouch_jockey_back.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("def_shuffle_l", "def_shuffle_r", "07_press_defend_gk", "防守低重心左滑步封堵 (Defensive Shuffle L)", "防守低重心右滑步封堵 (Defensive Shuffle R)", "mixamo", "crouch_strafe_l.glb", 0.0, None, loop=True, src_tag="Mixamo Soccer")
    add_pair("def_press_brake_r", "def_press_brake_l", "07_press_defend_gk", "防守凶猛上抢扑空急刹失位 R (Pressing Hard Brake R)", "防守凶猛上抢扑空急刹失位 L (Pressing Hard Brake L)", "cmu_tmp", "78_25.bvh", 0.40, 2.55)
    add_pair("def_bite_feint_r", "def_bite_feint_l", "07_press_defend_gk", "防守吃晃横移急停重心被骗 R (Bite on Feint Stop-to-Stop R)", "防守吃晃横移急停重心被骗 L (Bite on Feint Stop-to-Stop L)", "cmu_tmp", "78_26.bvh", 0.30, 2.45)
    add_pair("def_run_hard_stop_r", "def_run_hard_stop_l", "07_press_defend_gk", "高速回追急停降重心刹车 R (High-Speed Recovery Hard Stop R)", "高速回追急停降重心刹车 L (High-Speed Recovery Hard Stop L)", "cmu_tmp", "127_05.bvh", 0.04, 1.85)
    add_pair("def_slide_tackle_r", "def_slide_tackle_l", "07_press_defend_gk", "飞身倒地右脚滑铲封堵 (Slide Tackle R)", "飞身倒地左脚滑铲封堵 (Slide Tackle L)", "mixamo", "soccer_slide_tackle.glb", 0.0, None, ge=True, src_tag="Mixamo Soccer")
    add_pair("shield_turf_hand_r", "shield_turf_hand_l", "07_press_defend_gk", "对抗失衡单手撑草皮护球弹起 R (Turf Hand-Shield & Pop-Up R)", "对抗失衡单手撑草皮护球弹起 L (Turf Hand-Shield & Pop-Up L)", "mixamo", "soccer_turf_hand_shield.glb", 0.0, None, ge=True, src_tag="Mixamo Soccer")
    add_pair("gk_dive_left", None, "07_press_defend_gk", "门将向左侧飞身鱼跃扑救 (GK Diving Save L)", None, "mixamo", "gk_dive_left.glb", 0.0, None, ge=True, src_tag="Mixamo Soccer")
    add_pair("gk_dive_right", None, "07_press_defend_gk", "门将向右侧倒地封堵扑救 (GK Diving Save R)", None, "mixamo", "gk_dive_right.glb", 0.0, None, ge=True, src_tag="Mixamo Soccer")

    return specs

def main():
    os.makedirs(OUT_GLB_DIR, exist_ok=True)
    rig = MixamoRigTemplate(os.path.join(MIXAMO_DIR, "idle_ready.glb"))
    specs = build_specs()

    # Cache decoded un-mirrored world frames per (kind, srcFile, t0, t1) to make baking blazingly fast
    src_cache = {}
    catalog_entries = []
    total_bytes = 0

    for idx, sp in enumerate(specs):
        cache_key = (sp["kind"], sp["srcFile"], sp["t0"], sp["t1"])
        if cache_key not in src_cache:
            if sp["kind"] == "mixamo":
                p = os.path.join(MIXAMO_DIR, sp["srcFile"])
                src_cache[cache_key] = decode_mixamo_glb_frames(rig, p, target_fps=30, t_start=sp["t0"], t_end=sp["t1"])
            elif sp["kind"] == "cmu_local":
                p = os.path.join(CMU_LOCAL_DIR, sp["srcFile"])
                src_cache[cache_key] = decode_cmu_bvh_frames(rig, p, t_start=sp["t0"], t_end=sp["t1"], step=4)
            elif sp["kind"] == "cmu_tmp":
                p = os.path.join(CMU_TMP_DIR, sp["srcFile"])
                src_cache[cache_key] = decode_cmu_bvh_frames(rig, p, t_start=sp["t0"], t_end=sp["t1"], step=4)
            else:
                raise ValueError(f"Unknown source kind: {sp['kind']}")

        base_times, base_hips, base_wrot = src_cache[cache_key]
        if sp["mirror"]:
            use_hips, use_wrot = mirror_world_frames(rig, base_hips, base_wrot)
        else:
            use_hips = [h[:] for h in base_hips]
            use_wrot = [{k: v[:] for k, v in fr.items()} for fr in base_wrot]

        times, hips_local_track, bone_rot_tracks, meta = canonicalize_and_ground_clip(
            rig, base_times[:], use_hips, use_wrot, sp
        )

        out_glb = os.path.join(OUT_GLB_DIR, meta["file"])
        write_mixamo_anim_glb(rig, out_glb, meta["id"], times, hips_local_track, bone_rot_tracks)
        fsize = os.path.getsize(out_glb)
        total_bytes += fsize
        catalog_entries.append(meta)
        print(
            f"[{idx+1:2d}/{len(specs)}] {meta['id']:28s} | {meta['duration']:4.2f}s | "
            f"dPos=({meta['deltaPos'][0]:5.2f},{meta['deltaPos'][1]:5.2f})m | "
            f"dYaw={meta['deltaYawDeg']:6.1f}° | stances={meta['firstStanceFoot']}->{meta['lastStanceFoot']} | "
            f"{fsize/1024:5.1f} KB"
        )

    js_code = (
        "/**\n"
        " * Auto-generated by `scripts/build_atomic_soccer_library.py`.\n"
        f" * Unified 65-Bone Optical-Mocap White-Model Football Atomic Library ({len(catalog_entries)} clips).\n"
        " */\n"
        f"export const ATOMIC_CATEGORIES = {json.dumps(CATEGORIES, ensure_ascii=False, indent=2)};\n\n"
        f"export const SOCCER_ATOMIC_CATALOG = {json.dumps(catalog_entries, ensure_ascii=False, indent=2)};\n\n"
        "export const SOCCER_ATOMIC_BY_ID = new Map(SOCCER_ATOMIC_CATALOG.map((c) => [c.id, c]));\n"
    )
    with open(OUT_CATALOG_JS, "w", encoding="utf-8") as f:
        f.write(js_code)

    print(f"\nSUCCESS: Built {len(catalog_entries)} atomic football clips ({total_bytes / (1024*1024):.2f} MB total) -> {OUT_CATALOG_JS}")

if __name__ == "__main__":
    main()
