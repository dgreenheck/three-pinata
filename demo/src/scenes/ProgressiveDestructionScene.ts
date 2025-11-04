import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BaseScene, PrimitiveType } from "./BaseScene";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
  FractureOptions,
  fracture,
} from "@dgreenheck/three-pinata";
import torusGLB from "../assets/torus.glb";

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
  private wireframeMaterial!: THREE.MeshBasicMaterial;
  private currentBall: THREE.Mesh | null = null;
  private gltfLoader = new GLTFLoader();
  private torusGeometry: THREE.BufferGeometry | null = null;
  private axesHelper!: THREE.AxesHelper;
  private voronoiFractureOptions = new VoronoiFractureOptions({
    mode: "3D",
    fragmentCount: 50,
    detectIsolatedFragments: true,
  });
  private radialFractureOptions = new FractureOptions({
    fragmentCount: 50,
    fractureMode: "Non-Convex",
  });

  private settings = {
    primitiveType: "torus" as PrimitiveType,
    wireframe: true,
    fractureMethod: "Voronoi" as "Voronoi" | "Radial",
    fragmentCount: 10,
    useSeed: true,
    seedValue: 1832439633,
    lastUsedSeed: 0, // Will be set after fracturing
    showAxes: true,
  };

  private collisionHandled = new WeakSet<THREE.Mesh>();

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(4, 5, 7);
    this.controls.target.set(0, 3, 0);
    this.controls.update();

    // Create axes helper (X: red, Y: green, Z: blue)
    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.visible = this.settings.showAxes;
    this.scene.add(this.axesHelper);

    // Create materials
    this.objectMaterial = this.createMaterial(0x44aaff);
    this.insideMaterial = this.createInsideMaterial(0xcccccc);
    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });

    // Load torus model
    await this.loadTorusModel();

    // Create and pre-fracture object
    this.createObject();

    // Setup collision detection
    this.physics.onCollision = this.onCollision;

    // Add click listener for shooting balls
    window.addEventListener("click", this.onMouseClick);
  }

  private async loadTorusModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        torusGLB,
        (gltf) => {
          // Get the geometry from the first mesh in the scene
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh && !this.torusGeometry) {
              const geometry = child.geometry.clone();

              // Ensure geometry has normals
              if (!geometry.attributes.normal) {
                geometry.computeVertexNormals();
              }

              // Ensure geometry has UVs (required for fracturing)
              if (!geometry.attributes.uv) {
                // Create simple planar UV mapping as fallback
                const uvs = new Float32Array(
                  geometry.attributes.position.count * 2,
                );
                geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
              }

              // Compute bounding sphere/box
              geometry.computeBoundingBox();
              geometry.computeBoundingSphere();

              this.torusGeometry = geometry;
            }
          });
          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  private createObject(): void {
    // Create the primitive or use loaded torus geometry
    let geometry: THREE.BufferGeometry;

    if (this.settings.primitiveType === "torus" && this.torusGeometry) {
      geometry = this.torusGeometry.clone();
    } else {
      const mesh = this.createPrimitive(
        this.settings.primitiveType,
        this.objectMaterial,
      );
      geometry = mesh.geometry;
    }

    this.object = new DestructibleMesh(geometry, this.objectMaterial);
    this.object.mesh.castShadow = true;
    this.object.position.set(0, 3, 0);
    this.scene.add(this.object);

    // Pre-fracture and freeze
    if (this.settings.fractureMethod === "Voronoi") {
      // Set seed if using custom seed
      if (this.settings.useSeed) {
        this.voronoiFractureOptions.seed = this.settings.seedValue;
      } else {
        this.voronoiFractureOptions.seed = undefined;
      }

      this.object.fracture(
        this.voronoiFractureOptions,
        true, // freeze
        (fragment) => {
          fragment.material = this.settings.wireframe
            ? this.wireframeMaterial
            : [this.objectMaterial, this.insideMaterial];
          fragment.castShadow = true;

          // Make fragment visible (they're hidden by default when frozen)
          fragment.visible = true;

          // Add physics (sleeping)
          try {
            const body = this.physics.add(fragment, {
              type: "dynamic",
              collider: "convexHull",
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
      // Capture the seed value after fracturing
      this.settings.lastUsedSeed = this.voronoiFractureOptions.seed || 0;
    } else {
      // Radial fracture method
      // Set seed if using custom seed
      if (this.settings.useSeed) {
        this.radialFractureOptions.seed = this.settings.seedValue;
      } else {
        this.radialFractureOptions.seed = undefined;
      }

      const fragmentGeometries = fracture(
        this.object.mesh.geometry,
        this.radialFractureOptions,
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

        const fragment = new THREE.Mesh(
          fragmentGeometry,
          this.settings.wireframe
            ? this.wireframeMaterial
            : [this.objectMaterial, this.insideMaterial],
        );

        // Position the fragment at its original center within the group
        fragment.position.copy(center);
        fragment.castShadow = true;
        fragment.visible = true;

        // Add as child to the DestructibleMesh group
        this.object!.add(fragment);
        this.object!.fragments.push(fragment);

        // Add physics (sleeping)
        try {
          const body = this.physics.add(fragment, {
            type: "dynamic",
            collider: "convexHull",
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
      });
      // Capture the seed value after fracturing
      this.settings.lastUsedSeed = this.radialFractureOptions.seed || 0;
    }

    // Hide the original mesh immediately (fragments are now visible)
    this.object.mesh.visible = false;
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
    const ballGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
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

  private updateWireframe(): void {
    if (!this.object) return;

    const material = this.settings.wireframe
      ? this.wireframeMaterial
      : [this.objectMaterial, this.insideMaterial];

    // Update all fragments
    this.object.fragments.forEach((fragment) => {
      fragment.material = material;
    });
  }

  update(): void {
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
        },
        label: "Primitive",
      })
      .on("change", () => {
        this.reset();
      });

    folder
      .addBinding(this.settings, "fractureMethod", {
        options: {
          Voronoi: "Voronoi",
          Radial: "Radial",
        },
        label: "Fracture Method",
      })
      .on("change", () => {
        this.reset();
      });

    folder
      .addBinding(this.settings, "fragmentCount", {
        min: 10,
        max: 150,
        step: 1,
        label: "Fragment Count",
      })
      .on("change", () => {
        this.voronoiFractureOptions.fragmentCount = this.settings.fragmentCount;
        this.radialFractureOptions.fragmentCount = this.settings.fragmentCount;
      });

    folder
      .addBinding(this.settings, "wireframe", {
        label: "Wireframe",
      })
      .on("change", () => {
        this.updateWireframe();
      });

    folder
      .addBinding(this.settings, "showAxes", {
        label: "Show Axes",
      })
      .on("change", () => {
        this.axesHelper.visible = this.settings.showAxes;
      });

    // Checkbox to enable custom seed
    const useSeedBinding = folder.addBinding(this.settings, "useSeed", {
      label: "Use Custom Seed",
    });

    // Input for custom seed value
    const seedValueBinding = folder.addBinding(this.settings, "seedValue", {
      label: "Seed Value",
    });

    // Set initial disabled state
    seedValueBinding.disabled = !this.settings.useSeed;

    // Update seed value binding when useSeed checkbox changes
    useSeedBinding.on("change", () => {
      seedValueBinding.disabled = !this.settings.useSeed;
    });

    // Display the last used seed (readonly)
    folder.addBinding(this.settings, "lastUsedSeed", {
      label: "Last Used Seed",
      readonly: true,
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
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

    // Remove axes helper
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
    }

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
