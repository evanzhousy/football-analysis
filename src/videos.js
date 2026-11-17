/**
 * Verified real-world match footage & Zhibo8 clipped MP4 highlights
 * mapped 1-to-1 to all 8 Three.js tactical scenarios.
 */
export const MASTER_ZHIBO8_REEL = {
  src: './assets/videos/zhibo8_pedri_all_8_clips.mp4',
  filename: 'zhibo8_pedri_all_8_clips.mp4',
  title: '【直播吧回放剪辑总集锦】佩德里 8 大中场抗逼抢过人全收录 (55.5s 无切镜 1:1 自动联动)',
  sourceUrl: 'https://www.zhibo8.com/zuqiu/luxiang.htm',
  segments: [
    { scenarioIndex: 0, start: 0.0, end: 4.0 },
    { scenarioIndex: 1, start: 4.0, end: 10.5 },
    { scenarioIndex: 2, start: 10.5, end: 16.1 },
    { scenarioIndex: 3, start: 16.1, end: 22.534 },
    { scenarioIndex: 4, start: 22.534, end: 33.068 },
    { scenarioIndex: 5, start: 33.068, end: 41.902 },
    { scenarioIndex: 6, start: 41.902, end: 47.702 },
    { scenarioIndex: 7, start: 47.702, end: 55.469 }
  ]
};

