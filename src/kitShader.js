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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (nameStr) {
    ctx.font = '800 54px "Inter", "Arial Black", sans-serif';
    ctx.lineWidth = 11;
    ctx.strokeStyle = 'rgba(8, 12, 24, 0.88)';
    ctx.strokeText(nameStr.toUpperCase(), 256, 90);
    ctx.fillStyle = numColor;
    ctx.fillText(nameStr.toUpperCase(), 256, 90);
  }

  if (numberStr) {
    ctx.font = '900 272px "Inter", "Impact", "Arial Black", sans-serif';
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(8, 12, 24, 0.9)';
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
 * Crew-neck fitted short-sleeve football jersey material
 * Geometry bounds on Wolf3D_Outfit_Top (footballer_jersey.glb):
 *   x in [-0.297, +0.297], y in [1.031, 1.570], z in [-0.133, +0.157]
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
    roughness: 0.64,
    metalness: 0.03,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
    normalScale: new THREE.Vector2(0.85, 0.85)
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCol1 = { value: new THREE.Color(preset.primary) };
    shader.uniforms.uCol2 = { value: new THREE.Color(preset.secondary) };
    shader.uniforms.uAccent = { value: new THREE.Color(preset.accent) };
    shader.uniforms.uPattern = { value: patternCode };
    shader.uniforms.uPrintTex = { value: printTex };

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
         vBindNormal = normal;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCol1;
         uniform vec3 uCol2;
         uniform vec3 uAccent;
         uniform int uPattern;
         uniform sampler2D uPrintTex;
         varying vec3 vBindPos;
         varying vec3 vBindNormal;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float ax = abs(vBindPos.x);
         float by = vBindPos.y;
         float bz = vBindPos.z;

         vec3 kitCol = uCol1;
         if (uPattern == 1) {
           // Authentic 3-stripe Blaugrana / Atleti vertical stripes across torso
           float st = step(0.0, sin(vBindPos.x * 42.0));
           kitCol = mix(uCol1, uCol2, st);
         } else if (uPattern == 2) {
           // PSG Hechter central vertical red stripe + white pin-borders
           if (ax < 0.046) kitCol = uCol2;
           else if (ax < 0.056) kitCol = uAccent;
         } else if (uPattern == 3) {
           // Rayo Vallecano diagonal red sash on front
           float diag = vBindPos.x + (by - 1.30) * 0.52;
           if (abs(diag) < 0.048) kitCol = uCol2;
         }

         // Crew-neck collar trim & short-sleeve cuff trim
         if ((by > 1.535 && ax < 0.105) || ax > 0.275) {
           kitCol = uAccent;
         }

         // Front-left club crest shield & front-right manufacturer mark
         if (vBindNormal.z > 0.25 && bz > 0.02) {
           if (vBindPos.x > 0.045 && vBindPos.x < 0.082 && by > 1.385 && by < 1.430) {
             kitCol = uAccent;
           } else if (vBindPos.x < -0.048 && vBindPos.x > -0.078 && by > 1.402 && by < 1.416) {
             kitCol = uAccent;
           }
         }

         // Back Squad Number & Surname — strictly on back-facing jersey polygons
         if (vBindNormal.z < -0.25 && bz < -0.015 && ax < 0.135 && by > 1.16 && by < 1.50) {
           float u = 0.5 - (vBindPos.x / 0.27);
           float v = (by - 1.16) / 0.34;
           vec4 pr = texture2D(uPrintTex, clamp(vec2(u, v), 0.0, 1.0));
           kitCol = mix(kitCol, pr.rgb, pr.a);
         }

         diffuseColor.rgb = kitCol;`
      );
  };

  return mat;
}

/**
 * Tailored athletic football shorts on Wolf3D_Outfit_Bottom (y in [0.608, 1.102])
 */
function createShortsMaterial(origMat, preset) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.66,
    metalness: 0.02,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
    normalScale: new THREE.Vector2(0.7, 0.7)
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uShorts = { value: new THREE.Color(preset.shorts) };
    shader.uniforms.uAccent = { value: new THREE.Color(preset.accent) };

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
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         vec3 col = uShorts;
         if (vBindPos.y < 0.618 || abs(vBindPos.x) > 0.191) {
           col = mix(uShorts, uAccent, 0.85);
         }
         diffuseColor.rgb = col;`
      );
  };

  return mat;
}

/**
 * Anatomical Body + Bare Arms + White Wrist Tape + Bare Knees + High Club Football Socks
 * Geometry bounds on Wolf3D_Body (footballer.glb): y in [0.019, 1.379], |x| <= 0.531
 */
