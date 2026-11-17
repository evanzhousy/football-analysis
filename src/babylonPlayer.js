const BABYLON = window.BABYLON;
import { preloadKitTextures, applyBabylonFootballerKit } from './babylonKit.js';
import {
  preloadMixamoSoccerLibrary,
  getMixamoClip,
  DISCRETE_SKILL_CLIPS,
  LOCOMOTION_CLIP_SPECS
} from './mixamoSoccerLibrary.js';
import { applyVideoCaptureFrame } from './videoCaptureDriver.js';

let sharedCharContainer = null;
let rigPreloadPromise = null;

// Zero-GC scratch objects for 60fps skeletal interpolation & Two-Bone IK
const _qPrimary = new BABYLON.Quaternion();
const _qSecondary = new BABYLON.Quaternion();
const _qOut = new BABYLON.Quaternion();
const _qAdditive = new BABYLON.Quaternion();
const _qParentInv = new BABYLON.Quaternion();
const _qWorldDelta = new BABYLON.Quaternion();
const _qSwing = new BABYLON.Quaternion();
const _qTurnout = new BABYLON.Quaternion();
const _qLocalTmp = new BABYLON.Quaternion();
const _vPosA = new BABYLON.Vector3();
const _vPosB = new BABYLON.Vector3();

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep01(u) {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

function slerpShortestToRef(qFrom, qTo, w, out) {
  const t = clamp(w, 0, 1);
  if (t <= 0.0001) return out.copyFrom(qFrom);
  const dot = qFrom.x * qTo.x + qFrom.y * qTo.y + qFrom.z * qTo.z + qFrom.w * qTo.w;
  if (dot < 0) _qLocalTmp.set(-qTo.x, -qTo.y, -qTo.z, -qTo.w);
  else _qLocalTmp.copyFrom(qTo);
  if (t >= 0.9999) return out.copyFrom(_qLocalTmp);
  BABYLON.Quaternion.SlerpToRef(qFrom, _qLocalTmp, t, out);
  return out.normalize();
}

function rotationFromUnitVectorsToRef(uFrom, uTo, out) {
  const dot = clamp(BABYLON.Vector3.Dot(uFrom, uTo), -1, 1);
  if (dot > 0.999995) return out.set(0, 0, 0, 1);
  if (dot < -0.999995) {
    let ortho = BABYLON.Vector3.Cross(BABYLON.Axis.X, uFrom);
    if (ortho.lengthSquared() < 1e-4) ortho = BABYLON.Vector3.Cross(BABYLON.Axis.Z, uFrom);
    ortho.normalize();
    return BABYLON.Quaternion.RotationAxisToRef(ortho, Math.PI, out);
  }
  BABYLON.Quaternion.FromUnitVectorsToRef(uFrom, uTo, out);
  return out.normalize();
}

function applyWorldDeltaToBoneNode(node, qWorldDelta) {
  const parent = node.parent;
  if (parent) {
    parent.computeWorldMatrix(true);
    const qP = parent.absoluteRotationQuaternion;
    if (qP) {
      BABYLON.Quaternion.InverseToRef(qP, _qParentInv);
      const qLocalDelta = _qParentInv.multiply(qWorldDelta).multiply(qP);
      node.rotationQuaternion = qLocalDelta.multiply(node.rotationQuaternion).normalize();
      return;
    }
  }
  node.rotationQuaternion = qWorldDelta.multiply(node.rotationQuaternion).normalize();
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
  // Allow dynamic La Croqueta & crossover feints up to 3.95 m/s
  if (clipId === 'soccer_crossover_feint' && speed > 3.95) return false;
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
  posePivot.position.y = 0;
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

  // 2. Evaluate all 65 bone rotations cleanly via shortest-hemisphere Quaternion SLERP
  for (const [boneName, tn] of boneNodes.entries()) {
    const animA = clipA.rotMap.get(boneName);
    const rRest = restRot.get(boneName);
    const qA = animA ? animA.evaluate(frameA) : rRest;
    _qPrimary.copyFrom(qA);

    if (clipB) {
      const animB = clipB.rotMap.get(boneName);
      const qB = animB ? animB.evaluate(frameB) : rRest;
      _qSecondary.copyFrom(qB);
      slerpShortestToRef(_qPrimary, _qSecondary, blendW, _qOut);
    } else {
      _qOut.copyFrom(_qPrimary);
    }

    tn.rotationQuaternion.copyFrom(_qOut);
  }

  // 3. Damp ground sky-kicks / pelvis whip, apply real Video-to-3D Motion Capture when available,
  //    then solve Anatomical Ball-Touch IK (scaled down gently when VideoMocap already drives the limbs)
  dampGroundSkyKickAndPelvisWhip(playerModel, state, primaryId, secondaryId, blendW);
  const vcW = state.videoCaptureFrame
    ? applyVideoCaptureFrame(playerModel, state.videoCaptureFrame, state, state.videoCaptureWeight ?? 0.90)
    : 0;
  state._vcAppliedW = vcW;
  applyAnatomicalBallTouchIK(playerModel, state, primaryId, secondaryId);

  // 4. Natural bounded head pre-scan rotation (`scanYaw` divided gently across Neck & Head, max ±28°)
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

  // 5. True X-Ray 65-Bone Skeleton LineSystem (reflects IK-resolved thigh, calf & ankle angles)
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

  // 6. Compute real-time biomechanical telemetry directly from IK-resolved Mixamo skeleton
  const pctA = Math.round((1 - blendW) * 100);
  const pctB = Math.round(blendW * 100);
  const vcBadge = vcW > 0.05 ? ` + VideoMocap(${Math.round(vcW * 100)}%)` : '';
  const ikBadge =
    state.ballTouch && state.ballTouch.weight > 0.15
      ? ` + TouchIK(${state.ballTouch.foot}:${Math.round(state.ballTouch.weight * (1 - 0.68 * vcW) * 100)}%)`
      : '';
  playerModel.activeMocapDebug =
    (clipB ? `${primaryId} (${pctA}%) → ${secondaryId} (${pctB}%)` : `${primaryId} (100%)`) + vcBadge + ikBadge;

  const rLeg = boneNodes.get('mixamorig:RightLeg');
  const lLeg = boneNodes.get('mixamorig:LeftLeg');
  const activeFootNode =
    state.ballTouch && state.ballTouch.foot === 'L'
      ? boneNodes.get('mixamorig:LeftFoot')
      : boneNodes.get('mixamorig:RightFoot');

  const kneeAngleRad = rLeg
    ? 2 * Math.acos(clamp(Math.abs(rLeg.rotationQuaternion.w), 0, 1))
    : 0.3;
  const lKneeRad = lLeg
    ? 2 * Math.acos(clamp(Math.abs(lLeg.rotationQuaternion.w), 0, 1))
    : 0.3;
  const ankleEu = activeFootNode ? activeFootNode.rotationQuaternion.toEulerAngles() : BABYLON.Vector3.Zero();

  let footLabel = vcW > 0.25 ? `原片3D视频动捕 (${Math.round(vcW * 100)}%)` : '双脚动态盘带支撑';
  if (state.ballTouch && state.ballTouch.weight > 0.15) {
    const fSide = state.ballTouch.foot === 'L' ? '左脚' : '右脚';
    const act = state.ballTouch.action;
    const fPart =
      state.ballTouch.type === 'sole'
        ? '脚底拉球'
        : state.ballTouch.type === 'outside'
        ? '外脚背拨顺'
        : state.ballTouch.type === 'instep'
        ? act === 'receive'
          ? '正脚背卸球'
          : '正脚背抽射'
        : act === 'receive'
        ? '脚内侧缓冲卸球'
        : act === 'strike'
        ? '脚内侧推传/兜射'
        : '脚内侧扣顺';
    footLabel =
      vcW > 0.25
        ? `${fSide}${fPart} · 视频动捕 ${Math.round(vcW * 100)}%`
        : `${fSide}${fPart} · IK ${Math.round(state.ballTouch.weight * 100)}%`;
  }

  playerModel.telemetry.activeClip = (clipB ? `${primaryId}+${secondaryId}` : primaryId) + (vcW > 0.25 ? '+VideoMocap' : '');
  playerModel.telemetry.activeFoot = footLabel;
  playerModel.telemetry.kneeFlexDeg = Math.round(((Math.max(kneeAngleRad, lKneeRad) * 180) / Math.PI));
  playerModel.telemetry.anklePitchDeg = Math.round(((ankleEu.x * 180) / Math.PI) % 90);
  playerModel.telemetry.ankleEversionDeg = Math.round(((ankleEu.z * 180) / Math.PI) % 45);
}

const GROUND_STRIKE_CLIPS = new Set(['soccer_shot_drive', 'soccer_pass_inside', 'soccer_through_ball']);
const STUNT_SKIP_IK_CLIPS = new Set(['soccer_slide_tackle', 'soccer_turf_hand_shield', 'gk_dive_left', 'gk_dive_right']);

function refreshLegChainWorldMatrices(playerModel, upLeg, leg, foot, toe) {
  playerModel.root.computeWorldMatrix(true);
  playerModel.posePivot.computeWorldMatrix(true);
  if (playerModel.gltfRoot) playerModel.gltfRoot.computeWorldMatrix(true);
  const hips = playerModel.boneNodes.get('mixamorig:Hips');
  if (hips) hips.computeWorldMatrix(true);
  upLeg.computeWorldMatrix(true);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);
  if (toe) toe.computeWorldMatrix(true);
}

