const BABYLON = window.BABYLON;
import { createBabylonPitchEnvironment, createBabylonMatchBall } from './babylonPitch.js';
import {
  preloadBabylonAthleteRig,
  attachBabylonAthleteRig,
  createBabylonPlayer,
  updateBabylonPlayerPose,
  setPlayerWhiteModelMode,
  createBabylonTrajectoryRibbon,
  isHeroRole
} from './babylonPlayer.js';
import { resolveKitPreset } from './babylonKit.js';
import {
  ATOMIC_CATEGORIES,
  SOCCER_ATOMIC_CATALOG,
  SOCCER_ATOMIC_BY_ID
} from './soccerAtomicCatalog.js';
import { getAtomicClip } from './atomicMotionAssembler.js';
import { SCENARIOS, SCENARIO_ASSEMBLED_SEQUENCES, evaluateScenarioAtTime } from './scenarios.js';
import { SCENARIO_VIDEOS, MASTER_ZHIBO8_REEL } from './videos.js';
import { PRESSING_TAXONOMY } from './fullMatchSamples.js';
import { buildDynamic3DScenarioFromSlice } from './fullMatchEngine.js';
import { initFullMatchWorkspace } from './fullMatchWorkspace.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const studioShellEl = document.querySelector('.studio-shell');
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

// 2. Build Stadium / White-Model Calibration Grid Environment & FIFA Size-5 Match Ball
const { shadowGen, setWhiteBoxMode } = createBabylonPitchEnvironment(scene);
const matchBall = createBabylonMatchBall(scene, shadowGen);

const scenarioGroup = new BABYLON.TransformNode('ScenarioGroup', scene);
const mocapShowcaseGroup = new BABYLON.TransformNode('MocapShowcaseGroup', scene);
mocapShowcaseGroup.setEnabled(false);

let workspaceMode = '3d'; // '3d' | 'fullmatch'
let activeScenarioIndex = 0;
let activeDynamicScenario = null; // Synthesized 3D scenario from a Full-Match pressing slice
let activeDynamicVideoRange = null; // { start, end } when playing a direct sub-clip in 3D lab
let activePositionFilter = 'ALL'; // 'ALL' | 'MF' | 'FW' | 'DF'
let activeActors = [];
let activeRibbons = [];
let snapCameraNextFrame = true;
let rigLoaded = false;
let cachedRigContext = null;

function getCurrentScenario() {
  return activeDynamicScenario || SCENARIOS[activeScenarioIndex];
}

// Playback, Master Video Clock & 86-Clip White-Model Football Atomic Library State
let isPlaying = true;
let playbackSpeed = 0.5;
let currentSec = 0.0;
let cameraMode = 'broadcast';
let splitLayout = true;
let activeVideoSource = 'zhibo8';
let activeSubClipIndex = 0;
let syncVideoTo3D = true;
let activeMocapMode = 'tactical'; // 'tactical' | 'atomic:<clipId>'
let showcaseRootMotion = true;
let showcasePedriActor = null;
let lastHighlightedSegIdx = -1;

const overlaysConfig = {
  whiteBoxMode: true,
  showSkeleton: false,
  showScan: true,
  showCoverShadow: true,
  showTrajectories: true,
  showLabels: true,
  cameraMode: 'broadcast'
};

// Boot into White-Model Mannequin + 1.0m Calibration Grid Studio Mode by default
setWhiteBoxMode(true);

// UI References
const btnWorkspace3DEl = document.getElementById('btn-workspace-3d');
const btnWorkspaceFullMatchEl = document.getElementById('btn-workspace-fullmatch');
const fullMatchWorkspaceEl = document.getElementById('fullmatch-workspace');
const fullMatchTopActionsEl = document.getElementById('fullmatch-top-actions');
const dynamicSliceReturnBarEl = document.getElementById('dynamic-slice-return-bar');
const dynamicSliceReturnMetaEl = document.getElementById('dynamic-slice-return-meta');
const btnReturnFullMatchEl = document.getElementById('btn-return-fullmatch');

const scenarioListEl = document.getElementById('scenario-list');
const scenarioCountBadgeEl = document.getElementById('scenario-count-badge');
const brandJerseyCrestEl = document.getElementById('brand-jersey-crest');
const legendHeroLabelEl = document.getElementById('legend-hero-label');
const phaseBadgeEl = document.getElementById('live-phase-badge');
const matchSourceEl = document.getElementById('live-match-source');
const phaseDescEl = document.getElementById('live-phase-desc');
const hudMocapBadgeEl = document.getElementById('hud-mocap-badge');
const assemblyChainStripEl = document.getElementById('assembly-chain-strip');
const phaseButtonsContainer = document.getElementById('phase-pills-row');
const playBtnEl = document.getElementById('btn-play-toggle');
const btnStepPrevEl = document.getElementById('btn-step-prev');
const btnStepNextEl = document.getElementById('btn-step-next');
const sliderEl = document.getElementById('timeline-slider');
const timeReadoutEl = document.getElementById('time-readout');

const mocapModeSelectEl = document.getElementById('mocap-mode-select');
const btnWhiteboxTopEl = document.getElementById('btn-whitebox-top');
const btnToggleWhiteboxEl = document.getElementById('toggle-whitebox');
const btnRootMotionTopEl = document.getElementById('btn-rootmotion-top');
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

function getHeroRigContext() {
  if (cachedRigContext) return cachedRigContext;
  if (!rigLoaded) return null;
  const readyModel =
    activeActors.find((a) => a.model && a.model.rigReady)?.model ||
    (showcasePedriActor && showcasePedriActor.rigReady ? showcasePedriActor : null);
  if (!readyModel || !readyModel.boneNodes || !readyModel.restRot) return null;
  cachedRigContext = {
    boneNames: Array.from(readyModel.boneNodes.keys()),
    restRot: readyModel.restRot
  };
  return cachedRigContext;
}

// Populate 86-Clip Canonical White-Model Football Atomic Library into #mocap-mode-select
function buildMocapLibrarySelector() {
  mocapModeSelectEl.innerHTML = '';

  const optTactical = document.createElement('option');
  optTactical.value = 'tactical';
  optTactical.textContent = '⚽ 组装复杂动作 × 实况视频 1:1 对照 (18大场景)';
  mocapModeSelectEl.appendChild(optTactical);

  for (const [catKey, catLabel] of Object.entries(ATOMIC_CATEGORIES)) {
    const list = SOCCER_ATOMIC_CATALOG.filter((item) => item.category === catKey);
    if (list.length === 0) continue;
    const grp = document.createElement('optgroup');
    grp.label = `白模足球原子动作库 · ${catLabel} (${list.length}组)`;
    for (const item of list) {
      const opt = document.createElement('option');
      opt.value = `atomic:${item.id}`;
      opt.textContent = `[${item.id}] ${item.label} · ${item.source}`;
      grp.appendChild(opt);
    }
    mocapModeSelectEl.appendChild(grp);
  }
}
buildMocapLibrarySelector();

