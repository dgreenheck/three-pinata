import * as RAPIER from "@dimforge/rapier3d";
import { FractureOptions } from "@dgreenheck/three-pinata";
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
  onCollision?: (handle1: number, handle2: number, started: boolean) => void;

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

  destroy() {
    this.eventQueue.clear();

    this.world.bodies.forEach((body) => {
      this.world.removeRigidBody(body);
    });

    this.world.colliders.forEach((collider) => {
      this.world.removeCollider(collider, false);
    });

    this.world.free();
    this.eventQueue.free();
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
   * Updates the physics state and handles any collisions
   * @param scene
   */
  update() {
    // Step the physics world
    this.world.step(this.eventQueue);

    // Process collision events from the queue
    if (this.onCollision) {
      this.eventQueue.drainCollisionEvents(this.onCollision);
    }

    // Update the position and rotation of each object
    this.worldObjects.forEach((obj) => {
      obj.update();
    });
  }
}
