import { FractureOptions } from '../fracture/entities/FractureOptions';
import { BreakableObject } from './BreakableObject';
import { PhysicsObject } from './PhysicsObject';
import { Scene } from 'three';
import type * as RAPIER from "@dimforge/rapier3d";

type RAPIER_API = typeof import("@dimforge/rapier3d");

const fractureOptions = new FractureOptions();

export class PhysicsManager {
  eventQueue: RAPIER.EventQueue;
  world: RAPIER.World;
  worldObjects: PhysicsObject[] = [];
  
  constructor(RAPIER: RAPIER_API, gravity: RAPIER.Vector3 = new RAPIER.Vector3(0, -9.81, 0)) {
    this.eventQueue = new RAPIER.EventQueue(true);
    this.world = new RAPIER.World(gravity);
    this.world.integrationParameters.lengthUnit = 0.1;
    this.worldObjects = [];
  }

  update(RAPIER: RAPIER_API, scene: Scene) {
    const fracture = (obj: BreakableObject) => {
      obj.fracture(RAPIER, scene, this.world, this.worldObjects, fractureOptions);
      this.worldObjects = this.worldObjects.filter((o) => o.rigidBody?.handle !== obj.rigidBody?.handle);
      scene.remove(obj);
      this.world.removeRigidBody(obj.rigidBody!);
    }

    // Step the physics world
    this.world.step(this.eventQueue);

    // Handle collisions
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;

      const obj1 = this.worldObjects.find((obj) => obj.rigidBody?.handle === handle1);
      if (obj1 instanceof BreakableObject) {
        fracture(obj1);
      }

      const obj2 = this.worldObjects.find((obj) => obj.rigidBody?.handle === handle2);
      if (obj2 instanceof BreakableObject) {
        fracture(obj2);
      }
    });

    // Update the position and rotation of each object
    this.worldObjects.forEach((obj) => {
      obj.update()
    });
  }
}