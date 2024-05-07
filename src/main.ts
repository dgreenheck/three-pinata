import * as THREE from 'three';
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

const gltfLoader = new GLTFLoader();

let RAPIER = await import('@dimforge/rapier3d');

// Create a Rapier physics world
const world = new RAPIER.World({ x: 0, y: -5, z: 0 });
world.timestep = 0.002;
const eventQueue = new RAPIER.EventQueue(true);

// Array of physics objects
const worldObjects: PhysicsObject[] = [];

// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

// Load the model
const lionModel = await gltfLoader.loadAsync('lion2.glb');
lionModel.scene.traverse((obj) => {
  if ('isMesh' in obj && obj.isMesh) {
    const lion = new PhysicsObject();

    const mesh = obj as THREE.Mesh;
    lion.geometry = mesh.geometry;
    lion.material = mesh.material;
    lion.castShadow = true;

    lion.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    lion.geometry.boundingBox?.getSize(size);

    console.log(size);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)
      .setRestitution(0)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    lion.rigidBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, size.y / 2 + 1, 0));
    lion.update();

    world.createCollider(colliderDesc, lion.rigidBody);

    console.log('lion added');

    scene.add(lion);
    worldObjects.push(lion);
  }
})

// Ctate a ground plane
const planeGeometry = new THREE.PlaneGeometry(200, 200);
const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.receiveShadow = true;
scene.add(plane);

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
camera.position.set(-50, 50, 50);
controls.target.set(0, 1, 0);
controls.update();

// Add ground plane to Rapier world
const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
world.createCollider(RAPIER.ColliderDesc.cuboid(200, 0.01, 200), groundBody);

// Options fracturing
const fractureOptions = new FractureOptions();

let collision = false;

async function startFracture(object: PhysicsObject) {
  console.log('fracturing');
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

    // Create colliders for each fragment
    const vertices = fragmentObject.geometry.getAttribute('position').array as Float32Array;
    const fragmentColliderDesc = RAPIER.ColliderDesc.convexHull(vertices)!
      .setRestitution(0);

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
    if (handle1 === worldObjects[0].rigidBody?.handle ||
        handle2 === worldObjects[0].rigidBody?.handle) {
      if (started && !collision) {
        collision = true;
        startFracture(worldObjects[0]);
        worldObjects[0].visible = false;
        worldObjects[0].rigidBody?.setEnabled(false);
      }
    }
  });

  // Update the position and rotation of each object
  worldObjects.forEach((obj) => obj.update());

  renderer.render(scene, camera);
  controls.update();
}

animate();