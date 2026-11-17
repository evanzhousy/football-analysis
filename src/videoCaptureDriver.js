/**
 * VideoCaptureDriver — Anatomically Exact Pelvis-Intrinsic 3D Video Motion Capture Driver
 *
 * Applies real match-video 3D limb directions (extracted via Square-ROI MediaPipe Heavy
 * in the player's orthonormal Pelvis-Intrinsic `[Left, Up, Forward]` frame) onto the 65-bone
 * Mixamo skeleton using pure world-space unit-vector swing + exact parent-world quaternion
 * conjugation (`inv(qParentWorld) * qWorldDelta * qParentWorld * qLocalCur`).
 *
 * Guarantees:
 * - Zero 90° Armature axis mismatch (never overwrites local `rotationQuaternion` with raw matrices)
 * - Zero backward knee hyperextension (enforces anatomical anterior knee hinge)
 * - Zero vertical boot-flip (grounds `Foot -> ToeBase` parallel to turf at Mixamo's -33° rest slope)
 * - Exact pelvis turf-stance height coupling via `posePivot.position.y`
 */

const BABYLON = window.BABYLON;

const _vFwd = new BABYLON.Vector3();
const _vLeft = new BABYLON.Vector3();
const _vGoalA = new BABYLON.Vector3();
const _vGoalB = new BABYLON.Vector3();
const _vGoalC = new BABYLON.Vector3();
const _vGoalD = new BABYLON.Vector3();
const _vCurDir = new BABYLON.Vector3();
const _vAnkleGoalL = new BABYLON.Vector3();
const _vAnkleGoalR = new BABYLON.Vector3();
const _vPoleL = new BABYLON.Vector3();
const _vPoleR = new BABYLON.Vector3();
const _vToeGoal = new BABYLON.Vector3();
const _qSwing = new BABYLON.Quaternion();
const _qParentWorld = new BABYLON.Quaternion();
const _qParentInv = new BABYLON.Quaternion();
const _qBefore = new BABYLON.Quaternion();
const _qLocalTmp = new BABYLON.Quaternion();

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
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

function rotQFromUnitVecsToRef(uFrom, uTo, outQ) {
  const dot = clamp(BABYLON.Vector3.Dot(uFrom, uTo), -1, 1);
  if (dot > 0.99995) {
    outQ.set(0, 0, 0, 1);
    return outQ;
  }
  if (dot < -0.99995) {
    const axis =
      Math.abs(uFrom.x) < 0.9
        ? BABYLON.Vector3.Cross(uFrom, BABYLON.Axis.X)
        : BABYLON.Vector3.Cross(uFrom, BABYLON.Axis.Y);
    axis.normalize();
    outQ.set(axis.x, axis.y, axis.z, 0);
    return outQ;
  }
  const cx = uFrom.y * uTo.z - uFrom.z * uTo.y;
  const cy = uFrom.z * uTo.x - uFrom.x * uTo.z;
  const cz = uFrom.x * uTo.y - uFrom.y * uTo.x;
  const s = Math.sqrt((1 + dot) * 2);
  const invS = 1 / s;
  outQ.set(cx * invS, cy * invS, cz * invS, s * 0.5).normalize();
  return outQ;
}

function applyWorldDeltaToBone(boneNode, qWorldDelta) {
  const parent = boneNode.parent;
  if (!parent) {
    qWorldDelta.multiplyToRef(boneNode.rotationQuaternion, boneNode.rotationQuaternion);
    boneNode.rotationQuaternion.normalize();
    return;
  }
  parent.computeWorldMatrix(true);
  parent.getWorldMatrix().decompose(undefined, _qParentWorld, undefined);
  BABYLON.Quaternion.InverseToRef(_qParentWorld, _qParentInv);
  // qLocalNew = inv(qParentWorld) * qWorldDelta * qParentWorld * qLocalCur
  const qLocalNew = _qParentInv
    .multiply(qWorldDelta)
    .multiply(_qParentWorld)
    .multiply(boneNode.rotationQuaternion);
  boneNode.rotationQuaternion.copyFrom(qLocalNew).normalize();
}

