const BABYLON = window.BABYLON;

/**
 * Official Adobe Mixamo《Soccer Pack》& Locomotion Library (32 FK-Grounded 65-Bone Clips)
 * - 100% same-skeleton Mixamo standard (`mixamorig:Hips` -> 65 joints)
 * - Zero cross-skeleton retargeting distortion; exact FK boot-sole turf grounding
 */
export const MOCAP_CATALOG = [
  // 1. Stance & Ball Idle (Official Mixamo Soccer Pack)
  { id: 'idle_ready', category: '足球待命站姿', label: '进攻接球备战站姿 (Offensive Soccer Idle)', file: 'idle_ready.glb', loop: true },
  { id: 'idle_scan', category: '足球待命站姿', label: '脚下踩球观察扫描 (Playing With Ball Idle)', file: 'idle_scan.glb', loop: true },
  { id: 'soccer_receive_chest', category: '足球待命站姿', label: '胸部/迎球停球卸球 (Soccer Receive)', file: 'soccer_receive_chest.glb', loop: false },

  // 2. Dribbling & Locomotion (Official Mixamo Soccer Pack + Locomotion)
  { id: 'walk_fwd', category: '盘带与推进', label: 'La Pausa 慢速控球推步 (Standard Walk)', file: 'walk_fwd.glb', loop: true },
  { id: 'walk_back', category: '盘带与推进', label: '背身回撤接应步 (Backward Walk)', file: 'walk_back.glb', loop: true },
  { id: 'walk_strafe_l', category: '盘带与推进', label: '左侧向拉开接球步 (Soccer Strafe Left)', file: 'walk_strafe_l.glb', loop: true },
  { id: 'walk_strafe_r', category: '盘带与推进', label: '右侧向拉开接球步 (Soccer Strafe Right)', file: 'walk_strafe_r.glb', loop: true },
  { id: 'jog_fwd', category: '盘带与推进', label: '中速盘带持球推进 (Forward Jog Dribbling Ball)', file: 'jog_fwd.glb', loop: true },
  { id: 'jog_back', category: '盘带与推进', label: '中速且战且退封堵 (Soccer Jog Backward)', file: 'jog_back.glb', loop: true },
  { id: 'jog_strafe_l', category: '盘带与推进', label: '左斜前顺球推进 (Soccer Jog Diag Fwd L)', file: 'jog_strafe_l.glb', loop: true },
  { id: 'jog_strafe_r', category: '盘带与推进', label: '右斜前顺球推进 (Soccer Jog Diag Fwd R)', file: 'jog_strafe_r.glb', loop: true },
  { id: 'sprint_fwd', category: '盘带与推进', label: '摆脱后爆发全速冲刺 (Standard Sprint)', file: 'sprint_fwd.glb', loop: true },
  { id: 'sprint_back', category: '盘带与推进', label: '高速回追退防 (Running Backwards)', file: 'sprint_back.glb', loop: true },
  { id: 'sprint_cut_l', category: '盘带与推进', label: '高速趟球前插突刺 (Jogging & Kicking Ball Fwd)', file: 'sprint_cut_l.glb', loop: true },
  { id: 'sprint_cut_r', category: '盘带与推进', label: '高速足球无球前插 (Soccer Jog Forward)', file: 'sprint_cut_r.glb', loop: true },

  // 3. Pressing, Shielding & Slide Tackles (Official Mixamo Soccer Pack)
  { id: 'crouch_jockey_fwd', category: '护球与滑铲逼抢', label: '低重心防守卡位站姿 (Low Stance Jockey)', file: 'crouch_jockey_fwd.glb', loop: true },
  { id: 'crouch_jockey_back', category: '护球与滑铲逼抢', label: '低重心斜退封堵 (Soccer Jog Diag Back)', file: 'crouch_jockey_back.glb', loop: true },
  { id: 'crouch_strafe_l', category: '护球与滑铲逼抢', label: '左侧向低重心滑步虚晃 (Lateral Shuffle L)', file: 'crouch_strafe_l.glb', loop: true },
  { id: 'crouch_strafe_r', category: '护球与滑铲逼抢', label: '右侧向低重心滑步虚晃 (Lateral Shuffle R)', file: 'crouch_strafe_r.glb', loop: true },
  { id: 'soccer_turf_hand_shield', category: '护球与滑铲逼抢', label: '倒地单手撑草皮护球起身 (Standing Up From Soccer Fall)', file: 'soccer_turf_hand_shield.glb', loop: false },
  { id: 'soccer_slide_tackle', category: '护球与滑铲逼抢', label: '飞身倒地滑铲封堵 (Soccer Slide Tackle)', file: 'soccer_slide_tackle.glb', loop: false },

  // 4. Turns, Cuts, Feints & Marseille Roulette (Official Mixamo Soccer Pack)
  { id: 'soccer_half_turn_180', category: '转身变向与回旋', label: '背身半转身 180° 顺球 (180° Stride Pivot)', file: 'soccer_half_turn_180.glb', loop: false },
  { id: 'soccer_crossover_feint', category: '转身变向与回旋', label: '停球高频双脚触球油炸丸子 (Receive & Play With Ball)', file: 'soccer_crossover_feint.glb', loop: false },
  { id: 'soccer_cut_left_90', category: '转身变向与回旋', label: '急停左内扣 90° 变向 (90° Left Cut)', file: 'soccer_cut_left_90.glb', loop: false },
  { id: 'soccer_cut_right_90', category: '转身变向与回旋', label: '急停右扣球 90° 变向 (90° Right Cut)', file: 'soccer_cut_right_90.glb', loop: false },
  { id: 'soccer_roulette_360', category: '转身变向与回旋', label: '官方马赛回旋 360° 拉球转身 (Soccer 360 Spin)', file: 'soccer_roulette_360.glb', loop: false },

  // 5. Passing, Through-Balls, Shooting & Goalkeeper Saves (Official Mixamo Soccer Pack)
  { id: 'soccer_pass_inside', category: '传射与门将扑救', label: '脚内侧精准推传 (Soccer Pass From Idle)', file: 'soccer_pass_inside.glb', loop: false },
  { id: 'soccer_through_ball', category: '传射与门将扑救', label: '行进间直塞触球出球 (Stride Through-Ball Kick)', file: 'soccer_through_ball.glb', loop: false },
  { id: 'soccer_shot_drive', category: '传射与门将扑救', label: '大力低平球抽射远角 (Driven Long Strike)', file: 'soccer_shot_drive.glb', loop: false },
  { id: 'soccer_power_kick', category: '传射与门将扑救', label: '高扬腿假射蓄力/挑传摆腿 (Soccer Kick Windup)', file: 'soccer_power_kick.glb', loop: false },
  { id: 'gk_dive_left', category: '传射与门将扑救', label: '门将向左侧飞身鱼跃扑救 (GK Left Diving Save)', file: 'gk_dive_left.glb', loop: false },
  { id: 'gk_dive_right', category: '传射与门将扑救', label: '门将向右侧倒地封堵扑救 (GK Right Body Block)', file: 'gk_dive_right.glb', loop: false }
];

