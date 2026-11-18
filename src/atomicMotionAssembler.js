const BABYLON = typeof window !== 'undefined' ? window.BABYLON : null;
import { SOCCER_ATOMIC_CATALOG, SOCCER_ATOMIC_BY_ID } from './soccerAtomicCatalog.js';

const atomicClipCache = new Map();
let preloadAllPromise = null;

// Zero-GC scratch math primitives for 60fps evaluation
const _qArm = BABYLON ? new BABYLON.Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2) : null;
const _qArmInv = BABYLON ? new BABYLON.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2) : null;
const _qTmpA = BABYLON ? new BABYLON.Quaternion() : null;
const _qTmpB = BABYLON ? new BABYLON.Quaternion() : null;
const _qInertial = BABYLON ? new BABYLON.Quaternion() : null;
const _vFwd = BABYLON ? new BABYLON.Vector3() : null;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function wrapPi(a) {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}

function smoothstep01(u) {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Quintic C2-continuous decay kernel h(s) on s in [0, 1]:
 *   h(0) = 1, h'(0) = 0, h''(0) = 0
 *   h(1) = 0, h'(1) = 0, h''(1) = 0
 */
function quinticDecay01(s) {
  const u = clamp(s, 0, 1);
  return 1 - u * u * u * (10 - 15 * u + 6 * u * u);
}

function rotateVecByQuatToRef(q, vx, vy, vz, out) {
  const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  out.set(
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx
  );
  return out;
}

// Exact stance-foot sweep ground velocities (m/s in local +X left, +Z forward) measured from
// Mixamo's in-place locomotion clips so planted boots lock to the 1.0m grid with zero slip.
const TREADMILL_GROUND_VEL = {
  loco_walk_fwd: [0.0, 1.24],
  loco_walk_back: [0.0, -0.95],
  loco_strafe_walk_l: [-0.25, 0.91],
  loco_strafe_walk_r: [0.25, 0.91],
  loco_dribble_jog: [0.0, 2.01],
  loco_sprint_fwd: [0.0, 4.93],
  loco_sprint_back: [0.0, -1.65],
  def_jockey_back: [1.09, -1.87],
  def_shuffle_l: [1.86, -0.14],
  def_shuffle_r: [-1.86, -0.14],
  touch_diag_take_l: [0.72, 1.90],
  touch_diag_take_r: [-0.72, 1.90]
};

/**
 * Extracts dense root-motion curve (world meters X, Y, Z + unwrapped body facing yaw)
 * from a loaded 65-bone canonical atomic clip.
 */
function buildClipRootProfile(rotMap, hipsPosAnim, from, to, fps, duration, meta) {
  const samplesCount = Math.max(8, Math.ceil(duration * 30) + 1);
  const samples = [];
  const hipsRotAnim = rotMap.get('mixamorig:Hips');
  const sp2RotAnim = rotMap.get('mixamorig:Spine2');
  const sp1RotAnim = rotMap.get('mixamorig:Spine1');
  const spRotAnim = rotMap.get('mixamorig:Spine');
  const treadVel = meta && TREADMILL_GROUND_VEL[meta.id] ? TREADMILL_GROUND_VEL[meta.id] : null;

  let prevYaw = 0;
  let baseRawYaw = 0;

  for (let i = 0; i < samplesCount; i++) {
    const uSec = (duration * i) / (samplesCount - 1);
    const frame = clamp(from + uSec * fps, from, to);
    const hp = hipsPosAnim ? hipsPosAnim.evaluate(frame) : { x: 0, y: 0, z: -91 };

    // Armature (+90 deg X, 0.01 scale): worldX = 0.01*tx, worldY = -0.01*tz, worldZ = 0.01*ty
    const wx = treadVel ? treadVel[0] * uSec : hp.x * 0.01;
    const wy = -hp.z * 0.01;
    const wz = treadVel ? treadVel[1] * uSec : hp.y * 0.01;

    let rawYaw = prevYaw;
    if (hipsRotAnim) {
      const qH = hipsRotAnim.evaluate(frame);
      const wH = _qArm.multiply(qH);
      rotateVecByQuatToRef(wH, 0, 0, 1, _vFwd);
      let fx = _vFwd.x;
      let fz = _vFwd.z;

      if (spRotAnim && sp1RotAnim && sp2RotAnim) {
        const wS2 = wH
          .multiply(spRotAnim.evaluate(frame))
          .multiply(sp1RotAnim.evaluate(frame))
          .multiply(sp2RotAnim.evaluate(frame));
        rotateVecByQuatToRef(wS2, 0, 0, 1, _vFwd);
        fx = fx * 0.65 + _vFwd.x * 0.35;
        fz = fz * 0.65 + _vFwd.z * 0.35;
      }

      if (fx * fx + fz * fz > 0.04) {
        rawYaw = Math.atan2(fx, fz);
      }
    }

    if (i === 0) {
      baseRawYaw = rawYaw;
    }
    const relYaw = rawYaw - baseRawYaw;
    const unwrappedYaw = i === 0 ? 0 : prevYaw + wrapPi(relYaw - prevYaw);
    prevYaw = unwrappedYaw;
    samples.push({ t: uSec, x: wx, y: wy, z: wz, hLocalZ: hp.z, yaw: unwrappedYaw });
  }

  return {
    samples,
    netDx: samples[samples.length - 1].x - samples[0].x,
    netDz: samples[samples.length - 1].z - samples[0].z,
    netDyaw: samples[samples.length - 1].yaw - samples[0].yaw,
    meta
  };
}

/**
 * Samples unwrapped root motion `(x, y, z, hLocalZ, yaw)` of an atomic clip at `uSec >= 0`,
 * seamlessly accumulating multi-cycle displacement when `clip.loop === true`.
 */
export function sampleAtomicRootAtTime(clip, uSec) {
  const dur = Math.max(0.02, clip.duration);
  const prof = clip.rootProfile;
  const arr = prof.samples;
  const n = arr.length;

  let cycles = 0;
  let rem = uSec;
  if (clip.loop && uSec >= 0) {
    cycles = Math.floor(uSec / dur);
    rem = uSec - cycles * dur;
  } else {
    rem = clamp(uSec, 0, dur);
  }

  const fIdx = clamp((rem / dur) * (n - 1), 0, n - 1);
  const i0 = Math.min(n - 2, Math.floor(fIdx));
  const i1 = i0 + 1;
  const alpha = fIdx - i0;

  const s0 = arr[i0];
  const s1 = arr[i1];
  const rx = s0.x + (s1.x - s0.x) * alpha;
  const ry = s0.y + (s1.y - s0.y) * alpha;
  const rz = s0.z + (s1.z - s0.z) * alpha;
  const hz = s0.hLocalZ + (s1.hLocalZ - s0.hLocalZ) * alpha;
  const ryaw = s0.yaw + (s1.yaw - s0.yaw) * alpha;

  if (cycles === 0) {
    return { x: rx, y: ry, z: rz, hLocalZ: hz, yaw: ryaw };
  }

  // Accumulate exact multi-cycle trajectory for looping clips
  let accX = 0;
  let accZ = 0;
  let accYaw = 0;
  for (let c = 0; c < cycles; c++) {
    const cy = Math.cos(accYaw);
    const sy = Math.sin(accYaw);
    accX += prof.netDx * cy + prof.netDz * sy;
    accZ += -prof.netDx * sy + prof.netDz * cy;
    accYaw += prof.netDyaw;
  }
  const cy = Math.cos(accYaw);
  const sy = Math.sin(accYaw);
  return {
    x: accX + rx * cy + rz * sy,
    y: ry,
    z: accZ - rx * sy + rz * cy,
    hLocalZ: hz,
    yaw: accYaw + ryaw
  };
}

export async function loadSingleAtomicClip(scene, clipId) {
  if (atomicClipCache.has(clipId)) return atomicClipCache.get(clipId);
  const entry = SOCCER_ATOMIC_BY_ID.get(clipId);
  if (!entry) return null;

  const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
    './assets/mocap_atomic/',
    entry.file,
    scene
  );
  const ag = container.animationGroups[0];
  if (!ag) {
    container.dispose();
    return null;
  }

  const rotMap = new Map();
  let hipsPosAnim = null;
  let fps = 60;

  for (const ta of ag.targetedAnimations) {
    const tName = ta.target ? ta.target.name : '';
    const prop = ta.animation.targetProperty;
    fps = ta.animation.framePerSecond || fps;
    if (prop === 'rotationQuaternion' && tName) {
      rotMap.set(tName, ta.animation);
    } else if (prop === 'position' && tName === 'mixamorig:Hips') {
      hipsPosAnim = ta.animation;
    }
  }

  const from = ag.from;
  const to = ag.to;
  const duration = Math.max(0.05, (to - from) / fps);
  const rootProfile = buildClipRootProfile(rotMap, hipsPosAnim, from, to, fps, duration, entry);

  const clipObj = {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    categoryLabel: entry.categoryLabel,
    source: entry.source,
    loop: entry.loop,
    groundExcursion: entry.groundExcursion,
    from,
    to,
    fps,
    duration,
    rotMap,
    hipsPosAnim,
    rootProfile,
    meta: entry
  };

  atomicClipCache.set(entry.id, clipObj);
  ag.stop();
  container.dispose();
  return clipObj;
}

