import * as THREE from "three";
import { FolderApi } from "tweakpane";
import { BaseScene } from "./BaseScene";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

/**
 * Brick Wall Demo
 * - Pyramid wall of bricks (8 wide at base)
 * - Voronoi impact fracturing on each brick
 * - Fire balls at bricks to fracture them
 */
export class BrickWallScene extends BaseScene {
  private bricks: DestructibleMesh[] = [];
  private fracturedBricks = new Set<DestructibleMesh>();
  private fragments: DestructibleMesh[] = [];
  private brickMaterial!: THREE.Material | THREE.Material[];
  private ballMaterial!: THREE.MeshStandardMaterial;
  private balls: THREE.Mesh[] = [];
  private brickGeometry!: THREE.BufferGeometry;

  private voronoiFractureOptions = new FractureOptions({
    fractureMethod: "voronoi",
    fragmentCount: 16,
    voronoiOptions: {
      mode: "3D",
    },
  });

  private simpleFractureOptions = new FractureOptions({
    fractureMethod: "simple",
    fragmentCount: 16,
  });

  private settings = {
    fractureMethod: "Voronoi" as "Voronoi" | "Simple",
  };

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(0, 2, 10);
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    // Load brick geometry and material from GLB
    const brickData = await this.modelFactory.loadBrickGeometry();
    this.brickGeometry = brickData.geometry;
    this.brickMaterial = brickData.material;