function swingBoneTowardWorldDir(boneNode, childNode, goalWorldDir, weight) {
  const w = clamp(weight, 0, 1);
  if (!boneNode || !childNode || w <= 0.001) return;
  boneNode.computeWorldMatrix(true);
  childNode.computeWorldMatrix(true);

  const p0 = boneNode.getAbsolutePosition();
  const p1 = childNode.getAbsolutePosition();
  _vCurDir.set(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
  const len = _vCurDir.length();
  if (len < 1e-5) return;
  _vCurDir.scaleInPlace(1 / len);

  _qBefore.copyFrom(boneNode.rotationQuaternion);
  rotQFromUnitVecsToRef(_vCurDir, goalWorldDir, _qSwing);
  applyWorldDeltaToBone(boneNode, _qSwing);
  slerpShortestToRef(_qBefore, boneNode.rotationQuaternion, w, boneNode.rotationQuaternion);
  boneNode.computeWorldMatrix(true);
  childNode.computeWorldMatrix(true);
}

function frameVecToWorldToRef(arr, isWorldSpace, leftWorld, fwdWorld, outVec) {
  if (isWorldSpace) {
    outVec.set(arr[0], arr[1], arr[2]);
  } else {
    outVec.set(
      leftWorld.x * arr[0] + fwdWorld.x * arr[2],
      arr[1],
      leftWorld.z * arr[0] + fwdWorld.z * arr[2]
    );
  }
  const len = outVec.length();
  if (len > 1e-6) outVec.scaleInPlace(1 / len);
  else outVec.set(0, 1, 0);
  return outVec;
}

function solveCapturedLegIK(playerModel, isLeft, ankleGoalWorld, poleDirWorld, fwdWorld, leftWorld, weight) {
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

  upLeg.computeWorldMatrix(true);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);
  if (toe) toe.computeWorldMatrix(true);

  const H = upLeg.getAbsolutePosition().clone();
  const KCur = leg.getAbsolutePosition().clone();
  const ACur = foot.getAbsolutePosition().clone();

  const L1 = BABYLON.Vector3.Distance(H, KCur);
  const L2 = BABYLON.Vector3.Distance(KCur, ACur);
  if (L1 < 0.12 || L2 < 0.12) return;
  const totalLen = L1 + L2;

  const goalClamped = ankleGoalWorld.clone();
  goalClamped.y = Math.max(0.124, goalClamped.y);

  const vHA = goalClamped.subtract(H);
  let d = vHA.length();
  if (d < 1e-4) return;
  const uHA = vHA.scale(1 / d);
  // Keep realistic athletic knee flexion (>= 14 deg, zero hyperextension)
  d = clamp(d, 0.44 * totalLen, 0.968 * totalLen);
  const AGoal = H.add(uHA.scale(d));

  const cosAlpha = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -0.995, 0.995);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  let polePerp = poleDirWorld.subtract(uHA.scale(BABYLON.Vector3.Dot(poleDirWorld, uHA)));
  if (polePerp.lengthSquared() < 1e-5) {
    polePerp = fwdWorld.subtract(uHA.scale(BABYLON.Vector3.Dot(fwdWorld, uHA)));
  }
  polePerp.normalize();

  // Anatomical anterior-lateral knee guard: prevent knee from ever bending backward!
  const outSign = isLeft ? 1 : -1;
  const safeFwdOut = fwdWorld.scale(0.88).add(leftWorld.scale(0.32 * outSign)).normalize();
  if (BABYLON.Vector3.Dot(polePerp, safeFwdOut) < 0.12) {
    polePerp = safeFwdOut.subtract(uHA.scale(BABYLON.Vector3.Dot(safeFwdOut, uHA)));
    if (polePerp.lengthSquared() < 1e-5) polePerp.copyFrom(fwdWorld);
    polePerp.normalize();
  }

  const KGoal = H.add(uHA.scale(L1 * cosAlpha)).add(polePerp.scale(L1 * sinAlpha));

  // 1. Thigh world swing
  const uThighCur = KCur.subtract(H).normalize();
  const uThighGoal = KGoal.subtract(H).normalize();
  rotQFromUnitVecsToRef(uThighCur, uThighGoal, _qSwing);
  applyWorldDeltaToBone(upLeg, _qSwing);
  upLeg.computeWorldMatrix(true);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);

  // 2. Shin world swing
  const KNow = leg.getAbsolutePosition().clone();
  const ANow = foot.getAbsolutePosition().clone();
  const uShinCur = ANow.subtract(KNow).normalize();
  const uShinGoal = AGoal.subtract(KNow).normalize();
  rotQFromUnitVecsToRef(uShinCur, uShinGoal, _qSwing);
  applyWorldDeltaToBone(leg, _qSwing);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);
  if (toe) toe.computeWorldMatrix(true);

  // 3. Anatomical Foot -> ToeBase grounding (Mixamo rest slope is dy=-0.548, dz=+0.836!)
  if (toe) {
    const AFinal = foot.getAbsolutePosition().clone();
    const TNow = toe.getAbsolutePosition().clone();
    const uToeCur = TNow.subtract(AFinal);
    if (uToeCur.lengthSquared() > 1e-5) {
      uToeCur.normalize();
      const lift01 = clamp((AGoal.y - 0.135) / 0.22, 0, 1);
      // Planted boot lies flat on turf; lifted boot follows shin with natural plantarflexion
      const flatToe = fwdWorld.scale(0.836).add(leftWorld.scale(0.06 * outSign));
      flatToe.y = -0.548;
      flatToe.normalize();

      const airToe = fwdWorld.scale(0.72).add(uShinGoal.scale(0.42)).add(leftWorld.scale(0.08 * outSign));
      airToe.y = Math.min(-0.26, airToe.y);
      airToe.normalize();

      BABYLON.Vector3.LerpToRef(flatToe, airToe, lift01, _vToeGoal);
      _vToeGoal.normalize();

      // Strict ankle ROM clamp so boot NEVER points skyward or folds into shin
      const shinDot = BABYLON.Vector3.Dot(uShinGoal, _vToeGoal);
      const clampedDot = clamp(shinDot, 0.12, 0.80);
      if (Math.abs(shinDot - clampedDot) > 1e-4) {
        const perp = _vToeGoal.subtract(uShinGoal.scale(shinDot));
        if (perp.lengthSquared() > 1e-5) {
          perp.normalize();
          const pScale = Math.sqrt(Math.max(0, 1 - clampedDot * clampedDot));
          _vToeGoal.copyFrom(uShinGoal.scale(clampedDot).add(perp.scale(pScale))).normalize();
        }
      }

      rotQFromUnitVecsToRef(uToeCur, _vToeGoal, _qSwing);
      applyWorldDeltaToBone(foot, _qSwing);
    }
  }

  slerpShortestToRef(qUpLegFK, upLeg.rotationQuaternion, w, upLeg.rotationQuaternion);
  slerpShortestToRef(qLegFK, leg.rotationQuaternion, w, leg.rotationQuaternion);
  slerpShortestToRef(qFootFK, foot.rotationQuaternion, w, foot.rotationQuaternion);
}

