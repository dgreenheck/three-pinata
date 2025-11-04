import * as THREE from "three";
import { Pane } from "tweakpane";
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
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected physics: PhysicsWorld;
  protected pane: Pane;
  protected controls: OrbitControls;
  protected clock: THREE.Clock;
  protected raycaster: THREE.Raycaster;
  protected mouse: THREE.Vector2;
  protected materialFactory: MaterialFactory;
  protected modelFactory: ModelFactory;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    physics: PhysicsWorld,
    pane: Pane,
    controls: OrbitControls,
    clock: THREE.Clock,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.physics = physics;
    this.pane = pane;
    this.controls = controls;
    this.clock = clock;
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
  abstract setupUI(): any;

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
  ): THREE.MeshStandardMaterial {
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
}
