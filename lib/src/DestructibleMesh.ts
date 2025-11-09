import * as THREE from "three";
import { FractureOptions } from "./entities/FractureOptions";
import { SliceOptions } from "./entities/SliceOptions";
import { voronoiFracture } from "./fracture/VoronoiFracture";
import { fracture as simpleFracture } from "./fracture/Fracture";
import { slice } from "./fracture/Slice";

/**
 * A THREE.Mesh that can be fractured or sliced into fragments.
 * Fragments are returned but NOT automatically added to the scene -
 * you must manually add them using scene.add(...fragments).
 */
export class DestructibleMesh extends THREE.Mesh {
  private _refractureCount: number = 0;
  private _outsideMaterial?: THREE.Material;
  private _insideMaterial?: THREE.Material;

  constructor(
    geometry?: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
    outerMaterial?: THREE.Material,
    innerMaterial?: THREE.Material,
    refractureCount: number = 0,
  ) {
    // Always start with single outer material
    // Material arrays will be set explicitly in fracture/slice methods
    super(geometry, outerMaterial);

    this._refractureCount = refractureCount;
    this._outsideMaterial = outerMaterial;
    this._insideMaterial = innerMaterial;
  }

  /**
   * Gets the number of times this mesh has been refractured
   * (0 for the original mesh, 1 for first generation fragments, etc.)
   */
  get refractureCount(): number {
    return this._refractureCount;
  }

  /**
   * Helper method to create a fragment with inherited properties and materials
   * @private
   */
  private createFragment(
    geometry: THREE.BufferGeometry,
    refractureCount: number = 0,
  ): DestructibleMesh {
    const fragment = new DestructibleMesh(
      geometry,
      this._outsideMaterial,
      this._insideMaterial,
      refractureCount,
    );

    // Set material array for geometries with material groups
    // Group 0 (materialIndex 0) = outer material, Group 1 (materialIndex 1) = inner material
    if (this._outsideMaterial && this._insideMaterial) {
      fragment.material = [this._outsideMaterial, this._insideMaterial];
    } else if (this._outsideMaterial) {
      fragment.material = this._outsideMaterial;
    }

    // Copy rendering properties from parent mesh
    fragment.castShadow = this.castShadow;
    fragment.receiveShadow = this.receiveShadow;
    fragment.matrixAutoUpdate = this.matrixAutoUpdate;
    fragment.frustumCulled = this.frustumCulled;
    fragment.renderOrder = this.renderOrder;

    return fragment;
  }

  /**
   * Fractures the mesh into fragments
   * @param options Fracture options controlling the fracture behavior
   * @param onFragment Optional callback called for each fragment for custom setup
   * @param onComplete Optional callback called once after all fragments are created
   * @returns The array of created fragment meshes (NOT added to scene)
   */
  fracture(
    options: FractureOptions,
    onFragment?: (fragment: DestructibleMesh, index: number) => void,
    onComplete?: () => void,
  ): DestructibleMesh[] {
    if (!this.geometry) {
      throw new Error("DestructibleMesh has no geometry to fracture");
    }

    // Check if refracturing is enabled and if this mesh has exceeded the max refracture count
    if (
      options.refracture.enabled &&
      this._refractureCount > options.refracture.maxRefractures
    ) {
      console.warn(
        `Cannot refracture: max refractures (${options.refracture.maxRefractures}) reached. Current count: ${this._refractureCount}`,
      );
      return [];
    }

    // Perform the fracture operation based on the method
    let fragmentGeometries: THREE.BufferGeometry[];

    // Determine fragment count: use refracture count if this is a refracture, otherwise use main count
    const fragmentCount =
      options.refracture.enabled && this._refractureCount > 0
        ? options.refracture.fragmentCount
        : options.fragmentCount;

    try {
      if (options.fractureMethod === "voronoi") {
        if (!options.voronoiOptions) {
          throw new Error(
            "voronoiOptions is required when fractureMethod is 'voronoi'",
          );
        }

        // Convert FractureOptions to VoronoiFractureOptions format for the voronoiFracture function
        const voronoiOptions = {
          fragmentCount: fragmentCount,
          mode: options.voronoiOptions.mode,
          seedPoints: options.voronoiOptions.seedPoints,
          impactPoint: options.voronoiOptions.impactPoint,
          impactRadius: options.voronoiOptions.impactRadius,
          projectionAxis: options.voronoiOptions.projectionAxis || "auto",
          projectionNormal: options.voronoiOptions.projectionNormal,
          useApproximation: options.voronoiOptions.useApproximation || false,
          approximationNeighborCount:
            options.voronoiOptions.approximationNeighborCount || 12,
          textureScale: options.textureScale,
          textureOffset: options.textureOffset,
          seed: options.seed,
        };

        fragmentGeometries = voronoiFracture(this.geometry, voronoiOptions);
      } else {
        // Simple fracture - need to update options with correct fragment count
        const modifiedOptions = new FractureOptions({
          fractureMethod: options.fractureMethod,
          fragmentCount: fragmentCount,
          fracturePlanes: options.fracturePlanes,
          textureScale: options.textureScale,
          textureOffset: options.textureOffset,
          seed: options.seed,
        });
        fragmentGeometries = simpleFracture(this.geometry, modifiedOptions);
      }
    } catch (error) {
      console.error("Fracture operation failed:", error);
      throw error;
    }

    // Create mesh objects for each fragment
    const fragments = fragmentGeometries.map((fragmentGeometry, index) => {
      // Compute bounding box to get the center of this fragment
      fragmentGeometry.computeBoundingBox();
      const center = new THREE.Vector3();
      fragmentGeometry.boundingBox!.getCenter(center);

      // Translate the geometry so its center is at the origin
      fragmentGeometry.translate(-center.x, -center.y, -center.z);

      // Recompute bounding sphere after translation
      fragmentGeometry.computeBoundingSphere();

      // Create fragment with inherited properties and materials
      const fragment = this.createFragment(fragmentGeometry, this._refractureCount + 1);

      // Apply the parent's transform to the fragment position
      const worldCenter = center.clone().applyMatrix4(this.matrixWorld);
      fragment.position.copy(worldCenter);
      fragment.quaternion.copy(this.quaternion);
      fragment.scale.copy(this.scale);

      // Call the onFragment callback if provided
      if (onFragment) {
        onFragment(fragment, index);
      }

      return fragment;
    });

    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete();
    }

