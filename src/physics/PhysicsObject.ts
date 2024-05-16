import * as THREE from "three";
import type * as RAPIER from "@dimforge/rapier3d";

export class PhysicsObject extends THREE.Mesh {
  breakable: boolean;
  rigidBody?: RAPIER.RigidBody;

  constructor(rigidBody?: RAPIER.RigidBody, breakable: boolean = false) {
    super();
    this.rigidBody = rigidBody;
    this.breakable = breakable;

    // Initialize position of object
    if (this.rigidBody) {
      this.update();
    }
  }

  update() {
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      const q = this.rigidBody.rotation();
      this.position.set(pos.x, pos.y, pos.z);
      this.rotation.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    }
  }
}
