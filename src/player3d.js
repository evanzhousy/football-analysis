import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { applyFootballerAppearance } from './kitShader.js';
import { MOCAP_CATALOG, preloadMocapLibrary, getMocapClip } from './mocapLibrary.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Scratch math vectors/quaternions (zero per-frame GC allocation)
const _vH = new THREE.Vector3();
const _vK = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vT = new THREE.Vector3();
const _vToeL = new THREE.Vector3();
const _vToeR = new THREE.Vector3();
const _vCur = new THREE.Vector3();
const _vDes = new THREE.Vector3();
const _vFootTargetWorld = new THREE.Vector3();
const _qSwing = new THREE.Quaternion();
const _qParentWorld = new THREE.Quaternion();
const _qAdd = new THREE.Quaternion();

let sharedFootballerGltf = null;
let sharedHairMesh = null;
let sharedBeardMesh = null;
let assetLoadPromise = null;

/**
 * Preloads:
 * 1. Photorealistic 67-bone rigged footballer GLB (face, eyes, teeth, skin, jersey, shorts, cleats)
 * 2. Athletic short hair & optional beard skinned meshes
 * 3. All 28 67-bone studio optical motion-capture clips in the Common Football Mocap Library
 */
export function preloadAthleteRig(onProgress) {
  if (assetLoadPromise) return assetLoadPromise;

  const loader = new GLTFLoader();

  const pBody = new Promise((resolve, reject) => {
    loader.load(
      './assets/models/footballer.glb',
      (gltf) => {
        sharedFootballerGltf = gltf;
        resolve(gltf);
      },
      undefined,
      reject
    );
  });

  const pHair = new Promise((resolve) => {
    loader.load(
      './assets/models/footballer_hair.glb',
      (gltf) => {
        gltf.scene.traverse((obj) => {
          if (obj.isSkinnedMesh) {
            if (obj.name.includes('Hair')) sharedHairMesh = obj;
            if (obj.name.includes('Beard')) sharedBeardMesh = obj;
          }
        });
        resolve();
      },
      undefined,
      () => resolve()
    );
  });

  const pMocap = preloadMocapLibrary(onProgress);

  assetLoadPromise = Promise.all([pBody, pHair, pMocap]).then(() => sharedFootballerGltf);
  return assetLoadPromise;
}

export function isAthleteRigReady() {
  return Boolean(sharedFootballerGltf);
}

function createLabelSprite(text, role) {
  const c = document.createElement('canvas');
  c.width = 420;
  c.height = 86;
  const ctx = c.getContext('2d');

  const bg =
    role === 'pedri'
      ? 'rgba(12, 18, 34, 0.92)'
      : role === 'teammate'
      ? 'rgba(12, 34, 68, 0.86)'
      : 'rgba(56, 14, 18, 0.86)';
  const border =
    role === 'pedri' ? '#facc15' : role === 'teammate' ? '#38bdf8' : '#f87171';

  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 10, 404, 66, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = role === 'pedri' ? '#fde047' : '#f8fafc';
  ctx.font = 'bold 26px "Inter", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 210, 43);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.75, 0.36, 1);
  sprite.position.set(0, 2.22, 0);
  sprite.renderOrder = 10;
  return sprite;
}

function createScanCone() {
  const geo = new THREE.ConeGeometry(2.6, 6.4, 28, 1, true);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 3.2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 1.62, 0);
  mesh.visible = false;
  return mesh;
}

function createCoverShadowWedge() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-2.3, -5.8);
  shape.lineTo(2.3, -5.8);
  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  mesh.visible = false;
  return mesh;
}

function createPlayerGroundRing(role) {
  const inner = role === 'pedri' ? 0.44 : 0.36;
  const outer = role === 'pedri' ? 0.56 : 0.44;
  const geo = new THREE.RingGeometry(inner, outer, 40);
  geo.rotateX(-Math.PI / 2);
  const color = role === 'pedri' ? 0xfacc15 : role === 'teammate' ? 0x38bdf8 : 0xf87171;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: role === 'pedri' ? 0.85 : 0.42,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.018;
  return mesh;
}

