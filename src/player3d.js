import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createFootballerKitMaterial } from './kitShader.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Reusable scratch math objects (zero per-frame GC allocation)
const _vH = new THREE.Vector3();
const _vK = new THREE.Vector3();
const _vA = new THREE.Vector3();
const _vT = new THREE.Vector3();
const _vCur = new THREE.Vector3();
const _vDes = new THREE.Vector3();
const _vBallLocal = new THREE.Vector3();
const _vFootTargetLocal = new THREE.Vector3();
const _vFootTargetWorld = new THREE.Vector3();
const _qSwing = new THREE.Quaternion();
const _qParentWorld = new THREE.Quaternion();
const _qBoneWorld = new THREE.Quaternion();
const _qAdd = new THREE.Quaternion();
const _qTarget = new THREE.Quaternion();
const _euler = new THREE.Euler();

let sharedGltfAsset = null;
let assetLoadPromise = null;

/**
 * Preloads Mixamo 67-bone rigged athlete GLB (Xbot.glb from mrdoob/three.js, MIT)
 * containing 28,374 GPU-skinned vertices + optical mocap locomotion clips.
 */
export function preloadAthleteRig() {
  if (assetLoadPromise) return assetLoadPromise;
  const loader = new GLTFLoader();
  assetLoadPromise = new Promise((resolve, reject) => {
    loader.load(
      './assets/models/Xbot.glb',
      (gltf) => {
        sharedGltfAsset = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('Failed to load Xbot.glb:', err);
        reject(err);
      }
    );
  });
  return assetLoadPromise;
}

export function isAthleteRigReady() {
  return Boolean(sharedGltfAsset);
}

function createLabelSprite(text, role) {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 84;
  const ctx = c.getContext('2d');

  const bg =
    role === 'pedri'
      ? 'rgba(15, 23, 42, 0.92)'
      : role === 'teammate'
      ? 'rgba(12, 34, 68, 0.86)'
      : 'rgba(69, 10, 10, 0.86)';
  const border =
    role === 'pedri' ? '#facc15' : role === 'teammate' ? '#38bdf8' : '#f87171';

  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(8, 10, 384, 64, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = role === 'pedri' ? '#fde047' : '#f8fafc';
  ctx.font = 'bold 27px "Inter", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 200, 43);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.75, 0.58, 1);
  sprite.position.set(0, 2.28, 0);
  sprite.renderOrder = 10;
  return sprite;
}

/**
 * Analytical Two-Bone Limb Inverse Kinematics Solver (Hip -> Knee -> Ankle)
 * Bends Knee anatomically along +X flexion axis and swings Hip in world space
 * so the Ankle reaches targetWorldPos cleanly without gimbal lock.
 */
function solveTwoBoneLegIK(upLeg, leg, foot, targetWorldPos, weight = 1.0) {
  if (!upLeg || !leg || !foot || weight <= 0.001) return 0;

  upLeg.updateWorldMatrix(true, true);
  upLeg.getWorldPosition(_vH);
  leg.getWorldPosition(_vK);
  foot.getWorldPosition(_vA);

  const l1 = _vH.distanceTo(_vK);
  const l2 = _vK.distanceTo(_vA);
  if (l1 < 0.05 || l2 < 0.05) return 0;

  _vT.copy(_vA).lerp(targetWorldPos, THREE.MathUtils.clamp(weight, 0, 1));
  const rawDist = _vH.distanceTo(_vT);
  const maxReach = (l1 + l2) * 0.985;
  const minReach = Math.abs(l1 - l2) + 0.08;
  const d = THREE.MathUtils.clamp(rawDist, minReach, maxReach);

  // Law of cosines for interior knee angle beta
  const cosBeta = THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1);
  const beta = Math.acos(cosBeta);
  const kneeFlex = Math.max(0.06, Math.PI - beta);

  // Blend knee flexion smoothly with current mocap knee rotation
  _qTarget.setFromAxisAngle(X_AXIS, kneeFlex);
  leg.quaternion.slerp(_qTarget, weight);
  leg.updateMatrixWorld(true);

  // Recompute ankle world position after knee flexion, then swing hip toward target
  foot.getWorldPosition(_vA);
  _vCur.subVectors(_vA, _vH).normalize();
  _vDes.subVectors(_vT, _vH).normalize();

  if (_vCur.lengthSq() > 0.5 && _vDes.lengthSq() > 0.5) {
    _qSwing.setFromUnitVectors(_vCur, _vDes);
    upLeg.getWorldQuaternion(_qBoneWorld);
    _qBoneWorld.premultiply(_qSwing);

    if (upLeg.parent) {
      upLeg.parent.getWorldQuaternion(_qParentWorld);
      _qParentWorld.invert();
      upLeg.quaternion.copy(_qParentWorld.multiply(_qBoneWorld));
    } else {
      upLeg.quaternion.copy(_qBoneWorld);
    }
    upLeg.updateMatrixWorld(true);
  }

  return THREE.MathUtils.radToDeg(kneeFlex);
}

