import * as THREE from "three";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
  FractureOptions,
  fracture,
} from "@dgreenheck/three-pinata";

/**
 * Smashing Object Demo
 * - Pick a primitive shape on the floor
 * - Hover to preview impact area
 * - Click to fracture
 * - Configurable fracture options
 */
export class SmashingScene extends BaseScene {
  private object: DestructibleMesh | null = null;
  private fragments: THREE.Mesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private wireframeMaterial!: THREE.MeshBasicMaterial;
  private voronoiFractureOptions = new VoronoiFractureOptions({
    mode: "3D",
    fragmentCount: 50,
    detectIsolatedFragments: true,
  });
  private simpleFractureOptions = new FractureOptions({
    fragmentCount: 50,
    fractureMode: "Non-Convex",
  });

  private settings = {
    primitiveType: "cube" as PrimitiveType,
    fractureMethod: "Voronoi" as "Voronoi" | "Simple",
    useImpactPoint: true,
    impactRadius: 1.0,
    preFracture: false,
    wireframe: false,
    useSeed: false,
    seedValue: 0,
  };

  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hasSmashed = false;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(7, 3, -4);
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0xff6644);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);
    this.wireframeMaterial = this.materialFactory.createWireframeMaterial();

    // Load statue geometry if needed
    await this.loadStatueGeometry();

    // Create impact marker (hidden initially)
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    this.impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.impactMarker.visible = false;
    this.scene.add(this.impactMarker);

    // Create radius marker (wireframe sphere)
    const radiusGeometry = new THREE.SphereGeometry(1, 16, 16);
    const radiusMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    });
    this.radiusMarker = new THREE.Mesh(radiusGeometry, radiusMaterial);
    this.radiusMarker.visible = false;
    this.scene.add(this.radiusMarker);

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

    this.object = new DestructibleMesh(mesh.geometry, materialToUse);
    this.object.castShadow = true;

    // Position on floor - calculate height based on bounding box
    const bbox = new THREE.Box3().setFromObject(mesh);
    const height = (bbox.max.y - bbox.min.y) / 2;
    this.object.position.set(0, height, 0);

    this.scene.add(this.object);

    this.hasSmashed = false;

    // Pre-fracture if enabled
    if (this.settings.preFracture) {
      this.preFractureObject();
    }
  }

  private preFractureObject(): void {
    if (!this.object) return;

    // Get the material from the object
    const materialToUse = this.object.material;

    if (this.settings.fractureMethod === "Voronoi") {
      // Set seed if using custom seed
      if (this.settings.useSeed) {
        this.voronoiFractureOptions.seed = this.settings.seedValue;
      } else {
        this.voronoiFractureOptions.seed = undefined;
      }

      this.fragments = this.object.fracture(
        this.voronoiFractureOptions,
        (fragment) => {
          // For statue, use original material + rock inside material; for others, use custom materials
          if (this.settings.wireframe) {
            fragment.material = this.wireframeMaterial;
          } else if (this.settings.primitiveType === "statue") {
            // Handle both single material and material array cases
            const outerMaterial = Array.isArray(materialToUse)
              ? materialToUse[0]
              : materialToUse;
            fragment.material = [
              outerMaterial,
              this.getStatueInsideMaterial()!,
            ];
          } else {
            fragment.material = [this.objectMaterial, this.insideMaterial];
          }
          fragment.castShadow = true;
          fragment.visible = false; // Start hidden for pre-fracture

          // Add physics (sleeping)
          const body = this.physics.add(fragment, {
            type: "dynamic",
            collider: "convexHull",
            restitution: 0.3,
          });
          if (body) {
            body.sleep();
          }
        },
      );

      // Add fragments to scene but keep them hidden
      this.fragments.forEach((fragment) => {
        this.scene.add(fragment);
      });
    } else {
      // Simple fracture method
      if (this.settings.useSeed) {
        this.simpleFractureOptions.seed = this.settings.seedValue;
      } else {
        this.simpleFractureOptions.seed = undefined;
      }

      const fragmentGeometries = fracture(
        this.object.geometry,
        this.simpleFractureOptions,
      );

      // Create mesh objects for each fragment
      fragmentGeometries.forEach((fragmentGeometry: THREE.BufferGeometry) => {
        // Compute bounding box to get the center of this fragment
        fragmentGeometry.computeBoundingBox();
        const center = new THREE.Vector3();
        fragmentGeometry.boundingBox!.getCenter(center);

        // Translate the geometry so its center is at the origin
        fragmentGeometry.translate(-center.x, -center.y, -center.z);

        // Recompute bounding sphere after translation
        fragmentGeometry.computeBoundingSphere();

        let fragmentMaterial: THREE.Material | THREE.Material[];
        if (this.settings.wireframe) {
          fragmentMaterial = this.wireframeMaterial;
        } else if (this.settings.primitiveType === "statue") {
          // Handle both single material and material array cases
          const outerMaterial = Array.isArray(materialToUse)
            ? materialToUse[0]
            : materialToUse;
          fragmentMaterial = [outerMaterial, this.getStatueInsideMaterial()!];
        } else {
          fragmentMaterial = [this.objectMaterial, this.insideMaterial];
        }

        const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);

        // Apply world transform from object
        const worldCenter = center.clone().applyMatrix4(this.object!.matrixWorld);
        fragment.position.copy(worldCenter);
        fragment.quaternion.copy(this.object!.quaternion);
        fragment.scale.copy(this.object!.scale);
        fragment.castShadow = true;
        fragment.visible = false; // Start hidden for pre-fracture

        this.fragments.push(fragment);
        this.scene.add(fragment);

        // Add physics (sleeping)
        const body = this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.3,
        });
        if (body) {
          body.sleep();
        }
      });
    }
  }

  private updateWireframe(): void {
    if (!this.object) return;

    const material = this.settings.wireframe
      ? this.wireframeMaterial
      : [this.objectMaterial, this.insideMaterial];

    // Update main mesh if not yet fractured
    if (!this.hasSmashed) {
      this.object.material = this.settings.wireframe
        ? this.wireframeMaterial
        : this.objectMaterial;
    }

    // Update all fragments
    this.fragments.forEach((fragment) => {
      fragment.material = material;
    });
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (this.hasSmashed || !this.object) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection with object
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.object, false);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;

      // Show impact marker and radius visualization
      if (
        this.settings.useImpactPoint &&
        this.impactMarker &&
        this.radiusMarker
      ) {
        this.impactMarker.position.copy(intersectionPoint);
        this.impactMarker.visible = true;

        // Position and scale the radius marker
        this.radiusMarker.position.copy(intersectionPoint);
        this.radiusMarker.scale.setScalar(this.settings.impactRadius);
        this.radiusMarker.visible = true;
      }
    } else {
      // Hide markers when not hovering over object
      if (this.impactMarker) this.impactMarker.visible = false;
      if (this.radiusMarker) this.radiusMarker.visible = false;
    }
  };

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.hasSmashed) {
      this.handleFragmentClick();
    } else {
      this.handleFractureClick();
    }
  };

  private handleFragmentClick(): void {
    this.handleExplosiveClick(this.fragments, 2.0, 10.0);
  }

  private handleFractureClick(): void {
    if (!this.object) return;

    const intersects = this.raycaster.intersectObject(this.object, false);
    if (intersects.length === 0) return;

    const intersectionPoint = intersects[0].point;
    const localPoint = this.object.worldToLocal(intersectionPoint.clone());

    if (this.settings.preFracture) {
      this.unfreezeObject();
    } else {
      this.performRealTimeFracture(localPoint);
    }

    this.hasSmashed = true;
    this.hideMarkers();
  }

  private unfreezeObject(): void {
    // Hide the original object
    if (this.object) {
      this.object.visible = false;
    }

    // Show and wake up all fragments
    this.fragments.forEach((fragment) => {
      fragment.visible = true;
      const body = this.physics.getBody(fragment);
      if (body) {
        body.wakeUp();
      }
    });
  }

  private performRealTimeFracture(localPoint: THREE.Vector3): void {
    if (!this.object) return;

    // Get the material from the object
    const materialToUse = this.object.material;

    if (this.settings.fractureMethod === "Voronoi") {
      this.voronoiFractureOptions.impactPoint = this.settings.useImpactPoint
        ? localPoint
        : undefined;
      this.voronoiFractureOptions.impactRadius = this.settings.useImpactPoint
        ? this.settings.impactRadius
        : undefined;

      // Set seed if using custom seed
      if (this.settings.useSeed) {
        this.voronoiFractureOptions.seed = this.settings.seedValue;
      } else {
        this.voronoiFractureOptions.seed = undefined;
      }

      this.fragments = this.object.fracture(
        this.voronoiFractureOptions,
        (fragment) => {
          // For statue, use original material + rock inside material; for others, use custom materials
          if (this.settings.wireframe) {
            fragment.material = this.wireframeMaterial;
          } else if (this.settings.primitiveType === "statue") {
            // Handle both single material and material array cases
            const outerMaterial = Array.isArray(materialToUse)
              ? materialToUse[0]
              : materialToUse;
            fragment.material = [outerMaterial, this.getStatueInsideMaterial()!];
          } else {
            fragment.material = [this.objectMaterial, this.insideMaterial];
          }
          fragment.castShadow = true;

          this.physics.add(fragment, {
            type: "dynamic",
            collider: "convexHull",
            restitution: 0.3,
          });
        },
      );

      // Add fragments to scene
      this.fragments.forEach((fragment) => {
        this.scene.add(fragment);
      });

      // Hide original object
      this.object.visible = false;
    } else {
      // Simple fracture method
      if (this.settings.useSeed) {
        this.simpleFractureOptions.seed = this.settings.seedValue;
      } else {
        this.simpleFractureOptions.seed = undefined;
      }

      const fragmentGeometries = fracture(
        this.object.geometry,
        this.simpleFractureOptions,
      );

      // Create mesh objects for each fragment
      fragmentGeometries.forEach((fragmentGeometry: THREE.BufferGeometry) => {
        // Compute bounding box to get the center of this fragment
        fragmentGeometry.computeBoundingBox();
        const center = new THREE.Vector3();
        fragmentGeometry.boundingBox!.getCenter(center);

        // Translate the geometry so its center is at the origin
        fragmentGeometry.translate(-center.x, -center.y, -center.z);

        // Recompute bounding sphere after translation
        fragmentGeometry.computeBoundingSphere();

        let fragmentMaterial: THREE.Material | THREE.Material[];
        if (this.settings.wireframe) {
          fragmentMaterial = this.wireframeMaterial;
        } else if (this.settings.primitiveType === "statue") {
          // Handle both single material and material array cases
          const outerMaterial = Array.isArray(materialToUse)
            ? materialToUse[0]
            : materialToUse;
          fragmentMaterial = [outerMaterial, this.getStatueInsideMaterial()!];
        } else {
          fragmentMaterial = [this.objectMaterial, this.insideMaterial];
        }

        const fragment = new THREE.Mesh(fragmentGeometry, fragmentMaterial);

        // Apply world transform from object
        const worldCenter = center.clone().applyMatrix4(this.object!.matrixWorld);
        fragment.position.copy(worldCenter);
        fragment.quaternion.copy(this.object!.quaternion);
        fragment.scale.copy(this.object!.scale);
        fragment.castShadow = true;

        this.fragments.push(fragment);
        this.scene.add(fragment);

        // Add physics
        this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.3,
        });
      });

      // Hide original object
      this.object.visible = false;
    }
  }

  private hideMarkers(): void {
    if (this.impactMarker) this.impactMarker.visible = false;
    if (this.radiusMarker) this.radiusMarker.visible = false;
  }

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `SMASHING OBJECT

• Choose a primitive shape
• Hover to preview impact area
• Click on object to fracture it
• Click fragments to apply explosive force
• Toggle 2.5D vs 3D fracturing
• Pre-fracture for frozen fragments
• Adjust fragment count and impact radius`;
  }

  setupUI(): any {
    const folder = this.pane.addFolder({
      title: "Smashing Object",
      expanded: true,
    });

    folder
      .addBinding(this.settings, "primitiveType", {
        options: {
          Cube: "cube",
          Sphere: "sphere",
          Cylinder: "cylinder",
          Torus: "torus",
          "Torus Knot": "torusKnot",
          Statue: "statue",
        },
        label: "Primitive",
      })
      .on("change", () => {
        this.reset();
      });

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: {
          "Voronoi (High Quality, Slow)": "Voronoi",
          "Simple (Low Quality, Fast)": "Simple",
        },
        label: "Fracture Method",
      })
      .on("change", () => {
        // Keep fragment counts in sync
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
      });

    folder
      .addBinding(this.voronoiFractureOptions, "fragmentCount", {
        min: 10,
        max: 200,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", () => {
        // Keep both fracture options in sync
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
      });

    folder.addBinding(this.voronoiFractureOptions, "mode", {
      options: {
        "3D": "3D",
        "2.5D": "2.5D",
      },
      label: "Mode",
    });

    const useImpactPointBinding = folder.addBinding(
      this.settings,
      "useImpactPoint",
      {
        label: "Impact Point",
      },
    );

    folder.addBinding(this.settings, "impactRadius", {
      min: 0.5,
      max: 3.0,
      step: 0.1,
      label: "Impact Radius",
    });

    folder
      .addBinding(this.settings, "preFracture", {
        label: "Pre-Fracture",
      })
      .on("change", () => {
        this.reset();
      });

    folder
      .addBinding(this.settings, "wireframe", {
        label: "Wireframe",
      })
      .on("change", () => {
        this.updateWireframe();
      });

    // Checkbox to enable custom seed
    const useSeedBinding = folder.addBinding(this.settings, "useSeed", {
      label: "Use Custom Seed",
    });

    // Slider for custom seed value
    const seedValueBinding = folder.addBinding(this.settings, "seedValue", {
      min: 0,
      max: 65535,
      step: 1,
      label: "Seed Value",
    });

    // Set initial disabled state
    useSeedBinding.disabled = this.settings.useImpactPoint;
    seedValueBinding.disabled =
      !this.settings.useSeed || this.settings.useImpactPoint;

    // Update seed bindings when useSeed checkbox changes
    useSeedBinding.on("change", () => {
      seedValueBinding.disabled =
        !this.settings.useSeed || this.settings.useImpactPoint;
    });

    // Update seed bindings when useImpactPoint changes
    useImpactPointBinding.on("change", () => {
      useSeedBinding.disabled = this.settings.useImpactPoint;
      seedValueBinding.disabled =
        !this.settings.useSeed || this.settings.useImpactPoint;
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
    this.fragments.forEach((fragment) => {
      this.scene.remove(fragment);
      fragment.geometry.dispose();
      if (Array.isArray(fragment.material)) {
        fragment.material.forEach((mat) => mat.dispose());
      } else {
        fragment.material.dispose();
      }
    });
    this.fragments = [];

    // Hide markers
    if (this.impactMarker) {
      this.impactMarker.visible = false;
    }
    if (this.radiusMarker) {
      this.radiusMarker.visible = false;
    }

    // Reset state
    this.hasSmashed = false;

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