function createBodyAndSocksMaterial(origMat, preset, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const mat = new THREE.MeshStandardMaterial({
    map: origMat && origMat.map ? origMat.map : null,
    normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
    roughness: 0.62,
    metalness: 0.02
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSkinTint = { value: new THREE.Color(actorDef.skinTint || '#ffffff') };
    shader.uniforms.uJerseyUnder = { value: new THREE.Color(preset.primary) };
    shader.uniforms.uSocks = { value: new THREE.Color(preset.socks) };
    shader.uniforms.uSockBand = { value: new THREE.Color(preset.sockBand) };
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
         uniform vec3 uSkinTint;
         uniform vec3 uJerseyUnder;
         uniform vec3 uSocks;
         uniform vec3 uSockBand;
         uniform float uWristTape;
         varying vec3 vBindPos;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         float by = vBindPos.y;
         float ax = abs(vBindPos.x);

         // Apply optional player skin complexion tint to PBR skin texture
         diffuseColor.rgb *= uSkinTint;

         // Under-jersey inner torso guard (prevents any waist/chest skin poke-through during extreme twists)
         if (by > 1.02 && by < 1.46 && ax < 0.21) {
           diffuseColor.rgb = uJerseyUnder;
         }

         // Pedri signature white wrist tape on bare forearms
         if (uWristTape > 0.5 && by > 0.72 && ax > 0.425 && ax < 0.462) {
           diffuseColor.rgb = vec3(0.95, 0.96, 0.98);
         }

         // High Club Football Socks + Top Turnover Hoops hugging sculpted calves & shins (below knee y = 0.465)
         if (by < 0.465 && ax < 0.22) {
           vec3 sockCol = uSocks;
           if (by > 0.422) {
             float hoop = step(0.0, sin(by * 230.0));
             sockCol = mix(uSocks, uSockBand, hoop);
           }
           diffuseColor.rgb = sockCol;
         }`
      );
  };

  return mat;
}

/**
 * Sleek low-cut football cleats on Wolf3D_Outfit_Footwear (y in [0.009, 0.174])
 */
function createCleatsMaterial(origMat, actorDef) {
  const isPedri = actorDef.role === 'pedri';
  const bootUpper =
    actorDef.bootColor || (isPedri ? '#f8fafc' : actorDef.role === 'teammate' ? '#38bdf8' : '#18181b');
  const bootSole = isPedri ? '#eab308' : '#ef4444';

  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.34,
    metalness: 0.16,
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
         // Diagonal 3-stripe boot accent on outer midfoot
         if (vBindPos.y >= 0.032 && vBindPos.y < 0.105 && abs(vBindPos.z - 0.04) < 0.025 && abs(vBindPos.x) > 0.11) {
           bCol = mix(bCol, uSole, 0.85);
         }
         diffuseColor.rgb = bCol;`
      );
  };

  return mat;
}

/**
 * Applies authentic footballer kit, face/skin PBR preservation, high socks, cleats,
 * and native skull-aligned short athletic hair onto a cloned 67-bone footballer rig.
 */
export function applyFootballerAppearance(cloneRoot, actorDef, jerseyTopSourceMesh, altHairSourceMesh) {
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

    if (mName.includes('Glasses') || mName.includes('Facewear') || mName.includes('Headwear')) {
      obj.visible = false;
      return;
    }

    if (mName.includes('Eye') || mName.includes('Teeth')) {
      return;
    }

    if (mName.includes('Head')) {
      if (origMat && origMat.clone) {
        const clonedHead = origMat.clone();
        if (actorDef.skinTint) {
          clonedHead.color = new THREE.Color(actorDef.skinTint);
        }
        obj.material = clonedHead;
      }
      return;
    }

    if (mName.includes('Hair')) {
      if (actorDef.hairVariant === 2 && altHairSourceMesh) {
        obj.visible = false;
        return;
      }
      const hairCol = actorDef.hairColor || (actorDef.role === 'pedri' ? '#241811' : '#1b1512');
      obj.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hairCol),
        normalMap: origMat && origMat.normalMap ? origMat.normalMap : null,
        roughness: 0.78,
        metalness: 0.04
      });
      return;
    }

    if (mName.includes('Body')) {
      obj.material = createBodyAndSocksMaterial(origMat, preset, actorDef);
      return;
    }

    if (mName.includes('Outfit_Top')) {
      if (jerseyTopSourceMesh) {
        // Hide polo collar shirt and bind true crew-neck football jersey mesh below
        obj.visible = false;
      } else {
        obj.material = createJerseyTopMaterial(origMat, preset, actorDef);
      }
      return;
    }

    if (mName.includes('Outfit_Bottom')) {
      obj.material = createShortsMaterial(origMat, preset);
      return;
    }

    if (mName.includes('Outfit_Footwear')) {
      obj.material = createCleatsMaterial(origMat, actorDef);
    }
  });

  // Bind true crew-neck short-sleeve football jersey onto the exact 67-bone skeleton
  if (targetSkeleton && jerseyTopSourceMesh) {
    const jerseyClone = new THREE.SkinnedMesh(
      jerseyTopSourceMesh.geometry,
      createJerseyTopMaterial(jerseyTopSourceMesh.material, preset, actorDef)
    );
    jerseyClone.name = 'Footballer_CrewJersey';
    jerseyClone.castShadow = true;
    jerseyClone.receiveShadow = true;
    jerseyClone.frustumCulled = false;
    jerseyClone.bind(targetSkeleton, jerseyTopSourceMesh.bindMatrix);
    cloneRoot.add(jerseyClone);
  }

  // Optional alternate hairstyle for squad visual diversity
  if (targetSkeleton && altHairSourceMesh && actorDef.hairVariant === 2) {
    const hairCol = actorDef.hairColor || '#1b1512';
    const altHairClone = new THREE.SkinnedMesh(
      altHairSourceMesh.geometry,
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hairCol),
        normalMap:
          altHairSourceMesh.material && altHairSourceMesh.material.normalMap
            ? altHairSourceMesh.material.normalMap
            : null,
        roughness: 0.78,
        metalness: 0.04
      })
    );
    altHairClone.name = 'Footballer_AltHair';
    altHairClone.castShadow = true;
    altHairClone.frustumCulled = false;
    altHairClone.bind(targetSkeleton, altHairSourceMesh.bindMatrix);
    cloneRoot.add(altHairClone);
  }
}