/**
 * Preloads the entire 86-clip White-Model Football Atomic Library in fast parallel batches.
 */
export function preloadSoccerAtomicLibrary(scene, onProgress) {
  if (preloadAllPromise) return preloadAllPromise;

  let completed = 0;
  const total = SOCCER_ATOMIC_CATALOG.length;

  preloadAllPromise = (async () => {
    const BATCH_SIZE = 18;
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const slice = SOCCER_ATOMIC_CATALOG.slice(i, i + BATCH_SIZE);
      await Promise.all(
        slice.map(async (entry) => {
          try {
            await loadSingleAtomicClip(scene, entry.id);
          } catch (err) {
            console.warn(`[AtomicMocap] Failed to load ${entry.file}:`, err);
          } finally {
            completed++;
            if (onProgress) onProgress(completed, total);
          }
        })
      );
    }
    return atomicClipCache;
  })();

  return preloadAllPromise;
}

export function getAtomicClip(clipId) {
  return atomicClipCache.get(clipId) || null;
}

function sampleClipLocalFrame(clip, uSec) {
  const dur = clip.duration;
  const localSec = clip.loop
    ? ((uSec % dur) + dur) % dur
    : clamp(uSec, 0, Math.max(0.0005, dur - 0.0005));
  return clamp(clip.from + localSec * clip.fps, clip.from, clip.to);
}

