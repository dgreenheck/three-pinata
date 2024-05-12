import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { fracture } from './fracture/fragment/Fragmenter';
import { FractureOptions } from './fracture/fragment/FractureOptions';
import { RigidBody } from '@dimforge/rapier3d';

class PhysicsObject extends THREE.Mesh {
  rigidBody?: RigidBody;

  constructor(rigidBody?: RigidBody) {
    super();
    this.rigidBody = rigidBody;
  }

  update() {
    if (this.rigidBody) {
      const pos = this.rigidBody.translation();
      const q = this.rigidBody.rotation();
      this.position.set(pos.x, pos.y, pos.z);
      this.rotation.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    }
  }
}


const gui = new GUI();
const gltfLoader = new GLTFLoader();

let RAPIER = await import('@dimforge/rapier3d');

// Create a Rapier physics world
let gravity = { x: 0, y: -5, z: 0 };
let world = new RAPIER.World(gravity);
world.integrationParameters.lengthUnit = 0.1;
let worldObjects: PhysicsObject[] = [];

const eventQueue = new RAPIER.EventQueue(true);

// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

let lion: (PhysicsObject | null) = null;

async function resetScene() {
  // Reset the physics world
  world = new RAPIER.World(gravity);
  world.integrationParameters.lengthUnit = 0.1;
  worldObjects = [];

  scene.clear();

  // Load the model
  const lionModel = await gltfLoader.loadAsync('lion2.glb');

  lionModel.scene.traverse((obj) => {
    if ('isMesh' in obj && obj.isMesh) {
      lion = new PhysicsObject();

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

      lion.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, size.y / 2 + 1, 0));
      lion.update();

      world.createCollider(colliderDesc, lion.rigidBody);

      scene.add(lion);
      worldObjects.push(lion);
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
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.01, 200), groundBody);

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
}

const fractureOptions = new FractureOptions();

function startFracture(object: PhysicsObject) {
  const fragments = fracture(object, fractureOptions);

  let i = 0;
  fragments.forEach((fragment) => {
    const fragmentObject = new PhysicsObject();

    // Use the original object as a template, copying materials
    fragmentObject.name = `${object.name}_${i++}`;
    fragmentObject.geometry = fragment.toGeometry();
    fragmentObject.material = object.material;
    fragmentObject.position.copy(object.position);
    fragmentObject.rotation.copy(object.rotation);
    fragmentObject.scale.copy(object.scale);
    fragmentObject.castShadow = true;

    // Create colliders for each fragment
    const vertices = fragmentObject.geometry.getAttribute('position').array as Float32Array;
    const fragmentColliderDesc = RAPIER.ColliderDesc.convexHull(vertices)!
      .setRestitution(0.2);

    fragmentObject.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        fragmentObject.position.x,
        fragmentObject.position.y,
        fragmentObject.position.z)
      .setRotation(new THREE.Quaternion().setFromEuler(fragmentObject.rotation)));

    fragmentObject.rigidBody.setAngvel(object.rigidBody!.angvel(), true);
    fragmentObject.rigidBody.setLinvel(object.rigidBody!.linvel(), true);

    world.createCollider(fragmentColliderDesc, fragmentObject.rigidBody);

    worldObjects.push(fragmentObject);
    scene.add(fragmentObject);
  });

  console.log('done');
}

function animate() {
  requestAnimationFrame(animate);

  // Step the physics world
  world.step(eventQueue);

  // Handle collisions
  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    if (handle1 === lion?.rigidBody?.handle ||
        handle2 === lion?.rigidBody?.handle) {
      if (started) {
        console.log('fracturing');
        lion.visible = false;
        lion.rigidBody?.setEnabled(false);
        startFracture(lion);
      }
    }
  });

  // Update the position and rotation of each object
  worldObjects.forEach((obj) => obj.update());

  renderer.render(scene, camera);
  controls.update();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const functions = {
  resetScene
}

gui.add(functions, 'resetScene');

const physicsFolder = gui.addFolder('Physics');

const gravityFolder = physicsFolder.addFolder('Gravity');
gravityFolder.add(world.gravity, 'x', -100, 100, 0.1).name('X');
gravityFolder.add(world.gravity, 'y', -100, 100, 0.1).name('Y');
gravityFolder.add(world.gravity, 'z', -100, 100, 0.1).name('Z');

const fractureFolder = gui.addFolder('Fracture Options');
fractureFolder.add(fractureOptions, 'fractureMode', ['Convex', 'Non-Convex']).name('Fracture Mode');
fractureFolder.add(fractureOptions, 'fragmentCount', 2, 1000, 1);

const fracturePlanesFolder = fractureFolder.addFolder('Fracture Planes');
fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'x').name('X');
fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'y').name('Y');
fracturePlanesFolder.add(fractureOptions.fracturePlanes, 'z').name('Z');

animate();