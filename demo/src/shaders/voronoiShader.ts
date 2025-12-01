import * as THREE from "three";

export interface VoronoiShaderSettings {
  lineWidth: number;
  goldColor: { r: number; g: number; b: number };
  noiseOctaves: number;
  noiseFrequency: number;
  noiseAmplitude: number;
  noiseLacunarity: number;
  noisePersistence: number;
  bevelStrength: number;
  bevelWidth: number;
  dissolveThreshold: number;
  dissolveEdgeWidth: number;
  dissolveEdgeIntensity: number;
  dissolveColor: { r: number; g: number; b: number };
}

// GLSL code to inject into the vertex shader
const voronoiParsVertex = /* glsl */ `
varying vec3 vKintsugiPosition;
`;

const voronoiPositionVertex = /* glsl */ `
vKintsugiPosition = position;
`;

// GLSL code to inject into the fragment shader
const voronoiParsFragment = /* glsl */ `
varying vec3 vKintsugiPosition;
uniform vec3 uSeeds[64];
uniform int uSeedCount;
uniform float uLineWidth;
uniform vec3 uGoldColor;
uniform int uNoiseOctaves;
uniform float uNoiseFrequency;
uniform float uNoiseAmplitude;
uniform float uNoiseLacunarity;
uniform float uNoisePersistence;
uniform float uBevelStrength;
uniform float uBevelWidth;
uniform float uDissolveThreshold;
uniform float uDissolveEdgeWidth;
uniform float uDissolveEdgeIntensity;
uniform vec3 uDissolveColor;

// Hash function for noise
vec3 kintsugiHash3(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// 3D noise function
float kintsugiNoise3d(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = kintsugiHash3(i + vec3(0.0, 0.0, 0.0)).x;
  float n100 = kintsugiHash3(i + vec3(1.0, 0.0, 0.0)).x;
  float n010 = kintsugiHash3(i + vec3(0.0, 1.0, 0.0)).x;
  float n110 = kintsugiHash3(i + vec3(1.0, 1.0, 0.0)).x;
  float n001 = kintsugiHash3(i + vec3(0.0, 0.0, 1.0)).x;
  float n101 = kintsugiHash3(i + vec3(1.0, 0.0, 1.0)).x;
  float n011 = kintsugiHash3(i + vec3(0.0, 1.0, 1.0)).x;
  float n111 = kintsugiHash3(i + vec3(1.0, 1.0, 1.0)).x;

  float n00 = mix(n000, n100, u.x);
  float n01 = mix(n001, n101, u.x);
  float n10 = mix(n010, n110, u.x);
  float n11 = mix(n011, n111, u.x);

  float n0 = mix(n00, n10, u.y);
  float n1 = mix(n01, n11, u.y);

  return mix(n0, n1, u.z) * 2.0 - 1.0;
}

// Fractal Brownian Motion
float kintsugiFbm(vec3 p) {
  float value = 0.0;
  float amp = uNoiseAmplitude;
  float freq = uNoiseFrequency;

  for (int i = 0; i < 8; i++) {
    if (i >= uNoiseOctaves) break;
    value += kintsugiNoise3d(p * freq) * amp;
    freq *= uNoiseLacunarity;
    amp *= uNoisePersistence;
  }

  return value;
}

// Global variables for kintsugi effect (set in color_fragment, used elsewhere)
float kintsugiAlpha = 0.0;
float kintsugiGlow = 0.0;
vec3 kintsugiBevelNormal = vec3(0.0);

// Get raw Voronoi edge distance (without noise, for gradient calculation)
float getVoronoiEdgeDist(vec3 pos) {
  float dist1 = 1e10;
  float dist2 = 1e10;

  for (int i = 0; i < 64; i++) {
    if (i >= uSeedCount) break;
    float d = distance(pos, uSeeds[i]);

    if (d < dist1) {
      dist2 = dist1;
      dist1 = d;
    } else if (d < dist2) {
      dist2 = d;
    }
  }

  return abs(dist1 - dist2);
}

// Get edge distance with noise applied
float getEdgeDistWithNoise(vec3 pos) {
  float edgeDist = getVoronoiEdgeDist(pos);
  float noise = kintsugiFbm(pos);
  return edgeDist - noise;
}

// Calculate Voronoi kintsugi effect
void calculateKintsugi(vec3 pos) {
  float edgeDist = getEdgeDistWithNoise(pos);

  float lineAlpha = step(edgeDist, uLineWidth);
  float normalizedDist = edgeDist / uLineWidth;
  float dissolveAlpha = smoothstep(
    uDissolveThreshold - uDissolveEdgeWidth,
    uDissolveThreshold + uDissolveEdgeWidth,
    normalizedDist
  );

  kintsugiAlpha = lineAlpha * (1.0 - dissolveAlpha);

  // Edge glow
  float distToThreshold = abs(normalizedDist - uDissolveThreshold);
  float edgeGlow = smoothstep(uDissolveEdgeWidth, 0.0, distToThreshold);
  float glowMask = lineAlpha * edgeGlow;
  kintsugiGlow = glowMask * uDissolveEdgeIntensity;

  // Calculate bevel normal using gradient of edge distance
  // Only apply bevel near the edges of the gold line (within bevelWidth of the outer edge)
  // and only where dissolve has revealed the gold
  float outerEdge = uLineWidth;
  float innerEdge = uLineWidth - uBevelWidth;

  if (uBevelStrength > 0.0 && edgeDist > innerEdge && edgeDist < outerEdge && kintsugiAlpha > 0.0) {
    float eps = 0.01;
    float dx = getEdgeDistWithNoise(pos + vec3(eps, 0.0, 0.0)) - getEdgeDistWithNoise(pos - vec3(eps, 0.0, 0.0));
    float dy = getEdgeDistWithNoise(pos + vec3(0.0, eps, 0.0)) - getEdgeDistWithNoise(pos - vec3(0.0, eps, 0.0));
    float dz = getEdgeDistWithNoise(pos + vec3(0.0, 0.0, eps)) - getEdgeDistWithNoise(pos - vec3(0.0, 0.0, eps));

    vec3 gradient = normalize(vec3(dx, dy, dz));

    // Bevel factor: 1 at outer edge, 0 at inner edge (where bevel ends)
    float t = (edgeDist - innerEdge) / uBevelWidth;
    float bevelFactor = smoothstep(0.0, 1.0, t);

    // Scale bevel by kintsugiAlpha so it fades in with the dissolve
    kintsugiBevelNormal = gradient * uBevelStrength * bevelFactor * kintsugiAlpha;
  }
}
`;

