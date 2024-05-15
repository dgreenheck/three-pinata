import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PhysicsManager } from './physics/PhysicsManager';
import { BreakableObject } from './physics/BreakableObject';

type RAPIER_API = typeof import("@dimforge/rapier3d");

export async function init(RAPIER: RAPIER_API) {
  const gui = new GUI();
  const gltfLoader = new GLTFLoader();

  // Set up Three.js scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Orbit controls
  const controls = new OrbitControls(camera, renderer.domElement);

  const physics = new PhysicsManager(RAPIER);

  // Load the model
  const lionModel = await gltfLoader.loadAsync('lion2.glb');

  lionModel.scene.traverse((obj) => {
    if ('isMesh' in obj && obj.isMesh) {
      const lion = new BreakableObject();

      const mesh = obj as THREE.Mesh;
      lion.geometry = mesh.geometry;
      lion.material = mesh.material;
      lion.castShadow = true;

      lion.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      lion.geometry.boundingBox?.getSize(size);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)
        .setRestitution(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

      lion.rigidBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, size.y / 2 + 1, 0));
      lion.update();

      physics.world.createCollider(colliderDesc, lion.rigidBody);

      scene.add(lion);
      physics.worldObjects.push(lion);
    }
  })

  // Create a ground plane
  const planeGeometry = new THREE.PlaneGeometry(200, 200);
  const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  // Add ground plane to Rapier world
  const groundBody = physics.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.01, 200), groundBody);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight();
  sun.intensity = 3;
  sun.position.set(-10, 10, 10);
  sun.castShadow = true;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // Position the camera
  camera.position.set(-50, 40, 50);
  controls.target.set(0, 10, 0);
  controls.update();

  function animate() {
    requestAnimationFrame(animate);
    physics.update(RAPIER, scene);
    renderer.render(scene, camera);
    controls.update();
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const physicsFolder = gui.addFolder('Physics');

  const gravityFolder = physicsFolder.addFolder('Gravity');
  gravityFolder.add(physics.world.gravity, 'x', -100, 100, 0.1).name('X');
  gravityFolder.add(physics.world.gravity, 'y', -100, 100, 0.1).name('Y');
  gravityFolder.add(physics.world.gravity, 'z', -100, 100, 0.1).name('Z');

  /*
  const fractureFolder = gui.addFolder('Fracture Options');
  fractureFolder.add(fractureOptions, 'fractureMode', ['Convex', 'Non-Convex']).name('Fracture Mode');
  fractureFolder.add(fractureOptions, 'fragmentCount', 2, 1000, 1);

  const fracturePlanesFolder = fractureFolder.addFolder('Fracture Planes');
  fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'x').name('X');
  fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'y').name('Y');
  fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'z').name('Z');
  */

  animate();
}