// Preload Intact Watertight 65-Bone Athlete + All 86 Optical White-Model Atomic Clips
const rigReadyPromise = preloadBabylonAthleteRig(scene, (done, total) => {
  if (hudMocapBadgeEl) {
    hudMocapBadgeEl.textContent = `白模足球原子动作库加载中: ${done}/${total} 组光学动捕...`;
  }
}).then(() => {
  rigLoaded = true;
  activeActors.forEach((a) => {
    attachBabylonAthleteRig(a.model);
    setPlayerWhiteModelMode(a.model, overlaysConfig.whiteBoxMode);
  });
  if (showcasePedriActor) {
    attachBabylonAthleteRig(showcasePedriActor);
    setPlayerWhiteModelMode(showcasePedriActor, overlaysConfig.whiteBoxMode);
  }
  getHeroRigContext();
  if (activeMocapMode === 'tactical') {
    matchSourceEl.textContent = getCurrentScenario().matchRef;
  }
});

// White-Model Studio Mode Controller (1.0m Grid + Alabaster/Slate Clay + Cyan/Orange Foot-Plant Rings)
function setStudioWhiteBoxMode(enabled) {
  overlaysConfig.whiteBoxMode = Boolean(enabled);
  setWhiteBoxMode(overlaysConfig.whiteBoxMode);
  if (btnWhiteboxTopEl) btnWhiteboxTopEl.classList.toggle('active', overlaysConfig.whiteBoxMode);
  if (btnToggleWhiteboxEl) btnToggleWhiteboxEl.classList.toggle('active', overlaysConfig.whiteBoxMode);

  activeActors.forEach((a) => setPlayerWhiteModelMode(a.model, overlaysConfig.whiteBoxMode));
  if (showcasePedriActor) {
    setPlayerWhiteModelMode(showcasePedriActor, overlaysConfig.whiteBoxMode);
  }
  updateHeroHeaderAndLegend(getCurrentScenario());
}

function toggleStudioWhiteBoxMode() {
  setStudioWhiteBoxMode(!overlaysConfig.whiteBoxMode);
}
if (btnWhiteboxTopEl) btnWhiteboxTopEl.addEventListener('click', toggleStudioWhiteBoxMode);
if (btnToggleWhiteboxEl) btnToggleWhiteboxEl.addEventListener('click', toggleStudioWhiteBoxMode);

