/**
 * VideoCaptureDriver — drives Mixamo skeleton from real match video 3D poses
 * 
 * Instead of hand-coded animation clips + manual IK, this module reads
 * actual 3D joint positions extracted from match video via MediaPipe
 * and uses anatomical IK to drive the character skeleton 1:1.
 */

const BABYLON = window.BABYLON;

/**
 * Apply video-captured 3D joint positions to a player model.
 * Uses the existing two-bone IK solver infrastructure.
 *
 * @param {Object} playerModel - Babylon.js player model from createFootballer
 * @param {Object} vcFrame - Video capture frame { j: { l_hip, l_knee, l_ankle, ... }, r: [x,y,z] }
 * @param {Object} state - Current actor state { x, z, yaw, ... }
 * @param {number} weight - Blend weight 0-1 (1 = fully video-driven)
 */
export function applyVideoCaptureFrame(playerModel, vcFrame, state, weight = 1.0) {
  if (!vcFrame || !vcFrame.j || weight <= 0.001) return;
  if (!playerModel || !playerModel.boneNodes) return;

  const { boneNodes } = playerModel;
  const w = Math.max(0, Math.min(1, weight));
  const j = vcFrame.j;

  // ─── 1. Hips orientation from hip-shoulder vectors ─────────────
  const hipsNode = boneNodes.get('mixamorig:Hips');
  if (hipsNode && j.l_hip && j.r_hip && j.l_shoulder && j.r_shoulder) {
    const lh = j.l_hip, rh = j.r_hip;
    const ls = j.l_shoulder, rs = j.r_shoulder;

    // Right direction
    const rx = rh[0] - lh[0], ry = rh[1] - lh[1], rz = rh[2] - lh[2];
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    const rightX = rx / rLen, rightY = ry / rLen, rightZ = rz / rLen;

    // Up direction (hips → shoulders)
    const hcx = (lh[0] + rh[0]) / 2, hcy = (lh[1] + rh[1]) / 2, hcz = (lh[2] + rh[2]) / 2;
    const scx = (ls[0] + rs[0]) / 2, scy = (ls[1] + rs[1]) / 2, scz = (ls[2] + rs[2]) / 2;
    let ux = scx - hcx, uy = scy - hcy, uz = scz - hcz;
    const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= uLen; uy /= uLen; uz /= uLen;

    // Forward = cross(right, up)
    let fx = rightY * uz - rightZ * uy;
    let fy = rightZ * ux - rightX * uz;
    let fz = rightX * uy - rightY * ux;
    const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= fLen; fy /= fLen; fz /= fLen;

    // Re-orthogonalize up
    uy = fz * rightX - fx * rightZ;
    uz = fx * rightY - fy * rightX;
    ux = fy * rightZ - fz * rightY;

    // Build rotation matrix → quaternion
    const m = BABYLON.Matrix.FromValues(
      rightX, rightY, rightZ, 0,
      ux, uy, uz, 0,
      fx, fy, fz, 0,
      0, 0, 0, 1
    );

    const qHips = new BABYLON.Quaternion();
    BABYLON.Quaternion.FromRotationMatrixToRef(m, qHips);

    // Blend with existing
    if (hipsNode.rotationQuaternion && w < 0.999) {
      BABYLON.Quaternion.SlerpToRef(hipsNode.rotationQuaternion, qHips, w, hipsNode.rotationQuaternion);
    } else {
      if (!hipsNode.rotationQuaternion) {
        hipsNode.rotationQuaternion = qHips.clone();
      } else {
        hipsNode.rotationQuaternion.copyFrom(qHips);
      }
    }
  }

  // ─── 2. Spine orientation ──────────────────────────────────────
  applySpineRotation(boneNodes, j, w);

  // ─── 3. Leg IK (the critical part!) ────────────────────────────
  applyLegIKFromCapture(playerModel, j, state, true, w);   // Left leg
  applyLegIKFromCapture(playerModel, j, state, false, w);  // Right leg

  // ─── 4. Arm rotations ─────────────────────────────────────────
  applyArmRotation(boneNodes, j, true, w);   // Left arm
  applyArmRotation(boneNodes, j, false, w);  // Right arm
}