function evaluateClipPoseMap(clip, uSec, boneNames, restRotMap) {
  const frame = sampleClipLocalFrame(clip, uSec);
  const pose = new Map();
  for (const bName of boneNames) {
    const anim = clip.rotMap.get(bName);
    if (anim) {
      pose.set(bName, anim.evaluate(frame).clone().normalize());
    } else if (restRotMap && restRotMap.has(bName)) {
      pose.set(bName, restRotMap.get(bName).clone());
    } else {
      pose.set(bName, new BABYLON.Quaternion(0, 0, 0, 1));
    }
  }
  const hp = clip.hipsPosAnim ? clip.hipsPosAnim.evaluate(frame) : { x: 0, y: 0, z: -91 };
  return { pose, hLocalX: hp.x, hLocalY: hp.y, hLocalZ: hp.z };
}

function quatToShortestAxisAngle(q) {
  let qx = q.x, qy = q.y, qz = q.z, qw = q.w;
  if (qw < 0) {
    qx = -qx; qy = -qy; qz = -qz; qw = -qw;
  }
  qw = clamp(qw, -1, 1);
  const sinHalf = Math.hypot(qx, qy, qz);
  if (sinHalf < 1e-6) {
    return { axis: new BABYLON.Vector3(1, 0, 0), angle: 0 };
  }
  const angle = 2 * Math.acos(qw);
  return {
    axis: new BABYLON.Vector3(qx / sinHalf, qy / sinHalf, qz / sinHalf),
    angle
  };
}

