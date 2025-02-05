import * as THREE from "three";
import { HDRJPGLoader } from "@monogrid/gainmap-js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PhysicsManager } from "./physics/PhysicsManager";
import { BreakableObject } from "./physics/BreakableObject";
import { FractureOptions } from "./fracture/entities/FractureOptions";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

type RAPIER_API = typeof import("@dimforge/rapier3d");
const RAPIER = await import("@dimforge/rapier3d");

const gui = new GUI();
const gltfLoader = new GLTFLoader();

let fractureOptions = new FractureOptions();
let physics = new PhysicsManager(
  RAPIER,
  new RAPIER.Vector3(0, -1, 0),
  fractureOptions,
);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 2.0;

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = false;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 2;
controls.enablePan = false;

const model = await gltfLoader.loadAsync("vase.glb");
const pedestal = await gltfLoader.loadAsync("pedestal.glb");

const loader = new HDRJPGLoader(renderer);
const result = await loader.loadAsync("ballroom_4k.jpg");
scene.background = result.renderTarget.texture;
scene.background.mapping = THREE.EquirectangularReflectionMapping;
scene.backgroundBlurriness = 0.05;
scene.environment = scene.background;

// Setup post-processing
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.1, // strength
  0.2, // radius
  0.9, // threshold
);
composer.addPass(bloomPass);

// Add vignette effect
const vignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 1.6 },
    darkness: { value: 0.2 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float vignet = smoothstep(offset, offset-0.3, length(uv));
      texel.rgb = mix(texel.rgb, texel.rgb * vignet, darkness);
      gl_FragColor = texel;
    }
  `,
};
const vignettePass = new ShaderPass(vignetteShader);
composer.addPass(vignettePass);

function loadScene() {
  scene.clear();
  physics.reset();

  scene.fog = new THREE.Fog(0xffffff, 20, 50);

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(4, 10, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 10;
  scene.add(sun);

  // Add click handler
  window.addEventListener("click", () => {
    // Create firing ball
    const ballRadius = 0.2;
    const ballGeometry = new THREE.SphereGeometry(ballRadius);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0.7,
      roughness: 0.3,
    });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    scene.add(ball);

    // Add ball physics
    const ballBody = physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(-5, 3, 0)
        .setLinvel(0, 0, 0),
    );

    const ballColliderDesc = RAPIER.ColliderDesc.ball(ballRadius)
      .setMass(0.3)
      .setRestitution(0.2)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const ballCollider = physics.world.createCollider(
      ballColliderDesc,
      ballBody,
    );
    physics.setBallCollider(ballCollider);

    // Launch the ball with velocity in the +X direction
    ballBody.setLinvel({ x: 5, y: 0, z: 0 }, true);

    // Store reference to ball and its body
    physics.trackMesh(ball, ballBody);
  });

  // Update vase material to look better
  model.scene.traverse((obj) => {
    if ("isMesh" in obj && obj.isMesh) {
      const breakableModel = new BreakableObject();
      const mesh = obj as THREE.Mesh;

      // Create better material for the vase
      breakableModel.material = new THREE.MeshPhysicalMaterial({
        color: 0xcccccc,
        metalness: 0.1,
        roughness: 0.1,
        envMap: scene.environment,
        envMapIntensity: 1.0,
        transparent: false,
        opacity: 0.5,
        side: THREE.FrontSide,
      });

      breakableModel.geometry = mesh.geometry;
      breakableModel.castShadow = true;

      breakableModel.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      breakableModel.geometry.boundingBox?.getSize(size);

      console.log(breakableModel);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(
        size.x / 2,
        size.y / 2,
        size.z / 2,
      )
        .setRestitution(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      breakableModel.rigidBody = physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0),
      );

      scene.add(breakableModel);
      physics.addObject(breakableModel, colliderDesc);
    }
  });

  // Load and setup pedestal
  pedestal.scene.traverse((obj) => {
    if ("isMesh" in obj && obj.isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.material = new THREE.MeshPhysicalMaterial({
        color: 0xc0c0c0,
        metalness: 0.0,
        roughness: 0.8,
        envMap: scene.environment,
        envMapIntensity: 1.5,
      });
      mesh.receiveShadow = true;
    }
  });
  pedestal.scene.scale.set(0.5, 0.5, 0.5);
  pedestal.scene.position.y = -4;
  scene.add(pedestal.scene);

  const pedestalBody = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0),
  );
  physics.world.createCollider(
    RAPIER.ColliderDesc.cuboid(2.1, 1.72, 2.1),
    pedestalBody,
  );
}

// Position the camera to view from the front
camera.position.set(0, 4, 6);
controls.target.set(0, 2.5, 0);
controls.update();

function animate() {
  requestAnimationFrame(animate);
  physics.update(scene);
  composer.render(); // Use composer instead of renderer
  controls.update();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const physicsFolder = gui.addFolder("Physics");

const gravityFolder = physicsFolder.addFolder("Gravity");
gravityFolder.add(physics.world.gravity, "x", -100, 100, 0.1).name("X");
gravityFolder.add(physics.world.gravity, "y", -100, 100, 0.1).name("Y");
gravityFolder.add(physics.world.gravity, "z", -100, 100, 0.1).name("Z");

const fractureFolder = gui.addFolder("Fracture Options");
fractureFolder
  .add(fractureOptions, "fractureMode", ["Convex", "Non-Convex"])
  .name("Fracture Mode");
fractureFolder.add(fractureOptions, "fragmentCount", 2, 100, 1);

const fracturePlanesFolder = fractureFolder.addFolder("Fracture Planes");
fracturePlanesFolder.add(fractureOptions.fracturePlanes, "x").name("X");
fracturePlanesFolder.add(fractureOptions.fracturePlanes, "y").name("Y");
fracturePlanesFolder.add(fractureOptions.fracturePlanes, "z").name("Z");

gui.add({ loadScene }, "loadScene");

loadScene();
animate();
