import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPitchEnvironment, createMatchBall } from './pitch.js';
import {
  preloadAthleteRig,
  attachRiggedSkinnedModel,
  createArticulatedPlayer,
  updatePlayerPose,
  createTrajectoryRibbon
} from './player3d.js';
import {
  CMU_SOCCER_MOCAPS,
  loadCmuSoccerBvh,
  evaluateCmuMocapOnPlayer
} from './mocapBvh.js';
import { SCENARIOS, sampleTrack } from './scenarios.js';
import { SCENARIO_VIDEOS, MASTER_ZHIBO8_REEL } from './videos.js';

const container = document.getElementById('three-canvas-container');
const viewportStageEl = document.getElementById('viewport-stage');

// 1. Initialize Three.js WebGLRenderer, Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090f16);
scene.fog = new THREE.FogExp2(0x090f16, 0.0085);

const camera = new THREE.PerspectiveCamera(
  44,
  Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
  0.15,
  200
);
camera.position.set(0, 14, 24);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 1.6;
controls.maxDistance = 58;

renderer.domElement.addEventListener('pointerdown', () => {
  if (cameraMode !== 'free') {
    setCameraMode('free', false);
  }
});

const resizeObserver = new ResizeObserver(() => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
});
resizeObserver.observe(container);

// 2. Build Pitch & Match Ball
createPitchEnvironment(scene);
const matchBall = createMatchBall();
scene.add(matchBall);

const scenarioGroup = new THREE.Group();
scene.add(scenarioGroup);

const cmuMocapGroup = new THREE.Group();
cmuMocapGroup.visible = false;
scene.add(cmuMocapGroup);

let activeScenarioIndex = 0;
let activeActors = [];
let activeRibbons = [];

// Playback, Mocap Mode, Video Deck & Overlay State
let isPlaying = true;
let playbackSpeed = 0.5;
let timelineT = 0.0;
const LOOP_DURATION_SEC = 6.2;
let cameraMode = 'broadcast';
let splitLayout = true;
let activeVideoSource = 'zhibo8';
let activeSubClipIndex = 0;
let syncVideoTo3D = true;
let activeMocapMode = 'tactical'; // 'tactical' | 'cmu-10-01' | 'cmu-10-05' | 'cmu-11-01'
let activeCmuBvhData = null;
let cmuPedriActor = null;

const overlaysConfig = {
  showSkeleton: false,
  showScan: true,
  showCoverShadow: true,
  showTrajectories: true,
  showLabels: true
};

// UI References
const scenarioListEl = document.getElementById('scenario-list');
const phaseBadgeEl = document.getElementById('live-phase-badge');
const matchSourceEl = document.getElementById('live-match-source');
const phaseDescEl = document.getElementById('live-phase-desc');
const phaseButtonsContainer = document.getElementById('phase-pills-row');
const playBtnEl = document.getElementById('btn-play-toggle');
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

// Preload 67-bone Mixamo SkinnedMesh GLB & upgrade all actors as soon as ready
preloadAthleteRig().then((gltf) => {
  activeActors.forEach((a) => {
    attachRiggedSkinnedModel(a.model, gltf);
    if (a.model.skeletonHelper && !a.model.skeletonHelper.parent) {
      scenarioGroup.add(a.model.skeletonHelper);
    }
  });
  if (cmuPedriActor) {
    attachRiggedSkinnedModel(cmuPedriActor, gltf);
    if (cmuPedriActor.skeletonHelper && !cmuPedriActor.skeletonHelper.parent) {
      cmuMocapGroup.add(cmuPedriActor.skeletonHelper);
    }
  }
  if (activeMocapMode === 'tactical') {
    matchSourceEl.textContent = SCENARIOS[activeScenarioIndex].matchRef;
  }
});