function applySpineRotation(boneNodes, j, w) {
  const spine = boneNodes.get('mixamorig:Spine');
  const spine1 = boneNodes.get('mixamorig:Spine1');
  const spine2 = boneNodes.get('mixamorig:Spine2');
  const neck = boneNodes.get('mixamorig:Neck');

  if (!j.l_shoulder || !j.r_shoulder || !j.l_hip || !j.r_hip) return;

  // Spine direction: hips center → shoulders center
  const hcx = (j.l_hip[0] + j.r_hip[0]) / 2;
  const hcy = (j.l_hip[1] + j.r_hip[1]) / 2;
  const hcz = (j.l_hip[2] + j.r_hip[2]) / 2;
  const scx = (j.l_shoulder[0] + j.r_shoulder[0]) / 2;
  const scy = (j.l_shoulder[1] + j.r_shoulder[1]) / 2;
  const scz = (j.l_shoulder[2] + j.r_shoulder[2]) / 2;

  let dx = scx - hcx, dy = scy - hcy, dz = scz - hcz;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= len; dy /= len; dz /= len;

  // Rest direction is straight up [0, 1, 0]
  // Compute rotation from [0,1,0] to [dx,dy,dz]
  const qSpine = rotationFromTo(0, 1, 0, dx, dy, dz);

  // Distribute across spine chain (slight lean)
  const halfW = w * 0.4;
  if (spine && spine.rotationQuaternion) {
    BABYLON.Quaternion.SlerpToRef(spine.rotationQuaternion, qSpine, halfW, spine.rotationQuaternion);
  }
  if (spine1 && spine1.rotationQuaternion) {
    BABYLON.Quaternion.SlerpToRef(spine1.rotationQuaternion, qSpine, halfW * 0.6, spine1.rotationQuaternion);
  }

  // Neck towards nose
  if (neck && neck.rotationQuaternion && j.nose) {
    const nx = j.nose[0] - scx, ny = j.nose[1] - scy, nz = j.nose[2] - scz;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    const qNeck = rotationFromTo(0, 1, 0, nx / nLen, ny / nLen, nz / nLen);
    BABYLON.Quaternion.SlerpToRef(neck.rotationQuaternion, qNeck, w * 0.5, neck.rotationQuaternion);
  }
}


function applyLegIKFromCapture(playerModel, j, state, isLeft, w) {
  const side = isLeft ? 'Left' : 'Right';
  const prefix = isLeft ? 'l' : 'r';

  const hip = j[`${prefix}_hip`];
  const knee = j[`${prefix}_knee`];
  const ankle = j[`${prefix}_ankle`];
  const foot = j[`${prefix}_foot_idx`];
  const heel = j[`${prefix}_heel`];

  if (!hip || !knee || !ankle) return;

  const { boneNodes } = playerModel;
  const upLeg = boneNodes.get(`mixamorig:${side}UpLeg`);
  const leg = boneNodes.get(`mixamorig:${side}Leg`);
  const footNode = boneNodes.get(`mixamorig:${side}Foot`);
  const toeNode = boneNodes.get(`mixamorig:${side}ToeBase`);

  if (!upLeg || !leg || !footNode) return;

  // The hip joint's world position in the character
  refreshLegChain(playerModel, upLeg, leg, footNode, toeNode);
  const hipWorld = upLeg.getAbsolutePosition();

  // Build ankle goal in character-local space
  // The captured joint positions are hip-relative, so we offset from character position
  const charX = state.x || 0;
  const charZ = state.z || 0;
  const charYaw = state.yaw || 0;

  // Transform capture positions from hip-relative to character world space
  // Captured coords: hip-centered, Babylon Y-up
  // We need to rotate by character yaw and offset by character position
  const cosY = Math.cos(charYaw);
  const sinY = Math.sin(charYaw);

  // Ankle position relative to hip
  const ax = ankle[0] - hip[0];
  const ay = ankle[1] - hip[1];
  const az = ankle[2] - hip[2];

  // Rotate by character yaw
  const ankleWorldX = hipWorld.x + (ax * cosY + az * sinY);
  const ankleWorldY = Math.max(0.12, hipWorld.y + ay);
  const ankleWorldZ = hipWorld.z + (-ax * sinY + az * cosY);

  const ankleGoal = new BABYLON.Vector3(ankleWorldX, ankleWorldY, ankleWorldZ);

  // Knee direction for pole vector
  const kx = knee[0] - hip[0];
  const ky = knee[1] - hip[1];
  const kz = knee[2] - hip[2];

  const kneeWorldX = hipWorld.x + (kx * cosY + kz * sinY);
  const kneeWorldY = hipWorld.y + ky;
  const kneeWorldZ = hipWorld.z + (-kx * sinY + kz * cosY);

  const kneeWorld = new BABYLON.Vector3(kneeWorldX, kneeWorldY, kneeWorldZ);

  // Pole direction: from hip-ankle midpoint towards knee
  const midX = (hipWorld.x + ankleWorldX) / 2;
  const midY = (hipWorld.y + ankleWorldY) / 2;
  const midZ = (hipWorld.z + ankleWorldZ) / 2;

  const poleDir = new BABYLON.Vector3(
    kneeWorldX - midX,
    kneeWorldY - midY,
    kneeWorldZ - midZ
  ).normalize();

  // Toe direction
  let toeDir = null;
  if (foot && heel) {
    const tx = foot[0] - ankle[0];
    const ty = foot[1] - ankle[1];
    const tz = foot[2] - ankle[2];
    const toeWorldX = tx * cosY + tz * sinY;
    const toeWorldY = ty;
    const toeWorldZ = -tx * sinY + tz * cosY;
    toeDir = new BABYLON.Vector3(toeWorldX, toeWorldY, toeWorldZ).normalize();
  }

  // Call the existing two-bone IK solver
  solveTwoBoneLegIKDirect(playerModel, isLeft, ankleGoal, poleDir, 0, toeDir, w);
}


