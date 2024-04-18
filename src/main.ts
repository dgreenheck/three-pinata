import * as THREE from 'three';

import('@dimforge/rapier3d').then(RAPIER => {
  // Create a Rapier physics world
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  const eventQueue = new RAPIER.EventQueue(true);
    
  // Set up Three.js scene
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Add a simple sphere
  const geometry = new THREE.SphereGeometry(1, 32, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // Create a ground plane
  const planeGeometry = new THREE.PlaneGeometry(20, 20);
  const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  scene.add(plane);

  // Position the camera
  camera.position.set(0,10,20);

  // Add sphere to Rapier world
  const sphereColliderDesc = RAPIER.ColliderDesc.ball(1)
    .setRestitution(0.7)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  const sphereBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
  world.createCollider(sphereColliderDesc, sphereBody);

  // Add ground plane to Rapier world
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.1, 10), groundBody);

  // Animation loop
  function animate() {
      requestAnimationFrame(animate);

      // Step the physics world
      world.step(eventQueue);
      eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        if (handle1 === sphereBody.handle || handle2 === sphereBody.handle) {
            if (started) {
                console.log('Sphere has started colliding with something');
            } else {
                console.log('Sphere has stopped colliding with something');
            }
        }
      });

      // Update the sphere's position based on the physics simulation
      const spherePos = sphereBody.translation();
      sphere.position.set(spherePos.x, spherePos.y, spherePos.z);

      renderer.render(scene, camera);
  }

  animate();
})