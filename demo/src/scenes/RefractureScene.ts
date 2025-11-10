import * as THREE from "three";
import { FolderApi } from "tweakpane";
import { BaseScene, PrimitiveType } from "./BaseScene";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

/**
 * Refracturing Demo
 * - Demonstrates external generation tracking for refracturing
 * - Click object to fracture it
 * - Click fragments to refracture them
 * - Progressive fragment counts: 32 → 8 → 4
 * - Max 2 refractures (3 generations total)
 */
export class RefractureScene extends BaseScene {
  private object: DestructibleMesh | null = null;
  private fragments: DestructibleMesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;

  private settings = {
    primitiveType: "cube" as PrimitiveType,
    maxGeneration: 2,
  };

  // Fragment counts per generation: [0] = initial, [1] = gen 1, [2] = gen 2
  private fragmentCounts = [32, 8, 4];

  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private impactRadius = 1.0;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(7, 3, -4);
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0xff6644);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);

    // Load statue geometry if needed
    await this.loadStatueGeometry();

    // Create impact and radius markers
    const markers = this.createImpactMarkers();
    this.impactMarker = markers.impact;
    this.radiusMarker = markers.radius;

    // Create initial object
    this.createObject();

    // Add event listeners
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("click", this.onMouseClick);
  }

  private createObject(): void {
    // Remove old object if exists
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }

    // Clear fragments
    this.fragments = [];

    // Create the primitive
    const mesh = this.createPrimitive(
      this.settings.primitiveType,
      this.objectMaterial,
    );

    // Use the mesh's material (which may be the statue's original material)
    const materialToUse = mesh.material;
    const outerMaterial: THREE.Material = Array.isArray(materialToUse)
      ? materialToUse[0]
      : materialToUse;

    // Use statue's inside material if statue, otherwise use generic inside material
    const insideMaterial =
      this.settings.primitiveType === "statue"
        ? this.getStatueInsideMaterial()!
        : this.insideMaterial;

    this.object = new DestructibleMesh(
      mesh.geometry,
      outerMaterial,
      insideMaterial,
    );
    this.object.castShadow = true;

    // Initialize generation tracking in userData
    this.object.userData.generation = 0;

    // Position on floor - calculate height based on bounding box
    const bbox = new THREE.Box3().setFromObject(mesh);
    const height = (bbox.max.y - bbox.min.y) / 2;
    this.object.position.set(0, height, 0);

    this.scene.add(this.object);
  }

  private getFragmentCount(generation: number): number {
    // Return fragment count for this generation, clamped to array bounds
    const index = Math.min(generation, this.fragmentCounts.length - 1);
    return this.fragmentCounts[index];
  }

  private createFragmentCallback(generation: number) {
    return (fragment: DestructibleMesh) => {
      fragment.castShadow = true;

      // Track generation in userData
      fragment.userData.generation = generation;

      // Add physics
      const body = this.physics.add(fragment, {
        type: "dynamic",
        restitution: 0.3,
      });

      // Apply a small radial impulse scaled by mass
      if (body) {
        const mass = body.mass();

        // Calculate direction from center
        const center = new THREE.Vector3(0, 1, 0);
        const direction = fragment.position.clone().sub(center).normalize();

        // Add some upward component and randomness
        direction.y += 0.5;
        direction.x += (Math.random() - 0.5) * 0.3;
        direction.z += (Math.random() - 0.5) * 0.3;
        direction.normalize();

        // Apply impulse scaled by mass (force = 2.0 per unit mass)
        const impulseStrength = mass * 2.0;
        const impulse = direction.multiplyScalar(impulseStrength);

        body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z });
      }
    };
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.object) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection with object or fragments
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check object first
    const objectIntersects = this.object.visible
      ? this.raycaster.intersectObject(this.object, false)
      : [];

    // Check fragments
    const fragmentIntersects = this.raycaster.intersectObjects(this.fragments, false);

    const intersects = objectIntersects.length > 0 ? objectIntersects : fragmentIntersects;

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      const intersectedMesh = intersects[0].object as DestructibleMesh;
      const generation = intersectedMesh.userData.generation || 0;

      // Show impact marker and radius visualization only if can still fracture
      if (generation < this.settings.maxGeneration && this.impactMarker && this.radiusMarker) {
        this.impactMarker.position.copy(intersectionPoint);
        this.impactMarker.visible = true;

        // Position and scale the radius marker
        this.radiusMarker.position.copy(intersectionPoint);
        this.radiusMarker.scale.setScalar(this.impactRadius);
        this.radiusMarker.visible = true;
      } else {
        // Hide markers if at max generation
        this.hideMarkers();
      }
    } else {
      // Hide markers when not hovering over anything
      this.hideMarkers();
    }
  };

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check if clicking on original object
    if (this.object && this.object.visible) {
      const objectIntersects = this.raycaster.intersectObject(this.object, false);
      if (objectIntersects.length > 0) {
        this.fractureObject(this.object, objectIntersects[0].point);
        return;
      }
    }

    // Check if clicking on a fragment
    const fragmentIntersects = this.raycaster.intersectObjects(this.fragments, false);
    if (fragmentIntersects.length > 0) {
      const clickedFragment = fragmentIntersects[0].object as DestructibleMesh;
      this.fractureObject(clickedFragment, fragmentIntersects[0].point);
      return;
    }

    // If clicked on nothing, apply explosive force to all fragments
    this.handleExplosiveClick(this.fragments, 2.0, 10.0);
  };

  private fractureObject(
    mesh: DestructibleMesh,
    worldPoint: THREE.Vector3,
  ): void {
    // Get current generation (external tracking via userData)
    const currentGeneration = mesh.userData.generation || 0;

    // Check if max generation reached (external refracture limiting)
    if (currentGeneration >= this.settings.maxGeneration) {
      console.log(`Max generation (${this.settings.maxGeneration}) reached, cannot refracture further`);
      return;
    }

    // Convert world point to local space
    const localPoint = mesh.worldToLocal(worldPoint.clone());

    // Determine fragment count based on generation (external configuration)
    const nextGeneration = currentGeneration + 1;
    const fragmentCount = this.getFragmentCount(nextGeneration);

    // Create fracture options with appropriate fragment count
    const fractureOptions = new FractureOptions({
      fractureMethod: "voronoi",
      fragmentCount: fragmentCount,
      voronoiOptions: {
        mode: "3D",
        impactPoint: localPoint,
        impactRadius: this.impactRadius,
      },
    });

    // Fracture the mesh
    const newFragments = mesh.fracture(
      fractureOptions,
      this.createFragmentCallback(nextGeneration),
    );

    // Add new fragments to scene and tracking array
    newFragments.forEach((fragment) => {
      this.scene.add(fragment);
      this.fragments.push(fragment);
    });

    // Clean up the old mesh
    if (mesh === this.object) {
      // Original object - just hide it
      mesh.visible = false;
    } else {
      // Fragment - remove from tracking, scene, physics, and dispose
      const index = this.fragments.indexOf(mesh);
      if (index !== -1) {
        this.fragments.splice(index, 1);
      }
      this.scene.remove(mesh);
      this.physics.remove(mesh);
      mesh.geometry.dispose();
    }
  }

  private hideMarkers(): void {
    if (this.impactMarker) this.impactMarker.visible = false;
    if (this.radiusMarker) this.radiusMarker.visible = false;
  }

  update(): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `REFRACTURING DEMO

• Click on object to fracture it (32 fragments)
• Click fragments to refracture them (8 fragments)
• Click again for final refracture (4 fragments)
• Max 2 refractures per fragment
• Generation tracking handled externally via userData
• Click empty space to apply explosive force`;
  }

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Refracturing Demo",
      expanded: true,
    });

    folder
      .addBinding(this.settings, "primitiveType", {
        options: BaseScene.PRIMITIVE_OPTIONS,
        label: "Primitive",
      })
      .on("change", () => {
        this.reset();
      });

    folder.addBinding(this.settings, "maxGeneration", {
      min: 0,
      max: 5,
      step: 1,
      label: "Max Generation",
    });

    folder.addBinding(this, "fragmentCounts", {
      label: "Fragment Counts",
      readonly: true,
    });

    folder.addBinding(this, "impactRadius", {
      min: 0.5,
      max: 3.0,
      step: 0.1,
      label: "Impact Radius",
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear all physics first
    this.clearPhysics();

    // Remove old object
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
      this.object = null;
    }

    // Remove all fragments
    this.cleanupFragments(this.fragments);
    this.fragments = [];

    // Hide markers
    this.hideMarkers();

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate object
    this.createObject();
  }

  dispose(): void {
    // Remove event listeners
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("click", this.onMouseClick);

    // Remove object
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }

    // Remove impact marker
    if (this.impactMarker) {
      this.scene.remove(this.impactMarker);
      this.impactMarker.geometry.dispose();
      (this.impactMarker.material as THREE.Material).dispose();
    }

    // Remove radius marker
    if (this.radiusMarker) {
      this.scene.remove(this.radiusMarker);
      this.radiusMarker.geometry.dispose();
      (this.radiusMarker.material as THREE.Material).dispose();
    }
  }
}
