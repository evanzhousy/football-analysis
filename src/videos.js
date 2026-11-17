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
  }
};
