const BABYLON = window.BABYLON;
import { preloadKitTextures, applyBabylonFootballerKit } from './babylonKit.js';
import {
  preloadMixamoSoccerLibrary,
  getMixamoClip,
  DISCRETE_SKILL_CLIPS,
  LOCOMOTION_CLIP_SPECS
} from './mixamoSoccerLibrary.js';

let sharedCharContainer = null;
let rigPreloadPromise = null;

// Zero-GC scratch objects for 60fps skeletal interpolation
const _qPrimary = new BABYLON.Quaternion();
const _qSecondary = new BABYLON.Quaternion();
const _qOut = new BABYLON.Quaternion();
const _qAdditive = new BABYLON.Quaternion();
const _vPosA = new BABYLON.Vector3();
const _vPosB = new BABYLON.Vector3();

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep01(u) {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Preloads:
 * 1. Intact watertight 65-bone Adobe Mixamo footballer (`mixamo_footballer.glb`)
 * 2. Clean skin + high-sock UV masks (`clean_skin_atlas.png` + `body_zone_mask.png`)
 * 3. All 32 Official Adobe Mixamo《Soccer Pack》& Locomotion animations
 */
export function preloadBabylonAthleteRig(scene, onProgress) {
  if (rigPreloadPromise) return rigPreloadPromise;

  const pChar = BABYLON.SceneLoader.LoadAssetContainerAsync(
    './assets/models/',
    'mixamo_footballer.glb',
    scene
  ).then((container) => {
    sharedCharContainer = container;
    return container;
  });

  const pKits = preloadKitTextures();
  const pAnims = preloadMixamoSoccerLibrary(scene, onProgress);

  rigPreloadPromise = Promise.all([pChar, pKits, pAnims]).then(() => sharedCharContainer);
  return rigPreloadPromise;
}

export function isHeroRole(role) {
  return role === 'pedri' || role === 'hero';
}

/**
 * Creates EA Sports FC style overhead tactical nameplate billboard
 */
function createOverheadLabelPlane(scene, text, role) {
  const isHero = isHeroRole(role);
  const tex = new BABYLON.DynamicTexture(`LblTex_${text}`, { width: 384, height: 96 }, scene, true);
  tex.hasAlpha = true;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 384, 96);

  const bg = isHero
    ? 'rgba(10, 16, 30, 0.90)'
    : role === 'teammate'
    ? 'rgba(12, 30, 58, 0.80)'
    : 'rgba(48, 14, 18, 0.80)';
  const border = isHero ? '#facc15' : role === 'teammate' ? '#38bdf8' : '#f87171';

  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = isHero ? 3.5 : 2.5;
  ctx.beginPath();
  ctx.roundRect(22, 8, 340, 52, 26);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = border;
  ctx.beginPath();
  ctx.moveTo(180, 66);
  ctx.lineTo(204, 66);
  ctx.lineTo(192, 86);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isHero ? '#fde047' : '#f1f5f9';
  ctx.font = '700 22px "Inter", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 192, 34);
  tex.update(true);
  tex.uScale = -1;
  tex.uOffset = 1;

  const plane = BABYLON.MeshBuilder.CreatePlane(
    `LabelPlane_${text}`,
    { width: isHero ? 0.80 : 0.66, height: isHero ? 0.20 : 0.165 },
    scene
  );
  plane.position.set(0, isHero ? 2.02 : 1.97, 0);
  plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.renderingGroupId = 1;

  const mat = new BABYLON.StandardMaterial(`LblMat_${text}`, scene);
  mat.disableLighting = true;
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.emissiveColor = BABYLON.Color3.White();
  mat.backFaceCulling = false;
  plane.material = mat;

  return plane;
}

