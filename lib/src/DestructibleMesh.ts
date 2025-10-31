import * as THREE from "three";
import { VoronoiFractureOptions } from "./entities/VoronoiFractureOptions";
import { SliceOptions } from "./entities/SliceOptions";
import { voronoiFracture } from "./fracture/VoronoiFracture";
import { slice } from "./fracture/Slice";

/**
 * A THREE.Group that contains a mesh which can be fractured or sliced into fragments.
 * The original mesh is accessible via the `mesh` property.
 * Fragments are stored as children of this group and accessible via `fragments` property.
 */
export class DestructibleMesh extends THREE.Group {
  /** The original mesh to be fractured */
  public mesh: THREE.Mesh;

  /** Array of fragment meshes created by fracture() */
  public fragments: THREE.Mesh[] = [];

  private _isFrozen: boolean = false;

  constructor(
    geometry?: THREE.BufferGeometry<THREE.NormalBufferAttributes>,
    material?: THREE.Material | THREE.Material[],
  ) {
    super();

    // Create the mesh and add it as a child
    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);
  }

  /**
   * Fractures the mesh into fragments using Voronoi tessellation
   * @param options Voronoi fracture options controlling the fracture behavior
   * @param freeze If true, fragments are created but hidden until unfreeze() is called
   * @param setup Optional callback called for each fragment for custom setup
   * @param onComplete Optional callback called once after all fragments are created
   * @returns The array of created fragment meshes
   */
  fracture(
    options: VoronoiFractureOptions,
    freeze: boolean = false,
    setup?: (fragment: THREE.Mesh, index: number) => void,
    onComplete?: () => void,
  ): THREE.Mesh[] {
    if (!this.mesh.geometry) {
      throw new Error("DestructibleMesh has no geometry to fracture");
    }

    // Mark as frozen if requested
    if (freeze) {
      this._isFrozen = true;
    }

    // Perform the fracture operation using Voronoi tessellation
    const fragmentGeometries = voronoiFracture(this.mesh.geometry, options);

    // Create mesh objects for each fragment
    this.fragments = fragmentGeometries.map((fragmentGeometry, index) => {
      // Compute bounding box to get the center of this fragment
      fragmentGeometry.computeBoundingBox();
      const center = new THREE.Vector3();
      fragmentGeometry.boundingBox!.getCenter(center);

      // Translate the geometry so its center is at the origin
      fragmentGeometry.translate(-center.x, -center.y, -center.z);

      // Recompute bounding sphere after translation
      fragmentGeometry.computeBoundingSphere();

      const fragment = new THREE.Mesh(fragmentGeometry, this.mesh.material);

      // Position the fragment at its original center within the group
      fragment.position.copy(center);

      // Copy properties from the original mesh
      fragment.castShadow = this.mesh.castShadow;
      fragment.receiveShadow = this.mesh.receiveShadow;
      fragment.matrixAutoUpdate = this.mesh.matrixAutoUpdate;
      fragment.frustumCulled = this.mesh.frustumCulled;
      fragment.renderOrder = this.mesh.renderOrder;

      // If frozen, hide fragments initially
      fragment.visible = !freeze;

      // Add as child to this group
      this.add(fragment);

      // Call the setup callback if provided
      if (setup) {
        setup(fragment, index);
      }

      return fragment;
    });

    // If not frozen, hide/dispose the original mesh
    if (!freeze) {
      this.remove(this.mesh);
      this.disposeMesh(this.mesh);
    }
    // If frozen, keep the original mesh visible until unfreeze

    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete();
    }

    return this.fragments;
  }

  /**
   * Slices the mesh into top and bottom parts
   * @param sliceNormal Normal of the slice plane (points towards the top slice)
   * @param sliceOrigin Origin of the slice plane
   * @param options Optional slice options
   * @param onSlice Optional callback called with top and bottom meshes after slice completes
   * @returns Object containing the top and bottom DestructibleMesh instances
   */
  slice(
    sliceNormal: THREE.Vector3,
    sliceOrigin: THREE.Vector3,
    options?: SliceOptions,
    onSlice?: (top: DestructibleMesh, bottom: DestructibleMesh) => void,
  ): { top: DestructibleMesh; bottom: DestructibleMesh } {
    if (!this.mesh.geometry) {
      throw new Error("DestructibleMesh has no geometry to slice");
    }

    // Use default options if not provided
    const sliceOptions = options || new SliceOptions();

    // Perform the slice operation
    const { topSlice, bottomSlice } = slice(
      this.mesh.geometry,
      sliceNormal,
      sliceOrigin,
      sliceOptions.textureScale,
      sliceOptions.textureOffset,
      sliceOptions.detectFloatingFragments === false, // convex parameter
    );

    // Create DestructibleMesh instances for top and bottom
    const topMesh = new DestructibleMesh(topSlice, this.mesh.material);
    const bottomMesh = new DestructibleMesh(bottomSlice, this.mesh.material);

    // Copy properties to both slices
    [topMesh, bottomMesh].forEach((destructibleMesh) => {
      destructibleMesh.mesh.castShadow = this.mesh.castShadow;
      destructibleMesh.mesh.receiveShadow = this.mesh.receiveShadow;
      destructibleMesh.mesh.matrixAutoUpdate = this.mesh.matrixAutoUpdate;
      destructibleMesh.mesh.frustumCulled = this.mesh.frustumCulled;
      destructibleMesh.mesh.renderOrder = this.mesh.renderOrder;

      // Apply world transform to the group
      destructibleMesh.position.copy(this.position);
      destructibleMesh.quaternion.copy(this.quaternion);
      destructibleMesh.scale.copy(this.scale);
    });

    // Dispose original mesh
    this.disposeMesh(this.mesh);

    // Call the onSlice callback if provided
    if (onSlice) {
      onSlice(topMesh, bottomMesh);
    }

    return { top: topMesh, bottom: bottomMesh };
  }

  /**
   * Unfreezes fragments, making them visible and disposing the original mesh
   * @param onFragment Optional callback called for each fragment
   * @param onComplete Optional callback called once after unfreeze completes
   */
  unfreeze(
    onFragment?: (fragment: THREE.Mesh, index: number) => void,
    onComplete?: () => void,
  ): void {
    if (!this._isFrozen) {
      console.warn("DestructibleMesh is not frozen");
      return;
    }

    console.log(
      "Unfreezing DestructibleMesh with",
      this.fragments.length,
      "fragments",
    );

    // Remove and dispose the original mesh
    this.remove(this.mesh);
    this.disposeMesh(this.mesh);

    // Show all fragments
    this.fragments.forEach((fragment, index) => {
      fragment.visible = true;

      // Call the onFragment callback if provided
      if (onFragment) {
        onFragment(fragment, index);
      }
    });

    this._isFrozen = false;

    // Call the onComplete callback if provided
    if (onComplete) {
      onComplete();
    }
  }

  /**
   * Gets all fragments created by fracture()
   * @returns Array of fragment meshes
   */
  getFragments(): THREE.Mesh[] {
    return [...this.fragments];
  }

  /**
   * Returns whether the mesh is currently frozen
   */
  isFrozen(): boolean {
    return this._isFrozen;
  }

  /**
   * Disposes a mesh (geometry and material)
   */
  private disposeMesh(mesh: THREE.Mesh): void {
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      this.disposeMaterial(mesh.material);
    }
  }

  /**
   * Helper to dispose material(s)
   */
  private disposeMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach((mat) => mat.dispose());
    } else {
      material.dispose();
    }
  }

  /**
   * Disposes this group, the original mesh, and all fragments
   */
  dispose(): void {
    // Dispose the original mesh
    this.disposeMesh(this.mesh);

    // Dispose all fragments
    this.fragments.forEach((fragment) => {
      if (fragment.geometry) {
        fragment.geometry.dispose();
      }
      if (fragment.material) {
        this.disposeMaterial(fragment.material);
      }
    });

    // Clear fragments array
    this.fragments = [];

    // Clear children
    this.clear();
  }
}