if (btnRootMotionTopEl) {
  btnRootMotionTopEl.addEventListener('click', () => {
    showcaseRootMotion = !showcaseRootMotion;
    btnRootMotionTopEl.classList.toggle('active', showcaseRootMotion);
    btnRootMotionTopEl.textContent = showcaseRootMotion ? 'Root位移' : '原地检阅';
    currentSec = 0;
    snapCameraNextFrame = true;
  });
}

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
  } else if (initialTimeSec >= 0 && zhibo8ClipEl.readyState >= 1 && activeDynamicVideoRange) {
    zhibo8ClipEl.currentTime = clamp(initialTimeSec, 0, Math.max(0, zhibo8ClipEl.duration - 0.05));
  }

  zhibo8ClipEl.playbackRate = syncVideoTo3D ? playbackSpeed : 1.0;
  if (isPlaying && workspaceMode === '3d') {
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

zhibo8ClipEl.addEventListener('timeupdate', () => {
  if (!activeDynamicVideoRange) return;
  if (
    zhibo8ClipEl.currentTime >= activeDynamicVideoRange.end ||
    zhibo8ClipEl.currentTime < activeDynamicVideoRange.start - 0.35
  ) {
    zhibo8ClipEl.currentTime = activeDynamicVideoRange.start;
    if (isPlaying && workspaceMode === '3d') {
      zhibo8ClipEl.play().catch(() => {});
    }
  }
});

zhibo8ClipEl.addEventListener('seeked', () => {
  if (!syncVideoTo3D || activeMocapMode !== 'tactical') return;
  if (activeDynamicScenario) {
    const dur = activeDynamicScenario.durationSec;
    if (activeDynamicVideoRange) {
      currentSec = clamp(zhibo8ClipEl.currentTime - activeDynamicVideoRange.start, 0, dur);
    } else if (zhibo8ClipEl.duration > 0.1) {
      currentSec = clamp((zhibo8ClipEl.currentTime / zhibo8ClipEl.duration) * dur, 0, dur);
    }
    return;
  }
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
  const sc = getCurrentScenario();
  if (activeDynamicScenario && sc._fullMatchSlice) {
    const slice = sc._fullMatchSlice;
    const meta = sc._fullMatchMeta || {};
    const isDirect = Boolean(meta.hasDirectFullVideo && meta.videoSrc);
    const src = isDirect ? meta.videoSrc : slice.refVideoSrc || './assets/videos/s1_zhibo8_half_turn.mp4';
    const offsetSec = isDirect ? Number(meta.kickoffOffsetSec || 0) : 0;
    const adjStart = Math.max(0, Number(slice.tStart || 0) + offsetSec);
    const adjEnd = Math.max(adjStart + 1.2, Number(slice.tEnd || adjStart + 4) + offsetSec);
    activeDynamicVideoRange = isDirect ? { start: adjStart, end: adjEnd } : null;

    zhibo8SubclipsBarEl.style.display = 'flex';
    zhibo8SubclipsBtnsEl.innerHTML = `<span style="font-size:11px;color:var(--accent-gold);font-weight:600;">🏟️ 整场切片 #${slice.index} (${slice.clock}) × 3D白模1:1空间重演</span>`;
    videoWatchCueEl.textContent = slice.summary;
    loadZhibo8ClipElement(
      src,
      sc.matchRef,
      `slice_${slice.id}.mp4`,
      '#',
      activeDynamicVideoRange ? activeDynamicVideoRange.start : 0
    );
    return;
  }

  activeDynamicVideoRange = null;
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
      '<span style="font-size:11px;color:var(--accent-gold);font-weight:600;">55.5s 总集锦连播中 · 白模组装 3D 场景随视频自动切换 01→08</span>';
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
    videoNowTitleEl.textContent = '本地实况视频 × Babylon.js 65 骨白模组装球员同步慢放对比';
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
  btnLayoutSplit.textContent = splitLayout ? '视频+3D' : '开视频';
  viewportStageEl.classList.toggle('split-mode', splitLayout);
  viewportStageEl.classList.toggle('full3d-mode', !splitLayout);
  engine.resize();
}

btnLayoutSplit.addEventListener('click', () => {
  applySplitLayout(!splitLayout);
});

// 4. Interactive Action-Chain Assembly Strip (Bottom Dock)
function renderAssemblyChainStrip(sc) {
  if (!assemblyChainStripEl) return;
  assemblyChainStripEl.innerHTML = '';
  lastHighlightedSegIdx = -1;

  if (activeDynamicScenario && activeMocapMode === 'tactical') {
    const retBtn = document.createElement('button');
    retBtn.type = 'button';
    retBtn.className = 'assembly-node-btn active';
    retBtn.style.marginRight = '4px';
    retBtn.innerHTML = '<span>⬅ 返回整场逼抢切片台</span>';
    retBtn.addEventListener('click', () => setWorkspaceMode('fullmatch'));
    assemblyChainStripEl.appendChild(retBtn);
  }

  if (activeMocapMode !== 'tactical') {
    const clipId = activeMocapMode.replace(/^(atomic:|lib:)/, '');
    const meta = SOCCER_ATOMIC_BY_ID.get(clipId);
    const lbl = document.createElement('span');
    lbl.className = 'assembly-chain-label';
    lbl.textContent = '🔬 单体白模原子动作检阅';
    assemblyChainStripEl.appendChild(lbl);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'assembly-node-btn active';
    backBtn.innerHTML = '<span>⬅ 返回复杂动作组装模式</span>';
    backBtn.addEventListener('click', () => setMocapMode('tactical'));
    assemblyChainStripEl.appendChild(backBtn);

    if (meta) {
      const info = document.createElement('span');
      info.className = 'assembly-arrow';
      info.style.marginLeft = '6px';
      info.textContent =
        `片源: ${meta.source} · 时长: ${meta.duration}s (${meta.frames}帧) · ` +
        `净位移: [${meta.deltaPos[0]}m, ${meta.deltaPos[1]}m] · 净转身: ${meta.deltaYawDeg}° · ` +
        `支撑足切换: ${meta.firstStanceFoot}→${meta.lastStanceFoot}`;
      assemblyChainStripEl.appendChild(info);
    }
    return;
  }

  const heroDef = sc.actors.find((a) => isHeroRole(a.role)) || sc.actors[0];
  const specMap = SCENARIO_ASSEMBLED_SEQUENCES[sc.id];
  const heroSeqSpec = specMap && heroDef ? specMap[heroDef.id] : null;
  if (!heroSeqSpec || !heroSeqSpec.segments) return;

  const badge = document.createElement('span');
  badge.className = 'assembly-chain-label';
  badge.textContent = `🧩 原子组装链 (${heroSeqSpec.segments.length}段 C2惯性拼接)`;
  assemblyChainStripEl.appendChild(badge);

  let accStart = 0;
  heroSeqSpec.segments.forEach((seg, idx) => {
    if (idx > 0) {
      const arr = document.createElement('span');
      arr.className = 'assembly-arrow';
      arr.textContent = '➔';
      assemblyChainStripEl.appendChild(arr);
    }
    const segStart = accStart;
    const segDur = seg.durationSec || 0.8;
    accStart += segDur;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'assembly-node-btn';
    btn.dataset.segIdx = String(idx);
    btn.title = '单击跳至该组装段起点 · 双击单独检阅该白模原子动作';
    btn.innerHTML = `<span>${idx + 1}. ${seg.note || seg.clipId}</span><code>${seg.clipId}</code>`;
    btn.addEventListener('click', () => {
      seekToSecond(segStart + 0.02, true);
    });
    btn.addEventListener('dblclick', () => {
      setMocapMode(`atomic:${seg.clipId}`);
    });
    assemblyChainStripEl.appendChild(btn);
  });
}

function highlightActiveAssemblyNode(segIdx) {
  if (!assemblyChainStripEl || segIdx === lastHighlightedSegIdx) return;
  lastHighlightedSegIdx = segIdx;
  assemblyChainStripEl.querySelectorAll('.assembly-node-btn[data-seg-idx]').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.segIdx) === segIdx);
  });
}

// 5. Switch Between 18-Scenario Assembled Sequences vs 86-Clip White-Model Atomic Library Showcase
function clearShowcaseObjects() {
  if (showcasePedriActor) {
    showcasePedriActor.dispose();
    showcasePedriActor = null;
  }
}

function resolveAtomicClipIdFromMode(mode) {
  const raw = mode.replace(/^(atomic:|lib:)/, '');
  if (SOCCER_ATOMIC_BY_ID.has(raw)) return raw;
  return 'stance_ready';
}

function setMocapMode(mode) {
  if (mode === 'tactical') {
    activeMocapMode = 'tactical';
    mocapModeSelectEl.value = 'tactical';
    if (btnRootMotionTopEl) btnRootMotionTopEl.style.display = 'none';
    currentSec = 0.0;
    snapCameraNextFrame = true;
    clearShowcaseObjects();
    mocapShowcaseGroup.setEnabled(false);
    scenarioGroup.setEnabled(true);
    if (activeDynamicScenario) {
      applyScenarioToStage(activeDynamicScenario);
    } else {
      loadScenario(activeScenarioIndex);
    }
    return;
  }

  const clipId = resolveAtomicClipIdFromMode(mode);
  activeMocapMode = `atomic:${clipId}`;
  mocapModeSelectEl.value = activeMocapMode;
  if (btnRootMotionTopEl) {
    btnRootMotionTopEl.style.display = 'inline-flex';
    btnRootMotionTopEl.classList.toggle('active', showcaseRootMotion);
    btnRootMotionTopEl.textContent = showcaseRootMotion ? 'Root位移' : '原地检阅';
  }
  currentSec = 0.0;
  snapCameraNextFrame = true;

  const meta = SOCCER_ATOMIC_BY_ID.get(clipId) || SOCCER_ATOMIC_CATALOG[0];

  scenarioGroup.setEnabled(false);
  mocapShowcaseGroup.setEnabled(true);

  const curSc = getCurrentScenario();
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
  setPlayerWhiteModelMode(showcasePedriActor, overlaysConfig.whiteBoxMode);
  renderAssemblyChainStrip(curSc);

  matchSourceEl.textContent = `白模足球原子动作库 (86组) · ${meta.categoryLabel} · ${meta.source}`;
  inspEyebrowEl.textContent = `ATOMIC CLIP · ${meta.category.toUpperCase()} · ${meta.source.toUpperCase()}`;
  inspTitleEl.textContent = meta.label;
  inspMoveEl.textContent = `资产 ID: ${meta.id} (${meta.file}) · 时长 ${meta.duration}s · ΔYaw ${meta.deltaYawDeg}°`;
  inspPressureEl.textContent =
    '提示：地面 1.0m 标准网格 + 青(左)/橙(右)足底触地环可直观验证零滑步与真实 Root Motion；按 [W] 切换白模/球衣。';
}

