/**
 * 10 Additional Multi-Position 1:1 Zhibo8 Match Scenarios (Scenarios 09–18)
 * - Midfielders (MF): #17 Saúl Ñíguez (09), #7 Kevin De Bruyne (10)
 * - Forwards    (FW): #19 Lamine Yamal (11), #7 Vinícius Jr (12), #11 Gareth Bale (13), #10 Enis Bardhi (14)
 * - Defenders   (DF): #5 Virgil van Dijk (15), #12 Jurriën Timber (16), #19 Alphonso Davies (17), #2 Achraf Hakimi (18)
 *
 * Every clip duration, camera side/trajectory, club kit, and Mixamo《Soccer Pack》schedule
 * is locked 1:1 to the corresponding Zhibo8 broadcast video in `./assets/videos/s09_*.mp4` .. `s18_*.mp4`.
 */
export const MULTI_POSITION_SCENARIOS = [
  // ============================================================================
  // SCENARIO 09 (MF): s09_mf_saul_bayern.mp4 (12.200s — Atlético Madrid vs Bayern Munich)
  // ============================================================================
  {
    id: 'saul-ucl-solo-slalom',
    index: '09',
    positionGroup: 'MF',
    positionLabel: '中场 B2B',
    starName: '#17 萨乌尔 Saúl',
    durationSec: 12.2,
    title: '萨乌尔欧冠半决赛一条龙 · 中圈连过拜仁四人弧线死角',
    moveName: '中圈变向摆脱双后腰 + 禁区前沿内切兜射死角 (UCL Semi-Final Solo Slalom)',
    zoneTag: '中圈至禁区右肋 (12.20s 1:1)',
    matchRef: '直播吧欧冠原片 1:1 帧同步：马竞 1-0 拜仁 (#17 萨乌尔 12.2s 连过四人击中立柱入网)',
    pressureType: '拜仁深蓝客场 #6 蒂亚戈 + #18 贝尔纳特 + #14 阿隆索中场围剿 + #27 阿拉巴封堵',
    metrics: {
      touches: '7次高频左脚拨扣 + 10.1s兜射',
      feintAngle: '连续 3 次 40° 变向切入肋部',
      scans: '中圈抬头锁死拜仁防线肋部',
      escapeWindow: '3.8s–6.5s 穿三人包围圈'
    },
    keypoints: [
      '0.00s–2.50s：马竞 #17 萨乌尔在中圈弧内接球转身面向进攻方向（球门位于右侧 Z = -34m），拜仁 #6 蒂亚戈第一时间贴身逼抢。',
      '2.60s–6.80s：萨乌尔利用低重心油炸丸子与左斜前变向（soccer_crossover_feint → sprint_cut_l），在 4 秒内连续抹过 #6 蒂亚戈、#18 贝尔纳特与 #14 阿隆索三名拜仁中场的合围！',
      '7.50s–12.20s：杀至大禁区线面对 #27 阿拉巴退防封堵，9.1s 急停左脚横拉闪出射门角度（soccer_cut_left_90），10.1s 左脚搓出完美弧线击中远端立柱内侧弹入球网！'
    ],
    phases: [
      { timeRange: [0.0, 2.8], label: '0.0–2.8s 中圈启动抹过蒂亚戈', desc: '萨乌尔在中圈弧持球启动，沉肩加速甩开拜仁 #6 蒂亚戈的第一道上抢。' },
      { timeRange: [2.8, 6.8], label: '2.8–6.8s 双脚变向连过双腰', desc: '面对 #18 贝尔纳特与 #14 阿隆索左右夹击，连续变向从三人夹缝中强行突围！' },
      { timeRange: [6.8, 9.8], label: '6.8–9.8s 禁区线内切晃开阿拉巴', desc: '直扑大禁区前沿，9.1s 左脚急停横拨晃开 #27 阿拉巴封堵腿。' },
      { timeRange: [9.8, 12.2], label: '9.8–12.2s 左脚兜射中柱死角', desc: '10.1s 左脚内侧兜射远角，绿衣门将诺伊尔飞身鱼跃仍鞭长莫及！' }
    ],
    defaultFocus: [3.5, 0, -12.0],
    camTrack: [
      { t: 0.0, pos: [21.5, 10.6, 8.8], target: [4.2, 0.85, 6.5], fov: 34 },
      { t: 4.1, pos: [22.2, 10.8, 0.5], target: [5.5, 0.85, -3.2], fov: 34 },
      { t: 8.1, pos: [22.4, 10.6, -11.5], target: [3.8, 0.9, -18.5], fov: 33 },
      { t: 12.2, pos: [21.8, 10.2, -18.0], target: [0.2, 1.0, -30.5], fov: 33 }
    ],
    actors: [
      {
        id: 'saul',
        role: 'hero',
        kit: 'atleti-striped',
        number: '17',
        shirtName: 'SAUL',
        hairColor: '#2b1d14',
        label: '#17 萨乌尔 Saúl (马竞中场)',
        keyframes: [
          { t: 0.0, x: 3.8, z: 7.4, yaw: -2.95, scanYaw: -0.45, crouch: 0.2 },
          { t: 2.05, x: 4.9, z: 2.4, yaw: -2.75, crouch: 0.34 },
          { t: 4.1, x: 7.1, z: -3.2, yaw: -2.85, crouch: 0.42, leanRoll: -0.15 },
          { t: 6.1, x: 6.2, z: -9.8, yaw: -3.1, crouch: 0.35, leanRoll: 0.14 },
          { t: 8.15, x: 4.5, z: -16.8, yaw: -3.02, crouch: 0.36 },
          { t: 9.35, x: 1.8, z: -18.4, yaw: -2.45, crouch: 0.44, leanRoll: 0.18 },
          { t: 10.35, x: 1.5, z: -19.1, yaw: -2.95, crouch: 0.25 },
          { t: 12.2, x: 4.8, z: -20.5, yaw: -1.8, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.05, clip: 'jog_fwd', rate: 1.12 },
          { start: 2.05, end: 3.85, clip: 'soccer_crossover_feint', rate: 1.25, offset: 0.1 },
          { start: 3.85, end: 5.35, clip: 'sprint_cut_l', rate: 1.18 },
          { start: 5.35, end: 8.45, clip: 'sprint_fwd', rate: 1.14 },
          { start: 8.45, end: 9.55, clip: 'soccer_cut_left_90', rate: 1.2, offset: 0.05 },
          { start: 9.55, end: 10.65, clip: 'soccer_power_kick', rate: 1.18, offset: 0.12 },
          { start: 10.65, end: 12.2, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 1.88, peak: 2.08, end: 2.34, foot: 'L', type: 'inside', action: 'dribble', maxWeight: 0.90 },
          { start: 3.94, peak: 4.16, end: 4.42, foot: 'L', type: 'outside', action: 'dribble', maxWeight: 0.94 },
          { start: 5.90, peak: 6.14, end: 6.40, foot: 'L', type: 'inside', action: 'dribble', maxWeight: 0.92 },
          { start: 8.98, peak: 9.25, end: 9.52, foot: 'L', type: 'inside', action: 'dribble', maxWeight: 0.95 },
          { start: 9.94, peak: 10.15, end: 10.40, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'thiago6',
        role: 'defender',
        kit: 'bayern-navy',
        number: '6',
        shirtName: 'THIAGO',
        label: '拜仁 #6 蒂亚戈 (首道上抢被抹过)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: 4.6, z: 4.6, yaw: 0.15, crouch: 0.28 },
          { t: 2.05, x: 4.1, z: 2.8, yaw: 0.35, crouch: 0.55 },
          { t: 4.2, x: 5.4, z: -1.5, yaw: -2.85, crouch: 0.38 },
          { t: 12.2, x: 4.8, z: -13.5, yaw: -3.0, crouch: 0.2 }
        ]
      },
      {
        id: 'bernat18',
        role: 'defender',
        kit: 'bayern-navy',
        number: '18',
        shirtName: 'BERNAT',
        label: '拜仁 #18 贝尔纳特 (侧向扑空)',
        phaseSeed: 0.45,
        keyframes: [
          { t: 0.0, x: 8.8, z: -1.2, yaw: -0.45, crouch: 0.25 },
          { t: 4.05, x: 8.2, z: -3.6, yaw: -1.1, crouch: 0.58 },
          { t: 5.4, x: 8.6, z: -4.2, yaw: -2.6, crouch: 0.48 },
          { t: 12.2, x: 6.5, z: -16.2, yaw: -3.0, crouch: 0.22 }
        ]
      },
      {
        id: 'alonso14',
        hairVariant: 2,
        role: 'defender',
        kit: 'bayern-navy',
        number: '14',
        shirtName: 'ALONSO',
        hasBeard: true,
        label: '拜仁 #14 阿隆索 (补防失位)',
        phaseSeed: 0.72,
        keyframes: [
          { t: 0.0, x: 4.2, z: -6.8, yaw: 0.2, crouch: 0.25 },
          { t: 5.85, x: 5.2, z: -9.5, yaw: 0.35, crouch: 0.58 },
          { t: 7.4, x: 6.4, z: -10.8, yaw: -2.7, crouch: 0.45 },
          { t: 12.2, x: 4.5, z: -17.5, yaw: -3.0, crouch: 0.22 }
        ]
      },
      {
        id: 'alaba27',
        hairVariant: 2,
        role: 'defender',
        kit: 'bayern-navy',
        number: '27',
        shirtName: 'ALABA',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '拜仁 #27 阿拉巴 (禁区被内切晃开)',
        phaseSeed: 0.35,
        keyframes: [
          { t: 0.0, x: 3.2, z: -17.5, yaw: 0.1, crouch: 0.25 },
          { t: 8.2, x: 3.5, z: -18.8, yaw: 0.15, crouch: 0.52 },
          { t: 9.5, x: 3.2, z: -19.6, yaw: -0.65, crouch: 0.62 },
          { t: 10.5, x: 0.6, z: -20.2, yaw: -1.4, crouch: 0.55 },
          { t: 12.2, x: 0.8, z: -21.0, yaw: -2.9, crouch: 0.25 }
        ]
      },
      {
        id: 'juanfran20',
        role: 'teammate',
        kit: 'atleti-striped',
        number: '20',
        shirtName: 'JUANFRAN',
        label: '马竞 #20 胡安弗兰 (右翼套边牵制)',
        keyframes: [
          { t: 0.0, x: 12.5, z: -4.0, yaw: -3.0, crouch: 0.15 },
          { t: 8.5, x: 11.2, z: -16.5, yaw: -2.9, crouch: 0.2 },
          { t: 12.2, x: 9.8, z: -19.0, yaw: -2.4, crouch: 0.12 }
        ]
      },
      {
        id: 'neuer1',
        role: 'defender',
        kit: 'gk-green',
        number: '1',
        shirtName: 'NEUER',
        showShadow: false,
        label: '拜仁门将 #1 诺伊尔',
        keyframes: [
          { t: 0.0, x: 0.4, z: -33.1, yaw: 0.1, crouch: 0.35, showShadow: false },
          { t: 10.0, x: 0.6, z: -32.8, yaw: 0.15, crouch: 0.55, showShadow: false },
          { t: 11.05, x: -2.1, z: -33.5, yaw: 0.45, crouch: 0.75, leanRoll: 0.28, showShadow: false },
          { t: 12.2, x: -2.1, z: -33.5, yaw: 0.45, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 10.05, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 10.05, end: 12.2, clip: 'gk_dive_right', rate: 0.95, offset: 0.0 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 3.9, y: 0.115, z: 7.05 },
      { t: 2.05, x: 5.05, y: 0.115, z: 2.02 },
      { t: 4.15, x: 7.22, y: 0.115, z: -3.76 },
      { t: 6.15, x: 6.15, y: 0.115, z: -10.22 },
      { t: 8.2, x: 4.42, y: 0.115, z: -17.15 },
      { t: 9.35, x: 1.65, y: 0.115, z: -18.75 },
      { t: 10.15, x: 1.45, y: 0.115, z: -19.35 },
      { t: 11.12, x: -3.45, y: 0.38, z: -34.0, ease: 'linear' }, // kisses inside of far left post!
      { t: 11.55, x: -2.65, y: 0.22, z: -35.1, ease: 'linear' },
      { t: 12.2, x: -2.5, y: 0.115, z: -35.4 }
    ],
    pedriRibbon: [[3.8, 0.06, 7.4], [4.9, 0.06, 2.4], [7.1, 0.06, -3.2], [6.2, 0.06, -9.8], [4.5, 0.06, -16.8], [1.5, 0.06, -19.1]],
    overshootRibbon: [[8.8, 0.05, -1.2], [8.2, 0.05, -3.6], [5.2, 0.05, -9.5], [6.4, 0.05, -10.8]]
  },

  // ============================================================================
  // SCENARIO 10 (MF): s10_mf_kdb_pass.mp4 (8.800s — Belgium vs Wales)
  // ============================================================================
  {
    id: 'kdb-touchline-press-switch',
    index: '10',
    positionGroup: 'MF',
    positionLabel: '中场 CAM',
    starName: '#7 德布劳内 De Bruyne',
    durationSec: 8.8,
    title: '德布劳内边线诱敌抗双人围抢 · 38米贴地弧线打穿防线',
    moveName: '近端边线降速吸怪 + 急停闪转摆脱扑抢 + 38m 外旋穿透直塞 (Touchline Bait & Whipped Pass)',
    zoneTag: '右路中线边线走廊 (8.80s 1:1)',
    matchRef: '直播吧欧国联原片 1:1 帧同步：比利时 vs 威尔士 (#7 德布劳内边线摆脱双红衣逼抢送穿透长传)',
    pressureType: '威尔士红衣 #15 阿姆帕杜 + #6 罗登向近端边线合围封死直传角',
    metrics: {
      touches: '3.9s 急停拨球 + 4.95s 38m弧线球',
      feintAngle: '边线 0.8m 窄走廊诱敌扑空',
      scans: '2.6s 提前抬头锁定右翼肋部空当',
      escapeWindow: '4.35s–5.15s 双人夹缝出球'
    },
    keypoints: [
      '0.00s–2.60s：比利时白衣 #7 德布劳内在近端边线本方半场（X = +25m, Z = +16m）接球，不急于大脚解围，而是沿边线控球诱使威尔士两名红衣球员向边线靠拢。',
      '2.70s–4.55s：刚过中线瞬间，威尔士两名红衣逼抢者一前一侧同时扑抢倒地封堵；德布劳内 4.1s 急停拉球半转身闪出半个身位，令对手扑空摔倒在边线！',
      '4.65s–8.80s：趁对手防线前压暴露身后大片纵深，4.95s 右脚抽出一记 38 米手术刀弧线直塞（soccer_through_ball），精准绕过中卫找到高速前插的 #11 特罗萨德！'
    ],
    phases: [
      { timeRange: [0.0, 2.7], label: '0.0–2.7s 后场边线接球诱敌', desc: '德布劳内在近端边线从容停球向前推进，主动吸引两名威尔士红衣球员向边路收缩。' },
      { timeRange: [2.7, 4.6], label: '2.7–4.6s 中线急停晃倒扑抢者', desc: '跨越中线瞬间急停拉球变向，令凶狠上抢的红衣后腰直接滑倒扑空！' },
      { timeRange: [4.6, 6.8], label: '4.6–6.8s 38米外弧线手术刀长传', desc: '4.95s 右脚抽出大弧度贴地穿透传球，瞬间打穿整条威尔士高位防线！' },
      { timeRange: [6.8, 8.8], label: '6.8–8.8s 右翼反越位纵深推进', desc: '#11 特罗萨德无需减速顺势领球直插禁区右翼！' }
    ],
    defaultFocus: [16.0, 0, 2.0],
    camTrack: [
      { t: 0.0, pos: [34.5, 15.2, 13.5], target: [16.5, 0.85, 11.0], fov: 40 },
      { t: 4.4, pos: [34.2, 15.0, 7.5], target: [17.5, 0.85, 4.5], fov: 40 },
      { t: 8.8, pos: [33.5, 14.8, -8.5], target: [16.0, 0.85, -18.5], fov: 39 }
    ],
    actors: [
      {
        id: 'kdb',
        role: 'hero',
        kit: 'belgium-white',
        number: '7',
        shirtName: 'DE BRUYNE',
        hairColor: '#d4a359',
        label: '#7 德布劳内 De Bruyne (中场核心)',
        keyframes: [
          { t: 0.0, x: 25.4, z: 16.8, yaw: -3.02, scanYaw: -0.55, crouch: 0.18 },
          { t: 2.2, x: 25.6, z: 11.2, yaw: -3.05, scanYaw: -0.75, crouch: 0.24 },
          { t: 3.85, x: 25.2, z: 6.4, yaw: -2.85, crouch: 0.42 },
          { t: 4.55, x: 23.6, z: 5.8, yaw: -2.55, crouch: 0.38, leanRoll: 0.16 },
          { t: 5.25, x: 23.2, z: 4.8, yaw: -2.85, crouch: 0.25 },
          { t: 8.8, x: 21.8, z: -1.5, yaw: -3.0, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.35, clip: 'jog_fwd', rate: 1.05 },
          { start: 2.35, end: 3.75, clip: 'walk_fwd', rate: 0.95 },
          { start: 3.75, end: 4.65, clip: 'soccer_cut_left_90', rate: 1.25, offset: 0.08 },
          { start: 4.65, end: 5.55, clip: 'soccer_through_ball', rate: 1.28, offset: 0.22 },
          { start: 5.55, end: 8.8, clip: 'jog_fwd', rate: 0.95 }
        ],
        touchWindows: [
          { start: 2.02, peak: 2.22, end: 2.45, foot: 'R', type: 'inside', action: 'receive', maxWeight: 0.88 },
          { start: 3.85, peak: 4.10, end: 4.36, foot: 'R', type: 'inside', action: 'dribble', maxWeight: 0.95 },
          { start: 4.80, peak: 5.00, end: 5.26, foot: 'R', type: 'instep', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'trossard11',
        role: 'teammate',
        kit: 'belgium-white',
        number: '11',
        shirtName: 'TROSSARD',
        label: '#11 特罗萨德 (边路高速前插接应)',
        keyframes: [
          { t: 0.0, x: 21.5, z: -1.5, yaw: -3.05, crouch: 0.18 },
          { t: 4.6, x: 22.8, z: -6.8, yaw: -3.08, crouch: 0.25 },
          { t: 7.1, x: 23.5, z: -20.5, yaw: -3.05, crouch: 0.28 },
          { t: 8.8, x: 22.2, z: -26.8, yaw: -2.85, crouch: 0.24 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.6, clip: 'jog_fwd', rate: 0.95 },
          { start: 4.6, end: 8.8, clip: 'sprint_fwd', rate: 1.18 }
        ],
        touchWindows: [
          { start: 6.96, peak: 7.18, end: 7.42, foot: 'R', type: 'inside', action: 'receive', maxWeight: 0.92 }
        ]
      },
      {
        id: 'wales15',
        role: 'defender',
        kit: 'wales-red',
        number: '15',
        shirtName: 'AMPADU',
        label: '威尔士 #15 阿姆帕杜 (扑抢滑倒扑空)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 21.5, z: 10.5, yaw: 0.65, crouch: 0.25 },
          { t: 3.75, x: 24.8, z: 6.8, yaw: 0.95, crouch: 0.58 },
          { t: 4.55, x: 26.4, z: 5.5, yaw: 1.25, crouch: 0.82, leanRoll: -0.25 },
          { t: 6.2, x: 26.2, z: 5.2, yaw: -2.4, crouch: 0.5 },
          { t: 8.8, x: 24.0, z: -2.0, yaw: -3.0, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.75, clip: 'sprint_fwd', rate: 1.08 },
          { start: 3.75, end: 5.05, clip: 'soccer_slide_tackle', rate: 0.95, offset: 0.0 },
          { start: 5.05, end: 6.1, clip: 'soccer_turf_hand_shield', rate: 1.1 },
          { start: 6.1, end: 8.8, clip: 'jog_fwd', rate: 0.95 }
        ]
      },
      {
        id: 'wales6',
        role: 'defender',
        kit: 'wales-red',
        number: '6',
        shirtName: 'RODON',
        label: '威尔士 #6 罗登 (正面封堵被穿)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 22.8, z: 3.5, yaw: 0.2, crouch: 0.25 },
          { t: 4.2, x: 24.2, z: 4.2, yaw: 0.15, crouch: 0.55 },
          { t: 5.5, x: 23.8, z: 2.5, yaw: -2.9, crouch: 0.42 },
          { t: 8.8, x: 21.5, z: -14.5, yaw: -3.0, crouch: 0.25 }
        ]
      },
      {
        id: 'wales4',
        role: 'defender',
        kit: 'wales-red',
        number: '4',
        shirtName: 'DAVIES',
        label: '威尔士 #4 本·戴维斯 (回追不及)',
        phaseSeed: 0.8,
        keyframes: [
          { t: 0.0, x: 16.5, z: -5.5, yaw: 0.1, crouch: 0.22 },
          { t: 4.8, x: 18.2, z: -8.5, yaw: -2.95, crouch: 0.32 },
          { t: 8.8, x: 19.8, z: -23.5, yaw: -2.95, crouch: 0.3 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 25.5, y: 0.115, z: 16.4 },
      { t: 2.2, x: 25.65, y: 0.115, z: 10.85 },
      { t: 3.9, x: 25.05, y: 0.115, z: 6.12 },
      { t: 4.55, x: 23.52, y: 0.115, z: 5.48 },
      { t: 5.00, x: 23.38, y: 0.115, z: 4.86 },
      { t: 6.1, x: 23.9, y: 0.35, z: -9.5, arcY: 0.45 },
      { t: 7.18, x: 23.52, y: 0.115, z: -21.25 },
      { t: 8.8, x: 22.1, y: 0.115, z: -27.2 }
    ],
    pedriRibbon: [[25.4, 0.06, 16.8], [25.6, 0.06, 11.2], [25.2, 0.06, 6.4], [23.5, 0.06, 5.45], [23.55, 0.06, -20.8]],
    overshootRibbon: [[21.5, 0.05, 10.5], [24.8, 0.05, 6.8], [26.4, 0.05, 5.5]]
  },

  // ============================================================================
  // SCENARIO 11 (FW): s11_fw_yamal_slalom.mp4 (8.600s — Barcelona vs Athletic Club)
  // ============================================================================
  {
    id: 'yamal-bilbao-box-slalom',
    index: '11',
    positionGroup: 'FW',
    positionLabel: '前锋 RW',
    starName: '#19 亚马尔 Yamal',
    durationSec: 8.6,
    title: '亚马尔肋部 1v4 蝴蝶穿花 · 禁区弧顶连过毕巴四人突入小禁区',
    moveName: '左脚内切变向 + 双人夹缝油炸丸子 + 小禁区捅射 (1v4 Penalty-Arc Slalom)',
    zoneTag: '右肋至小禁区 (8.60s 1:1)',
    matchRef: '直播吧西甲原片 1:1 帧同步：巴萨 vs 毕尔巴鄂竞技 (#19 亚马尔 8.6s 连过四人杀穿禁区)',
    pressureType: '毕巴红白剑条衫黑裤 #17 贝尔奇切 + #4 帕雷德斯 + #3 维维安 + #24 普拉多斯四重铁桶阵',
    metrics: {
      touches: '8次左脚高频粘球变向',
      feintAngle: '0.9m 极窄双卫关门缝钻出',
      scans: '沉肩诱导四名后卫重心交错',
      escapeWindow: '5.4s–6.8s 罚球弧双卫夹缝'
    },
    keypoints: [
      '0.00s–2.50s：#19 亚马尔在右肋外围（Z = -6m）接队友分球，面对毕尔巴鄂红白间条衫黑短裤（bilbao-striped）#17 贝尔奇切迎面封堵，左脚轻拨顺势内切进入 Zone 14。',
      '2.60s–5.80s：刚踏入禁区弧顶，毕巴三名防守人呈三角形瞬间合拢关门！亚马尔不减速，利用超高频左脚外拨+右脚油炸丸子（soccer_crossover_feint）从三人合围中心硬生生钻出！',
      '5.90s–8.60s：突入点球点右侧再扣过补防中卫 #3 维维安（soccer_cut_right_90），7.4s 杀入小禁区直面黄衣门将乌奈·西蒙捅射远角！'
    ],
    phases: [
      { timeRange: [0.0, 2.7], label: '0.0–2.7s 肋部接球内切启动', desc: '亚马尔在右肋停球启动，左脚拨球斜切抹过毕巴左后卫 #17 贝尔奇切。' },
      { timeRange: [2.7, 5.6], label: '2.7–5.6s 禁区弧顶三人包夹穿花', desc: '直闯罚球弧核心，高频双脚油炸丸子在三名红白球衣后卫合拢前钻出夹缝！' },
      { timeRange: [5.6, 7.2], label: '5.6–7.2s 点球点变向甩开中卫', desc: '再向右前方趟球一步甩开最后一名补防中卫 #3 维维安。' },
      { timeRange: [7.2, 8.6], label: '7.2–8.6s 杀入小禁区单挑门将', desc: '7.5s 突至小禁区角面对黄衣门将西蒙低平捅射！' }
    ],
    defaultFocus: [3.2, 0, -20.5],
    camTrack: [
      { t: 0.0, pos: [21.5, 11.2, -5.5], target: [5.2, 0.85, -9.5], fov: 35 },
      { t: 4.3, pos: [21.2, 10.8, -14.5], target: [3.8, 0.85, -19.5], fov: 34 },
      { t: 8.6, pos: [20.5, 10.4, -20.5], target: [1.8, 0.9, -28.5], fov: 33 }
    ],
    actors: [
      {
        id: 'yamal_hero',
        hairVariant: 2,
        role: 'hero',
        kit: 'barca-home',
        number: '19',
        shirtName: 'LAMINE YAMAL',
        skinTint: '#8d5b3e',
        skinTone: '#8d5b3e',
        label: '#19 亚马尔 Yamal (右边锋)',
        keyframes: [
          { t: 0.0, x: 8.2, z: -5.8, yaw: -2.85, scanYaw: -0.5, crouch: 0.2 },
          { t: 1.5, x: 7.6, z: -8.6, yaw: -2.75, crouch: 0.28 },
          { t: 2.9, x: 5.8, z: -13.8, yaw: -2.65, crouch: 0.38, leanRoll: 0.15 },
          { t: 4.35, x: 4.2, z: -18.2, yaw: -2.95, crouch: 0.45 },
          { t: 5.75, x: 3.1, z: -22.2, yaw: -3.12, crouch: 0.46, leanRoll: -0.16 },
          { t: 7.15, x: 4.2, z: -26.8, yaw: -2.92, crouch: 0.36 },
          { t: 8.6, x: 3.8, z: -29.2, yaw: -2.75, crouch: 0.22 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.5, clip: 'jog_fwd', rate: 1.08 },
          { start: 1.5, end: 3.1, clip: 'soccer_cut_left_90', rate: 1.15, offset: 0.05 },
          { start: 3.1, end: 5.65, clip: 'soccer_crossover_feint', rate: 1.32, offset: 0.05 },
          { start: 5.65, end: 7.1, clip: 'soccer_cut_right_90', rate: 1.25, offset: 0.05 },
          { start: 7.1, end: 8.05, clip: 'soccer_power_kick', rate: 1.25, offset: 0.15 },
          { start: 8.05, end: 8.6, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 1.32, peak: 1.52, end: 1.78, foot: 'L', type: 'inside', action: 'receive', maxWeight: 0.92 },
          { start: 2.75, peak: 2.96, end: 3.20, foot: 'L', type: 'outside', action: 'dribble', maxWeight: 0.94 },
          { start: 4.18, peak: 4.42, end: 4.68, foot: 'L', type: 'inside', action: 'dribble', maxWeight: 0.95 },
          { start: 5.60, peak: 5.84, end: 6.10, foot: 'L', type: 'outside', action: 'dribble', maxWeight: 0.95 },
          { start: 7.22, peak: 7.42, end: 7.66, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'bil17',
        role: 'defender',
        kit: 'bilbao-striped',
        number: '17',
        shirtName: 'YURI',
        label: '毕巴 #17 贝尔奇切 (首道被内切甩开)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: 6.8, z: -12.5, yaw: 0.3, crouch: 0.28 },
          { t: 2.85, x: 6.9, z: -14.2, yaw: -0.45, crouch: 0.56 },
          { t: 4.8, x: 6.4, z: -16.8, yaw: -2.8, crouch: 0.42 },
          { t: 8.6, x: 5.8, z: -24.5, yaw: -2.95, crouch: 0.25 }
        ]
      },
      {
        id: 'bil24',
        role: 'defender',
        kit: 'bilbao-striped',
        number: '24',
        shirtName: 'PRADOS',
        label: '毕巴 #24 普拉多斯 (弧顶包夹扑空)',
        phaseSeed: 0.42,
        keyframes: [
          { t: 0.0, x: 2.8, z: -15.8, yaw: 0.25, crouch: 0.25 },
          { t: 4.4, x: 2.9, z: -18.5, yaw: 0.55, crouch: 0.6 },
          { t: 6.0, x: 2.1, z: -21.2, yaw: -2.6, crouch: 0.48 },
          { t: 8.6, x: 2.4, z: -25.8, yaw: -2.95, crouch: 0.25 }
        ]
      },
      {
        id: 'bil4',
        role: 'defender',
        kit: 'bilbao-striped',
        number: '4',
        shirtName: 'PAREDES',
        label: '毕巴 #4 帕雷德斯 (关门慢半拍)',
        phaseSeed: 0.68,
        keyframes: [
          { t: 0.0, x: 5.2, z: -20.8, yaw: 0.15, crouch: 0.28 },
          { t: 5.65, x: 4.6, z: -22.5, yaw: -0.35, crouch: 0.62 },
          { t: 7.2, x: 5.4, z: -25.0, yaw: -2.75, crouch: 0.48 },
          { t: 8.6, x: 5.1, z: -27.2, yaw: -2.9, crouch: 0.28 }
        ]
      },
      {
        id: 'bil3',
        hairVariant: 2,
        role: 'defender',
        kit: 'bilbao-striped',
        number: '3',
        shirtName: 'VIVIAN',
        label: '毕巴 #3 维维安 (禁区补防被扣)',
        phaseSeed: 0.88,
        keyframes: [
          { t: 0.0, x: 1.6, z: -23.5, yaw: 0.15, crouch: 0.28 },
          { t: 5.8, x: 2.2, z: -23.2, yaw: 0.45, crouch: 0.58 },
          { t: 7.35, x: 2.8, z: -27.2, yaw: 0.85, crouch: 0.65 },
          { t: 8.6, x: 2.6, z: -28.4, yaw: -2.5, crouch: 0.35 }
        ]
      },
      {
        id: 'simon1',
        role: 'defender',
        kit: 'gk-yellow',
        number: '1',
        shirtName: 'UNAI SIMON',
        showShadow: false,
        label: '毕巴门将 #1 乌奈·西蒙 (黄衣出击)',
        keyframes: [
          { t: 0.0, x: 0.5, z: -33.0, yaw: 0.15, crouch: 0.35, showShadow: false },
          { t: 6.8, x: 1.8, z: -31.8, yaw: 0.35, crouch: 0.55, showShadow: false },
          { t: 7.85, x: 2.4, z: -30.6, yaw: 0.45, crouch: 0.72, leanRoll: -0.22, showShadow: false },
          { t: 8.6, x: 2.4, z: -30.6, yaw: 0.45, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 7.35, clip: 'crouch_jockey_fwd', rate: 1.05 },
          { start: 7.35, end: 8.6, clip: 'gk_dive_left', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 3.5, y: 0.115, z: -3.2 },
      { t: 1.48, x: 7.52, y: 0.115, z: -8.92 },
      { t: 2.92, x: 5.62, y: 0.115, z: -14.15 },
      { t: 4.38, x: 4.05, y: 0.115, z: -18.58 },
      { t: 5.78, x: 3.25, y: 0.115, z: -22.68 },
      { t: 7.42, x: 4.05, y: 0.115, z: -27.55 },
      { t: 8.35, x: -0.85, y: 0.18, z: -34.25, ease: 'linear' },
      { t: 8.6, x: -1.05, y: 0.115, z: -34.8 }
    ],
    pedriRibbon: [[8.2, 0.06, -5.8], [5.8, 0.06, -13.8], [4.2, 0.06, -18.2], [3.1, 0.06, -22.2], [4.2, 0.06, -26.8]],
    overshootRibbon: [[2.8, 0.05, -15.8], [2.9, 0.05, -18.5], [4.6, 0.05, -22.5]]
  },

  // ============================================================================
  // SCENARIO 12 (FW): s12_fw_vinicius_burst.mp4 (6.200s — Brazil vs Japan)
  // ============================================================================
  {
    id: 'vinicius-double-press-chip',
    index: '12',
    positionGroup: 'FW',
    positionLabel: '前锋 LW/CF',
    starName: '#7 维尼修斯 Vinícius Jr',
    durationSec: 6.2,
    title: '维尼修斯双卫关门强行生吃 · 扛住左右夹击挑射破门',
    moveName: '反越位领球卡身位 + 双中卫夹击爆发突刺 + 面对出击门将挑射 (Double-Press Split & Chip)',
    zoneTag: '罚球弧至点球点 (6.20s 1:1)',
    matchRef: '直播吧国际赛原片 1:1 帧同步：巴西 vs 日本 (#7 维尼修斯双蓝衣中卫夹击下强行生吃挑射)',
    pressureType: '日本深蓝 #14 伊东/右卫 + #4 板仓滉左右双人关门贴身挤靠 + 红衣门将弃门滑铲封堵',
    metrics: {
      touches: '1.6s顺球领入 + 2.7s趟球生吃 + 4.0s挑射',
      feintAngle: '双臂张开扛住两侧肩部对抗',
      scans: '3.4s 余光捕捉红衣门将倒地重心',
      escapeWindow: '2.1s–3.3s 双卫关门前0.4s爆趟'
    },
    keypoints: [
      '0.00s–1.65s：巴西中场中路送出贴地直塞，身披巴西黄衫蓝裤（brazil-yellow）的 #7 维尼修斯从肋部斜插弧顶迎球顺趟！',
      '1.70s–3.50s：日本队 #14 与 #4 两名深蓝球衣后卫从左右两侧同时高速回追形成“三明治夹击”；维尼修斯第一脚触球直接向前爆趟半步卡住身前线（sprint_fwd），用爆发步频硬生生把两人甩在身后半个身位！',
      '3.55s–6.20s：面对红衣门将弃门倒地滑扑封堵，维尼修斯 4.0s 右脚轻巧挑射越过门将坠入空门（同时提供地面近景第二视角剪辑②）！'
    ],
    phases: [
      { timeRange: [0.0, 1.65], label: '0.0–1.65s 肋部斜插接直塞', desc: '巴西 #10 送出穿透直塞，#7 维尼修斯高速启动切向弧顶中路。' },
      { timeRange: [1.65, 3.55], label: '1.65–3.55s 扛住双卫关门爆趟生吃', desc: '左右两名日本深蓝后卫同时贴肩挤压，维尼修斯顺势爆趟强行抢出单刀身位！' },
      { timeRange: [3.55, 6.2], label: '3.55–6.2s 轻巧挑射越过红衣门将', desc: '4.0s 抢在红衣门将滑扑封堵前轻挑破门，比分改写为 2-2！' }
    ],
    defaultFocus: [-1.5, 0, -22.0],
    camTrack: [
      { t: 0.0, pos: [23.5, 12.2, -10.5], target: [-2.0, 0.85, -15.5], fov: 37 },
      { t: 3.1, pos: [23.0, 11.8, -16.5], target: [-1.5, 0.9, -24.5], fov: 36 },
      { t: 6.2, pos: [22.5, 11.5, -20.0], target: [-0.5, 1.0, -31.5], fov: 35 }
    ],
    actors: [
      {
        id: 'vinicius7',
        hairVariant: 2,
        role: 'hero',
        kit: 'brazil-yellow',
        number: '7',
        shirtName: 'VINI JR.',
        skinTint: '#5c3a24',
        skinTone: '#5c3a24',
        bootColor: '#facc15',
        label: '#7 维尼修斯 Vinícius Jr (前锋)',
        keyframes: [
          { t: 0.0, x: -4.8, z: -10.2, yaw: -2.9, crouch: 0.22 },
          { t: 1.6, x: -3.1, z: -16.8, yaw: -2.95, crouch: 0.32, shieldSide: 'L' },
          { t: 2.85, x: -1.9, z: -23.2, yaw: -3.02, crouch: 0.35, shieldSide: 'R' },
          { t: 4.05, x: -1.2, z: -27.8, yaw: -3.05, crouch: 0.28 },
          { t: 5.1, x: 1.2, z: -30.5, yaw: -2.2, crouch: 0.15 },
          { t: 6.2, x: 3.8, z: -31.2, yaw: -1.75, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.55, clip: 'sprint_cut_r', rate: 1.15 },
          { start: 1.55, end: 3.75, clip: 'sprint_fwd', rate: 1.25 },
          { start: 3.75, end: 4.55, clip: 'soccer_through_ball', rate: 1.32, offset: 0.22 },
          { start: 4.55, end: 6.2, clip: 'jog_fwd', rate: 1.05 }
        ],
        touchWindows: [
          { start: 1.44, peak: 1.64, end: 1.88, foot: 'R', type: 'outside', action: 'receive', maxWeight: 0.92 },
          { start: 2.65, peak: 2.85, end: 3.06, foot: 'R', type: 'instep', action: 'dribble', maxWeight: 0.92 },
          { start: 3.82, peak: 4.02, end: 4.26, foot: 'R', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'paqueta10',
        role: 'teammate',
        kit: 'brazil-yellow',
        number: '10',
        shirtName: 'PAQUETA',
        label: '巴西 #10 帕奎塔 (中路直塞助攻)',
        keyframes: [
          { t: 0.0, x: -3.6, z: -6.5, yaw: -3.0, crouch: 0.25 },
          { t: 0.8, x: -3.4, z: -7.8, yaw: -3.0, crouch: 0.22 },
          { t: 6.2, x: -2.8, z: -13.5, yaw: -3.0, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 0.85, clip: 'soccer_power_kick', rate: 1.25, offset: 0.15 },
          { start: 0.85, end: 6.2, clip: 'jog_fwd', rate: 0.9 }
        ],
        touchWindows: [
          { start: 0.0, peak: 0.18, end: 0.42, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.9 }
        ]
      },
      {
        id: 'jpn14',
        role: 'defender',
        kit: 'japan-blue',
        number: '14',
        shirtName: 'ITO',
        label: '日本 #14 (左侧回追关门被甩开)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: -6.2, z: -12.8, yaw: -2.85, crouch: 0.28 },
          { t: 2.65, x: -3.1, z: -22.2, yaw: -2.9, crouch: 0.52 },
          { t: 4.1, x: -2.5, z: -26.8, yaw: -2.95, crouch: 0.45 },
          { t: 6.2, x: -2.2, z: -28.5, yaw: -3.0, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.2, clip: 'sprint_fwd', rate: 1.18 },
          { start: 4.2, end: 6.2, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'jpn4',
        role: 'defender',
        kit: 'japan-blue',
        number: '4',
        shirtName: 'ITAKURA',
        label: '日本 #4 板仓滉 (右侧挤压失位)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: -0.5, z: -14.5, yaw: -3.1, crouch: 0.28 },
          { t: 2.75, x: -0.7, z: -22.6, yaw: 3.05, crouch: 0.52 },
          { t: 4.15, x: -0.3, z: -26.9, yaw: 3.08, crouch: 0.45 },
          { t: 6.2, x: -0.2, z: -28.8, yaw: -3.05, crouch: 0.25 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 4.2, clip: 'sprint_fwd', rate: 1.16 },
          { start: 4.2, end: 6.2, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'jpngk',
        role: 'defender',
        kit: 'wales-red',
        number: '12',
        shirtName: 'SUZUKI',
        showShadow: false,
        label: '日本红衣门将 #12 (出击倒地扑空)',
        keyframes: [
          { t: 0.0, x: -0.4, z: -33.0, yaw: 0.08, crouch: 0.35, showShadow: false },
          { t: 3.2, x: -0.8, z: -30.8, yaw: 0.12, crouch: 0.55, showShadow: false },
          { t: 4.25, x: -1.1, z: -29.2, yaw: 0.35, crouch: 0.78, leanRoll: 0.28, showShadow: false },
          { t: 6.2, x: -1.1, z: -29.2, yaw: 0.35, crouch: 0.6, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.75, clip: 'crouch_jockey_fwd', rate: 1.1 },
          { start: 3.75, end: 6.2, clip: 'gk_dive_right', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -3.52, y: 0.115, z: -7.02 },
      { t: 0.18, x: -3.52, y: 0.115, z: -7.12 },
      { t: 1.62, x: -3.02, y: 0.115, z: -17.18, ease: 'linear' },
      { t: 2.85, x: -1.86, y: 0.115, z: -23.62 },
      { t: 4.02, x: -1.18, y: 0.14, z: -28.12 },
      { t: 4.55, x: -0.65, y: 1.25, z: -31.2, arcY: 0.55 },
      { t: 5.15, x: -0.25, y: 0.18, z: -34.45, ease: 'linear' },
      { t: 6.2, x: -0.15, y: 0.115, z: -35.2 }
    ],
    pedriRibbon: [[-4.8, 0.06, -10.2], [-3.1, 0.06, -16.8], [-1.9, 0.06, -23.2], [-1.2, 0.06, -27.8]],
    overshootRibbon: [[-6.2, 0.05, -12.8], [-3.1, 0.05, -22.2], [-2.5, 0.05, -26.8]]
  },

  // ============================================================================
  // SCENARIO 13 (FW): s13_fw_bale_overtake.mp4 (11.200s — Real Madrid vs Barcelona Copa Final)
  // ============================================================================
  {
    id: 'bale-touchline-curved-overtake',
    index: '13',
    positionGroup: 'FW',
    positionLabel: '前锋 WF',
    starName: '#11 贝尔 Gareth Bale',
    durationSec: 11.2,
    title: '贝尔国王杯决赛 36.9km/h 外道超车 · 传给3秒后的自己绝杀',
    moveName: '被撞出边线抗逼抢 + 界外弯道 36.9km/h 超车巴尔特拉 + 穿裆绝杀 (36.9km/h Curved Overtake)',
    zoneTag: '左路中线界外至小禁区 (11.20s 1:1)',
    matchRef: '直播吧国王杯经典 1:1 帧同步：皇马 2-1 巴萨 (#11 贝尔界外弯道超车 #15 巴尔特拉穿裆破门)',
    pressureType: '巴萨 #15 巴尔特拉中线凶狠横撞把贝尔挤出边线外 1.8 米 + 绿衣门将平托封近角',
    metrics: {
      touches: '3.2s人球分过 + 9.2s小禁区穿裆',
      feintAngle: '界外 2.2m 大弧度弯道超车',
      scans: '极速冲刺中锁死内切小禁区路线',
      escapeWindow: '3.6s–7.2s 峰值 36.9 km/h 绝对速度'
    },
    keypoints: [
      '0.00s–3.25s：国王杯决赛第 85 分钟，皇马白衣 #11 贝尔在本方左路接球启动（瞬时速度从 23.8 km/h 飙升至 35.8 km/h），面对巴萨 #15 巴尔特拉上抢直接左脚大趟人球分过！',
      '3.30s–7.30s：【传世外道超车】巴尔特拉在中线边线处用身体强行把贝尔撞出边线外草皮（X = -32.8m）试图战术阻挡；贝尔核心丝毫不乱，直接踩着场外草皮跑出一道惊世骇俗的弯道（峰值 36.9 km/h），反超内道直线回追的巴尔特拉！',
      '7.35s–11.20s：重回场内斜切杀入小禁区左侧，9.25s 左脚捅射穿过绿衣门将 #13 平托小门完成绝杀！（3D 镜头设于 X = -26m 左侧看台，与转播画面左上方球门 1:1 完全镜像对齐）'
    ],
    phases: [
      { timeRange: [0.0, 3.25], label: '0.0–3.25s 后场左路飙速人球分过', desc: '贝尔后场得球直线加速突破 34.5 km/h，过中线前左脚大趟把球传给 3 秒后的自己！' },
      { timeRange: [3.25, 7.25], label: '3.25–7.25s 界外 36.9km/h 弯道超车', desc: '遭 #15 巴尔特拉横撞挤出边线，贝尔绕场外大弧线狂飙硬生生完成外道反超！' },
      { timeRange: [7.25, 9.55], label: '7.25–9.55s 斜切小禁区穿裆绝杀', desc: '重新切入禁区甩开巴尔特拉，9.25s 左脚低射穿裆绿衣门将平托入网！' },
      { timeRange: [9.55, 11.2], label: '9.55–11.2s 冲向角旗狂奔庆祝', desc: '梅斯塔利亚球场皇马看台彻底沸腾！' }
    ],
    defaultFocus: [-22.0, 0, -10.0],
    // Broadcast camera on LEFT touchline stand (-X) looking diagonally toward left/top goal (-Z), matching TV clip 1:1!
    camTrack: [
      { t: 0.0, pos: [-43.5, 13.8, 25.0], target: [-25.5, 0.85, 12.5], fov: 39 },
      { t: 3.7, pos: [-44.5, 13.5, 14.5], target: [-29.5, 0.85, 0.5], fov: 38 },
      { t: 5.5, pos: [-44.0, 13.2, 5.5], target: [-28.5, 0.85, -10.5], fov: 38 },
      { t: 7.4, pos: [-39.5, 12.6, -4.5], target: [-19.5, 0.9, -22.5], fov: 37 },
      { t: 11.2, pos: [-35.5, 11.8, -14.5], target: [-4.5, 1.0, -32.0], fov: 35 }
    ],
    actors: [
      {
        id: 'bale11',
        role: 'hero',
        kit: 'madrid-white',
        number: '11',
        shirtName: 'BALE',
        hairColor: '#231710',
        bootColor: '#f97316',
        label: '#11 贝尔 Gareth Bale (36.9km/h 外道超车)',
        keyframes: [
          { t: 0.0, x: -27.5, z: 18.5, yaw: 3.08, crouch: 0.22 },
          { t: 2.1, x: -29.2, z: 8.5, yaw: 3.06, crouch: 0.28 },
          { t: 3.45, x: -30.8, z: 1.5, yaw: 2.95, crouch: 0.38, shieldSide: 'R' },
          { t: 5.15, x: -32.85, z: -8.2, yaw: -3.05, crouch: 0.32, leanRoll: -0.18 }, // outside -31m touchline!
          { t: 6.95, x: -28.2, z: -18.8, yaw: -2.72, crouch: 0.3, leanRoll: -0.16 },
          { t: 8.45, x: -12.5, z: -26.8, yaw: -2.35, crouch: 0.32 },
          { t: 9.35, x: -5.8, z: -30.2, yaw: -2.25, crouch: 0.28 },
          { t: 11.2, x: -11.5, z: -33.5, yaw: -1.6, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.85, clip: 'sprint_fwd', rate: 1.24 },
          { start: 2.85, end: 3.45, clip: 'sprint_cut_l', rate: 1.28 },
          { start: 3.45, end: 8.95, clip: 'sprint_fwd', rate: 1.34 },
          { start: 8.95, end: 9.75, clip: 'soccer_power_kick', rate: 1.28, offset: 0.16 },
          { start: 9.75, end: 11.2, clip: 'sprint_fwd', rate: 1.12 }
        ],
        touchWindows: [
          { start: 1.88, peak: 2.08, end: 2.30, foot: 'L', type: 'outside', action: 'dribble', maxWeight: 0.90 },
          { start: 2.95, peak: 3.15, end: 3.38, foot: 'L', type: 'instep', action: 'strike', maxWeight: 0.95 },
          { start: 6.96, peak: 7.18, end: 7.42, foot: 'L', type: 'outside', action: 'receive', maxWeight: 0.92 },
          { start: 9.08, peak: 9.28, end: 9.50, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'bartra15',
        role: 'defender',
        kit: 'barca-home',
        number: '15',
        shirtName: 'BARTRA',
        label: '巴萨 #15 巴尔特拉 (卡位挤人反遭超车)',
        phaseSeed: 0.25,
        keyframes: [
          { t: 0.0, x: -23.5, z: 12.2, yaw: 2.95, crouch: 0.25 },
          { t: 3.55, x: -29.6, z: 1.2, yaw: 2.85, crouch: 0.56 },
          { t: 5.4, x: -28.8, z: -8.5, yaw: -3.05, crouch: 0.45 },
          { t: 7.35, x: -24.5, z: -18.5, yaw: -2.65, crouch: 0.45 },
          { t: 9.4, x: -7.8, z: -29.2, yaw: -2.35, crouch: 0.48 },
          { t: 11.2, x: -7.2, z: -30.0, yaw: -2.35, crouch: 0.35 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.2, clip: 'sprint_fwd', rate: 1.15 },
          { start: 3.2, end: 4.1, clip: 'crouch_jockey_fwd', rate: 1.2 },
          { start: 4.1, end: 9.6, clip: 'sprint_fwd', rate: 1.14 },
          { start: 9.6, end: 11.2, clip: 'walk_fwd', rate: 0.8 }
        ]
      },
      {
        id: 'mascherano14',
        hairVariant: 2,
        role: 'defender',
        kit: 'barca-home',
        number: '14',
        shirtName: 'MASCHERANO',
        label: '巴萨 #14 马斯切拉诺 (中路回追)',
        phaseSeed: 0.6,
        keyframes: [
          { t: 0.0, x: -12.5, z: 4.5, yaw: 3.05, crouch: 0.25 },
          { t: 7.5, x: -11.8, z: -22.5, yaw: -2.9, crouch: 0.35 },
          { t: 11.2, x: -5.5, z: -29.5, yaw: -2.8, crouch: 0.25 }
        ]
      },
      {
        id: 'benzema9',
        hairVariant: 2,
        role: 'teammate',
        kit: 'madrid-white',
        number: '9',
        shirtName: 'BENZEMA',
        hasBeard: true,
        label: '皇马 #9 本泽马 (中路包抄牵制)',
        keyframes: [
          { t: 0.0, x: -6.5, z: 6.0, yaw: -3.1, crouch: 0.2 },
          { t: 8.5, x: -1.5, z: -25.5, yaw: -3.0, crouch: 0.25 },
          { t: 11.2, x: -4.2, z: -29.5, yaw: -2.2, crouch: 0.15 }
        ]
      },
      {
        id: 'pinto13',
        role: 'defender',
        kit: 'gk-green',
        number: '13',
        shirtName: 'PINTO',
        showShadow: false,
        label: '巴萨门将 #13 平托 (遭小角度穿裆)',
        keyframes: [
          { t: 0.0, x: -1.5, z: -33.2, yaw: -0.25, crouch: 0.35, showShadow: false },
          { t: 8.6, x: -3.2, z: -32.6, yaw: -0.55, crouch: 0.58, showShadow: false },
          { t: 9.65, x: -3.4, z: -32.8, yaw: -0.55, crouch: 0.78, showShadow: false },
          { t: 11.2, x: -3.4, z: -32.8, yaw: -0.55, crouch: 0.55, showShadow: false }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -27.2, y: 0.115, z: 18.0 },
      { t: 2.08, x: -29.15, y: 0.115, z: 8.15 },
      { t: 3.15, x: -30.28, y: 0.115, z: 2.75 },
      { t: 7.18, x: -26.18, y: 0.115, z: -20.22, ease: 'linear' }, // knocked 23m ahead into space!
      { t: 8.45, x: -11.95, y: 0.115, z: -27.15 },
      { t: 9.28, x: -5.65, y: 0.115, z: -30.35 },
      { t: 10.05, x: -0.8, y: 0.16, z: -34.45, ease: 'linear' },
      { t: 11.2, x: -0.5, y: 0.115, z: -35.2 }
    ],
    pedriRibbon: [[-27.5, 0.06, 18.5], [-30.8, 0.06, 1.5], [-32.85, 0.06, -8.2], [-28.2, 0.06, -18.8], [-5.8, 0.06, -30.2]],
    overshootRibbon: [[-23.5, 0.05, 12.2], [-29.6, 0.05, 1.2], [-28.8, 0.05, -8.5], [-24.5, 0.05, -18.5]]
  },

  // ============================================================================
  // SCENARIO 14 (FW): s14_fw_bardhi_chop.mp4 (6.800s — Trabzonspor vs Alanyaspor)
  // ============================================================================
  {
    id: 'bardhi-cruyff-chop-slide',
    index: '14',
    positionGroup: 'FW',
    positionLabel: '前锋 SS',
    starName: '#10 巴尔迪 Enis Bardhi',
    durationSec: 6.8,
    title: '巴尔迪抗贴身挤靠急停扣球 · 晃趴橙衣队长贴地斩破门',
    moveName: '护球扛住拉拽 + 急停假射真扣晃趴滑铲 + 杀入禁区低射 (Cruyff-Chop Ankle-Breaker)',
    zoneTag: '左肋推进至左门前 (6.80s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：特拉布宗 #10 巴尔迪扛人急停拉球晃趴橙衣队长破门 (含特写慢镜②)',
    pressureType: '橙衣队长 #4 全程贴背拉拽挤压 + 飞身倒地扑抢 + 蓝衣门将出击封堵',
    metrics: {
      touches: '2.9s 急停拉球变向 + 5.1s 推射',
      feintAngle: '110° 急停折返令后卫整个人趴地滑出',
      scans: '扛人同时锁定禁区肋部射门走廊',
      escapeWindow: '2.85s–3.55s 晃倒队长瞬间'
    },
    keypoints: [
      '0.00s–2.65s：身披深色天蓝间条衫（trabzon-striped）的 #10 巴尔迪在中前场带球推进（球门位于画面左侧 Z = -34m），橙衣队长 #4 紧贴其右侧用身体与手臂连续挤压干扰。',
      '2.70s–3.75s：【教科书级急停晃倒】巴尔迪佯装继续直线下底诱使橙衣队长全力前冲封堵，2.95s 突然急停回拉向内侧扣球（soccer_cut_right_90），橙衣队长刹不住车整个人水平扑倒趴在草皮上滑出两米（soccer_slide_tackle）！',
      '3.80s–6.80s：巴尔迪从容杀入禁区，5.1s 右脚精准推射远角穿过蓝衣门将十指关入网！（点击上方「直播吧剪辑②」可同步观看超清近景晃倒慢镜）'
    ],
    phases: [
      { timeRange: [0.0, 2.7], label: '0.0–2.7s 护球推进扛住橙衣队长', desc: '#10 巴尔迪带球高速推进，用左肩与核心力量顶住橙衣队长 #4 的贴身拉拽。' },
      { timeRange: [2.7, 4.0], label: '2.7–4.0s 急停回扣晃趴队长', desc: '2.95s 急停内扣 110°，橙衣队长重心彻底失控整个人飞扑趴倒在草皮上！' },
      { timeRange: [4.0, 5.6], label: '4.0–5.6s 突入禁区低射远角', desc: '甩开补防球员杀至点球点右侧，5.1s 冷静推射远角打穿蓝衣门将！' },
      { timeRange: [5.6, 6.8], label: '5.6–6.8s 皮球窜入左侧底角', desc: '一气呵成的抗逼抢+急停晃倒终结范本！' }
    ],
    defaultFocus: [-2.0, 0, -18.0],
    // Broadcast camera at -X looking toward Z = -34m so Attacking Goal is on Screen LEFT (matching video 1:1!)
    camTrack: [
      { t: 0.0, pos: [-24.5, 11.8, -4.5], target: [-2.5, 0.85, -8.5], fov: 36 },
      { t: 3.4, pos: [-24.0, 11.5, -11.5], target: [-2.8, 0.85, -16.5], fov: 36 },
      { t: 6.8, pos: [-23.2, 11.2, -19.5], target: [-1.2, 0.95, -29.5], fov: 35 }
    ],
    actors: [
      {
        id: 'bardhi10',
        hairVariant: 2,
        role: 'hero',
        kit: 'trabzon-striped',
        number: '10',
        shirtName: 'BARDHI',
        hasBeard: true,
        bootColor: '#bbf7d0',
        label: '#10 巴尔迪 Bardhi (影锋/前腰)',
        keyframes: [
          { t: 0.0, x: -2.2, z: -4.2, yaw: 3.05, crouch: 0.22 },
          { t: 2.25, x: -3.6, z: -12.8, yaw: 2.98, crouch: 0.38, shieldSide: 'R' },
          { t: 2.95, x: -4.1, z: -15.2, yaw: 3.02, crouch: 0.48 },
          { t: 3.75, x: -1.4, z: -16.8, yaw: -2.65, crouch: 0.4, leanRoll: -0.18 },
          { t: 4.95, x: -1.8, z: -23.5, yaw: 3.05, crouch: 0.32 },
          { t: 5.55, x: -1.9, z: -24.8, yaw: 3.05, crouch: 0.22 },
          { t: 6.8, x: -4.5, z: -26.5, yaw: 2.2, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.75, clip: 'sprint_fwd', rate: 1.14 },
          { start: 2.75, end: 3.85, clip: 'soccer_cut_right_90', rate: 1.28, offset: 0.05 },
          { start: 3.85, end: 4.85, clip: 'sprint_cut_l', rate: 1.15 },
          { start: 4.85, end: 5.65, clip: 'soccer_shot_drive', rate: 1.25, offset: 0.2 },
          { start: 5.65, end: 6.8, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 2.08, peak: 2.28, end: 2.50, foot: 'R', type: 'outside', action: 'dribble', maxWeight: 0.88 },
          { start: 2.86, peak: 3.10, end: 3.36, foot: 'R', type: 'inside', action: 'dribble', maxWeight: 0.96 },
          { start: 4.86, peak: 5.08, end: 5.30, foot: 'R', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'orange4',
        role: 'defender',
        kit: 'press-orange',
        number: '4',
        shirtName: 'ALITI',
        label: '橙衣队长 #4 (贴身逼抢被晃趴滑出)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: -1.1, z: -5.0, yaw: 3.02, crouch: 0.28 },
          { t: 2.55, x: -2.8, z: -13.4, yaw: 2.95, crouch: 0.56 },
          { t: 3.45, x: -5.4, z: -16.8, yaw: 2.45, crouch: 0.85, leanRoll: 0.28 },
          { t: 4.8, x: -5.8, z: -17.2, yaw: -1.8, crouch: 0.6 },
          { t: 6.8, x: -4.2, z: -19.5, yaw: 3.0, crouch: 0.3 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.82, clip: 'sprint_fwd', rate: 1.15 },
          { start: 2.82, end: 4.15, clip: 'soccer_slide_tackle', rate: 0.9, offset: 0.0 },
          { start: 4.15, end: 5.3, clip: 'soccer_turf_hand_shield', rate: 1.0 },
          { start: 5.3, end: 6.8, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'orange94',
        role: 'defender',
        kit: 'press-orange',
        number: '94',
        shirtName: 'HADERGJONAJ',
        label: '橙衣中卫 #94 (补防封堵慢半拍)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 1.5, z: -17.5, yaw: -0.1, crouch: 0.25 },
          { t: 4.2, x: 0.4, z: -21.5, yaw: -0.25, crouch: 0.52 },
          { t: 5.4, x: -0.6, z: -24.5, yaw: 2.9, crouch: 0.55 },
          { t: 6.8, x: -0.8, z: -25.8, yaw: 3.0, crouch: 0.28 }
        ]
      },
      {
        id: 'onuachu30',
        hairVariant: 2,
        role: 'teammate',
        kit: 'trabzon-striped',
        number: '30',
        shirtName: 'ONUACHU',
        skinTint: '#4a2e1b',
        skinTone: '#4a2e1b',
        label: '#30 奥努阿楚 (中锋前插牵制中卫)',
        keyframes: [
          { t: 0.0, x: -5.5, z: -12.5, yaw: 3.08, crouch: 0.2 },
          { t: 5.2, x: -5.8, z: -25.5, yaw: 2.95, crouch: 0.25 },
          { t: 6.8, x: -5.2, z: -27.5, yaw: 2.5, crouch: 0.15 }
        ]
      },
      {
        id: 'bluegk1',
        role: 'defender',
        kit: 'gk-blue',
        number: '1',
        shirtName: 'TASKIRAN',
        showShadow: false,
        label: '蓝衣门将 #1 (倒地扑救不及)',
        keyframes: [
          { t: 0.0, x: -0.4, z: -33.1, yaw: -0.1, crouch: 0.35, showShadow: false },
          { t: 4.95, x: -0.8, z: -32.4, yaw: -0.15, crouch: 0.55, showShadow: false },
          { t: 5.75, x: 1.8, z: -33.2, yaw: -0.4, crouch: 0.76, leanRoll: -0.28, showShadow: false },
          { t: 6.8, x: 1.8, z: -33.2, yaw: -0.4, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 5.0, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 5.0, end: 6.8, clip: 'gk_dive_left', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -2.35, y: 0.115, z: -4.65 },
      { t: 2.28, x: -3.72, y: 0.115, z: -13.18 },
      { t: 2.98, x: -4.02, y: 0.115, z: -15.45 },
      { t: 3.12, x: -3.65, y: 0.115, z: -15.80 },
      { t: 3.78, x: -1.35, y: 0.115, z: -17.2 },
      { t: 5.08, x: -1.80, y: 0.115, z: -24.16 },
      { t: 5.82, x: 2.55, y: 0.22, z: -34.35, ease: 'linear' },
      { t: 6.8, x: 2.75, y: 0.115, z: -35.1 }
    ],
    pedriRibbon: [[-2.2, 0.06, -4.2], [-4.1, 0.06, -15.2], [-1.4, 0.06, -16.8], [-1.8, 0.06, -23.5]],
    overshootRibbon: [[-1.1, 0.05, -5.0], [-2.8, 0.05, -13.4], [-5.4, 0.05, -16.8]]
  },

  // ============================================================================
  // SCENARIO 15 (DF): s15_df_vandijk_solo.mp4 (13.800s — Celtic Van Dijk Coast-to-Coast)
  // ============================================================================
  {
    id: 'vandijk-cb-coast-to-coast',
    index: '15',
    positionGroup: 'DF',
    positionLabel: '后卫 CB',
    starName: '#5 范戴克 Virgil van Dijk',
    durationSec: 13.8,
    title: '出球中卫范戴克 70 米一条龙 · 后场破逼抢晃飞滑铲低射破门',
    moveName: '本方半场加速破双人围抢 + 弧顶假射左扣晃飞中卫滑铲 + 贴地斩 (CB Coast-to-Coast Solo)',
    zoneTag: '本方后场 Z=+22m 至对方球门 (13.80s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：凯尔特人绿白横条衫 #5 范戴克后场启动 70m 连过四人破门',
    pressureType: '蓝衣前锋后场堵截 + 中圈双中场夹击 + 禁区弧顶中卫飞身滑铲封堵',
    metrics: {
      touches: '后场大步推进 + 10.2s假射扣球 + 11.5s爆射',
      feintAngle: '1.93m 身高罕见急停假射真扣',
      scans: '跨越中线抬头观察整条退防线',
      escapeWindow: '3.8s破中圈夹击 + 10.2s晃飞滑铲'
    },
    keypoints: [
      '0.00s–4.80s：【出球中卫推进典范】身披凯尔特人绿白横条衫（celtic-hoops）的中后卫 #5 范戴克在本方半场深处（Z = +21m）持球启动，大步流星趟球跨越中线（Z = +8m），直接抹过蓝衣前锋与后腰的两道上抢！',
      '4.90s–9.50s：杀入对方半场肋部，面对三名蓝衣白裤（scottish-blue）防守人回追收缩，范戴克利用中卫罕见的步幅优势连续变向杀至禁区弧顶！',
      '9.60s–13.80s：在罚球弧顶佯装右脚抽射（soccer_power_kick）随即急停左扣（soccer_cut_left_90），蓝衣中卫 #4 整个人飞身倒地滑铲扑空；范戴克 11.5s 贴地低射直窜球门死角！'
    ],
    phases: [
      { timeRange: [0.0, 4.8], label: '0.0–4.8s 后场带球破逼抢过中线', desc: '中后卫 #5 范戴克从本方半场 Z=+21m 启动，大步加速直接趟过蓝衣前场逼抢线跨越中圈！' },
      { timeRange: [4.8, 9.6], label: '4.8–9.6s 长途奔袭直插对方弧顶', desc: '利用强悍身体对抗与大步幅盘带穿过中场肋部，迫使蓝衣防线全面退守禁区。' },
      { timeRange: [9.6, 11.3], label: '9.6–11.3s 弧顶假射真扣晃飞滑铲', desc: '10.2s 假射急停左扣，诱使蓝衣中卫 #4 飞身滑铲直接滑出画面！' },
      { timeRange: [11.3, 13.8], label: '11.3–13.8s 贴地低射远角破门', desc: '11.55s 冷静低平球劲射打穿门将，完成足坛史上最经典的中后卫一条龙之一！' }
    ],
    defaultFocus: [-2.0, 0, -4.0],
    camTrack: [
      { t: 0.0, pos: [24.0, 11.2, 21.5], target: [-3.5, 0.9, 18.5], fov: 35 },
      { t: 4.6, pos: [25.5, 11.8, 9.5], target: [-4.5, 0.9, 5.5], fov: 37 },
      { t: 9.2, pos: [24.8, 11.5, -8.5], target: [-2.5, 0.9, -14.5], fov: 36 },
      { t: 13.8, pos: [23.5, 11.0, -18.5], target: [-0.5, 1.0, -29.5], fov: 35 }
    ],
    actors: [
      {
        id: 'vandijk5',
        hairVariant: 2,
        role: 'hero',
        kit: 'celtic-hoops',
        number: '5',
        shirtName: 'VAN DIJK',
        skinTint: '#8d5b3e',
        skinTone: '#8d5b3e',
        hasBeard: true,
        bootColor: '#fb7185',
        label: '#5 范戴克 Van Dijk (中后卫 CB)',
        keyframes: [
          { t: 0.0, x: -4.2, z: 21.2, yaw: -3.02, crouch: 0.18 },
          { t: 2.5, x: -5.8, z: 12.4, yaw: -2.95, crouch: 0.28 },
          { t: 4.8, x: -6.8, z: 3.2, yaw: -3.05, crouch: 0.32, leanRoll: 0.12 },
          { t: 7.4, x: -4.2, z: -7.5, yaw: -2.85, crouch: 0.32 },
          { t: 9.6, x: -2.1, z: -15.8, yaw: -3.02, crouch: 0.42 },
          { t: 10.65, x: -4.6, z: -18.2, yaw: -2.55, crouch: 0.44, leanRoll: 0.18 },
          { t: 11.75, x: -4.2, z: -20.2, yaw: -2.95, crouch: 0.26 },
          { t: 13.8, x: 1.5, z: -22.5, yaw: -1.65, crouch: 0.1 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.2, clip: 'jog_fwd', rate: 1.12 },
          { start: 2.2, end: 5.2, clip: 'sprint_fwd', rate: 1.16 },
          { start: 5.2, end: 9.55, clip: 'sprint_cut_r', rate: 1.14 },
          { start: 9.55, end: 10.1, clip: 'soccer_power_kick', rate: 1.35, offset: 0.18 },
          { start: 10.1, end: 11.05, clip: 'soccer_cut_left_90', rate: 1.25, offset: 0.08 },
          { start: 11.05, end: 12.05, clip: 'soccer_shot_drive', rate: 1.22, offset: 0.15 },
          { start: 12.05, end: 13.8, clip: 'sprint_fwd', rate: 1.05 }
        ],
        touchWindows: [
          { start: 2.34, peak: 2.54, end: 2.75, foot: 'R', type: 'instep', action: 'dribble', maxWeight: 0.88 },
          { start: 4.62, peak: 4.84, end: 5.06, foot: 'R', type: 'outside', action: 'dribble', maxWeight: 0.90 },
          { start: 10.05, peak: 10.28, end: 10.54, foot: 'R', type: 'inside', action: 'dribble', maxWeight: 0.96 },
          { start: 11.36, peak: 11.58, end: 11.82, foot: 'R', type: 'instep', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'stj9',
        role: 'defender',
        kit: 'scottish-blue',
        number: '9',
        shirtName: 'MACLEAN',
        label: '蓝衣前锋 #9 (中线前逼抢被甩开)',
        phaseSeed: 0.15,
        keyframes: [
          { t: 0.0, x: -2.2, z: 16.5, yaw: 0.35, crouch: 0.25 },
          { t: 2.8, x: -4.8, z: 11.5, yaw: 0.5, crouch: 0.52 },
          { t: 5.5, x: -5.2, z: 5.0, yaw: -2.9, crouch: 0.35 },
          { t: 13.8, x: -3.5, z: -8.0, yaw: -3.0, crouch: 0.2 }
        ]
      },
      {
        id: 'stj8',
        role: 'defender',
        kit: 'scottish-blue',
        number: '8',
        shirtName: 'MILLAR',
        label: '蓝衣后腰 #8 (中圈拦截扑空)',
        phaseSeed: 0.45,
        keyframes: [
          { t: 0.0, x: -6.2, z: 5.5, yaw: 0.15, crouch: 0.25 },
          { t: 4.65, x: -5.6, z: 3.6, yaw: 0.45, crouch: 0.58 },
          { t: 6.5, x: -5.0, z: 0.5, yaw: -2.85, crouch: 0.42 },
          { t: 13.8, x: -3.8, z: -14.5, yaw: -3.0, crouch: 0.22 }
        ]
      },
      {
        id: 'stj4',
        role: 'defender',
        kit: 'scottish-blue',
        number: '4',
        shirtName: 'ANDERSON',
        label: '蓝衣中卫 #4 (弧顶被假射晃飞滑铲)',
        phaseSeed: 0.72,
        keyframes: [
          { t: 0.0, x: -1.8, z: -15.5, yaw: 0.1, crouch: 0.25 },
          { t: 9.75, x: -2.2, z: -17.2, yaw: 0.2, crouch: 0.58 },
          { t: 10.65, x: 0.4, z: -16.6, yaw: 0.95, crouch: 0.84, leanRoll: -0.28 },
          { t: 12.2, x: 0.6, z: -16.8, yaw: -2.2, crouch: 0.55 },
          { t: 13.8, x: 0.2, z: -18.5, yaw: -2.9, crouch: 0.28 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 9.85, clip: 'crouch_jockey_back', rate: 1.0 },
          { start: 9.85, end: 11.15, clip: 'soccer_slide_tackle', rate: 0.92 },
          { start: 11.15, end: 12.3, clip: 'soccer_turf_hand_shield', rate: 1.0 },
          { start: 12.3, end: 13.8, clip: 'walk_fwd', rate: 0.85 }
        ]
      },
      {
        id: 'stjgk',
        role: 'defender',
        kit: 'gk-yellow',
        number: '1',
        shirtName: 'MANNUS',
        showShadow: false,
        label: '门将 #1 (倒地扑救不及)',
        keyframes: [
          { t: 0.0, x: -0.3, z: -33.1, yaw: 0.1, crouch: 0.35, showShadow: false },
          { t: 11.4, x: -0.8, z: -32.6, yaw: 0.15, crouch: 0.55, showShadow: false },
          { t: 12.35, x: 1.6, z: -33.3, yaw: -0.35, crouch: 0.75, leanRoll: -0.26, showShadow: false },
          { t: 13.8, x: 1.6, z: -33.3, yaw: -0.35, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 11.5, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 11.5, end: 13.8, clip: 'gk_dive_left', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -4.25, y: 0.115, z: 20.8 },
      { t: 2.54, x: -5.85, y: 0.115, z: 11.95 },
      { t: 4.84, x: -6.75, y: 0.115, z: 2.75 },
      { t: 7.4, x: -4.1, y: 0.115, z: -7.95 },
      { t: 9.65, x: -2.15, y: 0.115, z: -16.15 },
      { t: 10.28, x: -3.78, y: 0.115, z: -17.78 },
      { t: 10.65, x: -4.55, y: 0.115, z: -18.6 },
      { t: 11.58, x: -4.20, y: 0.115, z: -20.30 },
      { t: 12.42, x: 2.45, y: 0.18, z: -34.35, ease: 'linear' },
      { t: 13.8, x: 2.65, y: 0.115, z: -35.1 }
    ],
    pedriRibbon: [[-4.2, 0.06, 21.2], [-6.8, 0.06, 3.2], [-2.1, 0.06, -15.8], [-4.6, 0.06, -18.2], [-4.2, 0.06, -20.2]],
    overshootRibbon: [[-1.8, 0.05, -15.5], [-2.2, 0.05, -17.2], [0.4, 0.05, -16.6]]
  },

  // ============================================================================
  // SCENARIO 16 (DF): s16_df_timber_turn.mp4 (6.000s — Arsenal #12 Jurriën Timber)
  // ============================================================================
  {
    id: 'timber-rb-double-press-turn',
    index: '16',
    positionGroup: 'DF',
    positionLabel: '后卫 RB',
    starName: '#12 廷伯 Jurriën Timber',
    durationSec: 6.0,
    title: '技术型右后卫廷伯内收破夹击 · 禁区角背身半转身钻双人缝挑射',
    moveName: '内收边卫背身第一脚顺球转身 + 双人关门缝突刺 + 挑射破门 (Inverted-RB First-Touch Split)',
    zoneTag: '大禁区右角至小禁区 (6.00s 1:1)',
    matchRef: '直播吧原片 1:1 帧同步：阿森纳红身白袖 #12 廷伯禁区角一脚转身抹过双深蓝防守破门',
    pressureType: '两名深蓝球衣防守人一背一侧在大禁区角形成 1.1m 夹击关门陷阱',
    metrics: {
      touches: '1.1s 背身脚内侧顺球转身 + 3.6s 挑射',
      feintAngle: '180° 丝滑转髋直接钻过双卫中间',
      scans: '接球前已完成肩部扫描锁死身后空当',
      escapeWindow: '1.05s–1.95s 零停顿一脚穿双卫'
    },
    keypoints: [
      '0.00s–1.05s：【现代内收型边后卫模板】阿森纳红衣白袖（arsenal-red）右后卫 #12 廷伯前插至大禁区线右肋角背身接球，两名深蓝球衣防守人一前一侧同时贴身合围！',
      '1.10s–2.45s：廷伯不等球停死，直接敞开右髋用右脚内侧把球顺向两人之间的唯一缝隙（soccer_half_turn_180），一脚触球瞬间完成 180° 转身人球合一从双人夹缝中钻出！',
      '2.50s–6.00s：杀至小禁区右侧角面对倒地扑救的蓝衣门将，3.65s 冷静轻挑远角入网！'
    ],
    phases: [
      { timeRange: [0.0, 1.05], label: '0.0–1.05s 内收至禁区角背身接球', desc: '右后卫 #12 廷伯前插站在禁区线角上，两名深蓝防守人从背后与侧面同时逼近。' },
      { timeRange: [1.05, 2.5], label: '1.05–2.5s 一脚顺球转身钻双人缝', desc: '零多余触球！右脚内侧顺球半转身，直接从两名深蓝防守人关门前的夹缝钻入禁区！' },
      { timeRange: [2.5, 4.3], label: '2.5–4.3s 小禁区角轻挑越过门将', desc: '高速突至小禁区角，3.65s 挑射打穿倒地封堵的蓝衣门将！' },
      { timeRange: [4.3, 6.0], label: '4.3–6.0s 场边看台振臂狂欢', desc: '现代技术流边后卫在狭小空间内堪比顶级前腰的摆脱终结能力！' }
    ],
    defaultFocus: [5.5, 0, -23.5],
    camTrack: [
      { t: 0.0, pos: [19.5, 10.8, -14.5], target: [6.2, 0.85, -18.5], fov: 33 },
      { t: 2.2, pos: [19.8, 10.6, -18.5], target: [5.5, 0.85, -23.5], fov: 34 },
      { t: 6.0, pos: [19.5, 10.5, -21.5], target: [2.2, 0.95, -31.0], fov: 35 }
    ],
    actors: [
      {
        id: 'timber12',
        hairVariant: 2,
        role: 'hero',
        kit: 'arsenal-red',
        number: '12',
        shirtName: 'TIMBER',
        skinTint: '#5c3a24',
        skinTone: '#5c3a24',
        label: '#12 廷伯 Jurriën Timber (右后卫 RB)',
        keyframes: [
          { t: 0.0, x: 6.8, z: -17.2, yaw: 0.35, scanYaw: -0.75, crouch: 0.28 },
          { t: 1.05, x: 6.6, z: -17.6, yaw: 0.2, crouch: 0.44 },
          { t: 1.95, x: 6.2, z: -21.2, yaw: -2.95, crouch: 0.36, leanRoll: 0.16 },
          { t: 3.05, x: 5.4, z: -26.8, yaw: -2.85, crouch: 0.32 },
          { t: 3.85, x: 4.8, z: -28.8, yaw: -2.65, crouch: 0.25 },
          { t: 6.0, x: 7.2, z: -30.5, yaw: -1.65, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 0.96, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 0.96, end: 1.95, clip: 'soccer_half_turn_180', rate: 1.38, offset: 0.15 },
          { start: 1.95, end: 3.45, clip: 'sprint_fwd', rate: 1.2 },
          { start: 3.45, end: 4.25, clip: 'soccer_through_ball', rate: 1.28, offset: 0.2 },
          { start: 4.25, end: 6.0, clip: 'jog_fwd', rate: 1.0 }
        ],
        touchWindows: [
          { start: 0.92, peak: 1.14, end: 1.42, foot: 'R', type: 'inside', action: 'receive', maxWeight: 0.98 },
          { start: 2.34, peak: 2.55, end: 2.78, foot: 'R', type: 'outside', action: 'dribble', maxWeight: 0.92 },
          { start: 3.48, peak: 3.66, end: 3.90, foot: 'R', type: 'inside', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'saka7',
        hairVariant: 2,
        role: 'teammate',
        kit: 'arsenal-red',
        number: '7',
        shirtName: 'SAKA',
        skinTint: '#5c3a24',
        skinTone: '#5c3a24',
        label: '阿森纳 #7 萨卡 (外围直塞喂球)',
        keyframes: [
          { t: 0.0, x: 8.5, z: -11.5, yaw: -2.9, crouch: 0.22 },
          { t: 0.6, x: 8.2, z: -12.4, yaw: -2.9, crouch: 0.2 },
          { t: 6.0, x: 7.8, z: -18.5, yaw: -2.95, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 0.65, clip: 'soccer_power_kick', rate: 1.3, offset: 0.22 },
          { start: 0.65, end: 6.0, clip: 'jog_fwd', rate: 0.9 }
        ],
        touchWindows: [
          { start: 0.0, peak: 0.16, end: 0.38, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.90 }
        ]
      },
      {
        id: 'spurs19',
        role: 'defender',
        kit: 'spurs-navy',
        number: '19',
        shirtName: 'UDOMA',
        label: '深蓝后卫 #19 (贴背上抢被转身甩开)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 5.2, z: -18.8, yaw: 0.65, crouch: 0.3 },
          { t: 1.25, x: 5.6, z: -18.2, yaw: 0.85, crouch: 0.58 },
          { t: 2.3, x: 5.1, z: -20.2, yaw: -2.8, crouch: 0.48 },
          { t: 6.0, x: 4.5, z: -27.5, yaw: -2.9, crouch: 0.28 }
        ]
      },
      {
        id: 'spurs8',
        role: 'defender',
        kit: 'spurs-navy',
        number: '8',
        shirtName: 'BISSOUMA',
        label: '深蓝后腰 #8 (侧向夹击扑空)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: 8.4, z: -19.2, yaw: -0.65, crouch: 0.28 },
          { t: 1.35, x: 7.5, z: -18.8, yaw: -0.95, crouch: 0.58 },
          { t: 2.4, x: 7.3, z: -20.8, yaw: -2.95, crouch: 0.45 },
          { t: 6.0, x: 6.2, z: -27.8, yaw: -2.95, crouch: 0.28 }
        ]
      },
      {
        id: 'spursgk',
        role: 'defender',
        kit: 'gk-blue',
        number: '1',
        shirtName: 'VICARIO',
        showShadow: false,
        label: '蓝衣门将 #1 (小禁区倒地封堵)',
        keyframes: [
          { t: 0.0, x: 0.8, z: -33.1, yaw: 0.2, crouch: 0.35, showShadow: false },
          { t: 3.1, x: 2.4, z: -31.8, yaw: 0.4, crouch: 0.56, showShadow: false },
          { t: 4.0, x: 3.1, z: -30.8, yaw: 0.55, crouch: 0.76, leanRoll: -0.25, showShadow: false },
          { t: 6.0, x: 3.1, z: -30.8, yaw: 0.55, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.45, clip: 'crouch_jockey_fwd', rate: 1.05 },
          { start: 3.45, end: 6.0, clip: 'gk_dive_left', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: 8.42, y: 0.115, z: -11.82 },
      { t: 0.16, x: 8.32, y: 0.115, z: -12.02 },
      { t: 1.14, x: 6.42, y: 0.115, z: -17.52, ease: 'linear' },
      { t: 1.98, x: 6.12, y: 0.115, z: -21.55 },
      { t: 2.55, x: 5.68, y: 0.115, z: -24.62 },
      { t: 3.66, x: 4.84, y: 0.14, z: -28.64 },
      { t: 4.35, x: -0.45, y: 0.42, z: -34.35, arcY: 0.35 },
      { t: 6.0, x: -0.65, y: 0.115, z: -35.1 }
    ],
    pedriRibbon: [[6.8, 0.06, -17.2], [6.2, 0.06, -21.2], [5.4, 0.06, -26.8], [4.8, 0.06, -28.8]],
    overshootRibbon: [[5.2, 0.05, -18.8], [5.6, 0.05, -18.2], [7.5, 0.05, -18.8]]
  },

  // ============================================================================
  // SCENARIO 17 (DF): s17_df_davies_surge.mp4 (12.600s — Bayern #19 Alphonso Davies)
  // ============================================================================
  {
    id: 'davies-lb-press-break-assist',
    index: '17',
    positionGroup: 'DF',
    positionLabel: '后卫 LB',
    starName: '#19 阿方索·戴维斯 Davies',
    durationSec: 12.6,
    title: '左后卫阿方索·戴维斯后场破围 · 75米套边卸高球横传助攻',
    moveName: '后场撞墙破逼抢 + 左翼超音速套上 + 禁区高速顺势左脚卸高球横敲空门 (LB Full-Pitch Press-Break)',
    zoneTag: '本方半场 Z=+18m 至左小禁区 (12.60s 1:1)',
    matchRef: '直播吧德国杯原片 1:1 帧同步：拜仁红衣 #19 戴维斯后场破逼抢奔袭禁区卸球助攻破门',
    pressureType: '柏林赫塔蓝白间条衫（hertha-striped）中线围堵 + 禁区内右后卫贴身卡位追防',
    metrics: {
      touches: '2.7s撞墙出球 + 8.9s左脚顺势卸球 + 10.1s横传',
      feintAngle: '后场摆脱后无球冲刺 52 米反插肋部',
      scans: '边路套上同步观察中路挑传落点',
      escapeWindow: '8.6s–10.2s 禁区高速顺势停球横敲'
    },
    keypoints: [
      '0.00s–4.30s：拜仁全红战袍（bayern-red）左后卫 #19 阿方索·戴维斯在本方半场（Z = +16m）面对蓝白间条衫对手逼抢，冷静横向拨球与中场完成二过一撞墙摆脱，跨越中线（Z = +8m）！',
      '4.40s–8.30s：出球后戴维斯开启“加拿大跑车”引擎沿左肋高速无球前插（sprint_fwd），队友在中场送出过顶挑传越过整条蓝白防线！',
      '8.40s–12.60s：戴维斯杀入禁区左侧，在高速奔跑中伸出左脚柔和卸下过顶来球，10.15s 抢在黄衣门将封堵前左脚横敲门前助攻 #9 队友推射空门！'
    ],
    phases: [
      { timeRange: [0.0, 4.3], label: '0.0–4.3s 后场控球撞墙破中线逼抢', desc: '左后卫 #19 戴维斯在本方半场摆脱上抢，分球中场后立即启动高速套边！' },
      { timeRange: [4.3, 8.3], label: '4.3–8.3s 左翼跑车超速无球前插', desc: '从 Z=+6m 一路狂飙反越位直插大禁区左肋，队友默契送出精妙过顶挑传！' },
      { timeRange: [8.3, 10.4], label: '8.3–10.4s 禁区步点不减速柔和卸高球', desc: '8.9s 高速冲刺中左脚顺势将过顶球卸在身前草皮，一步趟向小禁区底线角！' },
      { timeRange: [10.4, 12.6], label: '10.4–12.6s 倒三角横敲喂饼空门', desc: '10.15s 冷静左脚横推小禁区中路，#9 舒波-莫廷轻松推射空门入网！' }
    ],
    defaultFocus: [-2.0, 0, -6.0],
    camTrack: [
      { t: 0.0, pos: [25.5, 11.8, 16.5], target: [-3.0, 0.85, 12.5], fov: 38 },
      { t: 4.2, pos: [26.0, 12.0, 6.5], target: [2.0, 0.85, 2.5], fov: 38 },
      { t: 8.4, pos: [24.8, 11.6, -12.5], target: [-3.5, 0.95, -20.5], fov: 37 },
      { t: 12.6, pos: [23.5, 11.2, -20.5], target: [-0.5, 1.0, -30.5], fov: 36 }
    ],
    actors: [
      {
        id: 'davies19',
        hairVariant: 2,
        role: 'hero',
        kit: 'bayern-red',
        number: '19',
        shirtName: 'DAVIES',
        skinTint: '#4a2e1b',
        skinTone: '#4a2e1b',
        label: '#19 阿方索·戴维斯 Davies (左后卫 LB)',
        keyframes: [
          { t: 0.0, x: -5.5, z: 16.5, yaw: -2.85, crouch: 0.2 },
          { t: 2.6, x: -2.2, z: 8.8, yaw: -2.45, crouch: 0.3 },
          { t: 3.6, x: -1.8, z: 6.5, yaw: -3.02, crouch: 0.25 },
          { t: 6.4, x: -6.8, z: -9.5, yaw: -3.05, crouch: 0.28 },
          { t: 8.65, x: -6.2, z: -22.5, yaw: -2.95, crouch: 0.38, shieldSide: 'R' },
          { t: 10.15, x: -5.4, z: -27.8, yaw: -2.15, crouch: 0.32 },
          { t: 12.6, x: -3.5, z: -29.2, yaw: -1.65, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.5, clip: 'jog_fwd', rate: 1.15 },
          { start: 2.5, end: 3.3, clip: 'soccer_power_kick', rate: 1.32, offset: 0.22 },
          { start: 3.3, end: 9.15, clip: 'sprint_fwd', rate: 1.24 },
          { start: 9.15, end: 9.95, clip: 'sprint_cut_r', rate: 1.18 },
          { start: 9.95, end: 10.75, clip: 'soccer_power_kick', rate: 1.32, offset: 0.22 },
          { start: 10.75, end: 12.6, clip: 'jog_fwd', rate: 0.95 }
        ],
        touchWindows: [
          { start: 2.50, peak: 2.70, end: 2.94, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.92 },
          { start: 8.62, peak: 8.90, end: 9.22, foot: 'L', type: 'inside', action: 'receive', maxWeight: 0.98 },
          { start: 9.96, peak: 10.15, end: 10.38, foot: 'L', type: 'inside', action: 'strike', maxWeight: 0.96 }
        ]
      },
      {
        id: 'kimmich6',
        role: 'teammate',
        kit: 'bayern-red',
        number: '6',
        shirtName: 'KIMMICH',
        label: '拜仁 #6 基米希 (接应撞墙送挑传)',
        keyframes: [
          { t: 0.0, x: 4.5, z: 6.5, yaw: 0.4, crouch: 0.2 },
          { t: 3.5, x: 5.8, z: 2.5, yaw: -2.9, crouch: 0.28 },
          { t: 6.6, x: 4.2, z: -8.5, yaw: -2.75, crouch: 0.32 },
          { t: 12.6, x: 3.8, z: -15.5, yaw: -3.0, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 3.4, clip: 'idle_ready', rate: 1.0 },
          { start: 3.4, end: 6.45, clip: 'jog_fwd', rate: 1.1 },
          { start: 6.45, end: 7.35, clip: 'soccer_through_ball', rate: 1.25, offset: 0.18 },
          { start: 7.35, end: 12.6, clip: 'walk_fwd', rate: 0.9 }
        ],
        touchWindows: [
          { start: 3.42, peak: 3.60, end: 3.84, foot: 'R', type: 'inside', action: 'receive', maxWeight: 0.88 },
          { start: 6.52, peak: 6.75, end: 7.02, foot: 'R', type: 'instep', action: 'strike', maxWeight: 0.94 }
        ]
      },
      {
        id: 'choupo9',
        hairVariant: 2,
        role: 'teammate',
        kit: 'bayern-red',
        number: '9',
        shirtName: 'CHOUPO-MOTING',
        skinTint: '#6e4730',
        skinTone: '#6e4730',
        label: '拜仁 #9 舒波-莫廷 (门前包抄推空门)',
        keyframes: [
          { t: 0.0, x: 0.5, z: -4.5, yaw: -3.05, crouch: 0.2 },
          { t: 8.5, x: 0.8, z: -22.5, yaw: -3.02, crouch: 0.28 },
          { t: 10.85, x: -0.4, z: -29.2, yaw: -3.05, crouch: 0.34 },
          { t: 12.6, x: 1.8, z: -30.5, yaw: -2.1, crouch: 0.15 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 10.55, clip: 'sprint_fwd', rate: 1.08 },
          { start: 10.55, end: 11.35, clip: 'soccer_shot_drive', rate: 1.25, offset: 0.22 },
          { start: 11.35, end: 12.6, clip: 'jog_fwd', rate: 0.95 }
        ],
        touchWindows: [
          { start: 10.70, peak: 10.88, end: 11.10, foot: 'R', type: 'inside', action: 'strike', maxWeight: 0.96 }
        ]
      },
      {
        id: 'hertha2',
        role: 'defender',
        kit: 'hertha-striped',
        number: '2',
        shirtName: 'KENNY',
        label: '赫塔 #2 (回追贴防被戴维斯卸球摆脱)',
        phaseSeed: 0.25,
        keyframes: [
          { t: 0.0, x: -3.8, z: 10.5, yaw: 0.25, crouch: 0.25 },
          { t: 2.8, x: -3.2, z: 8.2, yaw: -0.5, crouch: 0.52 },
          { t: 8.7, x: -4.8, z: -22.8, yaw: -2.95, crouch: 0.54 },
          { t: 10.3, x: -4.2, z: -27.5, yaw: -2.6, crouch: 0.52 },
          { t: 12.6, x: -3.8, z: -28.8, yaw: -2.8, crouch: 0.28 }
        ]
      },
      {
        id: 'hertha5',
        role: 'defender',
        kit: 'hertha-striped',
        number: '5',
        shirtName: 'UREMOVIC',
        label: '赫塔中卫 #5 (门前封堵慢一步)',
        phaseSeed: 0.65,
        keyframes: [
          { t: 0.0, x: 1.5, z: -12.5, yaw: 0.1, crouch: 0.25 },
          { t: 8.8, x: 1.2, z: -24.5, yaw: -3.0, crouch: 0.45 },
          { t: 11.0, x: 0.8, z: -29.8, yaw: -2.9, crouch: 0.58 },
          { t: 12.6, x: 0.8, z: -30.5, yaw: -2.9, crouch: 0.3 }
        ]
      },
      {
        id: 'herthagk',
        role: 'defender',
        kit: 'gk-yellow',
        number: '1',
        shirtName: 'CHRISTENSEN',
        showShadow: false,
        label: '赫塔黄衣门将 #1',
        keyframes: [
          { t: 0.0, x: -0.4, z: -33.1, yaw: 0.08, crouch: 0.35, showShadow: false },
          { t: 9.8, x: -2.2, z: -32.2, yaw: -0.35, crouch: 0.58, showShadow: false },
          { t: 11.15, x: -0.6, z: -33.0, yaw: 0.1, crouch: 0.75, leanRoll: -0.24, showShadow: false },
          { t: 12.6, x: -0.6, z: -33.0, yaw: 0.1, crouch: 0.55, showShadow: false }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -5.3, y: 0.115, z: 16.0 },
      { t: 2.7, x: -2.02, y: 0.115, z: 8.42 },
      { t: 3.6, x: 5.62, y: 0.115, z: 2.22, ease: 'linear' },
      { t: 6.75, x: 4.10, y: 0.18, z: -8.88 },
      { t: 7.75, x: -1.2, y: 2.75, z: -16.2, arcY: 1.35 }, // chipped lofted pass over defense!
      { t: 8.55, x: -5.85, y: 1.08, z: -22.1 },
      { t: 8.90, x: -6.02, y: 0.34, z: -23.72 }, // Davies in-stride left-foot cushion!
      { t: 9.35, x: -5.78, y: 0.115, z: -25.3 },
      { t: 10.15, x: -5.22, y: 0.115, z: -27.95 },
      { t: 10.88, x: -0.35, y: 0.115, z: -29.45, ease: 'linear' },
      { t: 11.45, x: 0.65, y: 0.22, z: -34.45, ease: 'linear' },
      { t: 12.6, x: 0.75, y: 0.115, z: -35.2 }
    ],
    pedriRibbon: [[-5.5, 0.06, 16.5], [-1.8, 0.06, 6.5], [-6.8, 0.06, -9.5], [-6.2, 0.06, -22.5], [-5.4, 0.06, -27.8]],
    overshootRibbon: [[-3.8, 0.05, 10.5], [-4.8, 0.05, -22.8], [-4.2, 0.05, -27.5]]
  },

  // ============================================================================
  // SCENARIO 18 (DF): s18_df_hakimi_drive.mp4 (11.000s — Morocco #2 Achraf Hakimi)
  // ============================================================================
  {
    id: 'hakimi-rwb-press-drive-rocket',
    index: '18',
    positionGroup: 'DF',
    positionLabel: '后卫 RWB',
    starName: '#2 阿什拉夫 Achraf Hakimi',
    durationSec: 11.0,
    title: '右翼卫阿什拉夫内切破围抢 · 连续趟过白衣中场 28 米重炮世界波',
    moveName: '边卫内收接应 + 强行变向抹过双后腰 + 28m 正脚背电梯重炮 (RWB Press-Break & 28m Rocket)',
    zoneTag: '右中场至 28m 远射走廊 (11.00s 1:1)',
    matchRef: '直播吧非洲国家赛原片 1:1 帧同步：摩洛哥红衣绿裤 #2 阿什拉夫内切破逼抢重炮轰门',
    pressureType: '白衣中场 #8 + #6 封锁边路走廊并连续横向拦截抢断',
    metrics: {
      touches: '4.6s变向抹过 + 7.2s横拨 + 8.5s重炮',
      feintAngle: '从右翼肋部斜向切入中路真空区',
      scans: '7.8s 抬头洞察门将站位靠前',
      escapeWindow: '8.2s–8.8s 28米无人封堵射门窗'
    },
    keypoints: [
      '0.00s–3.20s：摩洛哥后场耐心倒脚破开前场紧逼，身披摩洛哥红衫绿裤（morocco-red）的攻击型右翼卫 #2 阿什拉夫在右路中线附近（Z = +2m）接球内收。',
      '3.30s–7.80s：面对白衣（ivory-white）#8 与 #6 两名中场的侧向围抢，阿什拉夫不走死胡同下底，而是连续利用爆发步频斜向中路横向盘带（sprint_cut_l），接连抹过两道拦截！',
      '7.90s–11.00s：带至距门 28 米中路偏左真空地带，8.55s 右脚正脚背全力轰出贴地重炮（soccer_shot_drive），皮球如出膛炮弹直窜球门底角！'
    ],
    phases: [
      { timeRange: [0.0, 3.2], label: '0.0–3.2s 右路接应破首道逼抢', desc: '摩洛哥中场分球右肋，右翼卫 #2 阿什拉夫迎球顺势向内侧领球。' },
      { timeRange: [3.2, 7.8], label: '3.2–7.8s 斜向横切连过两名白衣后腰', desc: '利用边翼卫顶级冲刺步频斜切中路，连续摆脱白衣 #8 与 #6 的拦截伸脚！' },
      { timeRange: [7.8, 9.6], label: '7.8–9.6s 28米正脚背重炮轰门', desc: '8.55s 抡起右腿抽出无解远射直挂远端死角！' },
      { timeRange: [9.6, 11.0], label: '9.6–11.0s 世界波破门沸腾庆祝', desc: '现代进攻型翼卫“以带代传、破逼抢远射”的标杆回合！' }
    ],
    defaultFocus: [1.5, 0, -9.5],
    camTrack: [
      { t: 0.0, pos: [25.5, 12.2, 4.5], target: [2.5, 0.85, 1.5], fov: 37 },
      { t: 5.5, pos: [25.0, 12.0, -3.5], target: [0.5, 0.85, -7.5], fov: 37 },
      { t: 11.0, pos: [24.0, 11.5, -14.5], target: [-0.5, 0.95, -28.5], fov: 36 }
    ],
    actors: [
      {
        id: 'hakimi2',
        hairVariant: 2,
        role: 'hero',
        kit: 'morocco-red',
        number: '2',
        shirtName: 'HAKIMI',
        skinTint: '#8d5b3e',
        skinTone: '#8d5b3e',
        hasBeard: true,
        label: '#2 阿什拉夫 Hakimi (右翼卫 RWB)',
        keyframes: [
          { t: 0.0, x: 7.8, z: 3.5, yaw: -2.6, crouch: 0.18 },
          { t: 2.35, x: 6.4, z: 0.8, yaw: -2.45, crouch: 0.28 },
          { t: 4.85, x: 2.2, z: -4.2, yaw: -2.35, crouch: 0.36, leanRoll: 0.15 },
          { t: 7.25, x: -1.8, z: -8.2, yaw: -2.75, crouch: 0.38 },
          { t: 8.65, x: -1.5, z: -10.4, yaw: -2.98, crouch: 0.28 },
          { t: 11.0, x: 2.5, z: -12.5, yaw: -1.8, crouch: 0.12 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 2.35, clip: 'jog_fwd', rate: 1.0 },
          { start: 2.35, end: 5.2, clip: 'sprint_cut_l', rate: 1.16 },
          { start: 5.2, end: 7.95, clip: 'soccer_crossover_feint', rate: 1.25, offset: 0.05 },
          { start: 7.95, end: 9.05, clip: 'soccer_shot_drive', rate: 1.25, offset: 0.1 },
          { start: 9.05, end: 11.0, clip: 'sprint_fwd', rate: 1.05 }
        ],
        touchWindows: [
          { start: 2.15, peak: 2.36, end: 2.60, foot: 'R', type: 'inside', action: 'receive', maxWeight: 0.94 },
          { start: 4.68, peak: 4.90, end: 5.14, foot: 'R', type: 'outside', action: 'dribble', maxWeight: 0.92 },
          { start: 7.06, peak: 7.28, end: 7.52, foot: 'R', type: 'inside', action: 'dribble', maxWeight: 0.92 },
          { start: 8.36, peak: 8.56, end: 8.80, foot: 'R', type: 'instep', action: 'strike', maxWeight: 0.98 }
        ]
      },
      {
        id: 'amrabat4',
        hairVariant: 2,
        role: 'teammate',
        kit: 'morocco-red',
        number: '4',
        shirtName: 'AMRABAT',
        hasBeard: true,
        label: '摩洛哥 #4 阿姆拉巴特 (后腰出球)',
        keyframes: [
          { t: 0.0, x: -1.5, z: 5.2, yaw: 1.2, crouch: 0.22 },
          { t: 1.2, x: 0.2, z: 4.5, yaw: 1.35, crouch: 0.24 },
          { t: 11.0, x: 1.2, z: -2.5, yaw: -3.0, crouch: 0.14 }
        ],
        mocapSchedule: [
          { start: 0.0, end: 1.15, clip: 'soccer_pass_inside', rate: 1.2, offset: 0.15 },
          { start: 1.15, end: 11.0, clip: 'walk_fwd', rate: 0.9 }
        ],
        touchWindows: [
          { start: 0.08, peak: 0.28, end: 0.52, foot: 'R', type: 'inside', action: 'strike', maxWeight: 0.90 }
        ]
      },
      {
        id: 'civ8',
        hairVariant: 2,
        role: 'defender',
        kit: 'ivory-white',
        number: '8',
        shirtName: 'KESSIE',
        skinTint: '#4a2e1b',
        skinTone: '#4a2e1b',
        label: '白衣后腰 #8 (首道横移拦截被抹过)',
        phaseSeed: 0.2,
        keyframes: [
          { t: 0.0, x: 4.2, z: -2.8, yaw: 0.45, crouch: 0.25 },
          { t: 4.75, x: 3.4, z: -4.0, yaw: 0.85, crouch: 0.56 },
          { t: 6.5, x: 2.2, z: -5.8, yaw: -2.4, crouch: 0.45 },
          { t: 11.0, x: 0.8, z: -11.5, yaw: -2.95, crouch: 0.25 }
        ]
      },
      {
        id: 'civ6',
        hairVariant: 2,
        role: 'defender',
        kit: 'ivory-white',
        number: '6',
        shirtName: 'FOFANA',
        skinTint: '#4a2e1b',
        skinTone: '#4a2e1b',
        label: '白衣中场 #6 (二道扑抢失位)',
        phaseSeed: 0.55,
        keyframes: [
          { t: 0.0, x: -0.5, z: -6.8, yaw: 0.35, crouch: 0.25 },
          { t: 7.15, x: -0.6, z: -8.5, yaw: 0.75, crouch: 0.58 },
          { t: 8.8, x: -0.4, z: -10.2, yaw: -2.6, crouch: 0.48 },
          { t: 11.0, x: -0.6, z: -14.0, yaw: -3.0, crouch: 0.25 }
        ]
      },
      {
        id: 'civ4',
        hairVariant: 2,
        role: 'defender',
        kit: 'ivory-white',
        number: '4',
        shirtName: 'NDICKA',
        skinTint: '#4a2e1b',
        skinTone: '#4a2e1b',
        label: '白衣中卫 #4 (退守禁区线不及封堵)',
        phaseSeed: 0.8,
        keyframes: [
          { t: 0.0, x: -1.2, z: -16.8, yaw: 0.1, crouch: 0.25 },
          { t: 8.6, x: -1.4, z: -17.5, yaw: 0.1, crouch: 0.52 },
          { t: 11.0, x: -1.2, z: -20.5, yaw: -3.0, crouch: 0.28 }
        ]
      },
      {
        id: 'civgk',
        role: 'defender',
        kit: 'gk-yellow',
        number: '1',
        shirtName: 'FOFANA GK',
        showShadow: false,
        label: '门将 #1 (飞身扑救世界波不及)',
        keyframes: [
          { t: 0.0, x: -0.2, z: -33.0, yaw: 0.05, crouch: 0.35, showShadow: false },
          { t: 8.55, x: -0.4, z: -32.4, yaw: 0.08, crouch: 0.55, showShadow: false },
          { t: 9.55, x: 2.1, z: -33.4, yaw: -0.42, crouch: 0.76, leanRoll: -0.28, showShadow: false },
          { t: 11.0, x: 2.1, z: -33.4, yaw: -0.42, crouch: 0.55, showShadow: false }
        ],
        mocapSchedule: [
          { start: 0.0, end: 8.65, clip: 'crouch_jockey_fwd', rate: 1.0 },
          { start: 8.65, end: 11.0, clip: 'gk_dive_left', rate: 0.95 }
        ]
      }
    ],
    ballTrack: [
      { t: 0.0, x: -1.15, y: 0.115, z: 5.05 },
      { t: 0.28, x: -0.82, y: 0.115, z: 4.92 },
      { t: 2.36, x: 6.22, y: 0.115, z: 0.55, ease: 'linear' },
      { t: 4.90, x: 1.98, y: 0.115, z: -4.48 },
      { t: 7.28, x: -1.85, y: 0.115, z: -8.55 },
      { t: 8.56, x: -1.52, y: 0.13, z: -10.66 },
      { t: 9.52, x: 2.85, y: 0.92, z: -34.35, arcY: 0.35, ease: 'linear' }, // blistering 28m driven rocket!
      { t: 11.0, x: 3.05, y: 0.115, z: -35.2 }
    ],
    pedriRibbon: [[7.8, 0.06, 3.5], [6.4, 0.06, 0.8], [2.2, 0.06, -4.2], [-1.8, 0.06, -8.2], [-1.5, 0.06, -10.4]],
    overshootRibbon: [[4.2, 0.05, -2.8], [3.4, 0.05, -4.0], [-0.6, 0.05, -8.5]]
  }
];
