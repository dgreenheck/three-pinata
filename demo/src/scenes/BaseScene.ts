import * as THREE from "three";
import { Pane, FolderApi } from "tweakpane";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MaterialFactory } from "../materials";
import { ModelFactory, PrimitiveType } from "../models";

export type { PrimitiveType };

/**
 * Base class for all demo scenes
 * Provides common functionality and interface for scene management
 */
export abstract class BaseScene {
  // Common constants for UI options
  protected static readonly PRIMITIVE_OPTIONS = {
    Cube: "cube",
    Sphere: "sphere",
    Cylinder: "cylinder",
    Torus: "torus",
    "Torus Knot": "torusKnot",
    Statue: "statue",
  } as const;

  protected static readonly FRACTURE_METHOD_OPTIONS = {
    "Voronoi (High Quality, Slow)": "Voronoi",
    "Simple (Low Quality, Fast)": "Simple",
  } as const;

  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physics: PhysicsWorld;
  protected pane: Pane;
  protected controls: OrbitControls;
  protected clock: THREE.Clock;
  protected renderer?: THREE.WebGLRenderer;
  protected raycaster: THREE.Raycaster;
  protected mouse: THREE.Vector2;
  protected materialFactory: MaterialFactory;
  protected modelFactory: ModelFactory;
  protected loadingIndicator?: HTMLDivElement;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    physics: PhysicsWorld,
    pane: Pane,
    controls: OrbitControls,
    clock: THREE.Clock,
    renderer?: THREE.WebGLRenderer,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.physics = physics;
    this.pane = pane;
    this.controls = controls;
    this.clock = clock;
    this.renderer = renderer;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.materialFactory = new MaterialFactory();
    this.modelFactory = new ModelFactory();
  }

  /**
   * Initialize the scene - create objects, setup physics, etc.
   */
  abstract init(): Promise<void>;

  /**
   * Update loop called every frame
   * @param deltaTime Time since last frame in seconds
   */
  abstract update(deltaTime: number): void;

  /**
   * Setup UI controls specific to this scene
   * @returns The folder containing scene-specific UI controls
   */
  abstract setupUI(): FolderApi;

  /**
   * Get instructions text for this scene
   */
  abstract getInstructions(): string;

  /**
   * Clean up resources when switching scenes
   */
  abstract dispose(): void;

  /**
   * Reset the scene to initial state
   */
  abstract reset(): void;

  /**
   * Load the statue geometry and material
   */
  protected async loadStatueGeometry(
    forceReload: boolean = false,
  ): Promise<void> {
    await this.modelFactory.loadStatueGeometry(forceReload);
    await this.materialFactory.loadStatueInsideMaterial();
  }

  /**
   * Create a primitive mesh with given type
   */
  protected createPrimitive(
    type: PrimitiveType,
    material: THREE.Material,
  ): THREE.Mesh {
    return this.modelFactory.createPrimitive(type, material);
  }

  /**
   * Create a standard material with given color
   */
  protected createMaterial(
    color: number = 0xa0ffff,
  ): THREE.MeshPhysicalMaterial {
    return this.materialFactory.createStandardMaterial(color);
  }

  /**
   * Create an inside material for fractured faces
   */
  protected createInsideMaterial(
    color: number = 0xcccccc,
  ): THREE.MeshPhysicalMaterial {
    return this.materialFactory.createInsideMaterial(color);
  }

  /**
   * Get the statue inside material (must call loadStatueGeometry first)
   */
  protected getStatueInsideMaterial(): THREE.MeshStandardMaterial | null {
    return this.materialFactory.getStatueInsideMaterial();
  }

  /**
   * Clears the physics world completely - removes all bodies, colliders, and events
   * Should be called at the beginning of reset() to ensure clean state
   */
  protected clearPhysics(): void {
    this.physics.clear();
  }

  /**
   * Re-adds ground collider to physics world
   * Should be called after clearPhysics() to restore ground
   */
  protected setupGroundPhysics(): void {
    const RAPIER = this.physics.RAPIER;
    const groundBody = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const rigidBody = this.physics.world.createRigidBody(groundBody);
    const groundCollider = RAPIER.ColliderDesc.cuboid(100, 0.01, 100);
    this.physics.world.createCollider(groundCollider, rigidBody);
  }

  /**
   * Updates mouse coordinates from a MouseEvent to normalized device coordinates
   */
  protected updateMouseCoordinates(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  /**
   * Shows a subtle loading indicator in the top-right corner
   */
  protected showLoadingIndicator(message: string = "Processing..."): void {
    if (!this.loadingIndicator) {
      this.loadingIndicator = document.createElement("div");
      this.loadingIndicator.style.position = "fixed";
      this.loadingIndicator.style.top = "20px";
      this.loadingIndicator.style.right = "20px";
      this.loadingIndicator.style.padding = "10px 16px";
      this.loadingIndicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      this.loadingIndicator.style.color = "#fff";
      this.loadingIndicator.style.borderRadius = "6px";
      this.loadingIndicator.style.fontSize = "14px";
      this.loadingIndicator.style.fontFamily = "monospace";
      this.loadingIndicator.style.zIndex = "9999";
      this.loadingIndicator.style.pointerEvents = "none";
      this.loadingIndicator.style.display = "flex";
      this.loadingIndicator.style.alignItems = "center";
      this.loadingIndicator.style.gap = "8px";
      this.loadingIndicator.style.transition = "opacity 0.2s";
      document.body.appendChild(this.loadingIndicator);
    }

    // Add a subtle pulsing dot animation
    this.loadingIndicator.innerHTML = `
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #4a9eff; animation: pulse 1.5s ease-in-out infinite;"></div>
      <span>${message}</span>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      </style>
    `;
    this.loadingIndicator.style.opacity = "1";
  }

  /**
   * Hides the loading indicator
   */
  protected hideLoadingIndicator(): void {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.opacity = "0";
      setTimeout(() => {
        if (this.loadingIndicator && this.loadingIndicator.parentElement) {
          this.loadingIndicator.parentElement.removeChild(this.loadingIndicator);
          this.loadingIndicator = undefined;
        }
      }, 200);
    }
  }

  /**
   * Applies a random impulse to a mesh that has physics
   * @param mesh The mesh to apply impulse to
   * @param impulseStrength Base strength of the impulse (default: 5.0)
   */
  protected applyRandomImpulseToMesh(
    mesh: THREE.Mesh,
    impulseStrength: number,
  ): void {
    const body = this.physics.getBody(mesh);
    if (!body) return;

    const mass = body.rigidBody.mass();
    const strength = impulseStrength * mass;
    const randomX = (Math.random() - 0.5) * strength;
    const randomY = strength;
    const randomZ = (Math.random() - 0.5) * strength;

    body.applyImpulse({ x: randomX, y: randomY, z: randomZ });
    body.wakeUp();
  }

  /**
   * Applies an explosive force at a point, affecting all physics bodies within a radius
   * @param center World position of the explosion center
   * @param radius Radius of effect
   * @param strength Base strength of the explosion
   * @param falloff How the force falls off with distance (default: 'linear')
   */
  protected applyExplosiveForce(
    center: THREE.Vector3,
    radius: number,
    strength: number,
    falloff: "linear" | "quadratic" = "linear",
  ): void {
    // Iterate through all rigid bodies in the physics world
    this.physics.world.forEachRigidBody((rigidBody) => {
      const bodyPos = rigidBody.translation();
      const bodyPosition = new THREE.Vector3(bodyPos.x, bodyPos.y, bodyPos.z);

      // Calculate distance from explosion center
      const direction = bodyPosition.clone().sub(center);
      const distance = direction.length();

      // Skip if outside radius
      if (distance > radius || distance < 0.001) return;

      // Calculate force based on distance and falloff
      let forceMagnitude: number;
      if (falloff === "quadratic") {
        // Inverse square falloff
        forceMagnitude =
          strength * (1 - (distance * distance) / (radius * radius));
      } else {
        // Linear falloff
        forceMagnitude = strength * (1 - distance / radius);
      }

      // Scale by mass for consistent effect
      const mass = rigidBody.mass();
      forceMagnitude *= mass;

      // Normalize direction and scale by force magnitude
      direction.normalize().multiplyScalar(forceMagnitude);

      direction.y = Math.sqrt(
        direction.x * direction.x + direction.z * direction.z,
      );

      // Apply impulse
      rigidBody.applyImpulse(
        { x: direction.x, y: direction.y, z: direction.z },
        true,
      );
      rigidBody.wakeUp();
    });
  }

  /**
   * Handles clicking on meshes to apply explosive force at intersection point
   * @param meshes Array of meshes to raycast against
   * @param explosionRadius Radius of the explosion effect
   * @param explosionStrength Base strength of the explosion
   * @returns The intersection point, or null if no hit
   */
  protected handleExplosiveClick(
    meshes: THREE.Mesh[],
    explosionRadius: number = 2.0,
    explosionStrength: number = 10.0,
  ): THREE.Vector3 | null {
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      this.applyExplosiveForce(
        intersectionPoint,
        explosionRadius,
        explosionStrength,
      );
      return intersectionPoint;
    }

    return null;
  }

  /**
   * Cleans up an array of fragments by removing them from the scene and disposing resources
   * @param fragments Array of fragment meshes to clean up
   * @param disposeMaterials Whether to dispose materials (default: true). Set to false if materials are shared.
   */
  protected cleanupFragments(fragments: THREE.Mesh[], disposeMaterials: boolean = true): void {
    fragments.forEach((fragment) => {
      this.scene.remove(fragment);
      fragment.geometry.dispose();
      if (disposeMaterials) {
        if (Array.isArray(fragment.material)) {
          fragment.material.forEach((mat) => mat.dispose());
        } else {
          fragment.material.dispose();
        }
      }
    });
  }

  /**
   * Creates impact and radius marker meshes (hidden by default)
   * @returns Object containing the impact marker and radius marker meshes
   */
  protected createImpactMarkers(): { impact: THREE.Mesh; radius: THREE.Mesh } {
    // Create impact marker (small sphere)
    const markerGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    const impactMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    impactMarker.visible = false;
    this.scene.add(impactMarker);

    // Create radius marker (wireframe sphere)
    const radiusGeometry = new THREE.SphereGeometry(1, 16, 16);
    const radiusMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
    });
    const radiusMarker = new THREE.Mesh(radiusGeometry, radiusMaterial);
    radiusMarker.visible = false;
    this.scene.add(radiusMarker);

    return { impact: impactMarker, radius: radiusMarker };
  }
}
