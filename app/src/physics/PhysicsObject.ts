import * as THREE from "three";
import type * as RAPIER from "@dimforge/rapier3d";

export class PhysicsObject extends THREE.Mesh {
  rigidBody?: RAPIER.RigidBody;

  update() {
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      const q = this.rigidBody.rotation();
      this.position.set(pos.x, pos.y, pos.z);
      this.rotation.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    }
  }
}
