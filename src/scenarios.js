function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep01(u) {
  const t = clamp01(u);
  return t * t * (3 - 2 * t);
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

const CROSSFADE_SEC = 0.26;

/**
 * Samples piecewise keyframe track in real seconds `tSec`.
 */
function sampleSpatialKeyframes(keyframes, tSec) {
  if (!keyframes || keyframes.length === 0) {
    return { x: 0, y: 0.115, z: 0, yaw: 0, crouch: 0, scanYaw: 0, shieldSide: null, showShadow: true };
  }
  if (tSec <= keyframes[0].t) {
    const k = keyframes[0];
    return {
      x: k.x,
      y: k.y ?? 0.115,
      z: k.z,
      yaw: k.yaw ?? 0,
      crouch: k.crouch ?? 0,
      scanYaw: k.scanYaw ?? 0,
      shieldSide: k.shieldSide ?? null,
      leanRollOffset: k.leanRoll ?? 0,
      showShadow: k.showShadow !== false
    };
  }
  const last = keyframes[keyframes.length - 1];
  if (tSec >= last.t) {
    return {
      x: last.x,
      y: last.y ?? 0.115,
      z: last.z,
      yaw: last.yaw ?? 0,
      crouch: last.crouch ?? 0,
      scanYaw: last.scanYaw ?? 0,
      shieldSide: last.shieldSide ?? null,
      leanRollOffset: last.leanRoll ?? 0,
      showShadow: last.showShadow !== false
    };
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    if (tSec >= k0.t && tSec <= k1.t) {
      const dt = Math.max(0.0001, k1.t - k0.t);
      const rawU = (tSec - k0.t) / dt;
      const u = k1.ease === 'linear' ? rawU : smoothstep01(rawU);

      const x = lerp(k0.x, k1.x, u);
      const z = lerp(k0.z, k1.z, u);
      let y = lerp(k0.y ?? 0.115, k1.y ?? 0.115, u);
      if (k1.arcY) {
        y += Math.sin(rawU * Math.PI) * k1.arcY;
      }

      const dx = k1.x - k0.x;
      const dz = k1.z - k0.z;
      const dist = Math.hypot(dx, dz);
      const autoYaw = dist > 0.08 ? Math.atan2(dx, dz) : k0.yaw ?? 0;

      let yaw;
      if (k0.yaw !== undefined && k1.yaw !== undefined) {
        yaw = k1.rawYaw ? lerp(k0.yaw, k1.yaw, u) : lerpAngle(k0.yaw, k1.yaw, u);
      } else {
        yaw = autoYaw;
      }

      return {
        x,
        y,
        z,
        yaw,
        crouch: lerp(k0.crouch ?? 0, k1.crouch ?? 0, u),
        scanYaw: lerp(k0.scanYaw ?? 0, k1.scanYaw ?? 0, u),
        shieldSide: rawU < 0.85 ? k0.shieldSide ?? k1.shieldSide ?? null : k1.shieldSide ?? null,
        leanRollOffset: lerp(k0.leanRoll ?? 0, k1.leanRoll ?? 0, u),
        showShadow: k0.showShadow !== false && k1.showShadow !== false
      };
    }
  }

  return { x: last.x, y: last.y ?? 0.115, z: last.z, yaw: last.yaw ?? 0, crouch: 0, scanYaw: 0, shieldSide: null, showShadow: true };
}

/**
 * Evaluates actor's optical mocap schedule with automatic 0.26s cosine crossfade.
 */
function sampleMocapSchedule(schedule, tSec) {
  if (!schedule || schedule.length === 0) return null;

  for (let i = 0; i < schedule.length; i++) {
    const seg = schedule[i];
    if (tSec >= seg.start && tSec <= seg.end) {
      const curTime = (tSec - seg.start) * (seg.rate ?? 1.0) + (seg.offset ?? 0.0);
      const prev = i > 0 ? schedule[i - 1] : null;
      const elapsed = tSec - seg.start;

      if (prev && prev.clip !== seg.clip && elapsed < CROSSFADE_SEC) {
        const prevTime = (tSec - prev.start) * (prev.rate ?? 1.0) + (prev.offset ?? 0.0);
        const w = 0.5 - 0.5 * Math.cos(Math.PI * clamp01(elapsed / CROSSFADE_SEC));
        return {
          primaryClip: prev.clip,
          clipTime: Math.max(0, prevTime),
          secondaryClip: seg.clip,
          secondaryClipTime: Math.max(0, curTime),
          blendWeight: w
        };
      }

      return {
        primaryClip: seg.clip,
        clipTime: Math.max(0, curTime),
        secondaryClip: null,
        secondaryClipTime: 0,
        blendWeight: 0
      };
    }
  }

  const last = schedule[schedule.length - 1];
  if (tSec > last.end) {
    return {
      primaryClip: last.clip,
      clipTime: Math.max(0, (last.end - last.start) * (last.rate ?? 1.0) + (last.offset ?? 0.0)),
      secondaryClip: null,
      secondaryClipTime: 0,
      blendWeight: 0
    };
  }
  return null;
}

/**
 * Evaluates annotated ball-touch windows for exact 2-bone ankle/foot surface IK.
 */
function sampleTouchWindows(windows, tSec) {
  if (!windows || windows.length === 0) return null;
  for (const w of windows) {
    if (tSec >= w.start && tSec <= w.end) {
      const u = (tSec - w.start) / Math.max(0.05, w.end - w.start);
      const bell = Math.sin(clamp01(u) * Math.PI);
      return {
        foot: w.foot || 'R',
        type: w.type || 'inside',
        weight: clamp01(bell * bell * (w.maxWeight ?? 1.0))
      };
    }
  }
  return null;
}

function sampleCameraTrack(camTrack, tSec) {
  if (!camTrack || camTrack.length === 0) {
    return { pos: [20, 10, 6], target: [0, 0.85, 4], fov: 36 };
  }
  if (tSec <= camTrack[0].t) return camTrack[0];
  const last = camTrack[camTrack.length - 1];
  if (tSec >= last.t) return last;

  for (let i = 0; i < camTrack.length - 1; i++) {
    const c0 = camTrack[i];
    const c1 = camTrack[i + 1];
    if (tSec >= c0.t && tSec <= c1.t) {
      const u = smoothstep01((tSec - c0.t) / Math.max(0.001, c1.t - c0.t));
      return {
        pos: [lerp(c0.pos[0], c1.pos[0], u), lerp(c0.pos[1], c1.pos[1], u), lerp(c0.pos[2], c1.pos[2], u)],
        target: [
          lerp(c0.target[0], c1.target[0], u),
          lerp(c0.target[1], c1.target[1], u),
          lerp(c0.target[2], c1.target[2], u)
        ],
        fov: lerp(c0.fov ?? 36, c1.fov ?? 36, u)
      };
    }
  }
  return last;
}

/**
 * Master 1:1 Frame-Accurate Evaluator at `tSec` (driven directly by `video.currentTime`).
 */
export function evaluateScenarioAtTime(scenario, tSec) {
  const dur = scenario.durationSec;
  const clampedT = clamp(tSec, 0, dur);
  const dtSample = 0.04;
  const tPrev = clamp(clampedT - dtSample, 0, dur);
  const tNext = clamp(clampedT + dtSample, 0, dur);
  const inv2Dt = 1 / Math.max(0.01, tNext - tPrev);

  const ballState = sampleSpatialKeyframes(scenario.ballTrack, clampedT);

  let activePhaseIdx = 0;
  for (let i = 0; i < scenario.phases.length; i++) {
    const [t0, t1] = scenario.phases[i].timeRange;
    if (clampedT >= t0 && clampedT <= t1 + 0.001) {
      activePhaseIdx = i;
      break;
    }
  }

  const actorStates = scenario.actors.map((actorDef) => {
    const cur = sampleSpatialKeyframes(actorDef.keyframes, clampedT);
    const prv = sampleSpatialKeyframes(actorDef.keyframes, tPrev);
    const nxt = sampleSpatialKeyframes(actorDef.keyframes, tNext);

    const vx = (nxt.x - prv.x) * inv2Dt;
    const vz = (nxt.z - prv.z) * inv2Dt;
    const speed = Math.hypot(vx, vz);

    // Centripetal banking lean into sharp turns + forward sprint drive pitch
    const dYaw = lerpAngle(prv.yaw, nxt.yaw, 1) - prv.yaw;
    const yawRate = dYaw * inv2Dt;
    const autoBankRoll = clamp(-yawRate * speed * 0.032, -0.22, 0.22);
    const leanRoll = clamp(autoBankRoll + (cur.leanRollOffset || 0), -0.28, 0.28);
    const leanPitch = clamp(speed * 0.022, 0, 0.14);

    const mocap = sampleMocapSchedule(actorDef.mocapSchedule, clampedT);
    const ballTouch = sampleTouchWindows(actorDef.touchWindows, clampedT);

    return {
      tSec: clampedT,
      x: cur.x,
      z: cur.z,
      yaw: cur.yaw,
      vx,
      vz,
      speed,
      crouch: cur.crouch,
      scanYaw: cur.scanYaw,
      shieldSide: cur.shieldSide,
      showShadow: cur.showShadow,
      leanRoll,
      leanPitch,
      primaryClip: mocap ? mocap.primaryClip : null,
      clipTime: mocap ? mocap.clipTime : 0,
      secondaryClip: mocap ? mocap.secondaryClip : null,
      secondaryClipTime: mocap ? mocap.secondaryClipTime : 0,
      blendWeight: mocap ? mocap.blendWeight : 0,
      ballTouch
    };
  });

  const cam = sampleCameraTrack(scenario.camTrack, clampedT);

  return {
    tSec: clampedT,
    durationSec: dur,
    ballState,
    actorStates,
    activePhaseIdx,
    phase: scenario.phases[activePhaseIdx],
    cam
  };
}

/**
 * 8 Canonical Pedri Press-Resistance Scenarios — Calibrated 1:1 to Zhibo8 Clipped MP4 Timestamps
 * Pitch Coordinates (from src/pitch.js, Broadcast Camera on +X side looking toward -X):
 *   - Screen LEFT  = +Z (Defensive half / Halfway Line at Z = +8.0 / Center Circle r = 9.15m)
 *   - Screen RIGHT = -Z (Attacking Penalty Box Z = -17.5..-34 / 3D Goal at Z = -34.0)
 *   - Screen BOTTOM = +X (+28m near touchline)
 *   - Screen TOP    = -X (-28m far touchline)
 */
export const SCENARIOS = [
  // ============================================================================
  // SCENARIO 01: s1_zhibo8_half_turn.mp4 (4.000s — Barça vs Mallorca)
  // ============================================================================
  {
    id: 'back-tight-half-turn',
    index: '01',
    durationSec: 4.0,
    title: '背身紧贴顶防 · 沉肩顺球半转身',
    moveName: '回头预扫描 + 脚内侧缓冲顺球半转身 (Scan & Cushion Half-Turn)',
    zoneTag: '中圈前沿 (4.00s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：2025-04-23 巴萨 vs 马略卡 (4.00s 单镜头特写)',
    pressureType: '黄衣 #30 正后方贴背抢位 + #5 侧翼封堵',
    metrics: {
      touches: '1.88s 右足内侧顺球',
      feintAngle: '180° 敞髋顺时针半转身',
      scans: '0.4s–1.4s 两次回头扫描',
      escapeWindow: '1.85s–2.55s (0.70s)'
    },
    keypoints: [
      '0.00s–1.75s：左路横传滚来，#8 佩德里迎球回撤（walk_back）并连续扭头扫描，感知马略卡黄衣 #30 正从右后方紧贴顶防。',
      '1.85s–2.55s：来球微弹瞬间，佩德里左臂架开 #30，调用 120Hz 半转身动捕（soccer_half_turn_180）敞开右髋用右脚内侧顺球转身！',
      '2.60s–4.00s：马略卡 #30 重心前冲刹不住车被彻底甩在身后，佩德里切换爆发冲刺（sprint_fwd）向右推进打穿首线。'
    ],
    phases: [
      { timeRange: [0.0, 1.2], label: '0.0–1.2s 回撤预扫描', desc: '左路传球滚入镜头，佩德里回撤迎球并扭头扫描身后黄衣 #30 贴防路线。' },
      { timeRange: [1.2, 1.85], label: '1.2–1.85s 贴背抗压沉髋', desc: '马略卡 #30 紧贴后背上抢，佩德里降重心左臂架开防守人准备接弹地球。' },
      { timeRange: [1.85, 2.65], label: '1.85–2.65s 顺球半转身', desc: '右足内侧精准贴球缓冲（足踝IK锁定），顺势敞开髋部 180° 半转身抹过 #30！' },
      { timeRange: [2.65, 4.0], label: '2.65–4.0s 爆发推进甩开', desc: '#30 失位踉跄留在原地，佩德里带球向右高速突进完成破首线摆脱。' }
    ],
    defaultFocus: [1.8, 0, 6.2],
    camTrack: [
      { t: 0.0, pos: [12.8, 4.3, 8.2], target: [1.2, 0.95, 8.6], fov: 30 },
      { t: 2.1, pos: [12.8, 4.3, 7.4], target: [1.6, 0.92, 7.6], fov: 30 },
      { t: 4.0, pos: [12.6, 4.3, 3.8], target: [2.2, 0.95, 2.2], fov: 30 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 1.1, z: 7.4, yaw: 0.12, scanYaw: -1.15, crouch: 0.15 },
          { t: 0.95, x: 1.15, z: 8.2, yaw: 0.08, scanYaw: 1.05, crouch: 0.25 },
          { t: 1.78, x: 1.25, z: 8.75, yaw: 0.15, scanYaw: 0.0, crouch: 0.48, shieldSide: 'L', leanRoll: 0.12 },
          { t: 2.25, x: 1.78, z: 8.15, yaw: -1.65, crouch: 0.42, shieldSide: 'L', leanRoll: -0.14 },
          { t: 2.68, x: 2.25, z: 6.75, yaw: -2.98, crouch: 0.22 },
          { t: 4.0, x: 2.85, z: 0.65, yaw: -3.04, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.15, clip: 'walk_back', rate: 1.05 },
          { start: 1.15, end: 1.80, clip: 'crouch_strafe_l', rate: 0.95 },
          { start: 1.80, end: 2.62, clip: 'soccer_half_turn_180', rate: 1.35, offset: 0.25 },
          { start: 2.62, end: 4.0, clip: 'sprint_fwd', rate: 1.08 }
        ],
        touchWindows: [
          { start: 1.82, peak: 2.02, end: 2.34, foot: 'R', type: 'inside', maxWeight: 0.95 },
          { start: 2.85, peak: 3.02, end: 3.22, foot: 'R', type: 'outside', maxWeight: 0.78 }
        ]
      },
      {
        id: 'mallorca30',
        role: 'defender',
        kit: 'mallorca-yellow',
        number: '30',
        shirtName: 'SANCHEZ',
        hairColor: '#1a1412',
        label: '马略卡 #30 (贴背抢断)',
        phaseSeed: 0.3,
        keyframes: [
          { t: 0.0, x: 0.65, z: 5.2, yaw: 0.08, crouch: 0.2 },
          { t: 1.35, x: 0.72, z: 7.55, yaw: 0.12, crouch: 0.45 },
          { t: 1.95, x: 0.62, z: 8.55, yaw: 0.22, crouch: 0.65 },
          { t: 2.45, x: 0.38, z: 9.25, yaw: 0.45, crouch: 0.6 },
          { t: 3.1, x: 0.85, z: 8.4, yaw: -2.45, crouch: 0.35 },
          { t: 4.0, x: 1.65, z: 5.1, yaw: -2.95, crouch: 0.2 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.6, clip: 'jog_fwd', rate: 1.12 },
          { start: 1.6, end: 2.55, clip: 'crouch_jockey_fwd', rate: 1.25 },
          { start: 2.55, end: 3.15, clip: 'crouch_jockey_back', rate: 1.1 },
          { start: 3.15, end: 4.0, clip: 'sprint_fwd', rate: 1.05 }
        ]
      },
      {
        id: 'mallorca5',
        hairVariant: 2,
        role: 'defender',
        kit: 'mallorca-yellow',
        number: '5',
        shirtName: 'MASCARELL',
        hasBeard: true,
        label: '马略卡 #5 马斯卡雷尔',
        phaseSeed: 0.8,
        keyframes: [
          { t: 0.0, x: 4.8, z: 5.0, yaw: -0.35, crouch: 0.2 },
          { t: 2.0, x: 4.5, z: 5.8, yaw: -0.55, crouch: 0.35 },
          { t: 3.0, x: 4.2, z: 4.2, yaw: -2.5, crouch: 0.3 },
          { t: 4.0, x: 4.0, z: 1.8, yaw: -2.85, crouch: 0.2 }
        ]
      },
      {
        id: 'passer',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '5',
        shirtName: 'I. MARTINEZ',
        hasBeard: true,
        label: '#5 伊尼戈 (左路直传)',
        keyframes: [
          { t: 0.0, x: 0.8, z: 16.8, yaw: -3.08 },
          { t: 0.5, x: 0.9, z: 16.2, yaw: -3.08 },
          { t: 4.0, x: 1.1, z: 13.8, yaw: -3.08 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 0.65, clip: 'soccer_pass_inside', rate: 1.2, offset: 0.4 },
          { start: 0.65, end: 4.0, clip: 'walk_fwd', rate: 0.9 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 0.85, y: 0.115, z: 16.2 },
      { t: 1.35, x: 1.18, y: 0.26, z: 10.6, arcY: 0.14 },
      { t: 1.92, x: 1.42, y: 0.19, z: 8.55 },
      { t: 2.38, x: 2.08, y: 0.115, z: 7.45 },
      { t: 3.0, x: 2.52, y: 0.115, z: 4.95 },
      { t: 4.0, x: 3.02, y: 0.115, z: -0.15 }
    ],
    pedriRibbon: [[1.1, 0.06, 7.4], [1.25, 0.06, 8.75], [1.85, 0.06, 8.1], [2.4, 0.06, 6.2], [2.85, 0.06, 0.65]],
    overshootRibbon: [[0.65, 0.05, 5.2], [0.62, 0.05, 8.55], [0.38, 0.05, 9.25]]
  },

  // ============================================================================
  // SCENARIO 02: s2_zhibo8_la_croqueta.mp4 (6.500s — Barça vs Rayo Vallecano)
  // ============================================================================
  {
    id: 'frontal-la-croqueta',
    index: '02',
    durationSec: 6.5,
    title: '中线双人夹击 · 伊涅斯塔式油炸丸子',
    moveName: '中线诱敌关门 + 双足内侧油炸丸子 (Halfway-Line La Croqueta)',
    zoneTag: '中线中圈 (6.50s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：2025-02-18 巴萨 vs 巴列卡诺 (6.50s 中线战术机位)',
    pressureType: '白衣红绶带 #23 + #6 中线正面双人关门夹抢',
    metrics: {
      touches: '3.05s右拨 + 3.42s左趟',
      feintAngle: '横向瞬移 0.85m 穿双人缝',
      scans: '接球前+出球前 3 次扫描',
      escapeWindow: '3.00s–3.85s (0.85s)'
    },
    keypoints: [
      '0.00s–1.75s：镜头正对白色中线（Z = 8m），#8 佩德里在中线右侧接应来球。',
      '1.80s–2.95s：佩德里压低重心碎步试探（crouch_strafe_r），故意把巴列卡诺 #23 与 #6 两名白衣球员诱入关门夹击点。',
      '3.00s–3.85s：双人伸脚封堵瞬间，触发 120Hz 油炸丸子（soccer_crossover_feint + sprint_cut_l），右脚横拨+左脚顺趟直接横穿白色中线钻出重围，5.45s 稳健分球！'
    ],
    phases: [
      { timeRange: [0.0, 1.75], label: '0.0–1.75s 中线接球观察', desc: '高空转播机位正对白色中线，佩德里接应后场传球并抬头扫描中圈站位。' },
      { timeRange: [1.75, 2.98], label: '1.75–2.98s 碎步诱敌关门', desc: '佩德里降重心缓步逼近中线，诱使巴列卡诺 #23 与 #6 两名白衣中场向内合拢关门。' },
      { timeRange: [2.98, 3.95], label: '2.98–3.95s 油炸丸子穿双人缝', desc: '右足内侧横拨避开伸脚 + 左足内侧顺趟（La Croqueta），丝滑穿越中线双人夹缝！' },
      { timeRange: [3.95, 6.5], label: '3.95–6.5s 推进中圈分球', desc: '摆脱后带球切入中圈左侧开阔地，5.45s 脚内侧精准推传左路队友。' }
    ],
    defaultFocus: [2.2, 0, 8.5],
    camTrack: [
      { t: 0.0, pos: [21.5, 11.4, 8.0], target: [2.8, 0.75, 7.6], fov: 35 },
      { t: 3.4, pos: [21.2, 11.2, 8.4], target: [2.0, 0.75, 8.6], fov: 35 },
      { t: 6.5, pos: [20.8, 11.0, 10.8], target: [-0.4, 0.75, 11.8], fov: 35 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 5.2, z: 5.8, yaw: 0.25, scanYaw: 0.85, crouch: 0.15 },
          { t: 1.45, x: 4.6, z: 6.4, yaw: -0.15, scanYaw: -0.65, crouch: 0.22 },
          { t: 2.85, x: 4.05, z: 7.25, yaw: -0.25, crouch: 0.52, leanRoll: -0.12 },
          { t: 3.32, x: 3.12, z: 8.05, yaw: -0.45, crouch: 0.48, leanRoll: 0.18 },
          { t: 3.95, x: 2.25, z: 9.95, yaw: -0.32, crouch: 0.25 },
          { t: 5.35, x: 0.45, z: 13.6, yaw: -0.58, scanYaw: -0.7, crouch: 0.18 },
          { t: 6.5, x: -0.15, z: 14.3, yaw: -0.95, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.55, clip: 'idle_scan', rate: 1.0 },
          { start: 1.55, end: 2.95, clip: 'crouch_strafe_r', rate: 0.95 },
          { start: 2.95, end: 3.62, clip: 'soccer_crossover_feint', rate: 1.45, offset: 0.35 },
          { start: 3.62, end: 4.25, clip: 'sprint_cut_l', rate: 1.12 },
          { start: 4.25, end: 5.35, clip: 'jog_fwd', rate: 1.05 },
          { start: 5.35, end: 6.5, clip: 'soccer_pass_inside', rate: 1.08, offset: 0.15 }
        ],
        touchWindows: [
          { start: 1.35, peak: 1.52, end: 1.72, foot: 'R', type: 'inside', maxWeight: 0.8 },
          { start: 3.02, peak: 3.18, end: 3.35, foot: 'R', type: 'inside', maxWeight: 0.95 },
          { start: 3.38, peak: 3.54, end: 3.75, foot: 'L', type: 'inside', maxWeight: 0.95 },
          { start: 5.42, peak: 5.65, end: 5.92, foot: 'R', type: 'inside', maxWeight: 0.92 }
        ]
      },
      {
        id: 'rayo23',
        role: 'defender',
        kit: 'rayo-white',
        number: '23',
        shirtName: 'VALENTIN',
        label: '巴列卡诺 #23 (上侧封堵)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 1.6, z: 9.4, yaw: 2.75, crouch: 0.2 },
          { t: 2.2, x: 2.35, z: 8.65, yaw: 2.85, crouch: 0.45 },
          { t: 3.25, x: 2.45, z: 7.95, yaw: 2.95, crouch: 0.65 },
          { t: 3.9, x: 2.95, z: 7.35, yaw: 2.2, crouch: 0.5 },
          { t: 6.5, x: 1.4, z: 11.2, yaw: -0.25, crouch: 0.2 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.4, clip: 'jog_fwd', rate: 0.95 },
          { start: 2.4, end: 3.85, clip: 'crouch_jockey_fwd', rate: 1.2 },
          { start: 3.85, end: 6.5, clip: 'jog_fwd', rate: 1.05 }
        ]
      },
      {
        id: 'rayo6',
        hairVariant: 2,
        role: 'defender',
        kit: 'rayo-white',
        number: '6',
        shirtName: 'CISS',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '巴列卡诺 #6 (下侧关门)',
        phaseSeed: 0.65,
        keyframes: [
          { t: 0.0, x: 6.5, z: 9.2, yaw: -2.2, crouch: 0.2 },
          { t: 2.3, x: 5.15, z: 8.45, yaw: -2.45, crouch: 0.45 },
          { t: 3.3, x: 4.15, z: 7.85, yaw: -2.65, crouch: 0.68 },
          { t: 4.0, x: 3.95, z: 7.25, yaw: -1.4, crouch: 0.45 },
          { t: 6.5, x: 2.2, z: 11.6, yaw: -0.35, crouch: 0.2 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.5, clip: 'jog_fwd', rate: 1.0 },
          { start: 2.5, end: 3.95, clip: 'crouch_jockey_fwd', rate: 1.22 },
          { start: 3.95, end: 6.5, clip: 'jog_fwd', rate: 1.05 }
        ]
      },
      {
        id: 'raphinha',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '11',
        shirtName: 'RAPHINHA',
        label: '#11 拉菲尼亚 (接应分球)',
        keyframes: [
          { t: 0.0, x: -4.8, z: 13.5, yaw: 1.9 },
          { t: 4.5, x: -5.2, z: 15.8, yaw: 2.1 },
          { t: 6.5, x: -5.6, z: 16.8, yaw: 2.3 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 7.4, y: 0.115, z: 2.6 },
      { t: 1.42, x: 4.65, y: 0.115, z: 6.52 },
      { t: 2.88, x: 4.02, y: 0.115, z: 7.42 },
      { t: 3.22, x: 3.08, y: 0.115, z: 8.12 },
      { t: 3.68, x: 2.42, y: 0.115, z: 9.55 },
      { t: 5.52, x: 0.25, y: 0.115, z: 13.95 },
      { t: 6.5, x: -5.35, y: 0.115, z: 16.55 }
    ],
    pedriRibbon: [[5.2, 0.06, 5.8], [4.05, 0.06, 7.25], [3.12, 0.06, 8.05], [2.25, 0.06, 9.95], [0.45, 0.06, 13.6]],
    overshootRibbon: [[6.5, 0.05, 9.2], [5.15, 0.05, 8.45], [3.95, 0.05, 7.25]]
  },

  // ============================================================================
  // SCENARIO 03: s3_zhibo8_roulette_psg.mp4 (5.600s — UCL Barça vs PSG)
  // ============================================================================
  {
    id: 'central-double-press-roulette',
    index: '03',
    durationSec: 5.6,
    title: '欧冠中圈三人围抢 · 360° 马赛回旋',
    moveName: '双足底踩拉 + 360° 背身回旋护球 (Marseille Roulette)',
    zoneTag: '欧冠中圈 (5.60s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：欧冠 巴萨 vs 巴黎圣日耳曼 (5.60s 中圈回旋脱困)',
    pressureType: '巴黎深蓝球衣 #17 + #8 + #33 三角合围抢断',
    metrics: {
      touches: '1.9s右踩 + 2.5s左拉',
      feintAngle: '360° 全周顺畅回旋',
      scans: '接球前全景扫描',
      escapeWindow: '1.80s–3.15s (1.35s)'
    },
    keypoints: [
      '0.00s–1.55s：传球滚入中圈右侧，巴黎三名深蓝球衣中场（#17 维蒂尼亚、#8 鲁伊斯、#33 埃梅里）瞬间收缩合围。',
      '1.80s–3.15s：#8 佩德里调用 120Hz 马赛回旋动捕（soccer_roulette_360），右脚底踩停急刹、顺势 360° 背身旋转并用左脚底把球拉出包围圈！',
      '3.20s–5.60s：两名巴黎球员扑空相撞，佩德里抬头加速带出重围并在 4.55s 推传远端队友。'
    ],
    phases: [
      { timeRange: [0.0, 1.65], label: '0.0–1.65s 中圈接球遇围', desc: '中圈接应来球瞬间，巴黎三名深蓝中场从正面与侧翼快速收拢形成三角包夹。' },
      { timeRange: [1.65, 2.45], label: '1.65–2.45s 右足底踩球急停', desc: '面对正面伸脚捅抢，佩德里右脚底精准踩球急停并转身用后背卡住抢断路线。' },
      { timeRange: [2.45, 3.25], label: '2.45–3.25s 360° 左足拉球脱困', desc: '完成全周 360° 丝滑旋转，左脚底顺势将球拉向空当，彻底抹过两名巴黎球员！' },
      { timeRange: [3.25, 5.6], label: '3.25–5.6s 破围推进分边', desc: '从三人合围中全身而退，从容推进并在 4.55s 送出精准横向转移。' }
    ],
    defaultFocus: [0.8, 0, 5.0],
    camTrack: [
      { t: 0.0, pos: [19.5, 9.8, 6.8], target: [1.2, 0.85, 6.4], fov: 34 },
      { t: 2.8, pos: [19.2, 9.6, 5.4], target: [0.6, 0.85, 4.8], fov: 34 },
      { t: 5.6, pos: [18.8, 9.5, 3.2], target: [-1.8, 0.85, 1.8], fov: 34 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 2.2, z: 7.4, yaw: -2.6, scanYaw: 0.95, crouch: 0.2 },
          { t: 1.55, x: 1.75, z: 6.25, yaw: -2.85, crouch: 0.38 },
          { t: 2.35, x: 1.15, z: 5.25, yaw: -5.98, rawYaw: true, crouch: 0.46, shieldSide: 'R' },
          { t: 3.15, x: 0.25, z: 4.15, yaw: -9.13, rawYaw: true, crouch: 0.32 },
          { t: 4.45, x: -1.45, z: 2.15, yaw: -2.65, crouch: 0.2 },
          { t: 5.6, x: -2.05, z: 1.55, yaw: -2.15, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.65, clip: 'crouch_strafe_l', rate: 0.95 },
          { start: 1.65, end: 3.20, clip: 'soccer_roulette_360', rate: 1.35, offset: 0.15 },
          { start: 3.20, end: 4.42, clip: 'jog_fwd', rate: 1.12 },
          { start: 4.42, end: 5.6, clip: 'soccer_pass_inside', rate: 1.1, offset: 0.15 }
        ],
        touchWindows: [
          { start: 1.80, peak: 2.05, end: 2.32, foot: 'R', type: 'sole', maxWeight: 0.95 },
          { start: 2.42, peak: 2.68, end: 3.02, foot: 'L', type: 'sole', maxWeight: 0.95 },
          { start: 4.52, peak: 4.75, end: 5.05, foot: 'R', type: 'inside', maxWeight: 0.9 }
        ]
      },
      {
        id: 'psg17',
        role: 'defender',
        kit: 'psg-navy',
        number: '17',
        shirtName: 'VITINHA',
        hasBeard: true,
        label: '巴黎 #17 维蒂尼亚 (正面上抢)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: 0.8, z: 2.8, yaw: 0.35, crouch: 0.25 },
          { t: 1.85, x: 1.35, z: 4.65, yaw: 0.25, crouch: 0.58 },
          { t: 2.65, x: 1.95, z: 5.55, yaw: 0.45, crouch: 0.65 },
          { t: 3.6, x: 1.55, z: 5.05, yaw: -2.4, crouch: 0.35 },
          { t: 5.6, x: -0.2, z: 3.2, yaw: -2.5, crouch: 0.2 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.6, clip: 'jog_fwd', rate: 1.05 },
          { start: 1.6, end: 3.0, clip: 'crouch_jockey_fwd', rate: 1.22 },
          { start: 3.0, end: 5.6, clip: 'jog_fwd', rate: 1.0 }
        ]
      },
      {
        id: 'psg8',
        hairVariant: 2,
        role: 'defender',
        kit: 'psg-navy',
        number: '8',
        shirtName: 'F. RUIZ',
        hasBeard: true,
        label: '巴黎 #8 法比安 (侧翼合围)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 4.5, z: 5.6, yaw: -1.35, crouch: 0.2 },
          { t: 2.1, x: 2.35, z: 5.45, yaw: -1.65, crouch: 0.55 },
          { t: 2.95, x: 1.85, z: 5.85, yaw: -2.15, crouch: 0.52 },
          { t: 5.6, x: 0.2, z: 3.8, yaw: -2.45, crouch: 0.2 }
        ]
      },
      {
        id: 'psg33',
        role: 'defender',
        kit: 'psg-navy',
        number: '33',
        shirtName: 'ZAIRE-EMERY',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '巴黎 #33 埃梅里 (后方追抢)',
        phaseSeed: 0.9,
        keyframes: [
          { t: 0.0, x: 1.6, z: 9.8, yaw: -3.05, crouch: 0.2 },
          { t: 2.3, x: 1.5, z: 6.9, yaw: -2.95, crouch: 0.45 },
          { t: 5.6, x: -0.4, z: 4.4, yaw: -2.65, crouch: 0.2 }
        ]
      },
      {
        id: 'gavi',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '6',
        shirtName: 'GAVI',
        label: '#6 加维 (远端接应)',
        keyframes: [
          { t: 0.0, x: -7.5, z: 1.5, yaw: 1.2 },
          { t: 4.2, x: -8.6, z: -0.8, yaw: 1.1 },
          { t: 5.6, x: -9.2, z: -1.4, yaw: 1.0 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 5.2, y: 0.115, z: 11.4 },
      { t: 1.48, x: 1.78, y: 0.115, z: 6.15 },
      { t: 2.05, x: 1.38, y: 0.115, z: 5.32 },
      { t: 2.75, x: 0.55, y: 0.115, z: 4.45 },
      { t: 4.55, x: -1.65, y: 0.115, z: 1.95 },
      { t: 5.6, x: -8.85, y: 0.115, z: -1.15 }
    ],
    pedriRibbon: [[2.2, 0.06, 7.4], [1.75, 0.06, 6.25], [1.15, 0.06, 5.25], [0.25, 0.06, 4.15], [-1.45, 0.06, 2.15]],
    overshootRibbon: [[0.8, 0.05, 2.8], [1.35, 0.05, 4.65], [1.95, 0.05, 5.55]]
  },

  // ============================================================================
  // SCENARIO 04: s4_zhibo8_touchline_escape.mp4 (6.434s — Atlético vs Barça Gold)
  // ============================================================================
  {
    id: 'touchline-trap-cruyff-cut',
    index: '04',
    durationSec: 6.434,
    title: '边线死角 1v3 围抢 · 急停内扣脱困',
    moveName: '金色客场战袍 · 假突底线 + 150° 急停内扣 (Touchline 1v3 Escape)',
    zoneTag: '右侧边线死角 (6.43s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：马竞 vs 巴萨金色客场球衣 (6.43s 边线 1v3 脱困)',
    pressureType: '边线丧失 180° 空间 + 马竞红白间条衫 #14/#6/#16 三人铁桶夹击',
    metrics: {
      touches: '3.15s 右足急停内扣',
      feintAngle: '150° 逆向内切转身',
      scans: '内切抬头找中路支点',
      escapeWindow: '2.95s–3.85s (0.90s)'
    },
    keypoints: [
      '0.00s–1.85s：身披巴萨金色战袍（barca-gold）的 #8 佩德里沿底部白边线（X = +26m）带球，马竞三名红白间条衫球员合围封死边路。',
      '1.90s–2.85s：佩德里在边线死角急刹虚晃（crouch_strafe_r），诱使马竞 #16 莫利纳与 #14 略伦特向底线方向扑抢过头。',
      '2.95s–3.85s：调用 120Hz 急停左内扣（soccer_cut_left_90）150° 折返中路，从两名马竞球员夹缝钻出并于 5.05s 横敲 #9 莱万！'
    ],
    phases: [
      { timeRange: [0.0, 1.85], label: '0.0–1.85s 边线诱敌合围', desc: '佩德里身穿金色球衣沿右侧边线推进，马竞三名红白球衣防守人迅速合拢边线陷阱。' },
      { timeRange: [1.85, 2.95], label: '1.85–2.95s 假突底线急刹', desc: '距边线仅 1.8m 处佯装顺边线强突，诱使马竞两名边路防守者重心向右侧底线猛扑。' },
      { timeRange: [2.95, 3.95], label: '2.95–3.95s 150° 急停内扣', desc: '右脚内侧狠扣皮球 150° 转向腹地（soccer_cut_left_90），瞬间清空边线三人包夹！' },
      { timeRange: [3.95, 6.434], label: '3.95–6.43s 穿缝推进横敲', desc: '带球切入中路开阔空间，5.05s 脚内侧稳健传给中路接应的 #9 莱万多夫斯基。' }
    ],
    defaultFocus: [20.5, 0, -1.0],
    camTrack: [
      { t: 0.0, pos: [34.2, 9.8, 1.8], target: [22.5, 0.85, -1.8], fov: 34 },
      { t: 3.2, pos: [33.6, 9.6, 0.8], target: [21.0, 0.85, -2.2], fov: 34 },
      { t: 6.434, pos: [31.5, 9.4, 1.2], target: [13.5, 0.85, -0.5], fov: 34 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-gold',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 (巴萨金衣)',
        keyframes: [
          { t: 0.0, x: 24.2, z: 2.6, yaw: -2.92, crouch: 0.18 },
          { t: 1.85, x: 25.8, z: -2.8, yaw: -3.05, crouch: 0.35 },
          { t: 2.85, x: 26.1, z: -3.7, yaw: -3.08, crouch: 0.56, shieldSide: 'L', leanRoll: -0.15 },
          { t: 3.65, x: 22.4, z: -1.6, yaw: -0.95, crouch: 0.38, leanRoll: 0.18 },
          { t: 4.95, x: 16.2, z: 1.1, yaw: -1.15, scanYaw: -0.5, crouch: 0.2 },
          { t: 6.434, x: 14.8, z: 1.3, yaw: -1.65, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.88, clip: 'jog_fwd', rate: 1.08 },
          { start: 1.88, end: 2.92, clip: 'crouch_strafe_r', rate: 1.05 },
          { start: 2.92, end: 3.78, clip: 'soccer_cut_left_90', rate: 1.25, offset: 0.08 },
          { start: 3.78, end: 4.95, clip: 'sprint_cut_l', rate: 1.08 },
          { start: 4.95, end: 6.434, clip: 'soccer_pass_inside', rate: 1.05, offset: 0.12 }
        ],
        touchWindows: [
          { start: 3.02, peak: 3.25, end: 3.55, foot: 'R', type: 'inside', maxWeight: 0.96 },
          { start: 5.02, peak: 5.26, end: 5.56, foot: 'R', type: 'inside', maxWeight: 0.92 }
        ]
      },
      {
        id: 'atleti16',
        role: 'defender',
        kit: 'atleti-striped',
        number: '16',
        shirtName: 'MOLINA',
        label: '马竞 #16 莫利纳 (边线封堵)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 25.8, z: -6.2, yaw: 0.15, crouch: 0.3 },
          { t: 2.4, x: 26.2, z: -4.9, yaw: 0.1, crouch: 0.58 },
          { t: 3.3, x: 26.5, z: -5.6, yaw: 0.25, crouch: 0.62 },
          { t: 6.434, x: 21.0, z: -2.0, yaw: -1.1, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.35, clip: 'crouch_jockey_fwd', rate: 1.1 },
          { start: 3.35, end: 6.434, clip: 'jog_fwd', rate: 1.05 }
        ]
      },
      {
        id: 'atleti14',
        hairVariant: 2,
        role: 'defender',
        kit: 'atleti-striped',
        number: '14',
        shirtName: 'LLORENTE',
        hairColor: '#6f5233',
        label: '马竞 #14 略伦特 (追抢冲过头)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 22.8, z: 3.2, yaw: -2.85, crouch: 0.25 },
          { t: 2.75, x: 24.4, z: -3.4, yaw: -2.98, crouch: 0.55 },
          { t: 3.45, x: 24.8, z: -5.2, yaw: -3.05, crouch: 0.6 },
          { t: 6.434, x: 18.2, z: -0.6, yaw: -0.95, crouch: 0.25 }
        ]
      },
      {
        id: 'atleti6',
        role: 'defender',
        kit: 'atleti-striped',
        number: '6',
        shirtName: 'KOKE',
        label: '马竞 #6 科克 (肋部关门)',
        phaseSeed: 0.85,
        keyframes: [
          { t: 0.0, x: 19.5, z: -1.8, yaw: 1.35, crouch: 0.25 },
          { t: 2.9, x: 22.2, z: -2.9, yaw: 1.65, crouch: 0.5 },
          { t: 3.9, x: 22.8, z: -2.8, yaw: -0.8, crouch: 0.45 },
          { t: 6.434, x: 17.5, z: 0.4, yaw: -1.1, crouch: 0.25 }
        ]
      },
      {
        id: 'lewy',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-gold',
        number: '9',
        shirtName: 'LEWANDOWSKI',
        label: '#9 莱万 (中路接应)',
        keyframes: [
          { t: 0.0, x: 8.5, z: -1.5, yaw: 1.5 },
          { t: 4.8, x: 7.2, z: -2.2, yaw: 1.35 },
          { t: 6.434, x: 6.6, z: -2.4, yaw: 1.35 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 24.4, y: 0.115, z: 2.1 },
      { t: 1.85, x: 25.9, y: 0.115, z: -3.15 },
      { t: 2.92, x: 26.0, y: 0.115, z: -3.85 },
      { t: 3.65, x: 22.0, y: 0.115, z: -1.35 },
      { t: 5.12, x: 15.8, y: 0.115, z: 1.15 },
      { t: 6.434, x: 6.95, y: 0.115, z: -2.25 }
    ],
    pedriRibbon: [[24.2, 0.06, 2.6], [26.1, 0.06, -3.7], [22.4, 0.06, -1.6], [16.2, 0.06, 1.1]],
    overshootRibbon: [[22.8, 0.05, 3.2], [24.4, 0.05, -3.4], [24.8, 0.05, -5.2]]
  },

  // ============================================================================
  // SCENARIO 05: s5_zhibo8_lapausa_through.mp4 (10.534s — Barça vs Villarreal)
  // ============================================================================
  {
    id: 'blind-side-la-pausa',
    index: '05',
    durationSec: 10.534,
    title: '口袋区 La Pausa 停顿 · 手术刀直塞亚马尔破门',
    moveName: '降速诱敌上抢 + 贴地直塞穿防线 + 亚马尔内切兜射 (La Pausa Assist)',
    zoneTag: '中圈至右禁区 (10.53s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：巴萨 vs 比利亚雷亚尔 (10.53s 全程跟拍直塞助攻破门)',
    pressureType: '黄潜双后腰上抢封堵 + 四后卫平行造越位线',
    metrics: {
      touches: '5.05s 手术刀贴地直塞',
      feintAngle: 'La Pausa 步频骤降 55%',
      scans: '抬头锁定右肋 #19 亚马尔',
      escapeWindow: '4.95s–5.40s 直塞窗口'
    },
    keypoints: [
      '0.00s–3.65s：后场左路转移至中圈，#8 佩德里接球向前推进，转播镜头同步从左向右平移。',
      '3.70s–4.85s：进入进攻口袋区后，佩德里刻意从慢跑切换为 La Pausa 散步控球（walk_fwd），诱使黄潜 #14 与 #10 两名黄衣后腰同时向前迈步上抢！',
      '4.95s–9.80s：肋部防线暴露空当瞬间，佩德里触发 120Hz 手术刀直塞（soccer_through_ball）打穿黄潜防线；#19 亚马尔高速插上（6.0s）、急停左脚内切（7.8s）、8.95s 兜射远角入网！'
    ],
    phases: [
      { timeRange: [0.0, 3.65], label: '0.0–3.65s 中圈接球推进', desc: '接后场转移球后向黄潜半场推进，同时抬头扫描右路 #19 亚马尔前插身位。' },
      { timeRange: [3.65, 4.90], label: '3.65–4.9s La Pausa 降速诱敌', desc: '刻意放慢步频（La Pausa），诱使两名黄衣中场重心前扑，扯开身后肋部通道！' },
      { timeRange: [4.90, 7.65], label: '4.9–7.65s 手术刀直塞穿防线', desc: '5.05s 右足内侧送出 18m 贴地直塞刺穿防线，#19 亚马尔高速冲刺杀入禁区右侧！' },
      { timeRange: [7.65, 10.534], label: '7.65–10.5s 亚马尔内切兜射破门', desc: '亚马尔 7.8s 急停内扣晃开后卫，8.95s 左脚推射远角直挂球网！' }
    ],
    defaultFocus: [2.5, 0, -10.0],
    camTrack: [
      { t: 0.0, pos: [24.2, 11.8, 7.2], target: [1.5, 0.85, 6.2], fov: 38 },
      { t: 3.5, pos: [24.5, 11.8, -1.5], target: [2.2, 0.85, -2.5], fov: 38 },
      { t: 5.5, pos: [24.2, 11.5, -6.2], target: [3.2, 0.85, -9.6], fov: 38 },
      { t: 8.2, pos: [23.2, 10.8, -19.5], target: [2.8, 0.95, -25.5], fov: 35 },
      { t: 10.534, pos: [22.5, 10.5, -22.5], target: [0.2, 1.15, -31.5], fov: 35 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 1.8, z: 7.5, yaw: 0.25, scanYaw: -0.9, crouch: 0.15 },
          { t: 2.15, x: 2.2, z: 6.4, yaw: -2.95, scanYaw: 0.75, crouch: 0.2 },
          { t: 3.65, x: 2.8, z: -0.8, yaw: -3.02, scanYaw: -0.55, crouch: 0.22 },
          { t: 4.88, x: 3.15, z: -4.2, yaw: -2.92, crouch: 0.35 },
          { t: 5.55, x: 3.35, z: -5.2, yaw: -2.88, crouch: 0.2 },
          { t: 10.534, x: 3.6, z: -10.8, yaw: -3.02, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.15, clip: 'idle_scan', rate: 1.0 },
          { start: 2.15, end: 3.68, clip: 'jog_fwd', rate: 1.05 },
          { start: 3.68, end: 4.88, clip: 'walk_fwd', rate: 0.88 },
          { start: 4.88, end: 5.75, clip: 'soccer_through_ball', rate: 1.28, offset: 0.25 },
          { start: 5.75, end: 10.534, clip: 'walk_fwd', rate: 0.95 }
        ],
        touchWindows: [
          { start: 2.05, peak: 2.22, end: 2.42, foot: 'R', type: 'inside', maxWeight: 0.8 },
          { start: 4.95, peak: 5.15, end: 5.42, foot: 'R', type: 'inside', maxWeight: 0.98 }
        ]
      },
      {
        id: 'yamal',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '19',
        shirtName: 'LAMINE YAMAL',
        skinTint: '#8d5b3e',
        skinTone: '#8d5b3e',
        label: '#19 亚马尔 (反越位内切破门)',
        keyframes: [
          { t: 0.0, x: 11.8, z: -9.5, yaw: -3.05, crouch: 0.15 },
          { t: 4.85, x: 9.6, z: -15.2, yaw: -2.88, crouch: 0.25 },
          { t: 6.25, x: 7.2, z: -20.8, yaw: -2.85, crouch: 0.25 },
          { t: 7.65, x: 5.1, z: -24.8, yaw: -2.92, crouch: 0.38 },
          { t: 8.75, x: 1.75, z: -25.8, yaw: -2.45, crouch: 0.42 },
          { t: 9.45, x: 1.35, z: -26.4, yaw: -2.85, crouch: 0.22 },
          { t: 10.534, x: 3.5, z: -27.5, yaw: -1.8, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.85, clip: 'jog_fwd', rate: 0.85 },
          { start: 4.85, end: 7.70, clip: 'sprint_fwd', rate: 1.15 },
          { start: 7.70, end: 8.82, clip: 'soccer_cut_left_90', rate: 1.12, offset: 0.05 },
          { start: 8.82, end: 9.65, clip: 'soccer_shot_drive', rate: 1.25, offset: 0.25 },
          { start: 9.65, end: 10.534, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 7.75, peak: 8.05, end: 8.35, foot: 'L', type: 'inside', maxWeight: 0.9 },
          { start: 8.92, peak: 9.12, end: 9.35, foot: 'L', type: 'inside', maxWeight: 0.95 }
        ]
      },
      {
        id: 'vil14',
        role: 'defender',
        kit: 'villarreal-yellow',
        number: '14',
        shirtName: 'COMESANA',
        label: '黄潜 #14 (被诱上抢后腰)',
        phaseSeed: 0.25,
        keyframes: [
          { t: 0.0, x: 1.8, z: -9.2, yaw: 0.1, crouch: 0.2 },
          { t: 3.6, x: 2.1, z: -7.8, yaw: 0.15, crouch: 0.35 },
          { t: 4.95, x: 2.6, z: -6.1, yaw: 0.12, crouch: 0.58 },
          { t: 7.5, x: 2.8, z: -15.5, yaw: -3.05, crouch: 0.25 },
          { t: 10.534, x: 2.5, z: -21.0, yaw: -3.05, crouch: 0.2 }
        ]
      },
      {
        id: 'vil24',
        role: 'defender',
        kit: 'villarreal-yellow',
        number: '24',
        shirtName: 'PEDRAZA',
        label: '黄潜 #24 (回追被扣后卫)',
        phaseSeed: 0.6,
        keyframes: [
          { t: 0.0, x: 8.5, z: -15.8, yaw: 0.1, crouch: 0.2 },
          { t: 5.0, x: 7.8, z: -16.2, yaw: -2.95, crouch: 0.3 },
          { t: 7.75, x: 4.8, z: -26.2, yaw: 0.25, crouch: 0.58 },
          { t: 8.85, x: 5.8, z: -26.8, yaw: -1.2, crouch: 0.52 },
          { t: 10.534, x: 3.8, z: -27.5, yaw: -2.8, crouch: 0.25 }
        ]
      },
      {
        id: 'vil3',
        hairVariant: 2,
        role: 'defender',
        kit: 'villarreal-yellow',
        number: '3',
        shirtName: 'ALBIOL',
        hasBeard: true,
        label: '黄潜 #3 阿尔比奥尔',
        phaseSeed: 0.9,
        keyframes: [
          { t: 0.0, x: 1.2, z: -16.0, yaw: 0.05, crouch: 0.2 },
          { t: 5.1, x: 1.5, z: -16.5, yaw: -3.0, crouch: 0.3 },
          { t: 8.9, x: 0.4, z: -27.8, yaw: 0.35, crouch: 0.55 },
          { t: 10.534, x: 0.2, z: -28.4, yaw: -2.9, crouch: 0.25 }
        ]
      },
      {
        id: 'vilgk',
        role: 'defender',
        kit: 'gk-pink',
        number: '13',
        shirtName: 'CONDE',
        showShadow: false,
        label: '黄潜门将 #13',
        keyframes: [
          { t: 0.0, x: 0.4, z: -33.2, yaw: 0.1, crouch: 0.35, showShadow: false },
          { t: 8.9, x: 0.8, z: -33.0, yaw: 0.15, crouch: 0.55, showShadow: false },
          { t: 9.75, x: -1.8, z: -33.4, yaw: 0.4, crouch: 0.7, leanRoll: 0.28, showShadow: false },
          { t: 10.534, x: -1.8, z: -33.4, yaw: 0.4, crouch: 0.5, showShadow: false }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -4.2, y: 0.115, z: 15.2 },
      { t: 2.12, x: 2.25, y: 0.115, z: 6.15 },
      { t: 3.65, x: 2.88, y: 0.115, z: -1.15 },
      { t: 5.05, x: 3.28, y: 0.115, z: -4.65 },
      { t: 6.35, x: 6.95, y: 0.115, z: -21.2 },
      { t: 7.72, x: 4.85, y: 0.115, z: -25.1 },
      { t: 8.98, x: 1.55, y: 0.115, z: -26.2 },
      { t: 9.72, x: -2.75, y: 1.18, z: -34.35, ease: 'linear' },
      { t: 10.534, x: -2.85, y: 0.115, z: -35.1 }
    ],
    pedriRibbon: [[1.8, 0.06, 7.5], [2.2, 0.06, 6.4], [2.8, 0.06, -0.8], [3.28, 0.06, -4.65], [6.95, 0.06, -21.2]],
    overshootRibbon: [[1.8, 0.05, -9.2], [2.6, 0.05, -6.1]]
  },

  // ============================================================================
  // SCENARIO 06: s6_zhibo8_cage_wallpass.mp4 (8.834s — Valencia vs Barça)
  // ============================================================================
  {
    id: 'pressing-cage-third-man',
    index: '06',
    durationSec: 8.834,
    title: '中路三人包围笼 · 吸怪与奥尔莫撞墙破门',
    moveName: '斜向运球主动吸怪 + 弧顶撞墙二过三破笼 (Pressing-Cage Wall-Pass)',
    zoneTag: '中场至禁区弧顶 (8.83s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：瓦伦西亚 vs 巴萨 (8.83s 吸怪撞墙配合破门)',
    pressureType: '瓦伦西亚白衣黑裤 #18 + #8 + #3 中路收缩包围笼',
    metrics: {
      touches: '4.55s 斜敲 + 7.05s 推射',
      feintAngle: '吸引 3 名防守人向球坍缩',
      scans: '提前锁定弧顶 #20 奥尔莫',
      escapeWindow: '4.50s–6.20s 撞墙破笼'
    },
    keypoints: [
      '0.00s–2.55s：左路横传找到中路 #8 佩德里，瓦伦西亚白衣黑裤（valencia-white）中场防线严阵以待。',
      '2.60s–4.40s：佩德里不盲目回传，而是斜向带球切入包围圈核心（jog_fwd），像磁铁一样把瓦伦西亚三名球员全部吸拢收窄！',
      '4.45s–7.70s：包围笼合拢瞬间，4.55s 一脚斜传找到弧顶 #20 奥尔莫并高速无球前插（sprint_fwd），接奥尔莫直塞反越位杀入禁区，7.05s 冷静低射破门！'
    ],
    phases: [
      { timeRange: [0.0, 2.55], label: '0.0–2.55s 左路横传接球', desc: '佩德里在中场肋部接左路来球，抬头观察弧顶支点 #20 奥尔莫站位。' },
      { timeRange: [2.55, 4.45], label: '2.55–4.45s 斜向带球吸怪', desc: '主动带球切向中路腹地，诱使三名白衣黑裤防守人同时向佩德里收缩合拢。' },
      { timeRange: [4.45, 6.65], label: '4.45–6.65s 奥尔莫撞墙破笼', desc: '4.55s 斜敲奥尔莫后立即无球冲刺穿笼，奥尔莫顺势送出贴地直塞回做！' },
      { timeRange: [6.65, 8.834], label: '6.65–8.83s 反越位低射破门', desc: '打穿整条防线单刀面对门将，7.05s 推射远角入网！' }
    ],
    defaultFocus: [1.0, 0, -14.0],
    camTrack: [
      { t: 0.0, pos: [23.5, 11.4, -1.5], target: [-1.5, 0.85, -2.5], fov: 37 },
      { t: 4.5, pos: [23.2, 11.2, -10.5], target: [1.2, 0.85, -12.5], fov: 36 },
      { t: 8.834, pos: [22.2, 10.6, -21.5], target: [0.5, 1.0, -29.5], fov: 35 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -3.2, z: -0.8, yaw: -1.8, scanYaw: -0.75, crouch: 0.15 },
          { t: 2.35, x: -2.2, z: -2.2, yaw: -2.55, scanYaw: 0.55, crouch: 0.22 },
          { t: 4.42, x: 2.6, z: -10.4, yaw: -2.85, crouch: 0.34 },
          { t: 5.15, x: 3.0, z: -12.8, yaw: -3.02, crouch: 0.25 },
          { t: 6.75, x: 2.35, z: -22.6, yaw: -3.05, crouch: 0.28 },
          { t: 7.45, x: 2.15, z: -24.2, yaw: -2.95, crouch: 0.18 },
          { t: 8.834, x: 3.4, z: -26.2, yaw: -2.1, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.35, clip: 'idle_scan', rate: 1.0 },
          { start: 2.35, end: 4.40, clip: 'jog_fwd', rate: 1.12 },
          { start: 4.40, end: 5.05, clip: 'soccer_pass_inside', rate: 1.35, offset: 0.2 },
          { start: 5.05, end: 6.82, clip: 'sprint_fwd', rate: 1.16 },
          { start: 6.82, end: 7.65, clip: 'soccer_shot_drive', rate: 1.25, offset: 0.25 },
          { start: 7.65, end: 8.834, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 2.25, peak: 2.42, end: 2.62, foot: 'R', type: 'inside', maxWeight: 0.8 },
          { start: 4.48, peak: 4.66, end: 4.90, foot: 'R', type: 'inside', maxWeight: 0.95 },
          { start: 6.92, peak: 7.12, end: 7.36, foot: 'R', type: 'inside', maxWeight: 0.96 }
        ]
      },
      {
        id: 'olmo',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '20',
        shirtName: 'DANI OLMO',
        hairColor: '#5c4328',
        label: '#20 奥尔莫 (弧顶撞墙支点)',
        keyframes: [
          { t: 0.0, x: 0.4, z: -14.8, yaw: 0.2, crouch: 0.2 },
          { t: 4.85, x: 0.65, z: -15.4, yaw: 0.35, crouch: 0.38 },
          { t: 5.65, x: 0.95, z: -16.1, yaw: -2.85, crouch: 0.32 },
          { t: 8.834, x: 1.2, z: -19.5, yaw: -3.0, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.85, clip: 'idle_ready', rate: 1.0 },
          { start: 4.85, end: 5.45, clip: 'soccer_half_turn_180', rate: 1.45, offset: 0.35 },
          { start: 5.45, end: 6.25, clip: 'soccer_through_ball', rate: 1.3, offset: 0.3 },
          { start: 6.25, end: 8.834, clip: 'jog_fwd', rate: 0.95 }
        ]
      },
      {
        id: 'val18',
        role: 'defender',
        kit: 'valencia-white',
        number: '18',
        shirtName: 'PEPELU',
        label: '瓦伦 #18 佩佩卢 (吸拢失位)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 0.5, z: -8.5, yaw: 0.2, crouch: 0.25 },
          { t: 4.45, x: 1.8, z: -11.2, yaw: 0.3, crouch: 0.55 },
          { t: 5.6, x: 2.1, z: -12.5, yaw: -2.9, crouch: 0.4 },
          { t: 8.834, x: 2.2, z: -20.5, yaw: -3.0, crouch: 0.25 }
        ]
      },
      {
        id: 'val8',
        role: 'defender',
        kit: 'valencia-white',
        number: '8',
        shirtName: 'GUERRA',
        label: '瓦伦 #8 格拉 (侧翼收窄)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 5.8, z: -9.8, yaw: -1.1, crouch: 0.25 },
          { t: 4.5, x: 4.0, z: -10.8, yaw: -1.4, crouch: 0.52 },
          { t: 8.834, x: 3.6, z: -21.5, yaw: -3.0, crouch: 0.25 }
        ]
      },
      {
        id: 'val3',
        hairVariant: 2,
        role: 'defender',
        kit: 'valencia-white',
        number: '3',
        shirtName: 'MOSQUERA',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '瓦伦 #3 莫斯克拉',
        phaseSeed: 0.8,
        keyframes: [
          { t: 0.0, x: -1.8, z: -17.5, yaw: 0.1, crouch: 0.25 },
          { t: 5.3, x: -0.4, z: -17.0, yaw: 0.25, crouch: 0.48 },
          { t: 7.2, x: 0.6, z: -24.2, yaw: -2.8, crouch: 0.5 },
          { t: 8.834, x: 0.8, z: -25.8, yaw: -2.9, crouch: 0.25 }
        ]
      },
      {
        id: 'valgk',
        role: 'defender',
        kit: 'gk-pink',
        number: '25',
        shirtName: 'MAMARDASHVILI',
        showShadow: false,
        label: '瓦伦门将 #25',
        keyframes: [
          { t: 0.0, x: 0.2, z: -33.0, yaw: 0.05, crouch: 0.35, showShadow: false },
          { t: 6.9, x: 0.6, z: -32.2, yaw: 0.15, crouch: 0.55, showShadow: false },
          { t: 7.75, x: -1.5, z: -33.2, yaw: 0.35, crouch: 0.68, leanRoll: 0.25, showShadow: false },
          { t: 8.834, x: -1.5, z: -33.2, yaw: 0.35, crouch: 0.5, showShadow: false }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -9.5, y: 0.115, z: 4.2 },
      { t: 2.35, x: -2.05, y: 0.115, z: -2.45 },
      { t: 4.55, x: 2.55, y: 0.115, z: -10.8 },
      { t: 5.15, x: 0.78, y: 0.115, z: -15.45 },
      { t: 5.65, x: 1.05, y: 0.115, z: -16.35 },
      { t: 6.85, x: 2.28, y: 0.115, z: -23.1 },
      { t: 7.72, x: -2.55, y: 0.22, z: -34.35, ease: 'linear' },
      { t: 8.834, x: -2.65, y: 0.115, z: -35.1 }
    ],
    pedriRibbon: [[-3.2, 0.06, -0.8], [-2.2, 0.06, -2.2], [2.6, 0.06, -10.4], [2.35, 0.06, -22.6]],
    overshootRibbon: [[0.5, 0.05, -8.5], [1.8, 0.05, -11.2], [4.0, 0.05, -10.8]]
  },

  // ============================================================================
  // SCENARIO 07: s7_zhibo8_shield_nutmeg.mp4 (5.800s — PSG vs Barça Coral)
  // ============================================================================
  {
    id: 'transition-shield-far-foot',
    index: '07',
    durationSec: 5.8,
    title: '遭撞倒地单手撑草皮 · 极限护球起身穿裆',
    moveName: '珊瑚橙战袍 · 单手撑地护球 + 起身穿裆维蒂尼亚 (Turf-Shield & Nutmeg)',
    zoneTag: '中圈弧线特写 (5.80s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：巴黎 vs 巴萨珊瑚橙客场战袍 (5.80s 撑地护球+穿裆)',
    pressureType: '巴黎 #8 鲁伊斯猛烈冲撞后背 + #17 维蒂尼亚迎面封堵',
    metrics: {
      touches: '2.3s撑地护球 + 4.15s穿裆',
      feintAngle: '单手撑草皮重心降至 0.45m',
      scans: '起身瞬间洞察双腿间距',
      escapeWindow: '4.00s–4.45s 穿裆一瞬'
    },
    keypoints: [
      '0.00s–1.95s：身披巴萨珊瑚橙客场球衣（barca-coral）的 #8 佩德里在中圈带球，巴黎 #8 法比安·鲁伊斯从左后侧凶狠贴身冲撞。',
      '2.00s–3.25s：失衡瞬间触发专属撑地护球动捕（soccer_turf_hand_shield），佩德里左手单手撑住草皮、右脚死死把球卡在胯下，让鲁伊斯冲过头！',
      '3.30s–5.80s：佩德里敏捷弹起，面对迎面上抢张开双腿的巴黎 #17 维蒂尼亚，4.15s 右脚内侧轻捅穿裆（Nutmeg）并绕身超车！'
    ],
    phases: [
      { timeRange: [0.0, 1.95], label: '0.0–1.95s 珊瑚橙衣带球抗撞', desc: '佩德里沿中圈弧线向右带球，巴黎 #8 鲁伊斯高速贴身猛烈冲撞其后腰。' },
      { timeRange: [1.95, 3.30], label: '1.95–3.3s 单手撑草皮极限护球', desc: '倒地瞬间左手撑住草皮借力稳住核心，把球护在双腿保护区内令鲁伊斯扑空冲过头！' },
      { timeRange: [3.30, 4.45], label: '3.3–4.45s 起身丝滑穿裆 #17', desc: '迅速撑地弹起，抓巴黎 #17 维蒂尼亚跨步上抢瞬间，4.15s 一脚推球穿过其双腿小门！' },
      { timeRange: [4.45, 5.8], label: '4.45–5.8s 绕身加速超车', desc: '人球分过绕过怔在原地的维蒂尼亚，完成窒息级逆境摆脱！' }
    ],
    defaultFocus: [2.2, 0, 3.8],
    camTrack: [
      { t: 0.0, pos: [13.2, 4.8, 5.6], target: [2.4, 0.8, 5.6], fov: 28 },
      { t: 2.6, pos: [13.0, 4.6, 4.2], target: [2.5, 0.68, 4.2], fov: 28 },
      { t: 5.8, pos: [12.8, 4.6, 1.2], target: [1.8, 0.82, 0.2], fov: 28 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-coral',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 (巴萨珊瑚橙)',
        keyframes: [
          { t: 0.0, x: 2.35, z: 8.1, yaw: -3.02, crouch: 0.18 },
          { t: 1.45, x: 2.52, z: 5.35, yaw: -2.98, crouch: 0.42, shieldSide: 'L' },
          { t: 2.05, x: 2.62, z: 4.45, yaw: -2.85, crouch: 0.78 },
          { t: 3.25, x: 2.55, z: 4.15, yaw: -2.95, crouch: 0.52 },
          { t: 4.15, x: 2.38, z: 3.35, yaw: -3.05, crouch: 0.35 },
          { t: 4.85, x: 1.05, z: 1.45, yaw: -2.75, crouch: 0.25, leanRoll: 0.16 },
          { t: 5.8, x: 1.65, z: -1.45, yaw: -3.05, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.92, clip: 'jog_fwd', rate: 1.05 },
          { start: 1.92, end: 3.35, clip: 'soccer_turf_hand_shield', rate: 1.35, offset: 0.05 },
          { start: 3.35, end: 3.98, clip: 'crouch_jockey_fwd', rate: 1.1 },
          { start: 3.98, end: 4.48, clip: 'soccer_pass_inside', rate: 1.45, offset: 0.25 },
          { start: 4.48, end: 5.8, clip: 'sprint_cut_l', rate: 1.15 }
        ],
        touchWindows: [
          { start: 2.15, peak: 2.65, end: 3.15, foot: 'R', type: 'sole', maxWeight: 0.88 },
          { start: 4.02, peak: 4.18, end: 4.38, foot: 'R', type: 'inside', maxWeight: 0.96 }
        ]
      },
      {
        id: 'psg8_s7',
        hairVariant: 2,
        role: 'defender',
        kit: 'psg-navy',
        number: '8',
        shirtName: 'F. RUIZ',
        hasBeard: true,
        label: '巴黎 #8 鲁伊斯 (冲撞失位)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 1.35, z: 8.6, yaw: -2.92, crouch: 0.25 },
          { t: 1.85, x: 1.95, z: 4.85, yaw: -2.85, crouch: 0.58 },
          { t: 2.95, x: 3.45, z: 2.35, yaw: -2.65, crouch: 0.52 },
          { t: 5.8, x: 2.9, z: 0.6, yaw: -2.95, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.65, clip: 'sprint_fwd', rate: 1.05 },
          { start: 1.65, end: 3.1, clip: 'crouch_jockey_fwd', rate: 1.25 },
          { start: 3.1, end: 5.8, clip: 'jog_fwd', rate: 0.95 }
        ]
      },
      {
        id: 'psg17_s7',
        role: 'defender',
        kit: 'psg-navy',
        number: '17',
        shirtName: 'VITINHA',
        hasBeard: true,
        label: '巴黎 #17 维蒂尼亚 (被穿裆)',
        phaseSeed: 0.65,
        keyframes: [
          { t: 0.0, x: 2.0, z: 0.2, yaw: 0.1, crouch: 0.25 },
          { t: 3.55, x: 2.25, z: 2.15, yaw: 0.08, crouch: 0.58 },
          { t: 4.25, x: 2.22, z: 2.25, yaw: 0.05, crouch: 0.68 },
          { t: 5.05, x: 2.35, z: 2.1, yaw: -2.5, crouch: 0.45 },
          { t: 5.8, x: 2.15, z: 0.3, yaw: -2.95, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.4, clip: 'jog_fwd', rate: 0.9 },
          { start: 3.4, end: 4.55, clip: 'crouch_strafe_l', rate: 0.85 },
          { start: 4.55, end: 5.8, clip: 'crouch_jockey_back', rate: 1.1 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 2.42, y: 0.115, z: 7.75 },
      { t: 1.95, x: 2.68, y: 0.115, z: 4.52 },
      { t: 3.25, x: 2.58, y: 0.115, z: 4.12 },
      { t: 4.08, x: 2.36, y: 0.115, z: 3.22 },
      { t: 4.35, x: 2.22, y: 0.115, z: 2.15, ease: 'linear' }, // right through #17 Vitinha's legs at (2.22, 2.25)!
      { t: 5.8, x: 1.72, y: 0.115, z: -1.85 }
    ],
    pedriRibbon: [[2.35, 0.06, 8.1], [2.62, 0.06, 4.45], [2.38, 0.06, 3.35], [1.05, 0.06, 1.45], [1.65, 0.06, -1.45]],
    overshootRibbon: [[1.35, 0.05, 8.6], [1.95, 0.05, 4.85], [3.45, 0.05, 2.35]]
  },

  // ============================================================================
  // SCENARIO 08: s8_zhibo8_sevilla_double_fakeshot.mp4 (7.767s — Barça vs Sevilla)
  // ============================================================================
  {
    id: 'zone14-double-fakeshot',
    index: '08',
    durationSec: 7.767,
    title: '诺坎普弧顶双假射 · 连续晃飞两记滑铲贴地斩',
    moveName: '两次高摆腿假射真扣 + 右脚贴地火箭破门 (Double Fake-Shot Goal vs Sevilla)',
    zoneTag: 'Zone 14 禁区弧顶 (7.77s 1:1)',
    matchRef: '直播吧 720p 原片 1:1 帧同步：巴萨 1-0 塞维利亚 (7.77s 无切镜完整进球)',
    pressureType: '塞维利亚白衣红袜 #10 拉基蒂奇 + #20 迭戈·卡洛斯先后飞身封堵滑铲',
    metrics: {
      touches: '2.5s左扣 + 3.7s右扣 + 4.95s爆射',
      feintAngle: '连续两次高扬摆腿假射',
      scans: '余光锁死远端底角死角',
      escapeWindow: '4.85s–5.25s 射门走廊'
    },
    keypoints: [
      '0.00s–1.95s：右翼 #7 登贝莱横敲禁区弧顶，#8 佩德里停球面向球门（Z = -34m）。',
      '2.10s–2.95s：【第一次假射真扣】佩德里高扬右腿蓄力假射（soccer_power_kick）接急停左扣（soccer_cut_left_90），塞维利亚白衣红袜 #10 拉基蒂奇整个人向右侧倒地滑铲飞出镜头！',
      '3.30s–5.80s：【第二次假射真扣 + 贴地斩】3.35s 再次扬腿假射右扣晃飞中卫 #20 迭戈·卡洛斯的飞铲，4.95s 右脚正脚背贴地爆射（soccer_shot_drive），皮球窜入远端死角，粉色球衣门将 #13 布努扑救不及！'
    ],
    phases: [
      { timeRange: [0.0, 2.05], label: '0.0–2.05s 登贝莱倒三角回敲', desc: '右路 #7 登贝莱横传弧顶，佩德里迎球停稳直面塞维利亚密集防线。' },
      { timeRange: [2.05, 3.25], label: '2.05–3.25s 假射①晃飞拉基蒂奇', desc: '第一次高扬右腿假射急停左扣，#10 拉基蒂奇倒地滑铲直接飞出射门线！' },
      { timeRange: [3.25, 4.65], label: '3.25–4.65s 假射②晃飞卡洛斯', desc: '第二次假射顺势向右回扣，补防中卫 #20 迭戈·卡洛斯同样飞身滑铲扑空！' },
      { timeRange: [4.65, 7.767], label: '4.65–7.77s 贴地斩远角破门', desc: '4.95s 右脚抽出贴地激光炮直窜远角，粉衣门将布努鞭长莫及，诺坎普沸腾！' }
    ],
    defaultFocus: [2.0, 0, -20.0],
    camTrack: [
      { t: 0.0, pos: [23.2, 10.6, -11.8], target: [4.8, 0.9, -16.8], fov: 35 },
      { t: 2.8, pos: [22.6, 10.4, -13.2], target: [2.6, 0.9, -17.5], fov: 35 },
      { t: 5.2, pos: [21.8, 10.2, -15.8], target: [0.8, 0.95, -24.5], fov: 34 },
      { t: 7.767, pos: [21.5, 10.0, -17.5], target: [2.2, 1.05, -26.5], fov: 34 }
    ],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        kit: 'barca-home',
        number: '8',
        shirtName: 'PEDRI',
        hairColor: '#231710',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 5.4, z: -13.6, yaw: -2.7, scanYaw: -0.6, crouch: 0.18 },
          { t: 1.65, x: 4.95, z: -14.85, yaw: -3.02, crouch: 0.32 },
          { t: 2.42, x: 4.75, z: -15.15, yaw: -3.05, crouch: 0.48 },
          { t: 3.05, x: 1.85, z: -15.75, yaw: -2.45, crouch: 0.42, leanRoll: 0.16 },
          { t: 3.62, x: 1.75, z: -15.95, yaw: -2.95, crouch: 0.48 },
          { t: 4.28, x: 3.82, z: -16.95, yaw: -3.12, crouch: 0.38, leanRoll: -0.16 },
          { t: 5.15, x: 3.95, z: -17.45, yaw: -2.95, crouch: 0.25 },
          { t: 6.2, x: 6.2, z: -18.2, yaw: -1.75, crouch: 0.1 },
          { t: 7.767, x: 9.8, z: -17.6, yaw: -1.55, crouch: 0.08 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.60, clip: 'jog_fwd', rate: 0.9 },
          { start: 1.60, end: 2.08, clip: 'crouch_strafe_l', rate: 1.0 },
          { start: 2.08, end: 2.48, clip: 'soccer_power_kick', rate: 1.35, offset: 0.18 },
          { start: 2.48, end: 3.18, clip: 'soccer_cut_left_90', rate: 1.3, offset: 0.08 },
          { start: 3.18, end: 3.68, clip: 'soccer_power_kick', rate: 1.35, offset: 0.18 },
          { start: 3.68, end: 4.45, clip: 'soccer_cut_right_90', rate: 1.25, offset: 0.05 },
          { start: 4.45, end: 5.55, clip: 'soccer_shot_drive', rate: 1.22, offset: 0.1 },
          { start: 5.55, end: 7.767, clip: 'sprint_fwd', rate: 1.05 }
        ],
        touchWindows: [
          { start: 1.58, peak: 1.76, end: 1.96, foot: 'R', type: 'inside', maxWeight: 0.85 },
          { start: 2.48, peak: 2.68, end: 2.92, foot: 'R', type: 'inside', maxWeight: 0.95 },
          { start: 3.68, peak: 3.90, end: 4.15, foot: 'L', type: 'inside', maxWeight: 0.95 },
          { start: 4.84, peak: 5.02, end: 5.22, foot: 'R', type: 'instep', maxWeight: 0.98 }
        ]
      },
      {
        id: 'dembele',
        hairVariant: 2,
        role: 'teammate',
        kit: 'barca-home',
        number: '7',
        shirtName: 'DEMBELE',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '#7 登贝莱 (右翼横敲助攻)',
        keyframes: [
          { t: 0.0, x: 15.2, z: -20.5, yaw: -1.15, crouch: 0.25 },
          { t: 0.65, x: 14.4, z: -19.8, yaw: -1.25, crouch: 0.25 },
          { t: 7.767, x: 12.8, z: -18.5, yaw: -1.55, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 0.85, clip: 'soccer_pass_inside', rate: 1.2, offset: 0.25 },
          { start: 0.85, end: 7.767, clip: 'idle_ready', rate: 0.95 }
        ]
      },
      {
        id: 'rakitic',
        role: 'defender',
        kit: 'sevilla-white',
        number: '10',
        shirtName: 'RAKITIC',
        hairColor: '#c9a259',
        label: '塞维 #10 拉基蒂奇 (第1记滑铲飞出)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: 3.6, z: -18.8, yaw: 0.3, crouch: 0.25 },
          { t: 2.25, x: 4.5, z: -16.2, yaw: 0.35, crouch: 0.58 },
          { t: 2.95, x: 6.8, z: -15.4, yaw: 0.95, crouch: 0.82, leanRoll: -0.28 },
          { t: 4.5, x: 7.1, z: -15.2, yaw: -1.8, crouch: 0.55 },
          { t: 7.767, x: 5.8, z: -17.0, yaw: -2.8, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.28, clip: 'sprint_fwd', rate: 1.08 },
          { start: 2.28, end: 3.55, clip: 'soccer_slide_tackle', rate: 0.92, offset: 0.0 },
          { start: 3.55, end: 4.55, clip: 'soccer_turf_hand_shield', rate: 1.05, offset: 0.0 },
          { start: 4.55, end: 7.767, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'diegocarlos',
        hairVariant: 2,
        role: 'defender',
        kit: 'sevilla-white',
        number: '20',
        shirtName: 'D. CARLOS',
        skinTint: '#7b4f35',
        skinTone: '#7b4f35',
        hasBeard: true,
        label: '塞维 #20 迭戈·卡洛斯 (第2记滑铲飞出)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 0.8, z: -20.5, yaw: 0.15, crouch: 0.25 },
          { t: 3.45, x: 1.45, z: -17.2, yaw: 0.2, crouch: 0.58 },
          { t: 4.25, x: -1.35, z: -16.3, yaw: -0.95, crouch: 0.82, leanRoll: 0.28 },
          { t: 5.8, x: -1.5, z: -16.5, yaw: -2.5, crouch: 0.5 },
          { t: 7.767, x: -0.8, z: -18.5, yaw: -2.9, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.48, clip: 'jog_fwd', rate: 1.05 },
          { start: 3.48, end: 4.75, clip: 'soccer_slide_tackle', rate: 0.92, offset: 0.0 },
          { start: 4.75, end: 5.75, clip: 'soccer_turf_hand_shield', rate: 1.05, offset: 0.0 },
          { start: 5.75, end: 7.767, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'bono',
        role: 'defender',
        kit: 'gk-pink',
        number: '13',
        shirtName: 'BONO',
        showShadow: false,
        label: '塞维门将 #13 布努 (粉衣扑救)',
        keyframes: [
          { t: 0.0, x: 0.6, z: -33.2, yaw: 0.15, crouch: 0.35, showShadow: false },
          { t: 4.95, x: 0.85, z: -32.8, yaw: 0.2, crouch: 0.55, showShadow: false },
          { t: 5.75, x: -1.95, z: -33.4, yaw: 0.45, crouch: 0.75, leanRoll: 0.28, showShadow: false },
          { t: 7.767, x: -1.95, z: -33.4, yaw: 0.45, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.95, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 4.95, end: 7.767, clip: 'gk_dive_right', rate: 0.95, offset: 0.0 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 14.5, y: 0.115, z: -19.8 },
      { t: 1.62, x: 4.92, y: 0.115, z: -15.05 },
      { t: 2.46, x: 4.65, y: 0.115, z: -15.32 },
      { t: 3.08, x: 1.82, y: 0.115, z: -15.95 },
      { t: 3.68, x: 1.85, y: 0.115, z: -16.15 },
      { t: 4.35, x: 3.88, y: 0.115, z: -17.25 },
      { t: 5.02, x: 3.92, y: 0.115, z: -17.65 },
      { t: 5.74, x: -3.05, y: 0.20, z: -34.35, ease: 'linear' },
      { t: 7.767, x: -3.15, y: 0.115, z: -35.2 }
    ],
    pedriRibbon: [[5.4, 0.06, -13.6], [4.75, 0.06, -15.15], [1.85, 0.06, -15.75], [3.88, 0.06, -17.25], [-3.05, 0.12, -34.35]],
    overshootRibbon: [[3.6, 0.05, -18.8], [4.5, 0.05, -16.2], [6.8, 0.05, -15.4]]
  }
];
