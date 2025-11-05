import * as THREE from "three";
import rockDiffuse from "./assets/rock_08_diff_1k.jpg";
import rockRoughness from "./assets/rock_08_rough_1k.jpg";

/**
 * Material factory for creating consistent materials across scenes
 */
export class MaterialFactory {
  private textureLoader = new THREE.TextureLoader();
  private statueInsideMaterialCache: THREE.MeshStandardMaterial | null = null;

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
  createInsideMaterial(color: number = 0xcccccc): THREE.MeshStandardMaterial {
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
}
