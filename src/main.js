const BABYLON = window.BABYLON;
import { createBabylonPitchEnvironment, createBabylonMatchBall } from './babylonPitch.js';
import {
  preloadBabylonAthleteRig,
  attachBabylonAthleteRig,
  createBabylonPlayer,
  updateBabylonPlayerPose,
  createBabylonTrajectoryRibbon,
  isHeroRole
} from './babylonPlayer.js';
import { resolveKitPreset } from './babylonKit.js';
import { MOCAP_CATALOG, getMocapMeta, getMocapDuration } from './mixamoSoccerLibrary.js';
import { SCENARIOS, evaluateScenarioAtTime } from './scenarios.js';
import { SCENARIO_VIDEOS, MASTER_ZHIBO8_REEL } from './videos.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const container = document.getElementById('three-canvas-container');
const viewportStageEl = document.getElementById('viewport-stage');

// 1. Initialize Babylon.js 7.54 WebGL2 Engine, Right-Handed glTF Scene & Cameras
const canvas = document.createElement('canvas');
canvas.id = 'babylon-canvas';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.display = 'block';
canvas.style.outline = 'none';
canvas.style.touchAction = 'none';
container.innerHTML = '';
container.appendChild(canvas);

const engine = new BABYLON.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  powerPreference: 'high-performance'
});
engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 2));

const scene = new BABYLON.Scene(engine);
scene.useRightHandedSystem = true;
scene.setRenderingAutoClearDepthStencil(1, false, false, false);
scene.setRenderingAutoClearDepthStencil(2, true, true, false);

const mainCamera = new BABYLON.UniversalCamera(
  'TacticalBroadcastCamera',
  new BABYLON.Vector3(20, 9.5, 8),
  scene
);
mainCamera.minZ = 0.08;
mainCamera.maxZ = 240;
mainCamera.fov = (35 * Math.PI) / 180;

const freeCamera = new BABYLON.ArcRotateCamera(
  'FreeOrbitCamera',
  0.4,
  1.15,
  14.0,
  new BABYLON.Vector3(0, 0.9, 0),
  scene
);
freeCamera.minZ = 0.08;
freeCamera.maxZ = 240;
freeCamera.fov = (35 * Math.PI) / 180;
freeCamera.lowerRadiusLimit = 0.75;
freeCamera.upperRadiusLimit = 72;
freeCamera.upperBetaLimit = Math.PI * 0.495;
freeCamera.wheelPrecision = 35;
freeCamera.panningSensibility = 450;

scene.activeCamera = mainCamera;

const currentCamTarget = new BABYLON.Vector3(0, 0.9, 0);
const desiredCamPos = new BABYLON.Vector3(20, 9.5, 8);
const desiredCamTarget = new BABYLON.Vector3(0, 0.9, 0);

canvas.addEventListener('pointerdown', () => {
  if (cameraMode !== 'free') {
    setCameraMode('free', false);
  }
});

const resizeObserver = new ResizeObserver(() => {
  if (container.clientWidth > 0 && container.clientHeight > 0) {
    engine.resize();
  }
});
resizeObserver.observe(container);

// 2. Build Stadium Pitch, Floodlights, PCF Shadows & FIFA Size-5 Match Ball
const { shadowGen } = createBabylonPitchEnvironment(scene);
const matchBall = createBabylonMatchBall(scene, shadowGen);

const scenarioGroup = new BABYLON.TransformNode('ScenarioGroup', scene);
const mocapShowcaseGroup = new BABYLON.TransformNode('MocapShowcaseGroup', scene);
mocapShowcaseGroup.setEnabled(false);

let activeScenarioIndex = 0;
let activePositionFilter = 'ALL'; // 'ALL' | 'MF' | 'FW' | 'DF'
let activeActors = [];
let activeRibbons = [];
let snapCameraNextFrame = true;
let rigLoaded = false;

// Playback, Master Video Clock & Mixamo Soccer Pack Library State
let isPlaying = true;
let playbackSpeed = 0.5;
let currentSec = 0.0;
let cameraMode = 'broadcast';
let splitLayout = true;
let activeVideoSource = 'zhibo8';
let activeSubClipIndex = 0;
let syncVideoTo3D = true;
let activeMocapMode = 'tactical'; // 'tactical' | 'lib:<clipId>'
let showcasePedriActor = null;

const overlaysConfig = {
  showSkeleton: false,
  showScan: true,
  showCoverShadow: true,
  showTrajectories: true,
  showLabels: true,
  cameraMode: 'broadcast'
};

// UI References
const scenarioListEl = document.getElementById('scenario-list');
const scenarioCountBadgeEl = document.getElementById('scenario-count-badge');
const brandJerseyCrestEl = document.getElementById('brand-jersey-crest');
const legendHeroLabelEl = document.getElementById('legend-hero-label');
const phaseBadgeEl = document.getElementById('live-phase-badge');
const matchSourceEl = document.getElementById('live-match-source');
const phaseDescEl = document.getElementById('live-phase-desc');
const hudMocapBadgeEl = document.getElementById('hud-mocap-badge');
const phaseButtonsContainer = document.getElementById('phase-pills-row');
const playBtnEl = document.getElementById('btn-play-toggle');
const btnStepPrevEl = document.getElementById('btn-step-prev');
const btnStepNextEl = document.getElementById('btn-step-next');
const sliderEl = document.getElementById('timeline-slider');
const timeReadoutEl = document.getElementById('time-readout');

const mocapModeSelectEl = document.getElementById('mocap-mode-select');
const btnXrayTopEl = document.getElementById('btn-xray-top');
const btnToggleSkeletonEl = document.getElementById('toggle-skeleton');

