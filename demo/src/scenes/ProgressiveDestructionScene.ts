import * as THREE from "three";
import { BaseScene } from "./BaseScene";
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
  private balls: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private fractureOptions = new VoronoiFractureOptions({
    mode: "3D",
    fragmentCount: 50,
  });

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
    // Create a cube
    const geometry = new THREE.BoxGeometry(3, 3, 3, 1, 1, 1);
    this.object = new DestructibleMesh(geometry, this.objectMaterial);
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

        // Add physics (sleeping)
        const body = this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.2,
        });
        body.sleep();
      },
    );
  }

  private onMouseClick = (event: MouseEvent): void => {
    // Calculate mouse position in normalized device coordinates
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Shoot a ball from camera toward mouse position
    this.shootBall();
  };

  private shootBall(): void {
    // Create ball
    const ballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xffff00,
      roughness: 0.2,
      metalness: 0.8,
      envMapIntensity: 1.0,
    });

    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;

    // Position ball at camera
    ball.position.copy(this.camera.position);

    // Add to scene
    this.scene.add(ball);
    this.balls.push(ball);

    // Add physics
    const ballBody = this.physics.add(ball, {
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
    ballBody.setLinearVelocity({ x: velocity.x, y: velocity.y, z: velocity.z });

    // Remove balls that fall too far
    setTimeout(() => {
      if (ball.position.y < -20) {
        this.scene.remove(ball);
        this.physics.remove(ball);
        const index = this.balls.indexOf(ball);
        if (index > -1) {
          this.balls.splice(index, 1);
        }
        ball.geometry.dispose();
        (ball.material as THREE.Material).dispose();
      }
    }, 10000);
  }

  private onCollision = (body1: any, body2: any, started: boolean): void => {
    if (!started || !this.object) return;

    // Check if one of the bodies is a ball and the other is a fragment
    const ball = this.balls.find(
      (b) => this.physics.getBody(b) === body1 || this.physics.getBody(b) === body2,
    );

    if (!ball) return;

    // Find the fragment
    const fragmentBody = body1 === this.physics.getBody(ball) ? body2 : body1;
    const fragment = fragmentBody.object as THREE.Mesh;

    // Check if it's a fragment of our object and hasn't been handled yet
    if (
      fragment.parent === this.object &&
      !this.collisionHandled.has(fragment)
    ) {
      this.collisionHandled.add(fragment);

      // Unfreeze just this fragment
      fragment.visible = true;
      const body = this.physics.getBody(fragment);
      if (body) {
        body.wakeUp();

        // Apply impulse based on ball velocity
        const ballBody = this.physics.getBody(ball);
        if (ballBody) {
          const ballVelocity = ballBody.getLinearVelocity();
          const impulse = new THREE.Vector3(
            ballVelocity.x * 0.5,
            ballVelocity.y * 0.5,
            ballVelocity.z * 0.5,
          );
          body.rigidBody.applyImpulse(
            { x: impulse.x, y: impulse.y, z: impulse.z },
            true,
          );
        }
      }

      // Check if we should remove the original mesh
      if (this.object.isFrozen()) {
        // Count visible fragments
        const visibleCount = this.object.fragments.filter((f) => f.visible).length;
        if (visibleCount > 0) {
          // Remove original mesh on first fragment activation
          this.scene.remove(this.object.mesh);
          this.physics.remove(this.object.mesh);
        }
      }
    }
  };

  update(deltaTime: number): void {
    // No per-frame updates needed
  }

  setupUI(): void {
    const folder = this.pane.addFolder({
      title: "Progressive Destruction",
      expanded: true,
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

    // Add instructions
    const instructions = folder.addBlade({
      view: "text",
      label: "Instructions",
      parse: (v: any) => String(v),
      value: "Click to shoot balls",
    }) as any;
    instructions.disabled = true;
  }

  reset(): void {
    // Remove old object
    if (this.object) {
      this.scene.remove(this.object);
      this.object.dispose();
    }

    // Remove all balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      this.physics.remove(ball);
      ball.geometry.dispose();
      (ball.material as THREE.Material).dispose();
    });
    this.balls = [];

    // Clear collision tracking
    this.collisionHandled = new WeakSet<THREE.Mesh>();

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

    // Remove all balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      this.physics.remove(ball);
      ball.geometry.dispose();
      (ball.material as THREE.Material).dispose();
    });
    this.balls = [];

    // Clear collision callback
    this.physics.onCollision = undefined;
  }
}