// 3. Real Video Deck Controller (Zhibo8 Clipped MP4s + Master Reel + Bilibili + YouTube + Local)
function loadZhibo8ClipElement(srcUrl, titleText, dlFilename, pageUrl) {
  zhibo8ClipEl.style.display = 'block';
  videoIframeEl.style.display = 'none';
  videoIframeEl.src = 'about:blank';
  localVideoBoxEl.style.display = 'none';

  if (zhibo8ClipEl.getAttribute('data-cur-src') !== srcUrl) {
    zhibo8ClipEl.setAttribute('data-cur-src', srcUrl);
    zhibo8ClipEl.src = srcUrl;
    zhibo8ClipEl.load();
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

  // Render sub-clip selector buttons when in 'zhibo8' mode
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
        updateRealVideoDeck();
      });
      zhibo8SubclipsBtnsEl.appendChild(cBtn);
    });

    const curClip = clips[activeSubClipIndex];
    if (curClip) {
      loadZhibo8ClipElement(curClip.src, curClip.title, curClip.filename, curClip.pageUrl);
    }
    return;
  }

  if (activeVideoSource === 'reel') {
    zhibo8SubclipsBarEl.style.display = 'flex';
    zhibo8SubclipsBtnsEl.innerHTML = '<span style="font-size:11px;color:var(--accent-gold);font-weight:600;">已加载 8 大场景直播吧回放连播合集</span>';
    loadZhibo8ClipElement(
      MASTER_ZHIBO8_REEL.src,
      MASTER_ZHIBO8_REEL.title,
      MASTER_ZHIBO8_REEL.filename,
      MASTER_ZHIBO8_REEL.sourceUrl
    );
    return;
  }

  // Hide Zhibo8 native video & subclip bar for external/local modes
  zhibo8SubclipsBarEl.style.display = 'none';
  zhibo8ClipEl.pause();
  zhibo8ClipEl.style.display = 'none';
  downloadZhibo8Mp4El.style.display = 'none';

  if (activeVideoSource === 'local') {
    videoIframeEl.style.display = 'none';
    videoIframeEl.src = 'about:blank';
    localVideoBoxEl.style.display = 'flex';
    videoNowTitleEl.textContent = '本地实况视频 × 67骨骼模型同步慢放对比';
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

btnLayoutSplit.addEventListener('click', () => {
  splitLayout = !splitLayout;
  btnLayoutSplit.classList.toggle('active', splitLayout);
  btnLayoutSplit.textContent = splitLayout ? '实况视频+3D同屏' : '开启实况视频同屏';
  viewportStageEl.classList.toggle('split-mode', splitLayout);
  viewportStageEl.classList.toggle('full3d-mode', !splitLayout);
});

// 4. Switch Between Tactical 67-Bone + IK Mode vs CMU 120Hz Optical Mocap BVH Mode
async function setMocapMode(mode) {
  activeMocapMode = mode;
  mocapModeSelectEl.value = mode;
  timelineT = 0.0;

  if (mode === 'tactical') {
    cmuMocapGroup.visible = false;
    scenarioGroup.visible = true;
    loadScenario(activeScenarioIndex);
    return;
  }

  // Activate CMU 120Hz Optical Soccer Mocap Showcase
  scenarioGroup.visible = false;
  cmuMocapGroup.visible = true;
  clearGroup(cmuMocapGroup);

  const meta = CMU_SOCCER_MOCAPS.find((m) => m.id === mode);
  if (!meta) return;

  phaseBadgeEl.textContent = '120Hz 光学动捕加载中';
  phaseDescEl.textContent = `正在加载卡内基梅隆大学 (CMU) 120 FPS 光学动捕实验室原始骨骼序列：${meta.label}...`;

  cmuPedriActor = createArticulatedPlayer({
    role: 'pedri',
    number: '8',
    label: '#8 佩德里 (120Hz 动捕映射)'
  });
  cmuMocapGroup.add(cmuPedriActor.root);
  if (cmuPedriActor.skeletonHelper) {
    cmuMocapGroup.add(cmuPedriActor.skeletonHelper);
  }

  try {
    const bvhData = await loadCmuSoccerBvh(meta.url);
    activeCmuBvhData = { meta, bvhData };

    cmuMocapGroup.add(bvhData.rootContainer);
    cmuMocapGroup.add(bvhData.helper);

    matchSourceEl.textContent = `CMU Graphics Lab · 120 FPS Optical BVH (${meta.id.toUpperCase()})`;
    inspEyebrowEl.textContent = 'OPTICAL MOTION CAPTURE · 120 HZ';
    inspTitleEl.textContent = meta.label;
    inspMoveEl.textContent = '23光学关节全身重定向 → Mixamo 67骨骼 SkinnedMesh';
    inspPressureEl.textContent = '右侧青绿线框为原始 120Hz 光学动捕骨骼，左侧为实时重定向蒙皮球员';
  } catch (err) {
    console.error('BVH load error:', err);
  }
}

mocapModeSelectEl.addEventListener('change', (e) => {
  setMocapMode(e.target.value);
});

// 5. Render Sidebar Scenario List
function buildScenarioSidebar() {
  scenarioListEl.innerHTML = '';
  SCENARIOS.forEach((sc, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = `scenario-btn-${sc.index}`;
    btn.className = `scenario-item${idx === activeScenarioIndex ? ' active' : ''}`;
    btn.innerHTML = `
      <div class="scenario-item-top">
        <span class="scenario-index">SCENARIO ${sc.index}</span>
        <span class="scenario-zone-tag">${sc.zoneTag}</span>
      </div>
      <div class="scenario-item-title">${sc.title}</div>
      <div class="scenario-item-move">${sc.moveName}</div>
    `;
    btn.addEventListener('click', () => {
      if (activeMocapMode !== 'tactical') {
        activeMocapMode = 'tactical';
        mocapModeSelectEl.value = 'tactical';
        cmuMocapGroup.visible = false;
        scenarioGroup.visible = true;
      }
      loadScenario(idx);
    });
    scenarioListEl.appendChild(btn);
  });
}

// 6. Load Selected Scenario into Three.js Scene + Sync Video Deck
function clearGroup(group) {
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

function loadScenario(index) {
  activeScenarioIndex = index;
  activeSubClipIndex = 0;
  timelineT = 0.0;
  const sc = SCENARIOS[index];

  document.querySelectorAll('.scenario-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  clearGroup(scenarioGroup);
  activeActors = sc.actors.map((actorDef) => {
    const model = createArticulatedPlayer(actorDef);
    scenarioGroup.add(model.root);
    if (model.skeletonHelper) {
      scenarioGroup.add(model.skeletonHelper);
    }
    return { def: actorDef, model };
  });

  activeRibbons = [];
  const pedriTube = createTrajectoryRibbon(sc.pedriRibbon, 0xfacc15, 0.065, 0.78);
  if (pedriTube) {
    scenarioGroup.add(pedriTube);
    activeRibbons.push(pedriTube);
  }
  const defOvershootTube = createTrajectoryRibbon(sc.overshootRibbon, 0xf87171, 0.05, 0.55);
  if (defOvershootTube) {
    scenarioGroup.add(defOvershootTube);
    activeRibbons.push(defOvershootTube);
  }

  inspEyebrowEl.textContent = `SCENARIO ${sc.index} · ${sc.zoneTag}`;
  inspTitleEl.textContent = sc.title;
  inspMoveEl.textContent = sc.moveName;
  inspPressureEl.textContent = `逼抢类型：${sc.pressureType}`;

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
      timelineT = ph.range[0] + 0.02;
      isPlaying = false;
      if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel') && syncVideoTo3D && zhibo8ClipEl.duration) {
        zhibo8ClipEl.currentTime = timelineT * zhibo8ClipEl.duration;
      }
      if (activeVideoSource === 'local' && localVideoEl.duration) {
        localVideoEl.currentTime = timelineT * localVideoEl.duration;
      }
      syncLocalVideoPlayState();
      updatePlayButtonLabel();
    });
    phaseButtonsContainer.appendChild(pBtn);
  });

  const [fx, fy, fz] = sc.defaultFocus;
  if (cameraMode === 'free') {
    controls.target.set(fx, fy + 0.85, fz);
    camera.position.set(fx + 9.5, 9.5, fz + 13.5);
  }

  updateRealVideoDeck();
}