export function applyVideoCaptureFrame(playerModel, vcFrame, state, maxWeight = 0.92) {
  if (!vcFrame || !playerModel?.boneNodes) return 0;
  const conf = vcFrame.c ?? 0;
  const w = clamp(conf * maxWeight, 0, 1);
  if (w <= 0.002) return 0;

  const { boneNodes, restRot, root, posePivot, gltfRoot } = playerModel;
  const isWS = Boolean(vcFrame.ws);
  const yaw = state.yaw || 0;
  _vFwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  _vLeft.set(Math.cos(yaw), 0, -Math.sin(yaw));

  // Neutralize underlying Mixamo clip Hips tilt/spin so real video posture drives cleanly!
  const hips = boneNodes.get('mixamorig:Hips');
  const hipsRest = restRot?.get('mixamorig:Hips');
  if (hips && hipsRest) {
    slerpShortestToRef(hips.rotationQuaternion, hipsRest, w * 0.82, hips.rotationQuaternion);
  }

  root.computeWorldMatrix(true);
  posePivot.computeWorldMatrix(true);
  if (gltfRoot) gltfRoot.computeWorldMatrix(true);
  if (hips) hips.computeWorldMatrix(true);

  // 1. Torso athletic lean (Spine -> Spine1 -> Neck), zero 90° pelvis flip!
  if (vcFrame.t) {
    frameVecToWorldToRef(vcFrame.t, isWS, _vLeft, _vFwd, _vGoalA);
    const spine = boneNodes.get('mixamorig:Spine');
    const spine1 = boneNodes.get('mixamorig:Spine1');
    const spine2 = boneNodes.get('mixamorig:Spine2');
    const neck = boneNodes.get('mixamorig:Neck');
    if (spine && spine1) swingBoneTowardWorldDir(spine, spine1, _vGoalA, w * 0.62);
    if (spine1 && spine2) swingBoneTowardWorldDir(spine1, spine2, _vGoalA, w * 0.72);
    else if (spine1 && neck) swingBoneTowardWorldDir(spine1, neck, _vGoalA, w * 0.72);
  }

  // 2. Balance arms (gated by per-arm visibility lw/rw so occluded back-arms never cross chest!)
  const lw = w * (vcFrame.lw ?? 1);
  const rw = w * (vcFrame.rw ?? 1);
  const lArm = boneNodes.get('mixamorig:LeftArm');
  const lForeArm = boneNodes.get('mixamorig:LeftForeArm');
  const lHand = boneNodes.get('mixamorig:LeftHand');
  if (vcFrame.lu && lArm && lForeArm && lw > 0.01) {
    frameVecToWorldToRef(vcFrame.lu, isWS, _vLeft, _vFwd, _vGoalA);
    swingBoneTowardWorldDir(lArm, lForeArm, _vGoalA, lw * 0.90);
  }
  if (vcFrame.lf && lForeArm && lHand && lw > 0.01) {
    frameVecToWorldToRef(vcFrame.lf, isWS, _vLeft, _vFwd, _vGoalB);
    swingBoneTowardWorldDir(lForeArm, lHand, _vGoalB, lw * 0.88);
  }

  const rArm = boneNodes.get('mixamorig:RightArm');
  const rForeArm = boneNodes.get('mixamorig:RightForeArm');
  const rHand = boneNodes.get('mixamorig:RightHand');
  if (vcFrame.ru && rArm && rForeArm && rw > 0.01) {
    frameVecToWorldToRef(vcFrame.ru, isWS, _vLeft, _vFwd, _vGoalA);
    swingBoneTowardWorldDir(rArm, rForeArm, _vGoalA, rw * 0.92);
  }
  if (vcFrame.rf && rForeArm && rHand && rw > 0.01) {
    frameVecToWorldToRef(vcFrame.rf, isWS, _vLeft, _vFwd, _vGoalB);
    swingBoneTowardWorldDir(rForeArm, rHand, _vGoalB, rw * 0.90);
  }

  // 3. Reconstruct Left & Right Leg 3D targets + Turf-Stance Pelvis Height Coupling
  const lUpLeg = boneNodes.get('mixamorig:LeftUpLeg');
  const lLeg = boneNodes.get('mixamorig:LeftLeg');
  const lFoot = boneNodes.get('mixamorig:LeftFoot');
  const rUpLeg = boneNodes.get('mixamorig:RightUpLeg');
  const rLeg = boneNodes.get('mixamorig:RightLeg');
  const rFoot = boneNodes.get('mixamorig:RightFoot');
  if (!lUpLeg || !lLeg || !lFoot || !rUpLeg || !rLeg || !rFoot) return w;

  lUpLeg.computeWorldMatrix(true);
  lLeg.computeWorldMatrix(true);
  lFoot.computeWorldMatrix(true);
  rUpLeg.computeWorldMatrix(true);
  rLeg.computeWorldMatrix(true);
  rFoot.computeWorldMatrix(true);

  const HL = lUpLeg.getAbsolutePosition();
  const KL = lLeg.getAbsolutePosition();
  const AL = lFoot.getAbsolutePosition();
  const L1 = BABYLON.Vector3.Distance(HL, KL);
  const L2 = BABYLON.Vector3.Distance(KL, AL);

  frameVecToWorldToRef(vcFrame.lt, isWS, _vLeft, _vFwd, _vGoalA);
  frameVecToWorldToRef(vcFrame.ls, isWS, _vLeft, _vFwd, _vGoalB);
  const predLy = HL.y + L1 * _vGoalA.y + L2 * _vGoalB.y;
  _vPoleL.copyFrom(_vGoalA).subtractInPlace(_vGoalB);
  if (_vPoleL.lengthSquared() < 1e-4) _vPoleL.copyFrom(_vFwd);
  else _vPoleL.normalize();

  frameVecToWorldToRef(vcFrame.rt, isWS, _vLeft, _vFwd, _vGoalC);
  frameVecToWorldToRef(vcFrame.rs, isWS, _vLeft, _vFwd, _vGoalD);
  const HR = rUpLeg.getAbsolutePosition();
  const predRy = HR.y + L1 * _vGoalC.y + L2 * _vGoalD.y;
  _vPoleR.copyFrom(_vGoalC).subtractInPlace(_vGoalD);
  if (_vPoleR.lengthSquared() < 1e-4) _vPoleR.copyFrom(_vFwd);
  else _vPoleR.normalize();

  // Couple pelvis height so the stance ankle kisses turf y = 0.128m cleanly
  const minPredAnkleY = Math.min(predLy, predRy);
  const pelvisDeltaY = clamp(0.128 - minPredAnkleY, -0.14, 0.05) * w;
  posePivot.position.y = pelvisDeltaY;
  posePivot.computeWorldMatrix(true);
  if (gltfRoot) gltfRoot.computeWorldMatrix(true);
  if (hips) hips.computeWorldMatrix(true);
  lUpLeg.computeWorldMatrix(true);
  rUpLeg.computeWorldMatrix(true);

  const HL2 = lUpLeg.getAbsolutePosition();
  const HR2 = rUpLeg.getAbsolutePosition();

  _vAnkleGoalL.set(
    HL2.x + L1 * _vGoalA.x + L2 * _vGoalB.x,
    Math.max(0.126, HL2.y + L1 * _vGoalA.y + L2 * _vGoalB.y),
    HL2.z + L1 * _vGoalA.z + L2 * _vGoalB.z
  );
  _vAnkleGoalR.set(
    HR2.x + L1 * _vGoalC.x + L2 * _vGoalD.x,
    Math.max(0.126, HR2.y + L1 * _vGoalC.y + L2 * _vGoalD.y),
    HR2.z + L1 * _vGoalC.z + L2 * _vGoalD.z
  );

  solveCapturedLegIK(playerModel, true, _vAnkleGoalL, _vPoleL, _vFwd, _vLeft, w);
  solveCapturedLegIK(playerModel, false, _vAnkleGoalR, _vPoleR, _vFwd, _vLeft, w);
  return w;
}
