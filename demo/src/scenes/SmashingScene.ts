import * as THREE from "three";
import { BaseScene } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
} from "@dgreenheck/three-pinata";

type PrimitiveType = "cube" | "sphere" | "cylinder" | "torus" | "torusKnot";

/**
 * Smashing Object Demo
 * - Pick a primitive shape
 * - Object hovers and rotates
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
    preFracture: false,
  };

  private hasSmashed = false;
  private hoverHeight = 3;
  private rotationSpeed = 0.5;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(5, 4, 8);
    this.controls.target.set(0, 3, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0xff6644);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);

    // Create initial object
    this.createObject();

    // Add click listener
    window.addEventListener("click", this.onMouseClick);
  }

  private createObject(): void {
    // Remove old object if exists
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }

    // Create the primitive
    const mesh = this.createPrimitive(this.settings.primitiveType, this.objectMaterial);

    this.object = new DestructibleMesh(mesh.geometry, this.objectMaterial);
    this.object.mesh.castShadow = true;
    this.object.position.set(0, this.hoverHeight, 0);
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
        body.sleep();
      },
    );
  }

  private onMouseClick = (event: MouseEvent): void => {
    if (this.hasSmashed || !this.object) return;

    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycast to find intersection
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(
      this.object.mesh,
      false,
    );

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      const localPoint = this.object.worldToLocal(intersectionPoint.clone());

      if (this.settings.preFracture) {
        // Unfreeze the pre-fractured object
        this.object.unfreeze((fragment) => {
          const body = this.physics.getBody(fragment);
          if (body) {
            body.wakeUp();

            // Add impulse away from impact point
            if (this.settings.useImpactPoint) {
              const fragmentPos = fragment.position.clone();
              const direction = fragmentPos.sub(localPoint).normalize();
              const impulse = direction.multiplyScalar(2);
              body.rigidBody.applyImpulse(
                { x: impulse.x, y: impulse.y, z: impulse.z },
                true,
              );
            }
          }
        });
      } else {
        // Real-time fracture
        this.fractureOptions.impactPoint = this.settings.useImpactPoint
          ? localPoint
          : undefined;

        this.object.fracture(
          this.fractureOptions,
          false,
          (fragment) => {
            fragment.material = [this.objectMaterial, this.insideMaterial];
            fragment.castShadow = true;

            // Add physics
            const body = this.physics.add(fragment, {
              type: "dynamic",
              collider: "convexHull",
              restitution: 0.3,
            });

            // Add small random impulse
            const impulse = new THREE.Vector3(
              (Math.random() - 0.5) * 1,
              Math.random() * 0.5,
              (Math.random() - 0.5) * 1,
            );
            body.rigidBody.applyImpulse(
              { x: impulse.x, y: impulse.y, z: impulse.z },
              true,
            );
          },
        );
      }

      this.hasSmashed = true;
    }
  };

  update(deltaTime: number): void {
    // Rotate object if not smashed
    if (!this.hasSmashed && this.object) {
      this.object.rotation.y += deltaTime * this.rotationSpeed;

      // Add subtle hover animation
      const time = this.clock.getElapsedTime();
      this.object.position.y = this.hoverHeight + Math.sin(time * 2) * 0.1;
    }
  }

  setupUI(): void {
    const folder = this.pane.addFolder({ title: "Smashing Object", expanded: true });

    folder
      .addBinding(this.settings, "primitiveType", {
        options: {
          Cube: "cube",
          Sphere: "sphere",
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
  }

  reset(): void {
    this.createObject();
  }

  dispose(): void {
    // Remove click listener
    window.removeEventListener("click", this.onMouseClick);

    // Remove object
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }
  }
}