/**
 * Compiles a multi-clip ActionSequence into a deterministic, random-access scrubbable
 * trajectory & C2-Inertialized skeletal timeline.
 *
 * Each segment in `seqSpec.segments`:
 *   - `clipId`: ID in `SOCCER_ATOMIC_CATALOG`
 *   - `clipIn`: entry timestamp in clip (s), default `0`
 *   - `clipOut`: exit timestamp in clip (s); for `loop: true`, may exceed `clip.duration`!
 *   - `rate`: playback rate in `[0.72, 1.35]`, default `1.0`
 *   - `warpScale`: subtle horizontal root stride scale `[0.65, 1.35]`, default `1.0`
 *   - `warpYawDeg`: smooth steering yaw delta across segment (deg), default `0`
 *   - `blendSec`: C2 inertial transition window (s), default `0.22`
 *   - `note`: optional human-readable tactical sub-label
 */
export function compileActionSequence(seqSpec, boneNames, restRotMap) {
  const segmentsOut = [];
  let curT = seqSpec.tOffset || 0;
  let curX = seqSpec.startX || 0;
  let curZ = seqSpec.startZ || 0;
  let curFacingYaw = seqSpec.startYaw || 0;

  const denseSamples = []; // 60Hz trajectory lookup table

  for (let idx = 0; idx < seqSpec.segments.length; idx++) {
    const rawSeg = seqSpec.segments[idx];
    const clip = getAtomicClip(rawSeg.clipId);
    if (!clip) {
      console.warn(`[SequenceAssembler] Missing atomic clip: ${rawSeg.clipId}`);
      continue;
    }

    const clipIn = Math.max(0, rawSeg.clipIn ?? 0);
    let clipOut;
    let rate;
    if (clip.loop) {
      rate = clamp(rawSeg.rate ?? 1.0, 0.55, 1.55);
      const defaultOut = rawSeg.durationSec ? clipIn + rawSeg.durationSec * rate : clip.duration;
      clipOut = Math.max(clipIn + 0.08, rawSeg.clipOut ?? defaultOut);
      if (rawSeg.durationSec) {
        rate = (clipOut - clipIn) / Math.max(0.08, rawSeg.durationSec);
      }
    } else {
      clipOut = clamp(rawSeg.clipOut ?? clip.duration, clipIn + 0.06, clip.duration);
      rate = rawSeg.durationSec
        ? (clipOut - clipIn) / Math.max(0.08, rawSeg.durationSec)
        : clamp(rawSeg.rate ?? 1.0, 0.45, 1.75);
    }

    const segDur = (clipOut - clipIn) / rate;
    const blendSec = idx === 0 ? 0 : clamp(rawSeg.blendSec ?? 0.22, 0.06, Math.min(0.42, segDur * 0.75));

    const rIn = sampleAtomicRootAtTime(clip, clipIn);
    const rOut = sampleAtomicRootAtTime(clip, clipOut);
    // Align root node yaw so clip's body yaw at `clipIn` equals `curFacingYaw`!
    const baseRootYaw = curFacingYaw - rIn.yaw;

    let warpYawRad = ((rawSeg.warpYawDeg ?? 0) * Math.PI) / 180;
    if (typeof rawSeg.endFacingYaw === 'number') {
      const naturalExitYaw = baseRootYaw + rOut.yaw;
      warpYawRad =
        typeof rawSeg.rawSpinRad === 'number'
          ? rawSeg.rawSpinRad
          : wrapPi(rawSeg.endFacingYaw - naturalExitYaw);
    }
    const effectiveWarpYawDeg = (warpYawRad * 180) / Math.PI;

    const steps = Math.max(4, Math.ceil(segDur * 60));

    // Measure unscaled optical chord first so `warpScale` matches real stride distance when `endAnchor` is set
    let warpScale = clamp(rawSeg.warpScale ?? 1.0, 0.0, 1.75);
    if (Array.isArray(rawSeg.endAnchor) && rawSeg.warpScale === undefined) {
      let tx = 0;
      let tz = 0;
      let pvx = rIn.x;
      let pvz = rIn.z;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const uClip = clipIn + frac * (clipOut - clipIn);
        const rCur = sampleAtomicRootAtTime(clip, uClip);
        const ry = baseRootYaw + warpYawRad * smoothstep01(frac);
        const dcx = rCur.x - pvx;
        const dcz = rCur.z - pvz;
        tx += dcx * Math.cos(ry) + dcz * Math.sin(ry);
        tz += -dcx * Math.sin(ry) + dcz * Math.cos(ry);
        pvx = rCur.x;
        pvz = rCur.z;
      }
      const natDist = Math.hypot(tx, tz);
      const tgtDist = Math.hypot(rawSeg.endAnchor[0] - curX, rawSeg.endAnchor[1] - curZ);
      if (natDist > 0.32) {
        warpScale = clamp(tgtDist / natDist, 0.45, 1.55);
      }
    }

    let px = curX;
    let pz = curZ;
    let prevClipX = rIn.x;
    let prevClipZ = rIn.z;

    const segTrack = [];
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps;
      const tAbs = curT + frac * segDur;
      const uClip = clipIn + frac * (clipOut - clipIn);
      const rCur = sampleAtomicRootAtTime(clip, uClip);
      const steerYaw = warpYawRad * smoothstep01(frac);
      const rootYawNow = baseRootYaw + steerYaw;

      if (s > 0) {
        const dcx = (rCur.x - prevClipX) * warpScale;
        const dcz = (rCur.z - prevClipZ) * warpScale;
        const cy = Math.cos(rootYawNow);
        const sy = Math.sin(rootYawNow);
        px += dcx * cy + dcz * sy;
        pz += -dcx * sy + dcz * cy;
        prevClipX = rCur.x;
        prevClipZ = rCur.z;
      }

      const bodyFacingYaw = rootYawNow + rCur.yaw;
      const pt = {
        t: tAbs,
        segIdx: segmentsOut.length,
        uClip,
        x: px,
        y: rCur.y,
        z: pz,
        rootYaw: rootYawNow,
        facingYaw: bodyFacingYaw
      };
      segTrack.push(pt);
      if (s < steps || idx === seqSpec.segments.length - 1) {
        denseSamples.push(pt);
      }
    }

    // Apply gentle C1-zero-boundary anchor feathering if `endAnchor` is specified
    if (Array.isArray(rawSeg.endAnchor)) {
      const rawEnd = segTrack[segTrack.length - 1];
      const errX = rawSeg.endAnchor[0] - rawEnd.x;
      const errZ = rawSeg.endAnchor[1] - rawEnd.z;
      for (let s = 0; s <= steps; s++) {
        const w = smoothstep01(s / steps);
        segTrack[s].x += errX * w;
        segTrack[s].z += errZ * w;
      }
    }

    const endPt = segTrack[segTrack.length - 1];
    segmentsOut.push({
      index: segmentsOut.length,
      clipId: clip.id,
      clip,
      label: clip.label,
      note: rawSeg.note || clip.label,
      tStart: curT,
      tEnd: curT + segDur,
      duration: segDur,
      clipIn,
      clipOut,
      rate,
      warpScale,
      warpYawDeg: effectiveWarpYawDeg,
      blendSec,
      startRootYaw: segTrack[0].rootYaw,
      endRootYaw: endPt.rootYaw,
      segTrack,
      inertialOffsets: null,
      hipsDeltaZ0: 0
    });

    curT += segDur;
    curX = endPt.x;
    curZ = endPt.z;
    curFacingYaw = endPt.facingYaw;
  }

  // Compute finite-difference velocities on denseSamples
  for (let i = 0; i < denseSamples.length; i++) {
    const p0 = denseSamples[Math.max(0, i - 1)];
    const p1 = denseSamples[Math.min(denseSamples.length - 1, i + 1)];
    const dt = Math.max(1e-4, p1.t - p0.t);
    denseSamples[i].vx = (p1.x - p0.x) / dt;
    denseSamples[i].vz = (p1.z - p0.z) / dt;
    denseSamples[i].speed = Math.hypot(denseSamples[i].vx, denseSamples[i].vz);
  }

  // Precompute exact C2 Inertialization offsets across every segment seam
  if (boneNames && boneNames.length > 0) {
    for (let k = 1; k < segmentsOut.length; k++) {
      const prevSeg = segmentsOut[k - 1];
      const nextSeg = segmentsOut[k];
      const uPrevEnd = prevSeg.clipOut;
      const dtProbe = 0.025;
      const uPrevBefore = Math.max(prevSeg.clipIn, uPrevEnd - dtProbe * prevSeg.rate);

      const evalPrevEnd = evaluateClipPoseMap(prevSeg.clip, uPrevEnd, boneNames, restRotMap);
      const evalPrevBefore = evaluateClipPoseMap(prevSeg.clip, uPrevBefore, boneNames, restRotMap);
      const evalNextStart = evaluateClipPoseMap(nextSeg.clip, nextSeg.clipIn, boneNames, restRotMap);

      // Compensate Hips local rotation for the root-node yaw handoff `deltaRootYaw`!
      const deltaRootYaw = nextSeg.startRootYaw - prevSeg.endRootYaw;
      if (Math.abs(deltaRootYaw) > 1e-5) {
        const qWorldComp = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, -deltaRootYaw);
        const qArmConj = _qArmInv.multiply(qWorldComp).multiply(_qArm).normalize();
        const qH0 = evalPrevEnd.pose.get('mixamorig:Hips');
        const qHB = evalPrevBefore.pose.get('mixamorig:Hips');
        if (qH0) evalPrevEnd.pose.set('mixamorig:Hips', qArmConj.multiply(qH0).normalize());
        if (qHB) evalPrevBefore.pose.set('mixamorig:Hips', qArmConj.multiply(qHB).normalize());
      }

      const offsets = new Map();
      for (const bName of boneNames) {
        const qA = evalPrevEnd.pose.get(bName);
        const qABefore = evalPrevBefore.pose.get(bName);
        const qB = evalNextStart.pose.get(bName);
        if (!qA || !qB) continue;

        // Shortest-hemisphere alignment: qDiff = qA * inv(qB) so qDiff * qB == qA
        const qBInv = BABYLON.Quaternion.Inverse(qB);
        const qDiff = qA.multiply(qBInv).normalize();
        const { axis, angle } = quatToShortestAxisAngle(qDiff);

        // Estimate incoming angular rate along `axis` for C1 velocity continuity
        let omega0 = 0;
        if (qABefore && uPrevEnd - uPrevBefore > 1e-4) {
          const qStep = qA.multiply(BABYLON.Quaternion.Inverse(qABefore)).normalize();
          const stepAA = quatToShortestAxisAngle(qStep);
          const proj = BABYLON.Vector3.Dot(stepAA.axis, axis);
          const dtReal = (uPrevEnd - uPrevBefore) / prevSeg.rate;
          omega0 = clamp((stepAA.angle * proj) / dtReal, -7.5, 7.5);
        }

        if (angle > 0.0008 || Math.abs(omega0) > 0.02) {
          offsets.set(bName, { axis, theta0: angle, omega0 });
        }
      }

      nextSeg.inertialOffsets = offsets;
      nextSeg.hipsDeltaZ0 = evalPrevEnd.hLocalZ - evalNextStart.hLocalZ;
    }
  }

  return {
    id: seqSpec.id || 'assembled_seq',
    totalDuration: curT,
    segments: segmentsOut,
    denseSamples
  };
}

