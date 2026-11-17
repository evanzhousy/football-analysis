const BABYLON = window.BABYLON;

/**
 * Match-accurate club kit palettes matched 1:1 to all 8 Zhibo8 broadcast clips.
 */
export const CLUB_KIT_PRESETS = {
  'barca-home': {
    pattern: 'stripes',
    primary: '#004d98',
    secondary: '#a50044',
    accent: '#edbb00',
    shorts: '#071d49',
    socks: '#071d49',
    sockBand: '#a50044',
    numColor: '#facc15'
  },
  'barca-coral': {
    pattern: 'solid',
    primary: '#ff5a4e',
    secondary: '#e11d48',
    accent: '#0f172a',
    shorts: '#ff5a4e',
    socks: '#ff5a4e',
    sockBand: '#0f172a',
    numColor: '#0f172a'
  },
  'barca-gold': {
    pattern: 'solid',
    primary: '#eab308',
    secondary: '#ca8a04',
    accent: '#004d98',
    shorts: '#eab308',
    socks: '#eab308',
    sockBand: '#a50044',
    numColor: '#0f172a'
  },
  'mallorca-yellow': {
    pattern: 'solid',
    primary: '#dff21b',
    secondary: '#c5d90d',
    accent: '#111827',
    shorts: '#111827',
    socks: '#dff21b',
    sockBand: '#111827',
    numColor: '#111827'
  },
  'madrid-white': {
    pattern: 'solid',
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    accent: '#d97706',
    shorts: '#f8fafc',
    socks: '#f8fafc',
    sockBand: '#d97706',
    numColor: '#1e293b'
  },
  'rayo-white': {
    pattern: 'sash',
    primary: '#f8fafc',
    secondary: '#dc2626',
    accent: '#dc2626',
    shorts: '#f8fafc',
    socks: '#f8fafc',
    sockBand: '#dc2626',
    numColor: '#111827'
  },
  'psg-navy': {
    pattern: 'center-band',
    primary: '#112244',
    secondary: '#c8102e',
    accent: '#f8fafc',
    shorts: '#112244',
    socks: '#112244',
    sockBand: '#c8102e',
    numColor: '#f8fafc'
  },
  'atleti-striped': {
    pattern: 'stripes',
    primary: '#cb3524',
    secondary: '#f8fafc',
    accent: '#1d4ed8',
    shorts: '#1e3a8a',
    socks: '#cb3524',
    sockBand: '#f8fafc',
    numColor: '#1e3a8a'
  },
  'villarreal-yellow': {
    pattern: 'solid',
    primary: '#facc15',
    secondary: '#eab308',
    accent: '#1e3a8a',
    shorts: '#facc15',
    socks: '#facc15',
    sockBand: '#1e3a8a',
    numColor: '#1e3a8a'
  },
  'valencia-white': {
    pattern: 'solid',
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    accent: '#111827',
    shorts: '#111827',
    socks: '#111827',
    sockBand: '#f97316',
    numColor: '#111827'
  },
  'sevilla-white': {
    pattern: 'solid',
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    accent: '#dc2626',
    shorts: '#f8fafc',
    socks: '#111827',
    sockBand: '#dc2626',
    numColor: '#dc2626'
  },
  'gk-pink': {
    pattern: 'solid',
    primary: '#ec4899',
    secondary: '#db2777',
    accent: '#111827',
    shorts: '#ec4899',
    socks: '#ec4899',
    sockBand: '#111827',
    numColor: '#ffffff'
  },
  'bayern-red': {
    pattern: 'solid',
    primary: '#dc2626',
    secondary: '#b91c1c',
    accent: '#f8fafc',
    shorts: '#dc2626',
    socks: '#dc2626',
    sockBand: '#f8fafc',
    numColor: '#f8fafc'
  },
  'bayern-navy': {
    pattern: 'center-band',
    primary: '#171f32',
    secondary: '#be123c',
    accent: '#f43f5e',
    shorts: '#171f32',
    socks: '#171f32',
    sockBand: '#be123c',
    numColor: '#f8fafc'
  },
  'belgium-white': {
    pattern: 'solid',
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    accent: '#dc2626',
    shorts: '#f8fafc',
    socks: '#f8fafc',
    sockBand: '#dc2626',
    numColor: '#b91c1c'
  },
  'wales-red': {
    pattern: 'solid',
    primary: '#dc2626',
    secondary: '#b91c1c',
    accent: '#facc15',
    shorts: '#dc2626',
    socks: '#dc2626',
    sockBand: '#facc15',
    numColor: '#f8fafc'
  },
  'bilbao-striped': {
    pattern: 'stripes',
    primary: '#d92323',
    secondary: '#f8fafc',
    accent: '#111827',
    shorts: '#111827',
    socks: '#111827',
    sockBand: '#d92323',
    numColor: '#111827'
  },
  'brazil-yellow': {
    pattern: 'solid',
    primary: '#fde047',
    secondary: '#facc15',
    accent: '#16a34a',
    shorts: '#1d4ed8',
    socks: '#f8fafc',
    sockBand: '#16a34a',
    numColor: '#15803d'
  },
  'japan-blue': {
    pattern: 'solid',
    primary: '#172554',
    secondary: '#1e3a8a',
    accent: '#38bdf8',
    shorts: '#172554',
    socks: '#172554',
    sockBand: '#38bdf8',
    numColor: '#f8fafc'
  },
  'trabzon-striped': {
    pattern: 'center-band',
    primary: '#1e1b2e',
    secondary: '#38bdf8',
    accent: '#7f1d1d',
    shorts: '#111827',
    socks: '#111827',
    sockBand: '#38bdf8',
    numColor: '#f8fafc'
  },
  'press-orange': {
    pattern: 'solid',
    primary: '#f97316',
    secondary: '#ea580c',
    accent: '#ffffff',
    shorts: '#f97316',
    socks: '#f97316',
    sockBand: '#ffffff',
    numColor: '#ffffff'
  },
  'celtic-hoops': {
    pattern: 'hoops',
    primary: '#f8fafc',
    secondary: '#16a34a',
    accent: '#15803d',
    shorts: '#f8fafc',
    socks: '#f8fafc',
    sockBand: '#16a34a',
    numColor: '#111827'
  },
  'scottish-blue': {
    pattern: 'solid',
    primary: '#1d4ed8',
    secondary: '#1e40af',
    accent: '#f8fafc',
    shorts: '#f8fafc',
    socks: '#1d4ed8',
    sockBand: '#f8fafc',
    numColor: '#f8fafc'
  },
  'arsenal-red': {
    pattern: 'arsenal',
    primary: '#dc2626',
    secondary: '#f8fafc',
    accent: '#f8fafc',
    shorts: '#f8fafc',
    socks: '#dc2626',
    sockBand: '#f8fafc',
    numColor: '#f8fafc'
  },
  'spurs-navy': {
    pattern: 'solid',
    primary: '#172033',
    secondary: '#0f172a',
    accent: '#38bdf8',
    shorts: '#172033',
    socks: '#172033',
    sockBand: '#38bdf8',
    numColor: '#f8fafc'
  },
  'hertha-striped': {
    pattern: 'stripes',
    primary: '#1d4ed8',
    secondary: '#f8fafc',
    accent: '#1e3a8a',
    shorts: '#1d4ed8',
    socks: '#1d4ed8',
    sockBand: '#f8fafc',
    numColor: '#111827'
  },
  'morocco-red': {
    pattern: 'solid',
    primary: '#c81e2b',
    secondary: '#991b1b',
    accent: '#15803d',
    shorts: '#15803d',
    socks: '#c81e2b',
    sockBand: '#15803d',
    numColor: '#f8fafc'
  },
  'ivory-white': {
    pattern: 'solid',
    primary: '#f8fafc',
    secondary: '#e2e8f0',
    accent: '#ea580c',
    shorts: '#f8fafc',
    socks: '#f8fafc',
    sockBand: '#16a34a',
    numColor: '#15803d'
  },
  'gk-yellow': {
    pattern: 'solid',
    primary: '#facc15',
    secondary: '#eab308',
    accent: '#111827',
    shorts: '#facc15',
    socks: '#facc15',
    sockBand: '#111827',
    numColor: '#111827'
  },
  'gk-blue': {
    pattern: 'solid',
    primary: '#2563eb',
    secondary: '#1d4ed8',
    accent: '#f8fafc',
    shorts: '#2563eb',
    socks: '#2563eb',
    sockBand: '#f8fafc',
    numColor: '#ffffff'
  },
  'gk-green': {
    pattern: 'solid',
    primary: '#16a34a',
    secondary: '#15803d',
    accent: '#f8fafc',
    shorts: '#111827',
    socks: '#16a34a',
    sockBand: '#f8fafc',
    numColor: '#ffffff'
  }
};

