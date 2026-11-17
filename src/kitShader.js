import * as THREE from 'three';

/**
 * Generates a high-DPI transparent decal CanvasTexture for the back of the jersey
 * (Player Name + Squad Number, e.g. "PEDRI" / "8").
 */
function createBackDecalTexture(role, numberText, playerName) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const ink = role === 'defender' ? '#0f172a' : '#facc15';
  const stroke = role === 'defender' ? 'rgba(255,255,255,0.85)' : 'rgba(10,18,36,0.92)';

  // Arc / Upper Back Name
  if (playerName) {
    ctx.font = '800 54px "Inter", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 10;
    ctx.strokeStyle = stroke;
    ctx.strokeText(playerName.toUpperCase(), 256, 108);
    ctx.fillStyle = ink;
    ctx.fillText(playerName.toUpperCase(), 256, 108);
  }

  // Large Squad Number
  ctx.font = '900 248px "Inter", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 16;
  ctx.strokeStyle = stroke;
  ctx.strokeText(String(numberText), 256, 305);
  ctx.fillStyle = ink;
  ctx.fillText(String(numberText), 256, 305);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function srgbHexToLinearVec3(hex) {
  const col = new THREE.Color(hex);
  return col; // Three.js Color stores linear RGB internally in r152+
}

/**
 * Creates a GPU-Skinned PBR Material that maps authentic football kit anatomy
 * (cleats + carbon studs, pro ankle tape, knee-high socks with hoops, bare knees,
 * shorts with side trim, Blaugrana/rival jersey + #8 PEDRI back decal, bare forearms,
 * wrist tape, skin & sculpted hair) directly in bind-pose space (vBindPos)
 * so all 67 Mixamo bones deform the kit & muscles seamlessly!
 */