/**
 * Articulates all 5 finger chains (Thumb, Index, Middle, Ring, Pinky) on a hand:
 * - curl > 0: athletic running fist/relaxed curl
 * - spread > 0: open-palm tactile shielding barrier (Scenario 7 / tight back press)
 */
function poseHandFingers(bones, sidePrefix, curl = 0.35, spread = 0.0) {
  const sgn = sidePrefix === 'Left' ? 1 : -1;
  const fingers = [
    { name: 'Index', spreadFactor: 0.9 },
    { name: 'Middle', spreadFactor: 0.25 },
    { name: 'Ring', spreadFactor: -0.35 },
    { name: 'Pinky', spreadFactor: -0.95 }
  ];

  for (const f of fingers) {
    for (let j = 1; j <= 3; j++) {
      const b = bones[`${sidePrefix}Hand${f.name}${j}`];
      if (!b) continue;
      // Local Z curls phalanges inward on Xbot's horizontal hand axis
      const zCurl = sgn * curl * (j === 1 ? 0.45 : 0.65);
      const ySpread = j === 1 ? f.spreadFactor * spread * 0.32 : 0;
      _euler.set(0, ySpread, zCurl, 'XYZ');
      _qTarget.setFromEuler(_euler);
      b.quaternion.slerp(_qTarget, 0.75);
    }
  }

  const thumb1 = bones[`${sidePrefix}HandThumb1`];
  const thumb2 = bones[`${sidePrefix}HandThumb2`];
  if (thumb1) {
    _euler.set(0.25 * curl, sgn * (0.35 * spread - 0.2 * curl), 0, 'XYZ');
    thumb1.quaternion.slerp(_qTarget.setFromEuler(_euler), 0.65);
  }
  if (thumb2) {
    _euler.set(0, -sgn * 0.35 * curl, 0, 'XYZ');
    thumb2.quaternion.slerp(_qTarget.setFromEuler(_euler), 0.65);
  }
}

/**
 * Creates a FIFA/HyperMotion-inspired 67-Bone SkinnedMesh Footballer:
 * - Cloned 67-bone Mixamo skeleton (Hips -> 3 Spine -> Neck/Head -> Shoulders/Arms/ForeArms/Hands/20 Fingers -> UpLegs/Legs/Ankles/Toes)
 * - GPU Linear Blend Skinning + Bind-Space Blaugrana/Rival Kit Shader (#8 PEDRI back print, ankle/wrist tape, socks, cleats)
 * - Per-character THREE.AnimationMixer blending optical mocap idle / walk / run / sneak_pose clips
 * - Toggleable 67-bone THREE.SkeletonHelper X-Ray overlay + Active Foot IK Ring
 */
