import type * as RAPIER from "@dimforge/rapier3d";
import { PhysicsObject } from "./PhysicsObject";

export class BreakableObject extends PhysicsObject {
  constructor(rigidBody?: RAPIER.RigidBody) {
    super(rigidBody, true);
  }
}