// Real Video Deck References
const btnLayoutSplit = document.getElementById('btn-layout-split');
const zhibo8ClipEl = document.getElementById('zhibo8-clip-el');
const zhibo8SubclipsBarEl = document.getElementById('zhibo8-subclips-bar');
const zhibo8SubclipsBtnsEl = document.getElementById('zhibo8-subclips-btns');
const chkSyncVideoEl = document.getElementById('chk-sync-video');
const downloadZhibo8Mp4El = document.getElementById('download-zhibo8-mp4');
const videoIframeEl = document.getElementById('real-video-iframe');
const localVideoBoxEl = document.getElementById('local-video-box');
const localVideoEl = document.getElementById('local-video-el');
const localVideoPromptEl = document.getElementById('local-video-prompt');
const localVideoInputEl = document.getElementById('local-video-input');
const videoNowTitleEl = document.getElementById('video-now-title');
const videoWatchCueEl = document.getElementById('video-watch-cue');
const extLinkZhibo8 = document.getElementById('ext-link-zhibo8');
const extLinkBili = document.getElementById('ext-link-bili');
const extLinkYt = document.getElementById('ext-link-yt');

// Inspector & Rig Telemetry References
const inspEyebrowEl = document.getElementById('insp-eyebrow');
const inspTitleEl = document.getElementById('insp-title');
const inspMoveEl = document.getElementById('insp-move');
const inspPressureEl = document.getElementById('insp-pressure');
const metricTouchesEl = document.getElementById('metric-touches');
const metricFeintEl = document.getElementById('metric-feint');
const metricScansEl = document.getElementById('metric-scans');
const metricWindowEl = document.getElementById('metric-window');
const keypointsListEl = document.getElementById('insp-keypoints');

const rigBoneCountEl = document.getElementById('rig-bone-count');
const rigActiveClipEl = document.getElementById('rig-active-clip');
const rigActiveFootEl = document.getElementById('rig-active-foot');
const rigJointAnglesEl = document.getElementById('rig-joint-angles');

const barPressIntensity = document.getElementById('bar-press-intensity');
const valPressIntensity = document.getElementById('val-press-intensity');
const barDeception = document.getElementById('bar-deception');
const valDeception = document.getElementById('val-deception');
const barSeparation = document.getElementById('bar-separation');
const valSeparation = document.getElementById('val-separation');

// Populate 32-Clip Official Adobe Mixamo《Soccer Pack》Library into #mocap-mode-select
function buildMocapLibrarySelector() {
  mocapModeSelectEl.innerHTML = '';

  const optTactical = document.createElement('option');
  optTactical.value = 'tactical';
  optTactical.textContent = '⚽ 实战视频 1:1 帧同步模式 (18大中场/前锋/后卫切片)';
  mocapModeSelectEl.appendChild(optTactical);

  const byCat = new Map();
  for (const item of MOCAP_CATALOG) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category).push(item);
  }

  for (const [catName, list] of byCat.entries()) {
    const grp = document.createElement('optgroup');
    grp.label = `Mixamo《Soccer Pack》官方库 · ${catName} (${list.length}组)`;
    for (const item of list) {
      const opt = document.createElement('option');
      opt.value = `lib:${item.id}`;
      opt.textContent = `[${item.id}] ${item.label}`;
      grp.appendChild(opt);
    }
    mocapModeSelectEl.appendChild(grp);
  }
}
buildMocapLibrarySelector();

// Preload Intact Watertight 65-Bone Mixamo Athlete + All 32 Official《Soccer Pack》Animations
const rigReadyPromise = preloadBabylonAthleteRig(scene, (done, total, entry) => {
  if (hudMocapBadgeEl) {
    hudMocapBadgeEl.textContent = `Mixamo《Soccer Pack》加载中: ${done}/${total} (${entry.id})...`;
  }
}).then(() => {
  rigLoaded = true;
  activeActors.forEach((a) => attachBabylonAthleteRig(a.model));
  if (showcasePedriActor) {
    attachBabylonAthleteRig(showcasePedriActor);
  }
  if (activeMocapMode === 'tactical') {
    matchSourceEl.textContent = SCENARIOS[activeScenarioIndex].matchRef;
  }
});

// 3. Real Video Deck Controller (Master Clock Source when syncVideoTo3D === true)
function loadZhibo8ClipElement(srcUrl, titleText, dlFilename, pageUrl, initialTimeSec = 0) {
  zhibo8ClipEl.style.display = 'block';
  videoIframeEl.style.display = 'none';
  videoIframeEl.src = 'about:blank';
  localVideoBoxEl.style.display = 'none';

  const changedSrc = zhibo8ClipEl.getAttribute('data-cur-src') !== srcUrl;
  if (changedSrc) {
    zhibo8ClipEl.setAttribute('data-cur-src', srcUrl);
    zhibo8ClipEl.src = srcUrl;
    zhibo8ClipEl.load();
    zhibo8ClipEl.addEventListener(
      'loadedmetadata',
      () => {
        if (initialTimeSec > 0 && initialTimeSec < zhibo8ClipEl.duration) {
          zhibo8ClipEl.currentTime = initialTimeSec;
        }
        zhibo8ClipEl.playbackRate = syncVideoTo3D ? playbackSpeed : 1.0;
      },
      { once: true }
    );
  }

  zhibo8ClipEl.playbackRate = syncVideoTo3D ? playbackSpeed : 1.0;
  if (isPlaying) {
    zhibo8ClipEl.play().catch(() => {});
  } else if (syncVideoTo3D) {
    zhibo8ClipEl.pause();
  }

  videoNowTitleEl.textContent = titleText;
  downloadZhibo8Mp4El.href = srcUrl;
  downloadZhibo8Mp4El.setAttribute('download', dlFilename);
  downloadZhibo8Mp4El.style.display = 'inline-flex';
  if (pageUrl) {
    extLinkZhibo8.href = pageUrl;
  }
}

zhibo8ClipEl.addEventListener('seeked', () => {
  if (!syncVideoTo3D || activeMocapMode !== 'tactical') return;
  if (activeVideoSource === 'zhibo8') {
    const sc = SCENARIOS[activeScenarioIndex];
    if (activeSubClipIndex === 0) {
      currentSec = clamp(zhibo8ClipEl.currentTime, 0, sc.durationSec);
    } else if (zhibo8ClipEl.duration > 0.1) {
      currentSec = (zhibo8ClipEl.currentTime / zhibo8ClipEl.duration) * sc.durationSec;
    }
  } else if (activeVideoSource === 'reel') {
    syncScenarioFromMasterReelTime(zhibo8ClipEl.currentTime);
  }
});

