import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { fracture } from './fragment/Fragmenter';
import { FractureOptions } from './fragment/FractureOptions';
import { RigidBody } from '@dimforge/rapier3d';

import('@dimforge/rapier3d').then(RAPIER => {
  // Create a Rapier physics world
  const world = new RAPIER.World({ x: 0, y: -4, z: 0 });
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
  /*
  const box = new THREE.Mesh();
  box.geometry = new THREE.TorusKnotGeometry()
  box.material =  [
    new THREE.MeshLambertMaterial({ color: 0x000088 }),
    new THREE.MeshLambertMaterial({ color: 0x00ff00 })
  ];
  box.geometry.addGroup(0, box.geometry.index!.count, 0);

  box.name = 'Box';
  box.position.set(0, 8, 0);
  box.rotation.set(Math.PI / 4, Math.PI / 4, 0);
  box.castShadow = true;
  scene.add(box);
  */
  const geometry = new THREE.BufferGeometry();

  const vertices = new Float32Array([
    0, 0, 0,
    0.5, 0, 0,
    0, 0, 1,

    0, 1, 0,
    0.5, 1, 0,
    0, 1, 1,

    0.5, 0, 1,
    1, 0, 1,
    1, 0, 0,

    0.5, 1, 1,
    1, 1, 1,
    1, 1, 0,
  ]);

  const uv = new Float32Array([
    0, 0,
    0, 0,
    0, 0,

    0, 0,
    0, 0,
    0, 0,

    0, 0,
    0, 0,
    0, 0,

    0, 0,
    0, 0,
    0, 0
  ]);

  const indices = [
    0, 1, 2,
    0, 2, 3,
    2, 5, 3,
    2, 1, 5,
    1, 4, 5,
    0, 4, 1,
    0, 3, 4,
    3, 5, 4,

    6, 8, 7,
    6, 7, 9,
    7, 10, 9,
    7, 8, 10,
    8, 11, 10,
    6, 11, 8,
    6, 9, 11,
    9, 10, 11
  ];

  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.addGroup(0, indices.length, 0);

  const mesh = new THREE.Mesh();
  mesh.geometry = geometry;
  mesh.material = [
    new THREE.MeshBasicMaterial({ color: 0xff0000 }),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
  ]
  mesh.position.set(0, 1.2, 0);
  scene.add(mesh);

  scene.add(new THREE.AxesHelper());
  /*
  // Create a ground plane
  const planeGeometry = new THREE.PlaneGeometry(20, 20);
  const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xa0a0a0, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);
*/

  const ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight();
  sun.position.set(10, 10, 10);
  sun.castShadow = true;
  sun.shadow.camera.left = -10;
  sun.shadow.camera.right = 10;
  sun.shadow.camera.top = 10;
  sun.shadow.camera.bottom = -10;

  scene.add(sun);

  // Position the camera
  camera.position.set(2, 2, 2);
  controls.target.set(0, 0, 0);
  controls.update();

  const objects: { mesh: THREE.Mesh, rigidBody: RigidBody }[] = [];

  // Add sphere to Rapier world
  const boxColliderDesc = RAPIER.ColliderDesc.cuboid(1, 1, 1)
    .setRestitution(0)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  const rigid = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
    .setRotation(new THREE.Quaternion().setFromEuler(mesh.rotation)));

  objects.push({ mesh, rigidBody: rigid });

  world.createCollider(boxColliderDesc, rigid);

  // Add ground plane to Rapier world
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.01, 10), groundBody);

  // Options fracturing
  const fractureOptions = new FractureOptions();

  let collision = false;

  async function startFracture() {
    const fragments = fracture(mesh, fractureOptions);
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

      const indices = fragment.geometry.index!.array;
      for (let k = 0; k < indices.length; k += 3) {
        const v1 = 3 * indices[k];
        const v2 = 3 * indices[k + 1];
        const v3 = 3 * indices[k + 2];
        console.log(`V${indices[k]}`, 'X', verts[v1], 'Y', verts[v1 + 1], 'Z', verts[v1 + 2], '|',
          `V${indices[k + 1]}`, 'X', verts[v2], 'Y', verts[v2 + 1], 'Z', verts[v2 + 2], '|',
          `V${indices[k + 2]}`, 'X', verts[v3], 'Y', verts[v3 + 1], 'Z', verts[v3 + 2]);
      }
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
          mesh.visible = false;
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