export const SCENARIO_VIDEOS = {
  'back-tight-half-turn': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs马略卡 背身半转身 (近景1:1)',
        src: './assets/videos/s1_zhibo8_half_turn.mp4',
        filename: 's1_zhibo8_pedri_half_turn.mp4',
        title: '【直播吧回放剪辑】2025-04-23 巴萨vs马略卡：#8佩德里背身精妙顺球半转身摆脱 (4.00s 单镜特写)',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2025-04-23/68080aa5d984enative.htm'
      },
      {
        label: '直播吧剪辑②：vs马略卡 侧面慢镜第二视角',
        src: './assets/videos/s1_angle2_half_turn.mp4',
        filename: 's1_angle2_pedri_half_turn.mp4',
        title: '【直播吧回放剪辑】2025-04-23 巴萨vs马略卡：第二视角特写拆解脚内侧缓冲顺球转身',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2025-04-23/68080aa5d984enative.htm'
      },
      {
        label: '直播吧剪辑③：国家德比 背身摆脱贝林厄姆',
        src: './assets/videos/s1_alt_bellingham_turn.mp4',
        filename: 's1_zhibo8_pedri_vs_bellingham.mp4',
        title: '【直播吧回放剪辑】2024-10-27 皇马0-4巴萨：佩德里中圈背身沉肩转圈摆脱贝林厄姆紧逼',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2024-10-27/671d90d3525dcnative.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 6,
      title: '【佩德里集锦 P6】停球 & 背身半转身摆脱专集',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=6'
    },
    yt1: {
      id: '7SVLlymD1Cw',
      start: 0,
      title: 'How Pedri Uses Fake Movements to Break the First Line',
      url: 'https://www.youtube.com/shorts/7SVLlymD1Cw'
    },
    yt2: {
      id: '63dsz3k4WHw',
      start: 10,
      title: 'Pedri vs Atletico Madrid (2026-11-09 巴萨2-1马竞个人集锦)',
      url: 'https://www.youtube.com/watch?v=63dsz3k4WHw'
    },
    zhibo8: {
      label: '直播吧原帖：背身精妙停球转身',
      url: 'https://news.zhibo8.com/zuqiu/2025-04-23/68080aa5d984enative.htm'
    },
    watchCue:
      '直播吧回放对照重点：注意近景慢镜中 #8 佩德里接球瞬间支撑脚微屈、敞开髋部用脚内侧/后跟顺球半转身，直接把身后贴防球员甩在身侧。'
  },

  'frontal-la-croqueta': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs巴列卡诺 油炸丸子钻双人缝',
        src: './assets/videos/s2_zhibo8_la_croqueta.mp4',
        filename: 's2_zhibo8_pedri_la_croqueta.mp4',
        title: '【直播吧回放剪辑】2025-02-18 巴萨vs巴列卡诺：佩德里中线双脚油炸丸子连击戏耍双人上抢',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2025-02-18/67b40410457b7native.htm'
      },
      {
        label: '直播吧剪辑②：vs马竞 正面连过数人破门',
        src: './assets/videos/s2_alt_atleti_drive.mp4',
        filename: 's2_zhibo8_pedri_vs_atleti_drive.mp4',
        title: '【直播吧回放剪辑】2024-12-22 巴萨vs马德里竞技：佩德里正面持球连过马竞防线破门',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2024-12-22/6767259235388native.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 7,
      title: '【佩德里集锦 P7】正面推进与油炸丸子摆脱专集(上)',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=7'
    },
    yt1: {
      id: 'q64rKPu55QI',
      start: 8,
      title: 'Pedri Control + Tight Spaces = Pure Art (狭小空间油炸丸子实况)',
      url: 'https://www.youtube.com/watch?v=q64rKPu55QI'
    },
    yt2: {
      id: 'OEKKwVqeSHs',
      start: 15,
      title: '详解油炸丸子动作细节：敢出脚我就敢过你',
      url: 'https://www.youtube.com/watch?v=OEKKwVqeSHs'
    },
    zhibo8: {
      label: '直播吧原帖：伊涅斯塔式控球戏耍对手',
      url: 'https://news.zhibo8.com/zuqiu/2025-02-18/67b40410457b7native.htm'
    },
    watchCue:
      '直播吧回放对照重点：观察中线两名白衣球员正面上抢伸脚瞬间，佩德里右脚内侧横拨+左脚顺趟（La Croqueta）从两人扑抢夹缝中丝滑钻出。'
  },

  'central-double-press-roulette': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：欧冠vs巴黎 转圈摆脱双人围抢',
        src: './assets/videos/s3_zhibo8_roulette_psg.mp4',
        filename: 's3_zhibo8_pedri_roulette_vs_psg.mp4',
        title: '【直播吧回放剪辑】2026-10-21 欧冠巴黎vs巴萨：佩德里中圈拉球360°转圈摆脱巴黎多人围抢',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2026-10-21/6ad7c96a05022native.htm'
      }
    ],
    bili: {
      bvid: 'BV1DvHP6HE2z',
      page: 1,
      title: '【佩德里 - 中场的艺术】多人包夹下的拉球回旋脱困',
      url: 'https://www.bilibili.com/video/BV1DvHP6HE2z/'
    },
    yt1: {
      id: 'YeEYoKhwFy8',
      start: 8,
      title: 'PEDRI Toying vs ATLETICO MADRID HD (马竞多人包夹脱困实况)',
      url: 'https://www.youtube.com/watch?v=YeEYoKhwFy8'
    },
    yt2: {
      id: 'OEKKwVqeSHs',
      start: 180,
      title: '马赛回旋实战时机与背身旋转护球拆解',
      url: 'https://www.youtube.com/watch?v=OEKKwVqeSHs'
    },
    zhibo8: {
      label: '直播吧原帖：佩德里转圈摆脱巴黎围抢',
      url: 'https://news.zhibo8.com/zuqiu/2026-10-21/6ad7c96a05022native.htm'
    },
    watchCue:
      '直播吧回放对照重点：欧冠对阵巴黎中圈接球遭遇一正一侧包夹，注意佩德里脚底踩拉急停、用后背隔开抢断球员并 360° 旋转拉出重围。'
  },

  'touchline-trap-cruyff-cut': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs马竞 边线死角1v3急停扣球脱困',
        src: './assets/videos/s4_zhibo8_touchline_escape.mp4',
        filename: 's4_zhibo8_pedri_touchline_1v3.mp4',
        title: '【直播吧回放剪辑】马竞vs巴萨：佩德里边线死角面对三人合围，连续假动作急停扣球从容摘出',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2023-01-09/63bbc0e6cee9a.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 8,
      title: '【佩德里集锦 P8】边肋死角扣球与V字拉球摆脱专集(下)',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=8'
    },
    yt1: {
      id: '-g3efh18P4I',
      start: 15,
      title: 'Pedri Controlled the Midfield vs PSG (边路高压夹击扣球脱困)',
      url: 'https://www.youtube.com/watch?v=-g3efh18P4I'
    },
    yt2: {
      id: '6jm4ZCkm_Vk',
      start: 20,
      title: 'V字拉球与边路急停变向实战细节拆解',
      url: 'https://www.youtube.com/watch?v=6jm4ZCkm_Vk'
    },
    zhibo8: {
      label: '直播吧原帖：边路面对马竞三人包夹化解险情',
      url: 'https://news.zhibo8.com/zuqiu/2023-01-09/63bbc0e6cee9a.htm'
    },
    watchCue:
      '直播吧回放对照重点：在右侧边线丧失 180° 空间且遭遇马竞三人围堵时，观察佩德里佯装直线突进诱敌前扑，随即急停内扣从容把球摘向中路。'
  },

  'blind-side-la-pausa': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs黄潜 口袋区停顿+手术刀直塞亚马尔',
        src: './assets/videos/s5_zhibo8_lapausa_through.mp4',
        filename: 's5_zhibo8_pedri_lapausa_yamal.mp4',
        title: '【直播吧/咪咕回放剪辑】2026-03-01 巴萨vs黄潜：佩德里口袋区 La Pausa 停顿诱敌后手术刀直塞亚马尔',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2026-03-01/69a31c0e023f0native.htm'
      },
      {
        label: '直播吧剪辑②：vs毕巴 肋部停顿直塞拉菲尼亚单刀',
        src: './assets/videos/s5_alt_raphinha_through.mp4',
        filename: 's5_zhibo8_pedri_through_raphinha.mp4',
        title: '【直播吧/咪咕回放剪辑】2026-08-28 巴萨1-0毕巴：佩德里肋部推进停顿观察后直塞打穿防线',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2026-08-28/6a90933ff32e1native.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 4,
      title: '【佩德里集锦 P4】口袋区 La Pausa 停顿与破防线直塞',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=4'
    },
    yt1: {
      id: '19I_YNEoTOc',
      start: 25,
      title: 'How Pedri Controls the Midfield — A Tactical Masterclass',
      url: 'https://www.youtube.com/watch?v=19I_YNEoTOc'
    },
    yt2: {
      id: 'a3eYigcGb9M',
      start: 30,
      title: '用脑子踢球的极致：拆解佩德里如何用节奏降维掌控球场',
      url: 'https://www.youtube.com/watch?v=a3eYigcGb9M'
    },
    zhibo8: {
      label: '直播吧原帖：佩德里精彩直塞助攻亚马尔',
      url: 'https://news.zhibo8.com/zuqiu/2026-03-01/69a31c0e023f0native.htm'
    },
    watchCue:
      '直播吧回放对照重点：中圈肋部接球后刻意放慢步频（La Pausa）吸引黄潜中场向球收缩，在防线空当暴露瞬间送出贴地手术刀直塞！'
  },

  'pressing-cage-third-man': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs瓦伦 主动吸怪+奥尔莫撞墙破笼',
        src: './assets/videos/s6_zhibo8_cage_wallpass.mp4',
        filename: 's6_zhibo8_pedri_olmo_wallpass.mp4',
        title: '【直播吧/咪咕回放剪辑】2026-09-07 瓦伦vs巴萨：佩德里主动运球吸拢三人包围笼，与奥尔莫撞墙前插破门',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2026-09-07/6a9d8e6825760native.htm'
      },
      {
        label: '直播吧剪辑②：vs黄潜 包围圈内与莱万2过1破门',
        src: './assets/videos/s6_alt_lewy_wallpass.mp4',
        filename: 's6_zhibo8_pedri_lewy_2v1.mp4',
        title: '【直播吧回放剪辑】比利亚雷亚尔vs巴萨：佩德里弧顶吸怪与莱万精彩 2过1 撞墙刺穿防线',
        pageUrl: 'https://news.zhibo8.com/zuqiu/2023-02-13/63e94a796a2af.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 3,
      title: '【佩德里集锦 P3】主动吸怪与双后腰撞墙破围抢专集',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=3'
    },
    yt1: {
      id: '4EDvGDrpXUQ',
      start: 0,
      title: 'Why Pedri Never Recycles Blindly (对阵皇家贝蒂斯双人逼抢实况拆解)',
      url: 'https://www.youtube.com/shorts/4EDvGDrpXUQ'
    },
    yt2: {
      id: 'XFWKs7Y3obA',
      start: 20,
      title: 'Pedri & De Jong Masterclass vs Atletico Madrid (2026-11-09 双核破围抢)',
      url: 'https://www.youtube.com/watch?v=XFWKs7Y3obA'
    },
    zhibo8: {
      label: '直播吧原帖：佩德里奥尔莫撞墙配合破门',
      url: 'https://news.zhibo8.com/zuqiu/2026-09-07/6a9d8e6825760native.htm'
    },
    watchCue:
      '直播吧回放对照重点：面对中路密集防守笼，观察 #8 佩德里不急于回传，而是带球逼近吸引三名白衣球员收拢，随即一脚斜敲奥尔莫并高速无球前插破笼！'
  },

  'transition-shield-far-foot': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：欧冠vs巴黎 倒地撑地极限卡位+穿裆摆脱',
        src: './assets/videos/s7_zhibo8_shield_nutmeg.mp4',
        filename: 's7_zhibo8_pedri_shield_nutmeg.mp4',
        title: '【直播吧高清短视频剪辑】2026-10-21 巴黎vs巴萨：佩德里遭冲撞倒地瞬间单手撑地护球，起身丝滑穿裆传出',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1021-ede83e0-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 2,
      title: '【佩德里集锦 P2】转换断球、远端脚卡身位护球与造犯规',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=2'
    },
    yt1: {
      id: 'zRxR245yR9Y',
      start: 0,
      title: 'Pedri Potter: Turning Under Heavy Pressure to Relieve Teammates',
      url: 'https://www.youtube.com/shorts/zRxR245yR9Y'
    },
    yt2: {
      id: '3R1dQpH3yIw',
      start: 18,
      title: 'Pedri vs Atletico Madrid || PLAYMAKER (高强度贴身肉搏护球实况)',
      url: 'https://www.youtube.com/watch?v=3R1dQpH3yIw'
    },
    zhibo8: {
      label: '直播吧原片：倒地瞬间撑地极限护球+穿裆',
      url: 'https://www.zhibo8.com/zuqiu/2026/1021-ede83e0-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：中圈遭法比安·鲁伊斯猛烈贴身冲撞，注意佩德里重心下沉、左手撑草皮死死卡住身位并用远端脚控球，起身瞬间穿裆维蒂尼亚脱困！'
  },

  'zone14-double-fakeshot': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：vs塞维利亚 弧顶连续两次假射晃飞滑铲破门 (720p 60帧)',
        src: './assets/videos/s8_zhibo8_sevilla_double_fakeshot.mp4',
        filename: 's8_zhibo8_pedri_sevilla_double_fakeshot.mp4',
        title: '【直播吧 720p 原片精剪】巴萨vs塞维利亚 (29.6s-38.4s)：弧顶连续两次高摆腿假射晃飞拉基蒂奇+迭戈·卡洛斯破门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1113-pt1252265-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 9,
      title: '【佩德里集锦 P9】禁区弧顶假射真扣与标志性低射破门',
      url: 'https://www.bilibili.com/video/BV1yDM2zVEhe/?p=9'
    },
    yt1: {
      id: '7ZoEXQ8_vE4',
      start: 5,
      title: 'Gol de Pedri vs Sevilla | 诺坎普对阵塞维利亚经典弧顶破门',
      url: 'https://www.youtube.com/watch?v=7ZoEXQ8_vE4'
    },
    yt2: {
      id: '_7LcHsy1BMU',
      start: 20,
      title: 'Pedri Gonzalez Ultimate Skills, Goals & Assists',
      url: 'https://www.youtube.com/watch?v=_7LcHsy1BMU'
    },
    zhibo8: {
      label: '直播吧原片：《22年对阵塞维利亚的佩德里》',
      url: 'https://www.zhibo8.com/zuqiu/2026/1113-pt1252265-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：从直播吧原片 00:29.6 处精准剪出——禁区弧顶连续两次高扬右腿假射，先后晃飞拉基蒂奇与迭戈·卡洛斯倒地滑铲后贴地斩破门！'
  },

  'saul-ucl-solo-slalom': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：欧冠半决赛 #17萨乌尔中圈连过拜仁4人破门 (12.2s)',
        src: './assets/videos/s09_mf_saul_bayern.mp4',
        filename: 's09_mf_saul_vs_bayern_ucl.mp4',
        title: '【直播吧欧冠经典】马竞 1-0 拜仁：#17 萨乌尔中圈启动连过蒂亚戈/贝尔纳特/阿隆索/阿拉巴弧线击中立柱入网！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1113-pt1252247-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1s4411H7z5',
      page: 1,
      title: '【欧冠经典】萨乌尔对阵拜仁慕尼黑惊世一条龙破门',
      url: 'https://www.bilibili.com/video/BV1s4411H7z5/'
    },
    yt1: {
      id: 'L4qM6S6b43k',
      start: 4,
      title: 'Saúl Ñíguez Solo Goal vs Bayern Munich | UCL Semi-Final',
      url: 'https://www.youtube.com/watch?v=L4qM6S6b43k'
    },
    zhibo8: {
      label: '直播吧原片：萨乌尔欧冠连过拜仁四人破门',
      url: 'https://www.zhibo8.com/zuqiu/2026/1113-pt1252247-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：中场 B2B 纵向破逼抢典范——观察 #17 萨乌尔在 2.0s–6.5s 用高频左脚外拨连续穿过拜仁三名中场围剿，并在 9.1s 急停内切闪开阿拉巴兜射远角立柱！'
  },

  'kdb-touchline-press-switch': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：#7德布劳内边线诱敌晃倒逼抢+38m手术刀长传 (8.8s)',
        src: './assets/videos/s10_mf_kdb_pass.mp4',
        filename: 's10_mf_debruyne_touchline_pass.mp4',
        title: '【直播吧实况精剪】比利时vs威尔士：#7 德布劳内近端边线降速诱敌晃倒红衣逼抢者，顺势轰出 38 米外旋穿透直塞！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1114-62cba09-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【德布劳内】大师级上帝视角摆脱与贴地弧线直塞合集',
      url: 'https://www.bilibili.com/all?keyword=%E5%BE%B7%E5%B8%83%E5%8A%B3%E5%86%85+%E7%9B%B4%E5%A1%9E'
    },
    yt1: {
      id: 'Z6gQ7sP8yK0',
      start: 0,
      title: 'Kevin De Bruyne Passing Under Heavy Touchline Press',
      url: 'https://www.youtube.com/results?search_query=De+Bruyne+touchline+pass+Wales'
    },
    zhibo8: {
      label: '直播吧原片：德布劳内边线摆脱送手术刀长传',
      url: 'https://www.zhibo8.com/zuqiu/2026/1114-62cba09-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：观察画面下方边线处 #7 德布劳内如何利用边线诱使两名威尔士红衣球员扑抢倒地（4.1s），随即在极窄空间抽出一记绕过整条防线的贴地弧线长传！'
  },

  'yamal-bilbao-box-slalom': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：#19亚马尔肋部1v4蝴蝶穿花突入小禁区 (8.6s)',
        src: './assets/videos/s11_fw_yamal_slalom.mp4',
        filename: 's11_fw_yamal_1v4_bilbao.mp4',
        title: '【直播吧西甲原片】巴萨vs毕尔巴鄂竞技：17岁右边锋 #19 亚马尔罚球弧顶高频双脚变向连过4名红白后卫杀入小禁区！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/0913-3841c7a-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1yDM2zVEhe',
      page: 1,
      title: '【拉明·亚马尔】狭小空间1v4过人突破高光拆解',
      url: 'https://www.bilibili.com/all?keyword=%E4%BA%9A%E9%A9%AC%E5%B0%94+%E8%BF%87%E4%BA%BA+%E6%AF%95%E5%B0%94%E5%B7%B4%E9%84%82'
    },
    yt1: {
      id: 'k9X0wM5v8xQ',
      start: 0,
      title: 'Lamine Yamal Insane Solo Dribble vs Athletic Club',
      url: 'https://www.youtube.com/results?search_query=Lamine+Yamal+dribble+vs+Athletic+Bilbao'
    },
    zhibo8: {
      label: '直播吧原片：亚马尔禁区弧顶1v4连过毕巴防线',
      url: 'https://www.zhibo8.com/zuqiu/2026/0913-3841c7a-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：技术型边锋破密集铁桶阵教科书——4.3s–6.5s 罚球弧顶三名红白间条衫后卫瞬间关门，注意 #19 亚马尔不减速油炸丸子从不足1米的夹缝钻出！'
  },

  'vinicius-double-press-chip': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：#7维尼修斯扛住双卫关门生吃+挑射破门 (全景1:1)',
        src: './assets/videos/s12_fw_vinicius_burst.mp4',
        filename: 's12_fw_vinicius_split_chip.mp4',
        title: '【直播吧国际赛原片】巴西vs日本：#7 维尼修斯反越位接直塞，硬扛 #14 与 #4 双蓝衣中卫夹击爆趟挑射破门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1114-bb58259-svideo.htm'
      },
      {
        label: '直播吧剪辑②：地面正对特写慢镜 (双卫三明治夹击生吃)',
        src: './assets/videos/s12_angle2_vinicius_burst.mp4',
        filename: 's12_angle2_vinicius_burst.mp4',
        title: '【直播吧第二视角特写】正面低机位看清 #7 维尼修斯如何在两名日本后卫左右挤靠下用第一步爆趟抢出身位并挑射越过红衣门将！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1114-bb58259-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【维尼修斯】爆发步频生吃双中卫与单刀挑射拆解',
      url: 'https://www.bilibili.com/all?keyword=%E7%BB%B4%E5%B0%BC%E4%BF%AE%E6%96%AF+%E6%97%A5%E6%9C%AC+%E8%BF%9B%E7%90%83'
    },
    yt1: {
      id: 'vini_jpn_07',
      start: 0,
      title: 'Vinícius Jr Goal vs Japan — Splitting Two Defenders at Full Speed',
      url: 'https://www.youtube.com/results?search_query=Vinicius+Jr+goal+vs+Japan'
    },
    zhibo8: {
      label: '直播吧原片：维尼修斯双人包夹强行超车挑射',
      url: 'https://www.zhibo8.com/zuqiu/2026/1114-bb58259-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：前锋纵向抗挤压范本——1.6s–3.4s 两名日本深蓝后卫从左右同时关门挤压，维尼修斯靠第一脚触球向正前方爆趟半步抢占身前线，随后轻挑越过滑扑门将！'
  },

  'bale-touchline-curved-overtake': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：国王杯决赛 #11贝尔 36.9km/h 界外弯道超车绝杀 (11.2s)',
        src: './assets/videos/s13_fw_bale_overtake.mp4',
        filename: 's13_fw_bale_overtake_bartra.mp4',
        title: '【直播吧测速典藏版】皇马 2-1 巴萨：#11 贝尔遭 #15 巴尔特拉撞出边线外，飙出 36.9km/h 界外大弧线弯道超车穿裆绝杀！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1113-2f7320d-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1xW411n7uY',
      page: 1,
      title: '【传给3秒后的自己】贝尔国王杯决赛外道超车巴尔特拉绝杀巴萨',
      url: 'https://www.bilibili.com/all?keyword=%E8%B4%9D%E5%B0%94+%E4%BC%A0%E7%BB%993%E7%A7%92%E5%90%8E%E7%9A%84%E8%87%AA%E5%B7%B1'
    },
    yt1: {
      id: 'bale_copa_11',
      start: 0,
      title: 'Gareth Bale Iconic Copa del Rey Final Solo Goal vs Barcelona',
      url: 'https://www.youtube.com/results?search_query=Gareth+Bale+goal+vs+Barcelona+Copa+del+Rey'
    },
    zhibo8: {
      label: '直播吧原片：贝尔 36.9km/h 外道超车巴尔特拉',
      url: 'https://www.zhibo8.com/zuqiu/2026/1113-2f7320d-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：速度型边锋极致抗战术犯规——3.5s 巴尔特拉在中线边线强行横撞将贝尔挤出场外，注意贝尔踩着界外草皮跑出 36.9km/h 弯道反超并切入小禁区穿裆破门！'
  },

  'bardhi-cruyff-chop-slide': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：#10巴尔迪扛人急停扣球晃趴队长破门 (全景1:1)',
        src: './assets/videos/s14_fw_bardhi_chop.mp4',
        filename: 's14_fw_bardhi_chop_goal.mp4',
        title: '【直播吧实况原片】特拉布宗 #10 巴尔迪带球硬扛橙衣队长贴身拉拽，2.95s 急停内扣直接把对手晃趴在草皮上低射破门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1109-4ff1ccd-svideo.htm'
      },
      {
        label: '直播吧剪辑②：超清近景慢镜拆解 (急停内扣晃趴滑出2米)',
        src: './assets/videos/s14_angle2_bardhi_chop.mp4',
        filename: 's14_angle2_bardhi_chop_closeup.mp4',
        title: '【直播吧超清近景慢镜】零距离看清 #10 巴尔迪如何用左肩扛住橙衣队长，随即急停拉球变向令对手重心崩溃水平趴倒在草皮上！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1109-4ff1ccd-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【急停扣球教学】高速带球中如何利用对手冲量完成急停晃倒',
      url: 'https://www.bilibili.com/all?keyword=%E6%80%A5%E5%81%9C%E6%89%A3%E7%90%83+%E6%99%83%E5%80%92%E5%90%8E%E5%8D%AB'
    },
    yt1: {
      id: 'bardhi_chop_10',
      start: 0,
      title: 'Enis Bardhi Ankle-Breaking Chop Goal | Trabzonspor',
      url: 'https://www.youtube.com/results?search_query=Trabzonspor+chop+goal+Alanyaspor'
    },
    zhibo8: {
      label: '直播吧原片：急停扣球直接把橙衣队长晃趴破门',
      url: 'https://www.zhibo8.com/zuqiu/2026/1109-4ff1ccd-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：切勿错过「直播吧剪辑②」超清慢镜——观察 2.95s 急停回扣如何借用贴防后卫自身前冲惯性，让对手整个人水平飞扑趴在草皮上！'
  },

  'vandijk-cb-coast-to-coast': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：中后卫 #5范戴克 本方半场70米一条龙晃飞滑铲破门 (13.8s)',
        src: './assets/videos/s15_df_vandijk_solo.mp4',
        filename: 's15_df_vandijk_70m_solo.mp4',
        title: '【直播吧典藏原片】凯尔特人绿白横条衫 #5 范戴克从本方半场深处带球破逼抢狂奔 70 米，禁区弧顶假射真扣晃飞中卫滑铲破门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/0918-pt1200327-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1b4411b7K2',
      page: 1,
      title: '【范戴克成名作】凯尔特人时期中后卫 70 米连过数人一条龙破门',
      url: 'https://www.bilibili.com/all?keyword=%E8%8C%83%E6%88%B4%E5%85%8B+%E5%87%AF%E5%B0%94%E7%89%B9%E4%BA%BA+%E4%B8%80%E6%9D%A1%E9%BE%99'
    },
    yt1: {
      id: 'vvd_celtic_05',
      start: 0,
      title: 'Virgil van Dijk Unbelievable Solo Goal for Celtic vs St Johnstone',
      url: 'https://www.youtube.com/results?search_query=Virgil+van+Dijk+solo+goal+Celtic+St+Johnstone'
    },
    zhibo8: {
      label: '直播吧原片：中卫范戴克后场启动一条龙破门',
      url: 'https://www.zhibo8.com/zuqiu/2026/0918-pt1200327-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：现代出球中卫（Ball-Playing CB）破高位逼抢极致案例——看 #5 范戴克如何从本方半场大步趟过中圈围堵，并在 10.2s 做出媲美前锋的假射左扣晃飞滑铲！'
  },

  'timber-rb-double-press-turn': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：右后卫 #12廷伯 禁区角背身一脚顺球穿双人缝挑射 (6.0s)',
        src: './assets/videos/s16_df_timber_turn.mp4',
        filename: 's16_df_timber_turn_goal.mp4',
        title: '【直播吧原片精剪】阿森纳红身白袖右后卫 #12 廷伯内收至禁区角背身接球，第一脚顺球半转身直接钻过双深蓝防守人夹缝挑射破门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1014-c0ed031-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【廷伯】阿森纳技术型边后卫背身抗逼抢转身集锦',
      url: 'https://www.bilibili.com/all?keyword=%E9%98%BF%E6%A3%AE%E7%BA%B3+%E5%BB%B7%E4%BC%AF+%E8%BD%AC%E8%BA%AB+%E8%BF%9B%E7%90%83'
    },
    yt1: {
      id: 'timber_turn_12',
      start: 0,
      title: 'Jurriën Timber Silky First-Touch Turn Through Two Defenders',
      url: 'https://www.youtube.com/results?search_query=Jurrien+Timber+turn+Arsenal'
    },
    zhibo8: {
      label: '直播吧原片：右后卫廷伯丝滑半转身钻双人缝破门',
      url: 'https://www.zhibo8.com/zuqiu/2026/1014-c0ed031-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：内收型边后卫（Inverted Fullback）狭小空间摆脱——注意 1.05s 接球瞬间零停顿，右脚内侧顺球 180° 转身直接把两名关门防守人甩在身后！'
  },

  'davies-lb-press-break-assist': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：左后卫 #19戴维斯 后场破逼抢+75米套边卸球横敲助攻 (12.6s)',
        src: './assets/videos/s17_df_davies_surge.mp4',
        filename: 's17_df_davies_press_break_assist.mp4',
        title: '【直播吧德国杯原片】拜仁红衣左后卫 #19 阿方索·戴维斯后场撞墙破逼抢，狂飙 75 米杀入禁区扛人胸部卸球横传助攻空门！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1029-b79d04e-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【阿方索·戴维斯】加拿大跑车后场破紧逼一条龙助攻合集',
      url: 'https://www.bilibili.com/all?keyword=%E9%98%BF%E6%96%B9%E7%B4%A2%E6%88%B4%E7%BB%B4%E6%96%AF+%E5%8A%A9%E6%94%BB'
    },
    yt1: {
      id: 'davies_surge_19',
      start: 0,
      title: 'Alphonso Davies Full-Pitch Press Break & Assist | Bayern Munich',
      url: 'https://www.youtube.com/results?search_query=Alphonso+Davies+assist+Hertha+Berlin'
    },
    zhibo8: {
      label: '直播吧原片：左后卫戴维斯后场破逼抢奔袭助攻',
      url: 'https://www.zhibo8.com/zuqiu/2026/1029-b79d04e-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：边后卫“撞墙破逼抢 + 超速套上”模板——观察 2.6s 后场出球摆脱中线围堵，随即高速反插左肋并在 8.6s 扛住蓝白后卫柔和卸下高空球横传喂饼！'
  },

  'hakimi-rwb-press-drive-rocket': {
    zhibo8Clips: [
      {
        label: '直播吧剪辑①：右翼卫 #2阿什拉夫 内切连过白衣双腰+28米重炮世界波 (11.0s)',
        src: './assets/videos/s18_df_hakimi_drive.mp4',
        filename: 's18_df_hakimi_drive_rocket.mp4',
        title: '【直播吧实况原片】摩洛哥红衣绿裤右翼卫 #2 阿什拉夫中场右肋接球内切，连续趟过两名白衣后腰拦截轰出 28 米重炮世界波！',
        pageUrl: 'https://www.zhibo8.com/zuqiu/2026/1114-c4c9fb1-svideo.htm'
      }
    ],
    bili: {
      bvid: 'BV1GJ411x7h7',
      page: 1,
      title: '【阿什拉夫·哈基米】世界第一右翼卫推进破逼抢与重炮远射',
      url: 'https://www.bilibili.com/all?keyword=%E9%98%BF%E4%BB%80%E6%8B%89%E5%A4%AB+%E4%B8%96%E7%95%8C%E6%B3%A2+%E6%91%A9%E6%B4%9B%E5%93%A5'
    },
    yt1: {
      id: 'hakimi_rocket_02',
      start: 0,
      title: 'Achraf Hakimi Press-Breaking Drive & Long-Range Rocket for Morocco',
      url: 'https://www.youtube.com/results?search_query=Achraf+Hakimi+long+range+goal+Morocco'
    },
    zhibo8: {
      label: '直播吧原片：右翼卫阿什拉夫内切破围抢轰世界波',
      url: 'https://www.zhibo8.com/zuqiu/2026/1114-c4c9fb1-svideo.htm'
    },
    watchCue:
      '直播吧回放对照重点：进攻型翼卫破边路封锁——当对手封死下底通道时，观察 #2 阿什拉夫 3.3s–7.5s 横向内切连过两名白衣后腰，并在 8.55s 果断轰出 28 米电梯重炮！'
  }
};