function syncScenarioFromMasterReelTime(reelTime) {
  const segs = MASTER_ZHIBO8_REEL.segments || [];
  for (const seg of segs) {
    if (reelTime >= seg.start && reelTime < seg.end) {
      if (activeScenarioIndex !== seg.scenarioIndex) {
        loadScenario(seg.scenarioIndex, { preserveReelPlayback: true });
      }
      currentSec = clamp(reelTime - seg.start, 0, SCENARIOS[seg.scenarioIndex].durationSec);
      return;
    }
  }
}

function updateRealVideoDeck() {
  const sc = SCENARIOS[activeScenarioIndex];
  const v = SCENARIO_VIDEOS[sc.id];
  if (!v) return;

  videoWatchCueEl.textContent = v.watchCue;
  extLinkZhibo8.textContent = `${v.zhibo8.label} ↗`;
  extLinkZhibo8.href = v.zhibo8.url;
  extLinkBili.href = v.bili.url;
  extLinkYt.href = v.yt1.url;

  const clips = v.zhibo8Clips || [];
  if (activeSubClipIndex >= clips.length) {
    activeSubClipIndex = 0;
  }

  if (activeVideoSource === 'zhibo8') {
    zhibo8SubclipsBarEl.style.display = 'flex';
    zhibo8SubclipsBtnsEl.innerHTML = '';
    clips.forEach((clip, cIdx) => {
      const cBtn = document.createElement('button');
      cBtn.type = 'button';
      cBtn.className = `subclip-btn${cIdx === activeSubClipIndex ? ' active' : ''}`;
      cBtn.textContent = clip.label;
      cBtn.addEventListener('click', () => {
        activeSubClipIndex = cIdx;
        currentSec = 0;
        updateRealVideoDeck();
      });
      zhibo8SubclipsBtnsEl.appendChild(cBtn);
    });

    const curClip = clips[activeSubClipIndex];
    if (curClip) {
      loadZhibo8ClipElement(curClip.src, curClip.title, curClip.filename, curClip.pageUrl, 0);
    }
    return;
  }

  if (activeVideoSource === 'reel') {
    zhibo8SubclipsBarEl.style.display = 'flex';
    zhibo8SubclipsBtnsEl.innerHTML =
      '<span style="font-size:11px;color:var(--accent-gold);font-weight:600;">55.5s 总集锦连播中 · Babylon.js 3D 场景随视频自动切换 01→08</span>';
    const seg = (MASTER_ZHIBO8_REEL.segments || []).find((s) => s.scenarioIndex === activeScenarioIndex);
    loadZhibo8ClipElement(
      MASTER_ZHIBO8_REEL.src,
      MASTER_ZHIBO8_REEL.title,
      MASTER_ZHIBO8_REEL.filename,
      MASTER_ZHIBO8_REEL.sourceUrl,
      seg ? seg.start : 0
    );
    return;
  }

  zhibo8SubclipsBarEl.style.display = 'none';
  zhibo8ClipEl.pause();
  zhibo8ClipEl.style.display = 'none';
  downloadZhibo8Mp4El.style.display = 'none';

  if (activeVideoSource === 'local') {
    videoIframeEl.style.display = 'none';
    videoIframeEl.src = 'about:blank';
    localVideoBoxEl.style.display = 'flex';
    videoNowTitleEl.textContent = '本地实况视频 × Babylon.js 65骨标准球员同步慢放对比';
    localVideoEl.playbackRate = playbackSpeed;
  } else {
    localVideoBoxEl.style.display = 'none';
    videoIframeEl.style.display = 'block';

    if (activeVideoSource === 'bili') {
      const targetSrc = `https://player.bilibili.com/player.html?bvid=${v.bili.bvid}&page=${v.bili.page}&high_quality=1&danmaku=0&autoplay=0`;
      if (videoIframeEl.src !== targetSrc) {
        videoIframeEl.src = targetSrc;
      }
      videoNowTitleEl.textContent = v.bili.title;
    } else if (activeVideoSource === 'yt1') {
      const targetSrc = `https://www.youtube.com/embed/${v.yt1.id}?start=${v.yt1.start}&rel=0&modestbranding=1`;
      if (videoIframeEl.src !== targetSrc) {
        videoIframeEl.src = targetSrc;
      }
      videoNowTitleEl.textContent = v.yt1.title;
      extLinkYt.href = v.yt1.url;
    }
  }
}

chkSyncVideoEl.addEventListener('change', () => {
  syncVideoTo3D = chkSyncVideoEl.checked;
  if (activeVideoSource === 'zhibo8' || activeVideoSource === 'reel') {
    zhibo8ClipEl.playbackRate = syncVideoTo3D ? playbackSpeed : 1.0;
    if (syncVideoTo3D && !isPlaying) {
      zhibo8ClipEl.pause();
    } else if (isPlaying) {
      zhibo8ClipEl.play().catch(() => {});
    }
  }
});

document.querySelectorAll('.vsrc-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeVideoSource = btn.dataset.vsrc;
    document.querySelectorAll('.vsrc-btn').forEach((b) => b.classList.toggle('active', b === btn));
    if (activeVideoSource === 'reel' && activeScenarioIndex >= 8) {
      if (activePositionFilter !== 'ALL' && activePositionFilter !== 'MF') {
        setPositionFilter('ALL', false);
      }
      loadScenario(0, { preserveReelPlayback: true });
    }
    updateRealVideoDeck();
  });
});

localVideoInputEl.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const blobUrl = URL.createObjectURL(file);
  localVideoEl.src = blobUrl;
  localVideoEl.style.display = 'block';
  localVideoPromptEl.style.display = 'none';
  localVideoEl.playbackRate = playbackSpeed;
  if (isPlaying) {
    localVideoEl.play().catch(() => {});
  }
});

function applySplitLayout(nextSplit) {
  splitLayout = Boolean(nextSplit);
  btnLayoutSplit.classList.toggle('active', splitLayout);
  btnLayoutSplit.textContent = splitLayout ? '实况视频+3D同屏' : '开启实况视频同屏';
  viewportStageEl.classList.toggle('split-mode', splitLayout);
  viewportStageEl.classList.toggle('full3d-mode', !splitLayout);
  engine.resize();
}

