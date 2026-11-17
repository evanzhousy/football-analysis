import * as THREE from 'three';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

/**
 * Evaluates a piecewise keyframe track [[t0, x0, z0, extra...], [t1, x1, z1, extra...], ...]
 */
export function sampleTrack(keyframes, t) {
  if (t <= keyframes[0].t) return { ...keyframes[0], speed: 0 };
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return { ...last, speed: 0 };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i];
    const k1 = keyframes[i + 1];
    if (t >= k0.t && t <= k1.t) {
      const dt = Math.max(0.0001, k1.t - k0.t);
      const rawU = (t - k0.t) / dt;
      const u = k1.ease === 'linear' ? rawU : rawU * rawU * (3 - 2 * rawU);

      const x = lerp(k0.x, k1.x, u);
      const z = lerp(k0.z, k1.z, u);
      const y = lerp(k0.y ?? 0.24, k1.y ?? 0.24, u);

      const dx = k1.x - k0.x;
      const dz = k1.z - k0.z;
      const dist = Math.hypot(dx, dz);
      const speed = dist / (dt * 6.0);

      const autoYaw = dist > 0.08 ? Math.atan2(dx, dz) : k0.yaw ?? 0;
      const yaw =
        k0.yaw !== undefined && k1.yaw !== undefined
          ? lerpAngle(k0.yaw, k1.yaw, u)
          : autoYaw;

      return {
        x,
        y,
        z,
        yaw,
        speed,
        headYaw: lerp(k0.headYaw ?? 0, k1.headYaw ?? 0, u),
        scanIntensity: lerp(k0.scan ?? 0, k1.scan ?? 0, u),
        shoulderRoll: lerp(k0.roll ?? 0, k1.roll ?? 0, u),
        crouch: lerp(k0.crouch ?? 0, k1.crouch ?? 0, u),
        shieldArm: lerp(k0.shield ?? 0, k1.shield ?? 0, u),
        fakeKick: lerp(k0.fakeKick ?? 0, k1.fakeKick ?? 0, u),
        lunge: lerp(k0.lunge ?? 0, k1.lunge ?? 0, u)
      };
    }
  }
  return { ...last, speed: 0 };
}