/**
 * Analytical 2-Bone Limb IK Solver (Hip -> Knee -> Ankle)
 * Used specifically for exact ball-surface boot contact without air-kicking.
 */
function solveTwoBoneLegIK(upLegBone, legBone, targetWorldPos, weight = 1.0) {
  if (!upLegBone || !legBone || weight <= 0.001) return;

  upLegBone.parent.updateWorldMatrix(true, false);
  upLegBone.updateWorldMatrix(false, true);

  upLegBone.getWorldPosition(_vH);
  legBone.getWorldPosition(_vK);
  const footBone = legBone.children.find((c) => c.isBone && c.name.includes('Foot')) || legBone.children[0];
  if (!footBone) return;
  footBone.getWorldPosition(_vA);

  const l1 = _vH.distanceTo(_vK);
  const l2 = _vK.distanceTo(_vA);
  if (l1 < 0.05 || l2 < 0.05) return;

  _vT.lerpVectors(_vA, targetWorldPos, Math.min(1.0, weight));
  const maxReach = (l1 + l2) * 0.985;
  const minReach = Math.abs(l1 - l2) + 0.04;
  _vDes.subVectors(_vT, _vH);
  const dist = THREE.MathUtils.clamp(_vDes.length(), minReach, maxReach);
  _vDes.normalize().multiplyScalar(dist);
  _vT.copy(_vH).add(_vDes);

  // Rotate thigh toward target direction
  _vCur.subVectors(_vA, _vH).normalize();
  _vDes.subVectors(_vT, _vH).normalize();
  _qSwing.setFromUnitVectors(_vCur, _vDes);

  upLegBone.parent.getWorldQuaternion(_qParentWorld);
  _qAdd.copy(_qParentWorld).invert().multiply(_qSwing).multiply(_qParentWorld);
  upLegBone.quaternion.premultiply(_qAdd);
  upLegBone.updateWorldMatrix(false, true);

  // Law of cosines knee bend adjustment
  legBone.getWorldPosition(_vK);
  footBone.getWorldPosition(_vA);
  _vCur.subVectors(_vA, _vK).normalize();
  _vDes.subVectors(_vT, _vK).normalize();
  if (_vCur.lengthSq() > 0.5 && _vDes.lengthSq() > 0.5) {
    _qSwing.setFromUnitVectors(_vCur, _vDes);
    legBone.parent.getWorldQuaternion(_qParentWorld);
    _qAdd.copy(_qParentWorld).invert().multiply(_qSwing).multiply(_qParentWorld);
    legBone.quaternion.premultiply(_qAdd);
    legBone.updateWorldMatrix(false, true);
  }
}

export function attachRiggedSkinnedModel(playerModel) {
  if (!sharedFootballerGltf || playerModel.rigReady) return;

  const cloneRoot = SkeletonUtils.clone(sharedFootballerGltf.scene);
  cloneRoot.name = `Footballer_${playerModel.actorDef.id || playerModel.actorDef.role}`;

  applyFootballerAppearance(cloneRoot, playerModel.actorDef, sharedHairMesh, sharedBeardMesh);

  const bones = {};
  cloneRoot.traverse((node) => {
    if (node.isBone) {
      bones[node.name] = node;
    }
  });

  const mixer = new THREE.AnimationMixer(cloneRoot);
  const actions = {};
  for (const item of MOCAP_CATALOG) {
    const clip = getMocapClip(item.id);
    if (clip) {
      const act = mixer.clipAction(clip);
      act.loop = item.loop ? THREE.LoopRepeat : THREE.LoopClamp;
      act.clampWhenFinished = !item.loop;
      act.enabled = false;
      act.setEffectiveWeight(0);
      actions[item.id] = act;
    }
  }

  const skelHelper = new THREE.SkeletonHelper(cloneRoot);
  skelHelper.visible = false;
  if (skelHelper.material) {
    skelHelper.material.linewidth = 2;
    skelHelper.material.transparent = true;
    skelHelper.material.opacity = 0.9;
  }

  playerModel.bodyPivot.add(cloneRoot);
  playerModel.cloneRoot = cloneRoot;
  playerModel.bones = bones;
  playerModel.mixer = mixer;
  playerModel.actions = actions;
  playerModel.skeletonHelper = skelHelper;
  playerModel.rigReady = true;
}

