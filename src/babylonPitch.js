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
  mainFlood.shadowMaxZ = 145;

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

  // 3. Mowed UEFA Grass Turf with Organic Blade Grain (Full Two-Box Stadium: Z = -34m .. +50m, Center at Z = +8m)
  const turfTex = new BABYLON.DynamicTexture('TurfMowTex', { width: 1024, height: 1024 }, scene, true);
  const tCtx = turfTex.getContext();
  const stripes = 20;
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
  const pitchL = 84; // Z from -34m (attacking goal) to +50m (defensive build-up goal), halfway at Z = +8m
  const turfMesh = BABYLON.MeshBuilder.CreateGround(
    'TurfGround',
    { width: pitchW + 14, height: pitchL + 16, subdivisions: 2 },
    scene
  );
  turfMesh.position.set(0, 0, 8);
  turfMesh.receiveShadows = true;
  turfMesh.parent = pitchRoot;

  const turfMat = new BABYLON.PBRMetallicRoughnessMaterial('TurfPBR', scene);
  turfMat.baseTexture = turfTex;
  turfMat.metallic = 0.02;
  turfMat.roughness = 0.88;
  turfMesh.material = turfMat;

  // Dark stadium surround apron
  const apronMesh = BABYLON.MeshBuilder.CreateGround('StadiumApron', { width: 200, height: 210 }, scene);
  apronMesh.position.set(0, -0.025, 8);
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

  // Touchlines, attacking goal line (Z = -34), defensive goal line (Z = +50), halfway line (Z = +8)
  addLineRect('OuterPitch', 0, 8, pitchW, pitchL, 0.16);
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

  addRingOnTurf('PenaltyArc', 0, -23, 8.98, 9.14, 0.65, Math.PI - 1.30, 44);

  // Defensive Build-Up Penalty Area & 6-Yard Goal Area at Z = +50m (for CB / FB Backline Press-Escape!)
  addLineRect('DefPenaltyBox', 0, 41.75, 34, 16.5, 0.14);
  addLineRect('DefSixYardBox', 0, 47.25, 16, 5.5, 0.14);

  const defPenSpot = BABYLON.MeshBuilder.CreateDisc('DefPenaltySpot', { radius: 0.22, tessellation: 24 }, scene);
  defPenSpot.rotation.x = Math.PI / 2;
  defPenSpot.position.set(0, 0.014, 39);
  defPenSpot.material = lineMat;
  defPenSpot.parent = pitchRoot;

  addRingOnTurf('DefPenaltyArc', 0, 39, 8.98, 9.14, Math.PI + 0.65, Math.PI - 1.30, 44);

  // Subtle Zone 14 Tactical Box (Attacking) & Build-Up Zone 5/6 Guide (Defensive)
  const z14Mat = new BABYLON.StandardMaterial('Zone14Mat', scene);
  z14Mat.disableLighting = true;
  z14Mat.emissiveColor = new BABYLON.Color3(0.96, 0.79, 0.27);
  z14Mat.alpha = 0.08;
  z14Mat.backFaceCulling = false;
  const z14 = BABYLON.MeshBuilder.CreateGround('Zone14Guide', { width: 14, height: 9 }, scene);
  z14.position.set(0, 0.008, -13);
  z14.material = z14Mat;
  z14.parent = pitchRoot;

  // 5. 3D Goalframes & Nets at Both Ends (Z = -34m Attacking & Z = +50m Defensive)
  const postMat = new BABYLON.PBRMetallicRoughnessMaterial('GoalPostMat', scene);
  postMat.baseColor = new BABYLON.Color3(0.97, 0.98, 0.99);
  postMat.metallic = 0.32;
  postMat.roughness = 0.24;

  const netMat = new BABYLON.StandardMaterial('GoalNetMat', scene);
  netMat.disableLighting = true;
  netMat.emissiveColor = new BABYLON.Color3(0.84, 0.90, 0.95);
  netMat.wireframe = true;
  netMat.alpha = 0.22;

  const goalW = 7.32;
  const goalH = 2.44;
  const goalD = 2.0;

  function buildGoalAtZ(prefix, zLine, depthSign) {
    const lp = BABYLON.MeshBuilder.CreateCylinder(`${prefix}_LeftPost`, { diameter: 0.13, height: goalH, tessellation: 18 }, scene);
    lp.position.set(-goalW / 2, goalH / 2, zLine);
    lp.material = postMat;
    lp.parent = pitchRoot;
    shadowGen.addShadowCaster(lp);

    const rp = lp.clone(`${prefix}_RightPost`);
    rp.position.set(goalW / 2, goalH / 2, zLine);
    rp.parent = pitchRoot;
    shadowGen.addShadowCaster(rp);

    const cb = BABYLON.MeshBuilder.CreateCylinder(`${prefix}_Crossbar`, { diameter: 0.13, height: goalW + 0.14, tessellation: 18 }, scene);
    cb.rotation.z = Math.PI / 2;
    cb.position.set(0, goalH, zLine);
    cb.material = postMat;
    cb.parent = pitchRoot;
    shadowGen.addShadowCaster(cb);

    const nb = BABYLON.MeshBuilder.CreateBox(`${prefix}_GoalNet`, { width: goalW, height: goalH, depth: goalD, updatable: false }, scene);
    nb.position.set(0, goalH / 2, zLine + depthSign * (goalD / 2));
    nb.material = netMat;
    nb.parent = pitchRoot;
  }

  buildGoalAtZ('Atk', -34, -1);
  buildGoalAtZ('Def', 50, 1);

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