    // Create ball material
    this.ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.6,
    });

    // Create brick wall pyramid
    this.createBrickPyramid();

    // Set up physics collision handler
    this.physics.onCollision = (body1, body2, started) => {
      if (!started) return; // Only handle collision start

      // Check if one is a ball and the other is a brick
      const ball = this.balls.find(
        (b) => b === body1.object || b === body2.object,
      );
      const brick = this.bricks.find(
        (b) => b === body1.object || b === body2.object,
      );

      if (ball && brick && !this.fracturedBricks.has(brick)) {
        // Fracture the brick at the ball's position
        this.fractureBrick(brick, ball.position);
      }
    };

    // Add event listener for clicking
    window.addEventListener("click", this.onMouseClick);
  }

  private createBrickPyramid(): void {
    // Get brick dimensions from the loaded geometry (before rotation)
    const bbox = this.brickGeometry.boundingBox!;
    const originalWidth = bbox.max.x - bbox.min.x;
    const originalHeight = bbox.max.y - bbox.min.y;
    const originalDepth = bbox.max.z - bbox.min.z;

    // After 90 degree rotation around Y-axis, width and depth swap
    const brickWidth = originalDepth; // Z becomes X
    const brickHeight = originalHeight; // Y stays Y
    const brickDepth = originalWidth; // X becomes Z

    const spacing = 0.02; // Minimal gap between bricks

    // Create pyramid: 6 rows, starting with 6 bricks at bottom
    let yPosition = brickHeight / 2;

    for (let row = 0; row < 6; row++) {
      const bricksInRow = 6 - row;
      const rowWidth = bricksInRow * brickWidth + (bricksInRow - 1) * spacing;
      const xStart = -rowWidth / 2 + brickWidth / 2;

      for (let i = 0; i < bricksInRow; i++) {
        const brick = new DestructibleMesh(
          this.brickGeometry.clone(),
          this.brickMaterial,
        );

        // Random size variation (±1% on each axis)
        const scaleX = 1 + (Math.random() - 0.5) * 0.02;
        const scaleY = 1 + (Math.random() - 0.5) * 0.02;
        const scaleZ = 1 + (Math.random() - 0.5) * 0.02;
        brick.scale.set(scaleX, scaleY, scaleZ);

        // Rotate brick 90 degrees around y-axis + random variation (±2 degrees)
        const randomRotation = (Math.random() - 0.5) * ((4 * Math.PI) / 180); // ±2 degrees in radians
        brick.rotation.y = Math.PI / 2 + randomRotation;

        // Position brick with spacing
        brick.position.set(xStart + i * (brickWidth + spacing), yPosition, 0);

        brick.castShadow = true;
        brick.receiveShadow = true;

        this.scene.add(brick);
        this.bricks.push(brick);

        // Add physics with custom cuboid collider (half-extents)
        // Use slightly smaller collider to prevent interpenetration
        const colliderDesc = this.physics.RAPIER.ColliderDesc.cuboid(
          brickWidth / 2,
          brickHeight / 2,
          brickDepth / 2,
        );

        this.physics.add(brick, {
          type: "dynamic",
          restitution: 0.1,
          friction: 0.8,
          linearDamping: 0.5,
          angularDamping: 0.8,
          colliderDesc: colliderDesc,
        });
      }

      yPosition += brickHeight + spacing;
    }
  }

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.fireBall();
  };

  private fireBall(): void {
    // Create ball
    const ballRadius = 0.3;
    const ballGeometry = new THREE.SphereGeometry(ballRadius, 16, 16);
    const ball = new THREE.Mesh(ballGeometry, this.ballMaterial);

    // Position ball at camera
    ball.position.copy(this.camera.position);
    ball.castShadow = true;

    this.scene.add(ball);
    this.balls.push(ball);

    // Add physics to ball
    const body = this.physics.add(ball, {
      type: "dynamic",
      restitution: 0.6,
      friction: 0.5,
      mass: 2,
    });

    if (body) {
      // Calculate direction from camera through mouse position
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const direction = this.raycaster.ray.direction.clone().normalize();

      // Fire ball with velocity
      const speed = 25;
      body.setLinearVelocity({
        x: direction.x * speed,
        y: direction.y * speed,
        z: direction.z * speed,
      });
    }
  }

  private fractureBrick(
    brick: DestructibleMesh,
    worldPoint: THREE.Vector3,
  ): void {
    // Mark as fractured
    this.fracturedBricks.add(brick);

    // Convert world point to local coordinates
    const localPoint = brick.worldToLocal(worldPoint.clone());

    // Get the appropriate fracture options
    const options =
      this.settings.fractureMethod === "Voronoi"
        ? this.voronoiFractureOptions
        : this.simpleFractureOptions;

    // Set impact point for fracture (Voronoi only)
    if (this.settings.fractureMethod === "Voronoi" && options.voronoiOptions) {
      options.voronoiOptions.impactPoint = localPoint;
      options.voronoiOptions.impactRadius = 1.5;
    }

    // Fracture the brick - use brick material for both outer and inner faces
    const fragments = brick.fracture(options, (fragment) => {
      // Add physics to fragment
      this.physics.add(fragment, {
        type: "dynamic",
        restitution: 0.3,
        friction: 0.6,
      });
    });

    // Add fragments to scene and track them
    fragments.forEach((fragment) => {
      this.scene.add(fragment);
      this.fragments.push(fragment);
    });

    // Hide original brick
    brick.visible = false;

    // Remove physics body of original brick
    this.physics.remove(brick);
  }

  update(): void {
    // Collision detection is now handled by physics.onCollision callback
  }

  getInstructions(): string {
    return `BRICK WALL

• Click to fire balls at the wall`;
  }

  setupUI(): FolderApi {
    const folder = this.pane.addFolder({
      title: "Brick Wall",
      expanded: true,
    });

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: BaseScene.FRACTURE_METHOD_OPTIONS,
        label: "Fracture Method",
      })
      .on("change", () => {
        // Keep fragment counts in sync
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
      });

    folder
      .addBinding(this.voronoiFractureOptions, "fragmentCount", {
        min: 2,
        max: 64,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", () => {
        // Keep both fracture options in sync
        this.simpleFractureOptions.fragmentCount =
          this.voronoiFractureOptions.fragmentCount;
      });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear physics
    this.clearPhysics();

    // Remove all bricks and their fragments
    this.bricks.forEach((brick) => {
      this.scene.remove(brick);
      brick.dispose();
    });

    // Remove all fragments (don't dispose materials as they're shared with bricks)
    this.cleanupFragments(this.fragments, false);

    // Remove all balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      ball.geometry.dispose();
    });

    // Clear arrays
    this.bricks = [];
    this.fragments = [];
    this.balls = [];
    this.fracturedBricks.clear();

    // Re-add ground physics
    this.setupGroundPhysics();

    // Recreate pyramid
    this.createBrickPyramid();
  }

  dispose(): void {
    window.removeEventListener("click", this.onMouseClick);

    // Dispose bricks
    this.bricks.forEach((brick) => {
      this.scene.remove(brick);
      brick.dispose();
    });

    // Dispose fragments
    this.fragments.forEach((fragment) => {
      this.scene.remove(fragment);
      fragment.geometry.dispose();
      // Note: material is shared with bricks, so don't dispose here
    });

    // Dispose balls
    this.balls.forEach((ball) => {
      this.scene.remove(ball);
      ball.geometry.dispose();
    });

    // Dispose ball material
    this.ballMaterial.dispose();
  }
}
