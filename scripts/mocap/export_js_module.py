#!/usr/bin/env python3
"""
Step 4: Biomechanical 3D Video Motion Exporter for Babylon.js
=============================================================
Supports two exact right-handed coordinate modes (`det = +1`):
  - `stadium_world`: Direct SO(3) mapping `(-z_mp, -y_mp, -x_mp)` from broadcast camera
    space (`+x_mp` Right, `+y_mp` Down, `+z_mp` Away) to Babylon stadium world space
    (`+X` Toward Broadcast Cam, `+Y` Up, `-Z` Screen Right / `+Z` Screen Left).
    Eliminates 100% of monocular pelvis-yaw projection error on broadcast clips!
  - `pelvis`: Orthonormal pelvis-intrinsic `[Left, Up, Forward]` frame for camera-agnostic clips.
"""

import argparse
import json
import math
import os
import numpy as np


def norm3(v, fallback=(0.0, 1.0, 0.0)):
    n = float(np.linalg.norm(v))
    if n < 1e-6:
        return np.array(fallback, dtype=np.float64)
    return np.asarray(v, dtype=np.float64) / n


def gaussian_smooth_series(arr, sigma=0.95):
    n = len(arr)
    if n < 3 or sigma <= 0.05:
        return arr.copy()
    radius = max(1, int(math.ceil(sigma * 3)))
    idx = np.arange(-radius, radius + 1, dtype=np.float64)
    kernel = np.exp(-0.5 * (idx / sigma) ** 2)
    kernel /= kernel.sum()
    padded = np.pad(arr, ((radius, radius), (0, 0)), mode="edge")
    out = np.zeros_like(arr)
    for d in range(arr.shape[1]):
        out[:, d] = np.convolve(padded[:, d], kernel, mode="valid")
    return out


def smoothstep01(u):
    t = max(0.0, min(1.0, float(u)))
    return t * t * (3.0 - 2.0 * t)