export function createArticulatedPlayer({ role = 'defender', number = '6', label = '防守后腰' }) {
  const root = new THREE.Group();

  // Tactical ground ring
  const ringColor = role === 'pedri' ? 0xfacc15 : role === 'teammate' ? 0x38bdf8 : 0xef4444;
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.56, 0.72, 40),
    new THREE.MeshBasicMaterial({
      color: ringColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: role === 'pedri' ? 0.86 : 0.62
    })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.018;
  root.add(groundRing);

  // Active Foot-Ball IK Target Ring (highlights exact ankle/foot touch point when IK engages)
  const ikFootRing = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.19, 24),
    new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    })
  );
  ikFootRing.rotation.x = -Math.PI / 2;
  ikFootRing.position.y = 0.024;
  ikFootRing.visible = false;
  root.add(ikFootRing);

  // Defender Cover Shadow Cone
  let coverShadow = null;
  if (role === 'defender') {
    const coneShape = new THREE.BufferGeometry();
    coneShape.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0.016, 0, -2.15, 0.016, -5.9, 2.15, 0.016, -5.9]),
        3
      )
    );
    coverShadow = new THREE.Mesh(
      coneShape,
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    root.add(coverShadow);
  }

  const labelSprite = createLabelSprite(label, role);
  root.add(labelSprite);

  const playerObj = {
    root,
    role,
    number,
    label,
    groundRing,
    ikFootRing,
    coverShadow,
    labelSprite,
    scanCone: null,
    skinnedModel: null,
    kitMaterial: null,
    skeletonHelper: null,
    bones: {},
    skinnedMeshes: [],
    mixer: null,
    actions: {},
    boneCount: 0,
    telemetry: {
      boneCount: 67,
      activeClip: 'Mocap Idle/Run',
      activeFoot: '双脚均衡支撑',
      anklePitchDeg: 0,
      ankleEversionDeg: 0,
      kneeFlexDeg: 18
    }
  };

  if (sharedGltfAsset) {
    attachRiggedSkinnedModel(playerObj, sharedGltfAsset);
  }

  return playerObj;
}