const clipCache = new Map();
let loadPromise = null;

/**
 * Preloads all 32 official Mixamo《Soccer Pack》animation GLBs into fast indexed track maps.
 */
export function preloadMixamoSoccerLibrary(scene, onProgress) {
  if (loadPromise) return loadPromise;

  let completed = 0;
  const total = MOCAP_CATALOG.length;

  loadPromise = Promise.all(
    MOCAP_CATALOG.map(async (entry) => {
      try {
        const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
          './assets/mocap_mixamo/',
          entry.file,
          scene
        );
        const ag = container.animationGroups[0];
        if (ag) {
          const rotMap = new Map();
          let hipsPosAnim = null;
          let fps = 60;

          for (const ta of ag.targetedAnimations) {
            const boneName = ta.target.name;
            const prop = ta.animation.targetProperty;
            fps = ta.animation.framePerSecond || 60;
            if (prop === 'rotationQuaternion') {
              rotMap.set(boneName, ta.animation);
            } else if (prop === 'position' && boneName === 'mixamorig:Hips') {
              hipsPosAnim = ta.animation;
            }
          }

          const duration = Math.max(0.1, (ag.to - ag.from) / fps);
          clipCache.set(entry.id, {
            id: entry.id,
            meta: entry,
            from: ag.from,
            to: ag.to,
            fps,
            duration,
            loop: entry.loop,
            rotMap,
            hipsPosAnim,
            container
          });
        }
      } catch (err) {
        console.warn(`Failed to load Mixamo Soccer clip ${entry.file}:`, err);
      } finally {
        completed += 1;
        if (onProgress) onProgress(completed, total, entry);
      }
    })
  ).then(() => clipCache);

  return loadPromise;
}

export function getMixamoClip(id) {
  return clipCache.get(id) || clipCache.get('idle_ready') || null;
}

export function getMocapMeta(id) {
  const found = MOCAP_CATALOG.find((x) => x.id === id);
  return found || MOCAP_CATALOG[0];
}

export function getMocapDuration(id) {
  const c = getMixamoClip(id);
  return c ? c.duration : 2.0;
}
