import * as THREE from "three";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
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
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private fractureOptions = new VoronoiFractureOptions({
    mode: "3D",
    fragmentCount: 50,
  });

  private settings = {
    primitiveType: "cube" as PrimitiveType,
    useImpactPoint: true,
    impactRadius: 1.0,
    preFracture: false,
  };

  private impactMarker: THREE.Mesh | null = null;
  private radiusMarker: THREE.Mesh | null = null;
  private hasSmashed = false;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(5, 4, 8);
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0xff6644);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);

    // Create impact marker (hidden initially)
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.7,
    });
    this.impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.impactMarker.visible = false;
    this.scene.add(this.impactMarker);

    // Create radius marker (wireframe sphere)
    const radiusGeometry = new THREE.SphereGeometry(1, 16, 16);
    const radiusMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
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

    // Create the primitive
    const mesh = this.createPrimitive(
      this.settings.primitiveType,
      this.objectMaterial,
    );

    this.object = new DestructibleMesh(mesh.geometry, this.objectMaterial);
    this.object.mesh.castShadow = true;

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

    this.object.fracture(
      this.fractureOptions,
      true, // freeze
      (fragment) => {
        fragment.material = [this.objectMaterial, this.insideMaterial];
        fragment.castShadow = true;

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
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (this.hasSmashed || !this.object) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection with object
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.object.mesh, false);

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
    if (this.hasSmashed || !this.object) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.object.mesh, false);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      const localPoint = this.object.worldToLocal(intersectionPoint.clone());

      if (this.settings.preFracture) {
        // Unfreeze the pre-fractured object
        this.object.unfreeze((fragment) => {
          const body = this.physics.getBody(fragment);
          if (body) {
            body.wakeUp();
          }
        });
      } else {
        // Real-time fracture
        this.fractureOptions.impactPoint = this.settings.useImpactPoint
          ? localPoint
          : undefined;
        this.fractureOptions.impactRadius = this.settings.useImpactPoint
          ? this.settings.impactRadius
          : undefined;

        this.object.fracture(this.fractureOptions, false, (fragment) => {
          fragment.material = [this.objectMaterial, this.insideMaterial];
          fragment.castShadow = true;

          // Add physics
          this.physics.add(fragment, {
            type: "dynamic",
            collider: "convexHull",
            restitution: 0.3,
          });
        });
      }

      this.hasSmashed = true;

      // Hide markers after smashing
      if (this.impactMarker) this.impactMarker.visible = false;
      if (this.radiusMarker) this.radiusMarker.visible = false;
    }
  };

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `SMASHING OBJECT

• Choose a primitive shape
• Hover to preview impact area
• Click on object to fracture it
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
          Icosahedron: "icosahedron",
          Cylinder: "cylinder",
          Torus: "torus",
          "Torus Knot": "torusKnot",
        },
        label: "Primitive",
      })
      .on("change", () => {
        this.reset();
      });

    folder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 10,
      max: 200,
      step: 1,
      label: "Fragment Count",
    });

    folder.addBinding(this.fractureOptions, "mode", {
      options: {
        "3D": "3D",
        "2.5D": "2.5D",
      },
      label: "Mode",
    });

    folder.addBinding(this.settings, "useImpactPoint", {
      label: "Impact Point",
    });

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

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear all physics first
    this.clearPhysics();

    // Hide markers
    if (this.impactMarker) {
      this.impactMarker.visible = false;
    }
    if (this.radiusMarker) {
      this.radiusMarker.visible = false;
    }

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
