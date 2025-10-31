import * as THREE from "three";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
} from "@dgreenheck/three-pinata";

/**
 * Progressive Destruction Demo
 * - Pre-fractured frozen object
 * - Shoot balls on click
 * - Only collided fragments unfreeze
 */
export class ProgressiveDestructionScene extends BaseScene {
  private object: DestructibleMesh | null = null;
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private currentBall: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private fractureOptions = new VoronoiFractureOptions({
    mode: "3D",
    fragmentCount: 50,
  });

  private settings = {
    primitiveType: "cube" as PrimitiveType,
  };

  private collisionHandled = new WeakSet<THREE.Mesh>();

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(0, 3, 10);
    this.controls.target.set(0, 3, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0x44aaff);
    this.insideMaterial = this.createInsideMaterial(0xcccccc);

    // Create and pre-fracture object
    this.createObject();

    // Setup collision detection
    this.physics.onCollision = this.onCollision;

    // Add click listener for shooting balls
    window.addEventListener("click", this.onMouseClick);
  }

  private createObject(): void {
    // Create the primitive
    const mesh = this.createPrimitive(
      this.settings.primitiveType,
      this.objectMaterial,
    );

    this.object = new DestructibleMesh(mesh.geometry, this.objectMaterial);
    this.object.mesh.castShadow = true;
    this.object.position.set(0, 3, 0);
    this.scene.add(this.object);

    // Pre-fracture and freeze
    this.object.fracture(
      this.fractureOptions,
      true, // freeze
      (fragment) => {
        fragment.material = [this.objectMaterial, this.insideMaterial];
        fragment.castShadow = true;

        // Make fragment visible (they're hidden by default when frozen)
        fragment.visible = true;

        // Add physics (sleeping)
        const body = this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.2,
        });
        if (body) {
          body.rigidBody.lockTranslations(true, false);
          body.rigidBody.lockRotations(true, false);
        }
      },
    );

    // Hide the original mesh immediately (fragments are now visible)
    this.object.mesh.visible = false;
  }

  private onMouseClick = (event: MouseEvent): void => {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
    const ballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.2,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });

    this.currentBall = new THREE.Mesh(ballGeometry, ballMaterial);
    this.currentBall.castShadow = true;

    // Position ball at camera
    this.currentBall.position.copy(this.camera.position);

    // Add to scene
    this.scene.add(this.currentBall);

    // Add physics
    const ballBody = this.physics.add(this.currentBall, {
      type: "dynamic",
      collider: "ball",
      mass: 5.0,
      restitution: 0.5,
    });

    // Calculate direction from camera through mouse position
    const direction = new THREE.Vector3();
    this.raycaster.setFromCamera(this.mouse, this.camera);
    direction.copy(this.raycaster.ray.direction).normalize();

    // Apply velocity
    const speed = 20;
    const velocity = direction.multiplyScalar(speed);
    if (ballBody) {
      ballBody.setLinearVelocity({
        x: velocity.x,
        y: velocity.y,
        z: velocity.z,
      });
    }
  }

  private onCollision = (body1: any, body2: any, started: boolean): void => {
    if (!started || !this.object || !this.currentBall) return;

    const obj1 = body1.object as THREE.Mesh;
    const obj2 = body2.object as THREE.Mesh;

    // Check if either object is the current ball
    const ball1 = obj1 === this.currentBall;
    const ball2 = obj2 === this.currentBall;

    // Check if either object is a fragment of our object
    const isFragment1 = obj1.parent === this.object;
    const isFragment2 = obj2.parent === this.object;

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

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  getInstructions(): string {
    return `PROGRESSIVE DESTRUCTION

• Object is pre-fractured with sleeping fragments
• Click to shoot balls
• Fragments wake up only when hit
• Watch physics propagate through structure
• Adjust fragment count and reset`;
  }

  setupUI(): any {
    const folder = this.pane.addFolder({
      title: "Progressive Destruction",
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
      max: 150,
      step: 1,
      label: "Fragment Count",
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
    }

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
