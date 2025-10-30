import * as THREE from "three";
import { Pane } from "tweakpane";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";
import { Demo } from "../types/Demo";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import lionUrl from "../assets/lion.glb";
import stoneColorUrl from "../assets/stone_color.jpg";
import stoneDispUrl from "../assets/stone_disp.jpg";

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
  lion: DestructibleMesh;
  physics: PhysicsWorld;
  scene = new THREE.Scene();
  metalBall: THREE.Mesh;
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
    // Create physics world
    this.physics = new PhysicsWorld(
      this.RAPIER,
      new this.RAPIER.Vector3(0, -2, 0),
    );
    this.physics.onCollision = this.onCollision.bind(this);

    // Load lion model
    this.lionMesh = (await this.gltfLoader.loadAsync(lionUrl)).scene
      .children[0] as THREE.Mesh;

    // Load materials
    const map = new THREE.TextureLoader().load(stoneColorUrl);
    const displacementMap = new THREE.TextureLoader().load(stoneDispUrl);

    this.insideMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.0,
      map,
      bumpMap: displacementMap,
    });

    // Setup camera
    this.camera.position.set(4, 3, 5);
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 2, 0);
    this.controls.autoRotate = false;

    // Setup scene
    this.setupLion();
    this.setupGround();
    this.setupLighting();
    this.setupMetalBall();
  }

  destroy() {
    this.physics.destroy();
  }

  setupGUI(pane: Pane) {
    const demoFolder = pane.addFolder({ title: "Demo Settings" });

    demoFolder.addBinding(this.fractureOptions, "fractureMode", {
      options: {
        Convex: "Convex",
        "Non-Convex": "Non-Convex",
      },
      label: "Fracture Mode",
    });
    demoFolder.addBinding(this.fractureOptions, "fragmentCount", {
      min: 2,
      max: 500,
      step: 1,
    });
    demoFolder
      .addButton({
        title: "Reset",
        label: "Reset",
      })
      .on("click", () => {
        this.resetScene();
      });

    const fracturePlanesFolder = demoFolder.addFolder({
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

    return demoFolder;
  }

  setupLion(): void {
    // Create DestructibleMesh from lion model
    this.lion = new DestructibleMesh(
      this.lionMesh.geometry,
      this.lionMesh.material,
    );

    // Set material properties
    if (this.lion.mesh.material instanceof THREE.MeshStandardMaterial) {
      this.lion.mesh.material.roughness = 0.3;
      this.lion.mesh.material.metalness = 0.2;
    }

    this.lion.mesh.castShadow = true;

    // Add physics to the mesh (not the group)
    const lionBody = this.physics.add(this.lion.mesh, {
      type: "dynamic",
      collider: "convexHull",
    });
    lionBody.sleep();

    // Pre-fracture with freeze
    this.lion.fracture(
      this.fractureOptions,
      true, // freeze
      (fragment) => {
        // Set materials for each fragment
        fragment.material = [
          this.lionMesh.material as THREE.Material,
          this.insideMaterial,
        ];
        fragment.castShadow = true;

        // Add physics to fragment (sleeping)
        const fragmentBody = this.physics.add(fragment, {
          type: "dynamic",
          collider: "convexHull",
          restitution: 0.2,
        });
        fragmentBody.sleep();
      },
    );

    // Add to scene
    this.scene.add(this.lion);
  }

  setupGround(): void {
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // Add physics to ground
    // Create a fixed body at Y=0 with no rotation
    const groundBody = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const rigidBody = this.physics.world.createRigidBody(groundBody);

    // Create a thin cuboid in the XZ plane (200 wide in X, 0.01 tall in Y, 200 deep in Z)
    const groundCollider = this.RAPIER.ColliderDesc.cuboid(100, 0.01, 100);
    this.physics.world.createCollider(groundCollider, rigidBody);
  }

  setupLighting(): void {
    // Add key light
    const keyLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(keyLight);

    // Add fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 1);
    fillLight.position.set(5, 8, 5);
    fillLight.target.position.set(0, 0, 0);
    fillLight.castShadow = true;
    fillLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(fillLight);
  }

  setupMetalBall(): void {
    // Create metal ball
    const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0x0000ff,
      roughness: 0.0,
      metalness: 0.95,
    });

    this.metalBall = new THREE.Mesh(ballGeometry, ballMaterial);
    this.metalBall.castShadow = true;
    this.metalBall.position.set(-20, 5, 10);

    // Add to scene
    this.scene.add(this.metalBall);

    // Add physics to ball
    const ballBody = this.physics.add(this.metalBall, {
      type: "dynamic",
      collider: "ball",
      mass: 3.0,
      restitution: 0.5,
    });

    // Give it initial velocity
    ballBody.setLinearVelocity(new this.RAPIER.Vector3(7, 1.5, -3.5));
  }

  resetScene(): void {
    this.clock = new THREE.Clock();
    this.physics.destroy();
    this.scene.clear();

    this.collisionOccurred = false;

    this.physics = new PhysicsWorld(
      this.RAPIER,
      new this.RAPIER.Vector3(0, -2, 0),
    );
    this.physics.onCollision = this.onCollision.bind(this);

    this.setupLion();
    this.setupGround();
    this.setupLighting();
    this.setupMetalBall();

    this.physics.update();
  }

  async onCollision(body1, body2, started) {
    if (!this.collisionOccurred) {
      // Check if collision involves lion fragments and ball
      const ballBody = this.physics.getBody(this.metalBall);

      // Check if one of the bodies is the ball and the other is a lion fragment
      const isLionFragmentCollision =
        (body2 === ballBody && body1.object.parent === this.lion) ||
        (body1 === ballBody && body2.object.parent === this.lion);

      if (isLionFragmentCollision) {
        console.log("Ball hit lion! Unfreezing...");

        // Remove physics from original lion mesh (if it still has one)
        this.physics.remove(this.lion.mesh);

        // Unfreeze fragments and wake them up
        this.lion.unfreeze(
          (fragment) => {
            const fragmentBody = this.physics.getBody(fragment);
            if (fragmentBody) {
              fragmentBody.wakeUp();
            }
          },
          () => {
            console.log("Lion shattered!");
          },
        );

        this.collisionOccurred = true;
      }
    }
  }

  update(): void {
    this.physics.update();
  }
}
