import * as THREE from "three";
import { Pane } from "tweakpane";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PhysicsWorld } from "./physics/PhysicsWorld";
import {
  DestructibleMesh,
  VoronoiFractureOptions,
} from "@dgreenheck/three-pinata";

// Add imports for postprocessing
import { EffectComposer, RenderPass } from "postprocessing";

import lionUrl from "./assets/lion.glb";
import stoneColorUrl from "./assets/stone_color.jpg";
import stoneDispUrl from "./assets/stone_disp.jpg";
import gridUrl from "./assets/grid.png";

const RAPIER = await import("@dimforge/rapier3d");

// Scene setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x707070, 50, 80);

const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x707070);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

// Set up post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = false;
controls.autoRotateSpeed = 10;
controls.enableZoom = true;
controls.dampingFactor = 0.25;
controls.enablePan = true;

// Physics and scene objects
const gltfLoader = new GLTFLoader();
const fractureOptions = new VoronoiFractureOptions();
let physics: PhysicsWorld;
let lion: DestructibleMesh;
let lionMesh: THREE.Mesh;
let insideMaterial: THREE.Material;
let metalBall: THREE.Mesh;
let collisionOccurred = false;

// Get fragment count display element
const fragmentCountElement = document.getElementById("fragment-count")!;

// Create GUI
const pane = new Pane();
pane.title = "three-pinata";

// Style the Tweakpane element
const tweakpaneElement = pane.element;
tweakpaneElement.parentElement!.style.width = "300px";

// Setup GUI controls
const demoFolder = pane.addFolder({ title: "Demo Settings" });

demoFolder.addBinding(fractureOptions, "fractureMode", {
  options: {
    Convex: "Convex",
    "Non-Convex": "Non-Convex",
  },
  label: "Fracture Mode",
});

demoFolder
  .addBinding(fractureOptions, "fragmentCount", {
    min: 2,
    max: 1024,
    step: 1,
  })
  .on("change", () => {
    fragmentCountElement.textContent =
      fractureOptions.fragmentCount.toString() + " FRAGMENTS";
  });

demoFolder.addBinding(fractureOptions, "mode", {
  options: {
    "3D": "3D",
    "2.5D": "2.5D",
  },
  label: "Mode",
});

demoFolder.addBinding(fractureOptions, "detectIsolatedFragments", {
  label: "Detect Isolated Fragments",
});

demoFolder
  .addButton({
    title: "Reset",
    label: "Reset",
  })
  .on("click", () => {
    resetScene();
  });

// Add a separator to the GUI
pane.addBlade({ view: "separator" });

// Initialize scene
async function init() {
  // Create physics world
  physics = new PhysicsWorld(RAPIER, new RAPIER.Vector3(0, -2, 0));
  physics.onCollision = onCollision;

  // Load lion model
  lionMesh = (await gltfLoader.loadAsync(lionUrl)).scene
    .children[0] as THREE.Mesh;

  // Load materials
  const map = new THREE.TextureLoader().load(stoneColorUrl);
  const displacementMap = new THREE.TextureLoader().load(stoneDispUrl);

  insideMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.3,
    metalness: 0.0,
    map,
    bumpMap: displacementMap,
  });

  // Setup camera
  camera.position.set(5, 3, 7);
  camera.updateProjectionMatrix();
  controls.target.set(2, 2, 0);

  // Setup scene
  setupLion();
  setupGround();
  setupLighting();
  setupMetalBall();

  // Start animation loop
  renderer.setAnimationLoop(animate);
}