/**
 * Samples world kinematic trajectory `(x, z, rootYaw, facingYaw, vx, vz, speed, activeSeg, uClip)`
 * at any timestamp `tSec` in O(log N) time.
 */
export function sampleCompiledTrajectory(compiled, tSec) {
  const arr = compiled.denseSamples;
  if (!arr || arr.length === 0) {
    return { x: 0, z: 0, rootYaw: 0, facingYaw: 0, vx: 0, vz: 0, speed: 0, segIdx: 0, uClip: 0 };
  }
  const t = clamp(tSec, arr[0].t, arr[arr.length - 1].t);
  let lo = 0;
  let hi = arr.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = arr[lo];
  const b = arr[hi];
  const span = Math.max(1e-6, b.t - a.t);
  const alpha = clamp((t - a.t) / span, 0, 1);

  // Segment index & exact uClip come directly from the segment owning `t`
  let segIdx = a.segIdx;
  for (let k = 0; k < compiled.segments.length; k++) {
    const sg = compiled.segments[k];
    if (t >= sg.tStart && (t < sg.tEnd || k === compiled.segments.length - 1)) {
      segIdx = k;
      break;
    }
  }
  const seg = compiled.segments[segIdx];
  const uClip = seg
    ? seg.clipIn + clamp(t - seg.tStart, 0, seg.duration) * seg.rate
    : a.uClip;

  // Root yaw inside the same segment is continuous; across exact seam pick `seg`'s interpolated rootYaw
  let rootYaw = a.rootYaw;
  if (a.segIdx === b.segIdx) {
    rootYaw = a.rootYaw + wrapPi(b.rootYaw - a.rootYaw) * alpha;
  } else if (seg) {
    const fracSeg = clamp((t - seg.tStart) / Math.max(1e-5, seg.duration), 0, 1);
    rootYaw = seg.startRootYaw + ((seg.warpYawDeg * Math.PI) / 180) * smoothstep01(fracSeg);
  }

  const facingYaw = a.facingYaw + wrapPi(b.facingYaw - a.facingYaw) * alpha;

  return {
    x: a.x + (b.x - a.x) * alpha,
    y: a.y + (b.y - a.y) * alpha,
    z: a.z + (b.z - a.z) * alpha,
    rootYaw,
    facingYaw,
    vx: a.vx + (b.vx - a.vx) * alpha,
    vz: a.vz + (b.vz - a.vz) * alpha,
    speed: a.speed + (b.speed - a.speed) * alpha,
    segIdx,
    seg,
    uClip
  };
}