btnLayoutSplit.addEventListener('click', () => {
  applySplitLayout(!splitLayout);
});

// 4. Switch Between 18-Scenario Video 1:1 Mode vs 32-Clip Mixamo《Soccer Pack》Showcase
function clearShowcaseObjects() {
  if (showcasePedriActor) {
    showcasePedriActor.dispose();
    showcasePedriActor = null;
  }
}

function setMocapMode(mode) {
  activeMocapMode = mode;
  mocapModeSelectEl.value = mode;
  currentSec = 0.0;
  snapCameraNextFrame = true;

  if (mode === 'tactical') {
    clearShowcaseObjects();
    mocapShowcaseGroup.setEnabled(false);
    scenarioGroup.setEnabled(true);
    loadScenario(activeScenarioIndex);
    return;
  }

  const clipId = mode.replace(/^lib:/, '');
  const meta = getMocapMeta(clipId);

  scenarioGroup.setEnabled(false);
  mocapShowcaseGroup.setEnabled(true);

  const curSc = SCENARIOS[activeScenarioIndex];
  const heroDef = curSc.actors.find((a) => isHeroRole(a.role)) || curSc.actors[0];
  clearShowcaseObjects();
  showcasePedriActor = createBabylonPlayer(
    scene,
    {
      ...heroDef,
      id: `${heroDef.id}_showcase`,
      role: 'hero'
    },
    shadowGen,
    mocapShowcaseGroup
  );

  matchSourceEl.textContent = `Adobe Mixamo《Soccer Pack》官方库 · ${meta.category} (${meta.file})`;
  inspEyebrowEl.textContent = `MIXAMO SOCCER PACK · ${meta.category}`;
  inspTitleEl.textContent = meta.label;
  inspMoveEl.textContent = `动作资产 ID: ${meta.id} · 当前检阅球星: ${curSc.starName}`;
  inspPressureEl.textContent = '提示：可切换「主角肩后 / 足踝特写 / 自由3D」或按 [X] 开启 65 骨骼透视检阅模型与动作细节';
}

mocapModeSelectEl.addEventListener('change', (e) => {
  setMocapMode(e.target.value);
});

// 5. Render Sidebar Scenario List & Position Filter Tabs (ALL / MF / FW / DF)
function buildScenarioSidebar() {
  scenarioListEl.innerHTML = '';
  let visibleCount = 0;

  SCENARIOS.forEach((sc, idx) => {
    const posGroup = sc.positionGroup || 'MF';
    if (activePositionFilter !== 'ALL' && posGroup !== activePositionFilter) {
      return;
    }
    visibleCount += 1;

    const posClass = posGroup === 'FW' ? 'pos-fw' : posGroup === 'DF' ? 'pos-df' : 'pos-mf';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `scenario-btn-${sc.index}`;
    btn.dataset.scenarioIdx = String(idx);
    btn.className = `scenario-item${idx === activeScenarioIndex ? ' active' : ''}`;
    btn.innerHTML = `
      <div class="scenario-item-top">
        <div class="scenario-top-left">
          <span class="scenario-index">#${sc.index}</span>
          <span class="pos-badge ${posClass}">${sc.positionLabel || posGroup}</span>
        </div>
        <span class="scenario-zone-tag">${sc.zoneTag}</span>
      </div>
      <div class="scenario-star-tag">${sc.starName || ''}</div>
      <div class="scenario-item-title">${sc.title}</div>
      <div class="scenario-item-move">${sc.moveName}</div>
    `;
    btn.addEventListener('click', () => {
      if (activeMocapMode !== 'tactical') {
        activeMocapMode = 'tactical';
        mocapModeSelectEl.value = 'tactical';
        clearShowcaseObjects();
        mocapShowcaseGroup.setEnabled(false);
        scenarioGroup.setEnabled(true);
      }
      if (activeVideoSource === 'reel') {
        const seg = (MASTER_ZHIBO8_REEL.segments || []).find((s) => s.scenarioIndex === idx);
        if (seg) {
          loadScenario(idx, { preserveReelPlayback: true });
          if (zhibo8ClipEl.readyState >= 1) {
            zhibo8ClipEl.currentTime = seg.start;
          }
          return;
        }
        // Scenarios 09-18 have individual Zhibo8 clips -> switch cleanly from Pedri 8-clip reel to 'zhibo8'
        activeVideoSource = 'zhibo8';
        document.querySelectorAll('.vsrc-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.vsrc === 'zhibo8');
        });
      }
      loadScenario(idx);
    });
    scenarioListEl.appendChild(btn);
  });

  if (scenarioCountBadgeEl) {
    scenarioCountBadgeEl.textContent =
      activePositionFilter === 'ALL'
        ? `${visibleCount} SCENARIOS`
        : `${visibleCount} ${activePositionFilter} SCENARIOS`;
  }
}

function setPositionFilter(pos, autoSelectFirst = true) {
  activePositionFilter = pos;
  document.querySelectorAll('.pos-tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.pos === pos);
  });
  buildScenarioSidebar();

  if (autoSelectFirst && pos !== 'ALL') {
    const curSc = SCENARIOS[activeScenarioIndex];
    if ((curSc.positionGroup || 'MF') !== pos) {
      const firstIdx = SCENARIOS.findIndex((s) => (s.positionGroup || 'MF') === pos);
      if (firstIdx >= 0) {
        if (activeVideoSource === 'reel' && firstIdx >= 8) {
          activeVideoSource = 'zhibo8';
          document.querySelectorAll('.vsrc-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.vsrc === 'zhibo8');
          });
        }
        loadScenario(firstIdx);
      }
    }
  }
}

document.querySelectorAll('.pos-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setPositionFilter(btn.dataset.pos, true);
  });
});

// 6. Load Selected Scenario into Babylon.js Scene + Sync Video Deck
function clearScenarioObjects() {
  for (const a of activeActors) {
    a.model.dispose();
  }
  activeActors = [];

  for (const r of activeRibbons) {
    if (r.material) r.material.dispose();
    r.dispose();
  }
  activeRibbons = [];
}