mocapModeSelectEl.addEventListener('change', (e) => {
  setMocapMode(e.target.value);
});

// 6. Render Sidebar Scenario List & Position Filter Tabs (ALL / MF / FW / DF)
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
    btn.className = `scenario-item${!activeDynamicScenario && idx === activeScenarioIndex ? ' active' : ''}`;
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
        if (btnRootMotionTopEl) btnRootMotionTopEl.style.display = 'none';
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

  if (autoSelectFirst && pos !== 'ALL' && !activeDynamicScenario) {
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

// 7. Load Selected Scenario (or Dynamic Full-Match Slice) into Babylon.js Scene
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
  if (!sc) return;
  const heroDef = sc.actors.find((a) => isHeroRole(a.role)) || sc.actors[0];
  if (!heroDef) return;
  const preset = resolveKitPreset(heroDef.kit);

  if (brandJerseyCrestEl) {
    brandJerseyCrestEl.textContent = String(heroDef.number || '8');
    brandJerseyCrestEl.style.background = `linear-gradient(135deg, ${preset.primary} 0%, ${preset.primary} 48%, ${preset.secondary} 52%, ${preset.secondary} 100%)`;
    brandJerseyCrestEl.style.color = preset.numColor || '#facc15';
  }
  if (legendHeroLabelEl) {
    const modeTag = overlaysConfig.whiteBoxMode ? '白模雕塑素体' : '实况球衣草皮';
    legendHeroLabelEl.textContent = `${sc.starName || heroDef.label} (${sc.positionLabel || '主角'} · ${modeTag})`;
  }
}

function applyScenarioToStage(sc, opts = {}) {
  currentSec = 0.0;
  snapCameraNextFrame = true;

  updateHeroHeaderAndLegend(sc);

  clearScenarioObjects();
  activeActors = sc.actors.map((actorDef) => {
    const model = createBabylonPlayer(scene, actorDef, shadowGen, scenarioGroup);
    setPlayerWhiteModelMode(model, overlaysConfig.whiteBoxMode);
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

  renderAssemblyChainStrip(sc);

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

function loadScenario(index, opts = {}) {
  activeDynamicScenario = null;
  activeDynamicVideoRange = null;
  if (dynamicSliceReturnBarEl) {
    dynamicSliceReturnBarEl.style.display = 'none';
  }

  activeScenarioIndex = index;
  if (!opts.preserveSubClip) {
    activeSubClipIndex = 0;
  }
  const sc = SCENARIOS[index];

  document.querySelectorAll('.scenario-item').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.scenarioIdx) === index);
  });

  applyScenarioToStage(sc, opts);
}

function loadDynamicFullMatchSlice(slice, matchMeta) {
  if (activeMocapMode !== 'tactical') {
    activeMocapMode = 'tactical';
    mocapModeSelectEl.value = 'tactical';
    if (btnRootMotionTopEl) btnRootMotionTopEl.style.display = 'none';
    clearShowcaseObjects();
    mocapShowcaseGroup.setEnabled(false);
    scenarioGroup.setEnabled(true);
  }

  const dynSc = buildDynamic3DScenarioFromSlice(slice, matchMeta, PRESSING_TAXONOMY);
  activeDynamicScenario = dynSc;

  if (dynamicSliceReturnBarEl) {
    dynamicSliceReturnBarEl.style.display = 'flex';
  }
  if (dynamicSliceReturnMetaEl) {
    dynamicSliceReturnMetaEl.textContent =
      `整场切片 #${slice.index} (${slice.clock}) · ${matchMeta.homeTeamZh} vs ${matchMeta.awayTeamZh}`;
  }
  document.querySelectorAll('.scenario-item').forEach((el) => el.classList.remove('active'));

  setWorkspaceMode('3d');
  setCameraMode('broadcast', false);
  isPlaying = true;
  updatePlayButtonLabel();
  applyScenarioToStage(dynSc);
  return dynSc;
}

// 8. Camera Mode Controller
function setCameraMode(mode, resetView = true) {
  cameraMode = mode;
  snapCameraNextFrame = true;
  document.querySelectorAll('.cam-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === mode);
  });

  if (mode === 'free') {
    if (resetView) {
      const [fx, fy, fz] =
        activeMocapMode === 'tactical' ? getCurrentScenario().defaultFocus : [0, 0, 8.0];
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

// 9. Bidirectional Master Clock Seeking & Frame-Stepping (±0.04s)
function getActiveDurationSec() {
  if (activeMocapMode !== 'tactical') {
    const clipId = resolveAtomicClipIdFromMode(activeMocapMode);
    const meta = SOCCER_ATOMIC_BY_ID.get(clipId);
    const clip = getAtomicClip(clipId);
    const rawDur = clip ? clip.duration : meta ? meta.duration : 1.6;
    if (meta && meta.loop && showcaseRootMotion) {
      return Math.max(rawDur * 3, 2.4);
    }
    return Math.max(0.25, rawDur);
  }
  return getCurrentScenario().durationSec;
}

function syncVideoPlayState() {
  if (workspaceMode !== '3d') {
    zhibo8ClipEl.pause();
    localVideoEl.pause();
    return;
  }
  if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel' || activeDynamicScenario) && syncVideoTo3D && zhibo8ClipEl.src) {
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
    if (activeDynamicScenario && zhibo8ClipEl.readyState >= 1) {
      if (activeDynamicVideoRange) {
        zhibo8ClipEl.currentTime = clamp(
          activeDynamicVideoRange.start + currentSec,
          0,
          Math.max(0, zhibo8ClipEl.duration - 0.02)
        );
      } else if (zhibo8ClipEl.duration > 0.1) {
        zhibo8ClipEl.currentTime = clamp((currentSec / dur) * zhibo8ClipEl.duration, 0, zhibo8ClipEl.duration - 0.02);
      }
    } else if (activeVideoSource === 'zhibo8' && zhibo8ClipEl.readyState >= 1) {
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
    if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel' || activeDynamicScenario) && syncVideoTo3D && zhibo8ClipEl.src) {
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
  if (!el) return;
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
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key.toLowerCase() === 'm') {
    setWorkspaceMode(workspaceMode === 'fullmatch' ? '3d' : 'fullmatch');
    return;
  }
  if (workspaceMode !== '3d') return;
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
  } else if (e.key.toLowerCase() === 'w') {
    toggleStudioWhiteBoxMode();
  } else if (e.key.toLowerCase() === 'x') {
    toggleSkeletonXray();
  }
});

