import { getAtomicClip, compileActionSequence } from './atomicMotionAssembler.js';

/**
 * Multi-Clip Complex Football Action Sequences assembled strictly from the 86-clip
 * White-Model Optical-Mocap Atomic Library (`SOCCER_ATOMIC_CATALOG`).
 *
 * Every segment specifies:
 *   - `clipId`: Canonical atomic clip in `assets/mocap_atomic/*.glb`
 *   - `durationSec`: Exact master-clock span locked 1:1 to the real match video
 *   - `endFacingYaw`: Body facing yaw at segment exit (radians)
 *   - `endAnchor`: Exact tactical ground waypoint `[x, z]` (stride-matched via `warpScale`)
 *   - `blendSec`: C2 quintic inertialization transition window across the seam
 *   - `note`: Biomechanical / tactical phase label displayed in the Assembly Strip UI
 */
export const SCENARIO_ASSEMBLED_SEQUENCES = {
  // ============================================================================
  // S01: Barça vs Mallorca (4.00s) — Pedri Scan + Split-Lunge Aerial Cushion + Tight Turn + Burst
  // ============================================================================
  'back-tight-half-turn': {
    pedri: {
      id: 'seq_s01_pedri',
      startX: 1.12,
      startZ: 7.45,
      startYaw: 0.12,
      segments: [
        {
          clipId: 'loco_walk_back',
          durationSec: 1.15,
          endFacingYaw: -0.35,
          endAnchor: [1.26, 8.38],
          note: '迎高球回撤扫描'
        },
        {
          clipId: 'turn_shield_pivot_90_r',
          clipIn: 0.08,
          clipOut: 0.96,
          durationSec: 0.77,
          blendSec: 0.22,
          endFacingYaw: -2.42,
          endAnchor: [1.40, 8.48],
          note: '提前敞髋卡位#30'
        },
        {
          clipId: 'touch_diag_take_r',
          clipIn: 0.04,
          clipOut: 0.84,
          durationSec: 0.78,
          blendSec: 0.20,
          endFacingYaw: -2.82,
          endAnchor: [1.68, 8.08],
          note: '左脚扎轴+右足凌空卸顺高球'
        },
        {
          clipId: 'turn_tight_r',
          clipIn: 0.12,
          clipOut: 1.18,
          durationSec: 0.62,
          blendSec: 0.20,
          endFacingYaw: 2.22,
          endAnchor: [2.72, 5.65],
          note: '顺时针紧凑急转抹人'
        },
        {
          clipId: 'loco_ball_run_fast',
          clipIn: 0.0,
          clipOut: 0.84,
          durationSec: 0.68,
          blendSec: 0.20,
          endFacingYaw: 2.15,
          endAnchor: [4.35, 1.85],
          note: '高速持球爆发突进'
        }
      ]
    },
    mallorca30: {
      id: 'seq_s01_mallorca30',
      startX: 0.65,
      startZ: 5.20,
      startYaw: 0.08,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.55,
          endFacingYaw: 0.16,
          endAnchor: [0.56, 7.88],
          note: '后背猛扑贴抢'
        },
        {
          clipId: 'def_press_brake_r',
          clipIn: 0.12,
          clipOut: 1.98,
          durationSec: 1.38,
          blendSec: 0.22,
          endFacingYaw: 0.58,
          endAnchor: [0.36, 8.96],
          note: '上抢冲过头急刹失位'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 1.07,
          blendSec: 0.24,
          endFacingYaw: 2.28,
          endAnchor: [2.25, 5.35],
          note: '转身追防'
        }
      ]
    }
  },

  // ============================================================================
  // S02: Barça vs Rayo Vallecano (6.50s) — Halfway-Line La Pausa + 120Hz La Croqueta
  // ============================================================================
  'frontal-la-croqueta': {
    pedri: {
      id: 'seq_s02_pedri',
      startX: 5.20,
      startZ: 5.80,
      startYaw: 0.25,
      segments: [
        {
          clipId: 'touch_cushion_step_r',
          clipIn: 0.05,
          clipOut: 1.45,
          durationSec: 1.62,
          endFacingYaw: -0.15,
          endAnchor: [4.56, 6.44],
          note: '中线迎球轻卸扫描'
        },
        {
          clipId: 'loco_evasive_walk_l',
          clipIn: 0.12,
          clipOut: 1.62,
          durationSec: 1.26,
          blendSec: 0.22,
          endFacingYaw: -0.25,
          endAnchor: [4.02, 7.28],
          note: 'La Pausa 碎步诱敌关门'
        },
        {
          clipId: 'skill_croqueta_rl',
          clipIn: 0.08,
          clipOut: 1.80,
          durationSec: 1.16,
          blendSec: 0.20,
          endFacingYaw: -0.34,
          endAnchor: [2.22, 10.02],
          note: '油炸丸子双足内侧穿双人缝'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.26,
          blendSec: 0.22,
          endFacingYaw: -0.58,
          endAnchor: [0.45, 13.60],
          note: '切入中圈开阔地推进'
        },
        {
          clipId: 'kick_pass_inside_r',
          clipIn: 0.08,
          clipOut: 1.56,
          durationSec: 1.20,
          blendSec: 0.22,
          endFacingYaw: -0.95,
          endAnchor: [-0.15, 14.30],
          note: '右足内侧精准推传分边'
        }
      ]
    },
    rayo23: {
      id: 'seq_s02_rayo23',
      startX: 1.60,
      startZ: 9.40,
      startYaw: 2.75,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.35,
          endFacingYaw: 2.86,
          endAnchor: [2.38, 8.55],
          note: '上侧收缩包夹'
        },
        {
          clipId: 'def_bite_feint_r',
          clipIn: 0.10,
          clipOut: 1.98,
          durationSec: 1.65,
          blendSec: 0.22,
          endFacingYaw: 2.25,
          endAnchor: [2.95, 7.35],
          note: '吃晃伸脚扑空急停'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.50,
          blendSec: 0.24,
          endFacingYaw: -0.25,
          endAnchor: [1.40, 11.20],
          note: '转身回追'
        }
      ]
    },
    rayo6: {
      id: 'seq_s02_rayo6',
      startX: 6.50,
      startZ: 9.20,
      startYaw: -2.20,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.40,
          endFacingYaw: -2.48,
          endAnchor: [5.05, 8.38],
          note: '下侧合拢关门'
        },
        {
          clipId: 'def_bite_feint_l',
          clipIn: 0.10,
          clipOut: 1.98,
          durationSec: 1.65,
          blendSec: 0.22,
          endFacingYaw: -1.45,
          endAnchor: [3.95, 7.25],
          note: '关门被穿急刹失位'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.45,
          blendSec: 0.24,
          endFacingYaw: -0.35,
          endAnchor: [2.20, 11.60],
          note: '转身回追'
        }
      ]
    }
  },

  // ============================================================================
  // S03: UCL Barça vs PSG (5.60s) — Triple-Press 360° Marseille Spin Break
  // ============================================================================
  'central-double-press-roulette': {
    pedri: {
      id: 'seq_s03_pedri',
      startX: 2.20,
      startZ: 7.40,
      startYaw: -2.60,
      segments: [
        {
          clipId: 'touch_diag_take_l',
          durationSec: 1.65,
          endFacingYaw: -2.85,
          endAnchor: [1.75, 6.25],
          note: '中圈接应迎球领入包夹区'
        },
        {
          clipId: 'skill_spin_break_l',
          clipIn: 0.02,
          clipOut: 1.42,
          durationSec: 1.52,
          blendSec: 0.20,
          endFacingYaw: -2.68,
          endAnchor: [0.25, 4.15],
          note: '120Hz 全周回旋踩拉球破三人围抢'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 1.23,
          blendSec: 0.22,
          endFacingYaw: -2.65,
          endAnchor: [-1.45, 2.15],
          note: '破围加速推进'
        },
        {
          clipId: 'kick_pass_inside_r',
          clipIn: 0.08,
          clipOut: 1.56,
          durationSec: 1.20,
          blendSec: 0.22,
          endFacingYaw: -2.15,
          endAnchor: [-2.05, 1.55],
          note: '右足内侧横向分球'
        }
      ]
    }
  },

  // ============================================================================
  // S04: Touchline Trap Cruyff Chop (6.434s)
  // ============================================================================
  'touchline-trap-cruyff-cut': {
    pedri: {
      id: 'seq_s04_pedri',
      startX: 24.20,
      startZ: 2.60,
      startYaw: -2.92,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.85,
          endFacingYaw: -3.05,
          endAnchor: [25.80, -2.80],
          note: '沿边线持球诱敌深入'
        },
        {
          clipId: 'loco_evasive_walk_r',
          clipIn: 0.20,
          clipOut: 1.55,
          durationSec: 0.98,
          blendSec: 0.20,
          endFacingYaw: -3.08,
          endAnchor: [26.10, -3.70],
          note: '边线急刹护球架盾'
        },
        {
          clipId: 'skill_fakeshot_break_l',
          clipIn: 0.15,
          clipOut: 2.25,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -0.98,
          endAnchor: [21.80, -1.35],
          note: '克鲁伊夫假传真扣急折内切'
        },
        {
          clipId: 'loco_tight_arc_l',
          clipIn: 0.05,
          clipOut: 1.20,
          durationSec: 1.05,
          blendSec: 0.22,
          endFacingYaw: -1.15,
          endAnchor: [16.20, 1.10],
          note: '摆脱边线包夹横向突进'
        },
        {
          clipId: 'kick_pass_inside_r',
          clipIn: 0.08,
          clipOut: 1.56,
          durationSec: 1.404,
          blendSec: 0.22,
          endFacingYaw: -1.65,
          endAnchor: [14.80, 1.30],
          note: '脚内侧转移弱侧中路'
        }
      ]
    }
  },

  // ============================================================================
  // S05: Blind-Side Turn & La Pausa Through-Ball vs Atleti (10.534s)
  // ============================================================================
  'blind-side-la-pausa': {
    pedri: {
      id: 'seq_s05_pedri',
      startX: 1.80,
      startZ: 7.50,
      startYaw: 0.25,
      segments: [
        {
          clipId: 'stance_ball_scan',
          durationSec: 1.15,
          endFacingYaw: 0.20,
          endAnchor: [1.92, 7.25],
          note: '盲侧预扫描感知防线空当'
        },
        {
          clipId: 'turn_backpedal_half_r',
          clipIn: 0.10,
          clipOut: 2.12,
          durationSec: 1.25,
          blendSec: 0.22,
          endFacingYaw: -2.95,
          endAnchor: [2.28, 6.15],
          note: '180° 背身顺球半转身破首线'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 1.35,
          blendSec: 0.22,
          endFacingYaw: -3.02,
          endAnchor: [2.85, -1.05],
          note: '持球直扑肋部防线'
        },
        {
          clipId: 'loco_walk_fwd',
          durationSec: 1.15,
          blendSec: 0.24,
          endFacingYaw: -2.92,
          endAnchor: [3.15, -4.20],
          note: 'La Pausa 降速顿挫冻结中卫'
        },
        {
          clipId: 'kick_through_ball_r',
          clipIn: 0.04,
          clipOut: 1.14,
          durationSec: 1.05,
          blendSec: 0.20,
          endFacingYaw: -2.88,
          endAnchor: [3.35, -5.20],
          note: '隐蔽脚内侧直塞穿透防线'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 4.584,
          blendSec: 0.24,
          endFacingYaw: -3.02,
          endAnchor: [3.60, -10.80],
          note: '前插目送破门'
        }
      ]
    }
  },

  // ============================================================================
  // S06: Pressing Cage Third-Man Wall Pass & Driven Goal (8.834s)
  // ============================================================================
  'pressing-cage-third-man': {
    pedri: {
      id: 'seq_s06_pedri',
      startX: -3.20,
      startZ: -0.80,
      startYaw: -1.80,
      segments: [
        {
          clipId: 'stance_ready',
          durationSec: 2.25,
          endFacingYaw: -2.45,
          endAnchor: [-2.25, -2.15],
          note: '包围圈外侧接应待命'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.05,
          blendSec: 0.22,
          endFacingYaw: -2.85,
          endAnchor: [2.55, -10.35],
          note: '斜向持球突入肋部'
        },
        {
          clipId: 'kick_pass_inside_r',
          clipIn: 0.12,
          clipOut: 1.48,
          durationSec: 0.85,
          blendSec: 0.20,
          endFacingYaw: -3.02,
          endAnchor: [3.00, -12.80],
          note: '撞墙一脚敲给第三人支点'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 1.55,
          blendSec: 0.20,
          endFacingYaw: -3.05,
          endAnchor: [2.35, -22.60],
          note: '无球全速前插反越位接回做'
        },
        {
          clipId: 'kick_shot_drive_r',
          clipIn: 0.06,
          clipOut: 1.42,
          durationSec: 0.95,
          blendSec: 0.20,
          endFacingYaw: -2.95,
          endAnchor: [2.15, -24.20],
          note: '迎球低平推射死角'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.184,
          blendSec: 0.22,
          endFacingYaw: -2.10,
          endAnchor: [3.40, -26.20],
          note: '进球跑位滑翔'
        }
      ]
    }
  },

  // ============================================================================
  // S07: Turf Hand-Shield Recovery & Nutmeg Pass vs PSG (5.80s)
  // ============================================================================
  'transition-shield-far-foot': {
    pedri: {
      id: 'seq_s07_pedri',
      startX: 2.35,
      startZ: 8.10,
      startYaw: -3.02,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.88,
          endFacingYaw: -2.88,
          endAnchor: [2.60, 4.50],
          note: '转换持球推进遇冲撞逼抢'
        },
        {
          clipId: 'shield_turf_hand_r',
          clipIn: 0.10,
          clipOut: 2.68,
          durationSec: 1.55,
          blendSec: 0.22,
          endFacingYaw: -2.96,
          endAnchor: [2.52, 4.05],
          note: '对抗失衡单手撑草皮护球弹起'
        },
        {
          clipId: 'kick_through_ball_r',
          clipIn: 0.05,
          clipOut: 1.15,
          durationSec: 0.95,
          blendSec: 0.20,
          endFacingYaw: -3.02,
          endAnchor: [2.25, 3.15],
          note: '起身瞬间穿裆直塞'
        },
        {
          clipId: 'loco_tight_arc_l',
          clipIn: 0.05,
          clipOut: 1.22,
          durationSec: 1.42,
          blendSec: 0.22,
          endFacingYaw: -3.05,
          endAnchor: [1.65, -1.45],
          note: '加速绕过防守接应前插'
        }
      ]
    }
  },

  // ============================================================================
  // S08: Zone 14 Double Fake-Shot Sending Two Sevilla Defenders Sliding (7.767s)
  // ============================================================================
  'zone14-double-fakeshot': {
    pedri: {
      id: 'seq_s08_pedri',
      startX: 5.40,
      startZ: -13.60,
      startYaw: -2.70,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.92,
          endFacingYaw: -3.02,
          endAnchor: [4.80, -15.05],
          note: '弧顶14号位接球横切架炮'
        },
        {
          clipId: 'skill_fakeshot_break_l',
          clipIn: 0.12,
          clipOut: 2.28,
          durationSec: 1.25,
          blendSec: 0.20,
          endFacingYaw: -2.55,
          endAnchor: [1.85, -15.78],
          note: '第一次假射真扣晃飞拉基蒂奇滑铲'
        },
        {
          clipId: 'skill_fakeshot_break_r',
          clipIn: 0.12,
          clipOut: 2.28,
          durationSec: 1.25,
          blendSec: 0.20,
          endFacingYaw: -3.05,
          endAnchor: [3.85, -17.02],
          note: '第二次假射真扣晃飞迭戈·卡洛斯'
        },
        {
          clipId: 'kick_shot_drive_r',
          clipIn: 0.05,
          clipOut: 1.42,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.85,
          endAnchor: [4.15, -17.55],
          note: '右脚大力低平抽射贴地斩'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 2.197,
          blendSec: 0.22,
          endFacingYaw: -1.55,
          endAnchor: [9.80, -17.60],
          note: '张臂狂奔庆祝绝杀'
        }
      ]
    },
    rakitic: {
      id: 'seq_s08_rakitic',
      startX: 3.60,
      startZ: -18.80,
      startYaw: 0.30,
      segments: [
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 2.25,
          endFacingYaw: 0.35,
          endAnchor: [4.50, -16.20],
          note: '飞扑弧顶封堵射门'
        },
        {
          clipId: 'def_slide_tackle_r',
          clipIn: 0.04,
          clipOut: 1.54,
          durationSec: 1.30,
          blendSec: 0.18,
          endFacingYaw: 0.95,
          endAnchor: [6.80, -15.40],
          note: '吃假射飞身滑铲扑空'
        },
        {
          clipId: 'shield_turf_hand_r',
          clipIn: 0.40,
          clipOut: 2.70,
          durationSec: 1.35,
          blendSec: 0.22,
          endFacingYaw: -1.80,
          endAnchor: [7.05, -15.25],
          note: '撑草皮起身'
        },
        {
          clipId: 'loco_walk_fwd',
          durationSec: 2.867,
          blendSec: 0.24,
          endFacingYaw: -2.80,
          endAnchor: [5.80, -17.00],
          note: '回头目送皮球入网'
        }
      ]
    },
    diegocarlos: {
      id: 'seq_s08_diegocarlos',
      startX: 0.80,
      startZ: -20.50,
      startYaw: 0.15,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 3.45,
          endFacingYaw: 0.20,
          endAnchor: [1.45, -17.20],
          note: '补防二线扑抢'
        },
        {
          clipId: 'def_slide_tackle_l',
          clipIn: 0.04,
          clipOut: 1.54,
          durationSec: 1.30,
          blendSec: 0.18,
          endFacingYaw: -0.95,
          endAnchor: [-1.35, -16.30],
          note: '再吃二扣飞身倒地滑铲扑空'
        },
        {
          clipId: 'shield_turf_hand_l',
          clipIn: 0.40,
          clipOut: 2.70,
          durationSec: 1.25,
          blendSec: 0.22,
          endFacingYaw: -2.50,
          endAnchor: [-1.48, -16.50],
          note: '撑地起身'
        },
        {
          clipId: 'loco_walk_fwd',
          durationSec: 1.767,
          blendSec: 0.24,
          endFacingYaw: -2.90,
          endAnchor: [-0.80, -18.50],
          note: '失位回望球门'
        }
      ]
    },
    bono: {
      id: 'seq_s08_bono',
      startX: 0.60,
      startZ: -33.20,
      startYaw: 0.15,
      segments: [
        {
          clipId: 'stance_def_jockey',
          durationSec: 4.95,
          endFacingYaw: 0.20,
          endAnchor: [0.85, -32.80],
          note: '门线压低重心待命'
        },
        {
          clipId: 'gk_dive_right',
          clipIn: 0.05,
          clipOut: 2.46,
          durationSec: 2.817,
          blendSec: 0.18,
          endFacingYaw: 0.45,
          endAnchor: [-1.95, -33.40],
          note: '门将侧扑死角鞭长莫及'
        }
      ]
    }
  },

  // ============================================================================
  // S09: Saúl Solo Slalom vs Bayern Munich (12.20s)
  // ============================================================================
  'saul-ucl-solo-slalom': {
    saul: {
      id: 'seq_s09_saul',
      startX: 3.80,
      startZ: 7.40,
      startYaw: -2.95,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.05,
          endFacingYaw: -2.75,
          endAnchor: [4.90, 2.40],
          note: '中圈起速迎战拜仁中场线'
        },
        {
          clipId: 'skill_croqueta_lr',
          clipIn: 0.06,
          clipOut: 1.82,
          durationSec: 2.05,
          blendSec: 0.22,
          endFacingYaw: -2.85,
          endAnchor: [7.10, -3.20],
          note: '双足油炸丸子穿蒂亚戈与贝尔纳特双人缝'
        },
        {
          clipId: 'turn_tight_l',
          clipIn: 0.06,
          clipOut: 1.32,
          durationSec: 2.00,
          blendSec: 0.22,
          endFacingYaw: -3.10,
          endAnchor: [6.20, -9.80],
          note: '变向急切抹过阿隆索补防'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 2.05,
          blendSec: 0.20,
          endFacingYaw: -3.02,
          endAnchor: [4.50, -16.80],
          note: '高速持球杀入禁区前沿'
        },
        {
          clipId: 'skill_feint_r_go_l',
          clipIn: 0.12,
          clipOut: 1.82,
          durationSec: 1.30,
          blendSec: 0.20,
          endFacingYaw: -2.45,
          endAnchor: [1.80, -18.40],
          note: '沉肩内切晃开阿拉巴封堵角度'
        },
        {
          clipId: 'kick_stride_strike_l',
          clipIn: 0.15,
          clipOut: 1.92,
          durationSec: 1.25,
          blendSec: 0.20,
          endFacingYaw: -2.95,
          endAnchor: [1.50, -19.10],
          note: '左脚内脚背搓射远端死角'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.50,
          blendSec: 0.24,
          endFacingYaw: -1.80,
          endAnchor: [4.80, -20.50],
          note: '张臂庆祝一条龙神迹'
        }
      ]
    }
  },

  // ============================================================================
  // S10: De Bruyne Touchline Press Escape & Through-Ball (8.80s)
  // ============================================================================
  'kdb-touchline-press-switch': {
    kdb: {
      id: 'seq_s10_kdb',
      startX: 25.40,
      startZ: 16.80,
      startYaw: -3.02,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.20,
          endFacingYaw: -3.05,
          endAnchor: [25.60, 11.20],
          note: '右路边线持球推进'
        },
        {
          clipId: 'loco_walk_fwd',
          durationSec: 1.55,
          blendSec: 0.22,
          endFacingYaw: -2.85,
          endAnchor: [25.20, 6.40],
          note: '降速诱使防守人飞铲'
        },
        {
          clipId: 'skill_fakeshot_break_l',
          clipIn: 0.15,
          clipOut: 2.25,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.58,
          endAnchor: [23.45, 5.55],
          note: '边线假传急扣闪开飞铲'
        },
        {
          clipId: 'kick_through_ball_l',
          clipIn: 0.05,
          clipOut: 1.14,
          durationSec: 1.05,
          blendSec: 0.20,
          endFacingYaw: -2.85,
          endAnchor: [23.10, 4.65],
          note: '左脚手术刀贴地直塞'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.85,
          blendSec: 0.24,
          endFacingYaw: -3.00,
          endAnchor: [21.80, -1.50],
          note: '跟进观察进攻展开'
        }
      ]
    },
    wales15: {
      id: 'seq_s10_wales15',
      startX: 21.50,
      startZ: 10.50,
      startYaw: 0.65,
      segments: [
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 3.75,
          endFacingYaw: 0.95,
          endAnchor: [24.80, 6.80],
          note: '全速扑向边线封锁'
        },
        {
          clipId: 'def_slide_tackle_r',
          clipIn: 0.04,
          clipOut: 1.54,
          durationSec: 1.30,
          blendSec: 0.18,
          endFacingYaw: 1.25,
          endAnchor: [26.40, 5.50],
          note: '飞身滑铲扑空滑出边线'
        },
        {
          clipId: 'shield_turf_hand_r',
          clipIn: 0.40,
          clipOut: 2.70,
          durationSec: 1.20,
          blendSec: 0.22,
          endFacingYaw: -2.40,
          endAnchor: [26.20, 5.20],
          note: '撑地起身'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.55,
          blendSec: 0.24,
          endFacingYaw: -3.00,
          endAnchor: [24.00, -2.00],
          note: '回追防线'
        }
      ]
    }
  },

  // ============================================================================
  // S11: Lamine Yamal Box Slalom vs Athletic Club (8.60s)
  // ============================================================================
  'yamal-bilbao-box-slalom': {
    yamal_hero: {
      id: 'seq_s11_yamal',
      startX: 8.20,
      startZ: -5.80,
      startYaw: -2.85,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.50,
          endFacingYaw: -2.75,
          endAnchor: [7.60, -8.60],
          note: '右肋部持球切入'
        },
        {
          clipId: 'turn_tight_l',
          clipIn: 0.06,
          clipOut: 1.32,
          durationSec: 1.45,
          blendSec: 0.20,
          endFacingYaw: -2.65,
          endAnchor: [5.80, -13.80],
          note: '左脚外拨变向加速'
        },
        {
          clipId: 'skill_croqueta_lr',
          clipIn: 0.08,
          clipOut: 1.80,
          durationSec: 1.65,
          blendSec: 0.20,
          endFacingYaw: -2.98,
          endAnchor: [3.95, -19.20],
          note: '连续双足变向晃晕包夹'
        },
        {
          clipId: 'skill_feint_l_go_r',
          clipIn: 0.12,
          clipOut: 1.82,
          durationSec: 1.55,
          blendSec: 0.20,
          endFacingYaw: -2.92,
          endAnchor: [4.10, -25.40],
          note: '左沉肩虚晃闪出射门走廊'
        },
        {
          clipId: 'kick_stride_strike_l',
          clipIn: 0.15,
          clipOut: 1.92,
          durationSec: 1.35,
          blendSec: 0.20,
          endFacingYaw: -2.85,
          endAnchor: [4.15, -27.20],
          note: '左脚标志性兜射远角'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.10,
          blendSec: 0.22,
          endFacingYaw: -2.75,
          endAnchor: [3.80, -29.20],
          note: '收步庆祝'
        }
      ]
    }
  },

  // ============================================================================
  // S12: Vinícius Jr Body-Feint Burst & Lofted Chip (6.20s)
  // ============================================================================
  'vinicius-double-press-chip': {
    vinicius7: {
      id: 'seq_s12_vinicius',
      startX: -4.80,
      startZ: -10.20,
      startYaw: -2.90,
      segments: [
        {
          clipId: 'skill_feint_l_go_r',
          clipIn: 0.08,
          clipOut: 1.84,
          durationSec: 1.60,
          endFacingYaw: -2.95,
          endAnchor: [-3.10, -16.80],
          note: '左沉肩虚晃生吃双人关门'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 2.15,
          blendSec: 0.20,
          endFacingYaw: -3.04,
          endAnchor: [-1.35, -26.80],
          note: '高速直线趟球单刀突进'
        },
        {
          clipId: 'kick_chip_loft_r',
          clipIn: 0.06,
          clipOut: 1.34,
          durationSec: 1.10,
          blendSec: 0.20,
          endFacingYaw: -2.65,
          endAnchor: [-0.65, -28.40],
          note: '面对出击门将右脚轻巧挑射'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.35,
          blendSec: 0.22,
          endFacingYaw: -1.75,
          endAnchor: [3.80, -31.20],
          note: '绕过门将庆祝破门'
        }
      ]
    }
  },

  // ============================================================================
  // S13: Gareth Bale Curved Outside-Touchline Overtake vs Bartra (11.20s)
  // ============================================================================
  'bale-touchline-curved-overtake': {
    bale11: {
      id: 'seq_s13_bale',
      startX: -27.50,
      startZ: 18.50,
      startYaw: 3.08,
      segments: [
        {
          clipId: 'skill_burst_from_stop_l',
          clipIn: 0.05,
          clipOut: 1.72,
          durationSec: 2.10,
          endFacingYaw: 3.06,
          endAnchor: [-29.20, 8.50],
          note: '人球分过第一步爆发启动'
        },
        {
          clipId: 'loco_arc_run_l',
          clipIn: 0.02,
          clipOut: 1.12,
          durationSec: 3.05,
          blendSec: 0.22,
          endFacingYaw: -3.05,
          endAnchor: [-32.85, -8.20],
          note: '左外道弯道超车绕过巴尔特拉卡位'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 3.30,
          blendSec: 0.20,
          endFacingYaw: -2.35,
          endAnchor: [-12.50, -26.80],
          note: '全速内切杀入禁区'
        },
        {
          clipId: 'kick_shot_drive_l',
          clipIn: 0.06,
          clipOut: 1.42,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.25,
          endAnchor: [-5.80, -30.20],
          note: '左脚低射穿门将小门绝杀'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 1.60,
          blendSec: 0.22,
          endFacingYaw: -1.60,
          endAnchor: [-11.50, -33.50],
          note: '冲向角旗区滑跪庆祝'
        }
      ]
    }
  },

  // ============================================================================
  // S14: Fake-Shot Cruyff Chop Sending Defender Sliding (6.80s)
  // ============================================================================
  'bardhi-cruyff-chop-slide': {
    bardhi10: {
      id: 'seq_s14_bardhi',
      startX: -2.20,
      startZ: -4.20,
      startYaw: 3.05,
      segments: [
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 2.75,
          endFacingYaw: 3.00,
          endAnchor: [-4.02, -14.85],
          note: '高速反击推进吸引回追铲抢'
        },
        {
          clipId: 'skill_fakeshot_break_r',
          clipIn: 0.12,
          clipOut: 2.28,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.72,
          endAnchor: [-1.45, -17.15],
          note: '120Hz 假射真扣晃飞铲球后卫'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 0.95,
          blendSec: 0.20,
          endFacingYaw: 3.05,
          endAnchor: [-1.80, -23.40],
          note: '顺球调整瞄准远角'
        },
        {
          clipId: 'kick_shot_drive_r',
          clipIn: 0.05,
          clipOut: 1.42,
          durationSec: 0.95,
          blendSec: 0.20,
          endFacingYaw: 3.05,
          endAnchor: [-1.92, -24.85],
          note: '右脚劲射死角入网'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.00,
          blendSec: 0.22,
          endFacingYaw: 2.20,
          endAnchor: [-4.50, -26.50],
          note: '转身庆祝破门'
        }
      ]
    },
    orange4: {
      id: 'seq_s14_orange4',
      startX: -1.10,
      startZ: -5.00,
      startYaw: 3.02,
      segments: [
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 2.80,
          endFacingYaw: 2.95,
          endAnchor: [-3.15, -14.20],
          note: '全速回追准备封堵'
        },
        {
          clipId: 'def_slide_tackle_r',
          clipIn: 0.04,
          clipOut: 1.54,
          durationSec: 1.35,
          blendSec: 0.18,
          endFacingYaw: 2.45,
          endAnchor: [-5.40, -16.80],
          note: '吃假射飞身倒地滑铲出镜头'
        },
        {
          clipId: 'shield_turf_hand_r',
          clipIn: 0.40,
          clipOut: 2.70,
          durationSec: 1.20,
          blendSec: 0.22,
          endFacingYaw: -1.80,
          endAnchor: [-5.80, -17.20],
          note: '撑草皮起身'
        },
        {
          clipId: 'loco_walk_fwd',
          durationSec: 1.45,
          blendSec: 0.24,
          endFacingYaw: 3.00,
          endAnchor: [-4.20, -19.50],
          note: '无奈目送进球'
        }
      ]
    }
  },

  // ============================================================================
  // S15: Van Dijk CB Coast-to-Coast Carry, Chop & Finish (13.80s)
  // ============================================================================
  'vandijk-cb-coast-to-coast': {
    vandijk5: {
      id: 'seq_s15_vandijk',
      startX: -4.20,
      startZ: 21.20,
      startYaw: -3.02,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.40,
          endFacingYaw: -2.95,
          endAnchor: [-5.80, 12.40],
          note: '后场断球大步流星带出包围'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 4.90,
          blendSec: 0.22,
          endFacingYaw: -2.85,
          endAnchor: [-4.20, -7.50],
          note: '跨全场长途奔袭推进60米'
        },
        {
          clipId: 'loco_tight_arc_r',
          clipIn: 0.05,
          clipOut: 1.20,
          durationSec: 2.25,
          blendSec: 0.22,
          endFacingYaw: -3.02,
          endAnchor: [-2.10, -15.80],
          note: '斜切直逼禁区弧顶'
        },
        {
          clipId: 'skill_fakeshot_break_l',
          clipIn: 0.12,
          clipOut: 2.28,
          durationSec: 1.35,
          blendSec: 0.20,
          endFacingYaw: -2.62,
          endAnchor: [-4.55, -18.40],
          note: '踩单车假射真扣晃倒中卫'
        },
        {
          clipId: 'kick_shot_drive_r',
          clipIn: 0.05,
          clipOut: 1.42,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.95,
          endAnchor: [-4.20, -20.20],
          note: '右脚低射破门'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.75,
          blendSec: 0.22,
          endFacingYaw: -1.65,
          endAnchor: [1.50, -22.50],
          note: '霸气张臂庆祝'
        }
      ]
    }
  },

  // ============================================================================
  // S16: Jurriën Timber RB Back-to-Goal 180° Half-Turn vs Double Press (6.00s)
  // ============================================================================
  'timber-rb-double-press-turn': {
    timber12: {
      id: 'seq_s16_timber',
      startX: 6.80,
      startZ: -17.20,
      startYaw: 0.35,
      segments: [
        {
          clipId: 'touch_cushion_step_r',
          clipIn: 0.08,
          clipOut: 1.42,
          durationSec: 0.96,
          endFacingYaw: 0.20,
          endAnchor: [6.62, -17.58],
          note: '背身迎球脚内侧轻卸诱敌双人上抢'
        },
        {
          clipId: 'turn_backpedal_half_r',
          clipIn: 0.08,
          clipOut: 2.14,
          durationSec: 1.14,
          blendSec: 0.22,
          endFacingYaw: -2.95,
          endAnchor: [6.15, -21.45],
          note: '120Hz 背身180°沉肩半转身穿双人夹击'
        },
        {
          clipId: 'loco_ball_run_fast',
          durationSec: 1.32,
          blendSec: 0.20,
          endFacingYaw: -2.85,
          endAnchor: [5.25, -27.15],
          note: '爆发加速直插禁区肋部'
        },
        {
          clipId: 'kick_chip_loft_r',
          clipIn: 0.06,
          clipOut: 1.34,
          durationSec: 1.05,
          blendSec: 0.20,
          endFacingYaw: -2.65,
          endAnchor: [4.85, -28.85],
          note: '右脚精准挑传门前助攻'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.53,
          blendSec: 0.22,
          endFacingYaw: -1.65,
          endAnchor: [7.20, -30.50],
          note: '收步庆祝助攻破门'
        }
      ]
    },
    spurs19: {
      id: 'seq_s16_spurs19',
      startX: 5.20,
      startZ: -18.80,
      startYaw: 0.65,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.20,
          endFacingYaw: 0.85,
          endAnchor: [5.60, -18.20],
          note: '左侧贴身上抢关门'
        },
        {
          clipId: 'def_press_brake_r',
          clipIn: 0.12,
          clipOut: 1.98,
          durationSec: 1.20,
          blendSec: 0.20,
          endFacingYaw: -2.80,
          endAnchor: [5.10, -20.40],
          note: '扑空急刹转身'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 3.60,
          blendSec: 0.22,
          endFacingYaw: -2.90,
          endAnchor: [4.50, -27.50],
          note: '回追不及'
        }
      ]
    },
    spurs8: {
      id: 'seq_s16_spurs8',
      startX: 8.40,
      startZ: -19.20,
      startYaw: -0.65,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.25,
          endFacingYaw: -0.95,
          endAnchor: [7.50, -18.80],
          note: '右侧合拢包夹'
        },
        {
          clipId: 'def_press_brake_l',
          clipIn: 0.12,
          clipOut: 1.98,
          durationSec: 1.20,
          blendSec: 0.20,
          endFacingYaw: -2.95,
          endAnchor: [7.30, -20.90],
          note: '被抹过急刹失位'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 3.55,
          blendSec: 0.22,
          endFacingYaw: -2.95,
          endAnchor: [6.20, -27.80],
          note: '转身追防'
        }
      ]
    }
  },

  // ============================================================================
  // S17: Alphonso Davies LB Press-Break & Cutback Assist vs Barça (12.60s)
  // ============================================================================
  'davies-lb-press-break-assist': {
    davies19: {
      id: 'seq_s17_davies',
      startX: -5.50,
      startZ: 16.50,
      startYaw: -2.85,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.55,
          endFacingYaw: -2.45,
          endAnchor: [-2.20, 8.80],
          note: '左后卫后场接球横向摆脱首抢'
        },
        {
          clipId: 'skill_feint_r_go_l',
          clipIn: 0.10,
          clipOut: 1.84,
          durationSec: 1.25,
          blendSec: 0.20,
          endFacingYaw: -3.02,
          endAnchor: [-2.10, 5.80],
          note: '右沉肩虚晃变向甩开比达尔与梅西夹击'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 4.85,
          blendSec: 0.20,
          endFacingYaw: -2.95,
          endAnchor: [-6.20, -22.50],
          note: '边路超音速推进生吃塞梅多'
        },
        {
          clipId: 'skill_stop_and_go_r',
          clipIn: 0.10,
          clipOut: 2.05,
          durationSec: 1.45,
          blendSec: 0.20,
          endFacingYaw: -2.25,
          endAnchor: [-5.50, -27.40],
          note: '底线急停顿挫二次爆发晃开塞梅多下底'
        },
        {
          clipId: 'kick_pass_inside_r',
          clipIn: 0.08,
          clipOut: 1.56,
          durationSec: 1.15,
          blendSec: 0.20,
          endFacingYaw: -2.05,
          endAnchor: [-5.10, -28.10],
          note: '底线倒三角精准推传基米希'
        },
        {
          clipId: 'loco_dribble_jog',
          durationSec: 1.35,
          blendSec: 0.22,
          endFacingYaw: -1.65,
          endAnchor: [-3.50, -29.20],
          note: '跟进庆祝破门'
        }
      ]
    }
  },

  // ============================================================================
  // S18: Achraf Hakimi RWB Press-Drive & Long-Range Rocket (11.00s)
  // ============================================================================
  'hakimi-rwb-press-drive-rocket': {
    hakimi2: {
      id: 'seq_s18_hakimi',
      startX: 7.80,
      startZ: 3.50,
      startYaw: -2.60,
      segments: [
        {
          clipId: 'loco_dribble_jog',
          durationSec: 2.35,
          endFacingYaw: -2.45,
          endAnchor: [6.40, 0.80],
          note: '右翼卫内收接球迎战上抢'
        },
        {
          clipId: 'turn_tight_l',
          clipIn: 0.06,
          clipOut: 1.32,
          durationSec: 2.50,
          blendSec: 0.22,
          endFacingYaw: -2.35,
          endAnchor: [2.20, -4.20],
          note: '斜向变向切入中路走廊'
        },
        {
          clipId: 'skill_croqueta_rl',
          clipIn: 0.08,
          clipOut: 1.80,
          durationSec: 2.40,
          blendSec: 0.20,
          endFacingYaw: -2.75,
          endAnchor: [-1.80, -8.20],
          note: '双足连拨突破后腰封堵'
        },
        {
          clipId: 'kick_stride_strike_r',
          clipIn: 0.12,
          clipOut: 1.94,
          durationSec: 1.55,
          blendSec: 0.20,
          endFacingYaw: -2.98,
          endAnchor: [-1.50, -10.40],
          note: '助跑上步右脚正脚背重炮世界波'
        },
        {
          clipId: 'loco_sprint_fwd',
          durationSec: 2.20,
          blendSec: 0.22,
          endFacingYaw: -1.80,
          endAnchor: [2.50, -12.50],
          note: '狂奔庆祝远射破门'
        }
      ]
    }
  }
};

/**
 * Lazily compiles and caches all multi-clip ActionSequences for a scenario once the
 * 86-clip atomic library and character rig (`boneNames, restRot`) are ready.
 */
export function ensureScenarioCompiledSequences(scenario, boneNames, restRotMap) {
  const specMap = SCENARIO_ASSEMBLED_SEQUENCES[scenario.id];
  if (!specMap) return null;

  // Wait until atomic library is populated
  if (!getAtomicClip('stance_ready')) return null;

  if (!scenario._compiledSequences) {
    scenario._compiledSequences = new Map();
  }

  for (const [actorId, seqSpec] of Object.entries(specMap)) {
    const existing = scenario._compiledSequences.get(actorId);
    const hasInertial = existing && existing._withRigBones;
    if (!existing || (!hasInertial && boneNames && boneNames.length > 0)) {
      const compiled = compileActionSequence(seqSpec, boneNames, restRotMap);
      compiled._withRigBones = Boolean(boneNames && boneNames.length > 0);
      scenario._compiledSequences.set(actorId, compiled);
    }
  }

  return scenario._compiledSequences;
}