function setupLion(): void {
  // Create DestructibleMesh from lion model
  lion = new DestructibleMesh(lionMesh.geometry, lionMesh.material);

  // Set material properties
  if (lion.mesh.material instanceof THREE.MeshStandardMaterial) {
    lion.mesh.material.roughness = 0.3;
    lion.mesh.material.metalness = 0.1;
  }

  lion.mesh.castShadow = true;

  // Add physics to the mesh (not the group)
  const lionBody = physics.add(lion.mesh, {
    type: "dynamic",
    collider: "convexHull",
  });
  lionBody.sleep();

  // Pre-fracture with freeze
  lion.fracture(
    fractureOptions,
    true, // freeze
    (fragment) => {
      // Set materials for each fragment
      fragment.material = [lionMesh.material as THREE.Material, insideMaterial];
      fragment.castShadow = true;

      // Add physics to fragment (sleeping)
      const fragmentBody = physics.add(fragment, {
        type: "dynamic",
        collider: "convexHull",
        restitution: 0.2,
      });
      fragmentBody.sleep();
    },
  );

  // Add to scene
  scene.add(lion);
}

function setupGround(): void {
  // Load grid texture
  const gridTexture = new THREE.TextureLoader().load(gridUrl);
  gridTexture.colorSpace = THREE.SRGBColorSpace;
  gridTexture.wrapS = THREE.RepeatWrapping;
  gridTexture.wrapT = THREE.RepeatWrapping;
  gridTexture.repeat.set(20, 20);

  const planeGeometry = new THREE.PlaneGeometry(200, 200);
  const planeMaterial = new THREE.MeshStandardMaterial({
    map: gridTexture,
    roughness: 0.8,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // Add physics to ground
  // Create a fixed body at Y=0 with no rotation
  const groundBody = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
  const rigidBody = physics.world.createRigidBody(groundBody);

  // Create a thin cuboid in the XZ plane (200 wide in X, 0.01 tall in Y, 200 deep in Z)
  const groundCollider = RAPIER.ColliderDesc.cuboid(100, 0.01, 100);
  physics.world.createCollider(groundCollider, rigidBody);
}

function setupLighting(): void {
  // Add key light
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Add fill light
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(5, 8, 5);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0001;
  scene.add(sun);
  scene.add(sun.target);
}

function setupMetalBall(): void {
  // Create metal ball
  const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  const ballMaterial = new THREE.MeshStandardMaterial({
    color: 0x0000ff,
    roughness: 0.0,
    metalness: 0.95,
  });

  metalBall = new THREE.Mesh(ballGeometry, ballMaterial);
  metalBall.castShadow = true;
  metalBall.position.set(-20, 5, 10);

  // Add to scene
  scene.add(metalBall);

  // Add physics to ball
  const ballBody = physics.add(metalBall, {
    type: "dynamic",
    collider: "ball",
    mass: 3.0,
    restitution: 0.5,
  });

  // Give it initial velocity
  ballBody.setLinearVelocity(new RAPIER.Vector3(7, 1.5, -3.5));
}

function resetScene(): void {
  collisionOccurred = false;
  physics.destroy();
  scene.clear();

  physics = new PhysicsWorld(RAPIER, new RAPIER.Vector3(0, -2, 0));
  physics.onCollision = onCollision;

  setupLion();
  setupGround();
  setupLighting();
  setupMetalBall();

  physics.update();
}

async function onCollision(body1: any, body2: any) {
  if (!collisionOccurred) {
    // Check if collision involves lion fragments and ball
    const ballBody = physics.getBody(metalBall);

    // Check if one of the bodies is the ball and the other is a lion fragment
    const isLionFragmentCollision =
      (body2 === ballBody && body1.object.parent === lion) ||
      (body1 === ballBody && body2.object.parent === lion);

    if (isLionFragmentCollision) {
      console.log("Ball hit lion! Unfreezing...");

      // Remove physics from original lion mesh (if it still has one)
      physics.remove(lion.mesh);

      // Unfreeze fragments and wake them up
      lion.unfreeze(
        (fragment) => {
          const fragmentBody = physics.getBody(fragment);
          if (fragmentBody) {
            fragmentBody.wakeUp();
          }
        },
        () => {
          console.log("Lion shattered!");
        },
      );

      collisionOccurred = true;
    }
  }
}

// Animation loop
function animate() {
  const dt = clock.getDelta();

  // Update physics
  physics.update();

  // Update controls
  controls.update();

  // Use the composer instead of directly rendering
  composer.render(dt);
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Update composer size when window is resized
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize the scene
init();
