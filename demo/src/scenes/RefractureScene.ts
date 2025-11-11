import * as THREE from "three";
import { FolderApi } from "tweakpane";
import { BaseScene, PrimitiveType } from "./BaseScene";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

/**
 * Refracturing Demo
 * - Demonstrates external generation tracking for refracturing
 * - Click object to fracture it
 * - Click fragments to refracture them
 * - Progressive fragment counts configurable per generation
 * - Generation tracking handled externally via userData
 */
export class RefractureScene extends BaseScene {
  private object: DestructibleMesh | null = null;
  private fragments: DestructibleMesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;

  private settings = {
    primitiveType: "cube" as PrimitiveType,
    fractureMethod: "voronoi" as "voronoi" | "simple",
    maxGeneration: 3,
    fragmentCount1: 32,
    fragmentCount2: 16,
    fragmentCount3: 8,
    fragmentCount4: 4,
    fragmentCount5: 2,
  };

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

    // Create initial object
    this.createObject();

    // Add event listeners
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
    // Return fragment count for this generation
    switch (generation) {
      case 1:
        return this.settings.fragmentCount1;
      case 2:
        return this.settings.fragmentCount2;
      case 3:
        return this.settings.fragmentCount3;
      case 4:
        return this.settings.fragmentCount4;
      case 5:
        return this.settings.fragmentCount5;
      default:
        return this.settings.fragmentCount5;
    }
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

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check if clicking on original object
    if (this.object && this.object.visible) {
      const objectIntersects = this.raycaster.intersectObject(
        this.object,
        false,
      );
      if (objectIntersects.length > 0) {
        this.fractureObject(this.object);
        return;
      }
    }

    // Check if clicking on a fragment
    const fragmentIntersects = this.raycaster.intersectObjects(
      this.fragments,
      false,
    );
    if (fragmentIntersects.length > 0) {
      const clickedFragment = fragmentIntersects[0].object as DestructibleMesh;
      this.fractureObject(clickedFragment);
    }
  };

  private fractureObject(mesh: DestructibleMesh): void {
    // Get current generation (external tracking via userData)
    const currentGeneration = mesh.userData.generation || 0;

    // Check if max generation reached (external refracture limiting)
    if (currentGeneration >= this.settings.maxGeneration) {
      return;
    }

    // Determine fragment count based on generation (external configuration)
    const nextGeneration = currentGeneration + 1;
    const fragmentCount = this.getFragmentCount(nextGeneration);

    // Create fracture options with appropriate fragment count
    const fractureOptions = new FractureOptions({
      fractureMethod: this.settings.fractureMethod,
      fragmentCount: fragmentCount,
      voronoiOptions: {
        mode: "3D",
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

  update(): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `REFRACTURING DEMO

• Click object or fragments to fracture them
• Configure fracture method and fragment count per generation
• Set max generation depth to limit refracturing`;
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

    folder.addBinding(this.settings, "fractureMethod", {
      options: {
        Voronoi: "voronoi",
        Simple: "simple",
      },
      label: "Fracture Method",
    });

    const maxGenBinding = folder.addBinding(this.settings, "maxGeneration", {
      min: 0,
      max: 5,
      step: 1,
      label: "Max Generation",
    });

    // Fragment count sliders
    const frag1Binding = folder.addBinding(this.settings, "fragmentCount1", {
      min: 2,
      max: 64,
      step: 1,
      label: "Gen 1 Fragments",
    });

    const frag2Binding = folder.addBinding(this.settings, "fragmentCount2", {
      min: 2,
      max: 64,
      step: 1,
      label: "Gen 2 Fragments",
    });

    const frag3Binding = folder.addBinding(this.settings, "fragmentCount3", {
      min: 2,
      max: 64,
      step: 1,
      label: "Gen 3 Fragments",
    });

    const frag4Binding = folder.addBinding(this.settings, "fragmentCount4", {
      min: 2,
      max: 64,
      step: 1,
      label: "Gen 4 Fragments",
    });

    const frag5Binding = folder.addBinding(this.settings, "fragmentCount5", {
      min: 2,
      max: 64,
      step: 1,
      label: "Gen 5 Fragments",
    });

    // Update disabled state based on maxGeneration
    const updateSliderStates = () => {
      frag1Binding.disabled = this.settings.maxGeneration < 1;
      frag2Binding.disabled = this.settings.maxGeneration < 2;
      frag3Binding.disabled = this.settings.maxGeneration < 3;
      frag4Binding.disabled = this.settings.maxGeneration < 4;
      frag5Binding.disabled = this.settings.maxGeneration < 5;
    };

    // Initial state
    updateSliderStates();

    // Update on change
    maxGenBinding.on("change", updateSliderStates);

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

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate object
    this.createObject();
  }

  dispose(): void {
    // Remove event listeners
    window.removeEventListener("click", this.onMouseClick);

    // Remove object
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }
  }
}
