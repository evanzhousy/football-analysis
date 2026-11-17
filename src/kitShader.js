import * as THREE from 'three';

/**
 * Match-accurate club kit palettes matched 1:1 to the 8 Zhibo8 broadcast clips.
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
    shorts: '#dff21b',
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
  }
};

const backPrintCache = new Map();

function getBackPrintTexture(numberStr = '8', nameStr = 'PEDRI', numColor = '#facc15') {
  const key = `${numberStr}|${nameStr}|${numColor}`;
  if (backPrintCache.has(key)) return backPrintCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  // Subtle dark outline for legibility over striped kits
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (nameStr) {
    ctx.font = '800 58px "Inter", "Arial Black", sans-serif';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(8, 12, 24, 0.85)';
    ctx.strokeText(nameStr.toUpperCase(), 256, 98);
    ctx.fillStyle = numColor;
    ctx.fillText(nameStr.toUpperCase(), 256, 98);
  }

  if (numberStr) {
    ctx.font = '900 280px "Inter", "Impact", "Arial Black", sans-serif';
    ctx.lineWidth = 18;
    ctx.strokeStyle = 'rgba(8, 12, 24, 0.88)';
    ctx.strokeText(String(numberStr), 256, 305);
    ctx.fillStyle = numColor;
    ctx.fillText(String(numberStr), 256, 305);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  backPrintCache.set(key, tex);
  return tex;
}

function resolveKitPreset(actorDef) {
  if (actorDef.kit && CLUB_KIT_PRESETS[actorDef.kit]) {
    return CLUB_KIT_PRESETS[actorDef.kit];
  }
  if (actorDef.role === 'pedri' || actorDef.role === 'teammate') {
    return CLUB_KIT_PRESETS['barca-home'];
  }
  return CLUB_KIT_PRESETS['madrid-white'];
}

/**
 * Jersey shader preserving baked cloth normalMap from footballer.glb:
 * - Short sleeves with sleeve cuff + natural forearm skin + optional wrist tape
 * - Club pattern (vertical stripes / central PSG band / diagonal sash / solid)
 * - Crisp back number & player name print on upper back
 */
function createJerseyTopMaterial(origMat, preset, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const numStr = actorDef.number || (isPedri ? '8' : '');
  const shortName = actorDef.shirtName || (isPedri ? 'PEDRI' : '');
  const printTex = getBackPrintTexture(numStr, shortName, preset.numColor);
  const patternCode =
    preset.pattern === 'stripes'
      ? 1
      : preset.pattern === 'center-band'
      ? 2
      : preset.pattern === 'sash'
      ? 3
      : 0;

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.62,
    metalness: 0.04,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
    normalScale: new THREE.Vector2(0.85, 0.85)
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCol1 = { value: new THREE.Color(preset.primary) };
    shader.uniforms.uCol2 = { value: new THREE.Color(preset.secondary) };
    shader.uniforms.uAccent = { value: new THREE.Color(preset.accent) };
    shader.uniforms.uSkin = { value: new THREE.Color(actorDef.skinTone || '#d69a78') };
    shader.uniforms.uPattern = { value: patternCode };
    shader.uniforms.uPrintTex = { value: printTex };
    shader.uniforms.uWristTape = { value: isPedri || actorDef.wristTape ? 1.0 : 0.0 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vBindPos = position;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCol1;
         uniform vec3 uCol2;
         uniform vec3 uAccent;
         uniform vec3 uSkin;
         uniform int uPattern;
         uniform sampler2D uPrintTex;
         uniform float uWristTape;
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float ax = abs(vBindPos.x);
         float by = vBindPos.y;
         float bz = vBindPos.z;

         // Base club jersey pattern on torso & upper sleeves
         vec3 kitCol = uCol1;
         if (uPattern == 1) {
           // Vertical Blaugrana / Atleti stripes (cleaner solid box on back for number readability)
           float st = step(0.0, sin(vBindPos.x * 46.0));
           kitCol = mix(uCol1, uCol2, st);
         } else if (uPattern == 2) {
           // PSG Hechter central vertical red stripe with white pin-borders
           if (ax < 0.048) kitCol = uCol2;
           else if (ax < 0.058) kitCol = uAccent;
         } else if (uPattern == 3) {
           // Rayo diagonal red sash
           float diag = vBindPos.x + (by - 1.28) * 0.55;
           if (abs(diag) < 0.055) kitCol = uCol2;
         }

         // Collar & hem accent trim
         if (by > 1.565 && ax < 0.11) {
           kitCol = uAccent;
         }

         // Chest crest accent on front-left chest
         if (bz > 0.21 && vBindPos.x > 0.045 && vBindPos.x < 0.095 && by > 1.39 && by < 1.45) {
           kitCol = uAccent;
         }

         // Back Squad Number & Player Surname (bindPos.z < 0.095 faces backward on footballer.glb)
         if (bz < 0.095 && ax < 0.145 && by > 1.18 && by < 1.53) {
           // Note: looking from behind (+X is left, -X is right -> flip U so digits read left-to-right!)
           float u = 0.5 - (vBindPos.x / 0.29);
           float v = (by - 1.18) / 0.35;
           vec4 pr = texture2D(uPrintTex, clamp(vec2(u, v), 0.0, 1.0));
           kitCol = mix(kitCol, pr.rgb, pr.a);
         }

         // Short-sleeve cutoff at ax = 0.255 -> bare athletic forearms + optional white wrist tape
         if (ax > 0.258) {
           kitCol = uSkin;
           if (uWristTape > 0.5 && ax > 0.435 && ax < 0.468) {
             kitCol = vec3(0.95, 0.96, 0.98);
           }
         } else if (ax > 0.242) {
           kitCol = uAccent;
         }

         diffuseColor.rgb = kitCol;`
      );
  };

  return mat;
}

/**
 * Shorts + Bare Knees + High Football Socks material on Wolf3D_Outfit_Bottom (y in [0.147, 1.086])
 */
function createShortsAndSocksMaterial(origMat, preset, actorDef) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.03,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
    normalScale: new THREE.Vector2(0.75, 0.75)
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShorts = { value: new THREE.Color(preset.shorts) };
    shader.uniforms.uAccent = { value: new THREE.Color(preset.accent) };
    shader.uniforms.uSkin = { value: new THREE.Color(actorDef.skinTone || '#d69a78') };
    shader.uniforms.uSocks = { value: new THREE.Color(preset.socks) };
    shader.uniforms.uSockBand = { value: new THREE.Color(preset.sockBand) };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vBindPos = position;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uShorts;
         uniform vec3 uAccent;
         uniform vec3 uSkin;
         uniform vec3 uSocks;
         uniform vec3 uSockBand;
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float by = vBindPos.y;
         float ax = abs(vBindPos.x);
         vec3 col = uShorts;

         if (by > 0.575) {
           // Tailored football shorts + lateral stripe + bottom trim
           col = uShorts;
           if (by < 0.595 || ax > 0.185) {
             col = mix(uShorts, uAccent, 0.85);
           }
         } else if (by > 0.435) {
           // Athletic bare knees
           col = uSkin;
         } else {
           // High club football socks + top turnover hoops
           col = uSocks;
           if (by > 0.395 && by <= 0.435) {
             float hoop = step(0.0, sin(by * 220.0));
             col = mix(uSocks, uSockBand, hoop);
           }
         }

         diffuseColor.rgb = col;`
      );
  };

  return mat;
}

