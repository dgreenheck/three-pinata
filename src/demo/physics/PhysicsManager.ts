import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d";
import { FractureOptions } from "three-pinata";
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

  constructor(
    RAPIER: RAPIER_API,
    gravity: RAPIER.Vector3 = new RAPIER.Vector3(0, -9.81, 0),
    fractureOptions: FractureOptions = new FractureOptions(),
  ) {
    this.fractureOptions = fractureOptions;
    this.RAPIER = RAPIER;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.world = new RAPIER.World(gravity);
    this.world.integrationParameters.lengthUnit = 0.1;
    this.worldObjects = new Map();
  }

  reset() {
    this.eventQueue.clear();
    this.world = new RAPIER.World(this.world.gravity);
    this.world.integrationParameters.lengthUnit = 0.1;
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

  /**
   * Updates the physics state and handles any collisions
   * @param scene
   */
  update(scene: THREE.Scene) {
    // Step the physics world
    this.world.step(this.eventQueue);

    // Handle collisions
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;

      // Using the handles from the collision event, find the object that needs to be updated
      const obj1 = this.worldObjects.get(handle1);
      if (obj1 instanceof BreakableObject) {
        this.handleFracture(obj1, scene);
      }

      const obj2 = this.worldObjects.get(handle2);
      if (obj2 instanceof BreakableObject) {
        this.handleFracture(obj2, scene);
      }
    });

    // Update the position and rotation of each object
    this.worldObjects.forEach((obj) => {
      obj.update();
    });
  }
}