export function createArticulatedPlayer(actorDef) {
  const root = new THREE.Group();
  root.name = `Actor_${actorDef.id || actorDef.name}`;

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const groundRing = createPlayerGroundRing(actorDef.role);
  root.add(groundRing);

  const scanCone = createScanCone();
  root.add(scanCone);

  const coverShadow = createCoverShadowWedge();
  root.add(coverShadow);

  const labelSprite = createLabelSprite(actorDef.label || actorDef.name, actorDef.role);
  root.add(labelSprite);

  const playerModel = {
    actorDef,
    root,
    bodyPivot,
    groundRing,
    scanCone,
    coverShadow,
    labelSprite,
    cloneRoot: null,
    bones: {},
    mixer: null,
    actions: {},
    skeletonHelper: null,
    rigReady: false,
    activeMocapDebug: 'idle_ready (100%)'
  };

  if (sharedFootballerGltf) {
    attachRiggedSkinnedModel(playerModel);
  }

  return playerModel;
}

/**
 * Automatic 4-directional Motion-Matching selector when an actor only specifies velocity & crouch.
 */
function selectLocomotionClipFromVelocity(vFwd, vSide, speed, crouch = 0) {
  if (speed < 0.28) {
    return { clipId: crouch > 0.45 ? 'crouch_jockey_fwd' : 'idle_ready', rate: crouch > 0.45 ? 0.35 : 1.0 };
  }

  const absF = Math.abs(vFwd);
  const absS = Math.abs(vSide);

  if (crouch > 0.5) {
    if (absS > absF * 1.1) {
      return { clipId: vSide >= 0 ? 'crouch_strafe_l' : 'crouch_strafe_r', rate: THREE.MathUtils.clamp(speed / 2.6, 0.65, 1.45) };
    }
    return {
      clipId: vFwd >= -0.2 ? 'crouch_jockey_fwd' : 'crouch_jockey_back',
      rate: THREE.MathUtils.clamp(speed / 2.5, 0.65, 1.45)
    };
  }

  // Lateral dominant movement (side-step / strafe)
  if (absS > absF * 1.15) {
    if (speed > 4.2) {
      return { clipId: vSide >= 0 ? 'sprint_cut_l' : 'sprint_cut_r', rate: THREE.MathUtils.clamp(speed / 5.2, 0.8, 1.35) };
    }
    if (speed > 1.8) {
      return { clipId: vSide >= 0 ? 'jog_strafe_l' : 'jog_strafe_r', rate: THREE.MathUtils.clamp(speed / 3.0, 0.75, 1.35) };
    }
    return { clipId: vSide >= 0 ? 'walk_strafe_l' : 'walk_strafe_r', rate: THREE.MathUtils.clamp(speed / 1.5, 0.7, 1.3) };
  }

  // Backward retreat / backpedal
  if (vFwd < -0.25) {
    if (speed > 4.2) {
      return { clipId: 'sprint_back', rate: THREE.MathUtils.clamp(speed / 5.0, 0.8, 1.35) };
    }
    if (speed > 1.8) {
      return { clipId: 'jog_back', rate: THREE.MathUtils.clamp(speed / 3.0, 0.75, 1.35) };
    }
    return { clipId: 'walk_back', rate: THREE.MathUtils.clamp(speed / 1.4, 0.7, 1.3) };
  }

  // Forward carry / jog / sprint
  if (speed > 4.5) {
    return { clipId: 'sprint_fwd', rate: THREE.MathUtils.clamp(speed / 5.8, 0.82, 1.38) };
  }
  if (speed > 1.85) {
    return { clipId: 'jog_fwd', rate: THREE.MathUtils.clamp(speed / 3.3, 0.78, 1.35) };
  }
  return { clipId: 'walk_fwd', rate: THREE.MathUtils.clamp(speed / 1.45, 0.72, 1.32) };
}

