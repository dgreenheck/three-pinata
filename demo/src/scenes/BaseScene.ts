import * as THREE from "three";
import { Pane } from "tweakpane";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type PrimitiveType =
  | "cube"
  | "sphere"
  | "icosahedron"
  | "cylinder"
  | "torus"
  | "torusKnot";

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
   * Create a primitive mesh with given type
   */
  protected createPrimitive(
    type: PrimitiveType,
    material: THREE.Material,
  ): THREE.Mesh {
    let geometry: THREE.BufferGeometry;

    switch (type) {
      case "cube":
        geometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
        break;
      case "sphere":
        geometry = new THREE.SphereGeometry(1.2, 32, 32);
        break;
      case "icosahedron":
        geometry = new THREE.IcosahedronGeometry(1.2, 0);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(1, 1, 2.5, 32);
        break;
      case "torus":
        geometry = new THREE.TorusGeometry(1, 0.4, 16, 32);
        break;
      case "torusKnot":
        geometry = new THREE.TorusKnotGeometry(0.8, 0.3, 100, 16);
        break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = false;

    return mesh;
  }

  /**
   * Create a standard material with given color
   */
  protected createMaterial(
    color: number = 0x4488ff,
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.1,
      envMapIntensity: 1.0,
    });
  }

  /**
   * Create an inside material for fractured faces
   */
  protected createInsideMaterial(
    color: number = 0xcccccc,
  ): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.0,
    });
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
}