function updateHeroHeaderAndLegend(sc) {
  const heroDef = sc.actors.find((a) => isHeroRole(a.role)) || sc.actors[0];
  if (!heroDef) return;
  const preset = resolveKitPreset(heroDef.kit);

  if (brandJerseyCrestEl) {
    brandJerseyCrestEl.textContent = String(heroDef.number || '8');
    brandJerseyCrestEl.style.background = `linear-gradient(135deg, ${preset.primary} 0%, ${preset.primary} 48%, ${preset.secondary} 52%, ${preset.secondary} 100%)`;
    brandJerseyCrestEl.style.color = preset.numColor || '#facc15';
  }
  if (legendHeroLabelEl) {
    legendHeroLabelEl.textContent = `${sc.starName || heroDef.label} (${sc.positionLabel || '主角'} · 一体成型零破洞)`;
  }
}

function loadScenario(index, opts = {}) {
  activeScenarioIndex = index;
  if (!opts.preserveSubClip) {
    activeSubClipIndex = 0;
  }
  currentSec = 0.0;
  snapCameraNextFrame = true;
  const sc = SCENARIOS[index];

  document.querySelectorAll('.scenario-item').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.scenarioIdx) === index);
  });

  updateHeroHeaderAndLegend(sc);

  clearScenarioObjects();
  activeActors = sc.actors.map((actorDef) => {
    const model = createBabylonPlayer(scene, actorDef, shadowGen, scenarioGroup);
    return { def: actorDef, model };
  });

  const pedriTube = createBabylonTrajectoryRibbon(scene, sc.pedriRibbon, '#facc15', 0.052, 0.76, scenarioGroup);
  if (pedriTube) activeRibbons.push(pedriTube);

  const defOvershootTube = createBabylonTrajectoryRibbon(scene, sc.overshootRibbon, '#f87171', 0.044, 0.50, scenarioGroup);
  if (defOvershootTube) activeRibbons.push(defOvershootTube);

  inspEyebrowEl.textContent = `SCENARIO ${sc.index} · [${sc.positionLabel || sc.positionGroup}] · ${sc.zoneTag}`;
  inspTitleEl.textContent = sc.title;
  inspMoveEl.textContent = sc.moveName;
  inspPressureEl.textContent = `逼抢态势：${sc.pressureType}`;

  metricTouchesEl.textContent = sc.metrics.touches;
  metricFeintEl.textContent = sc.metrics.feintAngle;
  metricScansEl.textContent = sc.metrics.scans;
  metricWindowEl.textContent = sc.metrics.escapeWindow;

  keypointsListEl.innerHTML = sc.keypoints.map((kp) => `<li>${kp}</li>`).join('');
  matchSourceEl.textContent = sc.matchRef;

  phaseButtonsContainer.innerHTML = '';
  sc.phases.forEach((ph, pIdx) => {
    const pBtn = document.createElement('button');
    pBtn.type = 'button';
    pBtn.id = `btn-phase-${pIdx + 1}`;
    pBtn.className = 'phase-jump-btn';
    pBtn.textContent = ph.label;
    pBtn.addEventListener('click', () => {
      seekToSecond(ph.timeRange[0] + 0.05, true);
    });
    phaseButtonsContainer.appendChild(pBtn);
  });

  const [fx, fy, fz] = sc.defaultFocus;
  if (cameraMode === 'free') {
    freeCamera.setTarget(new BABYLON.Vector3(fx, fy + 0.85, fz));
    freeCamera.setPosition(new BABYLON.Vector3(fx + 14.5, 8.8, fz + 4.5));
  }

  if (!opts.preserveReelPlayback) {
    updateRealVideoDeck();
  }
}

// 7. Camera Mode Controller
function setCameraMode(mode, resetView = true) {
  cameraMode = mode;
  snapCameraNextFrame = true;
  document.querySelectorAll('.cam-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === mode);
  });

  if (mode === 'free') {
    if (resetView) {
      const [fx, fy, fz] =
        activeMocapMode === 'tactical' ? SCENARIOS[activeScenarioIndex].defaultFocus : [0, 0, 8.0];
      freeCamera.setTarget(new BABYLON.Vector3(fx, fy + 0.92, fz));
      freeCamera.setPosition(new BABYLON.Vector3(fx + 3.2, fy + 1.65, fz + 3.6));
    } else {
      freeCamera.setTarget(currentCamTarget.clone());
      freeCamera.setPosition(mainCamera.position.clone());
    }
    freeCamera.fov = mainCamera.fov;
    scene.activeCamera = freeCamera;
    freeCamera.attachControl(canvas, true);
  } else {
    freeCamera.detachControl();
    scene.activeCamera = mainCamera;
  }
}

document.querySelectorAll('.cam-btn').forEach((btn) => {
  btn.addEventListener('click', () => setCameraMode(btn.dataset.cam, true));
});

// 8. Bidirectional Master Clock Seeking & Frame-Stepping (±0.04s)
function getActiveDurationSec() {
  if (activeMocapMode !== 'tactical') {
    const clipId = activeMocapMode.replace(/^lib:/, '');
    return Math.max(0.2, getMocapDuration(clipId));
  }
  return SCENARIOS[activeScenarioIndex].durationSec;
}

function syncVideoPlayState() {
  if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel') && syncVideoTo3D && zhibo8ClipEl.src) {
    zhibo8ClipEl.playbackRate = playbackSpeed;
    if (isPlaying) {
      zhibo8ClipEl.play().catch(() => {});
    } else {
      zhibo8ClipEl.pause();
    }
  }
  if (activeVideoSource === 'local' && localVideoEl.src) {
    localVideoEl.playbackRate = playbackSpeed;
    if (isPlaying) {
      localVideoEl.play().catch(() => {});
    } else {
      localVideoEl.pause();
    }
  }
}

function updatePlayButtonLabel() {
  playBtnEl.textContent = isPlaying ? '暂停 ❚❚' : '播放 ▶';
}

