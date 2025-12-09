import * as THREE from "three";
import rockDiffuse from "./assets/rock_08_diff_1k.jpg";
import rockRoughness from "./assets/rock_08_rough_1k.jpg";
// Wood textures from Polyhaven (worn_planks)
import woodDiffuse from "./assets/worn_planks_1k/textures/worn_planks_diff_1k.jpg";
import woodNormal from "./assets/worn_planks_1k/textures/worn_planks_nor_gl_1k.jpg";
import woodARM from "./assets/worn_planks_1k/textures/worn_planks_arm_1k.jpg";

/**
 * Material factory for creating consistent materials across scenes
 */
export class MaterialFactory {
  private textureLoader = new THREE.TextureLoader();
  private statueInsideMaterialCache: THREE.MeshStandardMaterial | null = null;
  private woodMaterialCache: THREE.MeshStandardMaterial | null = null;
  private woodInsideMaterialCache: THREE.MeshStandardMaterial | null = null;
  private woodTexturesLoaded = false;

  /**
   * Create a standard metallic/rough material
   */
  createStandardMaterial(color: number = 0xa0ffff): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.1,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });
  }

  /**
   * Create an inside material for fractured faces
   */
  createInsideMaterial(color: number = 0xcccccc): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.1,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });
  }

  /**
   * Create a wireframe material
   */
  createWireframeMaterial(color: number = 0xffffff): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
    });
  }

  /**
   * Create glass material for glass shatter scene
   */
  createGlassMaterial(): THREE.MeshPhysicalMaterial {
    return new THREE.MeshPhysicalMaterial({
      color: 0x88ffff,
      metalness: 0.5,
      roughness: 0.01,
      transmission: 0.3,
      thickness: 0.1,
      envMapIntensity: 1.0,
      transparent: true,
      opacity: 0.8,
    });
  }

  /**
   * Create glass inside material
   */
  createGlassInsideMaterial(): THREE.MeshStandardMaterial {
    const material = this.createGlassMaterial();
    material.color = new THREE.Color(0x70b0b0);
    material.opacity = 0.95;
    return material;
  }

  /**
   * Load the rock textures and create the statue inside material (cached)
   */
  async loadStatueInsideMaterial(): Promise<THREE.MeshStandardMaterial> {
    if (this.statueInsideMaterialCache) {
      return this.statueInsideMaterialCache;
    }

    return new Promise((resolve) => {
      const diffuseMap = this.textureLoader.load(rockDiffuse);
      const roughnessMap = this.textureLoader.load(rockRoughness);

      // Set texture wrapping and repeat
      [diffuseMap, roughnessMap].forEach((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      });

      this.statueInsideMaterialCache = new THREE.MeshStandardMaterial({
        map: diffuseMap,
        roughnessMap: roughnessMap,
        roughness: 0.8,
        envMapIntensity: 0.7,
      });

      resolve(this.statueInsideMaterialCache);
    });
  }

  /**
   * Get cached statue inside material (must call loadStatueInsideMaterial first)
   */
  getStatueInsideMaterial(): THREE.MeshStandardMaterial | null {
    return this.statueInsideMaterialCache;
  }

  // ============================================
  // Wood Materials
  // ============================================

  /**
   * Load wood textures and create cached wood materials
   * Uses Polyhaven worn_planks textures for realistic wood appearance
   */
  async loadWoodMaterials(): Promise<{
    exterior: THREE.MeshStandardMaterial;
    interior: THREE.MeshStandardMaterial;
  }> {
    if (this.woodTexturesLoaded && this.woodMaterialCache && this.woodInsideMaterialCache) {
      return {
        exterior: this.woodMaterialCache,
        interior: this.woodInsideMaterialCache,
      };
    }

    return new Promise((resolve) => {
      const diffuseMap = this.textureLoader.load(woodDiffuse);
      const normalMap = this.textureLoader.load(woodNormal);
      const armMap = this.textureLoader.load(woodARM);

      // Configure texture wrapping and repeat for all maps
      [diffuseMap, normalMap, armMap].forEach((texture) => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.colorSpace = texture === diffuseMap ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      });

      // Exterior wood material - full textured appearance
      this.woodMaterialCache = new THREE.MeshStandardMaterial({
        map: diffuseMap,
        normalMap: normalMap,
        aoMap: armMap, // R channel = AO
        roughnessMap: armMap, // G channel = Roughness
        metalnessMap: armMap, // B channel = Metalness (should be ~0 for wood)
        roughness: 1.0, // Use roughness map fully
        metalness: 0.0,
        envMapIntensity: 0.4,
        aoMapIntensity: 1.0,
      });

      // Interior wood material - lighter exposed grain
      // Create a separate set of textures for the inside with adjusted brightness
      const insideDiffuseMap = this.textureLoader.load(woodDiffuse);
      insideDiffuseMap.wrapS = THREE.RepeatWrapping;
      insideDiffuseMap.wrapT = THREE.RepeatWrapping;
      insideDiffuseMap.colorSpace = THREE.SRGBColorSpace;

      this.woodInsideMaterialCache = new THREE.MeshStandardMaterial({
        map: insideDiffuseMap,
        normalMap: normalMap.clone(),
        roughness: 0.95, // Rougher exposed grain
        metalness: 0.0,
        envMapIntensity: 0.2,
        // Lighten the color to simulate exposed inner wood
        color: 0xeeddcc,
      });

      this.woodTexturesLoaded = true;

      resolve({
        exterior: this.woodMaterialCache,
        interior: this.woodInsideMaterialCache,
      });
    });
  }

  /**
   * Create wood exterior material (finished oak surface)
   * Returns cached textured material if loadWoodMaterials() was called,
   * otherwise returns a basic material as fallback
   */
  createWoodMaterial(): THREE.MeshStandardMaterial {
    if (this.woodMaterialCache) {
      return this.woodMaterialCache;
    }
    // Fallback if textures not loaded
    return new THREE.MeshStandardMaterial({
      color: 0x8b6914, // Warm oak brown
      roughness: 0.7,
      metalness: 0.0,
      envMapIntensity: 0.3,
    });
  }

  /**
   * Create wood inside material (exposed grain, lighter and more fibrous)
   * Returns cached textured material if loadWoodMaterials() was called,
   * otherwise returns a basic material as fallback
   */
  createWoodInsideMaterial(): THREE.MeshStandardMaterial {
    if (this.woodInsideMaterialCache) {
      return this.woodInsideMaterialCache;
    }
    // Fallback if textures not loaded
    return new THREE.MeshStandardMaterial({
      color: 0xc4a574, // Lighter tan grain
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.2,
    });
  }

  /**
   * Create wood materials with custom texture scale based on object dimensions.
   * The texture represents ~1 meter of wood, so scale should match the object's
   * real-world dimensions for proper wood grain appearance.
   * 
   * @param scaleU - Texture repeat along U axis (typically object width in meters)
   * @param scaleV - Texture repeat along V axis (typically object height in meters)
   * @param colorTint - Optional color tint to apply (for darker/lighter variants)
   * @returns Object containing exterior and interior materials with proper scaling
   */
  createScaledWoodMaterials(
    scaleU: number,
    scaleV: number,
    colorTint?: number
  ): { exterior: THREE.MeshStandardMaterial; interior: THREE.MeshStandardMaterial } {
    // Helper to load a texture with specific repeat values
    const loadScaledTexture = (url: string, isSRGB: boolean = false): THREE.Texture => {
      const texture = this.textureLoader.load(url);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(scaleU, scaleV);
      texture.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      return texture;
    };

    // Load fresh textures with the desired repeat values
    const diffuseMap = loadScaledTexture(woodDiffuse, true);
    const normalMap = loadScaledTexture(woodNormal);
    const armMap = loadScaledTexture(woodARM);

    // Exterior wood material
    const exterior = new THREE.MeshStandardMaterial({
      map: diffuseMap,
      normalMap: normalMap,
      aoMap: armMap,
      roughnessMap: armMap,
      metalnessMap: armMap,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0.4,
      aoMapIntensity: 1.0,
      color: colorTint ?? 0xffffff,
    });

    // Interior wood material - lighter exposed grain
    const interiorDiffuseMap = loadScaledTexture(woodDiffuse, true);
    const interiorNormalMap = loadScaledTexture(woodNormal);
    
    const interior = new THREE.MeshStandardMaterial({
      map: interiorDiffuseMap,
      normalMap: interiorNormalMap,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.2,
      color: 0xeeddcc, // Lighter color for exposed grain
    });

    return { exterior, interior };
  }
}
