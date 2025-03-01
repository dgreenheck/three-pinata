import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PhysicsManager } from "../physics/PhysicsManager";
import { BreakableObject } from "../physics/BreakableObject";
import { FractureOptions } from "three-pinata";
import { Demo } from "../types/Demo";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class PhysicsDemo implements Demo {
  private RAPIER: typeof import("@dimforge/rapier3d");
  private gui: GUI;
  private gltfLoader: GLTFLoader;
  private fractureOptions: FractureOptions;
  private physics: PhysicsManager;
  scene: THREE.Scene;
  private lionModel: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.scene = new THREE.Scene();
    this.camera = camera;
    this.controls = controls;
    this.gui = new GUI();
    this.gltfLoader = new GLTFLoader();
    this.fractureOptions = new FractureOptions();
  }

  async initialize() {
    this.RAPIER = await import("@dimforge/rapier3d");
    this.physics = new PhysicsManager(
      this.RAPIER,
      new this.RAPIER.Vector3(0, -10, 0),
      this.fractureOptions,
    );
    this.lionModel = (await this.gltfLoader.loadAsync("public/lion.glb")).scene;

    // Position the camera
    this.camera.position.set(-50, 40, 50);
    this.controls.target.set(0, 10, 0);
    this.controls.update();

    this.setupGUI();
  }

  destroy() {
    this.gui.destroy();
  }

  private setupGUI() {
    const gravityFolder = this.gui.addFolder("Gravity");
    gravityFolder
      .add(this.physics.world.gravity, "x", -100, 100, 0.1)
      .name("X");
    gravityFolder
      .add(this.physics.world.gravity, "y", -100, 100, 0.1)
      .name("Y");
    gravityFolder
      .add(this.physics.world.gravity, "z", -100, 100, 0.1)
      .name("Z");

    const fractureFolder = this.gui.addFolder("Fracture Options");
    fractureFolder
      .add(this.fractureOptions, "fractureMode", ["Convex", "Non-Convex"])
      .name("Fracture Mode");
    fractureFolder.add(this.fractureOptions, "fragmentCount", 2, 500, 1);

    const fracturePlanesFolder = fractureFolder.addFolder("Fracture Planes");
    fracturePlanesFolder
      .add(this.fractureOptions.fracturePlanes, "x")
      .name("X");
    fracturePlanesFolder
      .add(this.fractureOptions.fracturePlanes, "y")
      .name("Y");
    fracturePlanesFolder
      .add(this.fractureOptions.fracturePlanes, "z")
      .name("Z");

    this.gui
      .add({ loadScene: () => this.loadScene() }, "loadScene")
      .name("Reset");
  }

  resetScene() {
    this.scene.clear();
    this.physics.reset();

    this.lionModel.traverse((obj) => {
      if ("isMesh" in obj && obj.isMesh) {
        const lion = new BreakableObject();

        const mesh = obj as THREE.Mesh;
        lion.geometry = mesh.geometry;
        lion.material = mesh.material;
        lion.castShadow = true;

        lion.geometry.computeBoundingBox();
        const size = new THREE.Vector3();
        lion.geometry.boundingBox?.getSize(size);

        const colliderDesc = this.RAPIER.ColliderDesc.cuboid(1, 1, 1)
          .setRestitution(0)
          .setActiveEvents(this.RAPIER.ActiveEvents.COLLISION_EVENTS);

        lion.rigidBody = this.physics.world.createRigidBody(
          this.RAPIER.RigidBodyDesc.dynamic().setTranslation(
            0,
            size.y / 2 + 1,
            0,
          ),
        );

        this.scene.add(lion);
        this.physics.addObject(lion, colliderDesc);
      }
    });

    // Create a ground plane
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
    const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // Add ground plane to Rapier world
    const groundBody = this.physics.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.fixed(),
    );
    this.physics.world.createCollider(
      this.RAPIER.ColliderDesc.cuboid(200, 0.01, 200),
      groundBody,
    );

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight();
    sun.intensity = 3;
    sun.position.set(-10, 10, 10);
    sun.castShadow = true;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);
  }

  async loadScene(): Promise<THREE.Scene> {
    this.resetScene();
    return this.scene;
  }

  update(): void {
    this.physics.update(this.scene);
  }
}