const voronoiColorFragment = /* glsl */ `
// Calculate kintsugi effect (sets global kintsugiAlpha and kintsugiGlow)
calculateKintsugi(vKintsugiPosition);

// Mix diffuse color with gold
diffuseColor.rgb = mix(diffuseColor.rgb, uGoldColor, kintsugiAlpha);
`;

const voronoiEmissiveFragment = /* glsl */ `
totalEmissiveRadiance += uDissolveColor * kintsugiGlow;
`;

const voronoiNormalFragment = /* glsl */ `
// Apply bevel normal perturbation to gold lines
if (length(kintsugiBevelNormal) > 0.0) {
  normal = normalize(normal + kintsugiBevelNormal);
}
`;

const voronoiRoughnessFragment = /* glsl */ `
// Make gold lines smoother/shinier
roughnessFactor = mix(roughnessFactor, 0.15, kintsugiAlpha);
`;

const voronoiMetalnessFragment = /* glsl */ `
// Make gold lines more metallic
metalnessFactor = mix(metalnessFactor, 1.0, kintsugiAlpha);
`;

export function createVoronoiMaterial(
  seeds: THREE.Vector3[],
  settings: VoronoiShaderSettings,
  sourceTexture: THREE.Texture | null = null,
  envMap: THREE.Texture | null = null,
): THREE.MeshPhysicalMaterial {
  const maxSeeds = Math.min(seeds.length, 64);

  // Create array with all 64 Vector3 objects
  const seedsUniform: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    if (i < maxSeeds) {
      seedsUniform.push(seeds[i].clone());
    } else {
      seedsUniform.push(new THREE.Vector3(0, 0, 0));
    }
  }

  const material = new THREE.MeshPhysicalMaterial({
    map: sourceTexture,
    envMap: envMap,
    envMapIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  });

  // Custom uniforms
  material.userData.uniforms = {
    uSeeds: { value: seedsUniform },
    uSeedCount: { value: maxSeeds },
    uLineWidth: { value: settings.lineWidth },
    uGoldColor: {
      value: new THREE.Color(
        settings.goldColor.r / 255,
        settings.goldColor.g / 255,
        settings.goldColor.b / 255,
      ),
    },
    uNoiseOctaves: { value: settings.noiseOctaves },
    uNoiseFrequency: { value: settings.noiseFrequency },
    uNoiseAmplitude: { value: settings.noiseAmplitude },
    uNoiseLacunarity: { value: settings.noiseLacunarity },
    uNoisePersistence: { value: settings.noisePersistence },
    uBevelStrength: { value: settings.bevelStrength },
    uBevelWidth: { value: settings.bevelWidth },
    uDissolveThreshold: { value: settings.dissolveThreshold },
    uDissolveEdgeWidth: { value: settings.dissolveEdgeWidth },
    uDissolveEdgeIntensity: { value: settings.dissolveEdgeIntensity },
    uDissolveColor: {
      value: new THREE.Color(
        settings.dissolveColor.r / 255,
        settings.dissolveColor.g / 255,
        settings.dissolveColor.b / 255,
      ),
    },
  };

  material.onBeforeCompile = (shader) => {
    // Add custom uniforms
    Object.assign(shader.uniforms, material.userData.uniforms);

    // Inject vertex shader varying declaration
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      "#include <common>\n" + voronoiParsVertex,
    );

    // Inject vertex shader position output
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n" + voronoiPositionVertex,
    );

    // Inject Voronoi functions and uniforms
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\n" + voronoiParsFragment,
    );

    // Inject color modification after diffuse color is set
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n" + voronoiColorFragment,
    );

    // Inject normal perturbation for bevel effect
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      "#include <normal_fragment_maps>\n" + voronoiNormalFragment,
    );

    // Inject roughness modification
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\n" + voronoiRoughnessFragment,
    );

    // Inject metalness modification
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <metalnessmap_fragment>",
      "#include <metalnessmap_fragment>\n" + voronoiMetalnessFragment,
    );

    // Inject emissive glow
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n" + voronoiEmissiveFragment,
    );

    // Store shader reference for uniform updates
    material.userData.shader = shader;
  };

  return material;
}

