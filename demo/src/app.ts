import * as THREE from "three";
import { Pane, FolderApi } from "tweakpane";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ThreePerf } from "three-perf";
import { PhysicsWorld } from "./physics/PhysicsWorld";

// Import scenes
import { BaseScene } from "./scenes/BaseScene";
import { GlassShatterScene } from "./scenes/GlassShatterScene";
import { SmashingScene } from "./scenes/SmashingScene";
import { ProgressiveDestructionScene } from "./scenes/ProgressiveDestructionScene";
import { SlicingScene } from "./scenes/SlicingScene";
import { BrickWallScene } from "./scenes/BrickWallScene";
import { RefractureScene } from "./scenes/RefractureScene";
import { KintsugiScene } from "./scenes/KintsugiScene";

// Add imports for postprocessing
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { FilmShader } from "three/examples/jsm/shaders/FilmShader.js";

import gridUrl from "./assets/grid.png";
import envMapUrl from "./assets/autumn_field_puresky_4k.jpg";

const RAPIER = await import("@dimforge/rapier3d");

// Scene setup
const scene = new THREE.Scene();

// Load environment map
const textureLoader = new THREE.TextureLoader();
const envMap = textureLoader.load(envMapUrl);
envMap.mapping = THREE.EquirectangularReflectionMapping;
envMap.colorSpace = THREE.SRGBColorSpace;
scene.environment = envMap;
scene.background = envMap;

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
renderer.setClearColor(0xa0a0a0);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
document.body.appendChild(renderer.domElement);

// Add performance monitor
const perf = new ThreePerf({
  anchorX: "right",
  anchorY: "bottom",
  domElement: document.body,
  renderer,
});

// Set up post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom pass
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.3, // strength
  0.4, // radius
  0.9, // threshold
);
composer.addPass(bloomPass);

// Vignette pass
const vignettePass = new ShaderPass(VignetteShader);
vignettePass.uniforms["offset"].value = 0.5;
vignettePass.uniforms["darkness"].value = 1;
composer.addPass(vignettePass);

// Film/noise pass
const filmPass = new ShaderPass(FilmShader);
filmPass.uniforms["intensity"].value = 0.1;
composer.addPass(filmPass);

// Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = false;
controls.autoRotateSpeed = 10;
controls.enableZoom = true;
controls.dampingFactor = 0.25;
controls.enablePan = true;

// Physics world (will be recreated per scene)
let physics: PhysicsWorld;

// Current scene
let currentScene: BaseScene | null = null;

// Create GUI
const pane = new Pane();
pane.title = "three-pinata";

// Style the Tweakpane element
const tweakpaneElement = pane.element;
tweakpaneElement.parentElement!.style.width = "300px";

// Mobile UI setup
const MOBILE_BREAKPOINT = 768;
let isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

const controlsToggle = document.getElementById("controls-toggle")!;
const controlsOverlay = document.getElementById("controls-overlay")!;
const mobilePaneContainer = document.getElementById("mobile-pane-container")!;
const instructionsToggle = document.getElementById("instructions-toggle")!;
const instructionsElement = document.getElementById("instructions")!;

function setupMobileUI(): void {
  // Move Tweakpane to mobile container if on mobile
  if (isMobile) {
    mobilePaneContainer.appendChild(tweakpaneElement.parentElement!);
    perf.visible = false;
  } else {
    // Move back to body for desktop
    document.body.appendChild(tweakpaneElement.parentElement!);
    controlsOverlay.classList.remove("visible");
    controlsToggle.classList.remove("active");
    instructionsElement.classList.remove("visible", "hidden");
    instructionsToggle.classList.remove("active");
    perf.visible = true;
  }
}

// Controls toggle handler
controlsToggle.addEventListener("click", () => {
  const isVisible = controlsOverlay.classList.toggle("visible");
  controlsToggle.classList.toggle("active", isVisible);
});

// Instructions toggle handler
instructionsToggle.addEventListener("click", () => {
  const isVisible = instructionsElement.classList.toggle("visible");
  instructionsToggle.classList.toggle("active", isVisible);
});

// Close controls overlay when tapping outside (on the drag handle area)
controlsOverlay.addEventListener("click", (e) => {
  if (e.target === controlsOverlay || (e.target as HTMLElement).classList.contains("drag-handle")) {
    controlsOverlay.classList.remove("visible");
    controlsToggle.classList.remove("active");
  }
});

// Prevent UI clicks from triggering scene interactions
const uiElements = [
  controlsOverlay,
  controlsToggle,
  instructionsToggle,
  instructionsElement,
  tweakpaneElement.parentElement!,
];
const blockedEvents = ["pointerdown", "pointerup", "click", "mousedown", "mouseup"];
uiElements.forEach((el) => {
  blockedEvents.forEach((eventType) => {
    el.addEventListener(eventType, (e) => e.stopPropagation());
  });
});

