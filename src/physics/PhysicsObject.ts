import { Mesh, Quaternion } from 'three';
import type * as RAPIER from "@dimforge/rapier3d";

export class PhysicsObject extends Mesh {
  breakable: boolean;
  rigidBody?: RAPIER.RigidBody;
  shouldRemove = false;
  
  constructor(rigidBody?: RAPIER.RigidBody, breakable: boolean = false) {
    super();
    this.rigidBody = rigidBody;
    this.breakable = breakable;
  }

  update() {
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      const q = this.rigidBody.rotation();
      this.position.set(pos.x, pos.y, pos.z);
      this.rotation.setFromQuaternion(new Quaternion(q.x, q.y, q.z, q.w));
    }
  }
}