function applyArmRotation(boneNodes, j, isLeft, w) {
  const prefix = isLeft ? 'l' : 'r';
  const side = isLeft ? 'Left' : 'Right';

  const shoulder = j[`${prefix}_shoulder`];
  const elbow = j[`${prefix}_elbow`];
  const wrist = j[`${prefix}_wrist`];

  if (!shoulder || !elbow || !wrist) return;

  const armNode = boneNodes.get(`mixamorig:${side}Arm`);
  const foreArmNode = boneNodes.get(`mixamorig:${side}ForeArm`);

  if (!armNode || !foreArmNode) return;

  // Upper arm direction: shoulder → elbow
  let ux = elbow[0] - shoulder[0], uy = elbow[1] - shoulder[1], uz = elbow[2] - shoulder[2];
  const uLen = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
  ux /= uLen; uy /= uLen; uz /= uLen;

  // Rest direction: left arm = [1,0,0], right arm = [-1,0,0]
  const restX = isLeft ? 1 : -1;
  const qArm = rotationFromTo(restX, 0, 0, ux, uy, uz);
  if (armNode.rotationQuaternion) {
    BABYLON.Quaternion.SlerpToRef(armNode.rotationQuaternion, qArm, w * 0.7, armNode.rotationQuaternion);
  }

  // Forearm direction: elbow → wrist
  let fx = wrist[0] - elbow[0], fy = wrist[1] - elbow[1], fz = wrist[2] - elbow[2];
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  fx /= fLen; fy /= fLen; fz /= fLen;

  const qForeArm = rotationFromTo(restX, 0, 0, fx, fy, fz);
  if (foreArmNode.rotationQuaternion) {
    BABYLON.Quaternion.SlerpToRef(foreArmNode.rotationQuaternion, qForeArm, w * 0.7, foreArmNode.rotationQuaternion);
  }
}


// ─── Utility functions ───────────────────────────────────────────

function rotationFromTo(fx, fy, fz, tx, ty, tz) {
  // Rotation quaternion from unit vector (fx,fy,fz) to (tx,ty,tz)
  const fLen = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
  const tLen = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  fx /= fLen; fy /= fLen; fz /= fLen;
  tx /= tLen; ty /= tLen; tz /= tLen;

  const dot = fx * tx + fy * ty + fz * tz;
  if (dot > 0.9999) return BABYLON.Quaternion.Identity();
  if (dot < -0.9999) {
    // 180° rotation
    let ax = 0, ay = 1, az = 0;
    const cross = Math.abs(fx * ay - fy * ax);
    if (cross < 0.1) { ax = 1; ay = 0; az = 0; }
    return new BABYLON.Quaternion(ax, ay, az, 0).normalize();
  }

  // Cross product = rotation axis
  const cx = fy * tz - fz * ty;
  const cy = fz * tx - fx * tz;
  const cz = fx * ty - fy * tx;

  const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
  const sinHalf = Math.sin(halfAngle);
  const cosHalf = Math.cos(halfAngle);
  const axisLen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;

  return new BABYLON.Quaternion(
    (cx / axisLen) * sinHalf,
    (cy / axisLen) * sinHalf,
    (cz / axisLen) * sinHalf,
    cosHalf
  );
}


