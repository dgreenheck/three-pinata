import * as THREE from "three";
import { Pane } from "tweakpane";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { fracture, FractureOptions } from "three-pinata";
import { Demo } from "../types/Demo";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class ExplodeDemo implements Demo {
  scene = new THREE.Scene();
  materials: THREE.Material[] = [];
  fragments = new THREE.Group();
  fragmentDistance: number = 0;
  animationTime: number = 0;
  isAnimating: boolean = true;
  animationSpeed: number = 0.8;
  baseFragmentDistance: number = 0.3;
  gltfLoader = new GLTFLoader();
  fractureOptions = new FractureOptions();
  skullModel: THREE.Mesh;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
  }

  async load() {
    this.skullModel = (
      await this.gltfLoader.loadAsync("public/human_skull.glb")
    ).scene.children[0] as THREE.Mesh;

    const outerMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.0,
      metalness: 0.9,
      envMapIntensity: 0.3,
    });

    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0x808080,
      envMapIntensity: 1.0,
    });
    this.materials = [outerMaterial, innerMaterial];

    this.scene.add(this.fragments);

    // Position the camera
    this.camera.position.set(0, 0, -5);
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = true;
    this.controls.update();

    // Add directional light from bottom
    const directionalLight1 = new THREE.DirectionalLight(0x0000ff, 10);
    directionalLight1.position.set(4, -1, -4); // Position below the skull
    directionalLight1.lookAt(0, 0, 0); // Point toward the center
    this.scene.add(directionalLight1);

    // Add directional light from bottom
    const directionalLight2 = new THREE.DirectionalLight(0xff0000, 10);
    directionalLight2.position.set(-4, -1, -4); // Position below the skull
    directionalLight2.lookAt(0, 0, 0); // Point toward the center
    this.scene.add(directionalLight2);

    const environment = new THREE.TextureLoader().load(
      "public/golden_bay_4k.jpg",
    );
    environment.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment = environment;

    this.fractureSkull();
  }

  setupGUI(pane: Pane) {
    const demoFolder = pane.addFolder({ title: "Skull Fracture Demo" });

    // Fracture options
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
      label: "Fragment Count",
    });
    fractureFolder
      .addButton({
        title: "Reset",
        label: "Reset",
      })
      .on("click", () => {
        this.fragments.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
          }
        });
        this.fragments.clear();
        this.fractureSkull();
      });

    // Fracture planes
    const fracturePlanesFolder = fractureFolder.addFolder({
      title: "Fracture Planes",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "x", {
      label: "X Plane",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "y", {
      label: "Y Plane",
    });
    fracturePlanesFolder.addBinding(this.fractureOptions.fracturePlanes, "z", {
      label: "Z Plane",
    });

    // Add animation controls
    const animationFolder = demoFolder.addFolder({ title: "Animation" });
    animationFolder
      .addBinding(this, "isAnimating", {
        label: "Animate",
      })
      .on("change", () => {
        this.animationTime = 0;
      });

    animationFolder.addBinding(this, "animationSpeed", {
      min: 0.1,
      max: 1,
      step: 0.1,
      label: "Speed",
    });

    // Update fragment distance slider to store base distance
    animationFolder
      .addBinding(this, "fragmentDistance", {
        min: 0,
        max: 1,
        step: 0.01,
        label: "Fragment Distance",
      })
      .on("change", () => {
        this.updateFragmentPositions();
      });

    return demoFolder;
  }

  update(dt: number): void {
    this.animationTime += dt * this.animationSpeed;
    if (this.isAnimating) {
      // Create a pulsing effect using quadratic easing
      // t is normalized between 0 and 1 for each cycle
      const t = this.animationTime;
      // Quadratic ease in-out: t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2
      const easeValue = Math.pow(Math.sin(t), 2);
      this.fragmentDistance = this.baseFragmentDistance * easeValue;
      this.updateFragmentPositions();
    }
  }

  fractureSkull() {
    this.skullModel.traverse((obj) => {
      if ("isMesh" in obj && obj.isMesh) {
        const skullMesh = obj as THREE.Mesh;
        skullMesh.castShadow = true;

        const fragmentGeometries = fracture(
          skullMesh.geometry,
          this.fractureOptions,
        );

        fragmentGeometries.forEach((fragment) => {
          const mesh = new THREE.Mesh(fragment, this.materials);

          fragment.computeBoundingBox();
          const center = new THREE.Vector3();
          fragment.boundingBox!.getCenter(center);

          mesh.userData.direction = center.normalize();
          mesh.castShadow = true;

          this.fragments.add(mesh);
        });
      }
    });

    // Apply the fragment distance
    this.updateFragmentPositions();
  }

  updateFragmentPositions() {
    // Move each fragment away from the center based on the fragment distance
    this.fragments.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        mesh.position.set(
          mesh.userData.direction.x * this.fragmentDistance,
          mesh.userData.direction.y * this.fragmentDistance,
          mesh.userData.direction.z * this.fragmentDistance,
        );
      }
    });
  }

  destroy() {
    this.fragments.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    this.fragments.clear();
  }
}
