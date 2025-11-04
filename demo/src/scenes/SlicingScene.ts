import * as THREE from "three";
import { BaseScene, PrimitiveType } from "./BaseScene";
import { DestructibleMesh, SliceOptions } from "@dgreenheck/three-pinata";

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
  private wireframeMaterial!: THREE.MeshBasicMaterial;
  private slicePlane!: THREE.Mesh;
  private sliceHelper!: THREE.GridHelper;
  private sliceGroup!: THREE.Group;

  private settings = {
    primitiveType: "icosahedron" as PrimitiveType,
    wireframe: false,
    useSeed: false,
    seedValue: 0,
  };

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
    this.wireframeMaterial = this.materialFactory.createWireframeMaterial(0x80ffa0);

    // Load statue geometry if needed
    await this.loadStatueGeometry();

    // Create slice plane visualization
    this.createSlicePlane();

    // Create initial object
    this.createObject();

    // Add keyboard listeners
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("click", this.onMouseClick);
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
    this.sliceHelper = new THREE.GridHelper(
      gridSize,
      divisions,
      0xff0000,
      0xff6666,
    );
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

    // Use the mesh's material (which may be the statue's original material)
    const materialToUse = mesh.material;

    const destructibleMesh = new DestructibleMesh(
      mesh.geometry,
      materialToUse,
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

  private onMouseClick = (event: MouseEvent): void => {
    this.updateMouseCoordinates(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Click on meshes to apply explosive force
    const allMeshes = this.objects.map((obj) => obj.mesh);
    this.handleExplosiveClick(allMeshes, 2.0, 15.0);
  };

  /**
   * Check if a plane intersects a bounding box
   * Returns true if the plane cuts through the box
   */
  private planeIntersectsBox(plane: THREE.Plane, box: THREE.Box3): boolean {
    // Get the 8 corners of the bounding box
    const min = box.min;
    const max = box.max;
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];

    // Check if corners are on different sides of the plane
    let hasPositive = false;
    let hasNegative = false;

    for (const corner of corners) {
      const distance = plane.distanceToPoint(corner);
      if (distance > 0.001) hasPositive = true;
      if (distance < -0.001) hasNegative = true;

      // If we have points on both sides, the plane intersects
      if (hasPositive && hasNegative) {
        return true;
      }
    }

    return false;
  }

  private executeSlice(): void {
    // Get the current slice normal from the slice group's orientation
    // PlaneGeometry is created in XY plane with normal pointing along +Z
    const sliceNormal = new THREE.Vector3(0, 0, 1);
    sliceNormal.applyQuaternion(this.sliceGroup.quaternion).normalize();

    // Get slice plane world position
    const sliceWorldPosition = new THREE.Vector3();
    this.sliceGroup.getWorldPosition(sliceWorldPosition);

    // Create a Three.js plane for intersection testing
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(sliceNormal, sliceWorldPosition);

    // Find all objects that intersect the plane
    const objectsToSlice = this.objects.filter((obj) => {
      // Update object's bounding box
      obj.mesh.geometry.computeBoundingBox();
      const boundingBox = obj.mesh.geometry.boundingBox!.clone();

      // Transform bounding box to world space
      boundingBox.applyMatrix4(obj.matrixWorld);

      // Check if the plane intersects the bounding box
      return this.planeIntersectsBox(plane, boundingBox);
    });

    if (objectsToSlice.length === 0) {
      console.log("No objects intersect the slice plane");
      return;
    }

    console.log(`Slicing ${objectsToSlice.length} object(s)`);

    objectsToSlice.forEach((obj) => {
      const sliceOptions = new SliceOptions();
      sliceOptions.enableReslicing = true;
      sliceOptions.maxResliceCount = 10;

      try {
        // Get the physics body before slicing to preserve velocity
        const physicsBody = this.physics.getBody(obj.mesh);
        let linearVelocity = { x: 0, y: 0, z: 0 };
        let angularVelocity = { x: 0, y: 0, z: 0 };

        if (physicsBody) {
          linearVelocity = physicsBody.rigidBody.linvel();
          angularVelocity = physicsBody.rigidBody.angvel();

          // Sync the Group's transform from the mesh's world transform
          // Physics updates obj.mesh, but we need obj (the Group) to have the correct transform
          const worldPosition = new THREE.Vector3();
          const worldQuaternion = new THREE.Quaternion();
          const worldScale = new THREE.Vector3();
          obj.mesh.getWorldPosition(worldPosition);
          obj.mesh.getWorldQuaternion(worldQuaternion);
          obj.mesh.getWorldScale(worldScale);

          obj.position.copy(worldPosition);
          obj.quaternion.copy(worldQuaternion);
          obj.scale.copy(worldScale);

          // Remove physics from the original object before slicing
          this.physics.remove(obj.mesh);
        }

        // Update the object's matrix to ensure accurate transformation
        obj.updateMatrixWorld(true);

        // Transform slice normal and origin to object's local space
        const worldToLocal = new THREE.Matrix4();
        worldToLocal.copy(obj.matrixWorld).invert();

        const localNormal = sliceNormal
          .clone()
          .transformDirection(worldToLocal)
          .normalize();

        // Use the slice group's world position as the origin
        const sliceWorldPosition = new THREE.Vector3();
        this.sliceGroup.getWorldPosition(sliceWorldPosition);

        const localOrigin = sliceWorldPosition
          .clone()
          .applyMatrix4(worldToLocal);

        obj.slice(
          localNormal,
          localOrigin,
          sliceOptions,
          (top, bottom) => {
            // Get the original material from the object being sliced
            const originalMaterial = obj.mesh.material;

            // Setup materials for both pieces
            [top, bottom].forEach((piece) => {
              if (this.settings.wireframe) {
                piece.mesh.material = this.wireframeMaterial;
              } else if (this.settings.primitiveType === "statue") {
                // For statue, extract outer material and use rock inside material
                const outerMaterial = Array.isArray(originalMaterial)
                  ? originalMaterial[0]
                  : originalMaterial;
                piece.mesh.material = [outerMaterial, this.getStatueInsideMaterial()!];
              } else {
                // For regular objects:
                // Note: The slicing library currently doesn't preserve material groups from previous slices.
                // When reslicing, all old geometry goes into group 0 and the new cut face into group 1.
                // This means previous cut faces will render with the outer material after reslicing.
                // To properly fix this would require tracking material indices through the slicing algorithm.
                const outerMaterial = Array.isArray(originalMaterial)
                  ? originalMaterial[0]
                  : originalMaterial;
                piece.mesh.material = [outerMaterial, this.insideMaterial];
              }
              piece.mesh.castShadow = true;

              // Add to scene and tracking
              this.scene.add(piece);
              this.objects.push(piece);

              // Add physics and restore velocity
              this.physics.add(piece.mesh, {
                type: "dynamic",
                collider: "convexHull",
                restitution: 0.3,
              });

              // Apply the original object's velocity to the new pieces
              const newBody = this.physics.getBody(piece.mesh);
              if (newBody) {
                newBody.rigidBody.setLinvel(linearVelocity, true);
                newBody.rigidBody.setAngvel(angularVelocity, true);
              }
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

  private updateWireframe(): void {
    const material = this.settings.wireframe
      ? this.wireframeMaterial
      : [this.objectMaterial, this.insideMaterial];

    // Update all object meshes
    this.objects.forEach((obj) => {
      obj.mesh.material = this.settings.wireframe
        ? this.wireframeMaterial
        : material;
    });
  }

  update(deltaTime: number): void {
    // Guard clause - ensure slice group is initialized
    if (!this.sliceGroup) {
      return;
    }

    // Handle WASD movement (horizontal) and RF (vertical)
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
    if (this.keysPressed.has("r")) {
      movement.y += this.moveSpeed * deltaTime;
    }
    if (this.keysPressed.has("f")) {
      movement.y -= this.moveSpeed * deltaTime;
    }

    // Apply movement
    this.sliceGroup.position.add(movement);
    this.slicePosition.copy(this.sliceGroup.position);

    // Handle QE rotation
    let rotation = 0;
    if (this.keysPressed.has("q")) {
      rotation += this.rotateSpeed * deltaTime;
    }
    if (this.keysPressed.has("e")) {
      rotation -= this.rotateSpeed * deltaTime;
    }

    if (rotation !== 0) {
      // Rotate around the Y axis
      const axis = new THREE.Vector3(0, 1, 0);
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(axis, rotation);

      // Apply rotation to the slice group
      this.sliceGroup.quaternion.premultiply(quaternion);
    }
  }

  getInstructions(): string {
    return `SLICING DEMO

• WASD - Move slicing plane (horizontal)
• R/F - Move slicing plane (up/down)
• Q/E - Rotate plane
• SPACE - Execute slice
• Click objects to apply explosive force
• Slice objects multiple times
• Choose different primitives`;
  }

  setupUI(): any {
    const folder = this.pane.addFolder({
      title: "Slicing Demo",
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
          Statue: "statue",
        },
        label: "Primitive",
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
    seedValueBinding.disabled = !this.settings.useSeed;

    // Update seed value binding when useSeed checkbox changes
    useSeedBinding.on("change", () => {
      seedValueBinding.disabled = !this.settings.useSeed;
    });

    folder.addButton({ title: "Slice (Space)" }).on("click", () => {
      this.executeSlice();
    });

    folder.addButton({ title: "Reset" }).on("click", () => {
      this.reset();
    });

    return folder;
  }

  reset(): void {
    // Clear all physics first
    this.clearPhysics();

    // Remove all objects
    this.objects.forEach((obj) => {
      this.scene.remove(obj);
      obj.dispose();
    });
    this.objects = [];

    // Reset slice plane position and rotation
    this.slicePosition.set(0, 3, 0);
    this.sliceGroup.position.copy(this.slicePosition);
    this.sliceGroup.quaternion.identity();

    // Re-add ground physics
    this.setupGroundPhysics();

    // Create new object
    this.createObject();
  }

  dispose(): void {
    // Remove event listeners
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("click", this.onMouseClick);

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
