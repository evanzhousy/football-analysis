const BABYLON = window.BABYLON;

/**
 * Builds an authentic UEFA stadium pitch environment in Babylon.js (Right-Handed Coordinate System):
 *   X: lateral across pitch (-28m left touchline to +28m right touchline)
 *   Z: longitudinal along pitch (+28m defensive build-up half to -34m attacking goal line)
 *   Y: vertical height (0.00m = turf surface)
 */
export function createBabylonPitchEnvironment(scene) {
  const pitchRoot = new BABYLON.TransformNode('PitchRoot', scene);

  // 1. Broadcast ACES Tone Mapping & Atmospheric Night Stadium Fog
  scene.clearColor = new BABYLON.Color4(0.035, 0.058, 0.088, 1.0);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor = new BABYLON.Color3(0.035, 0.058, 0.088);
  scene.fogDensity = 0.0068;

  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.16;
  scene.imageProcessingConfiguration.contrast = 1.06;

  // 2. Stadium Floodlight Rig + High-Quality PCF Soft ShadowGenerator
  const hemiLight = new BABYLON.HemisphericLight('StadiumSkyBounce', new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.diffuse = new BABYLON.Color3(0.86, 0.93, 1.0);
  hemiLight.groundColor = new BABYLON.Color3(0.14, 0.28, 0.18);
  hemiLight.intensity = 0.88;

  const mainFlood = new BABYLON.DirectionalLight(
    'MainStadiumFlood',
    new BABYLON.Vector3(-22, -38, -24).normalize(),
    scene
  );
  mainFlood.position = new BABYLON.Vector3(22, 38, 24);
  mainFlood.diffuse = new BABYLON.Color3(1.0, 0.975, 0.92);
  mainFlood.specular = new BABYLON.Color3(0.95, 0.95, 0.92);
  mainFlood.intensity = 2.35;
  mainFlood.shadowMinZ = 4;
  mainFlood.shadowMaxZ = 115;

  const shadowGen = new BABYLON.ShadowGenerator(2048, mainFlood);
  shadowGen.usePercentageCloserFiltering = true;
  shadowGen.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
  shadowGen.bias = 0.00045;
  shadowGen.normalBias = 0.015;
  shadowGen.darkness = 0.28;

  const rimFlood = new BABYLON.DirectionalLight(
    'RimStadiumFlood',
    new BABYLON.Vector3(24, -26, 28).normalize(),
    scene
  );
  rimFlood.diffuse = new BABYLON.Color3(0.75, 0.86, 1.0);
  rimFlood.intensity = 0.82;

  // 3. Mowed UEFA Grass Turf with Organic Blade Grain
  const turfTex = new BABYLON.DynamicTexture('TurfMowTex', { width: 1024, height: 1024 }, scene, true);
  const tCtx = turfTex.getContext();
  const stripes = 16;
  const stripeH = 1024 / stripes;
  for (let i = 0; i < stripes; i++) {
    tCtx.fillStyle = i % 2 === 0 ? '#1d5b34' : '#23693d';
    tCtx.fillRect(0, i * stripeH, 1024, stripeH);
  }
  for (let i = 0; i < 28000; i++) {
    const gx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const gy = (Math.sin(i * 78.233) * 29432.1234) % 1;
    const px = Math.abs(gx) * 1024;
    const py = Math.abs(gy) * 1024;
    tCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.026)' : 'rgba(0,0,0,0.036)';
    tCtx.fillRect(px, py, 2, 2);
  }
  turfTex.update(false);
  turfTex.anisotropicFilteringLevel = 8;

  const pitchW = 56;
  const pitchL = 68;
  const turfMesh = BABYLON.MeshBuilder.CreateGround(
    'TurfGround',
    { width: pitchW + 12, height: pitchL + 12, subdivisions: 2 },
    scene
  );
  turfMesh.position.set(0, 0, -3);
  turfMesh.receiveShadows = true;
  turfMesh.parent = pitchRoot;

  const turfMat = new BABYLON.PBRMetallicRoughnessMaterial('TurfPBR', scene);
  turfMat.baseTexture = turfTex;
  turfMat.metallic = 0.02;
  turfMat.roughness = 0.88;
  turfMesh.material = turfMat;

  // Dark stadium surround apron
  const apronMesh = BABYLON.MeshBuilder.CreateGround('StadiumApron', { width: 170, height: 170 }, scene);
  apronMesh.position.set(0, -0.025, 0);
  apronMesh.parent = pitchRoot;
  const apronMat = new BABYLON.PBRMetallicRoughnessMaterial('ApronPBR', scene);
  apronMat.baseColor = new BABYLON.Color3(0.04, 0.065, 0.095);
  apronMat.metallic = 0.0;
  apronMat.roughness = 0.96;
  apronMesh.material = apronMat;

  // 4. Crisp White Chalk Pitch Markings
  const lineMat = new BABYLON.StandardMaterial('PitchLineMat', scene);
  lineMat.disableLighting = true;
  lineMat.emissiveColor = new BABYLON.Color3(0.92, 0.95, 0.93);
  lineMat.alpha = 0.84;
  lineMat.backFaceCulling = false;

  function addGroundStrip(name, cx, cz, w, d, y = 0.012) {
    const g = BABYLON.MeshBuilder.CreateGround(name, { width: w, height: d }, scene);
    g.position.set(cx, y, cz);
    g.material = lineMat;
    g.isPickable = false;
    g.parent = pitchRoot;
    return g;
  }

  function addLineRect(prefix, cx, cz, w, h, t = 0.14) {
    addGroundStrip(`${prefix}_top`, cx, cz - h / 2, w, t);
    addGroundStrip(`${prefix}_bot`, cx, cz + h / 2, w, t);
    addGroundStrip(`${prefix}_left`, cx - w / 2, cz, t, h);
    addGroundStrip(`${prefix}_right`, cx + w / 2, cz, t, h);
  }

  // Touchlines, goal line (Z = -34), defensive cut (Z = +28), halfway line (Z = +8)
  addLineRect('OuterPitch', 0, -3, pitchW, 62, 0.16);
  addGroundStrip('HalfwayLine', 0, 8, pitchW, 0.15, 0.013);

  // Center Circle (R = 9.15m at Z = +8) & Spot
  function addRingOnTurf(name, cx, cz, innerR, outerR, startAng = 0, arcAng = Math.PI * 2, segs = 72) {
    const path1 = [];
    const path2 = [];
    for (let i = 0; i <= segs; i++) {
      const a = startAng + (arcAng * i) / segs;
      path1.push(new BABYLON.Vector3(cx + Math.cos(a) * innerR, 0.013, cz + Math.sin(a) * innerR));
      path2.push(new BABYLON.Vector3(cx + Math.cos(a) * outerR, 0.013, cz + Math.sin(a) * outerR));
    }
    const ribbon = BABYLON.MeshBuilder.CreateRibbon(
      name,
      { pathArray: [path1, path2], sideOrientation: BABYLON.Mesh.DOUBLESIDE },
      scene
    );
    ribbon.material = lineMat;
    ribbon.isPickable = false;
    ribbon.parent = pitchRoot;
    return ribbon;
  }

  addRingOnTurf('CenterCircle', 0, 8, 9.01, 9.18, 0, Math.PI * 2, 72);
  const centerSpot = BABYLON.MeshBuilder.CreateDisc('CenterSpot', { radius: 0.24, tessellation: 24 }, scene);
  centerSpot.rotation.x = Math.PI / 2;
  centerSpot.position.set(0, 0.014, 8);
  centerSpot.material = lineMat;
  centerSpot.parent = pitchRoot;

  // Attacking Penalty Area & 6-Yard Goal Area at Z = -34m
  addLineRect('PenaltyBox', 0, -25.75, 34, 16.5, 0.14);
  addLineRect('SixYardBox', 0, -31.25, 16, 5.5, 0.14);

  const penSpot = BABYLON.MeshBuilder.CreateDisc('PenaltySpot', { radius: 0.22, tessellation: 24 }, scene);
  penSpot.rotation.x = Math.PI / 2;
  penSpot.position.set(0, 0.014, -23);
  penSpot.material = lineMat;
  penSpot.parent = pitchRoot;

  // Penalty Arc outside Z = -17.5m (centered at Z = -23m, R = 9.15m -> sin(a) > (5.5/9.05) => a in [0.65, PI - 0.65])
  addRingOnTurf('PenaltyArc', 0, -23, 8.98, 9.14, 0.65, Math.PI - 1.30, 44);

  // Subtle Zone 14 Tactical Box
  const z14Mat = new BABYLON.StandardMaterial('Zone14Mat', scene);
  z14Mat.disableLighting = true;
  z14Mat.emissiveColor = new BABYLON.Color3(0.96, 0.79, 0.27);
  z14Mat.alpha = 0.09;
  z14Mat.backFaceCulling = false;
  const z14 = BABYLON.MeshBuilder.CreateGround('Zone14Guide', { width: 14, height: 9 }, scene);
  z14.position.set(0, 0.008, -13);
  z14.material = z14Mat;
  z14.parent = pitchRoot;

  // 5. 3D Attacking Goalframe & Net at Z = -34m
  const postMat = new BABYLON.PBRMetallicRoughnessMaterial('GoalPostMat', scene);
  postMat.baseColor = new BABYLON.Color3(0.97, 0.98, 0.99);
  postMat.metallic = 0.32;
  postMat.roughness = 0.24;

  const goalW = 7.32;
  const goalH = 2.44;
  const goalD = 2.0;

  const leftPost = BABYLON.MeshBuilder.CreateCylinder('LeftPost', { diameter: 0.13, height: goalH, tessellation: 18 }, scene);
  leftPost.position.set(-goalW / 2, goalH / 2, -34);
  leftPost.material = postMat;
  leftPost.parent = pitchRoot;
  shadowGen.addShadowCaster(leftPost);

  const rightPost = leftPost.clone('RightPost');
  rightPost.position.set(goalW / 2, goalH / 2, -34);
  rightPost.parent = pitchRoot;
  shadowGen.addShadowCaster(rightPost);

  const crossbar = BABYLON.MeshBuilder.CreateCylinder('Crossbar', { diameter: 0.13, height: goalW + 0.14, tessellation: 18 }, scene);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, goalH, -34);
  crossbar.material = postMat;
  crossbar.parent = pitchRoot;
  shadowGen.addShadowCaster(crossbar);

  const netMat = new BABYLON.StandardMaterial('GoalNetMat', scene);
  netMat.disableLighting = true;
  netMat.emissiveColor = new BABYLON.Color3(0.84, 0.90, 0.95);
  netMat.wireframe = true;
  netMat.alpha = 0.22;
  const netBox = BABYLON.MeshBuilder.CreateBox('GoalNet', { width: goalW, height: goalH, depth: goalD, updatable: false }, scene);
  netBox.position.set(0, goalH / 2, -34 - goalD / 2);
  netBox.material = netMat;
  netBox.parent = pitchRoot;

  return { pitchRoot, shadowGen };
}

