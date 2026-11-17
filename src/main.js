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
import { MOCAP_CATALOG, getMocapClip, getMocapMeta } from './mocapLibrary.js';
import { SCENARIOS, evaluateScenarioAtTime } from './scenarios.js';
import { SCENARIO_VIDEOS, MASTER_ZHIBO8_REEL } from './videos.js';

const container = document.getElementById('three-canvas-container');
const viewportStageEl = document.getElementById('viewport-stage');

// 1. Initialize Three.js WebGLRenderer, Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090f16);
scene.fog = new THREE.FogExp2(0x090f16, 0.0075);

const camera = new THREE.PerspectiveCamera(
  35,
  Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
  0.15,
  200
);
camera.position.set(20, 9.5, 8);

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
controls.minDistance = 1.4;
controls.maxDistance = 58;
controls.enabled = false;

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

const mocapShowcaseGroup = new THREE.Group();
mocapShowcaseGroup.visible = false;
scene.add(mocapShowcaseGroup);

let activeScenarioIndex = 0;
let activeActors = [];
let activeRibbons = [];
let snapCameraNextFrame = true;

// Playback, Master Video Clock & Mocap Library State
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
  showLabels: true
};

// UI References
const scenarioListEl = document.getElementById('scenario-list');
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

// Populate 28-Clip Common Football Optical Mocap Library into #mocap-mode-select
function buildMocapLibrarySelector() {
  mocapModeSelectEl.innerHTML = '';

  const optTactical = document.createElement('option');
  optTactical.value = 'tactical';
  optTactical.textContent = '⚽ 实战视频 1:1 帧同步模式 (8大直播吧切片)';
  mocapModeSelectEl.appendChild(optTactical);

  const byCat = new Map();
  for (const item of MOCAP_CATALOG) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category).push(item);
  }

  for (const [catName, list] of byCat.entries()) {
    const grp = document.createElement('optgroup');
    grp.label = `公共光学动捕库 · ${catName} (${list.length}组)`;
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

// Preload Photorealistic 67-Bone Footballer GLB + Hair + All 28 Optical Mocap Clips
preloadAthleteRig((done, total, entry) => {
  if (hudMocapBadgeEl) {
    hudMocapBadgeEl.textContent = `HyperMotion 动作库加载中: ${done}/${total} (${entry.id})...`;
  }
}).then(() => {
  activeActors.forEach((a) => {
    attachRiggedSkinnedModel(a.model);
    if (a.model.skeletonHelper && !a.model.skeletonHelper.parent) {
      scenarioGroup.add(a.model.skeletonHelper);
    }
  });
  if (showcasePedriActor) {
    attachRiggedSkinnedModel(showcasePedriActor);
    if (showcasePedriActor.skeletonHelper && !showcasePedriActor.skeletonHelper.parent) {
      mocapShowcaseGroup.add(showcasePedriActor.skeletonHelper);
    }
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

// Keep 3D locked even when user scrubs native <video> controls directly!
zhibo8ClipEl.addEventListener('seeked', () => {
  if (!syncVideoTo3D || activeMocapMode !== 'tactical') return;
  if (activeVideoSource === 'zhibo8') {
    const sc = SCENARIOS[activeScenarioIndex];
    if (activeSubClipIndex === 0) {
      currentSec = THREE.MathUtils.clamp(zhibo8ClipEl.currentTime, 0, sc.durationSec);
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
      currentSec = THREE.MathUtils.clamp(reelTime - seg.start, 0, SCENARIOS[seg.scenarioIndex].durationSec);
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
      '<span style="font-size:11px;color:var(--accent-gold);font-weight:600;">55.5s 总集锦连播中 · 3D 场景将随视频自动切换 01→08 帧级联动</span>';
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

  // External / local video tabs
  zhibo8SubclipsBarEl.style.display = 'none';
  zhibo8ClipEl.pause();
  zhibo8ClipEl.style.display = 'none';
  downloadZhibo8Mp4El.style.display = 'none';

  if (activeVideoSource === 'local') {
    videoIframeEl.style.display = 'none';
    videoIframeEl.src = 'about:blank';
    localVideoBoxEl.style.display = 'flex';
    videoNowTitleEl.textContent = '本地实况视频 × 67骨写实球员同步慢放对比';
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

// 4. Switch Between 8-Scenario Video 1:1 Mode vs 28-Clip Public Optical Mocap Library Showcase
function setMocapMode(mode) {
  activeMocapMode = mode;
  mocapModeSelectEl.value = mode;
  currentSec = 0.0;
  snapCameraNextFrame = true;

  if (mode === 'tactical') {
    mocapShowcaseGroup.visible = false;
    scenarioGroup.visible = true;
    loadScenario(activeScenarioIndex);
    return;
  }

  // Atomic Mocap Library Clip Showcase ('lib:<clipId>')
  const clipId = mode.replace(/^lib:/, '');
  const meta = getMocapMeta(clipId);

  scenarioGroup.visible = false;
  mocapShowcaseGroup.visible = true;
  clearGroup(mocapShowcaseGroup);

  showcasePedriActor = createArticulatedPlayer({
    id: 'pedri_showcase',
    role: 'pedri',
    kit: 'barca-home',
    number: '8',
    shirtName: 'PEDRI',
    hairColor: '#231710',
    label: `#8 佩德里 · ${clipId}`
  });
  mocapShowcaseGroup.add(showcasePedriActor.root);
  if (showcasePedriActor.skeletonHelper) {
    mocapShowcaseGroup.add(showcasePedriActor.skeletonHelper);
  }

  matchSourceEl.textContent = `公共足球光学动作捕捉库 · ${meta.category} (${meta.file})`;
  inspEyebrowEl.textContent = `PUBLIC MOCAP LIBRARY · ${meta.category}`;
  inspTitleEl.textContent = meta.label;
  inspMoveEl.textContent = `动作资产 ID: ${meta.id} · 67骨骼四元数全身姿态曲线`;
  inspPressureEl.textContent = '提示：可切换「肩后 / 足踝特写 / 自由3D」或按 [X] 开启 67 骨骼透视逐帧检阅动作细节';
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
        mocapShowcaseGroup.visible = false;
        scenarioGroup.visible = true;
      }
      if (activeVideoSource === 'reel') {
        const seg = (MASTER_ZHIBO8_REEL.segments || []).find((s) => s.scenarioIndex === idx);
        loadScenario(idx, { preserveReelPlayback: true });
        if (seg && zhibo8ClipEl.readyState >= 1) {
          zhibo8ClipEl.currentTime = seg.start;
        }
        return;
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

function loadScenario(index, opts = {}) {
  activeScenarioIndex = index;
  if (!opts.preserveSubClip) {
    activeSubClipIndex = 0;
  }
  currentSec = 0.0;
  snapCameraNextFrame = true;
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
  const pedriTube = createTrajectoryRibbon(sc.pedriRibbon, 0xfacc15, 0.055, 0.76);
  if (pedriTube) {
    scenarioGroup.add(pedriTube);
    activeRibbons.push(pedriTube);
  }
  const defOvershootTube = createTrajectoryRibbon(sc.overshootRibbon, 0xf87171, 0.045, 0.52);
  if (defOvershootTube) {
    scenarioGroup.add(defOvershootTube);
    activeRibbons.push(defOvershootTube);
  }

  inspEyebrowEl.textContent = `SCENARIO ${sc.index} · ${sc.zoneTag}`;
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
    controls.target.set(fx, fy + 0.85, fz);
    camera.position.set(fx + 14.5, 8.8, fz + 4.5);
  }

  if (!opts.preserveReelPlayback) {
    updateRealVideoDeck();
  }
}

// 7. Camera Mode Controller
const desiredCamPos = new THREE.Vector3();
const desiredCamTarget = new THREE.Vector3();

function setCameraMode(mode, resetView = true) {
  cameraMode = mode;
  snapCameraNextFrame = true;
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

// 8. Bidirectional Master Clock Seeking & Frame-Stepping (±0.04s)
function getActiveDurationSec() {
  if (activeMocapMode !== 'tactical') {
    const clipId = activeMocapMode.replace(/^lib:/, '');
    const clip = getMocapClip(clipId);
    return clip ? Math.max(0.2, clip.duration) : 2.4;
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
        zhibo8ClipEl.currentTime = THREE.MathUtils.clamp(currentSec, 0, Math.max(0, zhibo8ClipEl.duration - 0.01));
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
const prevBallPos = new THREE.Vector3();
const clock = new THREE.Clock();

function updateRigTelemetryUI(playerModel) {
  if (!playerModel || !playerModel.telemetry) return;
  const tel = playerModel.telemetry;
  rigBoneCountEl.textContent = `${tel.boneCount} Bones (含30指节) · PBR人像`;
  rigActiveClipEl.textContent = tel.activeClip;
  rigActiveFootEl.textContent = tel.activeFoot;
  rigJointAnglesEl.textContent = `Knee ${tel.kneeFlexDeg}° · Ankle ${tel.anklePitchDeg}°/${tel.ankleEversionDeg}°`;
}

function applyCameraSmoothing(targetFov = 35) {
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = snapCameraNextFrame ? targetFov : THREE.MathUtils.lerp(camera.fov, targetFov, 0.12);
    camera.updateProjectionMatrix();
  }
  if (snapCameraNextFrame) {
    camera.position.copy(desiredCamPos);
    controls.target.copy(desiredCamTarget);
    snapCameraNextFrame = false;
  } else {
    camera.position.lerp(desiredCamPos, 0.12);
    controls.target.lerp(desiredCamTarget, 0.14);
  }
  camera.lookAt(controls.target);
}

function evaluateFrame(dt) {
  // Mode A: 28-Clip Common Football Optical Mocap Library Inspector
  if (activeMocapMode !== 'tactical') {
    const clipId = activeMocapMode.replace(/^lib:/, '');
    const meta = getMocapMeta(clipId);
    const dur = getActiveDurationSec();

    if (isPlaying) {
      currentSec = (currentSec + dt * playbackSpeed) % dur;
    }

    sliderEl.value = Math.round((currentSec / dur) * 1000);
    timeReadoutEl.textContent = `${currentSec.toFixed(2)}s / ${dur.toFixed(2)}s`;

    phaseBadgeEl.textContent = `公共动捕库 · ${meta.category}`;
    phaseDescEl.textContent = `${meta.label} —— 67骨骼全身光学动作捕捉原片检阅（支持 0.25x 慢放、±1帧步进与 [X] 键骨骼透视）。`;
    if (hudMocapBadgeEl) {
      hudMocapBadgeEl.textContent = `Mocap Clip: ${clipId} (100%) · Frame ${Math.round(currentSec * 60)}/${Math.round(dur * 60)}`;
    }

    matchBall.position.set(0.22, 0.24, 8.48);

    if (showcasePedriActor) {
      const isKickOrPass = clipId.includes('pass') || clipId.includes('through') || clipId.includes('shot') || clipId.includes('kick');
      updatePlayerPose(
        showcasePedriActor,
        {
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
        overlaysConfig,
        matchBall.position
      );
      updateRigTelemetryUI(showcasePedriActor);
    }

    if (cameraMode !== 'free') {
      if (cameraMode === 'ankle') {
        desiredCamTarget.set(0.05, 0.52, 8.2);
        desiredCamPos.set(2.1, 0.95, 10.4);
      } else if (cameraMode === 'topdown') {
        desiredCamTarget.set(0, 0.5, 8.0);
        desiredCamPos.set(0.01, 12.0, 8.8);
      } else {
        desiredCamTarget.set(0, 0.96, 8.0);
        desiredCamPos.set(3.2, 1.85, 11.6);
      }
      applyCameraSmoothing(34);
    } else {
      controls.update();
    }

    renderer.render(scene, camera);
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
      // Exact 1:1 Master Clock Lock to primary Zhibo8 MP4 clip!
      if (isPlaying && !zhibo8ClipEl.paused) {
        currentSec = THREE.MathUtils.clamp(zhibo8ClipEl.currentTime, 0, dur);
      }
    } else if (zhibo8ClipEl.duration > 0.1 && isPlaying && !zhibo8ClipEl.paused) {
      currentSec = (zhibo8ClipEl.currentTime / zhibo8ClipEl.duration) * dur;
    }
  } else if (isPlaying) {
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
    r.visible = overlaysConfig.showTrajectories;
  });

  matchBall.position.set(evalState.ballState.x, evalState.ballState.y ?? 0.24, evalState.ballState.z);
  const ballMoveDist = Math.hypot(
    matchBall.position.x - prevBallPos.x,
    matchBall.position.z - prevBallPos.z
  );
  if (ballMoveDist > 0.001 && ballMoveDist < 2.0) {
    matchBall.rotation.x -= ballMoveDist * 3.6;
    matchBall.rotation.z += ballMoveDist * 2.1;
  }
  prevBallPos.copy(matchBall.position);

  let pedriState = null;
  let pedriModel = null;
  let minDefDist = 99;

  activeActors.forEach((actorObj, idx) => {
    const st = evalState.actorStates[idx];
    if (actorObj.def.role === 'pedri') {
      pedriState = st;
      pedriModel = actorObj.model;
    }
  });

  activeActors.forEach((actorObj, idx) => {
    const st = evalState.actorStates[idx];
    if (actorObj.def.role === 'defender' && pedriState) {
      const d = Math.hypot(st.x - pedriState.x, st.z - pedriState.z);
      if (d < minDefDist) minDefDist = d;
      st.shadowYaw = Math.atan2(pedriState.x - st.x, pedriState.z - st.z);
    }
    updatePlayerPose(actorObj.model, st, overlaysConfig, matchBall.position);
  });

  if (pedriModel) {
    updateRigTelemetryUI(pedriModel);
    if (hudMocapBadgeEl) {
      const syncTag =
        syncVideoTo3D && videoReady && activeSubClipIndex === 0
          ? `视频主时钟 1:1 锁定 (${currentSec.toFixed(2)}s)`
          : `时间轴 (${currentSec.toFixed(2)}s)`;
      hudMocapBadgeEl.textContent = `HyperMotion: ${pedriModel.activeMocapDebug} · ${syncTag}`;
    }
  }

  // Spatial telemetry bars
  const pressPct = Math.round(Math.max(8, Math.min(98, (1 - (minDefDist - 0.9) / 6.5) * 100)));
  const decepRaw = pedriState
    ? Math.max(
        Math.abs(pedriState.leanRoll || 0) * 3.4,
        pedriState.crouch || 0,
        pedriState.blendWeight || 0,
        pedriState.ballTouch ? pedriState.ballTouch.weight * 0.92 : 0.2
      )
    : 0.3;
  const decepPct = Math.round(Math.max(15, Math.min(99, decepRaw * 100)));
  const sepMeters = minDefDist < 50 ? minDefDist.toFixed(2) : '4.50';
  const sepPct = Math.round(Math.max(10, Math.min(100, (minDefDist / 5.5) * 100)));

  barPressIntensity.style.width = `${pressPct}%`;
  valPressIntensity.textContent = `${pressPct}%`;
  barDeception.style.width = `${decepPct}%`;
  valDeception.textContent = `${decepPct}%`;
  barSeparation.style.width = `${sepPct}%`;
  valSeparation.textContent = `${sepMeters} m`;

  // Camera framing matched 1:1 to Zhibo8 broadcast perspective (or user-selected tactical camera)
  if (cameraMode === 'broadcast') {
    const c = evalState.cam;
    desiredCamPos.set(c.pos[0], c.pos[1], c.pos[2]);
    desiredCamTarget.set(c.target[0], c.target[1], c.target[2]);
    applyCameraSmoothing(c.fov || 35);
  } else if (cameraMode === 'pedri' && pedriState) {
    const behindX = pedriState.x - Math.sin(pedriState.yaw) * 4.4;
    const behindZ = pedriState.z - Math.cos(pedriState.yaw) * 4.4;
    desiredCamPos.set(behindX, 2.3, behindZ);
    desiredCamTarget.set(
      pedriState.x + Math.sin(pedriState.yaw) * 3.5,
      1.05,
      pedriState.z + Math.cos(pedriState.yaw) * 3.5
    );
    applyCameraSmoothing(42);
  } else if (cameraMode === 'ankle' && pedriState) {
    desiredCamTarget.set(
      THREE.MathUtils.lerp(pedriState.x, matchBall.position.x, 0.4),
      0.52,
      THREE.MathUtils.lerp(pedriState.z, matchBall.position.z, 0.4)
    );
    desiredCamPos.set(pedriState.x + 2.55, 0.98, pedriState.z + 1.65);
    applyCameraSmoothing(34);
  } else if (cameraMode === 'topdown' && pedriState) {
    desiredCamTarget.set(pedriState.x, 0.2, pedriState.z);
    desiredCamPos.set(pedriState.x + 0.5, 23.5, pedriState.z + 0.01);
    applyCameraSmoothing(40);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

// 10. Boot Studio
buildScenarioSidebar();
loadScenario(0);
updatePlayButtonLabel();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  evaluateFrame(dt);
}
animate();
