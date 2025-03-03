import * as THREE from "three";
import { Pane } from "tweakpane";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PhysicsManager } from "../physics/PhysicsManager";
import { fracture, FractureOptions } from "three-pinata";
import { Demo } from "../types/Demo";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PhysicsObject } from "../physics/PhysicsObject";

type RAPIER_API = typeof import("@dimforge/rapier3d");

export class PhysicsDemo implements Demo {
  RAPIER: RAPIER_API;

  camera: THREE.PerspectiveCamera;
  clock = new THREE.Clock();
  controls: OrbitControls;
  gltfLoader = new GLTFLoader();
  fractureOptions = new FractureOptions();
  insideMaterial: THREE.Material;
  lionMesh: THREE.Mesh;
  lionObject: PhysicsObject;
  physics: PhysicsManager;
  scene = new THREE.Scene();
  metalBall: PhysicsObject;
  collisionOccurred = false;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    RAPIER: RAPIER_API,
  ) {
    this.camera = camera;
    this.controls = controls;
    this.RAPIER = RAPIER;
  }

  async load() {
    this.physics = new PhysicsManager(
      this.RAPIER,
      new this.RAPIER.Vector3(0, -2, 0),
      this.fractureOptions,
    );
    this.physics.onCollision = this.onCollision.bind(this);

    this.lionMesh = (await this.gltfLoader.loadAsync("public/lion.glb")).scene
      .children[0] as THREE.Mesh;

    const map = new THREE.TextureLoader().load("public/stone_color.jpg");
    const displacementMap = new THREE.TextureLoader().load(
      "public/stone_disp.jpg",
    );

    this.insideMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.0,
      map,
      bumpMap: displacementMap,
    });

    // Position the camera
    this.camera.position.set(5, 4, 6);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 2, 0);
    this.controls.update();

    this.lionObject = this.setupLion();
    this.setupGround();
    this.setupLighting();
    this.setupMetalBall();
  }

  destroy() {
    this.physics.destroy();
  }

  setupGUI(pane: Pane) {
    const demoFolder = pane.addFolder({ title: "Demo Settings" });

    const gravityFolder = demoFolder.addFolder({ title: "Gravity" });
    gravityFolder.addBinding(this.physics.world.gravity, "x", {
      min: -100,
      max: 100,
      step: 0.1,
      label: "X",
    });
    gravityFolder.addBinding(this.physics.world.gravity, "y", {
      min: -100,
      max: 100,
      step: 0.1,
      label: "Y",
    });
    gravityFolder.addBinding(this.physics.world.gravity, "z", {
      min: -100,
      max: 100,
      step: 0.1,
      label: "Z",
    });

    const fractureFolder = demoFolder.addFolder({ title: "Fracture Options" });
    fractureFolder.addBinding(this.fractureOptions, "fractureMode", {
      options: {
        Convex: "Convex",
        "Non-Convex": "Non-Convex",
      },
      label: "Fracture Mode",
    });
    fractureFolder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 2,
      max: 500,
      step: 1,
    });

    const fracturePlanesFolder = fractureFolder.addFolder({
      title: "Fracture Planes",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "x", {
      label: "X",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "y", {
      label: "Y",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "z", {
      label: "Z",
    });

    const resetButton = demoFolder.addButton({
      title: "Reset",
      label: "Reset",
    });

    resetButton.on("click", () => {
      this.resetScene();
    });

    return demoFolder;
  }

  setupLion(): PhysicsObject {
    const lion = new PhysicsObject();
    lion.geometry = this.lionMesh.geometry;
    lion.material = this.lionMesh.material;

    // Cast to MeshStandardMaterial to access roughness and metalness properties
    if (lion.material instanceof THREE.MeshStandardMaterial) {
      lion.material.roughness = 0.3;
      lion.material.metalness = 0.2;
    }

    lion.castShadow = true;

    lion.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    lion.geometry.boundingBox?.getSize(size);

    lion.rigidBody = this.physics.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.dynamic(),
    );
    lion.rigidBody.sleep();

    // Create collider with collision events enabled
    const collider = this.RAPIER.ColliderDesc.convexHull(
      lion.geometry.getAttribute("position").array as Float32Array,
    )!.setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.scene.add(lion);
    this.physics.addObject(lion, collider);

    return lion;
  }

  setupGround(): void {
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    const groundBody = this.physics.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.fixed(),
    );
    this.physics.world.createCollider(
      this.RAPIER.ColliderDesc.cuboid(200, 0.01, 200),
      groundBody,
    );
  }

  setupLighting(): void {
    // Add key light (white spotlight with low intensity)
    const keyLight = new THREE.SpotLight(0xffffff, 20, 20, 1, 1, 1);
    keyLight.position.set(5, 8, 5);
    keyLight.target.position.set(0, 0, 0);
    keyLight.castShadow = true;
    this.scene.add(keyLight);
    this.scene.add(keyLight.target);

    // Add fill light (white spotlight with even lower intensity)
    const fillLight = new THREE.SpotLight(0xffffff, 10, 20, 1, 1, 1);
    fillLight.position.set(5, 8, -5);
    fillLight.target.position.set(0, 0, 0);
    fillLight.castShadow = true;
    this.scene.add(fillLight);
    this.scene.add(fillLight.target);
  }

  setupMetalBall(): void {
    // Create a metal ball
    const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.99,
    });

    this.metalBall = new PhysicsObject();
    this.metalBall.geometry = ballGeometry;
    this.metalBall.material = ballMaterial;
    this.metalBall.castShadow = true;

    // Position the ball to the side of the lion
    this.metalBall.position.set(-30, 10, 0);

    // Create rigid body for the ball
    this.metalBall.rigidBody = this.physics.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.dynamic().setTranslation(-30, 10, 0),
    );

    // Add a collider to the ball with collision events enabled
    const ballCollider = this.RAPIER.ColliderDesc.ball(0.5)
      .setMass(3.0)
      .setRestitution(0.5)
      .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);

    // Add the ball to the scene
    this.scene.add(this.metalBall);

    this.physics.addObject(this.metalBall, ballCollider);

    // Give the ball an initial velocity toward the lion
    this.metalBall.rigidBody.setLinvel(new this.RAPIER.Vector3(10, 0, 0), true);
  }

  /**
   * Handles fracturing `obj` into fragments and adding those to the scene
   * @param obj The object to fracture
   * @param scene The scene to add the resultant fragments to
   */
  async fractureLion(obj: PhysicsObject, scene: THREE.Scene) {
    const fragments = this.createFragments(
      obj,
      this.RAPIER,
      this.fractureOptions,
    );

    // Add the fragments to the scene and the physics world
    scene.add(...fragments);

    // Map the handle for each rigid body to the physics object so we can
    // quickly perform a lookup when handling collision events
    fragments.forEach((fragment) => {
      // Approximate collider using a convex hull. While fragments may not
      // be convex, non-convex colliders are extremely expensive
      const vertices = fragment.geometry.getAttribute("position")
        .array as Float32Array;
      const colliderDesc =
        this.RAPIER.ColliderDesc.convexHull(vertices)!.setRestitution(0.2);

      // If unable to generate convex hull, ignore fragment
      if (colliderDesc) {
        this.physics.addObject(fragment, colliderDesc);
      } else {
        console.warn("Failed to generate convex hull for fragment");
      }
    });

    // Remove the original object from the scene and the physics world
    obj.removeFromParent();
    this.physics.removeObject(obj);
  }

  /**
   * Fractures this mesh into smaller pieces
   * @param RAPIER The RAPIER physics API
   * @param world The physics world object
   * @param options Options controlling how to fracture this object
   */
  createFragments(
    obj: PhysicsObject,
    RAPIER: RAPIER_API,
    options: FractureOptions,
  ): PhysicsObject[] {
    // Call the fracture function to split the mesh into fragments
    return fracture(obj.geometry, options).map((fragment) => {
      const fragmentObj = new PhysicsObject();

      // Use the original object as a template
      fragmentObj.name = `${fragmentObj.name}_fragment`;
      fragmentObj.geometry = fragment;
      fragmentObj.material = [
        obj.material as THREE.Material,
        this.insideMaterial,
      ];
      fragmentObj.castShadow = true;

      // Copy the position/rotation from the original object
      fragmentObj.position.copy(obj.position);
      fragmentObj.rotation.copy(obj.rotation);

      // Create a new rigid body using the position/orientation of the original object
      fragmentObj.rigidBody = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(
            fragmentObj.position.x,
            fragmentObj.position.y,
            fragmentObj.position.z,
          )
          .setRotation(
            new THREE.Quaternion().setFromEuler(fragmentObj.rotation),
          ),
      );

      // Preserve the velocity of the original object
      fragmentObj.rigidBody.setAngvel(fragmentObj.rigidBody!.angvel(), true);
      fragmentObj.rigidBody.setLinvel(fragmentObj.rigidBody!.linvel(), true);

      return fragmentObj;
    });
  }

  resetScene(): void {
    this.clock = new THREE.Clock();
    this.physics.destroy();
    this.scene.clear();

    this.collisionOccurred = false; // Reset collision flag

    this.physics = new PhysicsManager(
      this.RAPIER,
      new this.RAPIER.Vector3(0, -2, 0),
      this.fractureOptions,
    );
    this.physics.onCollision = this.onCollision.bind(this);

    this.lionObject = this.setupLion();
    this.setupGround();
    this.setupLighting();
    this.setupMetalBall(); // Re-add the metal ball

    this.physics.update();
  }

  async onCollision(handle1: number, handle2: number, started: boolean) {
    if (!this.collisionOccurred) {
      // Check if the collision involves the lion and the ball
      if (
        (handle1 === this.lionObject.rigidBody?.handle &&
          handle2 === this.metalBall.rigidBody?.handle) ||
        (handle2 === this.lionObject.rigidBody?.handle &&
          handle1 === this.metalBall.rigidBody?.handle)
      ) {
        console.log("collision");
        await this.fractureLion(this.lionObject, this.scene);
        this.collisionOccurred = true;
      }
    }
  }

  update(): void {
    // Update physics objects
    this.physics.update();
  }
}
