import * as THREE from "three";
import type * as RAPIER from "@dimforge/rapier3d";
import { PhysicsBody } from "./PhysicsBody";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export interface PhysicsBodyOptions {
  /** Type of rigid body (dynamic, fixed, kinematic) */
  type?: "dynamic" | "fixed" | "kinematic";
  /** Type of collider to create */
  collider?: "convexHull" | "ball" | "cuboid";
  /** Mass of the body (for dynamic bodies) */
  mass?: number;
  /** Restitution (bounciness) of the collider */
  restitution?: number;
  /** Custom collider descriptor (overrides collider type) */
  colliderDesc?: RAPIER.ColliderDesc;
}

/**
 * Manages a Rapier physics world and provides a clean interface for
 * adding/removing physics to THREE.Object3D instances.
 */
export class PhysicsWorld {
  RAPIER: RAPIER_API;
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;

  /** Maps THREE.Object3D to PhysicsBody */
  private bodies: WeakMap<THREE.Object3D, PhysicsBody>;

  /** Maps rigid body handles to PhysicsBody for collision detection */
  private handleToBodies: Map<number, PhysicsBody>;

  /** Collision callback */
  onCollision?: (
    body1: PhysicsBody,
    body2: PhysicsBody,
    started: boolean,
  ) => void;

  constructor(
    RAPIER: RAPIER_API,
    gravity: RAPIER.Vector3 = new RAPIER.Vector3(0, -9.81, 0),
  ) {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);
    this.bodies = new WeakMap();
    this.handleToBodies = new Map();
  }

  /**
   * Adds physics to a THREE.Object3D
   * @param object The THREE.Object3D to add physics to
   * @param options Physics configuration
   * @returns The created PhysicsBody
   */
  add(object: THREE.Object3D, options: PhysicsBodyOptions = {}): PhysicsBody {
    const {
      type = "dynamic",
      collider = "convexHull",
      mass,
      restitution = 0.2,
      colliderDesc: customColliderDesc,
    } = options;

    // Create rigid body descriptor based on type
    let rigidBodyDesc: RAPIER.RigidBodyDesc;
    switch (type) {
      case "fixed":
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.fixed();
        break;
      case "kinematic":
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased();
        break;
      default:
        rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic();
    }

    // Set initial position and rotation from object (using world transform)
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    object.getWorldPosition(pos);
    object.getWorldQuaternion(quat);
    rigidBodyDesc
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

    // Create rigid body
    const rigidBody = this.world.createRigidBody(rigidBodyDesc);

    // Create collider
    let colliderDesc = customColliderDesc;

    if (!colliderDesc) {
      if (collider === "convexHull" && object instanceof THREE.Mesh) {
        // Validate geometry before creating convex hull
        const geometry = object.geometry;
        const positionAttribute = geometry.getAttribute("position");

        // Check if geometry has enough vertices
        if (!positionAttribute || positionAttribute.count < 4) {
          console.warn(
            "Geometry has insufficient vertices for convex hull, skipping physics",
          );
          this.world.removeRigidBody(rigidBody);
          return null as any; // Return null instead of throwing
        }

        // Check geometry size to avoid degenerate shapes
        if (!geometry.boundingBox) {
          geometry.computeBoundingBox();
        }
        const bbox = geometry.boundingBox;

        // Try to create convex hull with error handling
        try {
          const vertices = positionAttribute.array as Float32Array;
          colliderDesc = this.RAPIER.ColliderDesc.convexHull(vertices);
        } catch (error) {
          console.warn("Error creating convex hull:", error);
          colliderDesc = null;
        }

        if (!colliderDesc) {
          console.warn(
            "Failed to create convex hull collider, falling back to ball",
          );
          // Calculate fallback ball radius from bounding sphere
          if (!object.geometry.boundingSphere) {
            object.geometry.computeBoundingSphere();
          }
          const radius = object.geometry.boundingSphere?.radius || 1;
          const scale = object.getWorldScale(new THREE.Vector3());
          const scaledRadius = radius * Math.max(scale.x, scale.y, scale.z);
          colliderDesc = this.RAPIER.ColliderDesc.ball(scaledRadius);
        }
      } else if (collider === "ball") {
        // Calculate ball radius from mesh bounding sphere
        let radius = 1;
        if (object instanceof THREE.Mesh) {
          if (!object.geometry.boundingSphere) {
            object.geometry.computeBoundingSphere();
          }
          if (object.geometry.boundingSphere) {
            radius = object.geometry.boundingSphere.radius;
            // Account for object scale (use the largest scale component)
            const scale = object.getWorldScale(new THREE.Vector3());
            radius *= Math.max(scale.x, scale.y, scale.z);
          }
        }
        colliderDesc = this.RAPIER.ColliderDesc.ball(radius);
      } else if (collider === "cuboid") {
        colliderDesc = this.RAPIER.ColliderDesc.cuboid(1, 1, 1);
      }
    }

    // Set collider properties
    if (colliderDesc) {
      colliderDesc.setRestitution(restitution);
      if (mass !== undefined) {
        colliderDesc.setMass(mass);
      }

      // Enable collision events
      colliderDesc.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);

      this.world.createCollider(colliderDesc, rigidBody);
    }

    // Create and store PhysicsBody
    const physicsBody = new PhysicsBody(rigidBody, object);
    this.bodies.set(object, physicsBody);
    this.handleToBodies.set(rigidBody.handle, physicsBody);

    return physicsBody;
  }

  /**
   * Removes physics from a THREE.Object3D
   * @param object The object to remove physics from
   */
  remove(object: THREE.Object3D): void {
    const body = this.bodies.get(object);
    if (body) {
      this.handleToBodies.delete(body.handle);
      this.world.removeRigidBody(body.rigidBody);
      this.bodies.delete(object);
    }
  }

  /**
   * Gets the PhysicsBody for a given THREE.Object3D
   * @param object The object to get the body for
   * @returns The PhysicsBody or undefined if not found
   */
  getBody(object: THREE.Object3D): PhysicsBody | undefined {
    return this.bodies.get(object);
  }

  /**
   * Updates the physics simulation and syncs all objects
   */
  update(): void {
    // Step physics
    this.world.step(this.eventQueue);

    // Process collision events
    if (this.onCollision) {
      this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        const body1 = this.handleToBodies.get(handle1);
        const body2 = this.handleToBodies.get(handle2);

        if (body1 && body2 && this.onCollision) {
          this.onCollision(body1, body2, started);
        }
      });
    }

    // Sync all bodies
    this.handleToBodies.forEach((body) => {
      body.sync();
    });
  }

  /**
   * Clears all rigid bodies and colliders from the physics world
   * This is useful for resetting a scene without destroying the world
   */
  clear(): void {
    this.eventQueue.clear();
    this.handleToBodies.clear();
    this.bodies = new WeakMap();

    // Remove all rigid bodies
    this.world.bodies.forEach((body) => {
      this.world.removeRigidBody(body);
    });

    // Remove all colliders
    this.world.colliders.forEach((collider) => {
      this.world.removeCollider(collider, false);
    });
  }

  /**
   * Destroys the physics world and cleans up resources
   */
  destroy(): void {
    this.eventQueue.clear();
    this.handleToBodies.clear();

    this.world.bodies.forEach((body) => {
      this.world.removeRigidBody(body);
    });

    this.world.colliders.forEach((collider) => {
      this.world.removeCollider(collider, false);
    });

    this.world.free();
    this.eventQueue.free();
  }
}