export const SCENARIOS = [
  {
    id: 'back-tight-half-turn',
    index: '01',
    title: '背身紧贴顶防 · 沉肩半转身顺球',
    moveName: '360° 扫描 + 沉肩虚晃半转身 (Scan & Body-Feint Half-Turn)',
    zoneTag: '中后场枢纽 (6/8号位)',
    matchRef: '直播吧录像：2026-11-09 马竞 1-2 巴萨（佩德里单核破首线）',
    pressureType: '单人正后方紧贴卡位 (1v1 Tight Back-Press)',
    metrics: {
      touches: '1 次顺球触球',
      feintAngle: '22° 左沉肩倾角',
      scans: '接球前 2 次回头',
      escapeWindow: '0.38 秒'
    },
    keypoints: [
      '球从后卫（#5 库巴西）传出瞬间，佩德里连续两次回头扫描（黄色视野锥），确认马竞中场紧贴其左后肩。',
      '触球前 0.2 秒上半身大幅向左沉肩虚晃，欺骗身后逼抢者重心向左侧横移封堵。',
      '皮球到达时右脚不做停顿，敞开右侧髋关节顺势半转身让球滚向右侧空当，一步甩开防守者直面进攻方向。'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：回头扫描观察', desc: '库巴西送出纵向直传，佩德里接球前两次扭头扫描盲侧，捕捉身后对手贴防重心。' },
      { range: [0.28, 0.52], label: '阶段2：左沉肩欺骗重心', desc: '球即将到脚，佩德里突然左倾沉肩佯装向左侧护球回传，诱使防守者向左跨步抢位。' },
      { range: [0.52, 0.78], label: '阶段3：敞髋半转身顺球', desc: '顺着来球惯性向右半转身外脚背轻顺，防守者因重心锁死扑空被彻底甩在身后！' },
      { range: [0.78, 1.0], label: '阶段4：破首线带球推进', desc: '一脚触球直接打穿首道压迫线，抬头加速推进至中圈开阔地带。' }
    ],
    defaultFocus: [0, 0, 8],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 0.0, z: 10.5, yaw: 0.0, headYaw: 1.8, scan: 1.0, crouch: 0.2 },
          { t: 0.16, x: 0.0, z: 11.2, yaw: 0.0, headYaw: -1.9, scan: 1.0, crouch: 0.25 },
          { t: 0.34, x: -0.35, z: 11.6, yaw: 0.15, headYaw: 0.0, scan: 0.2, roll: 0.38, crouch: 0.55 },
          { t: 0.50, x: 0.45, z: 11.2, yaw: 1.85, roll: -0.18, crouch: 0.45 },
          { t: 0.72, x: 2.3, z: 7.4, yaw: 2.82, crouch: 0.25 },
          { t: 1.0, x: 3.6, z: 1.2, yaw: 2.95, crouch: 0.1 }
        ]
      },
      {
        id: 'cb',
        role: 'teammate',
        number: '5',
        label: '#5 库巴西 (出球)',
        keyframes: [
          { t: 0.0, x: -1.2, z: 21.0, yaw: 3.08 },
          { t: 0.2, x: -1.0, z: 20.2, yaw: 3.08 },
          { t: 1.0, x: -0.5, z: 18.5, yaw: 3.1 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '14',
        label: '逼抢前腰 (贴背顶防)',
        keyframes: [
          { t: 0.0, x: 0.2, z: 8.2, yaw: 0.05 },
          { t: 0.28, x: -0.1, z: 10.2, yaw: -0.15, crouch: 0.3 },
          { t: 0.46, x: -1.35, z: 11.4, yaw: -0.45, lunge: 0.55 },
          { t: 0.68, x: -0.9, z: 10.6, yaw: 2.4, crouch: 0.2 },
          { t: 1.0, x: 1.4, z: 5.8, yaw: 2.85 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -0.9, z: 20.4 },
      { t: 0.38, x: 0.05, z: 11.5 },
      { t: 0.54, x: 0.95, z: 10.4 },
      { t: 0.75, x: 2.55, z: 6.8 },
      { t: 1.0, x: 3.8, z: 0.4 }
    ],
    pedriRibbon: [[0, 11.6], [-0.35, 11.6], [0.6, 11.0], [2.3, 7.4], [3.6, 1.2]],
    overshootRibbon: [[0.2, 8.2], [-0.1, 10.2], [-1.35, 11.4]]
  },

  {
    id: 'frontal-la-croqueta',
    index: '02',
    title: '正面高速封堵 · 伊涅斯塔式油炸丸子',
    moveName: '双脚内侧高频横拨顺趟 (La Croqueta)',
    zoneTag: '中场推进通道',
    matchRef: '直播吧录像：2026-10-18 皇家贝蒂斯 2-5 巴萨（132次触球统治中场）',
    pressureType: '正面单兵冲刺伸脚捅抢 (Frontal Closing-Down)',
    metrics: {
      touches: '0.22秒内左右双触',
      feintAngle: '横向微移 0.68m',
      scans: '抬头锁定出脚时机',
      escapeWindow: '0.28 秒'
    },
    keypoints: [
      '佩德里持球正面推进，将球刻意暴露在右脚前外侧，引诱正面冲刺的后腰跨步出脚捅球。',
      '在防守者支撑腿落地、重心完全锁死的瞬间，右脚内侧极快横拨至左脚（第1触）。',
      '左脚内侧毫不停顿顺势向前趟出（第2触），擦着防守球员伸出的脚尖控制半径完成纵向突破。'
    ],
    phases: [
      { range: [0.0, 0.30], label: '阶段1：持球引诱上抢', desc: '佩德里匀速带球逼近正面防线，将球亮在右脚侧诱使对方后腰果断上抢。' },
      { range: [0.30, 0.52], label: '阶段2：预判对手出脚锁死', desc: '对方后腰跨步伸长腿捅球，支撑脚钉死草皮无法二次变向。' },
      { range: [0.52, 0.74], label: '阶段3：油炸丸子双触横移', desc: '右脚内侧横敲左脚、左脚顺势前推，极窄幅度丝滑避开抢断脚尖！' },
      { range: [0.74, 1.0], label: '阶段4：加速掠过送出直塞', desc: '不降速掠过防守人身侧，随即送出穿透防线的斜塞球。' }
    ],
    defaultFocus: [0, 0, 2],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -0.6, z: 9.5, yaw: 3.12, headYaw: 0.25, scan: 0.6 },
          { t: 0.36, x: -0.4, z: 4.8, yaw: 3.10, crouch: 0.35, roll: -0.15 },
          { t: 0.50, x: -1.25, z: 3.4, yaw: 2.95, crouch: 0.65, roll: 0.24 },
          { t: 0.66, x: -1.45, z: 1.0, yaw: 3.12, crouch: 0.35 },
          { t: 1.0, x: -1.1, z: -4.2, yaw: 3.05, crouch: 0.15 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '6',
        label: '正面扑抢后腰',
        keyframes: [
          { t: 0.0, x: 0.1, z: -2.0, yaw: 0.0 },
          { t: 0.36, x: -0.15, z: 2.2, yaw: -0.08, crouch: 0.35 },
          { t: 0.52, x: 0.15, z: 3.3, yaw: -0.25, lunge: 0.92 },
          { t: 0.75, x: 0.35, z: 4.1, yaw: -0.4, lunge: 0.35 },
          { t: 1.0, x: 0.1, z: 2.5, yaw: 3.0 }
        ]
      },
      {
        id: 'fw',
        role: 'teammate',
        number: '7',
        label: '#7 费尔明 (前插)',
        keyframes: [
          { t: 0.0, x: 4.2, z: -6.5, yaw: 3.1 },
          { t: 0.65, x: 3.6, z: -9.5, yaw: 3.0 },
          { t: 1.0, x: 2.2, z: -14.2, yaw: 3.14 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -0.45, z: 8.8 },
      { t: 0.36, x: -0.2, z: 4.1 },
      { t: 0.48, x: -1.45, z: 3.1 },
      { t: 0.66, x: -1.48, z: 0.3 },
      { t: 0.80, x: -1.1, z: -3.2 },
      { t: 1.0, x: 2.1, z: -13.6 }
    ],
    pedriRibbon: [[-0.6, 9.5], [-0.4, 4.8], [-1.35, 3.3], [-1.45, 1.0], [-1.1, -4.2]],
    overshootRibbon: [[0.1, -2.0], [-0.15, 2.2], [0.35, 4.1]]
  },

  {
    id: 'central-double-press-roulette',
    index: '03',
    title: '中圈双人V字夹击 · 脚底拉球马赛回旋',
    moveName: '诱敌合拢 + 脚底双拉旋转换向 (Sole Drag-Back Roulette)',
    zoneTag: '中圈压迫陷阱',
    matchRef: '直播吧录像：2026-11-09 马竞 1-2 巴萨（破解西蒙尼中路双人绞杀）',
    pressureType: '一前一侧双人V字包夹 (2v1 V-Trap)',
    metrics: {
      touches: '双脚底连续2次拉球',
      feintAngle: '240° 背身旋转护球',
      scans: '余光捕捉侧翼夹击角',
      escapeWindow: '0.52 秒'
    },
    keypoints: [
      '面对正面封堵者与侧翼合围者构成的 V 字陷阱，先向两人中间缝隙佯装加速，诱导双人同时向内收缩。',
      '在包围圈闭合前半拍，右脚底踩球向后急拉，同时以支撑脚为轴背身旋转，用躯干严密隔开侧方抢断者。',
      '旋转至 180°~240° 时左脚脚底顺势将球拉向右侧无人空当，瞬间令两名防守人撞在同一区域。'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：V字包夹形成', desc: '两名中场一正一侧高速合围，切断正面直传路线。' },
      { range: [0.28, 0.50], label: '阶段2：佯装钻缝诱敌收缩', desc: '佩德里向两人夹缝带球一步，把两名防守人重心同时吸向中心点。' },
      { range: [0.50, 0.78], label: '阶段3：脚底拉球背身回旋', desc: '右脚底急停回拉+背身旋转护球，左脚底将球拉出包围圈外侧！' },
      { range: [0.78, 1.0], label: '阶段4：横向脱困转移弱侧', desc: '两人因惯性撞作一团，佩德里从容带球切向弱侧开阔走廊。' }
    ],
    defaultFocus: [0, 0, 6],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -1.5, z: 10.5, yaw: 3.05, headYaw: -0.9, scan: 0.85 },
          { t: 0.34, x: -0.8, z: 6.6, yaw: 3.0, crouch: 0.45 },
          { t: 0.52, x: -0.2, z: 6.2, yaw: 1.3, crouch: 0.6, roll: 0.2 },
          { t: 0.68, x: 1.1, z: 5.8, yaw: -1.6, crouch: 0.5 },
          { t: 0.84, x: 2.9, z: 4.2, yaw: 2.55, crouch: 0.25 },
          { t: 1.0, x: 5.4, z: 1.4, yaw: 2.45 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '5',
        label: '正面封堵中场',
        keyframes: [
          { t: 0.0, x: -0.6, z: 1.2, yaw: 0.0 },
          { t: 0.42, x: -0.6, z: 5.0, yaw: -0.1, crouch: 0.4 },
          { t: 0.62, x: -0.8, z: 5.7, yaw: 0.4, lunge: 0.7 },
          { t: 1.0, x: 1.2, z: 4.5, yaw: 2.1 }
        ]
      },
      {
        id: 'def2',
        role: 'defender',
        number: '8',
        label: '侧翼合围中场',
        keyframes: [
          { t: 0.0, x: -5.8, z: 6.8, yaw: 1.55 },
          { t: 0.42, x: -2.0, z: 6.2, yaw: 1.48, crouch: 0.4 },
          { t: 0.62, x: -1.1, z: 6.0, yaw: 1.5, lunge: 0.65 },
          { t: 1.0, x: 0.9, z: 5.2, yaw: 2.2 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -1.4, z: 9.8 },
      { t: 0.34, x: -0.8, z: 5.9 },
      { t: 0.52, x: 0.25, z: 6.3 },
      { t: 0.68, x: 1.6, z: 5.5 },
      { t: 1.0, x: 5.9, z: 0.8 }
    ],
    pedriRibbon: [[-1.5, 10.5], [-0.8, 6.6], [0.2, 6.2], [1.6, 5.6], [5.4, 1.4]],
    overshootRibbon: [[-5.8, 6.8], [-2.0, 6.2], [-1.0, 6.0]]
  },

  {
    id: 'touchline-trap-cruyff-cut',
    index: '04',
    title: '边线死角围抢 · 假传真扣V字内切',
    moveName: '克鲁伊夫扣球 / 脚底V字拉球 (Cruyff Cut / V-Pull)',
    zoneTag: '左路边线走廊',
    matchRef: '直播吧录像：2026-11-01 巴萨 6-1 阿拉维斯（边肋游走破密集夹防）',
    pressureType: '边线天然屏障 + 前后双人夹角 (Touchline Trap)',
    metrics: {
      touches: '摆腿假传 + 135°回扣',
      feintAngle: '135° 锐角折返内切',
      scans: '观察内侧肋部空当',
      escapeWindow: '0.35 秒'
    },
    keypoints: [
      '拉边接应时左侧紧靠边线（丧失 180° 空间），对方边后卫正面顶防、边锋回追封死回传通道。',
      '大幅扬起右腿做出沿边线强行长传下底的动作，诱使正面防守者重心全力前扑封堵传球脚面。',
      '右脚内侧突然从支撑腿后方将球 135° 斜向扣回肋部内侧（克鲁伊夫转身/V字拉球），目送对手滑出场外。'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：边线死角受困', desc: '佩德里在左路边线接球，边线与两名防守球员形成三面合围。' },
      { range: [0.28, 0.52], label: '阶段2：大幅摆腿假传下底', desc: '高抬右腿佯装沿边线起球长传，诱骗正面边卫全力跨步封堵。' },
      { range: [0.52, 0.76], label: '阶段3：135°锐角克鲁伊夫回扣', desc: '脚内侧从支撑脚后方将球扣向中路肋部，追防者冲势过猛滑过身位！' },
      { range: [0.76, 1.0], label: '阶段4：切入肋部走廊组织', desc: '从边线死角豁然开朗进入左肋部（Half-space），从容横传调度。' }
    ],
    defaultFocus: [-19, 0, 3],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -24.5, z: 7.5, yaw: 3.1, headYaw: -1.2, scan: 0.9 },
          { t: 0.32, x: -25.2, z: 3.5, yaw: 3.12, fakeKick: 0.95, crouch: 0.3 },
          { t: 0.50, x: -24.8, z: 3.2, yaw: 1.95, fakeKick: 0.0, crouch: 0.6, roll: 0.3 },
          { t: 0.72, x: -20.8, z: 4.5, yaw: 1.35, crouch: 0.25 },
          { t: 1.0, x: -15.2, z: 2.2, yaw: 2.1 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '2',
        label: '正面封堵边卫',
        keyframes: [
          { t: 0.0, x: -24.6, z: -2.0, yaw: 0.0 },
          { t: 0.36, x: -25.0, z: 1.8, yaw: 0.05, crouch: 0.4 },
          { t: 0.54, x: -25.6, z: 3.0, yaw: -0.2, lunge: 0.9 },
          { t: 0.78, x: -26.2, z: 4.2, yaw: -0.3, lunge: 0.3 },
          { t: 1.0, x: -22.5, z: 3.8, yaw: 1.5 }
        ]
      },
      {
        id: 'def2',
        role: 'defender',
        number: '11',
        label: '回追夹击边锋',
        keyframes: [
          { t: 0.0, x: -22.0, z: 11.2, yaw: -2.8 },
          { t: 0.45, x: -23.6, z: 6.4, yaw: -3.0 },
          { t: 0.66, x: -24.2, z: 4.6, yaw: -2.9, lunge: 0.45 },
          { t: 1.0, x: -19.5, z: 4.2, yaw: 1.7 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -24.6, z: 6.8 },
      { t: 0.34, x: -25.2, z: 2.8 },
      { t: 0.52, x: -23.8, z: 3.6 },
      { t: 0.74, x: -20.1, z: 4.4 },
      { t: 1.0, x: -14.5, z: 1.8 }
    ],
    pedriRibbon: [[-24.5, 7.5], [-25.2, 3.5], [-23.8, 3.7], [-20.8, 4.5], [-15.2, 2.2]],
    overshootRibbon: [[-24.6, -2.0], [-25.0, 1.8], [-26.2, 4.2]]
  },

  {
    id: 'blind-side-la-pausa',
    index: '05',
    title: '两线间盲侧偷袭 · La Pausa 急停假传',
    moveName: '节奏冻结“La Pausa” + 假直塞扣球 (Tempo Freeze & Cut)',
    zoneTag: '肋部口袋 (Pocket)',
    matchRef: '直播吧录像：2026-11-01 巴萨 6-1 阿拉维斯 & TA 153次破防线解析',
    pressureType: '前有后卫封线 + 盲侧后腰斜向偷袭 (Blind-Side Press)',
    metrics: {
      touches: '减速停顿 + 横拨变向',
      feintAngle: '90° 横切闪开盲侧扑抢',
      scans: '接球前锁定盲侧追兵速度',
      escapeWindow: '0.42 秒'
    },
    keypoints: [
      '在对方中场线与后卫线之间的窄缝接球，余光扫描到右侧盲区有一名后腰正全速斜插偷袭。',
      '施展巴萨传统精髓“La Pausa”——故意降速停顿半拍，诱使盲侧偷袭者以为有机可乘而全力冲刺伸脚。',
      '在偷袭者踏入抢断半径的瞬间，假装直塞前锋实则左脚将球横向左拨，令盲侧追兵直接从面前飞掠而过，随即直塞打穿后卫线！'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：口袋区接球扫描盲侧', desc: '佩德里在两线间空当接球，提前偏头扫描发现右后盲侧高速扑来的后腰。' },
      { range: [0.28, 0.52], label: '阶段2：La Pausa 慢半拍诱敌', desc: '刻意放慢脚步冻结时间，等盲侧防守者冲刺到无法刹车的临界点。' },
      { range: [0.52, 0.76], label: '阶段3：假直塞横向拨球闪避', desc: '摆腿假直塞后突然向左侧横拨一步，盲侧扑抢者直接滑过面前空当！' },
      { range: [0.76, 1.0], label: '阶段4：手术刀直塞打穿防线', desc: '利用闪出的干净走廊，送出穿透整条后卫线的贴地直塞找亚马尔。' }
    ],
    defaultFocus: [3, 0, -7],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: 4.0, z: -3.5, yaw: 3.1, headYaw: -1.5, scan: 1.0 },
          { t: 0.34, x: 3.8, z: -5.8, yaw: 3.12, headYaw: -0.9, scan: 0.6, crouch: 0.45, fakeKick: 0.75 },
          { t: 0.54, x: 1.6, z: -6.2, yaw: -1.8, fakeKick: 0.0, crouch: 0.55, roll: 0.25 },
          { t: 0.74, x: 0.4, z: -7.6, yaw: 3.05, crouch: 0.3 },
          { t: 1.0, x: 0.2, z: -9.0, yaw: 2.95 }
        ]
      },
      {
        id: 'def_blind',
        role: 'defender',
        number: '16',
        label: '盲侧偷袭后腰',
        keyframes: [
          { t: 0.0, x: 9.8, z: -1.5, yaw: -2.1 },
          { t: 0.40, x: 5.2, z: -5.2, yaw: -2.0, crouch: 0.4 },
          { t: 0.58, x: 3.4, z: -6.6, yaw: -2.05, lunge: 0.92 },
          { t: 0.80, x: 2.2, z: -7.8, yaw: -2.1, lunge: 0.25 },
          { t: 1.0, x: 1.8, z: -8.4, yaw: -2.6 }
        ]
      },
      {
        id: 'def_cb',
        role: 'defender',
        number: '4',
        label: '顶防中卫 (封直塞)',
        keyframes: [
          { t: 0.0, x: 3.8, z: -13.0, yaw: 0.0 },
          { t: 0.50, x: 3.6, z: -11.5, yaw: 0.05, crouch: 0.35 },
          { t: 0.80, x: 2.4, z: -11.8, yaw: -0.35, lunge: 0.4 },
          { t: 1.0, x: 2.2, z: -13.5, yaw: 2.9 }
        ]
      },
      {
        id: 'yamal',
        role: 'teammate',
        number: '10',
        label: '#10 亚马尔 (反越位)',
        keyframes: [
          { t: 0.0, x: 7.5, z: -12.5, yaw: 3.1 },
          { t: 0.65, x: 5.8, z: -14.2, yaw: 2.8 },
          { t: 1.0, x: 3.2, z: -19.5, yaw: 3.05 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 4.0, z: -4.2 },
      { t: 0.36, x: 3.8, z: -6.4 },
      { t: 0.55, x: 1.2, z: -6.6 },
      { t: 0.74, x: 0.4, z: -8.3 },
      { t: 1.0, x: 3.1, z: -19.0 }
    ],
    pedriRibbon: [[4.0, -3.5], [3.8, -5.8], [1.6, -6.2], [0.4, -7.6], [0.2, -9.0]],
    overshootRibbon: [[9.8, -1.5], [5.2, -5.2], [2.2, -7.8]]
  },

  {
    id: 'pressing-cage-third-man',
    index: '06',
    title: '三角笼式围抢 · 吸怪撞墙与第三人跑位',
    moveName: '主动吸怪 + 双后腰一脚撞墙 (Press-Baiting One-Two)',
    zoneTag: '中场组织核心区',
    matchRef: '直播吧录像：2026-10-18 贝蒂斯 2-5 巴萨（佩德里+罗德里230传破围抢）',
    pressureType: '3人三角包围圈 + 遮挡传球阴影 (3-Man Pressing Cage)',
    metrics: {
      touches: '控球吸怪 + 外脚背一脚出球',
      feintAngle: '盲侧无球绕跑 6.5m',
      scans: '提前确认双后腰搭档站位',
      escapeWindow: '1.10 秒团队联动'
    },
    keypoints: [
      '当对手 3 人形成严密三角笼（Cover Shadow 封死所有向前盘带角度）时，强行 1v3 盘带是中场大忌。',
      '佩德里反而多控半秒球主动将 3 名防守人吸引收缩至身边（“吸铁石效应”），彻底腾空搭档 #16 罗德里身前的走廊。',
      '外脚背从夹缝斜敲罗德里后立刻从防守人盲侧无球前插，罗德里不停球一脚直塞回敲，瞬间打穿三人包围圈！'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：三角压迫笼成型', desc: '对手三名中前场呈三角形合围，利用防守阴影切断直传线路。' },
      { range: [0.28, 0.50], label: '阶段2：控球吸怪收缩防线', desc: '佩德里冷静护球吸引三人同时上抢收缩，为身旁罗德里创造巨大空当。' },
      { range: [0.50, 0.76], label: '阶段3：斜敲搭档+盲侧前插', desc: '外脚背分球给 #16 罗德里，随即加速从防守者身后盲区前插跑位！' },
      { range: [0.76, 1.0], label: '阶段4：一脚撞墙破笼推进', desc: '罗德里迎球一脚斜传打穿防线，佩德里在包围圈后方轻松接球推进。' }
    ],
    defaultFocus: [0, 0, 5],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -2.2, z: 9.2, yaw: 3.1, headYaw: -1.1, scan: 0.9 },
          { t: 0.36, x: -1.8, z: 7.2, yaw: 2.3, crouch: 0.4 },
          { t: 0.52, x: -1.2, z: 6.8, yaw: 2.9, crouch: 0.25 },
          { t: 0.78, x: -0.6, z: 1.8, yaw: 3.08 },
          { t: 1.0, x: -0.2, z: -2.8, yaw: 3.12 }
        ]
      },
      {
        id: 'rodri',
        role: 'teammate',
        number: '16',
        label: '#16 罗德里 (撞墙支点)',
        keyframes: [
          { t: 0.0, x: 4.6, z: 9.8, yaw: -2.8 },
          { t: 0.45, x: 4.2, z: 7.8, yaw: -2.7 },
          { t: 0.64, x: 3.9, z: 7.0, yaw: -2.65, crouch: 0.25 },
          { t: 1.0, x: 3.4, z: 5.2, yaw: 3.1 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '9',
        label: '回抢前锋',
        keyframes: [
          { t: 0.0, x: -3.5, z: 11.8, yaw: 2.8 },
          { t: 0.44, x: -2.4, z: 8.2, yaw: 2.9, crouch: 0.35 },
          { t: 0.75, x: -1.5, z: 6.8, yaw: 2.6 },
          { t: 1.0, x: -1.0, z: 4.0, yaw: 3.0 }
        ]
      },
      {
        id: 'def2',
        role: 'defender',
        number: '8',
        label: '正面封锁中场',
        keyframes: [
          { t: 0.0, x: -1.8, z: 2.6, yaw: 0.0 },
          { t: 0.44, x: -1.9, z: 5.4, yaw: 0.1, crouch: 0.4 },
          { t: 0.68, x: 0.6, z: 5.8, yaw: 1.4, lunge: 0.45 },
          { t: 1.0, x: 0.4, z: 2.0, yaw: 3.0 }
        ]
      },
      {
        id: 'def3',
        role: 'defender',
        number: '20',
        label: '侧翼压迫前腰',
        keyframes: [
          { t: 0.0, x: -6.2, z: 6.4, yaw: 1.5 },
          { t: 0.44, x: -3.3, z: 6.8, yaw: 1.55, crouch: 0.4 },
          { t: 0.75, x: -2.0, z: 6.2, yaw: 2.2 },
          { t: 1.0, x: -1.4, z: 3.2, yaw: 2.9 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -2.1, z: 8.6 },
      { t: 0.42, x: -1.5, z: 7.0 },
      { t: 0.62, x: 3.7, z: 7.1 },
      { t: 0.84, x: -0.4, z: 0.9 },
      { t: 1.0, x: -0.1, z: -3.5 }
    ],
    pedriRibbon: [[-2.2, 9.2], [-1.8, 7.2], [-0.9, 4.5], [-0.6, 1.8], [-0.2, -2.8]],
    overshootRibbon: [[-1.8, 2.6], [-1.9, 5.4], [0.6, 5.8]]
  },

  {
    id: 'transition-shield-far-foot',
    index: '07',
    title: '转换追击冲撞 · 远端脚卡位急停变向',
    moveName: '低重心卡身位护球 + 借力急停外拨 (Body Shield & Stop-Turn)',
    zoneTag: '攻防转换枢纽',
    matchRef: '直播吧录像：2026-11-09 马竞 1-2 巴萨（全场5次抢断+3次造犯规）',
    pressureType: '侧后方高速身体对抗反抢 (Gegenpress Recovery Duel)',
    metrics: {
      touches: '远端右脚控球 + 外脚背急停',
      feintAngle: '降低重心 16cm + 左臂屏障',
      scans: '触觉感知对手发力冲撞方向',
      escapeWindow: '0.45 秒'
    },
    keypoints: [
      '由守转攻刚夺回球权瞬间，对方身体强悍的中场从左侧后方全速贴身冲撞试图反抢。',
      '立刻沉髋屈膝降低重心，张开左前臂建立合法身体屏障，始终将球放在最远离对手的右脚外侧（“对手—身体—球”三点一线）。',
      '感知到对手全力向前顶撞的一刹那，右脚突然踩球急停并向外侧 90° 拨球转身，让对手因自身冲撞惯性向前踉跄失位！'
    ],
    phases: [
      { range: [0.0, 0.28], label: '阶段1：断球转换遭遇反抢', desc: '佩德里赢下球权推进，对手强壮中场从左后侧高速追击贴身对抗。' },
      { range: [0.28, 0.54], label: '阶段2：张臂沉髋+远端脚护球', desc: '屈膝降重心，架起左臂隔绝抢断路线，用远端右脚牢牢控球。' },
      { range: [0.54, 0.78], label: '阶段3：借力急停外脚背转身', desc: '借对手向前发力冲撞瞬间突然踩球急停右转，对手收不住脚冲过头！' },
      { range: [0.78, 1.0], label: '阶段4：摆脱纠缠稳健转移', desc: '彻底甩开贴身肉搏（或迫使对手背后推人犯规），从容抬头组织进攻。' }
    ],
    defaultFocus: [1, 0, 5],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -0.5, z: 11.0, yaw: 3.05, crouch: 0.25 },
          { t: 0.30, x: 0.2, z: 6.8, yaw: 3.0, crouch: 0.65, shield: 0.95, roll: -0.18 },
          { t: 0.52, x: 0.6, z: 4.2, yaw: 2.95, crouch: 0.75, shield: 1.0, roll: -0.22 },
          { t: 0.68, x: 2.1, z: 4.6, yaw: 1.45, crouch: 0.4, shield: 0.2 },
          { t: 1.0, x: 5.8, z: 3.2, yaw: 1.85, crouch: 0.15 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '14',
        label: '反抢对抗中场',
        keyframes: [
          { t: 0.0, x: -2.6, z: 12.2, yaw: 2.75 },
          { t: 0.32, x: -0.65, z: 7.0, yaw: 2.95, crouch: 0.45 },
          { t: 0.54, x: -0.25, z: 4.1, yaw: 3.02, lunge: 0.45 },
          { t: 0.74, x: -0.1, z: 1.4, yaw: 3.1, lunge: 0.65 },
          { t: 1.0, x: 1.5, z: 1.8, yaw: 1.6 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -0.2, z: 10.3 },
      { t: 0.30, x: 0.65, z: 6.3 },
      { t: 0.52, x: 1.05, z: 3.9 },
      { t: 0.68, x: 2.6, z: 4.5 },
      { t: 1.0, x: 6.5, z: 2.9 }
    ],
    pedriRibbon: [[-0.5, 11.0], [0.2, 6.8], [0.6, 4.2], [2.1, 4.6], [5.8, 3.2]],
    overshootRibbon: [[-2.6, 12.2], [-0.65, 7.0], [-0.1, 1.4]]
  },

  {
    id: 'zone14-double-fakeshot',
    index: '08',
    title: '禁区弧顶飞铲封堵 · 连续假射真扣破门',
    moveName: '高摆腿连续假射真扣 + 低射死角 (Zone 14 Double Fake-Shot)',
    zoneTag: '14号核心区 (禁区弧顶)',
    matchRef: '直播吧视频集锦：《22年对阵塞维利亚的佩德里》& 26-11-09 战马竞第45分钟',
    pressureType: '禁区前沿多人飞身滑铲封堵 (Box-Edge Desperate Block)',
    metrics: {
      touches: '2次假射横拉 + 贴地斩',
      feintAngle: '晃飞2名滑铲防守球员',
      scans: '射门前锁定门将站位死角',
      escapeWindow: '0.32 秒/次扣球'
    },
    keypoints: [
      '在禁区弧顶（Zone 14）接边路横敲，空间高度压缩，防守球员为防远射往往选择不惜一切飞身滑铲封堵射门扇面。',
      '第1次高扬右腿假装迎球怒射，诱使扑抢后腰飞身滑铲，脚内侧轻巧向右横拉闪出第一步。',
      '补防中卫紧接着倒地封堵，佩德里再做第2次假射扣球晃过中卫，在电光石火间推射球门左下死角入网！'
    ],
    phases: [
      { range: [0.0, 0.25], label: '阶段1：弧顶接横传观察门前', desc: '边路队友横敲禁区弧顶，佩德里接球抬头观察，两名防守者迅速扑出封堵。' },
      { range: [0.25, 0.50], label: '阶段2：第1次假射晃飞后腰', desc: '大幅扬腿佯装抽射，1号封堵者飞身滑铲掠过草皮，佩德里冷静横拉闪开！' },
      { range: [0.50, 0.76], label: '阶段3：第2次假射再过补防中卫', desc: '中卫紧跟着扑上来封堵，佩德里再扣一步彻底晃空整条弧顶防线！' },
      { range: [0.76, 1.0], label: '阶段4：低射贴地斩直挂死角', desc: '在完全干净的射门走廊内推射球门远角破门，复刻诺坎普传世名场面！' }
    ],
    defaultFocus: [0, 0, -19],
    actors: [
      {
        id: 'pedri',
        role: 'pedri',
        number: '8',
        label: '#8 佩德里 Pedri',
        keyframes: [
          { t: 0.0, x: -3.2, z: -15.2, yaw: 3.1, headYaw: 0.3, scan: 0.7 },
          { t: 0.24, x: -2.2, z: -15.6, yaw: 3.12, fakeKick: 1.0, crouch: 0.3 },
          { t: 0.42, x: -0.2, z: -15.8, yaw: 1.8, fakeKick: 0.0, crouch: 0.55, roll: -0.25 },
          { t: 0.56, x: 0.6, z: -16.1, yaw: 3.1, fakeKick: 0.95, crouch: 0.35 },
          { t: 0.72, x: 2.3, z: -16.5, yaw: 2.85, fakeKick: 0.0, crouch: 0.5 },
          { t: 1.0, x: 2.6, z: -17.2, yaw: 3.05, crouch: 0.2 }
        ]
      },
      {
        id: 'winger',
        role: 'teammate',
        number: '10',
        label: '#10 边路横敲队友',
        keyframes: [
          { t: 0.0, x: -11.5, z: -16.5, yaw: 1.45 },
          { t: 1.0, x: -9.8, z: -17.2, yaw: 2.6 }
        ]
      },
      {
        id: 'def1',
        role: 'defender',
        number: '10',
        label: '飞铲封堵后腰',
        keyframes: [
          { t: 0.0, x: -1.5, z: -19.2, yaw: -0.2 },
          { t: 0.26, x: -2.0, z: -16.8, yaw: -0.1, crouch: 0.4 },
          { t: 0.44, x: -3.1, z: -15.5, yaw: -0.6, lunge: 1.0 },
          { t: 1.0, x: -3.5, z: -15.0, yaw: -0.6, lunge: 0.6 }
        ]
      },
      {
        id: 'def2',
        role: 'defender',
        number: '3',
        label: '补防滑铲中卫',
        keyframes: [
          { t: 0.0, x: 2.2, z: -21.0, yaw: -0.25 },
          { t: 0.48, x: 0.8, z: -17.8, yaw: -0.15, crouch: 0.45 },
          { t: 0.68, x: -0.4, z: -16.3, yaw: -0.5, lunge: 1.0 },
          { t: 1.0, x: -0.9, z: -15.9, yaw: -0.5, lunge: 0.65 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -10.8, z: -16.4 },
      { t: 0.22, x: -2.1, z: -16.1 },
      { t: 0.42, x: 0.1, z: -16.3 },
      { t: 0.56, x: 0.7, z: -16.6 },
      { t: 0.74, x: 2.5, z: -17.1 },
      { t: 1.0, x: -3.1, z: -33.8 }
    ],
    pedriRibbon: [[-3.2, -15.2], [-2.2, -15.6], [-0.2, -15.8], [0.6, -16.1], [2.3, -16.5], [2.6, -17.2]],
    overshootRibbon: [[2.2, -21.0], [0.8, -17.8], [-0.9, -15.9]]
  }
];
