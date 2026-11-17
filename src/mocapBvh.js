import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';

export const CMU_SOCCER_MOCAPS = [
  {
    id: 'cmu-10-01',
    label: 'CMU 10_01 · 120Hz 光学动捕：斜向助跑脚背抽射',
    url: './assets/mocap/10_01.bvh',
    fps: 120,
    strikeNormT: 0.56
  },
  {
    id: 'cmu-10-05',
    label: 'CMU 10_05 · 120Hz 光学动捕：碎步调整支撑踝与大力击球',
    url: './assets/mocap/10_05.bvh',
    fps: 120,
    strikeNormT: 0.53
  },
  {
    id: 'cmu-11-01',
    label: 'CMU 11_01 · 120Hz 光学动捕：沉髋摆臂发力射门全周期',
    url: './assets/mocap/11_01.bvh',
    fps: 120,
    strikeNormT: 0.50
  }
];

// Maps Mixamo clean bone name -> CMU BVH bone name
const RETARGET_BONE_PAIRS = [
  ['Hips', 'Hips'],
  ['Spine', 'Spine'],
  ['Spine1', 'Spine1'],
  ['Neck', 'Neck1'],
  ['Head', 'Head'],
  ['LeftShoulder', 'LeftShoulder'],
  ['LeftArm', 'LeftArm'],
  ['LeftForeArm', 'LeftForeArm'],
  ['LeftHand', 'LeftHand'],
  ['LeftHandIndex1', 'LeftHandIndex1'],
  ['RightShoulder', 'RightShoulder'],
  ['RightArm', 'RightArm'],
  ['RightForeArm', 'RightForeArm'],
  ['RightHand', 'RightHand'],
  ['RightHandIndex1', 'RightHandIndex1'],
  ['LeftUpLeg', 'LeftUpLeg'],
  ['LeftLeg', 'LeftLeg'],
  ['LeftFoot', 'LeftFoot'],
  ['LeftToeBase', 'LeftToeBase'],
  ['RightUpLeg', 'RightUpLeg'],
  ['RightLeg', 'RightLeg'],
  ['RightFoot', 'RightFoot'],
  ['RightToeBase', 'RightToeBase']
];

const BVH_TO_METERS = 0.0564; // 17.5 BVH leg units * 0.0564 = 0.987m human hip height

const bvhCache = new Map();
const _qBvhCur = new THREE.Quaternion();
const _qDelta = new THREE.Quaternion();
const _qMixWorld = new THREE.Quaternion();
const _qParentInv = new THREE.Quaternion();
const _vBvhHip = new THREE.Vector3();

/**
 * Loads and prepares a 120 FPS CMU Optical Motion Capture .bvh file,
 * capturing its exact rest-pose world quaternions for zero-artifact retargeting.
 */
export function loadCmuSoccerBvh(url) {
  if (bvhCache.has(url)) return bvhCache.get(url);

  const loader = new BVHLoader();
  const promise = new Promise((resolve, reject) => {
    loader.load(
      url,
      (result) => {
        const rootContainer = new THREE.Group();
        rootContainer.scale.setScalar(BVH_TO_METERS);

        const hipBone = result.skeleton.bones[0];
        rootContainer.add(hipBone);

        // Capture exact BVH rest-pose world rotations & hip rest position
        result.skeleton.pose();
        rootContainer.updateMatrixWorld(true);

        const bvhBoneMap = {};
        const bvhRestWorldQuatsInv = {};
        for (const bone of result.skeleton.bones) {
          bvhBoneMap[bone.name] = bone;
          const q = new THREE.Quaternion();
          bone.getWorldQuaternion(q);
          bvhRestWorldQuatsInv[bone.name] = q.invert();
        }
        const bvhRestHipWorld = new THREE.Vector3();
        hipBone.getWorldPosition(bvhRestHipWorld);

        const helper = new THREE.SkeletonHelper(rootContainer);
        helper.setColors(new THREE.Color(0x38bdf8), new THREE.Color(0x34d399));
        helper.material.transparent = true;
        helper.material.opacity = 0.9;
        helper.frustumCulled = false;

        const mixer = new THREE.AnimationMixer(hipBone);
        const action = mixer.clipAction(result.clip);
        action.play();

        // Sample first-frame hip world XZ so we center the mocap run-up on the pitch
        mixer.setTime(0.02);
        rootContainer.updateMatrixWorld(true);
        const startHipWorld = new THREE.Vector3();
        hipBone.getWorldPosition(startHipWorld);

        resolve({
          clip: result.clip,
          skeleton: result.skeleton,
          rootContainer,
          hipBone,
          helper,
          mixer,
          bvhBoneMap,
          bvhRestWorldQuatsInv,
          bvhRestHipWorld,
          startHipWorld
        });
      },
      undefined,
      reject
    );
  });

  bvhCache.set(url, promise);
  return promise;
}

/**
 * Captures Mixamo rest-pose world quaternions once on a player instance
 * so universal world-space delta retargeting works regardless of T-pose vs A-pose.
 */