    return fragments;
  }

  /**
   * Slices the mesh into top and bottom parts using a plane in local space
   * @param sliceNormal Normal of the slice plane in local space (points towards the top slice)
   * @param sliceOrigin Origin of the slice plane in local space
   * @param options Optional slice options
   * @param onSlice Optional callback called for each piece for custom setup (material, physics, etc.)
   * @param onComplete Optional callback called once after all pieces are created
   * @returns Array of DestructibleMesh pieces created by the slice (NOT added to scene)
   */
  slice(
    sliceNormal: THREE.Vector3,
    sliceOrigin: THREE.Vector3,
    options?: SliceOptions,
    onSlice?: (piece: DestructibleMesh, index: number) => void,
    onComplete?: () => void,
  ): DestructibleMesh[] {
    if (!this.geometry) {
      throw new Error("DestructibleMesh has no geometry to slice");
    }

    // Use default options if not provided
    const sliceOptions = options || new SliceOptions();

    // Perform the slice operation
    const fragments = slice(
      this.geometry,
      sliceNormal,
      sliceOrigin,
      sliceOptions.textureScale,
      sliceOptions.textureOffset,
    );

    // Create DestructibleMesh instances for all fragments
    const pieces = fragments.map((geometry, index) => {
      // Create piece with inherited properties and materials
      const piece = this.createFragment(geometry);

      // Apply world transform
      piece.position.copy(this.position);
      piece.quaternion.copy(this.quaternion);
      piece.scale.copy(this.scale);

      // Call the onSlice callback if provided
      if (onSlice) {
        onSlice(piece, index);
      }

      return piece;
    });

    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete();
    }

    return pieces;
  }

  /**
   * Slices the mesh using a plane defined in world space
   * @param worldNormal Normal of the slice plane in world space
   * @param worldOrigin Origin of the slice plane in world space
   * @param options Optional slice options
   * @param onSlice Optional callback called for each piece for custom setup (material, physics, etc.)
   * @param onComplete Optional callback called once after all pieces are created
   * @returns Array of DestructibleMesh pieces created by the slice (NOT added to scene)
   */
  sliceWorld(
    worldNormal: THREE.Vector3,
    worldOrigin: THREE.Vector3,
    options?: SliceOptions,
    onSlice?: (piece: DestructibleMesh, index: number) => void,
    onComplete?: () => void,
  ): DestructibleMesh[] {
    // Update the object's matrix to ensure accurate transformation
    this.updateMatrixWorld(true);

    // Transform slice normal and origin to object's local space
    const worldToLocal = new THREE.Matrix4().copy(this.matrixWorld).invert();

    const localNormal = worldNormal
      .clone()
      .transformDirection(worldToLocal)
      .normalize();

    const localOrigin = worldOrigin.clone().applyMatrix4(worldToLocal);

    // Call the regular slice method with local coordinates
    return this.slice(localNormal, localOrigin, options, onSlice, onComplete);
  }

  /**
   * Disposes the mesh geometry and material
   */
  dispose(): void {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      if (Array.isArray(this.material)) {
        this.material.forEach((mat) => mat.dispose());
      } else {
        this.material.dispose();
      }
    }
  }
}
