import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Demo } from "./types/Demo";
import { PhysicsDemo } from "./examples/physics";

let activeDemo: Demo | null = null;

const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Create GUI
const gui = new GUI();

// Setup demo selection
const demoOptions = {
  current: "Physics",
};

// Initialize demos
const physicsDemo = new PhysicsDemo(camera, controls);
activeDemo = physicsDemo;
loadDemo(activeDemo);

async function loadDemo(demo: Demo) {
  activeDemo = demo;
  await demo.initialize();
  await demo.loadScene();
  animate();
}

// Add demo selector to GUI
gui.add(demoOptions, "current", ["Physics"]).onChange(async (value: string) => {
  gui.destroy();

  switch (value) {
    case "Physics":
      await loadDemo(physicsDemo);
      break;
    default:
      console.warn("Unknown demo:", value);
      return;
  }
});

// Animation loop with delta time
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  if (activeDemo) {
    activeDemo.update(dt);

    renderer.render(activeDemo.scene, camera);
  }

  controls.update();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
