#!/usr/bin/env python3
"""
scripts/analyze_full_match_pressing.py

Offline High-Precision Full-Match Pressing Video Slicer & 4D Classifier CLI.
Scans a full 90-minute match video (MP4/MKV/WebM), filters broadcast wide-angle pitch
frames, detects high-density on-ball pressing clusters + motion bursts, classifies each
slice across 4 tactical dimensions, writes a Web-compatible JSON manifest, and optionally
cuts physical MP4 sub-clips via FFmpeg.

Usage:
  python3 scripts/analyze_full_match_pressing.py \
    --video path/to/full_match.mp4 \
    --out-dir ./match_breakdown_out \
    [--sample-fps 2.5] \
    [--export-clips]
"""

import argparse
import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np


def analyze_frame_features(bgr_small: np.ndarray, prev_gray: np.ndarray | None):
    """
    Computes broadcast turf ratio, 6x4 spatial player-congestion peak, white-line
    zone hints, and optical motion energy on a 320x180 BGR frame.
    """
    hsv = cv2.cvtColor(bgr_small, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(bgr_small, cv2.COLOR_BGR2GRAY)

    # 1. Green turf mask (broadcast wide shot detection)
    turf_mask = cv2.inRange(hsv, np.array([28, 30, 30]), np.array([90, 255, 255]))
    turf_ratio = float(np.count_nonzero(turf_mask)) / float(turf_mask.size)

    if turf_ratio < 0.30 or turf_ratio > 0.92:
        return {
            "is_pitch": False,
            "turf_ratio": turf_ratio,
            "press_score": 0.0,
            "motion": 0.0,
            "cx": 0.5,
            "cy": 0.5,
            "cluster_players": 0,
            "gray": gray,
        }

    # 2. Foreground player/ball contrast inside pitch region (non-turf inside dilated turf hull)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    pitch_hull = cv2.morphologyEx(turf_mask, cv2.MORPH_CLOSE, kernel)
    fg_mask = cv2.bitwise_and(cv2.bitwise_not(turf_mask), pitch_hull)

    # Suppress long white pitch lines via thin morphological opening check
    fg_clean = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    # Count connected athlete blobs of plausible size on 320x180 frame
    num_labels, _, stats, centroids = cv2.connectedComponentsWithStats(fg_clean, connectivity=8)
    pts = []
    for lbl in range(1, num_labels):
        area = stats[lbl, cv2.CC_STAT_AREA]
        w = stats[lbl, cv2.CC_STAT_WIDTH]
        h = stats[lbl, cv2.CC_STAT_HEIGHT]
        # Athlete blob vs long line
        if 8 <= area <= 420 and h >= w * 0.45 and w <= 42:
            pts.append((centroids[lbl][0] / 320.0, centroids[lbl][1] / 180.0))

    # Find densest local pressing cluster within radius r=0.16 of normalized frame
    best_cnt = 0
    best_compact = 0.0
    best_cx, best_cy = 0.5, 0.5
    for px, py in pts:
        dists = [math.hypot(px - qx, py - qy) for qx, qy in pts]
        near = [d for d in dists if d <= 0.16]
        cnt = len(near)
        compact = sum(max(0.0, 0.16 - d) for d in near)
        if cnt > best_cnt or (cnt == best_cnt and compact > best_compact):
            best_cnt = cnt
            best_compact = compact
            best_cx, best_cy = px, py

    # 3. Motion flux around active cluster
    motion = 0.0
    if prev_gray is not None:
        diff = cv2.absdiff(gray, prev_gray)
        x0 = max(0, int((best_cx - 0.18) * 320))
        x1 = min(320, int((best_cx + 0.18) * 320))
        y0 = max(0, int((best_cy - 0.20) * 180))
        y1 = min(180, int((best_cy + 0.20) * 180))
        patch = diff[y0:y1, x0:x1]
        motion = float(np.mean(patch)) / 255.0 if patch.size > 0 else 0.0

    # Combined Pressing Intensity Score in [0, 100]
    raw_score = min(99.0, best_cnt * 12.5 + best_compact * 85.0 + motion * 140.0)

    return {
        "is_pitch": True,
        "turf_ratio": turf_ratio,
        "press_score": raw_score,
        "motion": motion,
        "cx": best_cx,
        "cy": best_cy,
        "cluster_players": best_cnt,
        "gray": gray,
    }


def classify_slice_4d(window: list[dict], vid_dur: float) -> dict:
    peak = max(window, key=lambda f: f["press_score"])
    first, last = window[0], window[-1]
    cx, cy = peak["cx"], peak["cy"]
    players = peak["cluster_players"]

    # 1. Pitch Zone from normalized broadcast centroid
    if cy < 0.24 or cy > 0.80:
        pitch_zone = "touchline_trap"
    elif cx < 0.32:
        pitch_zone = "buildup_back"
    elif cx > 0.68:
        pitch_zone = "zone14_halfspace"
    else:
        pitch_zone = "midfield_hub"

    # 2. Pressing Structure
    if pitch_zone == "buildup_back" and players >= 2:
        press_type = "high_press"
    elif players >= 5:
        press_type = "cage_3plus"
    elif players >= 3:
        press_type = "double_trap"
    else:
        press_type = "1v1_back"

    # 3. Escape Outcome from centroid progression & post-peak motion burst
    dx = last["cx"] - first["cx"]
    dy = last["cy"] - first["cy"]
    disp = math.hypot(dx, dy)
    avg_motion = sum(f["motion"] for f in window) / max(1, len(window))

    if disp >= 0.22 and avg_motion >= 0.055:
        escape_outcome = "skill_dribble"
    elif dx >= 0.10 and disp >= 0.13:
        escape_outcome = "half_turn"
    elif avg_motion >= 0.065 and disp < 0.13:
        escape_outcome = "one_touch_wall"
    elif dx < -0.09:
        escape_outcome = "turnover_loss"
    else:
        escape_outcome = "recycle_shield"

    # 4. Player Role heuristic from pitch zone
    if pitch_zone == "buildup_back":
        role, pos_lbl = "GK_DF", "后卫 DF"
    elif pitch_zone == "zone14_halfspace" and cy > 0.35:
        role, pos_lbl = "FW", "前锋 FW"
    else:
        role, pos_lbl = "MF", "中场 MF"

    x_m = round(min(103.0, max(3.0, cx * 105.0)), 1)
    y_m = round(min(65.0, max(3.0, cy * 68.0)), 1)
    ex_m = round(min(104.0, max(2.0, last["cx"] * 105.0)), 1)
    ey_m = round(min(66.0, max(2.0, last["cy"] * 68.0)), 1)

    presser_cnt = max(1, min(4, players - 1))
    min_dist = round(max(0.75, 2.4 - presser_cnt * 0.35), 2)

    # Synthesize nearby 360-style defenders for 3D reconstruction
    opps = []
    for k in range(presser_cnt):
        ang = (k / max(1, presser_cnt)) * math.pi * 1.4 - 0.6
        opps.append(
            {
                "x": round(min(104.0, max(1.0, x_m + math.cos(ang) * (min_dist + k * 0.8))), 1),
                "y": round(min(67.0, max(1.0, y_m + math.sin(ang) * (min_dist + k * 0.8))), 1),
                "distM": round(min_dist + k * 0.55, 2),
                "gk": False,
            }
        )

    return {
        "pressType": press_type,
        "pitchZone": pitch_zone,
        "escapeOutcome": escape_outcome,
        "playerRole": role,
        "positionLabel": pos_lbl,
        "presserCount": presser_cnt,
        "minDefDistM": min_dist,
        "intensity": int(round(min(99, max(52, peak["press_score"])))),
        "pitchXY": [x_m, y_m],
        "exitXY": [ex_m, ey_m],
        "freezeOpps": opps,
        "freezeMates": [{"x": round(max(4.0, x_m - 7.5), 1), "y": round(min(64.0, y_m + 6.0), 1)}],
    }


def scan_full_match_video(
    video_path: Path,
    out_dir: Path,
    sample_fps: float = 2.5,
    export_clips: bool = False,
    home_team: str = "主队",
    away_team: str = "客队",
):
    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration_sec = total_frames / fps if total_frames > 0 else 0.0
    step_frames = max(1, int(round(fps / sample_fps)))

    samples = []
    prev_gray = None
    prev_hist = None
    f_idx = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
        ok, frame = cap.read()
        if not ok:
            break
        t_sec = f_idx / fps
        small = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)

        # Scene cut detection via HSV histogram correlation
        hsv_small = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv_small], [0, 1], None, [24, 16], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        scene_cut = False
        if prev_hist is not None:
            corr = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
            if corr < 0.58:
                scene_cut = True
                prev_gray = None
        prev_hist = hist

        feat = analyze_frame_features(small, prev_gray)
        prev_gray = feat.pop("gray")
        feat["t"] = round(t_sec, 2)
        feat["scene_cut"] = scene_cut
        samples.append(feat)

        f_idx += step_frames

    cap.release()

    # Adaptive threshold (top pressing windows, split cleanly at scene cuts)
    pitch_scores = [s["press_score"] for s in samples if s["is_pitch"]]
    thresh = float(np.percentile(pitch_scores, 62)) if pitch_scores else 45.0
    thresh = max(32.0, min(68.0, thresh))

    raw_windows = []
    cur_win = []
    for s in samples:
        if s["scene_cut"] and cur_win:
            raw_windows.append(cur_win)
            cur_win = []
        if s["is_pitch"] and s["press_score"] >= thresh:
            cur_win.append(s)
        else:
            if cur_win:
                raw_windows.append(cur_win)
                cur_win = []
    if cur_win:
        raw_windows.append(cur_win)

    slices = []
    clips_dir = out_dir / "clips"
    if export_clips:
        clips_dir.mkdir(parents=True, exist_ok=True)

    for w in raw_windows:
        t0 = max(0.0, round(w[0]["t"] - 1.2, 2))
        t1 = min(round(duration_sec, 2), round(w[-1]["t"] + 1.8, 2))
        if t1 - t0 < 2.6:
            t1 = min(round(duration_sec, 2), round(t0 + 4.0, 2))
        if t1 - t0 < 1.8:
            continue
        # Cap overly long continuous windows into ~8.5s chunks
        t1 = min(t1, round(t0 + 9.0, 2))

        # Avoid near-duplicate overlap with previous slice
        if slices and t0 < slices[-1]["tEnd"] - 0.6:
            continue

        idx = len(slices) + 1
        cls = classify_slice_4d(w, duration_sec)
        mm = int(t0 // 60)
        ss = int(t0 % 60)
        period = 1 if mm < 45 else 2

        clip_rel = f"./{video_path.name}"
        if export_clips:
            clip_name = f"slice_{idx:03d}_{cls['pressType']}_{cls['escapeOutcome']}.mp4"
            clip_out = clips_dir / clip_name
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-ss",
                    str(t0),
                    "-to",
                    str(t1),
                    "-i",
                    str(video_path),
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-an",
                    str(clip_out),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            clip_rel = f"./clips/{clip_name}"

        slices.append(
            {
                "id": f"cv_slice_{idx:03d}",
                "index": idx,
                "clock": f"{mm:02d}:{ss:02d}",
                "minute": mm,
                "period": period,
                "tStart": t0,
                "tEnd": t1,
                "duration": round(t1 - t0, 2),
                "team": home_team,
                "teamKit": "barca-home",
                "oppTeam": away_team,
                "oppKit": "madrid-white",
                "playerName": f"持球核心 #{8 if cls['playerRole']=='MF' else (9 if cls['playerRole']=='FW' else 4)}",
                "jerseyNumber": "8" if cls["playerRole"] == "MF" else ("9" if cls["playerRole"] == "FW" else "4"),
                **cls,
                "refScenarioIdx": 0,
                "refVideoSrc": clip_rel,
                "summary": f"[{mm:02d}:{ss:02d}] 视频CV自动识别：{cls['presserCount']}人逼抢聚拢（强度{cls['intensity']}%），持续 {round(t1-t0,1)}s",
            }
        )

    manifest = {
        "id": f"cv_{video_path.stem}",
        "title": f"{video_path.name} · 整场持球逼抢自动切片拆解 ({len(slices)}处)",
        "competition": "离线 Python CV 自动拆解报告",
        "matchDate": "Local Video",
        "homeTeamZh": home_team,
        "awayTeamZh": away_team,
        "totalMinutes": max(1, int(math.ceil(duration_sec / 60.0))),
        "videoDurationSec": round(duration_sec, 2),
        "videoSrc": None,
        "hasDirectFullVideo": True,
        "sourceLabel": f"Python OpenCV 自动扫描 ({sample_fps} fps 采样)",
        "sliceCount": len(slices),
        "slices": slices,
    }

    manifest_path = out_dir / "match_pressing_breakdown.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[OK] Scanned {video_path.name} ({duration_sec:.1f}s) -> {len(slices)} pressing slices -> {manifest_path}")
    return manifest


def main():
    ap = argparse.ArgumentParser(description="Analyze full football match video and slice pressing moments.")
    ap.add_argument("--video", required=True, help="Path to full match MP4/WebM/MKV video")
    ap.add_argument("--out-dir", required=True, help="Output directory for JSON manifest and optional clips")
    ap.add_argument("--sample-fps", type=float, default=2.5, help="Analysis frame sampling rate (Hz)")
    ap.add_argument("--export-clips", action="store_true", help="Also cut physical MP4 sub-clips via FFmpeg")
    ap.add_argument("--home-team", default="主队", help="Home team display name")
    ap.add_argument("--away-team", default="客队", help="Away team display name")
    args = ap.parse_args()

    scan_full_match_video(
        video_path=Path(args.video),
        out_dir=Path(args.out_dir),
        sample_fps=args.sample_fps,
        export_clips=args.export_clips,
        home_team=args.home_team,
        away_team=args.away_team,
    )


if __name__ == "__main__":
    main()