/**
 * Applies the C2-Inertialized 65-bone pose of `compiled` at `tSec` directly onto `playerModel`,
 * with zero per-frame heap allocations!
 */
export function applyCompiledSequencePose(playerModel, compiled, tSec) {
  const sample = sampleCompiledTrajectory(compiled, tSec);
  const seg = sample.seg;
  if (!seg || !seg.clip) return sample;

  const clip = seg.clip;
  const frame = sampleClipLocalFrame(clip, sample.uClip);
  const { boneNodes, restRot } = playerModel;

  const dtInSeg = Math.max(0, tSec - seg.tStart);
  const inInertial = seg.blendSec > 0.001 && dtInSeg < seg.blendSec && seg.inertialOffsets;
  const sBlend = inInertial ? clamp(dtInSeg / seg.blendSec, 0, 1) : 1;
  const decayPos = inInertial ? quinticDecay01(sBlend) : 0;
  const omFactor = inInertial ? seg.blendSec * sBlend * Math.pow(1 - sBlend, 3) : 0;

  // 1. Hips vertical bounce (horizontal X/Z is already driven on `playerModel.root.position`!)
  const hipsNode = boneNodes.get('mixamorig:Hips');
  if (hipsNode && clip.hipsPosAnim) {
    const rawH = clip.hipsPosAnim.evaluate(frame);
    if (clip.groundExcursion && seg.warpScale > 0.01) {
      hipsNode.position.set(0, 0, rawH.z + (inInertial ? seg.hipsDeltaZ0 * decayPos : 0));
    } else {
      hipsNode.position.set(0, 0, rawH.z + (inInertial ? seg.hipsDeltaZ0 * decayPos : 0));
    }
  }

  // 2. Evaluate all 65 bone rotations + C2 Inertialization decay across clip seams
  for (const [boneName, tn] of boneNodes.entries()) {
    const anim = clip.rotMap.get(boneName);
    const rRest = restRot.get(boneName);
    const qEval = anim ? anim.evaluate(frame) : rRest;
    _qTmpA.copyFrom(qEval);

    if (inInertial) {
      const off = seg.inertialOffsets.get(boneName);
      if (off) {
        const thetaNow = off.theta0 * decayPos + off.omega0 * omFactor;
        if (Math.abs(thetaNow) > 0.0003) {
          BABYLON.Quaternion.RotationAxisToRef(off.axis, thetaNow, _qInertial);
          _qInertial.multiplyToRef(_qTmpA, _qTmpB);
          _qTmpA.copyFrom(_qTmpB).normalize();
        }
      }
    }

    tn.rotationQuaternion.copyFrom(_qTmpA);
  }

  return {
    ...sample,
    inInertial,
    inertialPct: inInertial ? Math.round((1 - sBlend) * 100) : 0
  };
}