export function updateVoronoiMaterialSettings(
  material: THREE.MeshPhysicalMaterial,
  settings: Partial<VoronoiShaderSettings>,
): void {
  const uniforms = material.userData.uniforms;
  if (!uniforms) return;

  if (settings.lineWidth !== undefined) {
    uniforms.uLineWidth.value = settings.lineWidth;
  }
  if (settings.goldColor !== undefined) {
    uniforms.uGoldColor.value.setRGB(
      settings.goldColor.r / 255,
      settings.goldColor.g / 255,
      settings.goldColor.b / 255,
    );
  }
  if (settings.noiseOctaves !== undefined) {
    uniforms.uNoiseOctaves.value = settings.noiseOctaves;
  }
  if (settings.noiseFrequency !== undefined) {
    uniforms.uNoiseFrequency.value = settings.noiseFrequency;
  }
  if (settings.noiseAmplitude !== undefined) {
    uniforms.uNoiseAmplitude.value = settings.noiseAmplitude;
  }
  if (settings.noiseLacunarity !== undefined) {
    uniforms.uNoiseLacunarity.value = settings.noiseLacunarity;
  }
  if (settings.noisePersistence !== undefined) {
    uniforms.uNoisePersistence.value = settings.noisePersistence;
  }
  if (settings.bevelStrength !== undefined) {
    uniforms.uBevelStrength.value = settings.bevelStrength;
  }
  if (settings.bevelWidth !== undefined) {
    uniforms.uBevelWidth.value = settings.bevelWidth;
  }
  if (settings.dissolveThreshold !== undefined) {
    uniforms.uDissolveThreshold.value = settings.dissolveThreshold;
  }
  if (settings.dissolveEdgeWidth !== undefined) {
    uniforms.uDissolveEdgeWidth.value = settings.dissolveEdgeWidth;
  }
  if (settings.dissolveEdgeIntensity !== undefined) {
    uniforms.uDissolveEdgeIntensity.value = settings.dissolveEdgeIntensity;
  }
  if (settings.dissolveColor !== undefined) {
    uniforms.uDissolveColor.value.setRGB(
      settings.dissolveColor.r / 255,
      settings.dissolveColor.g / 255,
      settings.dissolveColor.b / 255,
    );
  }
}
