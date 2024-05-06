import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { fracture } from './fracture/fragment/Fragmenter';
import { FractureOptions } from './fracture/fragment/FractureOptions';
import { RigidBody } from '@dimforge/rapier3d';

const tex = new THREE.TextureLoader().load('base.png');

import('@dimforge/rapier3d').then(RAPIER => {
  // Create a Rapier physics world
  const world = new RAPIER.World({ x: 0, y: -2, z: 0 });
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

  // Add a simple sphere
  const box = new THREE.Mesh();
  box.geometry = new THREE.TorusKnotGeometry()
  box.material =  [
    new THREE.MeshLambertMaterial({ map: tex }),
    new THREE.MeshLambertMaterial({ color: 0xff0000 })
  ];
  box.geometry.addGroup(0, box.geometry.index!.count, 0);

  box.name = 'Box';
  box.position.set(0, 4, 0);
  box.rotation.x = -Math.PI / 4 ;
  box.castShadow = true;
  scene.add(box);

  // Ctate a ground plane
  const planeGeometry = new THREE.PlaneGeometry(20, 20);
  const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0 });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight();
  sun.intensity = 3;
  sun.position.set(10, 10, 10);
  sun.castShadow = true;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;

  scene.add(sun);

  // Position the camera
  camera.position.set(5, 5, 5);
  controls.target.set(0, 1, 0);
  controls.update();

  const objects: { mesh: THREE.Mesh, rigidBody: RigidBody }[] = [];

  // Add sphere to Rapier world
  const boxColliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)
    .setRestitution(0)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  const rigid = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(box.position.x, box.position.y, box.position.z)
    .setRotation(new THREE.Quaternion().setFromEuler(box.rotation)));

  objects.push({ mesh: box, rigidBody: rigid });

  world.createCollider(boxColliderDesc, rigid);

  // Add ground plane to Rapier world
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.01, 10), groundBody);

  // Options fracturing
  const fractureOptions = new FractureOptions();

  let collision = false;

  async function startFracture() {
    const fragments = fracture(box, fractureOptions);
    fragments.forEach((fragment) => {
      const verts = fragment.geometry.getAttribute('position').array as Float32Array;

      // Create colliders for each fragment
      const fragmentColliderDesc = RAPIER.ColliderDesc.convexMesh(verts)!
        .setRestitution(0);

      const fragmentBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(fragment.position.x, fragment.position.y, fragment.position.z)
        .setRotation(new THREE.Quaternion().setFromEuler(fragment.rotation)));
      fragmentBody.setAngvel(rigid.angvel(), true);
      fragmentBody.setLinvel(rigid.linvel(), true);

      world.createCollider(fragmentColliderDesc, fragmentBody);

      objects.push({ mesh: fragment, rigidBody: fragmentBody });
      scene.add(fragment);
    });
  }

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);

    // Step the physics world
    world.step(eventQueue);
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (handle1 === rigid.handle || handle2 === rigid.handle) {
        if (started && !collision) {
          collision = true;
          startFracture();
          box.visible = false;
          rigid.setEnabled(false);
        }
      }
    });

    objects.forEach(({ mesh, rigidBody }) => {
      // Update the sphere's position based on the physics simulation
      const boxPos = rigidBody.translation();
      const q = rigidBody.rotation();
      mesh.position.set(boxPos.x, boxPos.y, boxPos.z);
      mesh.rotation.setFromQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    });

    renderer.render(scene, camera);

    controls.update();
  }

  animate();
})