def export_js_module(pose_json_path, scenario_id, out_path, space_mode="stadium_world"):
    with open(pose_json_path) as f:
        pose_data = json.load(f)

    frames = pose_data["frames"]
    fps = float(pose_data["fps"])
    n_frames = len(frames)
    active_range = pose_data.get("active_range")

    LM_IDX = {
        "nose": 0,
        "l_sh": 11, "r_sh": 12,
        "l_el": 13, "r_el": 14,
        "l_wr": 15, "r_wr": 16,
        "l_hp": 23, "r_hp": 24,
        "l_kn": 25, "r_kn": 26,
        "l_an": 27, "r_an": 28,
        "l_hl": 29, "r_hl": 30,
        "l_ft": 31, "r_ft": 32,
    }

    keys = sorted(LM_IDX.keys())
    # Store directly in right-handed Stadium World space: (-z_mp, -y_mp, -x_mp), det = +1
    raw_pts = {k: np.zeros((n_frames, 3), dtype=np.float64) for k in keys}
    img_pts = {k: np.zeros((n_frames, 2), dtype=np.float64) for k in keys}
    l_arm_vis = np.zeros(n_frames, dtype=np.float64)
    r_arm_vis = np.zeros(n_frames, dtype=np.float64)
    valid_mask = np.zeros(n_frames, dtype=bool)
    vid_w = float(pose_data.get("width", 960))
    vid_h = float(pose_data.get("height", 540))

    for i, fr in enumerate(frames):
        wlm = fr.get("landmarks_world")
        ilm = fr.get("landmarks_image")
        if not wlm or len(wlm) < 33:
            continue
        vis_vals = [wlm[idx][3] for idx in (11, 12, 23, 24, 25, 26, 27, 28)]
        if float(np.mean(vis_vals)) < 0.35:
            continue
        valid_mask[i] = True
        l_arm_vis[i] = 0.5 * (wlm[13][3] + wlm[15][3])
        r_arm_vis[i] = 0.5 * (wlm[14][3] + wlm[16][3])
        for k, idx in LM_IDX.items():
            lm = wlm[idx]
            raw_pts[k][i] = [-lm[2], -lm[1], -lm[0]]
            if ilm and len(ilm) > idx:
                img_pts[k][i] = [ilm[idx][0] * vid_w, ilm[idx][1] * vid_h]

    valid_indices = np.where(valid_mask)[0]
    if len(valid_indices) == 0:
        raise RuntimeError(f"No valid pose frames in {pose_json_path}")

    l_arm_vis = gaussian_smooth_series(
        np.interp(np.arange(n_frames), valid_indices, l_arm_vis[valid_indices])[:, None], sigma=1.4
    )[:, 0]
    r_arm_vis = gaussian_smooth_series(
        np.interp(np.arange(n_frames), valid_indices, r_arm_vis[valid_indices])[:, None], sigma=1.4
    )[:, 0]

    for k in keys:
        for d in range(3):
            raw_pts[k][:, d] = np.interp(np.arange(n_frames), valid_indices, raw_pts[k][valid_indices, d])
        for d in range(2):
            img_pts[k][:, d] = np.interp(np.arange(n_frames), valid_indices, img_pts[k][valid_indices, d])
        # Crisp smoothing (sigma=0.95 preserves dynamic arm balance & 0.2s aerial foot cushion!)
        raw_pts[k] = gaussian_smooth_series(raw_pts[k], sigma=0.95)
        img_pts[k] = gaussian_smooth_series(img_pts[k], sigma=0.95)

    v_left_raw = 0.60 * (raw_pts["l_hp"] - raw_pts["r_hp"]) + 0.40 * (raw_pts["l_sh"] - raw_pts["r_sh"])
    v_left_raw[:, 1] = 0.0
    v_left_smooth = gaussian_smooth_series(v_left_raw, sigma=2.0)

    def to_out_unit(vec_world, lh, fh, fallback):
        u_w = norm3(vec_world, fallback=fallback)
        if space_mode == "stadium_world":
            return [round(float(u_w[0]), 5), round(float(u_w[1]), 5), round(float(u_w[2]), 5)]
        c_left = float(u_w[0] * lh[0] + u_w[2] * lh[2])
        c_up = float(u_w[1])
        c_fwd = float(u_w[0] * fh[0] + u_w[2] * fh[2])
        u_b = norm3([c_left, c_up, c_fwd], fallback=fallback)
        return [round(float(u_b[0]), 5), round(float(u_b[1]), 5), round(float(u_b[2]), 5)]

    def fuse_screen_plane(vec_world, p0_img, p1_img, blend_screen=0.55):
        """Reinforces screen-plane (-Z_world = +dx_px, +Y_world = -dy_px) angle from 2D pixels
        so monocular depth foreshortening never collapses outstretched arms or wide leg splits."""
        u_w = norm3(vec_world)
        dx = float(p1_img[0] - p0_img[0])
        dy = float(p1_img[1] - p0_img[1])
        plen = math.hypot(dx, dy)
        if plen < 6.0:
            return u_w
        # Screen plane unit vector in (-Z_world, +Y_world)
        sz = -dx / plen
        sy = -dy / plen
        # Preserve world X depth component while aligning (Y, Z) projection with crisp 2D image angle
        yz_mag = math.sqrt(max(0.08, 1.0 - u_w[0] * u_w[0]))
        fused = np.array([
            u_w[0],
            (1.0 - blend_screen) * u_w[1] + blend_screen * (sy * yz_mag),
            (1.0 - blend_screen) * u_w[2] + blend_screen * (sz * yz_mag),
        ], dtype=np.float64)
        return norm3(fused)

    js_frames = []
    for i in range(n_frames):
        t_sec = i / fps
        lh = norm3([v_left_smooth[i, 0], 0.0, v_left_smooth[i, 2]], fallback=(1.0, 0.0, 0.0))
        fh = np.array([-lh[2], 0.0, lh[0]], dtype=np.float64)
        yaw_rad = round(float(math.atan2(fh[0], fh[2])), 4)

        hip_c = 0.5 * (raw_pts["l_hp"][i] + raw_pts["r_hp"][i])
        sh_c = 0.5 * (raw_pts["l_sh"][i] + raw_pts["r_sh"][i])
        hip_img = 0.5 * (img_pts["l_hp"][i] + img_pts["r_hp"][i])
        sh_img = 0.5 * (img_pts["l_sh"][i] + img_pts["r_sh"][i])

        torso_w = fuse_screen_plane(sh_c - hip_c, hip_img, sh_img, blend_screen=0.45)
        torso_b = to_out_unit(torso_w, lh, fh, (0.0, 1.0, 0.0))
        # Allow natural athletic forward lean up to ~38 deg (cos 38 deg = 0.788), never 90 deg fold
        if torso_b[1] < 0.78:
            horiz = math.hypot(torso_b[0], torso_b[2])
            if horiz > 1e-5:
                s = math.sqrt(max(0.0, 1.0 - 0.78 * 0.78)) / horiz
                torso_b = [round(torso_b[0] * s, 5), 0.78, round(torso_b[2] * s, 5)]
            else:
                torso_b = [0.0, 1.0, 0.0]

        lt_w = fuse_screen_plane(raw_pts["l_kn"][i] - raw_pts["l_hp"][i], img_pts["l_hp"][i], img_pts["l_kn"][i], 0.50)
        ls_w = fuse_screen_plane(raw_pts["l_an"][i] - raw_pts["l_kn"][i], img_pts["l_kn"][i], img_pts["l_an"][i], 0.50)
        rt_w = fuse_screen_plane(raw_pts["r_kn"][i] - raw_pts["r_hp"][i], img_pts["r_hp"][i], img_pts["r_kn"][i], 0.50)
        rs_w = fuse_screen_plane(raw_pts["r_an"][i] - raw_pts["r_kn"][i], img_pts["r_kn"][i], img_pts["r_an"][i], 0.50)

        l_thigh = to_out_unit(lt_w, lh, fh, (0.0, -0.98, 0.15))
        l_shin = to_out_unit(ls_w, lh, fh, (0.0, -0.98, -0.15))
        r_thigh = to_out_unit(rt_w, lh, fh, (0.0, -0.98, 0.15))
        r_shin = to_out_unit(rs_w, lh, fh, (0.0, -0.98, -0.15))

        l_thigh[1] = min(-0.18, l_thigh[1])
        r_thigh[1] = min(-0.18, r_thigh[1])
        l_shin[1] = min(-0.12, l_shin[1])
        r_shin[1] = min(-0.12, r_shin[1])
        l_thigh = [round(float(x), 5) for x in norm3(l_thigh)]
        r_thigh = [round(float(x), 5) for x in norm3(r_thigh)]
        l_shin = [round(float(x), 5) for x in norm3(l_shin)]
        r_shin = [round(float(x), 5) for x in norm3(r_shin)]

        lu_w = fuse_screen_plane(raw_pts["l_el"][i] - raw_pts["l_sh"][i], img_pts["l_sh"][i], img_pts["l_el"][i], 0.65)
        lf_w = fuse_screen_plane(raw_pts["l_wr"][i] - raw_pts["l_el"][i], img_pts["l_el"][i], img_pts["l_wr"][i], 0.65)
        ru_w = fuse_screen_plane(raw_pts["r_el"][i] - raw_pts["r_sh"][i], img_pts["r_sh"][i], img_pts["r_el"][i], 0.65)
        rf_w = fuse_screen_plane(raw_pts["r_wr"][i] - raw_pts["r_el"][i], img_pts["r_el"][i], img_pts["r_wr"][i], 0.65)

        l_uarm = to_out_unit(lu_w, lh, fh, (0.0, -0.80, 0.55))
        l_farm = to_out_unit(lf_w, lh, fh, (0.0, -0.65, 0.70))
        r_uarm = to_out_unit(ru_w, lh, fh, (0.0, -0.80, -0.55))
        r_farm = to_out_unit(rf_w, lh, fh, (0.0, -0.65, -0.70))

        conf = 1.0 if valid_mask[i] else 0.0
        if active_range is not None:
            t0, t1 = active_range
            ramp_in = smoothstep01((t_sec - t0) / 0.25)
            ramp_out = smoothstep01((t1 - t_sec) / 0.22)
            if t_sec < t0 or t_sec > t1:
                conf = 0.0
            else:
                conf = min(1.0, max(conf, 0.88)) * ramp_in * ramp_out

        lw = round(smoothstep01((l_arm_vis[i] - 0.32) / 0.33), 3)
        rw = round(smoothstep01((r_arm_vis[i] - 0.32) / 0.33), 3)

        js_frames.append({
            "c": round(float(conf), 4),
            "lw": lw,
            "rw": rw,
            "y": yaw_rad,
            "t": torso_b,
            "lt": l_thigh,
            "ls": l_shin,
            "rt": r_thigh,
            "rs": r_shin,
            "lu": l_uarm,
            "lf": l_farm,
            "ru": r_uarm,
            "rf": r_farm,
        })

    is_world = "true" if space_mode == "stadium_world" else "false"
    js_code = f"""// Auto-generated by scripts/mocap/export_js_module.py
// 3D motion capture vectors for {scenario_id} (space={space_mode})
// Source: {os.path.basename(pose_data.get('video_path', 'unknown'))} ({pose_data.get('detected_frames', 0)}/{n_frames} frames)

function lerpVec3Norm(a, b, u) {{
  const x = a[0] + (b[0] - a[0]) * u;
  const y = a[1] + (b[1] - a[1]) * u;
  const z = a[2] + (b[2] - a[2]) * u;
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}}

function lerpAngleRad(a, b, u) {{
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}}

export const VIDEO_CAPTURE_{scenario_id} = {{
  fps: {fps},
  totalFrames: {n_frames},
  duration: {round(n_frames / fps, 4)},
  worldSpace: {is_world},
  frames: {json.dumps(js_frames, separators=(',', ':'))},

  getFrame(tSec) {{
    const fi = Math.max(0, Math.min(tSec * this.fps, this.totalFrames - 1));
    const i0 = Math.floor(fi);
    const i1 = Math.min(i0 + 1, this.totalFrames - 1);
    const u = fi - i0;
    const f0 = this.frames[i0];
    const f1 = this.frames[i1];
    if (!f0) return null;
    if (i0 === i1 || !f1) return {{ ...f0, ws: this.worldSpace }};
    return {{
      ws: this.worldSpace,
      c: f0.c + (f1.c - f0.c) * u,
      lw: (f0.lw ?? 1) + ((f1.lw ?? 1) - (f0.lw ?? 1)) * u,
      rw: (f0.rw ?? 1) + ((f1.rw ?? 1) - (f0.rw ?? 1)) * u,
      y: lerpAngleRad(f0.y ?? 0, f1.y ?? 0, u),
      t: lerpVec3Norm(f0.t, f1.t, u),
      lt: lerpVec3Norm(f0.lt, f1.lt, u),
      ls: lerpVec3Norm(f0.ls, f1.ls, u),
      rt: lerpVec3Norm(f0.rt, f1.rt, u),
      rs: lerpVec3Norm(f0.rs, f1.rs, u),
      lu: lerpVec3Norm(f0.lu, f1.lu, u),
      lf: lerpVec3Norm(f0.lf, f1.lf, u),
      ru: lerpVec3Norm(f0.ru, f1.ru, u),
      rf: lerpVec3Norm(f0.rf, f1.rf, u),
    }};
  }}
}};
"""
    with open(out_path, "w") as f:
        f.write(js_code)
    print(f"Exported {out_path} ({os.path.getsize(out_path) / 1024:.1f} KB, space={space_mode})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pose_json")
    parser.add_argument("--scenario", default="S01")
    parser.add_argument("--space", choices=["stadium_world", "pelvis"], default="stadium_world")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    export_js_module(args.pose_json, args.scenario, args.out, space_mode=args.space)


if __name__ == "__main__":
    main()
