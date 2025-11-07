import * as THREE from "three";
import { FolderApi, ButtonApi } from "tweakpane";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  FractureOptions,
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
  private fragments: DestructibleMesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private fractureOptions = new FractureOptions({
    fractureMethod: "voronoi",
    fragmentCount: 50,
    voronoiOptions: {
      mode: "3D",
    },
    refracture: {
      enabled: false,
      maxRefractures: 2,
      fragmentCount: 25,
    },
  });

  private settings = {
    primitiveType: "cube" as PrimitiveType,
    fractureMethod: "Voronoi" as "Voronoi" | "Simple",
    useImpactPoint: true,
    impactRadius: 1.0,
    refractureEnabled: false,
    refractureMaxRefractures: 2,
    refractureFragmentCount: 25,
  };

  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hasSmashed = false;
  private resetButton: ButtonApi | null = null;

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
  }

  private configureFractureOptions(localPoint?: THREE.Vector3): void {
    // Set fracture method
    this.fractureOptions.fractureMethod =
      this.settings.fractureMethod === "Voronoi" ? "voronoi" : "simple";

    // Configure voronoi-specific options
    if (this.settings.fractureMethod === "Voronoi" && this.fractureOptions.voronoiOptions) {
      this.fractureOptions.voronoiOptions.impactPoint =
        this.settings.useImpactPoint ? localPoint : undefined;
      this.fractureOptions.voronoiOptions.impactRadius =
        this.settings.useImpactPoint ? this.settings.impactRadius : undefined;
    }
  }

  private createFragmentCallback(materialToUse: THREE.Material | THREE.Material[]) {
    return (fragment: DestructibleMesh) => {
      // Set material
      if (this.settings.primitiveType === "statue") {
        const outerMaterial = Array.isArray(materialToUse)
          ? materialToUse[0]
          : materialToUse;
        fragment.material = [outerMaterial, this.getStatueInsideMaterial()!];
      } else {
        fragment.material = [this.objectMaterial, this.insideMaterial];
      }

      fragment.castShadow = true;

      // Add physics and apply random impulse
      this.physics.add(fragment, {
        type: "dynamic",
        restitution: 0.3,
      });
      this.applyRandomImpulse(fragment);
    };
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
    // If refracturing is enabled, check if we clicked on a fragment
    if (this.settings.refractureEnabled) {
      const intersects = this.raycaster.intersectObjects(this.fragments, false);
      if (intersects.length > 0) {
        const clickedFragment = intersects[0].object as DestructibleMesh;
        this.refractureFragment(clickedFragment, intersects[0].point);
        return;
      }
    }

    // Otherwise, apply explosive force
    this.handleExplosiveClick(this.fragments, 2.0, 10.0);
  }

  private refractureFragment(fragment: DestructibleMesh, worldPoint: THREE.Vector3): void {
    // Check if this fragment can be refractured
    if (fragment.refractureCount > this.fractureOptions.refracture.maxRefractures) {
      // Fragment has reached max refractures
      return;
    }

    // Convert world point to local space of the fragment
    const localPoint = fragment.worldToLocal(worldPoint.clone());

    // Configure fracture options with impact point
    this.configureFractureOptions(localPoint);

    // Fracture the fragment
    const newFragments = fragment.fracture(
      this.fractureOptions,
      (newFragment) => {
        // Inherit material from parent fragment
        newFragment.material = fragment.material;
        newFragment.castShadow = true;

        // Add physics
        this.physics.add(newFragment, {
          type: "dynamic",
          restitution: 0.3,
        });

        // Apply random impulse
        this.applyRandomImpulse(newFragment);
      }
    );

    // Remove the old fragment
    const index = this.fragments.indexOf(fragment);
    if (index !== -1) {
      this.fragments.splice(index, 1);
    }
    this.scene.remove(fragment);
    this.physics.remove(fragment);
    fragment.geometry.dispose();

    // Add new fragments
    newFragments.forEach((newFragment) => {
      this.scene.add(newFragment);
      this.fragments.push(newFragment);
    });
  }

  private handleFractureClick(): void {
    if (!this.object) return;

    const intersects = this.raycaster.intersectObject(this.object, false);
    if (intersects.length === 0) return;

    const intersectionPoint = intersects[0].point;
    const localPoint = this.object.worldToLocal(intersectionPoint.clone());

    this.performRealTimeFracture(localPoint);

    this.hasSmashed = true;
    this.hideMarkers();
  }

  private performRealTimeFracture(localPoint: THREE.Vector3): void {
    if (!this.object) return;

    // Disable reset button and show fracturing message
    if (this.resetButton) {
      this.resetButton.disabled = true;
      this.resetButton.title = "Fracturing...";
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      if (!this.object) return;

      // Configure fracture options with impact point
      this.configureFractureOptions(localPoint);

      // Fracture with callback
      this.fragments = this.object.fracture(
        this.fractureOptions,
        this.createFragmentCallback(this.object.material)
      );

      // Add fragments to scene
      this.fragments.forEach((fragment) => {
        this.scene.add(fragment);
      });

      // Hide original object
      this.object.visible = false;

      // Re-enable reset button
      if (this.resetButton) {
        this.resetButton.disabled = false;
        this.resetButton.title = "Reset";
      }
    }, 10);
  }

  private hideMarkers(): void {
    if (this.impactMarker) this.impactMarker.visible = false;
    if (this.radiusMarker) this.radiusMarker.visible = false;
  }

  private applyRandomImpulse(fragment: DestructibleMesh): void {
    const body = this.physics.getBody(fragment);
    if (body) {
      // Apply a small random impulse
      const impulse = {
        x: (Math.random() - 0.5) * 0.125,
        y: Math.random() * 0.075,
        z: (Math.random() - 0.5) * 0.125,
      };
      body.applyImpulse(impulse);
    }
  }

  update(): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `SMASHING OBJECT

• Choose a primitive shape
• Hover to preview impact area
• Click on object to fracture it
• Click fragments to apply explosive force
• Enable refracturing to fracture fragments again
• Toggle 2.5D vs 3D fracturing
• Adjust fragment count and impact radius`;
  }

  setupUI(): FolderApi {
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
        // Enable/disable impact controls based on fracture method
        const isSimple = this.settings.fractureMethod === "Simple";
        useImpactPointBinding.disabled = isSimple;
        impactRadiusBinding.disabled = isSimple;
      });

    folder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 2,
      max: 64,
      step: 1,
      label: "Fragment Count",
    });

    folder.addBinding(this.fractureOptions.voronoiOptions!, "mode", {
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

    const impactRadiusBinding = folder.addBinding(
      this.settings,
      "impactRadius",
      {
        min: 0.5,
        max: 3.0,
        step: 0.1,
        label: "Impact Radius",
      },
    );

    // Add refracture settings
    const refractureFolder = folder.addFolder({
      title: "Refracture Settings",
      expanded: false,
    });

    refractureFolder
      .addBinding(this.settings, "refractureEnabled", {
        label: "Enable Refracturing",
      })
      .on("change", (ev) => {
        this.fractureOptions.refracture.enabled = ev.value;
      });

    refractureFolder
      .addBinding(this.settings, "refractureMaxRefractures", {
        min: 1,
        max: 5,
        step: 1,
        label: "Max Refractures",
      })
      .on("change", (ev) => {
        this.fractureOptions.refracture.maxRefractures = ev.value;
      });

    refractureFolder
      .addBinding(this.settings, "refractureFragmentCount", {
        min: 2,
        max: 64,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", (ev) => {
        this.fractureOptions.refracture.fragmentCount = ev.value;
      });

    this.resetButton = folder.addButton({ title: "Reset" }).on("click", () => {
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
