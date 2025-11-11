import * as THREE from "three";
import type * as RAPIER from "@dimforge/rapier3d";

/**
 * Wraps a Rapier rigid body and provides a clean interface for physics operations.
 * Automatically syncs the associated THREE.Object3D with the physics body.
 */
export class PhysicsBody {
  rigidBody: RAPIER.RigidBody;
  object: THREE.Object3D;

  constructor(rigidBody: RAPIER.RigidBody, object: THREE.Object3D) {
    this.rigidBody = rigidBody;
    this.object = object;
  }

  /**
   * Syncs the THREE.Object3D position/rotation from the physics body
   */
  sync(): void {
    const pos = this.rigidBody.translation();
    const rot = this.rigidBody.rotation();

    // If object has a parent, we need to convert world transform to local
    if (this.object.parent) {
      // Create temporary objects for world transform
      const worldPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      const worldQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);

      // Convert to local space
      this.object.parent.worldToLocal(worldPos);
      const parentQuatInverse = new THREE.Quaternion();
      this.object.parent.getWorldQuaternion(parentQuatInverse).invert();
      worldQuat.premultiply(parentQuatInverse);

      this.object.position.copy(worldPos);
      this.object.quaternion.copy(worldQuat);
    } else {
      // No parent, just set directly
      this.object.position.set(pos.x, pos.y, pos.z);
      this.object.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    }
  }

  /**
   * Wakes up the rigid body
   */
  wakeUp(): void {
    this.rigidBody.wakeUp();
  }

  /**
   * Puts the rigid body to sleep
   */
  sleep(): void {
    this.rigidBody.sleep();
  }

  /**
   * Sets the linear velocity of the rigid body
   */
  setLinearVelocity(velocity: RAPIER.Vector3): void {
    this.rigidBody.setLinvel(velocity, true);
  }

  /**
   * Gets the linear velocity of the rigid body
   */
  getLinearVelocity(): RAPIER.Vector3 {
    return this.rigidBody.linvel();
  }

  /**
   * Sets the angular velocity of the rigid body
   */
  setAngularVelocity(velocity: RAPIER.Vector3): void {
    this.rigidBody.setAngvel(velocity, true);
  }

  /**
   * Applies an impulse to the rigid body
   */
  applyImpulse(impulse: RAPIER.Vector3): void {
    this.rigidBody.applyImpulse(impulse, true);
  }

  /**
   * Gets the handle of the rigid body
   */
  get handle(): number {
    return this.rigidBody.handle;
  }

  /**
   * Gets the mass of the rigid body
   */
  mass(): number {
    return this.rigidBody.mass();
  }
}
