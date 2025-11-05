import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import statueGLB from "./assets/statue.glb";
import brickGLB from "./assets/brick.glb";

export type PrimitiveType =
  | "cube"
  | "sphere"
  | "cylinder"
  | "torus"
  | "torusKnot"
  | "statue";

export interface GeometryWithMaterial {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

/**
 * Model factory for creating and loading geometric primitives and models
 */
export class ModelFactory {
  private gltfLoader = new GLTFLoader();
  private statueGeometryCache: THREE.BufferGeometry | null = null;
  private statueMaterialCache: THREE.Material | THREE.Material[] | null = null;
  private brickGeometryCache: THREE.BufferGeometry | null = null;
  private brickMaterialCache: THREE.Material | THREE.Material[] | null = null;

  /**
   * Load the statue geometry and material from GLB file (cached)
   */
  async loadStatueGeometry(
    forceReload: boolean = false,
  ): Promise<GeometryWithMaterial> {
    if (this.statueGeometryCache && this.statueMaterialCache && !forceReload) {
      return {
        geometry: this.statueGeometryCache,
        material: this.statueMaterialCache,
      };
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        statueGLB,
        (gltf) => {
          // Get the geometry and material from the first mesh in the scene
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry.clone();

              // Ensure geometry has normals
              if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
              }

              // Ensure geometry has UVs (required for fracturing)
              if (!geometry.attributes.uv) {
                // Create simple planar UV mapping as fallback
                const uvs = new Float32Array(
                  geometry.attributes.position.count * 2,
                );
                geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
              }

              // Compute bounding sphere/box
              geometry.computeBoundingBox();
              geometry.computeBoundingSphere();

              this.statueGeometryCache = geometry;

              // Store the original material(s) - don't clone so we can share the reference
              if (Array.isArray(child.material)) {
                this.statueMaterialCache = child.material;
              } else {
                this.statueMaterialCache = child.material;
              }

              // Configure material properties
              const materials = Array.isArray(this.statueMaterialCache)
                ? this.statueMaterialCache
                : [this.statueMaterialCache];

              materials.forEach((mat) => {
                if (
                  mat instanceof THREE.MeshStandardMaterial ||
                  mat instanceof THREE.MeshPhysicalMaterial
                ) {
                  mat.envMapIntensity = 0.3;
                  mat.roughness = 0.7;
                }
              });
            }
          });

          resolve({
            geometry: this.statueGeometryCache!,
            material: this.statueMaterialCache!,
          });
        },
        undefined,
        reject,
      );
    });
  }

  /**
   * Create a primitive geometry based on type
   */
  createPrimitiveGeometry(type: PrimitiveType): THREE.BufferGeometry {
    switch (type) {
      case "cube":
        return new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
      case "sphere":
        return new THREE.SphereGeometry(1.2, 32, 32);
      case "cylinder":
        return new THREE.CylinderGeometry(1, 1, 2.5, 32);
      case "torus":
        return new THREE.TorusGeometry(1, 0.4, 16, 32);
      case "torusKnot":
        return new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16);
      case "statue":
        if (!this.statueGeometryCache) {
          throw new Error(
            "Statue geometry not loaded. Call loadStatueGeometry() first.",
          );
        }
        return this.statueGeometryCache.clone();
    }
  }

  /**
   * Create a mesh with the specified primitive type and material
   */
  createPrimitive(
    type: PrimitiveType,
    material: THREE.Material,
  ): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let meshMaterial: THREE.Material | THREE.Material[] = material;

    if (type === "statue") {
      if (!this.statueGeometryCache || !this.statueMaterialCache) {
        throw new Error(
          "Statue geometry not loaded. Call loadStatueGeometry() first.",
        );
      }
      geometry = this.statueGeometryCache.clone();
      // Use the original statue material (shared reference, not cloned)
      meshMaterial = this.statueMaterialCache;
    } else {
      geometry = this.createPrimitiveGeometry(type);
    }

    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    return mesh;
  }

  /**
   * Get the cached statue material (must call loadStatueGeometry first)
   */
  getStatueMaterial(): THREE.Material | THREE.Material[] | null {
    return this.statueMaterialCache;
  }

  /**
   * Load the brick geometry and material from GLB file (cached)
   */
  async loadBrickGeometry(
    forceReload: boolean = false,
  ): Promise<GeometryWithMaterial> {
    if (this.brickGeometryCache && this.brickMaterialCache && !forceReload) {
      return {
        geometry: this.brickGeometryCache,
        material: this.brickMaterialCache,
      };
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        brickGLB,
        (gltf) => {
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const geometry = child.geometry.clone();

              // Ensure geometry has normals
              if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
              }

              // Ensure geometry has UVs (required for fracturing)
              if (!geometry.attributes.uv) {
                const uvs = new Float32Array(
                  geometry.attributes.position.count * 2,
                );
                geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
              }

              // Compute bounding sphere/box
              geometry.computeBoundingBox();
              geometry.computeBoundingSphere();

              this.brickGeometryCache = geometry;

              // Store the original material(s)
              if (Array.isArray(child.material)) {
                this.brickMaterialCache = child.material;
              } else {
                this.brickMaterialCache = child.material;
              }
            }
          });

          resolve({
            geometry: this.brickGeometryCache!,
            material: this.brickMaterialCache!,
          });
        },
        undefined,
        reject,
      );
    });
  }

  /**
   * Get the cached brick geometry (must call loadBrickGeometry first)
   */
  getBrickGeometry(): THREE.BufferGeometry | null {
    return this.brickGeometryCache;
  }

  /**
   * Get the cached brick material (must call loadBrickGeometry first)
   */
  getBrickMaterial(): THREE.Material | THREE.Material[] | null {
    return this.brickMaterialCache;
  }
}
