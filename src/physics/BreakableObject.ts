import { fracture } from '../fracture/Fracture';
import { Quaternion, Scene } from 'three';
import { PhysicsObject } from './PhysicsObject';
import { FractureOptions } from '../fracture/entities/FractureOptions';
import type * as RAPIER from "@dimforge/rapier3d";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export  class BreakableObject extends PhysicsObject {
  constructor(rigidBody?: RAPIER.RigidBody) {
    super(rigidBody, true);
  }

  /**
   * Fractures this mesh into smaller pieces
   * @param world The physics world object
   * @param objects The list of world objects to add the fragments to
   * @param options Options controlling how to fracture this object
   */
  fracture(RAPIER: RAPIER_API, scene: Scene, world: RAPIER.World, objects: PhysicsObject[], options: FractureOptions) {
    const fragments = fracture(this, options);

    let i = 0;
    fragments.forEach((fragment) => {
      const fragmentObject = new PhysicsObject();
  
      // Use the original object as a template, copying materials
      fragmentObject.name = `${this.name}_${i++}`;
      fragmentObject.geometry = fragment.toGeometry();
      fragmentObject.material = this.material;
      fragmentObject.position.copy(this.position);
      fragmentObject.rotation.copy(this.rotation);
      fragmentObject.scale.copy(this.scale);
      fragmentObject.castShadow = true;
  
      // Create colliders for each fragment
      const vertices = fragmentObject.geometry.getAttribute('position').array as Float32Array;
      const fragmentColliderDesc = RAPIER.ColliderDesc.convexHull(vertices)!
        .setRestitution(0.2);
  
      fragmentObject.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(
          fragmentObject.position.x,
          fragmentObject.position.y,
          fragmentObject.position.z)
        .setRotation(new Quaternion().setFromEuler(fragmentObject.rotation)));
  
      fragmentObject.rigidBody.setAngvel(this.rigidBody!.angvel(), true);
      fragmentObject.rigidBody.setLinvel(this.rigidBody!.linvel(), true);
  
      world.createCollider(fragmentColliderDesc, fragmentObject.rigidBody);
  
      objects.push(fragmentObject);
      scene.add(fragmentObject);

      this.shouldRemove = true;
    });
  }  
}