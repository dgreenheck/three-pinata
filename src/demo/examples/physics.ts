import * as THREE from "three";
import { Pane, FolderApi } from "tweakpane";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PhysicsManager } from "../physics/PhysicsManager";
import { BreakableObject } from "../physics/BreakableObject";
import { FractureOptions } from "three-pinata";
import { Demo } from "../types/Demo";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class PhysicsDemo implements Demo {
  private RAPIER: typeof import("@dimforge/rapier3d");
  private pane: Pane;
  private gltfLoader: GLTFLoader;
  private fractureOptions: FractureOptions;
  private physics: PhysicsManager;
  scene: THREE.Scene;
  private lionModel: THREE.Group;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    pane: Pane,
  ) {
    this.scene = new THREE.Scene();
    this.camera = camera;
    this.controls = controls;
    this.pane = pane;
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
    this.pane.dispose();
  }

  private setupGUI() {
    const demoFolder = this.pane.addFolder({ title: "Demo Settings" });

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
      this.loadScene();
    });
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