/**
 * Evaluates the 67-bone footballer rig at exact match timestamp `tSec`:
 * 1. Evaluates blended studio optical mocap clips from Common Football Mocap Library
 * 2. Applies centripetal banking lean into sharp cuts
 * 3. Clamps lowest stance boot cleanly to turf (y = 0.012m) — zero floating or sinking
 * 4. Applies additive head/neck scanning & physical arm shielding
 * 5. Solves 2-bone analytical ankle/foot IK onto exact ball surface during touch windows
 */
export function updatePlayerPose(playerModel, state, overlaysConfig, ballWorldPos) {
  if (!playerModel.rigReady && sharedFootballerGltf) {
    attachRiggedSkinnedModel(playerModel);
  }

  const { root, bodyPivot, scanCone, coverShadow, labelSprite, skeletonHelper } = playerModel;

  root.position.set(state.x, 0, state.z);
  root.rotation.set(0, state.yaw, 0);

  // Centripetal banking lean into cuts & forward sprint drive lean
  bodyPivot.rotation.set(state.leanPitch || 0, 0, state.leanRoll || 0);

  // Overlays visibility
  labelSprite.visible = Boolean(overlaysConfig.showLabels);
  if (skeletonHelper) {
    skeletonHelper.visible = Boolean(overlaysConfig.showSkeleton);
  }

  if (playerModel.actorDef.role === 'pedri') {
    const showScan = Boolean(overlaysConfig.showScan && Math.abs(state.scanYaw || 0) > 0.08);
    scanCone.visible = showScan;
    if (showScan) {
      scanCone.rotation.y = state.scanYaw || 0;
    }
  } else {
    scanCone.visible = false;
  }

  if (playerModel.actorDef.role === 'defender') {
    coverShadow.visible = Boolean(overlaysConfig.showCoverShadow && state.showShadow !== false);
    if (coverShadow.visible && state.shadowYaw !== undefined) {
      coverShadow.rotation.y = state.shadowYaw - state.yaw;
    }
  } else {
    coverShadow.visible = false;
  }

  if (!playerModel.rigReady || !playerModel.mixer) return;

  const { mixer, actions, bones, cloneRoot } = playerModel;

  // Determine primary & optional secondary crossfade mocap clips
  let primaryId = state.primaryClip;
  let primaryTime = state.clipTime ?? 0;
  let secondaryId = state.secondaryClip || null;
  let secondaryTime = state.secondaryClipTime ?? 0;
  let blendW = THREE.MathUtils.clamp(state.blendWeight ?? 0, 0, 1);

  if (!primaryId) {
    const sinY = Math.sin(state.yaw);
    const cosY = Math.cos(state.yaw);
    const vx = state.vx || 0;
    const vz = state.vz || 0;
    const vFwd = vx * sinY + vz * cosY;
    const vSide = vx * cosY - vz * sinY;
    const speed = Math.hypot(vx, vz);
    const sel = selectLocomotionClipFromVelocity(vFwd, vSide, speed, state.crouch || 0);
    primaryId = sel.clipId;
    const clip = getMocapClip(primaryId);
    const dur = clip ? Math.max(0.1, clip.duration) : 1.0;
    primaryTime = ((state.tSec || 0) * sel.rate + (playerModel.actorDef.phaseSeed || 0)) % dur;
  }

  // Reset all action weights cleanly for deterministic scrub-safe frame evaluation
  for (const key in actions) {
    const act = actions[key];
    if (act.enabled) {
      act.enabled = false;
      act.setEffectiveWeight(0);
    }
  }

  const actA = actions[primaryId] || actions.idle_ready;
  const actB = secondaryId && blendW > 0.01 ? actions[secondaryId] : null;

  if (actA) {
    const durA = Math.max(0.05, actA.getClip().duration);
    actA.enabled = true;
    actA.setEffectiveTimeScale(0);
    actA.setEffectiveWeight(actB ? 1 - blendW : 1);
    actA.time = actA.loop === THREE.LoopRepeat ? ((primaryTime % durA) + durA) % durA : THREE.MathUtils.clamp(primaryTime, 0, durA - 0.001);
  }

  if (actB && actB !== actA) {
    const durB = Math.max(0.05, actB.getClip().duration);
    actB.enabled = true;
    actB.setEffectiveTimeScale(0);
    actB.setEffectiveWeight(blendW);
    actB.time = actB.loop === THREE.LoopRepeat ? ((secondaryTime % durB) + durB) % durB : THREE.MathUtils.clamp(secondaryTime, 0, durB - 0.001);
    playerModel.activeMocapDebug = `${primaryId} (${Math.round((1 - blendW) * 100)}%) + ${secondaryId} (${Math.round(blendW * 100)}%)`;
  } else {
    playerModel.activeMocapDebug = `${primaryId} (100%)`;
  }

  mixer.update(0);

  // Additive Pre-Scan Head & Neck Yaw
  if (state.scanYaw && bones.Neck && bones.Head) {
    _qAdd.setFromAxisAngle(Y_AXIS, state.scanYaw * 0.4);
    bones.Neck.quaternion.multiply(_qAdd);
    _qAdd.setFromAxisAngle(Y_AXIS, state.scanYaw * 0.6);
    bones.Head.quaternion.multiply(_qAdd);
  }

  // Additive Physical Arm Shielding (fend-off bar against tight presser)
  if (state.shieldSide === 'L' && bones.LeftArm && bones.LeftForeArm) {
    _qAdd.setFromAxisAngle(Z_AXIS, 0.42);
    bones.LeftArm.quaternion.multiply(_qAdd);
    _qAdd.setFromAxisAngle(Y_AXIS, -0.35);
    bones.LeftForeArm.quaternion.multiply(_qAdd);
  } else if (state.shieldSide === 'R' && bones.RightArm && bones.RightForeArm) {
    _qAdd.setFromAxisAngle(Z_AXIS, -0.42);
    bones.RightArm.quaternion.multiply(_qAdd);
    _qAdd.setFromAxisAngle(Y_AXIS, 0.35);
    bones.RightForeArm.quaternion.multiply(_qAdd);
  }

  // Turf Contact Height Clamp: ensure lowest stance toe/boot rests cleanly on grass (y = 0.022m)
  cloneRoot.position.y = 0;
  root.updateMatrixWorld(true);
  if (bones.LeftToeBase && bones.RightToeBase) {
    bones.LeftToeBase.getWorldPosition(_vToeL);
    bones.RightToeBase.getWorldPosition(_vToeR);
    const minToeY = Math.min(_vToeL.y, _vToeR.y);
    cloneRoot.position.y = THREE.MathUtils.clamp(0.022 - minToeY, -0.18, 0.16);
    root.updateMatrixWorld(true);
  }

  // Exact Ball-Surface Ankle/Boot IK during annotated touch frames
  let activeFootLabel = '双足光学步态接地锁死';
  let ankleEverDeg = 0;
  if (state.ballTouch && state.ballTouch.weight > 0.02 && ballWorldPos) {
    const bt = state.ballTouch;
    const isRight = bt.foot !== 'L';
    const upLeg = isRight ? bones.RightUpLeg : bones.LeftUpLeg;
    const leg = isRight ? bones.RightLeg : bones.LeftLeg;
    const foot = isRight ? bones.RightFoot : bones.LeftFoot;

    _vFootTargetWorld.copy(ballWorldPos);
    if (bt.type === 'sole') {
      _vFootTargetWorld.y = ballWorldPos.y + 0.13;
    } else {
      // Offset slightly so inner/outer boot leather touches ball surface cleanly
      _vFootTargetWorld.y = Math.max(0.08, ballWorldPos.y + 0.01);
    }

    solveTwoBoneLegIK(upLeg, leg, _vFootTargetWorld, bt.weight * 0.78);

    const typeCn =
      bt.type === 'inside'
        ? '脚内侧推顺'
        : bt.type === 'outside'
        ? '外脚背拨球'
        : bt.type === 'sole'
        ? '脚底踩拉'
        : '正脚背抽击';
    activeFootLabel = `${isRight ? '右足' : '左足'}${typeCn} IK (${Math.round(bt.weight * 100)}%)`;

    if (foot) {
      const twistSign = isRight ? 1 : -1;
      if (bt.type === 'inside') {
        ankleEverDeg = Math.round(29 * bt.weight);
        _qAdd.setFromAxisAngle(Y_AXIS, twistSign * 0.52 * bt.weight);
        foot.quaternion.multiply(_qAdd);
      } else if (bt.type === 'outside') {
        ankleEverDeg = -Math.round(24 * bt.weight);
        _qAdd.setFromAxisAngle(Y_AXIS, -twistSign * 0.42 * bt.weight);
        foot.quaternion.multiply(_qAdd);
      } else if (bt.type === 'sole') {
        ankleEverDeg = Math.round(16 * bt.weight);
        _qAdd.setFromAxisAngle(X_AXIS, -0.28 * bt.weight);
        foot.quaternion.multiply(_qAdd);
      }
      foot.updateWorldMatrix(false, true);
    }
  }

  // Populate live 67-bone biomechanical telemetry for inspector HUD
  let kneeFlexDeg = 22;
  let anklePitchDeg = 8;
  const refUp = state.ballTouch && state.ballTouch.foot === 'L' ? bones.LeftUpLeg : bones.RightUpLeg;
  const refLeg = state.ballTouch && state.ballTouch.foot === 'L' ? bones.LeftLeg : bones.RightLeg;
  const refFoot = state.ballTouch && state.ballTouch.foot === 'L' ? bones.LeftFoot : bones.RightFoot;
  const refToe = state.ballTouch && state.ballTouch.foot === 'L' ? bones.LeftToeBase : bones.RightToeBase;
  if (refUp && refLeg && refFoot && refToe) {
    refUp.getWorldPosition(_vH);
    refLeg.getWorldPosition(_vK);
    refFoot.getWorldPosition(_vA);
    refToe.getWorldPosition(_vT);
    _vCur.subVectors(_vK, _vH).normalize();
    _vDes.subVectors(_vA, _vK).normalize();
    kneeFlexDeg = Math.round(THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_vCur.dot(_vDes), -1, 1))));
    _vCur.subVectors(_vT, _vA).normalize();
    anklePitchDeg = Math.round(90 - THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_vCur.dot(_vDes), -1, 1))));
  }

  playerModel.telemetry = {
    boneCount: Object.keys(bones).length || 67,
    activeClip: playerModel.activeMocapDebug,
    activeFoot: activeFootLabel,
    kneeFlexDeg,
    anklePitchDeg,
    ankleEversionDeg: ankleEverDeg
  };
}

export function createTrajectoryRibbon(points, colorHex = 0xfacc15, radius = 0.055, opacity = 0.72) {
  if (!points || points.length < 2) return null;
  const vecs = points.map((p) => new THREE.Vector3(p[0], p[1] ?? 0.06, p[2]));
  const curve = new THREE.CatmullRomCurve3(vecs);
  const geo = new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 8, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.Mesh(geo, mat);
}
