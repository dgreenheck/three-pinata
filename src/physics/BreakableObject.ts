import { fracture } from "../fracture/Fracture";
import { Quaternion, Scene } from "three";
import { PhysicsObject } from "./PhysicsObject";
import { FractureOptions } from "../fracture/entities/FractureOptions";
import type * as RAPIER from "@dimforge/rapier3d";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export class BreakableObject extends PhysicsObject {
  constructor(rigidBody?: RAPIER.RigidBody) {
    super(rigidBody, true);
  }

  /**
   * Fractures this mesh into smaller pieces
   * @param world The physics world object
   * @param objects The list of world objects to add the fragments to
   * @param options Options controlling how to fracture this object
   */
  fracture(
    RAPIER: RAPIER_API,
    world: RAPIER.World,
    options: FractureOptions,
  ): PhysicsObject[] {
    return fracture(this, options).map((fragment, index) => {
      const obj = new PhysicsObject();

      // Use the original object as a template
      obj.name = `${this.name}_${index++}`;
      obj.geometry = fragment.toGeometry();
      obj.material = this.material;
      obj.castShadow = true;

      // Create a new rigid body using the position/orientation of the original object
      obj.rigidBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(obj.position.x, obj.position.y, obj.position.z)
          .setRotation(new Quaternion().setFromEuler(obj.rotation)),
      );

      // Preserve the velocity of hte original object
      obj.rigidBody.setAngvel(this.rigidBody!.angvel(), true);
      obj.rigidBody.setLinvel(this.rigidBody!.linvel(), true);

      return obj;
    });
  }
}
