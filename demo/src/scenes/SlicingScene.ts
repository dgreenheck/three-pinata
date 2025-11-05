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

  private settings = {
    primitiveType: "sphere" as PrimitiveType,
  };

  // Drawing slice properties
  private isDrawingSlice = false;
  private sliceStartScreen = new THREE.Vector2();
  private sliceEndScreen = new THREE.Vector2();
  private resetButton: any = null;

  // Canvas overlay for drawing
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  async init(): Promise<void> {
    // Setup camera
    this.camera.position.set(4, 3, -3);
    this.controls.target.set(0, 1, 0);
    this.controls.enablePan = false; // Disable panning
    this.controls.mouseButtons = {
      LEFT: undefined,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    this.controls.update();

    // Create materials
    this.objectMaterial = this.createMaterial(0x9944ff);
    this.insideMaterial = this.createInsideMaterial(0xdddddd);

    // Load statue geometry if needed
    await this.loadStatueGeometry();

    // Create initial object first
    this.createObject();

    // Create canvas overlay for drawing
    this.createCanvasOverlay();

    // Add pointer event listeners
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
  }

  private createCanvasOverlay(): void {
    if (!this.renderer) {
      console.warn("Renderer not available, canvas overlay disabled");
      return;
    }

    // Create a canvas that overlays the WebGL canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "1000";

    // Get the renderer's canvas to match its size
    const rendererCanvas = this.renderer.domElement;
    this.canvas.width = rendererCanvas.width;
    this.canvas.height = rendererCanvas.height;
    this.canvas.style.width = rendererCanvas.style.width;
    this.canvas.style.height = rendererCanvas.style.height;

    // Insert the canvas after the renderer canvas
    rendererCanvas.parentElement?.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d")!;

    // Handle window resize
    window.addEventListener("resize", this.onWindowResize);
  }

  private onWindowResize = (): void => {
    if (this.canvas && this.renderer) {
      const rendererCanvas = this.renderer.domElement;
      this.canvas.width = rendererCanvas.width;
      this.canvas.height = rendererCanvas.height;
      this.canvas.style.width = rendererCanvas.style.width;
      this.canvas.style.height = rendererCanvas.style.height;
    }
  };

  private createObject(): void {
    // Create the primitive
    const mesh = this.createPrimitive(
      this.settings.primitiveType,
      this.objectMaterial,
    );

    // Use the mesh's material (which may be the statue's original material)
    const materialToUse = mesh.material;

    const destructibleMesh = new DestructibleMesh(mesh.geometry, materialToUse);
    destructibleMesh.castShadow = true;

    // Calculate height so object sits on ground
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox!;
    const height = -boundingBox.min.y; // Offset by the bottom of the bounding box

    destructibleMesh.position.set(0, height, 0);
    this.scene.add(destructibleMesh);
    this.objects.push(destructibleMesh);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.renderer) return;

    // Allow right click for camera rotation
    if (event.button === 2) {
      this.controls.enabled = true;
      return;
    }

    // Ignore if not left click
    if (event.button !== 0) return;

    // Start drawing slice from anywhere on screen
    this.isDrawingSlice = true;

    // Store screen coordinates
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.sliceStartScreen.set(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
    this.sliceEndScreen.copy(this.sliceStartScreen);

    // Disable orbit controls while drawing
    this.controls.enabled = false;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isDrawingSlice || !this.renderer) return;

    // Prevent default to avoid scrolling on mobile
    event.preventDefault();

    // Update end position
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.sliceEndScreen.set(
      event.clientX - rect.left,
      event.clientY - rect.top,
    );

    // Draw the slice line on canvas
    this.drawSliceLine();
  };

  private onPointerUp = (): void => {
    if (!this.isDrawingSlice || !this.ctx) return;

    this.isDrawingSlice = false;
    this.controls.enabled = true;

    // Check if the line is long enough (avoid accidental clicks)
    const screenDistance = this.sliceStartScreen.distanceTo(
      this.sliceEndScreen,
    );
    if (screenDistance > 20) {
      // 20 pixels minimum
      this.executeDrawnSlice();
    }

    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  };

  private drawSliceLine(): void {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the slice line with glow effect
    const dpr = window.devicePixelRatio || 1;

    // Draw glow
    this.ctx.strokeStyle = "rgba(255, 50, 50, 0.3)";
    this.ctx.lineWidth = 12 * dpr;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(
      this.sliceStartScreen.x * dpr,
      this.sliceStartScreen.y * dpr,
    );
    this.ctx.lineTo(this.sliceEndScreen.x * dpr, this.sliceEndScreen.y * dpr);
    this.ctx.stroke();

    // Draw main line
    this.ctx.strokeStyle = "rgba(255, 20, 20, 0.9)";
    this.ctx.lineWidth = 4 * dpr;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(
      this.sliceStartScreen.x * dpr,
      this.sliceStartScreen.y * dpr,
    );
    this.ctx.lineTo(this.sliceEndScreen.x * dpr, this.sliceEndScreen.y * dpr);
    this.ctx.stroke();

    // Draw bright core
    this.ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    this.ctx.lineWidth = 2 * dpr;
    this.ctx.beginPath();
    this.ctx.moveTo(
      this.sliceStartScreen.x * dpr,
      this.sliceStartScreen.y * dpr,
    );
    this.ctx.lineTo(this.sliceEndScreen.x * dpr, this.sliceEndScreen.y * dpr);
    this.ctx.stroke();
  }

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

  private executeDrawnSlice(): void {
    if (!this.renderer) return;

    // Convert screen coordinates to NDC
    const rect = this.renderer.domElement.getBoundingClientRect();
    const startNDC = new THREE.Vector2(
      (this.sliceStartScreen.x / rect.width) * 2 - 1,
      -(this.sliceStartScreen.y / rect.height) * 2 + 1,
    );
    const endNDC = new THREE.Vector2(
      (this.sliceEndScreen.x / rect.width) * 2 - 1,
      -(this.sliceEndScreen.y / rect.height) * 2 + 1,
    );

    // Unproject to get 3D points on near plane
    const startNear = new THREE.Vector3(startNDC.x, startNDC.y, -1).unproject(
      this.camera,
    );
    const endNear = new THREE.Vector3(endNDC.x, endNDC.y, -1).unproject(
      this.camera,
    );

    // Get the view rays (these account for perspective)
    const startViewDir = new THREE.Vector3()
      .subVectors(startNear, this.camera.position)
      .normalize();
    const endViewDir = new THREE.Vector3()
      .subVectors(endNear, this.camera.position)
      .normalize();

    // Find intersection with objects or use default depth
    const startRay = new THREE.Ray(this.camera.position, startViewDir);
    const endRay = new THREE.Ray(this.camera.position, endViewDir);

    this.raycaster.ray = startRay;
    const startIntersects = this.raycaster.intersectObjects(
      this.objects,
      false,
    );

    this.raycaster.ray = endRay;
    const endIntersects = this.raycaster.intersectObjects(this.objects, false);

    // Determine slice points in 3D
    let sliceStart: THREE.Vector3;
    let sliceEnd: THREE.Vector3;

    if (startIntersects.length > 0 && endIntersects.length > 0) {
      sliceStart = startIntersects[0].point;
      sliceEnd = endIntersects[0].point;
    } else if (startIntersects.length > 0) {
      sliceStart = startIntersects[0].point;
      sliceEnd = endRay.at(startIntersects[0].distance, new THREE.Vector3());
    } else if (endIntersects.length > 0) {
      sliceEnd = endIntersects[0].point;
      sliceStart = startRay.at(endIntersects[0].distance, new THREE.Vector3());
    } else {
      // Use average distance to objects
      let avgDist = 5;
      if (this.objects.length > 0) {
        avgDist = this.camera.position.distanceTo(this.objects[0].position);
      }
      sliceStart = startRay.at(avgDist, new THREE.Vector3());
      sliceEnd = endRay.at(avgDist, new THREE.Vector3());
    }

    // The slice line in 3D (this is the line on the screen in world space)
    const sliceLine = new THREE.Vector3()
      .subVectors(sliceEnd, sliceStart)
      .normalize();

    // For "straight into screen", we need the average view direction of the slice line
    // This accounts for perspective - the direction changes across the screen
    const midViewDir = new THREE.Vector3()
      .addVectors(startViewDir, endViewDir)
      .normalize();

    // The plane normal is perpendicular to both the slice line and the view direction
    // This makes the plane go "straight into the screen" from the drawn line
    const sliceNormal = new THREE.Vector3()
      .crossVectors(sliceLine, midViewDir)
      .normalize();

    // Origin is the midpoint of the slice line
    const sliceOrigin = new THREE.Vector3()
      .addVectors(sliceStart, sliceEnd)
      .multiplyScalar(0.5);

    // Find all objects that intersect the plane
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      sliceNormal,
      sliceOrigin,
    );
    const objectsToSlice = this.objects.filter((obj) => {
      obj.geometry.computeBoundingBox();
      const boundingBox = obj.geometry.boundingBox!.clone();
      boundingBox.applyMatrix4(obj.matrixWorld);
      return this.planeIntersectsBox(plane, boundingBox);
    });

    if (objectsToSlice.length === 0) {
      return;
    }

    // Configure slice options
    const sliceOptions = new SliceOptions();

    // Disable reset button and show slicing message
    if (this.resetButton) {
      this.resetButton.disabled = true;
      this.resetButton.title = "Slicing...";
    }

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      objectsToSlice.forEach((obj) => {
        try {
          // Preserve the original object's material
          // If it's an array (from previous slice), get the first element (outer material)
          const originalMaterial = Array.isArray(obj.material)
            ? obj.material[0]
            : obj.material;

          // Get the physics body of the original object (if it exists)
          const originalBody = this.physics.getBody(obj);
          let linearVel = { x: 0, y: 0, z: 0 };
          let angularVel = { x: 0, y: 0, z: 0 };

          if (originalBody) {
            // Store the velocities before removing physics
            linearVel = originalBody.rigidBody.linvel();
            angularVel = originalBody.rigidBody.angvel();
            // Remove physics from original object before slicing
            this.physics.remove(obj);
          }

          // Slice using world-space coordinates
          const pieces = obj.sliceWorld(
            sliceNormal,
            sliceOrigin,
            sliceOptions,
            (piece) => {
              // Set material (preserve original + inside material for cut face)
              // Use statue inside material for statue, regular inside material for others
              const insideMat =
                this.settings.primitiveType === "statue"
                  ? this.getStatueInsideMaterial()!
                  : this.insideMaterial;
              // Use original material for outer surface, inside material for cut face
              piece.material = [originalMaterial, insideMat];

              // Add physics
              const body = this.physics.add(piece, {
                type: "dynamic",
                restitution: 0.1,
              });

              // Inherit velocity from the original object
              if (body && originalBody) {
                body.setLinearVelocity(linearVel);
                body.setAngularVelocity(angularVel);
              }
            },
            () => {
              // Cleanup original object
              this.scene.remove(obj);
              const index = this.objects.indexOf(obj);
              if (index > -1) {
                this.objects.splice(index, 1);
              }
              obj.dispose();
            },
          );

          // Add pieces to scene and track them
          pieces.forEach((piece) => {
            this.scene.add(piece);
            this.objects.push(piece);
          });
        } catch (error) {
          console.warn("Could not slice object:", error);
        }
      });

      // Re-enable reset button
      if (this.resetButton) {
        this.resetButton.disabled = false;
        this.resetButton.title = "Reset";
      }
    }, 10);
  }

  update(): void {
    // No continuous updates needed
  }

  getInstructions(): string {
    return `SLICING DEMO

• Left click and drag to slice
• Right click and drag to rotate camera
• Scroll to zoom
• Works like Fruit Ninja!`;
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

    this.resetButton = folder.addButton({ title: "Reset" }).on("click", () => {
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

    // Clear canvas if exists
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.isDrawingSlice = false;

    // Re-add ground physics
    this.setupGroundPhysics();

    // Create new object
    this.createObject();
  }

  dispose(): void {
    // Restore default orbit controls
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.enablePan = true;

    // Remove event listeners
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("resize", this.onWindowResize);

    // Remove all objects
    this.objects.forEach((obj) => {
      this.scene.remove(obj);
      this.physics.remove(obj);
      obj.dispose();
    });
    this.objects = [];

    // Remove canvas overlay
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