function createPlayerGroundRing(scene, role) {
  const isHero = isHeroRole(role);
  const innerR = isHero ? 0.31 : 0.23;
  const outerR = isHero ? 0.38 : 0.28;
  const segs = 40;
  const p1 = [];
  const p2 = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    p1.push(new BABYLON.Vector3(Math.cos(a) * innerR, 0.018, Math.sin(a) * innerR));
    p2.push(new BABYLON.Vector3(Math.cos(a) * outerR, 0.018, Math.sin(a) * outerR));
  }
  const ring = BABYLON.MeshBuilder.CreateRibbon(
    `CursorRing_${role}`,
    { pathArray: [p1, p2], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene
  );
  const mat = new BABYLON.StandardMaterial(`RingMat_${role}`, scene);
  mat.disableLighting = true;
  const hex = isHero ? '#facc15' : role === 'teammate' ? '#38bdf8' : '#f87171';
  mat.emissiveColor = BABYLON.Color3.FromHexString(hex);
  mat.alpha = isHero ? 0.88 : 0.38;
  mat.backFaceCulling = false;
  ring.material = mat;
  ring.isPickable = false;
  return ring;
}

function createVisionScanCone(scene) {
  // Translucent tactical 360-scan fan extending toward +Z from eye height
  const r = 5.6;
  const halfAng = 0.38;
  const steps = 18;
  const pCenter = [];
  const pRim = [];
  for (let i = 0; i <= steps; i++) {
    const a = -halfAng + (2 * halfAng * i) / steps;
    pCenter.push(new BABYLON.Vector3(0, 0, 0));
    pRim.push(new BABYLON.Vector3(Math.sin(a) * r, -1.48, Math.cos(a) * r));
  }
  const cone = BABYLON.MeshBuilder.CreateRibbon(
    'PedriVisionCone',
    { pathArray: [pCenter, pRim], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene
  );
  cone.position.set(0, 1.56, 0);
  const mat = new BABYLON.StandardMaterial('ScanConeMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = BABYLON.Color3.FromHexString('#38bdf8');
  mat.alpha = 0.14;
  mat.backFaceCulling = false;
  cone.material = mat;
  cone.isPickable = false;
  cone.setEnabled(false);
  return cone;
}

function createCoverShadowWedge(scene) {
  const pApex = [new BABYLON.Vector3(0, 0.022, 0), new BABYLON.Vector3(0, 0.022, 0)];
  const pBack = [new BABYLON.Vector3(-2.1, 0.022, -5.4), new BABYLON.Vector3(2.1, 0.022, -5.4)];
  const wedge = BABYLON.MeshBuilder.CreateRibbon(
    'CoverShadowWedge',
    { pathArray: [pApex, pBack], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    scene
  );
  const mat = new BABYLON.StandardMaterial('ShadowWedgeMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = BABYLON.Color3.FromHexString('#ef4444');
  mat.alpha = 0.16;
  mat.backFaceCulling = false;
  wedge.material = mat;
  wedge.isPickable = false;
  wedge.setEnabled(false);
  return wedge;
}

/**
 * Attaches the preloaded watertight 65-bone Mixamo footballer rig onto a player instance.
 */
export function attachBabylonAthleteRig(playerModel) {
  if (!sharedCharContainer || playerModel.rigReady) return;
  const { scene, actorDef, shadowGen } = playerModel;

  const inst = sharedCharContainer.instantiateModelsToScene(
    (name) => name,
    false,
    { doNotInstantiate: true }
  );

  const gltfRoot = inst.rootNodes[0];
  gltfRoot.parent = playerModel.posePivot;

  const meshes = gltfRoot.getChildMeshes(false);
  applyBabylonFootballerKit(scene, meshes, actorDef, shadowGen);

  const skeleton = inst.skeletons[0] || null;
  const boneNodes = new Map();
  const restRot = new Map();
  const restPos = new Map();

  if (skeleton) {
    for (const bone of skeleton.bones) {
      const tn = bone.getTransformNode();
      if (tn) {
        boneNodes.set(bone.name, tn);
        if (!tn.rotationQuaternion) {
          tn.rotationQuaternion = BABYLON.Quaternion.FromEulerVector(tn.rotation);
        }
        restRot.set(bone.name, tn.rotationQuaternion.clone());
        restPos.set(bone.name, tn.position.clone());
      }
    }
  }

  playerModel.gltfRoot = gltfRoot;
  playerModel.meshes = meshes;
  playerModel.skeleton = skeleton;
  playerModel.boneNodes = boneNodes;
  playerModel.restRot = restRot;
  playerModel.restPos = restPos;
  playerModel.skeletonViewer = null;
  playerModel.rigReady = true;
}

/**
 * Spawns a footballer actor in the Babylon.js scene.
 */
export function createBabylonPlayer(scene, actorDef, shadowGen, parentNode = null) {
  const root = new BABYLON.TransformNode(`Actor_${actorDef.id || actorDef.role}`, scene);
  if (parentNode) root.parent = parentNode;

  // Sub-pivot for subtle body banking without polluting ground ring / shadow wedge
  const posePivot = new BABYLON.TransformNode(`PosePivot_${actorDef.id}`, scene);
  posePivot.parent = root;

  const groundRing = createPlayerGroundRing(scene, actorDef.role);
  groundRing.parent = root;

  const labelPlane = actorDef.label ? createOverheadLabelPlane(scene, actorDef.label, actorDef.role) : null;
  if (labelPlane) labelPlane.parent = root;

  const scanCone = isHeroRole(actorDef.role) ? createVisionScanCone(scene) : null;
  if (scanCone) scanCone.parent = root;

  const coverShadow = actorDef.role === 'defender' ? createCoverShadowWedge(scene) : null;
  if (coverShadow) coverShadow.parent = root;

  const playerModel = {
    scene,
    actorDef,
    shadowGen,
    root,
    posePivot,
    groundRing,
    labelPlane,
    scanCone,
    coverShadow,
    rigReady: false,
    gltfRoot: null,
    meshes: [],
    skeleton: null,
    boneNodes: null,
    restRot: null,
    restPos: null,
    skeletonViewer: null,
    activeMocapDebug: 'Mixamo Idle',
    telemetry: {
      boneCount: 65,
      activeClip: 'idle_ready',
      activeFoot: '双脚动态支撑',
      kneeFlexDeg: 18,
      anklePitchDeg: 0,
      ankleEversionDeg: 0
    },
    dispose() {
      if (this.skeletonViewer) {
        this.skeletonViewer.dispose();
        this.skeletonViewer = null;
      }
      if (this.skeleton) {
        this.skeleton.dispose();
        this.skeleton = null;
      }
      this.root.dispose(false, false);
    }
  };

  if (sharedCharContainer) {
    attachBabylonAthleteRig(playerModel);
  }

  return playerModel;
}

function sampleClipFrame(clip, timeSec) {
  if (!clip) return 0;
  const dur = clip.duration;
  const localSec = clip.loop
    ? ((timeSec % dur) + dur) % dur
    : clamp(timeSec, 0, Math.max(0.001, dur - 0.001));
  return clamp(clip.from + localSec * clip.fps, clip.from, clip.to);
}

/**
 * Evaluates Hips pelvis position while stripping horizontal root-motion drift (`x, y` in Mixamo's
 * +90° X-rotated Armature space) on locomotion & upright clips so world `(state.x, state.z)` is
 * never double-displaced or snapped backward on loop wrap. Preserves vertical bounce (`z`).
 */
function evaluateSanitizedHipsPos(clip, frame, outVec) {
  const raw = clip.hipsPosAnim.evaluate(frame);
  if (clip.allowHorizontalRootExcursion) {
    outVec.copyFrom(raw);
    return;
  }
  const rest = clip.hipsRestPos;
  outVec.set(rest ? rest.x : 0, rest ? rest.y : 2.3146, raw.z);
}

function isEffectiveDiscreteSkill(clipId, speed) {
  if (!clipId) return false;
  if (clipId === 'idle_scan' && speed < 0.42) return true;
  if (!DISCRETE_SKILL_CLIPS.has(clipId)) return false;
  // Stationary ball-tap feint looks like skating if actor is already running > 2.25 m/s
  if (clipId === 'soccer_crossover_feint' && speed > 2.25) return false;
  return true;
}

/**
 * Computes Phase-Locked Stride-Warped Locomotion Blend (`clipA, timeA, clipB, timeB, blendW`)
 * driven by exact ground distance `distMeters` and normalized `gaitCycles` so stance cleats lock
 * to the turf across idle -> walk -> jog -> sprint, backpedal, and lateral shuffles.
 */
function resolveStrideLockedLocomotion(actorDef, state) {
  const spd = state.speed || 0;
  const yaw = state.yaw || 0;
  const vx = state.vx || 0;
  const vz = state.vz || 0;
  const seedRaw =
    actorDef.phaseSeed ??
    ((actorDef.id || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 100) / 100;
  const seedPhase = (seedRaw * 0.6180339887) % 1.0;
  const seedSec = seedRaw * 1.7;

  const idleClip = (state.crouch || 0) > 0.38 ? 'crouch_jockey_fwd' : 'idle_ready';
  const idleTime = (state.tSec || 0) + seedSec;

  if (spd <= 0.16) {
    return { primaryId: idleClip, clipTime: idleTime, secondaryId: null, secondaryTime: 0, blendW: 0 };
  }

  // Decompose world velocity into character's local body frame (+Z = forward, +X = left)
  const vFwd = vx * Math.sin(yaw) + vz * Math.cos(yaw);
  const vLeft = vx * Math.cos(yaw) - vz * Math.sin(yaw);
  const absFwd = Math.abs(vFwd);
  const absLeft = Math.abs(vLeft);

  const uGait = (((state.gaitCycles ?? 0) % 1) + 1) % 1;
  const distMeters = state.distMeters ?? (state.tSec || 0) * spd;

  const fwdPhaseTime = (id) => {
    const c = getMixamoClip(id);
    return c ? uGait * c.duration : 0;
  };

  const dirStrideTime = (id) => {
    const c = getMixamoClip(id);
    if (!c) return 0;
    const spec = LOCOMOTION_CLIP_SPECS[id];
    const stride = spec ? spec.stride : 1.65;
    const u = (((distMeters / stride + seedPhase) % 1) + 1) % 1;
    return u * c.duration;
  };

  let moveA = 'walk_fwd';
  let timeA = 0;
  let moveB = null;
  let timeB = 0;
  let moveW = 0;

  if (absLeft > absFwd * 1.15) {
    // Lateral defensive / off-ball shuffle
    if (vLeft > 0) {
      moveA = 'walk_strafe_l';
      timeA = dirStrideTime('walk_strafe_l');
      if (spd > 1.25) {
        moveB = 'crouch_strafe_l';
        timeB = dirStrideTime('crouch_strafe_l');
        moveW = smoothstep01((spd - 1.25) / 0.9);
      }
    } else {
      moveA = 'walk_strafe_r';
      timeA = dirStrideTime('walk_strafe_r');
      if (spd > 1.55) {
        moveB = 'crouch_strafe_r';
        timeB = dirStrideTime('crouch_strafe_r');
        moveW = smoothstep01((spd - 1.55) / 0.95);
      }
    }
  } else if (vFwd < -0.20) {
    // Backpedaling / jockeying retreat
    if (absLeft > absFwd * 0.55) {
      moveA = 'crouch_jockey_back';
      timeA = dirStrideTime('crouch_jockey_back');
    } else if (spd < 1.15) {
      moveA = 'walk_back';
      timeA = dirStrideTime('walk_back');
    } else if (spd < 1.95) {
      moveA = 'walk_back';
      timeA = dirStrideTime('walk_back');
      moveB = 'jog_back';
      timeB = dirStrideTime('jog_back');
      moveW = smoothstep01((spd - 1.15) / 0.8);
    } else {
      moveA = 'jog_back';
      timeA = dirStrideTime('jog_back');
    }
  } else {
    // Forward / diagonal-forward progression (Phase-Locked BlendSpace: walk_fwd <-> jog_fwd <-> sprint_fwd)
    if (spd < 1.50) {
      moveA = 'walk_fwd';
      timeA = fwdPhaseTime('walk_fwd');
    } else if (spd < 2.35) {
      moveA = 'walk_fwd';
      timeA = fwdPhaseTime('walk_fwd');
      moveB = 'jog_fwd';
      timeB = fwdPhaseTime('jog_fwd');
      moveW = smoothstep01((spd - 1.50) / 0.85);
    } else if (spd < 3.15) {
      if (vLeft > absFwd * 0.48) {
        moveA = 'jog_strafe_l';
        timeA = dirStrideTime('jog_strafe_l');
      } else {
        moveA = 'jog_fwd';
        timeA = fwdPhaseTime('jog_fwd');
      }
    } else if (spd < 4.35) {
      moveA = 'jog_fwd';
      timeA = fwdPhaseTime('jog_fwd');
      moveB = 'sprint_fwd';
      timeB = fwdPhaseTime('sprint_fwd');
      moveW = smoothstep01((spd - 3.15) / 1.20);
    } else {
      moveA = 'sprint_fwd';
      timeA = fwdPhaseTime('sprint_fwd');
    }
  }

  // Collapse completely blended pairs cleanly
  if (moveB && moveW >= 0.999) {
    moveA = moveB;
    timeA = timeB;
    moveB = null;
    timeB = 0;
    moveW = 0;
  } else if (moveW <= 0.001) {
    moveB = null;
    timeB = 0;
    moveW = 0;
  }

  // Smooth start/stop feathering (`0.16 .. 0.62 m/s`) so decelerating to rest never freezes a lifted knee
  if (spd < 0.62) {
    const domClip = moveB && moveW > 0.5 ? moveB : moveA;
    const domTime = moveB && moveW > 0.5 ? timeB : timeA;
    const wMove = smoothstep01((spd - 0.16) / 0.46);
    return {
      primaryId: idleClip,
      clipTime: idleTime,
      secondaryId: domClip,
      secondaryTime: domTime,
      blendW: wMove
    };
  }

  return {
    primaryId: moveA,
    clipTime: timeA,
    secondaryId: moveB,
    secondaryTime: timeB,
    blendW: moveW
  };
}

/**
 * Evaluates Mixamo《Soccer Pack》pose + Stride-Warped Locomotion BlendSpace + tactical overlays at exact `tSec`.
 */
export function updateBabylonPlayerPose(playerModel, state, overlaysConfig) {
  const { root, posePivot, groundRing, labelPlane, scanCone, coverShadow } = playerModel;

  root.position.set(state.x, 0, state.z);
  root.rotation.y = state.yaw || 0;

  // Gentle centripetal body banking on sharp cuts (bounded strictly to ±9° on whole-body pivot, zero mesh distortion!)
  posePivot.rotation.z = clamp(state.leanRoll || 0, -0.15, 0.15);
  posePivot.rotation.x = clamp((state.leanPitch || 0) * 0.55, -0.08, 0.10);

  if (labelPlane) {
    const hideInCloseUp = overlaysConfig.cameraMode === 'ankle';
    labelPlane.setEnabled(Boolean(overlaysConfig.showLabels && !hideInCloseUp));
  }

  if (groundRing) {
    groundRing.setEnabled(overlaysConfig.cameraMode !== 'ankle');
  }

  if (scanCone) {
    const hasScan = Math.abs(state.scanYaw || 0) > 0.08;
    scanCone.setEnabled(Boolean(overlaysConfig.showScan && overlaysConfig.cameraMode !== 'ankle'));
    scanCone.rotation.y = state.scanYaw || 0;
    scanCone.material.alpha = hasScan ? 0.22 : 0.10;
  }

  if (coverShadow) {
    const showShad = Boolean(overlaysConfig.showCoverShadow && state.showShadow !== false && overlaysConfig.cameraMode !== 'ankle');
    coverShadow.setEnabled(showShad);
    if (showShad && state.shadowYaw !== undefined) {
      coverShadow.rotation.y = state.shadowYaw - (state.yaw || 0);
    }
  }

  if (!playerModel.rigReady) return;

  let primaryId = state.primaryClip;
  let clipTime = state.clipTime ?? state.tSec ?? 0;
  let secondaryId = state.secondaryClip || null;
  let secondaryTime = state.secondaryClipTime ?? 0;
  let blendW = clamp(state.blendWeight ?? 0, 0, 1);

  if (!state.showcaseMode) {
    const spd = state.speed || 0;
    const loco = resolveStrideLockedLocomotion(playerModel.actorDef, state);
    const locoDomClip = loco.secondaryId && loco.blendW > 0.5 ? loco.secondaryId : loco.primaryId;
    const locoDomTime = loco.secondaryId && loco.blendW > 0.5 ? loco.secondaryTime : loco.clipTime;

    const priSkill = isEffectiveDiscreteSkill(primaryId, spd);
    const secSkill = isEffectiveDiscreteSkill(secondaryId, spd);

    if (!priSkill && !secSkill) {
      primaryId = loco.primaryId;
      clipTime = loco.clipTime;
      secondaryId = loco.secondaryId;
      secondaryTime = loco.secondaryTime;
      blendW = loco.blendW;
    } else if (priSkill && !secSkill) {
      if (secondaryId && blendW > 0.001) {
        secondaryId = locoDomClip;
        secondaryTime = locoDomTime;
      } else {
        secondaryId = null;
        blendW = 0;
      }
    } else if (!priSkill && secSkill) {
      primaryId = locoDomClip;
      clipTime = locoDomTime;
    }
  }

  const clipA = getMixamoClip(primaryId);
  const clipB = secondaryId && blendW > 0.001 ? getMixamoClip(secondaryId) : null;
  if (!clipA) return;

  const frameA = sampleClipFrame(clipA, clipTime);
  const frameB = clipB ? sampleClipFrame(clipB, secondaryTime) : 0;

  const { boneNodes, restRot } = playerModel;

  // 1. Evaluate Hips pelvis height with horizontal root-drift stripped on locomotion/upright clips!
  const hipsNode = boneNodes.get('mixamorig:Hips');
  if (hipsNode && clipA.hipsPosAnim) {
    evaluateSanitizedHipsPos(clipA, frameA, _vPosA);
    if (clipB && clipB.hipsPosAnim) {
      evaluateSanitizedHipsPos(clipB, frameB, _vPosB);
      BABYLON.Vector3.LerpToRef(_vPosA, _vPosB, blendW, hipsNode.position);
    } else {
      hipsNode.position.copyFrom(_vPosA);
    }
  }

  // 2. Evaluate all 65 bone rotations cleanly via Quaternion SLERP
  for (const [boneName, tn] of boneNodes.entries()) {
    const animA = clipA.rotMap.get(boneName);
    const rRest = restRot.get(boneName);
    const qA = animA ? animA.evaluate(frameA) : rRest;
    _qPrimary.copyFrom(qA);

    if (clipB) {
      const animB = clipB.rotMap.get(boneName);
      const qB = animB ? animB.evaluate(frameB) : rRest;
      _qSecondary.copyFrom(qB);
      BABYLON.Quaternion.SlerpToRef(_qPrimary, _qSecondary, blendW, _qOut);
    } else {
      _qOut.copyFrom(_qPrimary);
    }

    tn.rotationQuaternion.copyFrom(_qOut);
  }

  // 3. Natural bounded head pre-scan rotation (`scanYaw` divided gently across Neck & Head, max ±28°)
  if (Math.abs(state.scanYaw || 0) > 0.01) {
    const clampedScan = clamp(state.scanYaw, -0.52, 0.52);
    const neckNode = boneNodes.get('mixamorig:Neck');
    const headNode = boneNodes.get('mixamorig:Head');
    if (neckNode) {
      BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Y, clampedScan * 0.42, _qAdditive);
      neckNode.rotationQuaternion.multiplyInPlace(_qAdditive);
    }
    if (headNode) {
      BABYLON.Quaternion.RotationAxisToRef(BABYLON.Axis.Y, clampedScan * 0.58, _qAdditive);
      headNode.rotationQuaternion.multiplyInPlace(_qAdditive);
    }
  }

  // True X-Ray 65-Bone Skeleton LineSystem (renderingGroupId = 2, draws over mesh without depth occlusion)
  if (overlaysConfig.showSkeleton && playerModel.skeleton) {
    if (!playerModel.bonePairs) {
      const pairs = [];
      for (const b of playerModel.skeleton.bones) {
        const p = b.getParent();
        const tnC = b.getTransformNode();
        const tnP = p ? p.getTransformNode() : null;
        if (tnC && tnP) {
          pairs.push([tnP, tnC]);
        }
      }
      playerModel.bonePairs = pairs;
    }
    playerModel.root.computeWorldMatrix(true);
    for (const tn of boneNodes.values()) {
      tn.computeWorldMatrix(true);
    }
    const lines = playerModel.bonePairs.map(([tnP, tnC]) => [
      tnP.getAbsolutePosition().clone(),
      tnC.getAbsolutePosition().clone()
    ]);
    if (!playerModel.skeletonViewer) {
      const ls = BABYLON.MeshBuilder.CreateLineSystem(
        `XRayBones_${playerModel.actorDef.id}`,
        { lines, updatable: true },
        playerModel.scene
      );
      ls.color = isHeroRole(playerModel.actorDef.role)
        ? new BABYLON.Color3(0.99, 0.84, 0.12)
        : new BABYLON.Color3(0.22, 0.78, 0.98);
      ls.renderingGroupId = 2;
      ls.isPickable = false;
      ls.alwaysSelectAsActiveMesh = true;
      playerModel.skeletonViewer = ls;
    } else {
      BABYLON.MeshBuilder.CreateLineSystem(null, { lines, instance: playerModel.skeletonViewer });
      playerModel.skeletonViewer.setEnabled(true);
    }
  } else if (playerModel.skeletonViewer) {
    playerModel.skeletonViewer.setEnabled(false);
  }

  // 4. Compute real-time biomechanical telemetry directly from Mixamo skeleton
  const pctA = Math.round((1 - blendW) * 100);
  const pctB = Math.round(blendW * 100);
  playerModel.activeMocapDebug = clipB
    ? `${primaryId} (${pctA}%) → ${secondaryId} (${pctB}%)`
    : `${primaryId} (100%)`;

  const rLeg = boneNodes.get('mixamorig:RightLeg');
  const lLeg = boneNodes.get('mixamorig:LeftLeg');
  const rFoot = boneNodes.get('mixamorig:RightFoot');

  const kneeAngleRad = rLeg
    ? 2 * Math.acos(clamp(Math.abs(rLeg.rotationQuaternion.w), 0, 1))
    : 0.3;
  const lKneeRad = lLeg
    ? 2 * Math.acos(clamp(Math.abs(lLeg.rotationQuaternion.w), 0, 1))
    : 0.3;
  const ankleEu = rFoot ? rFoot.rotationQuaternion.toEulerAngles() : BABYLON.Vector3.Zero();

  let footLabel = '双脚动态盘带支撑';
  if (state.ballTouch && state.ballTouch.weight > 0.15) {
    const fSide = state.ballTouch.foot === 'L' ? '左脚' : '右脚';
    const fPart =
      state.ballTouch.type === 'sole'
        ? '脚底拉球'
        : state.ballTouch.type === 'outside'
        ? '外脚背拨球'
        : state.ballTouch.type === 'instep'
        ? '正脚背抽射'
        : '脚内侧推顺';
    footLabel = `${fSide}${fPart} (${Math.round(state.ballTouch.weight * 100)}%)`;
  }

  playerModel.telemetry.activeClip = clipB ? `${primaryId}+${secondaryId}` : primaryId;
  playerModel.telemetry.activeFoot = footLabel;
  playerModel.telemetry.kneeFlexDeg = Math.round(((Math.max(kneeAngleRad, lKneeRad) * 180) / Math.PI));
  playerModel.telemetry.anklePitchDeg = Math.round(((ankleEu.x * 180) / Math.PI) % 90);
  playerModel.telemetry.ankleEversionDeg = Math.round(((ankleEu.z * 180) / Math.PI) % 45);
}

/**
 * Creates smooth 3D tactical trajectory ribbons along the turf using Catmull-Rom splines
 */
export function createBabylonTrajectoryRibbon(scene, pointsArr, hexColor, radius = 0.05, alpha = 0.72, parentNode = null) {
  if (!pointsArr || pointsArr.length < 2) return null;
  const ctrl = pointsArr.map((p) => new BABYLON.Vector3(p[0], p[1] ?? 0.05, p[2]));
  const curve = BABYLON.Curve3.CreateCatmullRomSpline(ctrl, 16, false);
  const tube = BABYLON.MeshBuilder.CreateTube(
    'TacticalRibbon',
    { path: curve.getPoints(), radius, tessellation: 10, cap: BABYLON.Mesh.CAP_ALL },
    scene
  );
  const mat = new BABYLON.StandardMaterial('RibbonMat', scene);
  mat.disableLighting = true;
  mat.emissiveColor = BABYLON.Color3.FromHexString(hexColor);
  mat.alpha = alpha;
  tube.material = mat;
  tube.isPickable = false;
  if (parentNode) tube.parent = parentNode;
  return tube;
}
