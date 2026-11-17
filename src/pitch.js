import * as THREE from 'three';

/**
 * Builds an authentic 3D stadium football pitch (half-to-full tactical zone: 56m wide x 68m long)
 * Coordinate convention:
 *   X: lateral across pitch (-28m left touchline to +28m right touchline)
 *   Z: longitudinal along pitch (+28m defensive build-up half to -34m attacking penalty area)
 *   Y: vertical height (0 = turf surface)
 */
export function createPitchEnvironment(scene) {
  const pitchGroup = new THREE.Group();

  // 1. Procedural mowed grass texture with subtle turf grain
  const turfCanvas = document.createElement('canvas');
  turfCanvas.width = 1024;
  turfCanvas.height = 1024;
  const ctx = turfCanvas.getContext('2d');

  const stripes = 16;
  const stripeH = turfCanvas.height / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1e5b35' : '#23683d';
    ctx.fillRect(0, i * stripeH, turfCanvas.width, stripeH);
  }

  // Subtle organic grass blade speckle
  for (let i = 0; i < 24000; i++) {
    const x = Math.random() * turfCanvas.width;
    const y = Math.random() * turfCanvas.height;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
    ctx.fillRect(x, y, 2, 2);
  }

  const turfTexture = new THREE.CanvasTexture(turfCanvas);
  turfTexture.wrapS = THREE.RepeatWrapping;
  turfTexture.wrapT = THREE.RepeatWrapping;
  turfTexture.colorSpace = THREE.SRGBColorSpace;
  turfTexture.anisotropy = 8;

  const pitchW = 56;
  const pitchL = 68;
  const turfGeo = new THREE.PlaneGeometry(pitchW + 10, pitchL + 10);
  const turfMat = new THREE.MeshStandardMaterial({
    map: turfTexture,
    roughness: 0.86,
    metalness: 0.02
  });
  const turfMesh = new THREE.Mesh(turfGeo, turfMat);
  turfMesh.rotation.x = -Math.PI / 2;
  turfMesh.position.set(0, 0, -3);
  turfMesh.receiveShadow = true;
  pitchGroup.add(turfMesh);

  // Dark stadium surround apron
  const apronGeo = new THREE.PlaneGeometry(160, 160);
  const apronMat = new THREE.MeshStandardMaterial({
    color: 0x0b1118,
    roughness: 0.95
  });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.y = -0.02;
  pitchGroup.add(apronMesh);

  // 2. Crisp white chalk pitch lines
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xf4f7f5,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide
  });

  function addLineRect(cx, cz, w, h, thickness = 0.14) {
    // Top & Bottom
    const horizGeo = new THREE.PlaneGeometry(w, thickness);
    const top = new THREE.Mesh(horizGeo, lineMat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(cx, 0.012, cz - h / 2);
    const bot = top.clone();
    bot.position.set(cx, 0.012, cz + h / 2);

    // Left & Right
    const vertGeo = new THREE.PlaneGeometry(thickness, h);
    const left = new THREE.Mesh(vertGeo, lineMat);
    left.rotation.x = -Math.PI / 2;
    left.position.set(cx - w / 2, 0.012, cz);
    const right = left.clone();
    right.position.set(cx + w / 2, 0.012, cz);

    pitchGroup.add(top, bot, left, right);
  }

  // Outer touchlines & goal line (Z = -34 is attacking goal line, Z = +28 is defensive third cut)
  addLineRect(0, -3, pitchW, 62, 0.16);

  // Halfway line at Z = +8
  const halfLine = new THREE.Mesh(new THREE.PlaneGeometry(pitchW, 0.15), lineMat);
  halfLine.rotation.x = -Math.PI / 2;
  halfLine.position.set(0, 0.013, 8);
  pitchGroup.add(halfLine);

  // Center circle at (0, 8), radius = 9.15m
  const centerCircleGeo = new THREE.RingGeometry(9.02, 9.18, 72);
  const centerCircle = new THREE.Mesh(centerCircleGeo, lineMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.set(0, 0.013, 8);
  pitchGroup.add(centerCircle);

  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.24, 24), lineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.set(0, 0.014, 8);
  pitchGroup.add(centerSpot);

  // Attacking Penalty Area at Z = -34 (width 40.3m -> scaled 34m, depth 16.5m -> Z from -34 to -17.5)
  addLineRect(0, -25.75, 34, 16.5, 0.14);
  // 6-yard Goal Area
  addLineRect(0, -31.25, 16, 5.5, 0.14);

  // Penalty Spot (Z = -23) & Penalty Arc
  const penSpot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), lineMat);
  penSpot.rotation.x = -Math.PI / 2;
  penSpot.position.set(0, 0.014, -23);
  pitchGroup.add(penSpot);

  const dArcGeo = new THREE.RingGeometry(8.95, 9.1, 48, 1, Math.PI * 0.21, Math.PI * 0.58);
  const dArc = new THREE.Mesh(dArcGeo, lineMat);
  dArc.rotation.x = -Math.PI / 2;
  dArc.rotation.z = Math.PI;
  dArc.position.set(0, 0.013, -23);
  pitchGroup.add(dArc);

  // Subtle tactical Zone 14 & Half-Space guide markings (very faint chalk)
  const tacticalDashMat = new THREE.MeshBasicMaterial({
    color: 0xf6c945,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide
  });
  const zone14Mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), tacticalDashMat);
  zone14Mesh.rotation.x = -Math.PI / 2;
  zone14Mesh.position.set(0, 0.008, -13);
  pitchGroup.add(zone14Mesh);

  // 3. 3D Attacking Goalframe at Z = -34
  const goalGroup = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.3 });
  const goalW = 7.32;
  const goalH = 2.44;
  const goalD = 2.0;

  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, goalH, 16);
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-goalW / 2, goalH / 2, -34);
  leftPost.castShadow = true;

  const rightPost = leftPost.clone();
  rightPost.position.set(goalW / 2, goalH / 2, -34);

  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, goalW + 0.14, 16), postMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, goalH, -34);
  crossbar.castShadow = true;

  const netMat = new THREE.MeshBasicMaterial({
    color: 0xdbe6f0,
    wireframe: true,
    transparent: true,
    opacity: 0.22
  });
  const netBox = new THREE.Mesh(new THREE.BoxGeometry(goalW, goalH, goalD, 18, 8, 6), netMat);
  netBox.position.set(0, goalH / 2, -34 - goalD / 2);

  goalGroup.add(leftPost, rightPost, crossbar, netBox);
  pitchGroup.add(goalGroup);

  // 4. Stadium Floodlight Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xdceeff, 0x163822, 0.75);
  scene.add(hemiLight);

  const mainFlood = new THREE.DirectionalLight(0xfff8eb, 1.85);
  mainFlood.position.set(22, 38, 24);
  mainFlood.castShadow = true;
  mainFlood.shadow.mapSize.width = 2048;
  mainFlood.shadow.mapSize.height = 2048;
  mainFlood.shadow.camera.near = 5;
  mainFlood.shadow.camera.far = 110;
  mainFlood.shadow.camera.left = -35;
  mainFlood.shadow.camera.right = 35;
  mainFlood.shadow.camera.top = 35;
  mainFlood.shadow.camera.bottom = -35;
  mainFlood.shadow.bias = -0.0005;
  scene.add(mainFlood);

  const rimFlood = new THREE.DirectionalLight(0xbfd9ff, 0.65);
  rimFlood.position.set(-26, 28, -28);
  scene.add(rimFlood);

  scene.add(pitchGroup);
  return pitchGroup;
}

/**
 * Creates a detailed 3D match football with procedural panel pattern
 */
export function createMatchBall() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);

  // Classic dark & gold match-ball star panels
  const spots = [
    [32, 32], [96, 28], [160, 34], [224, 30],
    [64, 88], [128, 92], [192, 86]
  ];
  spots.forEach(([x, y], idx) => {
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = idx % 2 === 0 ? '#111827' : '#a50044';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#eab308';
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 28, 28),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.32,
      metalness: 0.08
    })
  );
  ballMesh.castShadow = true;
  ballMesh.position.y = 0.24;
  return ballMesh;
}
