import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d";
import { FractureOptions } from "../fracture/entities/FractureOptions";
import { BreakableObject } from "./BreakableObject";
import { PhysicsObject } from "./PhysicsObject";
import { Fragment } from "../fracture/entities/Fragment";

type RAPIER_API = typeof import("@dimforge/rapier3d");

/**
 * Manager for physics simulation, including detecting collision events
 * and fracturing objects as needed
 */
export class PhysicsManager {
  fractureOptions: FractureOptions;
  fractureWorker: Worker;
  RAPIER: RAPIER_API;
  eventQueue: RAPIER.EventQueue;
  scene: THREE.Scene;
  world: RAPIER.World;
  worldObjects: Map<number, PhysicsObject>;

  constructor(
    RAPIER: RAPIER_API,
    scene: THREE.Scene,
    gravity: RAPIER.Vector3 = new RAPIER.Vector3(0, -9.81, 0),
  ) {
    this.RAPIER = RAPIER;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.scene = scene;

    this.world = new RAPIER.World(gravity);
    this.world.integrationParameters.lengthUnit = 0.1;
    this.worldObjects = new Map();

    this.fractureOptions = new FractureOptions();

    this.fractureWorker = new Worker(
      new URL("../fracture/FractureWorker.ts", import.meta.url),
      { type: "module" },
    );

    this.fractureWorker.onmessage = (e) => {
      console.log("onmessage called");
      this.onFractureWorkerComplete(e);
    };
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

    // Handle collisions
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (!started) return;

      // Using the handles from the collision event, find the object that needs to be updated
      const obj1 = this.worldObjects.get(handle1);
      if (obj1 instanceof BreakableObject) {
        console.log(`Fracturing object ${obj1.id}`);
        console.log(performance.now());
        this.fractureWorker.postMessage({
          objectId: obj1.id,
          vertices: obj1.geometry.attributes.position.array as Float32Array,
          normals: obj1.geometry.attributes.normal.array as Float32Array,
          uvs: obj1.geometry.attributes.uv.array as Float32Array,
          indices: obj1.geometry.index?.array as Uint32Array,
          options: this.fractureOptions,
        });
      }

      const obj2 = this.worldObjects.get(handle2);
      if (obj2 instanceof BreakableObject) {
        console.log(`Fracturing object ${obj2.id}`);
        this.fractureWorker.postMessage({
          objectId: obj2.id,
          vertices: obj2.geometry.attributes.position.array as Float32Array,
          normals: obj2.geometry.attributes.normal.array as Float32Array,
          uvs: obj2.geometry.attributes.uv.array as Float32Array,
          indices: obj2.geometry.index?.array as Uint32Array,
          options: this.fractureOptions,
        });
      }
    });

    // Update the position and rotation of each object
    this.worldObjects.forEach((obj) => {
      obj.update();
    });
  }

  /**
   * Callback handler for when the fracture worker is completed
   * @param e
   */
  onFractureWorkerComplete(e: MessageEvent<any>) {
    const objectId = e.data.objectId;
    const obj = this.scene.getObjectById(objectId) as BreakableObject;
    const fragments = e.data.fragments as Fragment[];

    const fragmentObjects = fragments.map((fragment, index) => {
      // Re-attach methods to the fragment object since the web worker strips them off
      Object.setPrototypeOf(fragment, Fragment.prototype);

      const fragmentObj = new PhysicsObject();

      // Use the original object as a template
      fragmentObj.name = `${obj.name}_${index++}`;
      fragmentObj.geometry = fragment.toGeometry();
      fragmentObj.material = obj.material;
      fragmentObj.castShadow = true;

      // Create a new rigid body using the position/orientation of the original object
      fragmentObj.rigidBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(
            fragmentObj.position.x,
            fragmentObj.position.y,
            fragmentObj.position.z,
          )
          .setRotation(new THREE.Quaternion().setFromEuler(obj.rotation)),
      );

      // Preserve the velocity of the original object
      if (obj.rigidBody) {
        fragmentObj.rigidBody.setAngvel(obj.rigidBody.angvel(), true);
        fragmentObj.rigidBody.setLinvel(obj.rigidBody.linvel(), true);
      }

      return fragmentObj;
    });

    // Add the fragments to the scene and the physics world
    this.scene.add(...fragmentObjects);

    // Map the handle for each rigid body to the physics object so we can
    // quickly perform a lookup when handling collision events
    fragmentObjects.forEach((fragment) => {
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
}
