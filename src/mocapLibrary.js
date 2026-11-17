import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Common Football Optical Motion-Capture Library (28 Uniform 67-Bone Clips)
 * - 18 Studio Mocap Locomotion & Pressing Clips (ReadyPlayerMe Studio Library)
 * - 10 Retargeted 120Hz Vicon Soccer Technical Clips (CMU Optical Mocap + Turf Shield)
 */
export const MOCAP_CATALOG = [
  // 1. Stance & Scanning
  { id: 'idle_ready', category: '站姿观察', label: '接球备战站姿 (Athletic Ready)', file: 'idle_ready.glb', loop: true },
  { id: 'idle_scan', category: '站姿观察', label: '回头观察扫描 (Pre-Scan Idle)', file: 'idle_scan.glb', loop: true },

  // 2. Carry & Support Locomotion
  { id: 'walk_fwd', category: '控球推进', label: 'La Pausa 慢速控球推步 (Walk Carry)', file: 'walk_fwd.glb', loop: true },
  { id: 'walk_back', category: '控球推进', label: '背身回撤接应 (Check-In Backpedal)', file: 'walk_back.glb', loop: true },
  { id: 'walk_strafe_l', category: '控球推进', label: '左侧向拉开接球 (Open-Hip Left)', file: 'walk_strafe_l.glb', loop: true },
  { id: 'walk_strafe_r', category: '控球推进', label: '右侧向拉开接球 (Open-Hip Right)', file: 'walk_strafe_r.glb', loop: true },
  { id: 'jog_fwd', category: '控球推进', label: '中速持球推进 (Controlled Dribble Jog)', file: 'jog_fwd.glb', loop: true },
  { id: 'jog_back', category: '控球推进', label: '中速且战且退封堵 (Contain Retreat)', file: 'jog_back.glb', loop: true },
  { id: 'jog_strafe_l', category: '控球推进', label: '左横拨顺球滑步 (Lateral Glide L)', file: 'jog_strafe_l.glb', loop: true },
  { id: 'jog_strafe_r', category: '控球推进', label: '右横拨顺球滑步 (Lateral Glide R)', file: 'jog_strafe_r.glb', loop: true },
  { id: 'sprint_fwd', category: '控球推进', label: '摆脱后爆发冲刺 (Explosive Burst)', file: 'sprint_fwd.glb', loop: true },
  { id: 'sprint_back', category: '控球推进', label: '高速回追防守 (Recovery Sprint Back)', file: 'sprint_back.glb', loop: true },
  { id: 'sprint_cut_l', category: '控球推进', label: '高速左斜向突刺 (Diagonal Burst L)', file: 'sprint_cut_l.glb', loop: true },
  { id: 'sprint_cut_r', category: '控球推进', label: '高速右斜向突刺 (Diagonal Burst R)', file: 'sprint_cut_r.glb', loop: true },

  // 3. Low-COG Shielding & Defensive Jockeying
  { id: 'crouch_jockey_fwd', category: '护球逼抢', label: '降重心卡位上抢 (Low-COG Press)', file: 'crouch_jockey_fwd.glb', loop: true },
  { id: 'crouch_jockey_back', category: '护球逼抢', label: '低重心退防踉跄 (Low Jockey Retreat)', file: 'crouch_jockey_back.glb', loop: true },
  { id: 'crouch_strafe_l', category: '护球逼抢', label: '左沉肩虚晃降重心 (Shoulder Feint L)', file: 'crouch_strafe_l.glb', loop: true },
  { id: 'crouch_strafe_r', category: '护球逼抢', label: '右沉肩虚晃降重心 (Shoulder Feint R)', file: 'crouch_strafe_r.glb', loop: true },
  { id: 'soccer_turf_hand_shield', category: '护球逼抢', label: '倒地单手撑草皮护球起身 (Turf Hand Shield)', file: 'soccer_turf_hand_shield.glb', loop: false },

  // 4. Cuts, Turns, Feints & Roulette (120Hz Vicon Retargeted)
  { id: 'soccer_half_turn_180', category: '转身摆脱', label: '120Hz 背身半转身顺球 (Half-Turn Pivot)', file: 'soccer_half_turn_180.glb', loop: false },
  { id: 'soccer_crossover_feint', category: '转身摆脱', label: '120Hz 油炸丸子双触变向 (La Croqueta Crossover)', file: 'soccer_crossover_feint.glb', loop: false },
  { id: 'soccer_cut_left_90', category: '转身摆脱', label: '120Hz 急停左内扣 90° (Sharp Cut Left)', file: 'soccer_cut_left_90.glb', loop: false },
  { id: 'soccer_cut_right_90', category: '转身摆脱', label: '120Hz 急停右扣球 90° (Sharp Cut Right)', file: 'soccer_cut_right_90.glb', loop: false },
  { id: 'soccer_roulette_360', category: '转身摆脱', label: '120Hz 马赛回旋拉球步 (360° Roulette Footwork)', file: 'soccer_roulette_360.glb', loop: false },

  // 5. Passing, Through-Balls & Shooting (120Hz Vicon Soccer)
  { id: 'soccer_pass_inside', category: '传射出球', label: '120Hz 脚内侧精准推传 (Inside-Foot Pass)', file: 'soccer_pass_inside.glb', loop: false },
  { id: 'soccer_through_ball', category: '传射出球', label: '120Hz 手术刀直塞触球 (Through-Ball Strike)', file: 'soccer_through_ball.glb', loop: false },
  { id: 'soccer_shot_drive', category: '传射出球', label: '120Hz 低平球推射远角 (Low Driven Finish)', file: 'soccer_shot_drive.glb', loop: false },
  { id: 'soccer_power_kick', category: '传射出球', label: '120Hz 大力摆腿抽射/假射蓄力 (Power Windup)', file: 'soccer_power_kick.glb', loop: false }
];