function createCleatsMaterial(origMat, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const bootUpper = actorDef.bootColor || (isPedri ? '#f8fafc' : actorDef.role === 'teammate' ? '#38bdf8' : '#1e293b');
  const bootSole = isPedri ? '#eab308' : '#f43f5e';

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.36,
    metalness: 0.18,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uUpper = { value: new THREE.Color(bootUpper) };
    shader.uniforms.uSole = { value: new THREE.Color(bootSole) };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vBindPos = position;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uUpper;
         uniform vec3 uSole;
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 bCol = vBindPos.y < 0.032 ? uSole : uUpper;
         diffuseColor.rgb = bCol;`
      );
  };

  return mat;
}

/**
 * Applies photorealistic face/skin preservation + club kit shaders + short athletic hair
 * onto a cloned ReadyPlayerMe footballer hierarchy.
 */
export function applyFootballerAppearance(cloneRoot, actorDef, hairSourceMesh, beardSourceMesh) {
  const preset = resolveKitPreset(actorDef);
  let targetSkeleton = null;

  cloneRoot.traverse((obj) => {
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = false;

    if (obj.isSkinnedMesh && obj.skeleton && !targetSkeleton) {
      targetSkeleton = obj.skeleton;
    }

    const mName = obj.name || '';
    const origMat = obj.material;

    // Remove street glasses & cap from base visage avatar
    if (mName.includes('Facewear') || mName.includes('Headwear')) {
      obj.visible = false;
      return;
    }

    // Keep authentic photorealistic PBR eyes, teeth, head skin, and hand skin!
    if (
      mName.includes('Eye') ||
      mName.includes('Teeth') ||
      mName.includes('Head') ||
      mName.includes('Body')
    ) {
      if (origMat && origMat.clone) {
        const clonedSkin = origMat.clone();
        if (actorDef.skinTint && (mName.includes('Head') || mName.includes('Body'))) {
          clonedSkin.color = new THREE.Color(actorDef.skinTint);
        }
        obj.material = clonedSkin;
      }
      return;
    }

    if (mName.includes('Outfit_Top')) {
      obj.material = createJerseyTopMaterial(origMat, preset, actorDef);
    } else if (mName.includes('Outfit_Bottom')) {
      obj.material = createShortsAndSocksMaterial(origMat, preset, actorDef);
    } else if (mName.includes('Outfit_Footwear')) {
      obj.material = createCleatsMaterial(origMat, actorDef);
    }
  });

  // Bind realistic short athletic hair (and optional facial hair) onto the exact 67-bone Skeleton
  if (targetSkeleton && hairSourceMesh) {
    const hairClone = new THREE.SkinnedMesh(
      hairSourceMesh.geometry,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(actorDef.hairColor || (actorDef.role === 'pedri' ? '#241811' : '#1b1613')),
        roughness: 0.78,
        metalness: 0.05
      })
    );
    hairClone.name = 'Footballer_Hair';
    hairClone.castShadow = true;
    hairClone.frustumCulled = false;
    hairClone.bind(targetSkeleton, hairSourceMesh.bindMatrix);
    cloneRoot.add(hairClone);
  }

  if (targetSkeleton && beardSourceMesh && actorDef.hasBeard) {
    const beardClone = new THREE.SkinnedMesh(
      beardSourceMesh.geometry,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(actorDef.hairColor || '#1b1613'),
        roughness: 0.85,
        metalness: 0.02
      })
    );
    beardClone.name = 'Footballer_Beard';
    beardClone.frustumCulled = false;
    beardClone.bind(targetSkeleton, beardSourceMesh.bindMatrix);
    cloneRoot.add(beardClone);
  }
}