function solveTwoBoneLegIK(playerModel, isLeft, ankleGoalWorld, poleDirWorld, turnoutRad, toeDirGoalWorld, weight) {
  const w = clamp(weight, 0, 1);
  if (w <= 0.001) return;
  const { boneNodes } = playerModel;
  const side = isLeft ? 'Left' : 'Right';
  const upLeg = boneNodes.get(`mixamorig:${side}UpLeg`);
  const leg = boneNodes.get(`mixamorig:${side}Leg`);
  const foot = boneNodes.get(`mixamorig:${side}Foot`);
  const toe = boneNodes.get(`mixamorig:${side}ToeBase`);
  if (!upLeg || !leg || !foot) return;

  const qUpLegFK = upLeg.rotationQuaternion.clone();
  const qLegFK = leg.rotationQuaternion.clone();
  const qFootFK = foot.rotationQuaternion.clone();

  refreshLegChainWorldMatrices(playerModel, upLeg, leg, foot, toe);
  const H = upLeg.getAbsolutePosition().clone();
  const KCur = leg.getAbsolutePosition().clone();
  const ACur = foot.getAbsolutePosition().clone();

  const L1 = BABYLON.Vector3.Distance(H, KCur);
  const L2 = BABYLON.Vector3.Distance(KCur, ACur);
  if (L1 < 0.12 || L2 < 0.12) return;

  const totalLen = L1 + L2;
  const goalClamped = ankleGoalWorld.clone();
  goalClamped.y = Math.max(0.118, goalClamped.y);

  const vHA = goalClamped.subtract(H);
  let d = vHA.length();
  if (d < 1e-4) return;
  const uHA = vHA.scale(1 / d);
  d = clamp(d, 0.42 * totalLen, 0.952 * totalLen);
  const AGoal = H.add(uHA.scale(d));

  const cosAlpha = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -0.995, 0.995);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  let polePerp = poleDirWorld.subtract(uHA.scale(BABYLON.Vector3.Dot(poleDirWorld, uHA)));
  if (polePerp.lengthSquared() < 1e-5) {
    const yaw = playerModel.root.rotation.y || 0;
    const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    polePerp = fwd.subtract(uHA.scale(BABYLON.Vector3.Dot(fwd, uHA)));
  }
  polePerp.normalize();

  const fkThigh = KCur.subtract(H);
  const fkPerp = fkThigh.subtract(uHA.scale(BABYLON.Vector3.Dot(fkThigh, uHA)));
  if (fkPerp.lengthSquared() > 1e-4) {
    fkPerp.normalize();
    if (BABYLON.Vector3.Dot(fkPerp, polePerp) > 0.25) {
      polePerp = polePerp.scale(0.82).add(fkPerp.scale(0.18)).normalize();
    }
  }

  const KGoal = H.add(uHA.scale(L1 * cosAlpha)).add(polePerp.scale(L1 * sinAlpha));

  const uThighCur = KCur.subtract(H).normalize();
  const uThighGoal = KGoal.subtract(H).normalize();
  rotationFromUnitVectorsToRef(uThighCur, uThighGoal, _qSwing);
  if (Math.abs(turnoutRad) > 0.001) {
    const outSign = isLeft ? 1 : -1;
    BABYLON.Quaternion.RotationAxisToRef(uThighGoal, -outSign * turnoutRad, _qTurnout);
    _qTurnout.multiplyToRef(_qSwing, _qWorldDelta);
    _qWorldDelta.normalize();
  } else {
    _qWorldDelta.copyFrom(_qSwing);
  }
  applyWorldDeltaToBoneNode(upLeg, _qWorldDelta);
  upLeg.computeWorldMatrix(true);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);

  const KNow = leg.getAbsolutePosition().clone();
  const ANow = foot.getAbsolutePosition().clone();
  const uShinCur = ANow.subtract(KNow).normalize();
  const uShinGoal = AGoal.subtract(KNow).normalize();
  rotationFromUnitVectorsToRef(uShinCur, uShinGoal, _qWorldDelta);
  applyWorldDeltaToBoneNode(leg, _qWorldDelta);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);
  if (toe) toe.computeWorldMatrix(true);

  if (toe && toeDirGoalWorld) {
    const AFinal = foot.getAbsolutePosition().clone();
    const TNow = toe.getAbsolutePosition().clone();
    const uToeCur = TNow.subtract(AFinal);
    if (uToeCur.lengthSquared() > 1e-5) {
      uToeCur.normalize();
      let uToeGoal = toeDirGoalWorld.clone().normalize();
      const shinDot = BABYLON.Vector3.Dot(uShinGoal, uToeGoal);
      const clampedDot = clamp(shinDot, -0.04, 0.86);
      if (Math.abs(shinDot - clampedDot) > 1e-4) {
        const perpToe = uToeGoal.subtract(uShinGoal.scale(shinDot));
        if (perpToe.lengthSquared() > 1e-5) {
          perpToe.normalize();
          const perpScale = Math.sqrt(Math.max(0, 1 - clampedDot * clampedDot));
          uToeGoal = uShinGoal.scale(clampedDot).add(perpToe.scale(perpScale)).normalize();
        }
      }
      rotationFromUnitVectorsToRef(uToeCur, uToeGoal, _qWorldDelta);
      applyWorldDeltaToBoneNode(foot, _qWorldDelta);
    }
  }

  const qUpLegIK = upLeg.rotationQuaternion.clone();
  const qLegIK = leg.rotationQuaternion.clone();
  const qFootIK = foot.rotationQuaternion.clone();
  slerpShortestToRef(qUpLegFK, qUpLegIK, w, upLeg.rotationQuaternion);
  slerpShortestToRef(qLegFK, qLegIK, w, leg.rotationQuaternion);
  slerpShortestToRef(qFootFK, qFootIK, w, foot.rotationQuaternion);
}

