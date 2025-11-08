import * as THREE from "three";
import { FolderApi, ButtonApi } from "tweakpane";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  FractureOptions,
} from "@dgreenheck/three-pinata";
import { PhysicsBody } from "../physics/PhysicsBody";

/**
 * Progressive Destruction Demo
 * - Pre-fractured frozen object
 * - Shoot balls on click
 * - Only collided fragments unfreeze
 */
export class ProgressiveDestructionScene extends BaseScene {
  private object: DestructibleMesh | null = null;
  private fragments: THREE.Mesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private currentBall: THREE.Mesh | null = null;
  private resetButton: ButtonApi | null = null;
  private voronoiFractureOptions = new FractureOptions({
    fractureMethod: "voronoi",
    fragmentCount: 50,
    voronoiOptions: {
      mode: "3D",
    },
  });
  private radialFractureOptions = new FractureOptions({
    fractureMethod: "simple",
    fragmentCount: 50,
  });

  private settings = {
    primitiveType: "torusKnot" as PrimitiveType,
    fractureMethod: "Voronoi" as "Voronoi" | "Radial",
    fragmentCount: 30,
  };

  private collisionHandled = new WeakSet<THREE.Mesh>();

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(4, 3, -3);
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0x44aaff);
    this.insideMaterial = this.createInsideMaterial(0xcccccc);

    // Load statue geometry if needed
    await this.loadStatueGeometry();

    // Create and pre-fracture object
    this.createObject();

    // Setup collision detection
    this.physics.onCollision = this.onCollision;

    // Add click listener for shooting balls
    window.addEventListener("click", this.onMouseClick);
  }

  private createObject(): void {
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

    // Calculate height so object sits on ground
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox!;
    const height = -boundingBox.min.y; // Offset by the bottom of the bounding box

    this.object.position.set(0, height, 0);
    this.object.updateMatrixWorld(true);
    this.scene.add(this.object);

    // Disable reset button and show fracturing message
    if (this.resetButton) {
      this.resetButton.disabled = true;
      this.resetButton.title = "Fracturing...";
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      if (!this.object) return;

      // Pre-fracture
      if (this.settings.fractureMethod === "Voronoi") {
        this.fragments = this.object.fracture(
          this.voronoiFractureOptions,
          (fragment) => {
            // For statue, use original material + rock inside material; for others, use custom materials
            if (this.settings.primitiveType === "statue") {
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

            // Add physics (locked)
            try {
              const body = this.physics.add(fragment, {
                type: "dynamic",
                restitution: 0.2,
              });
              if (body) {
                body.rigidBody.lockTranslations(true, false);
                body.rigidBody.lockRotations(true, false);
              } else {
                console.warn("Failed to create physics body for fragment");
              }
            } catch (error) {
              console.error("Error adding physics to fragment:", error);
            }
          },
        );

        // Add fragments to scene
        this.fragments.forEach((fragment) => {
          this.scene.add(fragment);
        });
      } else {
        this.fragments = this.object.fracture(
          this.radialFractureOptions,
          (fragment) => {
            // For statue, use original material + rock inside material; for others, use custom materials
            if (this.settings.primitiveType === "statue") {
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

            // Add physics (locked)
            try {
              const body = this.physics.add(fragment, {
                type: "dynamic",
                restitution: 0.2,
              });
              if (body) {
                body.rigidBody.lockTranslations(true, false);
                body.rigidBody.lockRotations(true, false);
              } else {
                console.warn("Failed to create physics body for fragment");
              }
            } catch (error) {
              console.error("Error adding physics to fragment:", error);
            }
          },
        );

        // Add fragments to scene
        this.fragments.forEach((fragment) => {
          this.scene.add(fragment);
        });
      }

      // Hide the original mesh immediately (fragments are now visible)
      this.object!.visible = false;

      // Re-enable reset button
      if (this.resetButton) {
        this.resetButton.disabled = false;
        this.resetButton.title = "Reset";
      }
    }, 10);
  }

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);

    // Shoot a ball from camera toward mouse position
    this.shootBall();
  };

  private shootBall(): void {
    // Remove previous ball if it exists
    if (this.currentBall) {
      this.scene.remove(this.currentBall);
      this.physics.remove(this.currentBall);
      this.currentBall.geometry.dispose();
      (this.currentBall.material as THREE.Material).dispose();
      this.currentBall = null;
    }

    // Create ball
    const ballGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xffbf40,
      roughness: 0.2,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });

    this.currentBall = new THREE.Mesh(ballGeometry, ballMaterial);
    this.currentBall.castShadow = true;

    // Position ball 1 unit in front of camera
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    this.currentBall.position.copy(this.camera.position).add(cameraDirection);

    // Add to scene
    this.scene.add(this.currentBall);

    // Add physics
    const ballBody = this.physics.add(this.currentBall, {
      type: "dynamic",
      mass: 10.0,
      restitution: 0.1,
    });

    // Calculate direction from camera through mouse position
    const direction = new THREE.Vector3();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    direction.copy(this.raycaster.ray.direction).normalize();

    // Apply velocity
    const speed = 15;
    const velocity = direction.multiplyScalar(speed);
    if (ballBody) {
      ballBody.setLinearVelocity({
        x: velocity.x,
        y: velocity.y,
        z: velocity.z,
      });
    }
  }

  private onCollision = (body1: PhysicsBody, body2: PhysicsBody, started: boolean): void => {
    if (!started || !this.object || !this.currentBall) return;

    const obj1 = body1.object as THREE.Mesh;
    const obj2 = body2.object as THREE.Mesh;

    // Check if either object is the current ball
    const ball1 = obj1 === this.currentBall;
    const ball2 = obj2 === this.currentBall;

    // Check if either object is a fragment of our object
    const isFragment1 = this.fragments.includes(obj1);
    const isFragment2 = this.fragments.includes(obj2);

    // Only wake up fragment if hit by ball (not by other fragments)
    if (ball1 && isFragment2 && !this.collisionHandled.has(obj2)) {
      this.collisionHandled.add(obj2);
      body2.rigidBody.lockTranslations(false, false);
      body2.rigidBody.lockRotations(false, false);
    } else if (ball2 && isFragment1 && !this.collisionHandled.has(obj1)) {
      this.collisionHandled.add(obj1);
      body1.rigidBody.lockTranslations(false, false);
      body1.rigidBody.lockRotations(false, false);
    }
  };

  update(): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `PROGRESSIVE DESTRUCTION

• Click to shoot balls
• Use controls to adjust fragment count
• Click reset to restart`;
  }

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Progressive Destruction",
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

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: BaseScene.FRACTURE_METHOD_OPTIONS,
        label: "Fracture Method",
      })
      .on("change", () => {
        this.reset();
      });

    folder
      .addBinding(this.settings, "fragmentCount", {
        min: 2,
        max: 64,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", () => {
        this.voronoiFractureOptions.fragmentCount = this.settings.fragmentCount;
        this.radialFractureOptions.fragmentCount = this.settings.fragmentCount;
      });

    this.resetButton = folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  async reset(): Promise<void> {
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

    // Remove current ball
    if (this.currentBall) {
      this.scene.remove(this.currentBall);
      this.currentBall.geometry.dispose();
      (this.currentBall.material as THREE.Material).dispose();
      this.currentBall = null;
    }

    // Clear collision tracking
    this.collisionHandled = new WeakSet<THREE.Mesh>();

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate object
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

    // Remove current ball
    if (this.currentBall) {
      this.scene.remove(this.currentBall);
      this.physics.remove(this.currentBall);
      this.currentBall.geometry.dispose();
      (this.currentBall.material as THREE.Material).dispose();
      this.currentBall = null;
    }

    // Clear collision callback
    this.physics.onCollision = undefined;
  }
}