function seekToSecond(targetSec, pausePlayback = true) {
  const dur = getActiveDurationSec();
  currentSec = ((targetSec % dur) + dur) % dur;

  if (pausePlayback) {
    isPlaying = false;
    syncVideoPlayState();
    updatePlayButtonLabel();
  }

  if (activeMocapMode === 'tactical' && syncVideoTo3D) {
    if (activeVideoSource === 'zhibo8' && zhibo8ClipEl.readyState >= 1) {
      if (activeSubClipIndex === 0) {
        zhibo8ClipEl.currentTime = clamp(currentSec, 0, Math.max(0, zhibo8ClipEl.duration - 0.01));
      } else if (zhibo8ClipEl.duration > 0.1) {
        zhibo8ClipEl.currentTime = (currentSec / dur) * zhibo8ClipEl.duration;
      }
    } else if (activeVideoSource === 'reel' && zhibo8ClipEl.readyState >= 1) {
      const seg = (MASTER_ZHIBO8_REEL.segments || []).find((s) => s.scenarioIndex === activeScenarioIndex);
      if (seg) {
        zhibo8ClipEl.currentTime = seg.start + currentSec;
      }
    } else if (activeVideoSource === 'local' && localVideoEl.duration > 0.1) {
      localVideoEl.currentTime = (currentSec / dur) * localVideoEl.duration;
    }
  }
}

playBtnEl.addEventListener('click', () => {
  isPlaying = !isPlaying;
  syncVideoPlayState();
  updatePlayButtonLabel();
});

btnStepPrevEl.addEventListener('click', () => {
  seekToSecond(currentSec - 0.04, true);
});

btnStepNextEl.addEventListener('click', () => {
  seekToSecond(currentSec + 0.04, true);
});

sliderEl.addEventListener('input', (e) => {
  const norm = parseFloat(e.target.value) / 1000;
  seekToSecond(norm * getActiveDurationSec(), true);
});

document.querySelectorAll('.speed-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    playbackSpeed = parseFloat(btn.dataset.speed);
    document.querySelectorAll('.speed-btn').forEach((b) => b.classList.toggle('active', b === btn));
    if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel') && syncVideoTo3D && zhibo8ClipEl.src) {
      zhibo8ClipEl.playbackRate = playbackSpeed;
    }
    if (localVideoEl.src) {
      localVideoEl.playbackRate = playbackSpeed;
    }
  });
});

function setSkeletonXray(enabled) {
  overlaysConfig.showSkeleton = Boolean(enabled);
  btnXrayTopEl.classList.toggle('active', overlaysConfig.showSkeleton);
  btnToggleSkeletonEl.classList.toggle('active', overlaysConfig.showSkeleton);
}

function toggleSkeletonXray() {
  setSkeletonXray(!overlaysConfig.showSkeleton);
}
btnXrayTopEl.addEventListener('click', toggleSkeletonXray);
btnToggleSkeletonEl.addEventListener('click', toggleSkeletonXray);

function bindToggleChip(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('click', () => {
    overlaysConfig[key] = !overlaysConfig[key];
    el.classList.toggle('active', overlaysConfig[key]);
  });
}
bindToggleChip('toggle-scan', 'showScan');
bindToggleChip('toggle-shadow', 'showCoverShadow');
bindToggleChip('toggle-traj', 'showTrajectories');
bindToggleChip('toggle-labels', 'showLabels');

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    isPlaying = !isPlaying;
    syncVideoPlayState();
    updatePlayButtonLabel();
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    seekToSecond(currentSec - 0.04, true);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    seekToSecond(currentSec + 0.04, true);
  } else if (e.key >= '1' && e.key <= '8') {
    if (activeMocapMode !== 'tactical') setMocapMode('tactical');
    loadScenario(parseInt(e.key, 10) - 1);
  } else if (e.key.toLowerCase() === 'x') {
    toggleSkeletonXray();
  }
});

// 9. Frame Evaluation & Render Loop
const prevBallPos = new BABYLON.Vector3();

function updateRigTelemetryUI(playerModel) {
  if (!playerModel || !playerModel.telemetry) return;
  const tel = playerModel.telemetry;
  rigBoneCountEl.textContent = `Babylon PBR · ${tel.boneCount} Bones (一体成型)`;
  rigActiveClipEl.textContent = tel.activeClip;
  rigActiveFootEl.textContent = tel.activeFoot;
  rigJointAnglesEl.textContent = `Knee ${tel.kneeFlexDeg}° · Ankle ${tel.anklePitchDeg}°/${tel.ankleEversionDeg}°`;
}

function applyCameraSmoothing(targetFovDeg = 35) {
  const targetFovRad = (targetFovDeg * Math.PI) / 180;
  if (Math.abs(mainCamera.fov - targetFovRad) > 0.0005) {
    mainCamera.fov = snapCameraNextFrame ? targetFovRad : lerp(mainCamera.fov, targetFovRad, 0.14);
  }
  if (snapCameraNextFrame) {
    mainCamera.position.copyFrom(desiredCamPos);
    currentCamTarget.copyFrom(desiredCamTarget);
    snapCameraNextFrame = false;
  } else {
    BABYLON.Vector3.LerpToRef(mainCamera.position, desiredCamPos, 0.14, mainCamera.position);
    BABYLON.Vector3.LerpToRef(currentCamTarget, desiredCamTarget, 0.16, currentCamTarget);
  }
  mainCamera.setTarget(currentCamTarget);
}