// Initial mobile UI setup
setupMobileUI();

// App settings
const appSettings = {
  scene: "brickwall" as
    | "glass"
    | "smashing"
    | "progressive"
    | "slicing"
    | "brickwall"
    | "refracture"
    | "kintsugi",
};

// Setup GUI controls - Scene Selection dropdown
pane
  .addBinding(appSettings, "scene", {
    options: {
      "Brick Wall": "brickwall",
      Glass: "glass",
      Kintsugi: "kintsugi",
      "Progressive Destruction": "progressive",
      Refracturing: "refracture",
      Slicing: "slicing",
      "Smashing Object": "smashing",
    },
    label: "Select Scene",
  })
  .on("change", () => {
    // Collapse controls on mobile when scene is selected
    if (isMobile) {
      controlsOverlay.classList.remove("visible");
      controlsToggle.classList.remove("active");
    }
    switchScene(appSettings.scene);
  });

// Add separator for scene-specific controls
pane.addBlade({ view: "separator" });

// Track scene-specific folders
let sceneFolder: FolderApi | null = null;

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
    roughness: 0.1,
    metalness: 0.2,
    envMapIntensity: 0.9,
  });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // Add physics to ground
  const groundBody = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
  const rigidBody = physics.world.createRigidBody(groundBody);

  const groundCollider = RAPIER.ColliderDesc.cuboid(100, 0.1, 100);
  physics.world.createCollider(groundCollider, rigidBody);
}

function setupLighting(): void {
  // Add ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // Add directional light
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(3, 5, 3);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.001;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  scene.add(sun.target);
}

async function switchScene(sceneType: string): Promise<void> {
  // Dispose current scene
  if (currentScene) {
    currentScene.dispose();
    currentScene = null;
  }

  // Remove scene-specific UI folder
  if (sceneFolder) {
    pane.remove(sceneFolder);
    sceneFolder = null;
  }

  // Clear the scene (but keep environment and lights)
  const objectsToRemove: THREE.Object3D[] = [];
  scene.traverse((obj) => {
    if (
      obj !== scene &&
      obj.type !== "AmbientLight" &&
      obj.type !== "DirectionalLight" &&
      !(
        obj instanceof THREE.Mesh && obj.geometry instanceof THREE.PlaneGeometry
      )
    ) {
      objectsToRemove.push(obj);
    }
  });
  objectsToRemove.forEach((obj) => scene.remove(obj));

  // Destroy and recreate physics
  if (physics) {
    physics.destroy();
  }
  physics = new PhysicsWorld(RAPIER, new RAPIER.Vector3(0, -9.81, 0));

  // Re-setup ground
  setupGround();

  // Create new scene
  switch (sceneType) {
    case "glass":
      currentScene = new GlassShatterScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "smashing":
      currentScene = new SmashingScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "progressive":
      currentScene = new ProgressiveDestructionScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "refracture":
      currentScene = new RefractureScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "slicing":
      currentScene = new SlicingScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "brickwall":
      currentScene = new BrickWallScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
    case "kintsugi":
      currentScene = new KintsugiScene(
        scene,
        camera,
        physics,
        pane,
        controls,
        clock,
        renderer,
      );
      break;
  }

  // Initialize the new scene
  if (currentScene) {
    await currentScene.init();
    sceneFolder = currentScene.setupUI();

    // Update instructions
    instructionsElement.textContent = currentScene.getInstructions();
  }
}

// Animation loop
function animate() {
  const dt = clock.getDelta();

  // Update performance monitor
  perf.begin();

  // Update physics
  if (physics) {
    physics.update();
  }

  // Update current scene
  if (currentScene) {
    currentScene.update(dt);
  }

  // Update controls
  controls.update();

  // Update film shader time for animated grain
  filmPass.uniforms["time"].value = performance.now() * 0.001;

  // Render with post-processing
  composer.render(dt);

  perf.end();
}

// Handle window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Update composer size when window is resized
  composer.setSize(window.innerWidth, window.innerHeight);

  // Update bloom pass resolution
  bloomPass.setSize(window.innerWidth, window.innerHeight);

  // Handle mobile/desktop layout switching
  const wasMobile = isMobile;
  isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
  if (wasMobile !== isMobile) {
    setupMobileUI();
  }
});

// Initialize the app
async function init() {
  // Create initial physics world
  physics = new PhysicsWorld(RAPIER, new RAPIER.Vector3(0, -9.81, 0));

  // Setup shared scene elements
  setupGround();
  setupLighting();

  // Load initial scene
  await switchScene(appSettings.scene);

  // Start animation loop
  renderer.setAnimationLoop(animate);
}

// Start the app
init();
