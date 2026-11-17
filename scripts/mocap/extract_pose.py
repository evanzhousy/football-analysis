#!/usr/bin/env python3
"""
Step 1: Square-ROI Target-Tracked 3D Pose Extraction (MediaPipe Heavy)
======================================================================
- Supports `--time-range start,end` for extracting a segment from a master HD reel
- Supports `--track "t:cx:cy:size,..."` keyframed square ROI tracking so MediaPipe
  always receives an exact 1:1 square crop (zero NORM_RECT aspect distortion!)
  centered on the target player.
- Maps normalized image landmarks back to full-frame [0..1] coordinates for QA overlay.
"""

import argparse
import json
import os
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks.python import vision as mp_vision
from mediapipe.tasks.python import BaseOptions

MODEL_PATH = os.path.join(os.path.dirname(__file__), "pose_landmarker_heavy.task")


def parse_track(track_str):
    if not track_str:
        return None
    keys = []
    for item in track_str.split(","):
        parts = [float(x) for x in item.strip().split(":")]
        if len(parts) != 4:
            raise ValueError(f"Invalid track key '{item}', expected t:cx:cy:size")
        keys.append(parts)
    keys.sort(key=lambda k: k[0])
    return keys


def sample_track(keys, t):
    if t <= keys[0][0]:
        return keys[0][1], keys[0][2], keys[0][3]
    if t >= keys[-1][0]:
        return keys[-1][1], keys[-1][2], keys[-1][3]
    for i in range(len(keys) - 1):
        t0, x0, y0, s0 = keys[i]
        t1, x1, y1, s1 = keys[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            u = u * u * (3 - 2 * u)
            return x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, s0 + (s1 - s0) * u
    return keys[-1][1], keys[-1][2], keys[-1][3]


def crop_square_with_padding(frame, cx, cy, size, out_res=384):
    h, w = frame.shape[:2]
    half = int(round(size / 2.0))
    S = half * 2
    x0 = int(round(cx)) - half
    y0 = int(round(cy)) - half
    x1 = x0 + S
    y1 = y0 + S

    pad_l = max(0, -x0)
    pad_t = max(0, -y0)
    pad_r = max(0, x1 - w)
    pad_b = max(0, y1 - h)

    if pad_l or pad_t or pad_r or pad_b:
        padded = cv2.copyMakeBorder(frame, pad_t, pad_b, pad_l, pad_r, cv2.BORDER_REPLICATE)
        crop = padded[y0 + pad_t : y1 + pad_t, x0 + pad_l : x1 + pad_l]
    else:
        crop = frame[y0:y1, x0:x1]

    resized = cv2.resize(crop, (out_res, out_res), interpolation=cv2.INTER_LANCZOS4)
    return resized, (x0, y0, S)


def extract_poses(video_path, roi=None, track_keys=None, time_range=None, active_range=None):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    total_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_video_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    start_sec = time_range[0] if time_range else 0.0
    end_sec = time_range[1] if time_range else (total_video_frames / fps)
    start_frame = int(round(start_sec * fps))
    end_frame = min(total_video_frames, int(round(end_sec * fps)))

    options = mp_vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.45,
        min_pose_presence_confidence=0.45,
        min_tracking_confidence=0.45,
        output_segmentation_masks=False,
    )
    landmarker = mp_vision.PoseLandmarker.create_from_options(options)

    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    frames_data = []
    local_idx = 0

    for vf_idx in range(start_frame, end_frame):
        ret, frame = cap.read()
        if not ret:
            break

        local_t = local_idx / fps
        timestamp_ms = int(round(local_idx * 1000.0 / fps))

        in_active = True
        if active_range is not None:
            in_active = active_range[0] <= local_t <= active_range[1]

        box = None
        if track_keys is not None:
            cx, cy, sz = sample_track(track_keys, local_t)
            sq_img, box = crop_square_with_padding(frame, cx, cy, sz, out_res=384)
        elif roi is not None:
            rx, ry, rw, rh = roi
            cx, cy, sz = rx + rw * 0.5, ry + rh * 0.5, max(rw, rh)
            sq_img, box = crop_square_with_padding(frame, cx, cy, sz, out_res=384)
        else:
            cx, cy, sz = total_w * 0.5, total_h * 0.5, max(total_w, total_h)
            sq_img, box = crop_square_with_padding(frame, cx, cy, sz, out_res=384)

        frame_entry = {
            "frame_idx": local_idx,
            "timestamp_sec": round(local_t, 6),
            "crop_box": list(box),
            "landmarks_world": None,
            "landmarks_image": None,
        }

        if in_active:
            rgb = cv2.cvtColor(sq_img, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            if result.pose_world_landmarks and len(result.pose_world_landmarks) > 0:
                world_lm = []
                for lm in result.pose_world_landmarks[0]:
                    world_lm.append([
                        round(lm.x, 6),
                        round(lm.y, 6),
                        round(lm.z, 6),
                        round(lm.visibility, 4),
                    ])
                frame_entry["landmarks_world"] = world_lm

            if result.pose_landmarks and len(result.pose_landmarks) > 0:
                x0, y0, S = box
                img_lm = []
                for lm in result.pose_landmarks[0]:
                    fx = (x0 + lm.x * S) / total_w
                    fy = (y0 + lm.y * S) / total_h
                    img_lm.append([
                        round(fx, 6),
                        round(fy, 6),
                        round(lm.z, 6),
                        round(lm.visibility, 4),
                    ])
                frame_entry["landmarks_image"] = img_lm

        frames_data.append(frame_entry)
        local_idx += 1

    landmarker.close()
    cap.release()

    detected = sum(1 for f in frames_data if f["landmarks_world"])
    print(f"Done: {detected}/{len(frames_data)} frames detected ({detected / max(1, len(frames_data)) * 100:.1f}%)")
    return {
        "video_path": os.path.abspath(video_path),
        "fps": fps,
        "width": total_w,
        "height": total_h,
        "time_range": time_range,
        "active_range": active_range,
        "total_frames": len(frames_data),
        "detected_frames": detected,
        "frames": frames_data,
    }


def main():
    parser = argparse.ArgumentParser(description="Square-ROI target-tracked 3D pose extraction")
    parser.add_argument("video", help="Input video path")
    parser.add_argument("--roi", type=str, default=None, help="Static ROI x,y,w,h")
    parser.add_argument("--track", type=str, default=None, help="Keyframed square track t:cx:cy:size,...")
    parser.add_argument("--time-range", type=str, default=None, help="Video segment start,end in seconds")
    parser.add_argument("--active-range", type=str, default=None, help="Active target visibility start,end in local seconds")
    parser.add_argument("--out", type=str, default=None, help="Output JSON path")
    args = parser.parse_args()

    roi = [int(x) for x in args.roi.split(",")] if args.roi else None
    track_keys = parse_track(args.track)
    time_range = [float(x) for x in args.time_range.split(",")] if args.time_range else None
    active_range = [float(x) for x in args.active_range.split(",")] if args.active_range else None

    out_path = args.out or os.path.splitext(args.video)[0] + "_pose.json"
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    result = extract_poses(args.video, roi=roi, track_keys=track_keys, time_range=time_range, active_range=active_range)
    with open(out_path, "w") as f:
        json.dump(result, f)
    print(f"Saved: {out_path} ({os.path.getsize(out_path) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