function evaluateFrame(dt) {
  // Mode A: 32-Clip Official Mixamo《Soccer Pack》Showcase Inspector
  if (activeMocapMode !== 'tactical') {
    const clipId = activeMocapMode.replace(/^lib:/, '');
    const meta = getMocapMeta(clipId);
    const dur = getActiveDurationSec();

    if (isPlaying && dt > 0) {
      currentSec = (currentSec + dt * playbackSpeed) % dur;
    }

    sliderEl.value = Math.round((currentSec / dur) * 1000);
    timeReadoutEl.textContent = `${currentSec.toFixed(2)}s / ${dur.toFixed(2)}s`;

    phaseBadgeEl.textContent = `Mixamo《Soccer Pack》 · ${meta.category}`;
    phaseDescEl.textContent = `${meta.label} —— 一体成型 65 骨零破洞模型 + 官方动作捕捉原片检阅（支持 0.25x 慢放、±1帧步进与 [X] 骨骼透视）。`;
    if (hudMocapBadgeEl) {
      hudMocapBadgeEl.textContent = `Mixamo Clip: ${clipId} (100%) · Frame ${Math.round(currentSec * 60)}/${Math.round(dur * 60)}`;
    }

    matchBall.position.set(0.18, 0.115, 8.38);
    overlaysConfig.cameraMode = cameraMode;

    if (showcasePedriActor) {
      const isKickOrPass =
        clipId.includes('pass') ||
        clipId.includes('through') ||
        clipId.includes('shot') ||
        clipId.includes('kick');
      updateBabylonPlayerPose(
        showcasePedriActor,
        {
          showcaseMode: true,
          tSec: currentSec,
          x: 0,
          z: 8.0,
          yaw: 0,
          vx: 0,
          vz: 0,
          speed: 0,
          primaryClip: clipId,
          clipTime: currentSec,
          ballTouch:
            isKickOrPass && currentSec > dur * 0.32 && currentSec < dur * 0.56
              ? { foot: 'R', type: 'inside', weight: 0.7 }
              : null
        },
        overlaysConfig
      );
      updateRigTelemetryUI(showcasePedriActor);
    }

    if (cameraMode !== 'free') {
      if (cameraMode === 'ankle') {
        desiredCamTarget.set(0.05, 0.45, 8.15);
        desiredCamPos.set(1.85, 0.78, 9.95);
      } else if (cameraMode === 'topdown') {
        desiredCamTarget.set(0, 0.5, 8.0);
        desiredCamPos.set(0.01, 12.0, 8.8);
      } else {
        desiredCamTarget.set(0, 0.94, 8.0);
        desiredCamPos.set(2.85, 1.65, 11.1);
      }
      applyCameraSmoothing(34);
    }
    return;
  }

  // Mode B: 8 Canonical Zhibo8 Scenarios — Master Clock Locked 1:1 to Video
  let sc = SCENARIOS[activeScenarioIndex];
  let dur = sc.durationSec;

  const videoReady = zhibo8ClipEl.style.display !== 'none' && zhibo8ClipEl.readyState >= 2;
  if (syncVideoTo3D && videoReady && (activeVideoSource === 'zhibo8' || activeVideoSource === 'reel')) {
    if (activeVideoSource === 'reel') {
      if (isPlaying && !zhibo8ClipEl.paused) {
        syncScenarioFromMasterReelTime(zhibo8ClipEl.currentTime);
        sc = SCENARIOS[activeScenarioIndex];
        dur = sc.durationSec;
      }
    } else if (activeSubClipIndex === 0) {
      if (isPlaying && !zhibo8ClipEl.paused) {
        currentSec = clamp(zhibo8ClipEl.currentTime, 0, dur);
      }
    } else if (zhibo8ClipEl.duration > 0.1 && isPlaying && !zhibo8ClipEl.paused) {
      currentSec = (zhibo8ClipEl.currentTime / zhibo8ClipEl.duration) * dur;
    }
  } else if (isPlaying && dt > 0) {
    currentSec = (currentSec + dt * playbackSpeed) % dur;
  }

  sliderEl.value = Math.round((currentSec / dur) * 1000);
  timeReadoutEl.textContent = `${currentSec.toFixed(2)}s / ${dur.toFixed(2)}s`;

  const evalState = evaluateScenarioAtTime(sc, currentSec);

  phaseBadgeEl.textContent = evalState.phase.label;
  phaseDescEl.textContent = evalState.phase.desc;
  document.querySelectorAll('.phase-jump-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === evalState.activePhaseIdx);
  });

  activeRibbons.forEach((r) => {
    r.setEnabled(Boolean(overlaysConfig.showTrajectories));
  });

  matchBall.position.set(evalState.ballState.x, evalState.ballState.y ?? 0.115, evalState.ballState.z);
  const ballMoveDist = Math.hypot(
    matchBall.position.x - prevBallPos.x,
    matchBall.position.z - prevBallPos.z
  );
  if (ballMoveDist > 0.001 && ballMoveDist < 2.0) {
    matchBall.rotation.x -= ballMoveDist * 6.8;
    matchBall.rotation.z += ballMoveDist * 4.2;
  }
  prevBallPos.copyFrom(matchBall.position);

  let pedriState = null;
  let pedriModel = null;
  let minDefDist = 99;

  activeActors.forEach((actorObj, idx) => {
    const st = evalState.actorStates[idx];
    if (isHeroRole(actorObj.def.role)) {
      pedriState = st;
      pedriModel = actorObj.model;
    }
  });

  overlaysConfig.cameraMode = cameraMode;
  activeActors.forEach((actorObj, idx) => {
    const st = evalState.actorStates[idx];
    if (actorObj.def.role === 'defender' && pedriState) {
      const d = Math.hypot(st.x - pedriState.x, st.z - pedriState.z);
      if (d < minDefDist) minDefDist = d;
      st.shadowYaw = Math.atan2(pedriState.x - st.x, pedriState.z - st.z);
    }
    updateBabylonPlayerPose(actorObj.model, st, overlaysConfig);
  });

  if (pedriModel) {
    updateRigTelemetryUI(pedriModel);
    if (hudMocapBadgeEl) {
      const syncTag =
        syncVideoTo3D && videoReady && activeSubClipIndex === 0
          ? `视频主时钟 1:1 锁定 (${currentSec.toFixed(2)}s)`
          : `时间轴 (${currentSec.toFixed(2)}s)`;
      hudMocapBadgeEl.textContent = `Mixamo Soccer: ${pedriModel.activeMocapDebug} · ${syncTag}`;
    }
  }

  const pressPct = Math.round(clamp((1 - (minDefDist - 0.9) / 6.5) * 100, 8, 98));
  const decepRaw = pedriState
    ? Math.max(
        Math.abs(pedriState.leanRoll || 0) * 3.4,
        pedriState.crouch || 0,
        pedriState.blendWeight || 0,
        pedriState.ballTouch ? pedriState.ballTouch.weight * 0.92 : 0.2
      )
    : 0.3;
  const decepPct = Math.round(clamp(decepRaw * 100, 15, 99));
  const sepMeters = minDefDist < 50 ? minDefDist.toFixed(2) : '4.50';
  const sepPct = Math.round(clamp((minDefDist / 5.5) * 100, 10, 100));

  barPressIntensity.style.width = `${pressPct}%`;
  valPressIntensity.textContent = `${pressPct}%`;
  barDeception.style.width = `${decepPct}%`;
  valDeception.textContent = `${decepPct}%`;
  barSeparation.style.width = `${sepPct}%`;
  valSeparation.textContent = `${sepMeters} m`;

  if (cameraMode === 'broadcast') {
    const c = evalState.cam;
    desiredCamPos.set(c.pos[0], c.pos[1], c.pos[2]);
    desiredCamTarget.set(c.target[0], c.target[1], c.target[2]);
    applyCameraSmoothing(c.fov || 35);
  } else if (cameraMode === 'pedri' && pedriState) {
    const behindX = pedriState.x - Math.sin(pedriState.yaw) * 4.4;
    const behindZ = pedriState.z - Math.cos(pedriState.yaw) * 4.4;
    desiredCamPos.set(behindX, 2.25, behindZ);
    desiredCamTarget.set(
      pedriState.x + Math.sin(pedriState.yaw) * 3.5,
      1.05,
      pedriState.z + Math.cos(pedriState.yaw) * 3.5
    );
    applyCameraSmoothing(42);
  } else if (cameraMode === 'ankle' && pedriState) {
    desiredCamTarget.set(
      lerp(pedriState.x, matchBall.position.x, 0.4),
      0.55,
      lerp(pedriState.z, matchBall.position.z, 0.4)
    );
    desiredCamPos.set(pedriState.x + 2.45, 0.98, pedriState.z + 1.65);
    applyCameraSmoothing(34);
  } else if (cameraMode === 'topdown' && pedriState) {
    desiredCamTarget.set(pedriState.x, 0.2, pedriState.z);
    desiredCamPos.set(pedriState.x + 0.5, 23.5, pedriState.z + 0.01);
    applyCameraSmoothing(40);
  }
}