let skinAtlasImg = null;
let zoneMaskData = null;
let kitAssetsPromise = null;

function loadImageAsync(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function preloadKitTextures() {
  if (kitAssetsPromise) return kitAssetsPromise;
  kitAssetsPromise = Promise.all([
    loadImageAsync('./assets/models/clean_skin_atlas.png'),
    loadImageAsync('./assets/models/body_zone_mask.png')
  ]).then(([skinImg, maskImg]) => {
    skinAtlasImg = skinImg;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.drawImage(maskImg, 0, 0, 512, 512);
    zoneMaskData = ctx.getImageData(0, 0, 512, 512).data;
  });
  return kitAssetsPromise;
}

function hexToRgb(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function resolveKitPreset(actorDefOrKey) {
  if (!actorDefOrKey) return CLUB_KIT_PRESETS['barca-home'];
  if (typeof actorDefOrKey === 'string') {
    return CLUB_KIT_PRESETS[actorDefOrKey] || CLUB_KIT_PRESETS['barca-home'];
  }
  if (actorDefOrKey.kit && CLUB_KIT_PRESETS[actorDefOrKey.kit]) {
    return CLUB_KIT_PRESETS[actorDefOrKey.kit];
  }
  if (actorDefOrKey.role === 'pedri' || actorDefOrKey.role === 'hero' || actorDefOrKey.role === 'teammate') {
    return CLUB_KIT_PRESETS['barca-home'];
  }
  return CLUB_KIT_PRESETS['madrid-white'];
}

const jerseyTexCache = new Map();
const bodyTexCache = new Map();

/**
 * Generates a crisp 1024x1024 DynamicTexture for `Ch42_Shirt` (`TEXCOORD_1`):
 *   - Left half [0..512]: Front jersey panel (stripes/hoops/arsenal/sash/center-band + club crest + sponsor mark)
 *   - Right half [512..1024]: Back jersey panel (pattern + outlined Surname & Squad Number)
 *   - Top center [470..554, 0..76]: Collar & short-sleeve cuff trim swatch (`preset.accent`)
 */
function getJerseyAlbedoTexture(scene, preset, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const numStr = actorDef.number || (isPedri ? '8' : '');
  const nameStr = actorDef.shirtName || (isPedri ? 'PEDRI' : '');
  const cacheKey = `${actorDef.kit || preset.primary}|${numStr}|${nameStr}`;
  if (jerseyTexCache.has(cacheKey)) return jerseyTexCache.get(cacheKey);

  const tex = new BABYLON.DynamicTexture(`JerseyTex_${cacheKey}`, { width: 1024, height: 1024 }, scene, true);
  tex.coordinatesIndex = 1;
  tex.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
  tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;

  const ctx = tex.getContext();
  ctx.fillStyle = preset.primary;
  ctx.fillRect(0, 0, 1024, 1024);

  function drawPanelPattern(offsetX) {
    if (preset.pattern === 'stripes') {
      const stripeW = 46;
      for (let x = offsetX; x < offsetX + 512; x += stripeW * 2) {
        ctx.fillStyle = preset.secondary;
        ctx.fillRect(x + stripeW * 0.5, 64, stripeW, 960);
      }
      ctx.fillStyle = preset.primary;
      ctx.fillRect(offsetX, 64, 104, 420);
      ctx.fillRect(offsetX + 408, 64, 104, 420);
    } else if (preset.pattern === 'hoops') {
      const hoopH = 58;
      for (let y = 76; y < 1024; y += hoopH * 2) {
        ctx.fillStyle = preset.secondary;
        ctx.fillRect(offsetX, y, 512, hoopH);
      }
    } else if (preset.pattern === 'arsenal') {
      // Iconic Arsenal red body + crisp white short sleeves
      ctx.fillStyle = preset.secondary;
      ctx.fillRect(offsetX, 64, 122, 430);
      ctx.fillRect(offsetX + 390, 64, 122, 430);
    } else if (preset.pattern === 'center-band') {
      const cx = offsetX + 256;
      ctx.fillStyle = preset.accent;
      ctx.fillRect(cx - 42, 64, 84, 960);
      ctx.fillStyle = preset.secondary;
      ctx.fillRect(cx - 32, 64, 64, 960);
    } else if (preset.pattern === 'sash' && offsetX === 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 64, 512, 960);
      ctx.clip();
      ctx.strokeStyle = preset.secondary;
      ctx.lineWidth = 68;
      ctx.beginPath();
      ctx.moveTo(110, 110);
      ctx.lineTo(410, 880);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPanelPattern(0);
  drawPanelPattern(512);

  // Subtle woven fabric micro-grain
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y = 70; y < 1020; y += 6) {
    ctx.fillRect(0, y, 1024, 2);
  }

  // Collar & Short-Sleeve Cuff Accent Swatch at uv1 = (0.50, 0.04) -> px = (512, 41)
  ctx.fillStyle = preset.accent;
  ctx.fillRect(460, 0, 104, 78);

  // Front Left-Chest Authentic Club Crest Shield (player's +X = u1 ~ 0.31 -> px ~ 318, y ~ 292)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(301, 263);
  ctx.lineTo(339, 263);
  ctx.lineTo(339, 296);
  ctx.quadraticCurveTo(320, 320, 301, 296);
  ctx.closePath();
  ctx.fillStyle = preset.accent;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#0f172a';
  ctx.stroke();

  // Inner crest quarters (St George Cross + Senyera + Blaugrana base)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(303, 266, 17, 15);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(309, 266, 5, 15);
  ctx.fillRect(303, 271, 17, 5);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(320, 266, 17, 15);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(324, 266, 3, 15);
  ctx.fillRect(331, 266, 3, 15);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(301, 281, 38, 4);
  ctx.fillStyle = preset.primary;
  ctx.fillRect(301, 285, 38, 35);
  ctx.fillStyle = preset.secondary;
  ctx.fillRect(310, 285, 7, 35);
  ctx.fillRect(324, 285, 7, 35);
  ctx.restore();

  // Outer gold crest border
  ctx.beginPath();
  ctx.moveTo(301, 263);
  ctx.lineTo(339, 263);
  ctx.lineTo(339, 296);
  ctx.quadraticCurveTo(320, 320, 301, 296);
  ctx.closePath();
  ctx.lineWidth = 3;
  ctx.strokeStyle = preset.accent;
  ctx.stroke();

  // Front Right-Chest Manufacturer Swoosh (player's -X = u1 ~ 0.19 -> px ~ 194, y ~ 290)
  ctx.strokeStyle = preset.accent;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(178, 291);
  ctx.quadraticCurveTo(189, 305, 212, 281);
  ctx.stroke();
  ctx.restore();

  // Back Panel Solid Number Box Readability Guard on Striped Kits + Surname & Squad Number
  if (nameStr || numStr) {
    if (preset.pattern === 'stripes') {
      ctx.fillStyle = preset.primary;
      ctx.fillRect(650, 290, 236, 370);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    if (nameStr) {
      ctx.font = '800 50px "Inter", "Arial Black", sans-serif';
      ctx.lineWidth = 11;
      ctx.strokeStyle = 'rgba(8, 12, 24, 0.92)';
      ctx.strokeText(nameStr.toUpperCase(), 768, 235);
      ctx.fillStyle = preset.numColor;
      ctx.fillText(nameStr.toUpperCase(), 768, 235);
    }

    if (numStr) {
      ctx.font = '900 260px "Inter", "Impact", "Arial Black", sans-serif';
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(8, 12, 24, 0.92)';
      ctx.strokeText(String(numStr), 768, 465);
      ctx.fillStyle = preset.numColor;
      ctx.fillText(String(numStr), 768, 465);
    }
  }

  tex.update(false); // glTF TEXCOORD_1 convention: v=0 is top of canvas
  jerseyTexCache.set(cacheKey, tex);
  return tex;
}

/**
 * Generates a 512x512 DynamicTexture for `Ch42_Body1` (`TEXCOORD_0`):
 *   - Preserves photorealistic face, eyes, ears, bare arms, and bare knees
 *   - Composites club knee-high football socks + top turnover hoops + Pedri wrist tape + under-kit guard
 */
function getBodyAndSocksTexture(scene, preset, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const skinTintHex = actorDef.skinTint || '#ffffff';
  const hasTape = isPedri || Boolean(actorDef.wristTape);
  const cacheKey = `${preset.socks}|${preset.sockBand}|${preset.primary}|${skinTintHex}|${hasTape ? 1 : 0}`;
  if (bodyTexCache.has(cacheKey)) return bodyTexCache.get(cacheKey);

  const tex = new BABYLON.DynamicTexture(`BodySockTex_${cacheKey}`, { width: 512, height: 512 }, scene, true);
  const ctx = tex.getContext();

  if (skinAtlasImg && zoneMaskData) {
    ctx.drawImage(skinAtlasImg, 0, 0, 512, 512);
    const imgData = ctx.getImageData(0, 0, 512, 512);
    const d = imgData.data;

    const [tR, tG, tB] = hexToRgb(skinTintHex);
    const [sR, sG, sB] = hexToRgb(preset.socks);
    const [bR, bG, bB] = hexToRgb(preset.sockBand);
    const [uR, uG, uB] = hexToRgb(preset.primary);
    const applySkinTint = skinTintHex.toLowerCase() !== '#ffffff';

    for (let i = 0; i < d.length; i += 4) {
      const mSock = zoneMaskData[i];       // R: knee-high football sock
      const mHoop = zoneMaskData[i + 1];   // G: top turnover band
      const mExtra = zoneMaskData[i + 2];  // B: 255 = wrist tape, 128 = under-kit guard

      // Subtle original muscle/calf shading factor [0.72..1.12]
      const shade = Math.max(0.72, Math.min(1.12, (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 168));

      if (mSock > 90) {
        if (mHoop > 110) {
          d[i] = Math.min(255, bR * shade);
          d[i + 1] = Math.min(255, bG * shade);
          d[i + 2] = Math.min(255, bB * shade);
        } else {
          d[i] = Math.min(255, sR * shade);
          d[i + 1] = Math.min(255, sG * shade);
          d[i + 2] = Math.min(255, sB * shade);
        }
      } else if (hasTape && mExtra > 190) {
        d[i] = Math.min(255, 244 * shade);
        d[i + 1] = Math.min(255, 247 * shade);
        d[i + 2] = Math.min(255, 250 * shade);
      } else if (mExtra > 95 && mExtra <= 175) {
        d[i] = uR;
        d[i + 1] = uG;
        d[i + 2] = uB;
      } else if (applySkinTint) {
        const kR = 0.55 + 0.45 * (tR / 212);
        const kG = 0.55 + 0.45 * (tG / 188);
        const kB = 0.55 + 0.45 * (tB / 172);
        d[i] = Math.min(255, d[i] * kR);
        d[i + 1] = Math.min(255, d[i + 1] * kG);
        d[i + 2] = Math.min(255, d[i + 2] * kB);
      } else {
        // Subtle warm athletic skin tone balance under cool stadium floodlights
        d[i] = Math.min(255, d[i] * 1.07);
        d[i + 1] = Math.min(255, d[i + 1] * 0.99);
        d[i + 2] = Math.min(255, d[i + 2] * 0.91);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  tex.update(false);
  bodyTexCache.set(cacheKey, tex);
  return tex;
}

const shirtMatCache = new Map();
const shortsMatCache = new Map();
const cleatsMatCache = new Map();
const bodyMatCache = new Map();
const hairMatCache = new Map();
let cachedSharedBump = null;

/**
 * Applies club kit, photorealistic face/skin, high football socks, cleats, and hair styling
 * onto an instantiated Mixamo footballer hierarchy using cached standard Babylon.js PBRMaterials.
 */
export function applyBabylonFootballerKit(scene, meshes, actorDef, shadowGen) {
  const preset = resolveKitPreset(actorDef);
  const isPedri = actorDef.role === 'pedri';

  if (!cachedSharedBump) {
    for (const m of meshes) {
      if (m.material && m.material.bumpTexture) {
        cachedSharedBump = m.material.bumpTexture;
        break;
      }
    }
  }

  for (const mesh of meshes) {
    if (!mesh || !mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;

    mesh.receiveShadows = true;
    mesh.alwaysSelectAsActiveMesh = true;
    if (shadowGen) {
      shadowGen.addShadowCaster(mesh, false);
    }

    const nm = mesh.name || '';

    if (nm.includes('Ch42_Shirt')) {
      const numStr = actorDef.number || (isPedri ? '8' : '');
      const nameStr = actorDef.shirtName || (isPedri ? 'PEDRI' : '');
      const key = `${actorDef.kit || preset.primary}|${numStr}|${nameStr}`;
      let shirtMat = shirtMatCache.get(key);
      if (!shirtMat) {
        shirtMat = new BABYLON.PBRMaterial(`ShirtPBR_${key}`, scene);
        shirtMat.albedoTexture = getJerseyAlbedoTexture(scene, preset, actorDef);
        if (cachedSharedBump) {
          shirtMat.bumpTexture = cachedSharedBump;
          shirtMat.bumpTexture.level = 0.78;
        }
        shirtMat.metallic = 0.02;
        shirtMat.roughness = 0.68;
        shirtMat.backFaceCulling = false;
        shirtMatCache.set(key, shirtMat);
      }
      mesh.material = shirtMat;
    } else if (nm.includes('Ch42_Shorts')) {
      const key = preset.shorts;
      let shortsMat = shortsMatCache.get(key);
      if (!shortsMat) {
        shortsMat = new BABYLON.PBRMaterial(`ShortsPBR_${key}`, scene);
        shortsMat.albedoColor = BABYLON.Color3.FromHexString(preset.shorts).toLinearSpace();
        if (cachedSharedBump) {
          shortsMat.bumpTexture = cachedSharedBump;
          shortsMat.bumpTexture.level = 0.65;
        }
        shortsMat.metallic = 0.02;
        shortsMat.roughness = 0.70;
        shortsMat.backFaceCulling = false;
        shortsMatCache.set(key, shortsMat);
      }
      mesh.material = shortsMat;
    } else if (nm.includes('Ch42_Sneakers')) {
      const isHero = isPedri || actorDef.role === 'hero';
      const bootHex =
        actorDef.bootColor ||
        (isHero ? '#f8fafc' : actorDef.kit === 'gk-pink' ? '#facc15' : actorDef.role === 'teammate' ? '#38bdf8' : '#1e293b');
      let cleatsMat = cleatsMatCache.get(bootHex);
      if (!cleatsMat) {
        cleatsMat = new BABYLON.PBRMaterial(`CleatsPBR_${bootHex}`, scene);
        cleatsMat.albedoColor = BABYLON.Color3.FromHexString(bootHex).toLinearSpace();
        if (cachedSharedBump) {
          cleatsMat.bumpTexture = cachedSharedBump;
          cleatsMat.bumpTexture.level = 0.85;
        }
        cleatsMat.metallic = 0.14;
        cleatsMat.roughness = 0.36;
        cleatsMat.backFaceCulling = false;
        cleatsMatCache.set(bootHex, cleatsMat);
      }
      mesh.material = cleatsMat;
    } else if (nm.includes('Ch42_Body1')) {
      const skinTintHex = actorDef.skinTint || '#ffffff';
      const hasTape = isPedri || Boolean(actorDef.wristTape);
      const key = `${preset.socks}|${preset.sockBand}|${preset.primary}|${skinTintHex}|${hasTape ? 1 : 0}`;
      let bodyMat = bodyMatCache.get(key);
      if (!bodyMat) {
        bodyMat = new BABYLON.PBRMaterial(`BodyPBR_${key}`, scene);
        bodyMat.albedoTexture = getBodyAndSocksTexture(scene, preset, actorDef);
        if (cachedSharedBump) {
          bodyMat.bumpTexture = cachedSharedBump;
          bodyMat.bumpTexture.level = 0.45;
        }
        bodyMat.metallic = 0.01;
        bodyMat.roughness = 0.62;
        bodyMat.backFaceCulling = false;
        bodyMatCache.set(key, bodyMat);
      }
      mesh.material = bodyMat;
    } else if (nm.includes('Hair') || nm.includes('Eyelashes')) {
      const hairColHex =
        actorDef.hairColor ||
        (isPedri ? '#2b1d14' : actorDef.hairVariant === 2 ? '#14110f' : '#3a281c');
      const isHair = nm.includes('Hair');
      const key = `${hairColHex}|${isHair ? 'H' : 'E'}`;
      let hairMat = hairMatCache.get(key);
      if (!hairMat) {
        const origHair = mesh.material;
        hairMat = origHair ? origHair.clone(`HairPBR_${key}`) : new BABYLON.PBRMaterial(`HairPBR_${key}`, scene);
        hairMat.albedoColor = BABYLON.Color3.FromHexString(hairColHex).toLinearSpace().scale(1.35);
        hairMat.roughness = 0.76;
        hairMat.metallic = 0.03;
        hairMat.backFaceCulling = false;
        if (isHair) {
          hairMat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATESTANDBLEND;
          hairMat.alphaCutOff = 0.32;
        }
        hairMatCache.set(key, hairMat);
      }
      mesh.material = hairMat;
    }
  }
}
