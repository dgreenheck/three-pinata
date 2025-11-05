import * as THREE from "three";
import { VoronoiFractureOptions } from "./entities/VoronoiFractureOptions";
import { SliceOptions } from "./entities/SliceOptions";
import { voronoiFracture } from "./fracture/VoronoiFracture";
import { slice } from "./fracture/Slice";

/**
 * A THREE.Mesh that can be fractured or sliced into fragments.
 * Fragments are returned but NOT automatically added to the scene -
 * you must manually add them using scene.add(...fragments).
 */
export class DestructibleMesh extends THREE.Mesh {
  constructor(
    geometry?: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
    material?: THREE.Material | THREE.Material[],
  ) {
    super(geometry, material);
  }

  /**
   * Fractures the mesh into fragments using Voronoi tessellation
   * @param options Voronoi fracture options controlling the fracture behavior
   * @param onFragment Optional callback called for each fragment for custom setup
   * @param onComplete Optional callback called once after all fragments are created
   * @returns The array of created fragment meshes (NOT added to scene)
   */
  fracture(
    options: VoronoiFractureOptions,
    onFragment?: (fragment: THREE.Mesh, index: number) => void,
    onComplete?: () => void,
  ): THREE.Mesh[] {
    if (!this.geometry) {
      throw new Error("DestructibleMesh has no geometry to fracture");
    }

    // Perform the fracture operation using Voronoi tessellation
    const fragmentGeometries = voronoiFracture(this.geometry, options);

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

      const fragment = new THREE.Mesh(fragmentGeometry, this.material);

      // Apply the parent's transform to the fragment position
      const worldCenter = center.clone().applyMatrix4(this.matrixWorld);
      fragment.position.copy(worldCenter);
      fragment.quaternion.copy(this.quaternion);
      fragment.scale.copy(this.scale);

      // Copy properties from the original mesh
      fragment.castShadow = this.castShadow;
      fragment.receiveShadow = this.receiveShadow;
      fragment.matrixAutoUpdate = this.matrixAutoUpdate;
      fragment.frustumCulled = this.frustumCulled;
      fragment.renderOrder = this.renderOrder;

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
      const piece = new DestructibleMesh(geometry, this.material);

      // Copy properties from original mesh
      piece.castShadow = this.castShadow;
      piece.receiveShadow = this.receiveShadow;
      piece.matrixAutoUpdate = this.matrixAutoUpdate;
      piece.frustumCulled = this.frustumCulled;
      piece.renderOrder = this.renderOrder;

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