// 10. Boot Studio & Expose Deterministic Visual QA API
buildScenarioSidebar();
loadScenario(0);
updatePlayButtonLabel();

let lastFrameMs = performance.now();
engine.runRenderLoop(() => {
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.05);
  lastFrameMs = nowMs;
  evaluateFrame(dt);
  scene.render();
});

window.__STUDIO_DEBUG__ = {
  waitReady: () => rigReadyPromise,
  isReady: () => rigLoaded,
  getScenarioCount: () => SCENARIOS.length,
  pauseRenderLoop: () => engine.stopRenderLoop(),
  setSplitLayout: (split) => applySplitLayout(split),
  setPositionFilter: (pos, autoSelectFirst = false) => setPositionFilter(pos, autoSelectFirst),
  setOverlays: (cfg) => {
    Object.assign(overlaysConfig, cfg);
    setSkeletonXray(overlaysConfig.showSkeleton);
  },
  async inspectScenario(scenarioIdx, sec, camMode = 'broadcast', customCam = null, showXray = false) {
    await rigReadyPromise;
    if (activeMocapMode !== 'tactical') {
      setMocapMode('tactical');
    }
    if (activeScenarioIndex !== scenarioIdx) {
      loadScenario(scenarioIdx);
    }
    setSkeletonXray(showXray);

    // Wait until video metadata is ready if visible so video frame matches 1:1
    if (splitLayout && zhibo8ClipEl.src) {
      await new Promise((resolve) => {
        if (zhibo8ClipEl.readyState >= 2) return resolve();
        const onReady = () => resolve();
        zhibo8ClipEl.addEventListener('loadeddata', onReady, { once: true });
        setTimeout(resolve, 2000);
      });
    }

    seekToSecond(sec, true);
    if (splitLayout && zhibo8ClipEl.readyState >= 1) {
      await new Promise((resolve) => {
        if (!zhibo8ClipEl.seeking) return setTimeout(resolve, 120);
        zhibo8ClipEl.addEventListener('seeked', () => setTimeout(resolve, 80), { once: true });
        setTimeout(resolve, 800);
      });
    }

    if (customCam) {
      setCameraMode('free', false);
      freeCamera.fov = ((customCam.fovDeg || 30) * Math.PI) / 180;
      freeCamera.setTarget(new BABYLON.Vector3(...customCam.target));
      freeCamera.setPosition(new BABYLON.Vector3(...customCam.pos));
    } else {
      setCameraMode(camMode, false);
      snapCameraNextFrame = true;
    }

    evaluateFrame(0);
    await scene.whenReadyAsync(true);
    scene.render();
    scene.render();
    const heroObj = activeActors.find((a) => isHeroRole(a.def.role));
    return {
      scenario: SCENARIOS[activeScenarioIndex].id,
      positionGroup: SCENARIOS[activeScenarioIndex].positionGroup,
      starName: SCENARIOS[activeScenarioIndex].starName,
      currentSec,
      videoTime: zhibo8ClipEl.currentTime,
      actorCount: activeActors.length,
      pedriTelemetry: heroObj ? heroObj.model.telemetry : null
    };
  },
  async inspectMocapClip(clipId, sec, customCam = null, showXray = false, showLabels = false) {
    await rigReadyPromise;
    setMocapMode(`lib:${clipId}`);
    setSkeletonXray(showXray);
    overlaysConfig.showLabels = showLabels;
    seekToSecond(sec, true);

    if (customCam) {
      setCameraMode('free', false);
      freeCamera.fov = ((customCam.fovDeg || 28) * Math.PI) / 180;
      freeCamera.setTarget(new BABYLON.Vector3(...customCam.target));
      freeCamera.setPosition(new BABYLON.Vector3(...customCam.pos));
    } else {
      setCameraMode('broadcast', false);
      snapCameraNextFrame = true;
    }

    evaluateFrame(0);
    await scene.whenReadyAsync(true);
    scene.render();
    scene.render();
    return {
      clipId,
      currentSec,
      telemetry: showcasePedriActor ? showcasePedriActor.telemetry : null
    };
  }
};