function refreshLegChain(playerModel, upLeg, leg, foot, toe) {
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


function solveTwoBoneLegIKDirect(playerModel, isLeft, ankleGoalWorld, poleDirWorld, turnoutRad, toeDirGoalWorld, weight) {
  // Reuse the existing IK solver logic from babylonPlayer.js
  // This is a simplified inline version
  const w = Math.max(0, Math.min(1, weight));
  if (w <= 0.001) return;

  const { boneNodes } = playerModel;
  const side = isLeft ? 'Left' : 'Right';
  const upLeg = boneNodes.get(`mixamorig:${side}UpLeg`);
  const leg = boneNodes.get(`mixamorig:${side}Leg`);
  const foot = boneNodes.get(`mixamorig:${side}Foot`);
  const toe = boneNodes.get(`mixamorig:${side}ToeBase`);
  if (!upLeg || !leg || !foot) return;

  // Save FK rotations
  const qUpLegFK = upLeg.rotationQuaternion.clone();
  const qLegFK = leg.rotationQuaternion.clone();
  const qFootFK = foot.rotationQuaternion.clone();

  refreshLegChain(playerModel, upLeg, leg, foot, toe);
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
  d = Math.max(0.42 * totalLen, Math.min(0.952 * totalLen, d));
  const AGoal = H.add(uHA.scale(d));

  const cosAlpha = Math.max(-0.995, Math.min(0.995,
    (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  let polePerp = poleDirWorld.subtract(uHA.scale(BABYLON.Vector3.Dot(poleDirWorld, uHA)));
  if (polePerp.lengthSquared() < 1e-5) {
    const yaw = playerModel.root.rotation.y || 0;
    const fwd = new BABYLON.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    polePerp = fwd.subtract(uHA.scale(BABYLON.Vector3.Dot(fwd, uHA)));
  }
  polePerp.normalize();

  const KGoal = H.add(uHA.scale(L1 * cosAlpha)).add(polePerp.scale(L1 * sinAlpha));

  // Thigh rotation
  const uThighCur = KCur.subtract(H).normalize();
  const uThighGoal = KGoal.subtract(H).normalize();
  const qSwing = rotQFromUnitVecs(uThighCur, uThighGoal);
  applyWorldDelta(upLeg, qSwing);
  upLeg.computeWorldMatrix(true);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);

  // Shin rotation
  const KNow = leg.getAbsolutePosition().clone();
  const ANow = foot.getAbsolutePosition().clone();
  const uShinCur = ANow.subtract(KNow).normalize();
  const uShinGoal = AGoal.subtract(KNow).normalize();
  const qShin = rotQFromUnitVecs(uShinCur, uShinGoal);
  applyWorldDelta(leg, qShin);
  leg.computeWorldMatrix(true);
  foot.computeWorldMatrix(true);

  // Toe direction
  if (toe && toeDirGoalWorld) {
    const AFinal = foot.getAbsolutePosition().clone();
    const TNow = toe.getAbsolutePosition().clone();
    const uToeCur = TNow.subtract(AFinal);
    if (uToeCur.lengthSquared() > 1e-5) {
      uToeCur.normalize();
      const uToeGoal = toeDirGoalWorld.clone().normalize();
      const qToe = rotQFromUnitVecs(uToeCur, uToeGoal);
      applyWorldDelta(foot, qToe);
    }
  }

  // Blend IK ↔ FK
  const qUpLegIK = upLeg.rotationQuaternion.clone();
  const qLegIK = leg.rotationQuaternion.clone();
  const qFootIK = foot.rotationQuaternion.clone();
  BABYLON.Quaternion.SlerpToRef(qUpLegFK, qUpLegIK, w, upLeg.rotationQuaternion);
  BABYLON.Quaternion.SlerpToRef(qLegFK, qLegIK, w, leg.rotationQuaternion);
  BABYLON.Quaternion.SlerpToRef(qFootFK, qFootIK, w, foot.rotationQuaternion);
}


function rotQFromUnitVecs(from, to) {
  const dot = BABYLON.Vector3.Dot(from, to);
  if (dot > 0.9999) return BABYLON.Quaternion.Identity();
  if (dot < -0.9999) {
    const perp = Math.abs(from.x) < 0.9
      ? BABYLON.Vector3.Cross(from, BABYLON.Axis.X)
      : BABYLON.Vector3.Cross(from, BABYLON.Axis.Y);
    perp.normalize();
    return new BABYLON.Quaternion(perp.x, perp.y, perp.z, 0);
  }
  const axis = BABYLON.Vector3.Cross(from, to).normalize();
  const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
  const s = Math.sin(halfAngle);
  return new BABYLON.Quaternion(axis.x * s, axis.y * s, axis.z * s, Math.cos(halfAngle));
}


function applyWorldDelta(node, qWorldDelta) {
  const parent = node.parent;
  if (!parent) {
    node.rotationQuaternion = qWorldDelta.multiply(node.rotationQuaternion);
    return;
  }
  parent.computeWorldMatrix(true);
  const qParentWorld = new BABYLON.Quaternion();
  parent.getWorldMatrix().decompose(undefined, qParentWorld, undefined);
  const qParentInv = BABYLON.Quaternion.Inverse(qParentWorld);

  const qLocalDelta = qParentInv.multiply(qWorldDelta).multiply(qParentWorld);
  node.rotationQuaternion = qLocalDelta.multiply(node.rotationQuaternion);
  node.rotationQuaternion.normalize();
}