function dampGroundSkyKickAndPelvisWhip(playerModel, state, primaryId, secondaryId, blendW) {
  if (state.showcaseMode) return;
  if ((state.ballPos?.y ?? 0.115) >= 0.58) return;

  const { boneNodes, restRot } = playerModel;
  const hipsNode = boneNodes.get('mixamorig:Hips');
  const hipsRest = restRot.get('mixamorig:Hips');
  const dampOf = (id) =>
    id === 'soccer_shot_drive' ? 0.34 : id === 'soccer_crossover_feint' ? 0.25 : id === 'soccer_pass_inside' ? 0.18 : 0;
  const wWhip = dampOf(primaryId) * (1 - blendW) + dampOf(secondaryId) * blendW;
  if (hipsNode && hipsRest && wWhip > 0.005) {
    slerpShortestToRef(hipsNode.rotationQuaternion, hipsRest, wWhip, hipsNode.rotationQuaternion);
  }

  const isGroundStrike =
    GROUND_STRIKE_CLIPS.has(primaryId) || (blendW > 0.15 && GROUND_STRIKE_CLIPS.has(secondaryId));
  if (!isGroundStrike) return;

  const yaw = state.yaw || 0;
  const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const left = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  for (const isLeft of [false, true]) {
    const side = isLeft ? 'Left' : 'Right';
    const upLeg = boneNodes.get(`mixamorig:${side}UpLeg`);
    const leg = boneNodes.get(`mixamorig:${side}Leg`);
    const foot = boneNodes.get(`mixamorig:${side}Foot`);
    const toe = boneNodes.get(`mixamorig:${side}ToeBase`);
    if (!upLeg || !leg || !foot) continue;
    refreshLegChainWorldMatrices(playerModel, upLeg, leg, foot, toe);
    const footPos = foot.getAbsolutePosition();
    if (footPos.y > 0.36) {
      const clampedPos = footPos.clone();
      clampedPos.y = 0.36 + (footPos.y - 0.36) * 0.16;
      const out = left.scale(isLeft ? 1 : -1);
      const pole = fwd.scale(0.86).add(out.scale(0.42)).add(new BABYLON.Vector3(0, 0.12, 0)).normalize();
      solveTwoBoneLegIK(playerModel, isLeft, clampedPos, pole, 0, null, 0.88);
    }
  }
}