/**
 * Creates an authentic FIFA Size-5 3D Match Football (radius = 0.115m, diameter = 0.23m)
 */
export function createBabylonMatchBall(scene, shadowGen) {
  const ballTex = new BABYLON.DynamicTexture('MatchBallTex', { width: 512, height: 256 }, scene, true);
  const ctx = ballTex.getContext();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.lineWidth = 3;
  for (let x = 32; x < 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 24, 256);
    ctx.stroke();
  }

  const spots = [
    [64, 58], [192, 52], [320, 62], [448, 56],
    [128, 184], [256, 192], [384, 178]
  ];
  spots.forEach(([x, y], idx) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const ang = (k * Math.PI * 2) / 5 - Math.PI / 2;
      const px = x + Math.cos(ang) * 24;
      const py = y + Math.sin(ang) * 24;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = idx % 2 === 0 ? '#0f172a' : '#a50044';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#eab308';
    ctx.stroke();
  });
  ballTex.update(false);

  const ballMesh = BABYLON.MeshBuilder.CreateSphere('MatchBall', { diameter: 0.23, segments: 28 }, scene);
  ballMesh.position.y = 0.115;
  ballMesh.receiveShadows = true;

  const ballMat = new BABYLON.PBRMetallicRoughnessMaterial('MatchBallPBR', scene);
  ballMat.baseTexture = ballTex;
  ballMat.metallic = 0.05;
  ballMat.roughness = 0.28;
  ballMesh.material = ballMat;

  if (shadowGen) {
    shadowGen.addShadowCaster(ballMesh);
  }
  return ballMesh;
}