// 10. Frame Evaluation & Render Loop
const prevBallPos = new BABYLON.Vector3();

function updateRigTelemetryUI(playerModel) {
  if (!playerModel || !playerModel.telemetry) return;
  const tel = playerModel.telemetry;
  rigBoneCountEl.textContent = overlaysConfig.whiteBoxMode
    ? `White-Model 素体 · ${tel.boneCount} Bones`
    : `Stadium Kit · ${tel.boneCount} Bones`;
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
  // Mode A: 86-Clip Canonical White-Model Football Atomic Library Showcase
  if (activeMocapMode !== 'tactical') {
    const clipId = resolveAtomicClipIdFromMode(activeMocapMode);
    const meta = SOCCER_ATOMIC_BY_ID.get(clipId) || SOCCER_ATOMIC_CATALOG[0];
    const dur = getActiveDurationSec();

    if (isPlaying && dt > 0) {
      const nextT = currentSec + dt * playbackSpeed;
      if (nextT >= dur) {
        currentSec = nextT % dur;
        snapCameraNextFrame = true;
      } else {
        currentSec = nextT;
      }
    }

    sliderEl.value = Math.round((currentSec / dur) * 1000);
    timeReadoutEl.textContent = `${currentSec.toFixed(2)}s / ${dur.toFixed(2)}s`;

    phaseBadgeEl.textContent = meta.categoryLabel;
    phaseDescEl.textContent = `${meta.label} —— 65 骨白模雕塑素体 + 1.0m 标定网格 + 左右脚支撑触地环检阅（支持 Root 位移、0.25x 慢放、±1帧步进与 [W] 球衣切换）。`;

    overlaysConfig.cameraMode = cameraMode;

    let rx = 0;
    let rz = 8.0;
    let ryaw = 0;

    if (showcasePedriActor) {
      updateBabylonPlayerPose(
        showcasePedriActor,
        {
          atomicShowcaseClipId: clipId,
          useRootMotion: showcaseRootMotion,
          originX: 0,
          originZ: 8.0,
          originYaw: 0,
          clipTime: currentSec,
          tSec: currentSec
        },
        overlaysConfig
      );
      rx = showcasePedriActor.root.position.x;
      rz = showcasePedriActor.root.position.z;
      ryaw = showcasePedriActor.root.rotation.y;
      updateRigTelemetryUI(showcasePedriActor);
      if (hudMocapBadgeEl) {
        hudMocapBadgeEl.textContent = `${showcasePedriActor.activeMocapDebug} · ${currentSec.toFixed(2)}s/${dur.toFixed(2)}s`;
      }
    }

    const isBallClip =
      meta.category === '03_first_touch' ||
      meta.category === '05_feints_skills' ||
      meta.category === '06_pass_strike' ||
      clipId.includes('dribble') ||
      clipId.includes('ball');
    if (isBallClip) {
      matchBall.position.set(rx + Math.sin(ryaw) * 0.36, 0.115, rz + Math.cos(ryaw) * 0.36);
    } else {
      matchBall.position.set(0.36, 0.115, 8.42);
    }

    if (cameraMode !== 'free') {
      if (cameraMode === 'ankle') {
        desiredCamTarget.set(rx + 0.04, 0.48, rz + 0.10);
        desiredCamPos.set(rx + 1.95, 0.84, rz + 1.95);
      } else if (cameraMode === 'topdown') {
        desiredCamTarget.set(rx, 0.4, rz);
        desiredCamPos.set(rx + 0.02, 11.5, rz + 0.8);
      } else if (cameraMode === 'pedri') {
        desiredCamTarget.set(rx + Math.sin(ryaw) * 2.2, 0.95, rz + Math.cos(ryaw) * 2.2);
        desiredCamPos.set(rx - Math.sin(ryaw) * 3.4, 1.85, rz - Math.cos(ryaw) * 3.4);
      } else {
        desiredCamTarget.set(rx, 0.92, rz);
        desiredCamPos.set(rx + 2.85, 1.72, rz + 3.15);
      }
      applyCameraSmoothing(34);
    }
    return;
  }

  // Mode B: 18 Canonical Zhibo8 Scenarios OR Dynamic Full-Match Slice — Multi-Clip C2-Inertialized Assembled Sequences
  let sc = getCurrentScenario();
  let dur = sc.durationSec;

  const videoReady = zhibo8ClipEl.style.display !== 'none' && zhibo8ClipEl.readyState >= 2;
  if (activeDynamicScenario) {
    if (syncVideoTo3D && videoReady && isPlaying && !zhibo8ClipEl.paused) {
      if (activeDynamicVideoRange) {
        currentSec = clamp(zhibo8ClipEl.currentTime - activeDynamicVideoRange.start, 0, dur);
      } else if (zhibo8ClipEl.duration > 0.1) {
        currentSec = clamp((zhibo8ClipEl.currentTime / zhibo8ClipEl.duration) * dur, 0, dur);
      }
    } else if (isPlaying && dt > 0) {
      currentSec = (currentSec + dt * playbackSpeed) % dur;
    }
  } else if (syncVideoTo3D && videoReady && (activeVideoSource === 'zhibo8' || activeVideoSource === 'reel')) {
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

  const evalState = evaluateScenarioAtTime(sc, currentSec, getHeroRigContext());

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

  if (pedriState && pedriState.activeSegmentIndex !== undefined) {
    highlightActiveAssemblyNode(pedriState.activeSegmentIndex);
  }

  if (pedriModel) {
    updateRigTelemetryUI(pedriModel);
    if (hudMocapBadgeEl) {
      const syncTag = activeDynamicScenario
        ? `整场切片重演 (${currentSec.toFixed(2)}s)`
        : syncVideoTo3D && videoReady && activeSubClipIndex === 0
        ? `视频 1:1 锁定 (${currentSec.toFixed(2)}s)`
        : `时间轴 (${currentSec.toFixed(2)}s)`;
      hudMocapBadgeEl.textContent = `${pedriModel.activeMocapDebug} · ${syncTag}`;
    }
  }

  const pressPct = Math.round(clamp((1 - (minDefDist - 0.9) / 6.5) * 100, 8, 98));
  const decepRaw = pedriState
    ? Math.max(
        Math.abs(pedriState.leanRoll || 0) * 3.4,
        pedriState.crouch || 0,
        pedriState.blendWeight || 0,
        pedriState.ballTouch ? pedriState.ballTouch.weight * 0.92 : 0.35
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
    if (sc._fullMatchSlice && pedriState) {
      const sideSign = pedriState.x > 12 ? -1 : 1;
      const tx = lerp(c.target[0], pedriState.x, 0.78);
      const tz = lerp(c.target[2], pedriState.z, 0.78);
      desiredCamTarget.set(tx, 0.92, tz);
      desiredCamPos.set(tx + sideSign * 9.6, 3.15, tz + 2.75);
      applyCameraSmoothing(26);
    } else {
      desiredCamPos.set(c.pos[0], c.pos[1], c.pos[2]);
      desiredCamTarget.set(c.target[0], c.target[1], c.target[2]);
      applyCameraSmoothing(c.fov || 35);
    }
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
    const ballDist = Math.hypot(
      matchBall.position.x - pedriState.x,
      matchBall.position.z - pedriState.z
    );
    const wBall = ballDist < 2.4 ? 0.35 * (1 - ballDist / 2.4) : 0;
    const sideSign = pedriState.x < -12 ? 1 : pedriState.x > 16 ? -1 : 1;
    desiredCamTarget.set(
      lerp(pedriState.x, matchBall.position.x, wBall),
      0.68,
      lerp(pedriState.z, matchBall.position.z, wBall)
    );
    desiredCamPos.set(pedriState.x + sideSign * 2.65, 1.06, pedriState.z + 1.65);
    applyCameraSmoothing(35);
  } else if (cameraMode === 'topdown' && pedriState) {
    desiredCamTarget.set(pedriState.x, 0.2, pedriState.z);
    desiredCamPos.set(pedriState.x + 0.5, 23.5, pedriState.z + 0.01);
    applyCameraSmoothing(40);
  }
}

function extractActorBiomechanics(playerModel, ballVec) {
  if (!playerModel || !playerModel.boneNodes) return null;
  playerModel.root.computeWorldMatrix(true);
  playerModel.posePivot.computeWorldMatrix(true);
  if (playerModel.gltfRoot) playerModel.gltfRoot.computeWorldMatrix(true);
  const bn = playerModel.boneNodes;
  for (const tn of bn.values()) tn.computeWorldMatrix(true);

  const posOf = (n) => {
    const node = bn.get(n);
    if (!node) return null;
    const p = node.getAbsolutePosition();
    return [Number(p.x.toFixed(4)), Number(p.y.toFixed(4)), Number(p.z.toFixed(4))];
  };
  const hipsP = posOf('mixamorig:Hips');
  const neckP = posOf('mixamorig:Neck');
  const headP = posOf('mixamorig:Head');
  const lFootP = posOf('mixamorig:LeftFoot');
  const lToeP = posOf('mixamorig:LeftToeBase');
  const rFootP = posOf('mixamorig:RightFoot');
  const rToeP = posOf('mixamorig:RightToeBase');
  const ballP = [
    Number(ballVec.x.toFixed(4)),
    Number(ballVec.y.toFixed(4)),
    Number(ballVec.z.toFixed(4))
  ];
  const unitY = (a, b) => {
    if (!a || !b) return 0;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    return Number((dy / len).toFixed(4));
  };
  const dist3 = (a, b) =>
    a && b ? Number(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(4)) : 99;

  return {
    rootPos: [
      Number(playerModel.root.position.x.toFixed(4)),
      Number(playerModel.root.position.y.toFixed(4)),
      Number(playerModel.root.position.z.toFixed(4))
    ],
    rootYaw: Number(playerModel.root.rotation.y.toFixed(4)),
    hipsPos: hipsP,
    neckPos: neckP,
    headPos: headP,
    spineUpDot: unitY(hipsP, neckP),
    lFootPos: lFootP,
    rFootPos: rFootP,
    lToePos: lToeP,
    rToePos: rToeP,
    lToeSlopeY: unitY(lFootP, lToeP),
    rToeSlopeY: unitY(rFootP, rToeP),
    plantedFeet: playerModel.telemetry?.plantedFeet || '',
    ballPos: ballP,
    minFootToBallDist: Math.min(
      dist3(lFootP, ballP),
      dist3(rFootP, ballP),
      dist3(lToeP, ballP),
      dist3(rToeP, ballP)
    ),
    activeMocapDebug: playerModel.activeMocapDebug || ''
  };
}

function auditScenarioObjectContinuity(sc, stepSec = 0.04) {
  const heroIdx = activeActors.findIndex((a) => isHeroRole(a.def.role));
  const heroObj = heroIdx >= 0 ? activeActors[heroIdx] : activeActors[0];
  if (!heroObj) return null;

  const rigCtx = getHeroRigContext();
  const dur = sc.durationSec;
  const steps = Math.max(2, Math.floor(dur / stepSec));

  let prevBio = null;
  let maxRootStepMeters = 0;
  let maxPelvisStepMeters = 0;
  let maxFootStepMeters = 0;
  let minHipsY = 99;
  let maxHipsY = -99;
  let minSpineUpDot = 1.0;

  const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let compiledSeq = null;

  for (let i = 0; i <= steps; i++) {
    const t = Math.min(dur, Number((i * stepSec).toFixed(4)));
    const evalSt = evaluateScenarioAtTime(sc, t, rigCtx);
    const st = evalSt.actorStates[heroIdx >= 0 ? heroIdx : 0];
    if (st.compiledSequence) compiledSeq = st.compiledSequence;
    updateBabylonPlayerPose(heroObj.model, st, overlaysConfig);
    const bio = extractActorBiomechanics(heroObj.model, matchBall.position);
    if (!bio) continue;

    minHipsY = Math.min(minHipsY, bio.hipsPos[1]);
    maxHipsY = Math.max(maxHipsY, bio.hipsPos[1]);
    minSpineUpDot = Math.min(minSpineUpDot, bio.spineUpDot);

    if (prevBio) {
      const rootStep = dist3(bio.rootPos, prevBio.rootPos);
      const pelvisStep = dist3(bio.hipsPos, prevBio.hipsPos);
      const lFootStep = dist3(bio.lFootPos, prevBio.lFootPos);
      const rFootStep = dist3(bio.rFootPos, prevBio.rFootPos);
      maxRootStepMeters = Math.max(maxRootStepMeters, rootStep);
      maxPelvisStepMeters = Math.max(maxPelvisStepMeters, pelvisStep);
      maxFootStepMeters = Math.max(maxFootStepMeters, lFootStep, rFootStep);
    }
    prevBio = bio;
  }

  const seamRecords = [];
  if (compiledSeq && compiledSeq.segments) {
    for (let sIdx = 1; sIdx < compiledSeq.segments.length; sIdx++) {
      const seg = compiledSeq.segments[sIdx];
      const tA = Math.max(0, seg.tStart - 0.015);
      const tB = Math.min(dur, seg.tStart + 0.015);

      const stA = evaluateScenarioAtTime(sc, tA, rigCtx).actorStates[heroIdx >= 0 ? heroIdx : 0];
      updateBabylonPlayerPose(heroObj.model, stA, overlaysConfig);
      const bioA = extractActorBiomechanics(heroObj.model, matchBall.position);

      const stB = evaluateScenarioAtTime(sc, tB, rigCtx).actorStates[heroIdx >= 0 ? heroIdx : 0];
      updateBabylonPlayerPose(heroObj.model, stB, overlaysConfig);
      const bioB = extractActorBiomechanics(heroObj.model, matchBall.position);

      seamRecords.push({
        seamIdx: sIdx,
        tSeam: Number(seg.tStart.toFixed(3)),
        fromClip: compiledSeq.segments[sIdx - 1].clipId,
        toClip: seg.clipId,
        pelvisStep30ms: Number(dist3(bioA.hipsPos, bioB.hipsPos).toFixed(4)),
        headStep30ms: Number(dist3(bioA.headPos, bioB.headPos).toFixed(4)),
        lFootStep30ms: Number(dist3(bioA.lFootPos, bioB.lFootPos).toFixed(4)),
        rFootStep30ms: Number(dist3(bioA.rFootPos, bioB.rFootPos).toFixed(4))
      });
    }
  }

  return {
    scenario: sc.id,
    segmentCount: compiledSeq ? compiledSeq.segments.length : 0,
    stepSec,
    maxRootStepMeters: Number(maxRootStepMeters.toFixed(4)),
    maxPelvisStepMeters: Number(maxPelvisStepMeters.toFixed(4)),
    maxFootStepMeters: Number(maxFootStepMeters.toFixed(4)),
    minHipsY: Number(minHipsY.toFixed(4)),
    maxHipsY: Number(maxHipsY.toFixed(4)),
    minSpineUpDot: Number(minSpineUpDot.toFixed(4)),
    seamRecords
  };
}

// 11. Initialize Full-Match Breakdown Workspace & Topbar Mode Switcher
const fullMatchCtrl = initFullMatchWorkspace({
  containerEl: fullMatchWorkspaceEl,
  topActionsEl: fullMatchTopActionsEl,
  onInspectSliceIn3D: (slice, matchMeta) => {
    loadDynamicFullMatchSlice(slice, matchMeta);
  }
});

function setWorkspaceMode(mode) {
  const nextMode = mode === 'fullmatch' ? 'fullmatch' : '3d';
  workspaceMode = nextMode;

  studioShellEl.classList.toggle('mode-fullmatch', nextMode === 'fullmatch');
  if (btnWorkspace3DEl) btnWorkspace3DEl.classList.toggle('active', nextMode === '3d');
  if (btnWorkspaceFullMatchEl) btnWorkspaceFullMatchEl.classList.toggle('active', nextMode === 'fullmatch');

  if (nextMode === 'fullmatch') {
    zhibo8ClipEl.pause();
    localVideoEl.pause();
    fullMatchCtrl.onShow();
  } else {
    fullMatchCtrl.onHide();
    snapCameraNextFrame = true;
    engine.resize();
    syncVideoPlayState();
  }
  return workspaceMode;
}

if (btnWorkspace3DEl) {
  btnWorkspace3DEl.addEventListener('click', () => setWorkspaceMode('3d'));
}
if (btnWorkspaceFullMatchEl) {
  btnWorkspaceFullMatchEl.addEventListener('click', () => setWorkspaceMode('fullmatch'));
}
if (btnReturnFullMatchEl) {
  btnReturnFullMatchEl.addEventListener('click', () => setWorkspaceMode('fullmatch'));
}

// 12. Boot Studio & Expose Deterministic Visual & Continuity QA API
buildScenarioSidebar();
loadScenario(0);
updatePlayButtonLabel();

let lastFrameMs = performance.now();
engine.runRenderLoop(() => {
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.05);
  lastFrameMs = nowMs;
  if (workspaceMode === 'fullmatch') return;
  evaluateFrame(dt);
  scene.render();
});

