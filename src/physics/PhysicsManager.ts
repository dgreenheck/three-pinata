import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d";
import { FractureOptions } from "../fracture/entities/FractureOptions";
import { BreakableObject } from "./BreakableObject";
import { PhysicsObject } from "./PhysicsObject";

type RAPIER_API = typeof import("@dimforge/rapier3d");

/**
 * Manager for physics simulation, including detecting collision events
 * and fracturing objects as needed
 */
export class PhysicsManager {
  fractureOptions: FractureOptions;
  RAPIER: RAPIER_API;
  eventQueue: RAPIER.EventQueue;
  world: RAPIER.World;
  worldObjects: Map<number, PhysicsObject>;
  private trackedObjects: Map<THREE.Object3D, RAPIER.RigidBody> = new Map();
  private ballColliderHandle: number | null = null;

  constructor(
    RAPIER: RAPIER_API,
    gravity: RAPIER.Vector3 = new RAPIER.Vector3(0, -9.81, 0),
    fractureOptions: FractureOptions = new FractureOptions(),
  ) {
    this.fractureOptions = fractureOptions;
    this.RAPIER = RAPIER;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.world = new RAPIER.World(gravity);

    // Improve physics accuracy by:
    // - Using smaller timesteps for more precise integration
    // - Increasing solver iterations for better constraint solving
    // - Setting appropriate length unit for scene scale
    this.world.integrationParameters.dt = 1 / 120; // Smaller timestep (120Hz)
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.lengthUnit = 0.1;
    this.world.integrationParameters.erp = 0.01; // Error reduction parameter

    this.worldObjects = new Map();
  }

  reset() {
    this.eventQueue.clear();
    this.world = new RAPIER.World(this.world.gravity);

    // Maintain same improved physics parameters after reset
    //this.world.integrationParameters.dt = 1 / 120;
    this.world.integrationParameters.numSolverIterations = 8;
    this.world.integrationParameters.lengthUnit = 0.1;
    this.world.integrationParameters.erp = 0.01;

    this.worldObjects = new Map();
  }

  /**
   * Adds an object to the world
   * @param obj The physics object
   * @param colliderDesc Collider description for the object
   */
  addObject(obj: PhysicsObject, colliderDesc: RAPIER.ColliderDesc) {
    if (obj.rigidBody) {
      this.world.createCollider(colliderDesc, obj.rigidBody);
      this.worldObjects.set(obj.rigidBody.handle, obj);
    }
  }

  /**
   * Removes an object from the world
   * @param obj
   */
  removeObject(obj: PhysicsObject) {
    if (obj.rigidBody) {
      this.world.removeRigidBody(obj.rigidBody);
      this.worldObjects.delete(obj.rigidBody.handle);
    }
  }

  /**
   * Handles fracturing `obj` into fragments and adding those to the scene
   * @param obj The object to fracture
   * @param scene The scene to add the resultant fragments to
   */
  async handleFracture(obj: BreakableObject, scene: THREE.Scene) {
    const fragments = obj.fracture(
      this.RAPIER,
      this.world,
      this.fractureOptions,
    );

    // Add the fragments to the scene and the physics world
    scene.add(...fragments);

    // Map the handle for each rigid body to the physics object so we can
    // quickly perform a lookup when handling collision events
    fragments.forEach((fragment) => {
      // Approximate collider using a convex hull. While fragments may not
      // be convex, non-convex colliders are extremely expensive
      const vertices = fragment.geometry.getAttribute("position")
        .array as Float32Array;
      const colliderDesc =
        RAPIER.ColliderDesc.convexHull(vertices)!.setRestitution(0.2);

      // If unable to generate convex hull, ignore fragment
      if (colliderDesc) {
        this.addObject(fragment, colliderDesc);
      } else {
        console.warn("Failed to generate convex hull for fragment");
      }
    });

    // Remove the original object from the scene and the physics world
    obj.removeFromParent();
    this.removeObject(obj);
  }

  trackMesh(mesh: THREE.Object3D, body: RAPIER.RigidBody) {
    this.trackedObjects.set(mesh, body);
  }

  setBallCollider(collider: RAPIER.Collider) {
    this.ballColliderHandle = collider.handle;
  }

  /**
   * Updates the physics state and handles any collisions
   * @param scene
   */
  update(scene: THREE.Scene) {
    this.world.step(this.eventQueue);

    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;

      if (
        handle1 !== this.ballColliderHandle &&
        handle2 !== this.ballColliderHandle
      ) {
        console.log("not a collision");
        return;
      }

      const obj =
        handle1 === this.ballColliderHandle
          ? this.worldObjects.get(handle2)
          : this.worldObjects.get(handle1);

      if (obj instanceof BreakableObject) {
        this.handleFracture(obj, scene);
      }
    });

    this.worldObjects.forEach((obj) => {
      obj.update();
    });

    this.trackedObjects.forEach((body, mesh) => {
      const position = body.translation();
      const rotation = body.rotation();
      mesh.position.set(position.x, position.y, position.z);
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });
  }
}