export function attachRiggedSkinnedModel(playerObj, gltfAsset = sharedGltfAsset) {
  if (!gltfAsset || playerObj.skinnedModel) return;

  const clonedScene = SkeletonUtils.clone(gltfAsset.scene);
  const kitMat = createFootballerKitMaterial({
    role: playerObj.role,
    number: playerObj.number,
    label: playerObj.label
  });

  const bones = {};
  const skinnedMeshes = [];
  let totalBones = 0;

  clonedScene.traverse((obj) => {
    if (obj.isBone) {
      const cleanName = obj.name.replace(/^mixamorig:?/, '');
      bones[cleanName] = obj;
      totalBones++;
    }
    if (obj.isSkinnedMesh) {
      obj.material = kitMat;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      skinnedMeshes.push(obj);
    }
  });

  // Attach sculpted wavy haircut volume on Pedri's Head bone for unmistakable silhouette
  if (bones.Head) {
    const hairColor = playerObj.role === 'pedri' ? 0x1b120d : 0x2a1d15;
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(10.8, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.86 })
    );
    hairCrown.position.set(0, 9.6, -0.8);
    hairCrown.rotation.x = -0.18;
    hairCrown.castShadow = true;
    bones.Head.add(hairCrown);

    // Attach 360° Volumetric Vision Scan Cone directly to Pedri's Head bone!
    // (Note: bones inside Armature have 0.01 scale, so cone dimensions are in centimeters!)
    if (playerObj.role === 'pedri') {
      const scanGeo = new THREE.ConeGeometry(255, 610, 28, 1, true);
      scanGeo.translate(0, -305, 0);
      scanGeo.rotateX(-Math.PI / 2);
      const scanCone = new THREE.Mesh(
        scanGeo,
        new THREE.MeshBasicMaterial({
          color: 0xfde047,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      scanCone.position.set(0, -52, 16);
      bones.Head.add(scanCone);
      playerObj.scanCone = scanCone;
    }
  }

  // 67-Bone Real-Time X-Ray SkeletonHelper (must live under world-origin group because helper.matrix = clonedScene.matrixWorld)
  const skeletonHelper = new THREE.SkeletonHelper(clonedScene);
  skeletonHelper.setColors(new THREE.Color(0xfacc15), new THREE.Color(0x38bdf8));
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = 0.95;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.frustumCulled = false;
  skeletonHelper.renderOrder = 8;
  skeletonHelper.visible = false;

  // Optical Motion-Capture Locomotion Mixer (idle / walk / run / sneak_pose)
  const mixer = new THREE.AnimationMixer(clonedScene);
  const actions = {};
  for (const clip of gltfAsset.animations) {
    const act = mixer.clipAction(clip);
    act.enabled = true;
    act.setEffectiveTimeScale(1.0);
    act.setEffectiveWeight(0.0);
    act.play();
    actions[clip.name] = act;
  }

  playerObj.root.add(clonedScene);
  if (playerObj.root.parent) {
    playerObj.root.parent.add(skeletonHelper);
  }
  playerObj.skinnedModel = clonedScene;
  playerObj.kitMaterial = kitMat;
  playerObj.skeletonHelper = skeletonHelper;
  playerObj.bones = bones;
  playerObj.skinnedMeshes = skinnedMeshes;
  playerObj.mixer = mixer;
  playerObj.actions = actions;
  playerObj.boneCount = totalBones || 67;
  playerObj.telemetry.boneCount = playerObj.boneCount;
}

/**
 * Evaluates full 67-bone skeletal pose for a frame:
 * 1. Optical Mocap Locomotion Blending (idle <-> walk <-> run + sneak_pose crouch)
 * 2. 3-Vertebra Spine Roll (Shoulder Drop Feint), Neck/Head 360° Scanning
 * 3. Shoulder -> UpperArm -> ForeArm -> Wrist -> 20-Bone Finger Articulation (Tactile Shielding & Balance)
 * 4. Analytical Two-Bone Leg IK + 3-Axis Ankle (Dorsi/Plantarflexion, Eversion) & Forefoot Toe Articulation
 */
export function updatePlayerPose(player, state, overlaysConfig, ballWorldPos = null) {
  const {
    x = 0,
    z = 0,
    yaw = 0,
    speed = 0,
    locomotionTime = 0,
    headYaw = 0,
    scanIntensity = 0,
    shoulderRoll = 0,
    crouch = 0,
    shieldArm = 0,
    fakeKick = 0,
    lunge = 0,
    shadowYaw = null
  } = state;

  player.root.position.set(x, 0, z);
  player.root.rotation.y = yaw;
  player.labelSprite.visible = overlaysConfig.showLabels;

  if (player.coverShadow) {
    player.coverShadow.visible = overlaysConfig.showCoverShadow;
    if (shadowYaw !== null) {
      player.coverShadow.rotation.y = shadowYaw - yaw;
    }
  }

  if (!player.skinnedModel || !player.mixer) return;

  // Toggle X-Ray 67-Bone Skeleton Inspection Mode
  const xray = Boolean(overlaysConfig.showSkeleton);
  if (player.skeletonHelper) {
    player.skeletonHelper.visible = xray;
  }
  if (player.kitMaterial) {
    if (player.kitMaterial.transparent !== xray) {
      player.kitMaterial.transparent = xray;
      player.kitMaterial.opacity = xray ? 0.36 : 1.0;
      player.kitMaterial.needsUpdate = true;
    }
  }

  // --- LAYER 1: Optical Motion-Capture Locomotion Blend ---
  const { idle, walk, run, sneak_pose: sneak } = player.actions;
  let wIdle = 0;
  let wWalk = 0;
  let wRun = 0;
  let clipLabel = 'Mocap Idle';

  if (speed < 0.55) {
    const u = speed / 0.55;
    wIdle = 1.0 - u * 0.65;
    wWalk = u * 0.65;
    clipLabel = crouch > 0.35 ? 'Mocap Athletic Ready' : 'Mocap Idle';
  } else if (speed < 3.1) {
    const u = (speed - 0.55) / 2.55;
    wWalk = 1.0 - u;
    wRun = u;
    clipLabel = u > 0.45 ? 'Mocap Jog/Run Blend' : 'Mocap Stride Walk';
  } else {
    wRun = 1.0;
    clipLabel = 'Mocap Sprint Run';
  }

  const wSneak = Math.min(0.48, crouch * 0.52);
  const norm = wIdle + wWalk + wRun || 1;
  if (idle) idle.setEffectiveWeight((wIdle / norm) * (1 - wSneak * 0.55));
  if (walk) walk.setEffectiveWeight((wWalk / norm) * (1 - wSneak * 0.4));
  if (run) run.setEffectiveWeight((wRun / norm) * (1 - wSneak * 0.35));
  if (sneak) sneak.setEffectiveWeight(wSneak);

  // Deterministic timeline evaluation so 0.25x slow-mo & manual scrubber are 100% smooth
  const rate = 0.85 + Math.min(1.65, speed * 0.22);
  player.mixer.setTime(locomotionTime * rate);

  const b = player.bones;

  // --- LAYER 2: Pelvis Crouch, 3-Segment Spine Shoulder-Drop Feint & Head Scanning ---
  if (b.Hips) {
    b.Hips.position.y -= crouch * 13.5 + lunge * 35.0;
    b.Hips.position.x -= shoulderRoll * 11.5; // Center-of-mass counter-shift
    b.Hips.position.z += lunge * 16.0;
  }

  const forwardPitch = crouch * 0.24 + Math.min(0.22, speed * 0.03) + lunge * 0.32;
  const spineBones = [
    { bone: b.Spine, wRoll: 0.32, wPitch: 0.42 },
    { bone: b.Spine1, wRoll: 0.36, wPitch: 0.34 },
    { bone: b.Spine2, wRoll: 0.32, wPitch: 0.24 }
  ];
  for (const sb of spineBones) {
    if (!sb.bone) continue;
    _euler.set(forwardPitch * sb.wPitch, 0, shoulderRoll * sb.wRoll, 'XYZ');
    sb.bone.quaternion.multiply(_qAdd.setFromEuler(_euler));
  }

  // Cervical Neck + Head 360° Pre-Reception Scanning
  if (b.Neck) {
    _euler.set(-forwardPitch * 0.22, headYaw * 0.38, -shoulderRoll * 0.18, 'XYZ');
    b.Neck.quaternion.multiply(_qAdd.setFromEuler(_euler));
  }
  if (b.Head) {
    _euler.set(-forwardPitch * 0.18, headYaw * 0.62, -shoulderRoll * 0.15, 'XYZ');
    b.Head.quaternion.multiply(_qAdd.setFromEuler(_euler));
  }

  if (player.scanCone) {
    const showScan = overlaysConfig.showScan && scanIntensity > 0.02;
    player.scanCone.visible = showScan;
    if (showScan) {
      player.scanCone.material.opacity = 0.23 * scanIntensity;
    }
  }

  // --- LAYER 3: Upper-Limb, Elbow, Wrist & 20-Bone Finger Biomechanics ---
  const shieldW = THREE.MathUtils.clamp(shieldArm, 0, 1);
  if (shieldW > 0.02) {
    // Near-side Left Arm raises into a legal horizontal physical barrier, elbow bent, wrist cocked, fingers splayed!
    if (b.LeftShoulder) {
      _euler.set(0, 0, 0.14 * shieldW, 'XYZ');
      b.LeftShoulder.quaternion.multiply(_qAdd.setFromEuler(_euler));
    }
    if (b.LeftArm) {
      _euler.set(0.12, -0.28, -0.34, 'XYZ');
      b.LeftArm.quaternion.slerp(_qTarget.setFromEuler(_euler), shieldW * 0.88);
    }
    if (b.LeftForeArm) {
      _euler.set(0, -0.78, 0, 'XYZ');
      b.LeftForeArm.quaternion.slerp(_qTarget.setFromEuler(_euler), shieldW * 0.88);
    }
    if (b.LeftHand) {
      _euler.set(0, 0.22, 0.36, 'XYZ');
      b.LeftHand.quaternion.slerp(_qTarget.setFromEuler(_euler), shieldW * 0.85);
    }
    poseHandFingers(b, 'Left', 0.08, 0.95 * shieldW);
    poseHandFingers(b, 'Right', 0.42, 0.1);
  } else if (fakeKick > 0.04) {
    // Pedri's signature high-left-arm balance counter-weight during Fake-Shot / Cruyff Cut!
    if (b.LeftArm) {
      _euler.set(0.18, -0.42, -0.45, 'XYZ');
      b.LeftArm.quaternion.slerp(_qTarget.setFromEuler(_euler), fakeKick * 0.85);
    }
    if (b.LeftForeArm) {
      _euler.set(0, -0.58, 0, 'XYZ');
      b.LeftForeArm.quaternion.slerp(_qTarget.setFromEuler(_euler), fakeKick * 0.8);
    }
    if (b.RightArm) {
      _euler.set(-0.22, 0.35, 0.72, 'XYZ');
      b.RightArm.quaternion.slerp(_qTarget.setFromEuler(_euler), fakeKick * 0.75);
    }
    poseHandFingers(b, 'Left', 0.15, 0.65 * fakeKick);
    poseHandFingers(b, 'Right', 0.35, 0.2);
  } else {
    // Natural athletic elbow & relaxed finger curl during dribbling/sprinting
    poseHandFingers(b, 'Left', 0.38, 0.12);
    poseHandFingers(b, 'Right', 0.38, 0.12);
  }

  // Update world matrices before Two-Bone Leg & Ankle IK
  player.root.updateMatrixWorld(true);

  // --- LAYER 4: Analytical Two-Bone Leg IK + Ankle & Forefoot Articulation ---
  let activeFootLabel = '双脚动态支撑';
  let anklePitchDeg = 0;
  let ankleEvDeg = 0;
  let kneeFlexDeg = Math.round(16 + speed * 6 + crouch * 24);
  player.ikFootRing.visible = false;

  if (fakeKick > 0.03) {
    // High Backswing Fake-Shot / Fake-Pass Gesture (Scenarios 4, 5, 8)
    clipLabel = 'Fake-Shot Windup + Plant IK';
    activeFootLabel = '右脚高摆假射 · 左踝外翻支撑';

    if (b.RightUpLeg) {
      _euler.set(0.88 * fakeKick, -0.14 * fakeKick, -0.08 * fakeKick, 'XYZ');
      b.RightUpLeg.quaternion.slerp(_qTarget.setFromEuler(_euler), Math.min(1, fakeKick * 1.1));
    }
    if (b.RightLeg) {
      const kRad = 0.35 + 1.28 * fakeKick;
      b.RightLeg.quaternion.slerp(_qTarget.setFromAxisAngle(X_AXIS, kRad), Math.min(1, fakeKick * 1.1));
      kneeFlexDeg = Math.round(THREE.MathUtils.radToDeg(kRad));
    }
    if (b.RightFoot) {
      // Locked plantarflexed instep ("绷脚背") for convincing shot/cross threat!
      const pRad = 0.54 * fakeKick;
      _euler.set(pRad, 0, 0.12 * fakeKick, 'XYZ');
      b.RightFoot.quaternion.multiply(_qAdd.setFromEuler(_euler));
      anklePitchDeg = Math.round(THREE.MathUtils.radToDeg(pRad));
      ankleEvDeg = 7;
    }
    if (b.RightToeBase) {
      b.RightToeBase.quaternion.multiply(_qAdd.setFromAxisAngle(X_AXIS, 0.24 * fakeKick));
    }
    // Firm non-kicking Left Plant Leg beside the ball
    if (ballWorldPos && b.LeftUpLeg && b.LeftLeg && b.LeftFoot) {
      _vBallLocal.copy(ballWorldPos);
      player.root.worldToLocal(_vBallLocal);
      _vFootTargetLocal.set(_vBallLocal.x + 0.24, 0.095, _vBallLocal.z - 0.05);
      _vFootTargetWorld.copy(_vFootTargetLocal);
      player.root.localToWorld(_vFootTargetWorld);
      solveTwoBoneLegIK(b.LeftUpLeg, b.LeftLeg, b.LeftFoot, _vFootTargetWorld, fakeKick * 0.78);
      _euler.set(-0.18 * fakeKick, 0, -0.16 * fakeKick, 'XYZ');
      b.LeftFoot.quaternion.multiply(_qAdd.setFromEuler(_euler));
    }
  } else if (lunge > 0.03) {
    // Defender Committed Sliding / Lunging Tackle Block
    clipLabel = 'Committed Lunge / Slide Block';
    activeFootLabel = '右腿封堵滑铲 · 踝关节锁死';

    if (b.RightUpLeg) {
      _euler.set(-1.12 * lunge, -0.18 * lunge, -0.14 * lunge, 'XYZ');
      b.RightUpLeg.quaternion.slerp(_qTarget.setFromEuler(_euler), Math.min(1, lunge * 1.05));
    }
    if (b.RightLeg) {
      b.RightLeg.quaternion.slerp(_qTarget.setFromAxisAngle(X_AXIS, 0.18 * lunge), lunge);
    }
    if (b.RightFoot) {
      // Dorsiflexed/everted blocking boot surface
      _euler.set(-0.32 * lunge, 0.38 * lunge, 0.25 * lunge, 'XYZ');
      b.RightFoot.quaternion.multiply(_qAdd.setFromEuler(_euler));
      anklePitchDeg = Math.round(-18 * lunge);
      ankleEvDeg = Math.round(22 * lunge);
    }
    if (b.LeftUpLeg && b.LeftLeg) {
      // Trailing leg tucked underneath sliding hip
      _euler.set(0.55 * lunge, 0.25 * lunge, 0.22 * lunge, 'XYZ');
      b.LeftUpLeg.quaternion.slerp(_qTarget.setFromEuler(_euler), lunge * 0.9);
      b.LeftLeg.quaternion.slerp(_qTarget.setFromAxisAngle(X_AXIS, 1.55 * lunge), lunge * 0.9);
      kneeFlexDeg = Math.round(THREE.MathUtils.radToDeg(1.55 * lunge));
    }
  } else if (ballWorldPos && player.role !== 'defender') {
    // Close-Control Ball Touch Analytical IK (La Croqueta, Half-Turn, Roulette Sole Drag, Shielding)
    _vBallLocal.copy(ballWorldPos);
    player.root.worldToLocal(_vBallLocal);
    const distXZ = Math.hypot(_vBallLocal.x, _vBallLocal.z);

    if (distXZ < 1.15) {
      const ikWeight = THREE.MathUtils.smoothstep(1.15 - distXZ, 0.0, 0.58) * 0.86;
      // In Xbot root space (+Z forward, +X anatomical left, -X anatomical right):
      const useLeftFoot = _vBallLocal.x > 0.06;
      const isSoleDrag = crouch > 0.52 && Math.abs(_vBallLocal.z) < 0.58;

      const upLeg = useLeftFoot ? b.LeftUpLeg : b.RightUpLeg;
      const leg = useLeftFoot ? b.LeftLeg : b.RightLeg;
      const foot = useLeftFoot ? b.LeftFoot : b.RightFoot;
      const toe = useLeftFoot ? b.LeftToeBase : b.RightToeBase;
      const sgn = useLeftFoot ? 1 : -1;

      if (isSoleDrag) {
        // Sole-of-Boot Drag-Back / Marseille Roulette (Ankle atop ball at y=0.235m!)
        _vFootTargetLocal.set(_vBallLocal.x, 0.235, _vBallLocal.z - 0.04);
        activeFootLabel = useLeftFoot ? '左脚底拉球 (Sole IK)' : '右脚底拉球 (Sole IK)';
        clipLabel = 'Mocap + Sole Drag-Back IK';
      } else {
        // Inside-of-Foot Medial Arch Caress ("油炸丸子 / 半转身顺球推杆面")
        _vFootTargetLocal.set(_vBallLocal.x + sgn * 0.115, 0.105, _vBallLocal.z - 0.035);
        activeFootLabel = useLeftFoot ? '左脚内脚背推拨 (Ankle IK)' : '右脚内脚背顺球 (Ankle IK)';
        clipLabel = 'Mocap + Medial Ankle IK';
      }

      _vFootTargetWorld.copy(_vFootTargetLocal);
      player.root.localToWorld(_vFootTargetWorld);

      kneeFlexDeg = Math.round(solveTwoBoneLegIK(upLeg, leg, foot, _vFootTargetWorld, ikWeight));

      if (foot) {
        if (isSoleDrag) {
          // Plantarflex ankle to place studs squarely on top hemisphere of ball
          const p = 0.34 * ikWeight;
          _euler.set(p, 0, 0, 'XYZ');
          foot.quaternion.multiply(_qAdd.setFromEuler(_euler));
          if (toe) toe.quaternion.multiply(_qAdd.setFromAxisAngle(X_AXIS, -0.26 * ikWeight));
          anklePitchDeg = Math.round(THREE.MathUtils.radToDeg(p));
          ankleEvDeg = 4;
        } else {
          // Open medial arch ("外旋亮内脚背 + 踝背屈锁死")!
          const dorsi = -0.26 * ikWeight;
          const extRot = -sgn * 0.56 * ikWeight;
          const evers = sgn * 0.22 * ikWeight;
          _euler.set(dorsi, extRot, evers, 'XYZ');
          foot.quaternion.multiply(_qAdd.setFromEuler(_euler));
          if (toe) toe.quaternion.multiply(_qAdd.setFromAxisAngle(X_AXIS, -0.15 * ikWeight));
          anklePitchDeg = Math.round(THREE.MathUtils.radToDeg(dorsi));
          ankleEvDeg = Math.round(THREE.MathUtils.radToDeg(Math.abs(extRot)));
        }
      }

      // Show subtle IK contact ring under active ball-touching foot when X-Ray or close control is active
      if (ikWeight > 0.25) {
        player.ikFootRing.visible = true;
        player.ikFootRing.position.set(_vFootTargetLocal.x, 0.024, _vFootTargetLocal.z);
        player.ikFootRing.material.opacity = ikWeight * (xray ? 0.95 : 0.55);
      }
    }
  }

  player.telemetry.activeClip = clipLabel;
  player.telemetry.activeFoot = activeFootLabel;
  player.telemetry.anklePitchDeg = anklePitchDeg;
  player.telemetry.ankleEversionDeg = ankleEvDeg;
  player.telemetry.kneeFlexDeg = kneeFlexDeg;
}

/**
 * Builds reusable 3D trajectory curves (Pedri's path, Defender overshoot vector)
 */
export function createTrajectoryRibbon(points, colorHex, radius = 0.055, opacity = 0.75) {
  if (!points || points.length < 2) return null;
  const vecs = points.map(([x, z, y = 0.06]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vecs);
  const geo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
  const mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity
  });
  return new THREE.Mesh(geo, mat);
}