export function createFootballerKitMaterial({ role = 'defender', number = '6', label = '' }) {
  let shortName = '';
  if (role === 'pedri') shortName = 'PEDRI';
  else if (label.includes('库巴西')) shortName = 'CUBARSI';
  else if (label.includes('费尔明')) shortName = 'FERMIN';
  else if (label.includes('亚马尔')) shortName = 'LAMINE';
  else if (label.includes('罗德里')) shortName = 'RODRI';
  else if (label.includes('拉菲尼亚')) shortName = 'RAPHINHA';

  const backDecal = createBackDecalTexture(role, number, shortName);
  const isBarca = role === 'pedri' || role === 'teammate' ? 1.0 : 0.0;

  const bootHex = role === 'pedri' ? 0xfacc15 : role === 'teammate' ? 0x38bdf8 : 0xe11d48;
  const skinHex = role === 'pedri' ? 0xdfa882 : role === 'teammate' ? 0xd9a17c : 0xd59c78;
  const hairHex = role === 'pedri' ? 0x1d140f : 0x2c1f16;

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.04,
    transparent: false,
    opacity: 1.0
  });

  mat.userData.uniforms = {
    uBackDecal: { value: backDecal },
    uIsBarca: { value: isBarca },
    uBootColor: { value: srgbHexToLinearVec3(bootHex) },
    uSkinColor: { value: srgbHexToLinearVec3(skinHex) },
    uHairColor: { value: srgbHexToLinearVec3(hairHex) }
  };

  mat.customProgramCacheKey = () => `footballer-kit-v1-${role}-${number}`;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBindPos;
        varying vec3 vBindNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBindPos = position;
        vBindNormal = objectNormal;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBindPos;
        varying vec3 vBindNormal;
        uniform sampler2D uBackDecal;
        uniform float uIsBarca;
        uniform vec3 uBootColor;
        uniform vec3 uSkinColor;
        uniform vec3 uHairColor;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float bx = vBindPos.x;
          float by = vBindPos.y;
          float bz = vBindPos.z;
          float ax = abs(bx);

          // Linear RGB palette constants
          vec3 barcaBlue   = vec3(0.0, 0.074, 0.318);
          vec3 barcaGarnet = vec3(0.376, 0.0, 0.058);
          vec3 barcaNavy   = vec3(0.003, 0.024, 0.112);
          vec3 barcaGold   = vec3(0.955, 0.604, 0.015);
          vec3 rivalWhite  = vec3(0.88, 0.90, 0.93);
          vec3 rivalRed    = vec3(0.70, 0.02, 0.03);
          vec3 rivalShorts = vec3(0.018, 0.030, 0.058);
          vec3 tapeWhite   = vec3(0.91, 0.92, 0.94);
          vec3 studDark    = vec3(0.015, 0.018, 0.025);

          vec3 col = uSkinColor;

          if (by < 0.026) {
            // Carbon soleplate + cleat stud accents
            float studMask = step(0.55, sin(bz * 95.0) * cos(bx * 95.0));
            col = mix(studDark, uBootColor * 0.85, studMask * 0.5);
          } else if (by < 0.108) {
            // Football Boot Upper + dynamic speed stripe
            float stripe = smoothstep(0.012, 0.0, abs((by - 0.062) - (bz * 0.22)));
            col = mix(uBootColor, studDark, stripe * 0.55);
          } else if (by < 0.148) {
            // Pro white ankle wrap tape above boot collar
            col = tapeWhite;
          } else if (by < 0.415) {
            // Knee-high football socks + top turnover hoops
            if (uIsBarca > 0.5) {
              col = barcaNavy;
              if (by > 0.365 && by < 0.398) col = barcaGarnet;
              if (by >= 0.398) col = barcaGold;
            } else {
              col = rivalWhite;
              if (by > 0.372 && by < 0.402) col = rivalRed;
            }
          } else if (by < 0.545) {
            // Bare athletic knee & upper calf muscle
            col = uSkinColor;
          } else if (by < 0.955 && ax < 0.255) {
            // Football shorts + side competition stripe + hem trim
            if (uIsBarca > 0.5) {
              col = barcaNavy;
              if (ax > 0.178) col = barcaGarnet;
              if (by < 0.568) col = barcaGold * 0.85;
            } else {
              col = rivalShorts;
              if (ax > 0.178) col = rivalRed;
            }
          } else if (by >= 0.955 && by < 1.505 && ax < 0.295) {
            // Jersey Torso & Short Sleeves (T-pose arm beyond |x|>=0.295 is bare forearm!)
            if (uIsBarca > 0.5) {
              // Classic Blaugrana vertical stripes across chest & back
              float stripeIdx = floor((bx + 0.30) / 0.085);
              col = mod(stripeIdx, 2.0) < 0.5 ? barcaBlue : barcaGarnet;
              // Gold V-collar & sleeve cuff trim
              if (by > 1.452 && ax < 0.115) col = barcaGold;
              if (ax > 0.274) col = barcaGold;
            } else {
              // Atletico / Rival red-and-white vertical stripes
              float stripeIdx = floor((bx + 0.30) / 0.075);
              col = mod(stripeIdx, 2.0) < 0.5 ? rivalWhite : rivalRed;
              if (ax > 0.274) col = rivalRed;
            }

            // Back Jersey Name & Squad Number Decal (-Z is the player's back)
            if (bz < -0.01 && vBindNormal.z < -0.15) {
              // Solid breathable back panel box behind number for UEFA broadcast legibility
              vec2 backUV = vec2(0.5 - (bx / 0.31), (by - 1.03) / 0.39);
              if (backUV.x > 0.04 && backUV.x < 0.96 && backUV.y > 0.04 && backUV.y < 0.96) {
                if (uIsBarca > 0.5) {
                  col = mix(col, barcaBlue * 0.72, 0.55);
                } else {
                  col = mix(col, rivalWhite, 0.78);
                }
                vec4 decal = texture2D(uBackDecal, backUV);
                col = mix(col, decal.rgb, decal.a);
              }
            }
          } else if (by >= 0.88 && ax >= 0.295) {
            // Bare muscular forearms, wrists (with white athletic wrist tape!) & all 20 finger bones
            col = uSkinColor;
            if (ax > 0.555 && ax < 0.602) {
              col = tapeWhite;
            }
          } else if (by >= 1.505) {
            // Neck, sculpted face & athlete haircut
            col = uSkinColor;
            bool isCrown = by > 1.692;
            bool isBackHair = (by > 1.575 && bz < -0.008);
            bool isSideburns = (by > 1.635 && ax > 0.068 && bz < 0.055);
            if (isCrown || isBackHair || isSideburns) {
              col = uHairColor;
            }
          }

          diffuseColor.rgb *= col;
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        if (vBindPos.y < 0.108) {
          roughnessFactor = 0.25; // Glossy pro cleats
        } else if (vBindPos.y >= 1.505 || (abs(vBindPos.x) >= 0.295 && vBindPos.y > 0.88) || (vBindPos.y >= 0.415 && vBindPos.y < 0.545)) {
          roughnessFactor = 0.52; // Athletic skin sheen
        } else {
          roughnessFactor = 0.78; // Matte breathable Dri-FIT fabric
        }`
      );
  };

  return mat;
}