// 7. Camera Mode Controller (Now includes Ankle & Ball Close-Up Camera!)
const desiredCamPos = new THREE.Vector3();
const desiredCamTarget = new THREE.Vector3();

function setCameraMode(mode, resetView = true) {
  cameraMode = mode;
  document.querySelectorAll('.cam-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === mode);
  });
  controls.enabled = mode === 'free';
  if (mode === 'free' && resetView) {
    const [fx, fy, fz] = SCENARIOS[activeScenarioIndex].defaultFocus;
    controls.target.set(fx, fy + 0.9, fz);
  }
}

document.querySelectorAll('.cam-btn').forEach((btn) => {
  btn.addEventListener('click', () => setCameraMode(btn.dataset.cam, true));
});

// 8. Playback & X-Ray Skeleton Overlay Controls
function syncLocalVideoPlayState() {
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

playBtnEl.addEventListener('click', () => {
  isPlaying = !isPlaying;
  syncLocalVideoPlayState();
  updatePlayButtonLabel();
});

sliderEl.addEventListener('input', (e) => {
  timelineT = parseFloat(e.target.value) / 1000;
  isPlaying = false;
  if ((activeVideoSource === 'zhibo8' || activeVideoSource === 'reel') && syncVideoTo3D && zhibo8ClipEl.duration) {
    zhibo8ClipEl.currentTime = timelineT * zhibo8ClipEl.duration;
  }
  if (activeVideoSource === 'local' && localVideoEl.duration) {
    localVideoEl.currentTime = timelineT * localVideoEl.duration;
  }
  syncLocalVideoPlayState();
  updatePlayButtonLabel();
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

function toggleSkeletonXray() {
  overlaysConfig.showSkeleton = !overlaysConfig.showSkeleton;
  btnXrayTopEl.classList.toggle('active', overlaysConfig.showSkeleton);
  btnToggleSkeletonEl.classList.toggle('active', overlaysConfig.showSkeleton);
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
  if (e.code === 'Space') {
    e.preventDefault();
    isPlaying = !isPlaying;
    syncLocalVideoPlayState();
    updatePlayButtonLabel();
  } else if (e.key >= '1' && e.key <= '8') {
    if (activeMocapMode !== 'tactical') setMocapMode('tactical');
    loadScenario(parseInt(e.key, 10) - 1);
  } else if (e.key.toLowerCase() === 'x') {
    toggleSkeletonXray();
  }
});

// 9. Frame Evaluation & Render Loop
const prevBallPos = new THREE.Vector3();
const clock = new THREE.Clock();

function updateRigTelemetryUI(playerModel) {
  if (!playerModel || !playerModel.telemetry) return;
  const tel = playerModel.telemetry;
  rigBoneCountEl.textContent = `${tel.boneCount} Bones · 28.3k Verts`;
  rigActiveClipEl.textContent = tel.activeClip;
  rigActiveFootEl.textContent = tel.activeFoot;
  rigJointAnglesEl.textContent = `Knee ${tel.kneeFlexDeg}° · Ankle ${tel.anklePitchDeg}°/${tel.ankleEversionDeg}°`;
}

function evaluateFrame(dt) {
  // Handle CMU 120Hz Optical Motion Capture Mode
  if (activeMocapMode !== 'tactical') {
    const dur = activeCmuBvhData ? activeCmuBvhData.bvhData.clip.duration : 6.0;
    if (isPlaying) {
      timelineT += (dt * playbackSpeed) / dur;
      if (timelineT > 1.0) timelineT -= 1.0;
    }
    sliderEl.value = Math.round(timelineT * 1000);
    timeReadoutEl.textContent = `${(timelineT * dur).toFixed(2)}s`;

    if (activeCmuBvhData && cmuPedriActor) {
      const info = evaluateCmuMocapOnPlayer(
        activeCmuBvhData.bvhData,
        cmuPedriActor,
        timelineT,
        overlaysConfig
      );
      if (info) {
        phaseBadgeEl.textContent = `120Hz 帧 ${info.frameIndex}/${info.totalFrames}`;
        phaseDescEl.textContent = `${activeCmuBvhData.meta.label} —— 全身 23 光学关节（含左右肩肘腕指、髋膝踝趾）实时驱动 67 骨骼蒙皮网格。按 [X] 键可开启 67 骨骼透视。`;

        // Animate match ball sitting at strike spot and blasting into top corner upon strikeNormT!
        const strikeT = activeCmuBvhData.meta.strikeNormT;
        if (timelineT < strikeT) {
          matchBall.position.set(0.15, 0.24, -0.35);
        } else {
          const u = (timelineT - strikeT) / (1.0 - strikeT);
          matchBall.position.set(
            0.15 - u * 3.8,
            0.24 + Math.sin(u * Math.PI) * 2.1,
            -0.35 - u * 26.5
          );
          matchBall.rotation.x -= dt * 18;
        }

        updateRigTelemetryUI(cmuPedriActor);

        if (cameraMode !== 'free') {
          const p = info.athletePos;
          if (cameraMode === 'ankle') {
            desiredCamTarget.set(p.x, 0.48, p.z);
            desiredCamPos.set(p.x + 2.1, 0.92, p.z + 2.35);
          } else {
            desiredCamTarget.set(p.x + 0.4, 0.95, p.z);
            desiredCamPos.set(p.x + 4.8, 2.6, p.z + 5.6);
          }
          camera.position.lerp(desiredCamPos, 0.08);
          controls.target.lerp(desiredCamTarget, 0.1);
          camera.lookAt(controls.target);
        } else {
          controls.update();
        }
      }
    }
    renderer.render(scene, camera);
    return;
  }

  // Standard 8 Tactical Scenarios Mode (67-Bone SkinnedMesh + Optical Mocap + Two-Bone Foot/Ankle/Arm IK)
  const sc = SCENARIOS[activeScenarioIndex];

  if (isPlaying) {
    timelineT += (dt * playbackSpeed) / LOOP_DURATION_SEC;
    if (timelineT > 1.0) timelineT -= 1.0;
  }

  sliderEl.value = Math.round(timelineT * 1000);
  timeReadoutEl.textContent = `${(timelineT * LOOP_DURATION_SEC).toFixed(1)}s`;

  let activePhaseIdx = 0;
  for (let i = 0; i < sc.phases.length; i++) {
    const [r0, r1] = sc.phases[i].range;
    if (timelineT >= r0 && timelineT <= r1) {
      activePhaseIdx = i;
      break;
    }
  }
  const ph = sc.phases[activePhaseIdx];
  phaseBadgeEl.textContent = ph.label;
  phaseDescEl.textContent = ph.desc;
  document.querySelectorAll('.phase-jump-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', idx === activePhaseIdx);
  });

  activeRibbons.forEach((r) => {
    r.visible = overlaysConfig.showTrajectories;
  });

  const ballState = sampleTrack(sc.ballTrack, timelineT);
  matchBall.position.set(ballState.x, ballState.y ?? 0.23, ballState.z);
  const ballMoveDist = Math.hypot(
    matchBall.position.x - prevBallPos.x,
    matchBall.position.z - prevBallPos.z
  );
  if (ballMoveDist > 0.001 && ballMoveDist < 2.0) {
    matchBall.rotation.x -= ballMoveDist * 3.4;
    matchBall.rotation.z += ballMoveDist * 1.9;
  }
  prevBallPos.copy(matchBall.position);

  let pedriPose = null;
  let pedriModel = null;
  let minDefDist = 99;
  let maxDeception = 0;
  const locoSec = timelineT * LOOP_DURATION_SEC;

  activeActors.forEach((actorObj, idx) => {
    const pose = sampleTrack(actorObj.def.keyframes, timelineT);
    pose.locomotionTime = locoSec + idx * 0.37;

    if (actorObj.def.role === 'pedri') {
      pedriPose = pose;
      pedriModel = actorObj.model;
      maxDeception = Math.max(
        Math.abs(pose.shoulderRoll) * 2.2,
        pose.fakeKick,
        pose.scanIntensity * 0.75,
        pose.crouch * 0.85
      );
    }
    actorObj._pose = pose;
  });

  activeActors.forEach((actorObj) => {
    const pose = actorObj._pose;
    if (actorObj.def.role === 'defender' && pedriPose) {
      const d = Math.hypot(pose.x - pedriPose.x, pose.z - pedriPose.z);
      if (d < minDefDist) minDefDist = d;
      pose.shadowYaw = Math.atan2(pedriPose.x - pose.x, pedriPose.z - pose.z);
    }
    updatePlayerPose(actorObj.model, pose, overlaysConfig, matchBall.position);
  });

  if (pedriModel) {
    updateRigTelemetryUI(pedriModel);
  }

  const pressPct = Math.round(Math.max(8, Math.min(98, (1 - (minDefDist - 1.0) / 6.5) * 100)));
  const decepPct = Math.round(Math.max(12, Math.min(99, maxDeception * 100)));
  const sepMeters = minDefDist < 50 ? minDefDist.toFixed(2) : '4.50';
  const sepPct = Math.round(Math.max(10, Math.min(100, (minDefDist / 5.5) * 100)));

  barPressIntensity.style.width = `${pressPct}%`;
  valPressIntensity.textContent = `${pressPct}%`;
  barDeception.style.width = `${decepPct}%`;
  valDeception.textContent = `${decepPct}%`;
  barSeparation.style.width = `${sepPct}%`;
  valSeparation.textContent = `${sepMeters} m`;

  const [fx, fy, fz] = sc.defaultFocus;
  if (cameraMode === 'broadcast' && pedriPose) {
    desiredCamTarget.set(
      THREE.MathUtils.lerp(fx, pedriPose.x, 0.55),
      0.88,
      THREE.MathUtils.lerp(fz, pedriPose.z, 0.55)
    );
    desiredCamPos.set(desiredCamTarget.x + 9.2, 8.8, desiredCamTarget.z + 12.6);
    camera.position.lerp(desiredCamPos, 0.06);
    controls.target.lerp(desiredCamTarget, 0.08);
    camera.lookAt(controls.target);
  } else if (cameraMode === 'pedri' && pedriPose) {
    const behindX = pedriPose.x - Math.sin(pedriPose.yaw) * 4.4;
    const behindZ = pedriPose.z - Math.cos(pedriPose.yaw) * 4.4;
    desiredCamPos.set(behindX, 2.35, behindZ);
    desiredCamTarget.set(
      pedriPose.x + Math.sin(pedriPose.yaw) * 3.8,
      1.05,
      pedriPose.z + Math.cos(pedriPose.yaw) * 3.8
    );
    camera.position.lerp(desiredCamPos, 0.08);
    controls.target.lerp(desiredCamTarget, 0.1);
    camera.lookAt(controls.target);
  } else if (cameraMode === 'ankle' && pedriPose) {
    // Low-angle Biomechanical Close-Up locked onto Pedri's Ankles, Knees, Forearms & Ball!
    desiredCamTarget.set(
      THREE.MathUtils.lerp(pedriPose.x, matchBall.position.x, 0.35),
      0.55,
      THREE.MathUtils.lerp(pedriPose.z, matchBall.position.z, 0.35)
    );
    desiredCamPos.set(pedriPose.x + 2.35, 1.18, pedriPose.z + 2.65);
    camera.position.lerp(desiredCamPos, 0.09);
    controls.target.lerp(desiredCamTarget, 0.12);
    camera.lookAt(controls.target);
  } else if (cameraMode === 'topdown' && pedriPose) {
    desiredCamTarget.set(
      THREE.MathUtils.lerp(fx, pedriPose.x, 0.35),
      0.2,
      THREE.MathUtils.lerp(fz, pedriPose.z, 0.35)
    );
    desiredCamPos.set(desiredCamTarget.x, 24.0, desiredCamTarget.z + 3.2);
    camera.position.lerp(desiredCamPos, 0.07);
    controls.target.lerp(desiredCamTarget, 0.09);
    camera.lookAt(controls.target);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  evaluateFrame(dt);
}

buildScenarioSidebar();
loadScenario(0);
setCameraMode('broadcast', true);
animate();
