import * as THREE from "three";
import { BaseScene } from "./BaseScene";
import { DestructibleMesh, SliceOptions } from "@dgreenheck/three-pinata";

type PrimitiveType = "cube" | "sphere" | "cylinder" | "torus" | "torusKnot";

/**
 * Slicing Demo
 * - Pick a primitive shape
 * - Visualize slice plane
 * - WASD to translate, QE to rotate
 * - Space to execute slice
 */
export class SlicingScene extends BaseScene {
  private objects: DestructibleMesh[] = [];
  private objectMaterial!: THREE.MeshStandardMaterial;
  private insideMaterial!: THREE.MeshStandardMaterial;
  private slicePlane!: THREE.Mesh;
  private sliceHelper!: THREE.GridHelper;
  private sliceGroup!: THREE.Group;

  private settings = {
    primitiveType: "cube" as PrimitiveType,
  };

  private sliceNormal = new THREE.Vector3(0, 1, 0);
  private slicePosition = new THREE.Vector3(0, 3, 0);
  private moveSpeed = 2.0;
  private rotateSpeed = 1.0;

  private keysPressed = new Set<string>();

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(6, 5, 8);
    this.controls.target.set(0, 3, 0);
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0x9944ff);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);

    // Create slice plane visualization
    this.createSlicePlane();

    // Create initial object
    this.createObject();

    // Add keyboard listeners
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private createSlicePlane(): void {
    this.sliceGroup = new THREE.Group();

    // Create semi-transparent plane
    const planeGeometry = new THREE.PlaneGeometry(6, 6);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.slicePlane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.sliceGroup.add(this.slicePlane);

    // Add grid helper for better visualization
    const gridSize = 6;
    const divisions = 12;
    this.sliceHelper = new THREE.GridHelper(gridSize, divisions, 0xff0000, 0xff6666);
    this.sliceHelper.rotation.x = Math.PI / 2;
    this.sliceGroup.add(this.sliceHelper);

    this.sliceGroup.position.copy(this.slicePosition);
    this.scene.add(this.sliceGroup);
  }

  private createObject(): void {
    // Create the primitive
    const mesh = this.createPrimitive(
      this.settings.primitiveType,
      this.objectMaterial,
    );

    const destructibleMesh = new DestructibleMesh(
      mesh.geometry,
      this.objectMaterial,
    );
    destructibleMesh.mesh.castShadow = true;
    destructibleMesh.position.set(0, 3, 0);
    this.scene.add(destructibleMesh);
    this.objects.push(destructibleMesh);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    this.keysPressed.add(event.key.toLowerCase());

    // Execute slice on Space
    if (event.key === " ") {
      event.preventDefault();
      this.executeSlice();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keysPressed.delete(event.key.toLowerCase());
  };

  private executeSlice(): void {
    // Slice all objects that intersect the plane
    const objectsToSlice = [...this.objects];

    objectsToSlice.forEach((obj) => {
      // Check if object intersects with the slice plane
      // For simplicity, we'll slice all objects
      const sliceOptions = new SliceOptions();
      sliceOptions.enableReslicing = true;
      sliceOptions.maxResliceCount = 10;

      try {
        // Transform slice normal and origin to object's local space
        const worldToLocal = new THREE.Matrix4();
        worldToLocal.copy(obj.matrixWorld).invert();

        const localNormal = this.sliceNormal
          .clone()
          .transformDirection(worldToLocal)
          .normalize();
        const localOrigin = this.slicePosition
          .clone()
          .applyMatrix4(worldToLocal);

        const { top, bottom } = obj.slice(
          localNormal,
          localOrigin,
          sliceOptions,
          (top, bottom) => {
            // Setup materials for both pieces
            [top, bottom].forEach((piece) => {
              piece.mesh.material = [this.objectMaterial, this.insideMaterial];
              piece.mesh.castShadow = true;

              // Add to scene and tracking
              this.scene.add(piece);
              this.objects.push(piece);

              // Add physics
              this.physics.add(piece.mesh, {
                type: "dynamic",
                collider: "convexHull",
                restitution: 0.3,
              });
            });
          },
        );

        // Remove the original object
        this.scene.remove(obj);
        const index = this.objects.indexOf(obj);
        if (index > -1) {
          this.objects.splice(index, 1);
        }
        obj.dispose();
      } catch (error) {
        console.warn("Could not slice object:", error);
      }
    });
  }

  update(deltaTime: number): void {
    // Handle WASD movement
    const movement = new THREE.Vector3();

    if (this.keysPressed.has("w")) {
      movement.z -= this.moveSpeed * deltaTime;
    }
    if (this.keysPressed.has("s")) {
      movement.z += this.moveSpeed * deltaTime;
    }
    if (this.keysPressed.has("a")) {
      movement.x -= this.moveSpeed * deltaTime;
    }
    if (this.keysPressed.has("d")) {
      movement.x += this.moveSpeed * deltaTime;
    }

    // Apply movement
    this.slicePosition.add(movement);
    this.sliceGroup.position.copy(this.slicePosition);

    // Handle QE rotation
    let rotation = 0;
    if (this.keysPressed.has("q")) {
      rotation += this.rotateSpeed * deltaTime;
    }
    if (this.keysPressed.has("e")) {
      rotation -= this.rotateSpeed * deltaTime;
    }

    if (rotation !== 0) {
      // Rotate around the camera's up vector
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(axis, rotation);

      this.sliceNormal.applyQuaternion(quaternion);
      this.sliceGroup.quaternion.multiplyQuaternions(
        quaternion,
        this.sliceGroup.quaternion,
      );
    }
  }

  setupUI(): void {
    const folder = this.pane.addFolder({ title: "Slicing Demo", expanded: true });

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

    folder.addButton({ title: "Slice (Space)" }).on("click", () => {
      this.executeSlice();
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    // Add instructions
    folder.addBlade({
      view: "separator",
    });

    const instructions = folder.addBlade({
      view: "text",
      label: "Controls",
      parse: (v: any) => String(v),
      value: "WASD: Move plane\nQ/E: Rotate\nSpace: Slice",
    }) as any;
    instructions.disabled = true;
  }

  reset(): void {
    // Remove all objects
    this.objects.forEach((obj) => {
      this.scene.remove(obj);
      this.physics.remove(obj.mesh);
      obj.dispose();
    });
    this.objects = [];

    // Reset slice plane
    this.slicePosition.set(0, 3, 0);
    this.sliceNormal.set(0, 1, 0);
    this.sliceGroup.position.copy(this.slicePosition);
    this.sliceGroup.quaternion.set(0, 0, 0, 1);

    // Create new object
    this.createObject();
  }

  dispose(): void {
    // Remove keyboard listeners
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);

    // Remove all objects
    this.objects.forEach((obj) => {
      this.scene.remove(obj);
      this.physics.remove(obj.mesh);
      obj.dispose();
    });
    this.objects = [];

    // Remove slice plane
    this.scene.remove(this.sliceGroup);
    this.slicePlane.geometry.dispose();
    (this.slicePlane.material as THREE.Material).dispose();
    this.sliceHelper.dispose();
  }
}