const clipCache = new Map();
let libraryLoadPromise = null;

/**
 * Sanitizes a raw GLTF AnimationClip for clean in-place mixing on the 67-bone footballer rig:
 * - Preserves all 60+ quaternion rotation tracks (including fingers & toes).
 * - Preserves vertical Hips.position.y bounce/crouch while damping horizontal root drift
 *   so world-space trajectory follows the exact match video coordinates without double-translation.
 * - Drops non-Hips translation/scale tracks to avoid bone-length distortion during crossfades.
 */
function sanitizeClipForInPlaceMixing(rawClip, id) {
  const keptTracks = [];

  for (const track of rawClip.tracks) {
    const dotIdx = track.name.lastIndexOf('.');
    if (dotIdx === -1) continue;
    const nodePart = track.name.slice(0, dotIdx);
    const prop = track.name.slice(dotIdx + 1);
    const boneName = nodePart.split('/').pop();

    if (prop === 'quaternion') {
      const cloned = track.clone();
      cloned.name = `${boneName}.quaternion`;
      keptTracks.push(cloned);
    } else if (prop === 'position' && boneName === 'Hips') {
      const vals = Float32Array.from(track.values);
      // Anchor initial X/Z to 0 and keep subtle 15% weight-transfer sway + 100% vertical pelvis height
      const x0 = vals[0];
      const z0 = vals[2];
      for (let i = 0; i < vals.length; i += 3) {
        vals[i] = (vals[i] - x0) * 0.15;
        vals[i + 2] = (vals[i + 2] - z0) * 0.15;
      }
      keptTracks.push(new THREE.VectorKeyframeTrack('Hips.position', Float32Array.from(track.times), vals));
    }
  }

  return new THREE.AnimationClip(id, rawClip.duration, keptTracks);
}

export function preloadMocapLibrary(onProgress) {
  if (libraryLoadPromise) return libraryLoadPromise;

  const loader = new GLTFLoader();
  let completed = 0;
  const total = MOCAP_CATALOG.length;

  libraryLoadPromise = Promise.all(
    MOCAP_CATALOG.map(
      (entry) =>
        new Promise((resolve) => {
          loader.load(
            `./assets/mocap_lib/${entry.file}`,
            (gltf) => {
              if (gltf.animations && gltf.animations.length > 0) {
                const cleanClip = sanitizeClipForInPlaceMixing(gltf.animations[0], entry.id);
                clipCache.set(entry.id, {
                  clip: cleanClip,
                  meta: entry
                });
              }
              completed += 1;
              if (onProgress) onProgress(completed, total, entry);
              resolve();
            },
            undefined,
            (err) => {
              console.warn(`Failed to load mocap clip ${entry.file}:`, err);
              completed += 1;
              if (onProgress) onProgress(completed, total, entry);
              resolve();
            }
          );
        })
    )
  ).then(() => clipCache);

  return libraryLoadPromise;
}

export function getMocapClip(id) {
  const entry = clipCache.get(id) || clipCache.get('idle_ready');
  return entry ? entry.clip : null;
}

export function getMocapMeta(id) {
  const entry = clipCache.get(id);
  return entry ? entry.meta : MOCAP_CATALOG[0];
}

export function isMocapLibraryReady() {
  return clipCache.size >= 20;
}