function applyAnatomicalBallTouchIK(playerModel, state, primaryId, secondaryId) {
  if (state.showcaseMode) return;
  const touch = state.ballTouch;
  if (!touch || touch.weight <= 0.005 || !state.ballPos) return;
  if (STUNT_SKIP_IK_CLIPS.has(primaryId) || STUNT_SKIP_IK_CLIPS.has(secondaryId)) return;

  const isLeft = touch.foot === 'L';
  const outSign = isLeft ? 1 : -1;
  const side = isLeft ? 'Left' : 'Right';
  const upLeg = playerModel.boneNodes.get(`mixamorig:${side}UpLeg`);
  const leg = playerModel.boneNodes.get(`mixamorig:${side}Leg`);
  const foot = playerModel.boneNodes.get(`mixamorig:${side}Foot`);
  const toe = playerModel.boneNodes.get(`mixamorig:${side}ToeBase`);
  if (!upLeg || !leg || !foot) return;

  refreshLegChainWorldMatrices(playerModel, upLeg, leg, foot, toe);
  const H = upLeg.getAbsolutePosition().clone();

  const yaw = state.yaw || 0;
  const Fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const Left = new BABYLON.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const Out = Left.scale(outSign);
  const Up = BABYLON.Axis.Y;

  const dx = state.ballPos.x - state.x;
  const dz = state.ballPos.z - state.z;
  const horizDist = Math.hypot(dx, dz);
  const toBallDir = horizDist > 0.04 ? new BABYLON.Vector3(dx / horizDist, 0, dz / horizDist) : Fwd.clone();

  const maxHoriz = 0.60;
  const effDist = horizDist <= maxHoriz ? horizDist : maxHoriz + Math.tanh((horizDist - maxHoriz) * 1.6) * 0.08;
  const BRef = new BABYLON.Vector3(
    state.x + toBallDir.x * effDist,
    clamp(state.ballPos.y ?? 0.115, 0.115, 0.68),
    state.z + toBallDir.z * effDist
  );

  const action =
    touch.action || (GROUND_STRIKE_CLIPS.has(primaryId) || primaryId === 'soccer_power_kick' ? 'strike' : 'dribble');

  const AGoal = BRef.clone();
  let turnoutRad = 0;
  let toeDirGoal = null;

  if (touch.type === 'sole') {
    AGoal.addInPlace(Fwd.scale(-0.085)).addInPlace(Out.scale(0.025));
    AGoal.y = Math.max(0.255, BRef.y + 0.145);
    turnoutRad = 0.14;
    toeDirGoal = Fwd.scale(0.93).add(Out.scale(0.12)).add(Up.scale(-0.34)).normalize();
  } else if (touch.type === 'outside') {
    AGoal.addInPlace(Out.scale(-0.055)).addInPlace(Fwd.scale(-0.115));
    AGoal.y = Math.max(0.138, BRef.y + 0.028);
    turnoutRad = -0.10;
    toeDirGoal = Fwd.scale(0.86).add(Out.scale(-0.22)).add(Up.scale(-0.46)).normalize();
  } else if (touch.type === 'instep') {
    AGoal.addInPlace(toBallDir.scale(-0.145)).addInPlace(Out.scale(0.025));
    AGoal.y = Math.max(0.152, BRef.y + 0.042);
    turnoutRad = 0.08;
    toeDirGoal = Fwd.scale(0.78).add(Out.scale(0.08)).add(Up.scale(-0.62)).normalize();
  } else {
    AGoal.addInPlace(Out.scale(0.112)).addInPlace(toBallDir.scale(-0.068));
    AGoal.y = Math.max(0.144, BRef.y + 0.034);
    turnoutRad = 0.46;
    toeDirGoal = Fwd.scale(0.74).add(Out.scale(0.66)).add(Up.scale(-0.16)).normalize();
  }

  const u = clamp(touch.u ?? 0.5, 0, 1);
  if (action === 'receive') {
    if (u < 0.5) {
      const s = 1 - 2 * u;
      AGoal.addInPlace(toBallDir.scale(0.052 * s));
      AGoal.y += 0.016 * Math.sin(u * Math.PI * 2);
    } else {
      const f = 2 * u - 1;
      AGoal.addInPlace(toBallDir.scale(-0.072 * Math.sin(f * Math.PI * 0.85)));
      AGoal.y = AGoal.y * (1 - 0.45 * f) + 0.136 * (0.45 * f);
    }
  } else if (action === 'strike') {
    const bvx = state.ballVel?.vx ?? 0;
    const bvz = state.ballVel?.vz ?? 0;
    const bvLen = Math.hypot(bvx, bvz);
    const strikeDir = bvLen > 1.2 ? new BABYLON.Vector3(bvx / bvLen, 0, bvz / bvLen) : Fwd;
    if (u < 0.5) {
      const s = 1 - 2 * u;
      AGoal.addInPlace(Fwd.scale(-0.22 * Math.sin(s * Math.PI * 0.5)));
      AGoal.y += 0.085 * Math.sin(s * Math.PI * 0.65);
    } else {
      const f = 2 * u - 1;
      AGoal.addInPlace(strikeDir.scale(0.21 * Math.sin(f * Math.PI * 0.65)));
      AGoal.y += 0.095 * Math.sin(f * Math.PI * 0.85);
    }
  } else {
    if (u < 0.5) {
      AGoal.addInPlace(Fwd.scale(-0.055 * (1 - 2 * u)));
      AGoal.y += 0.028 * Math.sin(u * Math.PI * 2);
    } else {
      AGoal.addInPlace(toBallDir.scale(0.06 * Math.sin((2 * u - 1) * Math.PI * 0.8)));
    }
  }

  const inwardCross = BABYLON.Vector3.Dot(AGoal.subtract(H), Out.scale(-1));
  if (inwardCross > 0.13) {
    AGoal.addInPlace(Out.scale(inwardCross - 0.13));
  }

  const poleOutFactor = 0.34 + Math.max(0, turnoutRad) * 0.65;
  const poleDirWorld = Fwd.scale(0.86).add(Out.scale(poleOutFactor)).add(Up.scale(0.12)).normalize();

  const effWeight = touch.weight * (1 - 0.85 * clamp(state._vcAppliedW || 0, 0, 1));
  solveTwoBoneLegIK(playerModel, isLeft, AGoal, poleDirWorld, turnoutRad, toeDirGoal, effWeight);
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
