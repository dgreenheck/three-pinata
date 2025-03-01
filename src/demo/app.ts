import * as THREE from "three";
import { Pane } from "tweakpane";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Demo } from "./types/Demo";
import { PhysicsDemo } from "./examples/physics";
import { ExplodeDemo } from "./examples/explode";

let activeDemo: Demo | null = null;

const clock = new THREE.Clock();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// Create GUI
const pane = new Pane();

// Style the Tweakpane element
const tweakpaneElement = pane.element;
tweakpaneElement.parentElement!.style.width = "300px"; // Set your desired width

// Setup demo selection
const demoOptions = {
  current: "Skull",
};

// Initialize demos
const physicsDemo = new PhysicsDemo(camera, controls, pane);
const explodeDemo = new ExplodeDemo(camera, controls, pane);
activeDemo = explodeDemo;
loadDemo(activeDemo);

async function loadDemo(demo: Demo) {
  activeDemo = demo;
  await demo.initialize();
  await demo.loadScene();
  animate();
}

// Add demo selector to GUI
pane
  .addBinding(demoOptions, "current", {
    options: {
      Physics: "Physics",
      Skull: "Skull",
    },
    label: "Select Demo",
  })
  .on("change", async (ev) => {
    pane.dispose();

    switch (ev.value) {
      case "Physics":
        await loadDemo(physicsDemo);
        break;
      case "Skull":
        await loadDemo(explodeDemo);
        break;
      default:
        console.warn("Unknown demo:", ev.value);
        return;
    }
  });

// Add a separator to the GUI
pane.addBlade({ view: "separator" });

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