function ensureMixamoRestData(playerObj) {
  if (playerObj._mixamoRestWorldQuats) return playerObj._mixamoRestWorldQuats;
  if (!playerObj.skinnedMeshes || playerObj.skinnedMeshes.length === 0) return null;

  // Save current root transform, reset to identity at origin to read pure rest pose
  const prevPos = playerObj.root.position.clone();
  const prevRotY = playerObj.root.rotation.y;
  playerObj.root.position.set(0, 0, 0);
  playerObj.root.rotation.set(0, 0, 0);

  playerObj.skinnedMeshes[0].skeleton.pose();
  playerObj.root.updateMatrixWorld(true);

  const restMap = {};
  for (const [mixName] of RETARGET_BONE_PAIRS) {
    const bone = playerObj.bones[mixName];
    if (bone) {
      const q = new THREE.Quaternion();
      bone.getWorldQuaternion(q);
      restMap[mixName] = q;
    }
  }

  playerObj.root.position.copy(prevPos);
  playerObj.root.rotation.y = prevRotY;
  playerObj.root.updateMatrixWorld(true);

  playerObj._mixamoRestWorldQuats = restMap;
  return restMap;
}

/**
 * Evaluates a 120 FPS CMU Soccer BVH clip at normalized time u in [0..1]
 * and live-retargets all 23 anatomical joints onto Pedri's 67-bone SkinnedMesh!
 */
export function evaluateCmuMocapOnPlayer(bvhData, playerObj, normT, overlaysConfig) {
  if (!bvhData || !playerObj || !playerObj.skinnedModel) return null;

  const mixRest = ensureMixamoRestData(playerObj);
  if (!mixRest) return null;

  const RAW_RIG_OFFSET_X = 1.45;
  // Position BVH container 1.45m to the right for side-by-side comparison, evaluate exact 120Hz frame
  bvhData.rootContainer.position.set(-bvhData.startHipWorld.x + RAW_RIG_OFFSET_X, 0, -bvhData.startHipWorld.z + 2.5);
  const clipTime = THREE.MathUtils.clamp(normT, 0, 0.999) * bvhData.clip.duration;
  bvhData.mixer.setTime(clipTime);
  bvhData.rootContainer.updateMatrixWorld(true);

  // Read live 120Hz hip position in meters
  bvhData.hipBone.getWorldPosition(_vBvhHip);

  // Place Pedri's root at x - 1.45m (centered on pitch!) with identity yaw so world delta maps 1:1
  playerObj.root.position.set(_vBvhHip.x - RAW_RIG_OFFSET_X, 0, _vBvhHip.z);
  playerObj.root.rotation.set(0, 0, 0);
  playerObj.skinnedMeshes[0].skeleton.pose();

  if (playerObj.bones.Hips) {
    // Armature has 0.01 scale => convert meter height directly to centimeters
    playerObj.bones.Hips.position.set(0, _vBvhHip.y * 100.0, 0);
  }
  playerObj.root.updateMatrixWorld(true);

  // Top-down world-space rotation delta retargeting (cancels A-pose vs T-pose automatically!)
  for (const [mixName, bvhName] of RETARGET_BONE_PAIRS) {
    const mixBone = playerObj.bones[mixName];
    const bvhBone = bvhData.bvhBoneMap[bvhName];
    const qBvhRestInv = bvhData.bvhRestWorldQuatsInv[bvhName];
    const qMixRest = mixRest[mixName];
    if (!mixBone || !bvhBone || !qBvhRestInv || !qMixRest) continue;

    bvhBone.getWorldQuaternion(_qBvhCur);
    // deltaWorld = qBvhCur * inv(qBvhRest)
    _qDelta.multiplyQuaternions(_qBvhCur, qBvhRestInv);
    // desiredMixWorld = deltaWorld * qMixRest
    _qMixWorld.multiplyQuaternions(_qDelta, qMixRest);

    if (mixBone.parent) {
      mixBone.parent.getWorldQuaternion(_qParentInv).invert();
      mixBone.quaternion.multiplyQuaternions(_qParentInv, _qMixWorld);
    } else {
      mixBone.quaternion.copy(_qMixWorld);
    }
    mixBone.updateMatrixWorld(true);
  }

  // Toggle X-Ray SkeletonHelper if requested
  const xray = Boolean(overlaysConfig.showSkeleton);
  if (playerObj.skeletonHelper) playerObj.skeletonHelper.visible = xray;
  if (playerObj.kitMaterial && playerObj.kitMaterial.transparent !== xray) {
    playerObj.kitMaterial.transparent = xray;
    playerObj.kitMaterial.opacity = xray ? 0.36 : 1.0;
    playerObj.kitMaterial.needsUpdate = true;
  }
  if (playerObj.scanCone) playerObj.scanCone.visible = false;
  if (playerObj.ikFootRing) playerObj.ikFootRing.visible = false;
  playerObj.labelSprite.visible = overlaysConfig.showLabels;

  // Read retargeted right ankle & knee angles for live biomechanical telemetry
  let kneeDeg = 22;
  let anklePitchDeg = 0;
  if (playerObj.bones.RightLeg) {
    kneeDeg = Math.round(THREE.MathUtils.radToDeg(playerObj.bones.RightLeg.rotation.length()));
  }
  if (playerObj.bones.RightFoot) {
    anklePitchDeg = Math.round(THREE.MathUtils.radToDeg(playerObj.bones.RightFoot.rotation.x));
  }

  playerObj.telemetry.activeClip = `120Hz Optical BVH (${Math.round(clipTime * 120)}f / ${Math.round(bvhData.clip.duration * 120)}f)`;
  playerObj.telemetry.activeFoot = 'CMU 120FPS 光学标记点全身映射';
  playerObj.telemetry.kneeFlexDeg = kneeDeg;
  playerObj.telemetry.anklePitchDeg = anklePitchDeg;
  playerObj.telemetry.ankleEversionDeg = 12;

  return {
    athletePos: _vBvhHip.clone(),
    duration: bvhData.clip.duration,
    frameIndex: Math.round(clipTime * 120),
    totalFrames: Math.round(bvhData.clip.duration * 120)
  };
}