window.__STUDIO_DEBUG__ = {
  waitReady: () => rigReadyPromise,
  isReady: () => rigLoaded,
  getScenarioCount: () => SCENARIOS.length,
  getAtomicCatalog: () => SOCCER_ATOMIC_CATALOG,
  pauseRenderLoop: () => engine.stopRenderLoop(),
  setWorkspaceMode: (mode) => setWorkspaceMode(mode),
  getWorkspaceMode: () => workspaceMode,
  getFullMatchSummary: () => fullMatchCtrl.getSummary(),
  getFullMatchAnalytics: () => fullMatchCtrl.getAnalytics(),
  selectFullMatch: (matchId) => fullMatchCtrl.selectMatch(matchId),
  filterFullMatch: (filters) => fullMatchCtrl.setFilters(filters),
  setFullMatchGroupBy: (grp) => fullMatchCtrl.setGroupBy(grp),
  setFullMatchStageMode: (mode) => fullMatchCtrl.setStageMode(mode),
  stepFullMatchSlice: (delta) => fullMatchCtrl.stepSlice(delta),
  toggleFullMatchPlaylist: (val) => fullMatchCtrl.togglePlaylistMode(val),
  toggleFullMatchStar: (sliceId) => fullMatchCtrl.toggleSliceStar(sliceId),
  setFullMatchMinuteRange: (range) => fullMatchCtrl.setMinuteRange(range),
  setFullMatch360Zoom: (val) => fullMatchCtrl.set360Zoom(val),
  setFullMatchDiagDock: (val) => fullMatchCtrl.setDiagCompactDock(val),
  getFullMatchOrderedTeams: () => fullMatchCtrl.getOrderedTeamTabs(),
  trimFullMatchSlice: (d0, d1) => fullMatchCtrl.trimActiveSlice(d0, d1),
  createManualFullMatchSlice: () => fullMatchCtrl.createManualSliceAtCurrentTime(),
  deleteActiveFullMatchSlice: () => fullMatchCtrl.deleteActiveSlice(),
  setSplitLayout: (split) => applySplitLayout(split),
  setWhiteBoxMode: (enabled) => setStudioWhiteBoxMode(enabled),
  setPositionFilter: (pos, autoSelectFirst = false) => setPositionFilter(pos, autoSelectFirst),
  setOverlays: (cfg) => {
    if (cfg.whiteBoxMode !== undefined) setStudioWhiteBoxMode(cfg.whiteBoxMode);
    Object.assign(overlaysConfig, cfg);
    setSkeletonXray(overlaysConfig.showSkeleton);
  },
  async inspectFullMatchSliceIn3D(matchId, sliceIdx = 0, sec = 1.6, camMode = 'broadcast') {
    await rigReadyPromise;
    fullMatchCtrl.selectMatch(matchId);
    const match = fullMatchCtrl.getMatchById(matchId);
    if (!match || !match.slices[sliceIdx]) {
      throw new Error(`Slice not found: ${matchId}[${sliceIdx}]`);
    }
    const slice = match.slices[sliceIdx];
    const dynSc = loadDynamicFullMatchSlice(slice, match);

    if (splitLayout && zhibo8ClipEl.src) {
      await new Promise((resolve) => {
        if (zhibo8ClipEl.readyState >= 2) return resolve();
        zhibo8ClipEl.addEventListener('loadeddata', resolve, { once: true });
        setTimeout(resolve, 1800);
      });
    }

    const continuity = auditScenarioObjectContinuity(dynSc, 0.04);
    seekToSecond(sec, true);
    setCameraMode(camMode, false);
    snapCameraNextFrame = true;

    evaluateFrame(0);
    await scene.whenReadyAsync(true);
    scene.render();
    scene.render();

    const heroObj = activeActors.find((a) => isHeroRole(a.def.role));
    const biomechanics = heroObj ? extractActorBiomechanics(heroObj.model, matchBall.position) : null;

    return {
      sliceId: slice.id,
      escapeOutcome: slice.escapeOutcome,
      pressType: slice.pressType,
      pitchZone: slice.pitchZone,
      dynScenarioId: dynSc.id,
      actorCount: activeActors.length,
      currentSec,
      whiteBoxMode: overlaysConfig.whiteBoxMode,
      pedriTelemetry: heroObj ? heroObj.model.telemetry : null,
      biomechanics,
      continuity
    };
  },
  async inspectScenario(scenarioIdx, sec, camMode = 'broadcast', customCam = null, showXray = false) {
    await rigReadyPromise;
    if (workspaceMode !== '3d') {
      setWorkspaceMode('3d');
    }
    if (activeMocapMode !== 'tactical') {
      setMocapMode('tactical');
    }
    if (activeDynamicScenario || activeScenarioIndex !== scenarioIdx) {
      loadScenario(scenarioIdx);
    }
    setSkeletonXray(showXray);

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
    const biomechanics = heroObj ? extractActorBiomechanics(heroObj.model, matchBall.position) : null;

    return {
      scenario: SCENARIOS[activeScenarioIndex].id,
      positionGroup: SCENARIOS[activeScenarioIndex].positionGroup,
      starName: SCENARIOS[activeScenarioIndex].starName,
      whiteBoxMode: overlaysConfig.whiteBoxMode,
      currentSec,
      videoTime: zhibo8ClipEl.currentTime,
      actorCount: activeActors.length,
      pedriTelemetry: heroObj ? heroObj.model.telemetry : null,
      biomechanics
    };
  },
  async inspectAtomicClip(
    clipId,
    sec,
    useRootMotion = true,
    customCam = null,
    showXray = false,
    showLabels = false
  ) {
    await rigReadyPromise;
    if (workspaceMode !== '3d') {
      setWorkspaceMode('3d');
    }
    showcaseRootMotion = Boolean(useRootMotion);
    setMocapMode(`atomic:${clipId}`);
    setSkeletonXray(showXray);
    overlaysConfig.showLabels = showLabels;
    seekToSecond(sec, true);

    evaluateFrame(0);

    if (customCam) {
      setCameraMode('free', false);
      freeCamera.fov = ((customCam.fovDeg || 30) * Math.PI) / 180;
      const rx = showcasePedriActor ? showcasePedriActor.root.position.x : 0;
      const rz = showcasePedriActor ? showcasePedriActor.root.position.z : 8.0;
      if (customCam.trackRoot) {
        freeCamera.setTarget(new BABYLON.Vector3(rx + customCam.targetOffset[0], customCam.targetOffset[1], rz + customCam.targetOffset[2]));
        freeCamera.setPosition(new BABYLON.Vector3(rx + customCam.posOffset[0], customCam.posOffset[1], rz + customCam.posOffset[2]));
      } else {
        freeCamera.setTarget(new BABYLON.Vector3(...customCam.target));
        freeCamera.setPosition(new BABYLON.Vector3(...customCam.pos));
      }
    } else {
      setCameraMode('broadcast', false);
      snapCameraNextFrame = true;
    }

    evaluateFrame(0);
    await scene.whenReadyAsync(true);
    scene.render();
    scene.render();

    const biomechanics = showcasePedriActor
      ? extractActorBiomechanics(showcasePedriActor, matchBall.position)
      : null;

    return {
      clipId,
      currentSec,
      useRootMotion: showcaseRootMotion,
      whiteBoxMode: overlaysConfig.whiteBoxMode,
      telemetry: showcasePedriActor ? showcasePedriActor.telemetry : null,
      biomechanics
    };
  },
  async inspectMocapClip(clipId, sec, customCam = null, showXray = false, showLabels = false) {
    return this.inspectAtomicClip(clipId, sec, true, customCam, showXray, showLabels);
  },
  async auditSequenceContinuity(scenarioIdx, stepSec = 0.04) {
    await rigReadyPromise;
    if (workspaceMode !== '3d') setWorkspaceMode('3d');
    if (activeMocapMode !== 'tactical') setMocapMode('tactical');
    if (activeDynamicScenario || activeScenarioIndex !== scenarioIdx) loadScenario(scenarioIdx);
    return auditScenarioObjectContinuity(SCENARIOS[scenarioIdx], stepSec);
  }
};
