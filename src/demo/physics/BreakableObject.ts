import * as THREE from "three";
import type * as RAPIER from "@dimforge/rapier3d";
import { fracture, FractureOptions } from "three-pinata";
import { PhysicsObject } from "./PhysicsObject";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export class BreakableObject extends PhysicsObject {
  constructor(rigidBody?: RAPIER.RigidBody) {
    super(rigidBody, true);
  }

  /**
   * Fractures this mesh into smaller pieces
   * @param RAPIER The RAPIER physics API
   * @param world The physics world object
   * @param options Options controlling how to fracture this object
   */
  fracture(
    RAPIER: RAPIER_API,
    world: RAPIER.World,
    options: FractureOptions,
  ): PhysicsObject[] {
    // Call the fracture function to split the mesh into fragments
    return fracture(this.geometry, options).map((fragment) => {
      const obj = new PhysicsObject();

      // Use the original object as a template
      obj.name = `${this.name}_fragment`;
      obj.geometry = fragment;
      obj.material = this.material;
      obj.castShadow = true;

      // Copy the position/rotation from the original object
      obj.position.copy(this.position);
      obj.rotation.copy(this.rotation);

      // Create a new rigid body using the position/orientation of the original object
      obj.rigidBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(obj.position.x, obj.position.y, obj.position.z)
          .setRotation(new THREE.Quaternion().setFromEuler(obj.rotation)),
      );

      // Preserve the velocity of the original object
      obj.rigidBody.setAngvel(this.rigidBody!.angvel(), true);
      obj.rigidBody.setLinvel(this.rigidBody!.linvel(), true);

      return obj;
    });
  }
}
