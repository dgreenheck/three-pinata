# three-pinata

![NPM Version](https://img.shields.io/npm/v/%40dgreenheck%2Fthree-pinata)
![NPM Downloads](https://img.shields.io/npm/dw/%40dgreenheck%2Fthree-pinata)
![GitHub Repo stars](https://img.shields.io/github/stars/dgreenheck/three-pinata)
![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/dangreenheck)
![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCrdx_EU_Wx8_uBfqO0cI-9Q)

<p align="center">
<img src="https://github.com/user-attachments/assets/abf37715-d631-4cc6-b31a-1ea9a784f215" />
</p>

**Real-time mesh fracturing and slicing for Three.js**

Three-pinata is a powerful library that enables you to fracture and slice 3D meshes in real-time directly in the browser. Whether you're building a destruction physics game, an interactive art piece, or a scientific visualization, three-pinata provides the tools you need to break things beautifully.

## Live Demo

Check out the interactive demo: https://dgreenheck.github.io/three-pinata/

## What is Three-pinata?

Three-pinata takes your 3D models and breaks them into realistic fragments using sophisticated geometric algorithms. The library supports both **Voronoi fracturing** (high-quality, natural-looking breaks) and **plane-based slicing** (precise cuts along custom planes).

### Key Capabilities

- **Voronoi Fracturing**: Create natural-looking breaks with adjustable fragment counts and impact-based density
- **Plane Slicing**: Precisely cut meshes along any plane with support for re-slicing fragments
- **Real-time Performance**: Optimized algorithms that work in-browser without server processing
- **Material Support**: Apply different materials to outer surfaces vs. internal fracture faces
- **Physics Ready**: Designed to integrate seamlessly with physics engines like Rapier
- **TypeScript Support**: Full type definitions included

## Understanding Manifold/Watertight Meshes

### What is a Manifold Mesh?

A **manifold** (or **watertight**) mesh is a 3D model that forms a completely closed, solid volume with no holes, gaps, or self-intersecting geometry. Think of it like a balloon - every edge is shared by exactly two faces, and the mesh defines a clear "inside" and "outside."

**Examples of manifold meshes:**
- A sphere, cube, cylinder, or torus
- A properly modeled coffee mug (including the inside of the handle)
- A closed character model with no gaps in the geometry

**Examples of non-manifold meshes:**
- A plane (has edges with only one face)
- A mesh with holes or missing faces
- Intersecting or overlapping geometry
- Open-ended cylinders or boxes

### Why Does Three-pinata Require Manifold Meshes?

The fracturing and slicing algorithms need to:
1. Determine which parts of the mesh are "inside" a Voronoi cell or on each side of a cutting plane
2. Generate new internal faces where the cut occurs
3. Ensure each fragment is a valid, closed mesh

Non-manifold meshes create ambiguity - the algorithm can't determine what's inside vs. outside, leading to:
- Missing or incorrect internal faces
- Fragments with holes or gaps
- Erroneous geometry that causes visual artifacts
- Physics colliders that behave unpredictably

### How to Check if Your Mesh is Manifold

Most 3D modeling software can check and fix manifold issues:

**Blender:**
1. Select your mesh in Edit mode
2. Go to `Mesh > Clean Up > Make Manifold`
3. Use the "3D Print Toolbox" addon to check for non-manifold geometry

**Maya:**
1. Use `Mesh > Cleanup` with "Non-manifold geometry" checked
2. Select mesh and run `Mesh > Separate` to isolate problematic areas

**Online Tools:**
- Upload to services like MeshLab or use the "Model Repair Service"

### Tips for Working with Meshes

- Always use closed, solid models (not just surfaces)
- Avoid overlapping geometry in your models
- Check that all normals face outward consistently
- Use simple primitive shapes (spheres, cubes) for testing before using complex models
- If using downloaded models, check them in a 3D editor first

## Installation

```bash
npm install @dgreenheck/three-pinata
```

The library requires Three.js >= 0.158.0 as a peer dependency.

## Quick Start

Here's a minimal example that fractures a sphere and animates the fragments:

```typescript
import * as THREE from "three";
import { VoronoiFractureOptions, fracture } from "@dgreenheck/three-pinata";

// Setup scene
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create materials
const outerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
const innerMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

// Create and fracture sphere
const geometry = new THREE.SphereGeometry(1, 32, 32);
const options = new VoronoiFractureOptions({ fragmentCount: 50 });

const fragmentGroup = new THREE.Group();
const fragmentGeometries = fracture(geometry, options);

fragmentGeometries.forEach((fragmentGeometry) => {
  // Create mesh with dual materials (outer + inner)
  const fragmentMesh = new THREE.Mesh(fragmentGeometry, [outerMaterial, innerMaterial]);

  // Center the fragment at its bounding box center
  fragmentGeometry.computeBoundingBox();
  fragmentGeometry.boundingBox.getCenter(fragmentMesh.position);

  fragmentGroup.add(fragmentMesh);
});

scene.add(fragmentGroup);

// Add lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

// Render loop
function animate() {
  requestAnimationFrame(animate);
  fragmentGroup.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();
```

## Features & Options

### Voronoi Fracturing

Voronoi fracturing creates natural-looking breaks by dividing the mesh into cells using random seed points.

```typescript
import { VoronoiFractureOptions, fracture } from "@dgreenheck/three-pinata";

const options = new VoronoiFractureOptions({
  fragmentCount: 50,              // Number of fragments to create
  mode: "3D",                      // "3D" or "2.5D" (see below)
  fractureMode: "Non-Convex",      // "Convex" or "Non-Convex"
  detectIsolatedFragments: true,   // Split disconnected pieces
  impactPoint: new THREE.Vector3(0, 0, 0),  // Optional impact location
  impactRadius: 1.0,               // Density around impact point
  seed: 12345,                     // Optional random seed for reproducibility
});

const fragments = fracture(geometry, options);
```

#### Fracture Modes

**3D Mode**: Full 3D Voronoi tessellation
- Most realistic results
- Fragments have complex, irregular shapes
- Slower computation
- Best for: Objects being smashed, explosions, natural breaks

**2.5D Mode**: 2D Voronoi pattern projected through the mesh
- Faster computation
- Creates more uniform, shard-like pieces
- Best for: Flat objects, glass shattering, performance-critical scenarios

#### Impact-Based Fracturing

Concentrate fragments around an impact point for more realistic destruction:

```typescript
// Fracture with impact at specific location
const impactPoint = new THREE.Vector3(0, 1, 0); // Local space coordinates

const options = new VoronoiFractureOptions({
  fragmentCount: 100,
  impactPoint: impactPoint,
  impactRadius: 0.5,  // Smaller radius = more concentrated damage
});
```

### Plane Slicing

Slice meshes along arbitrary planes with support for re-slicing:

```typescript
import { DestructibleMesh, SliceOptions } from "@dgreenheck/three-pinata";

const mesh = new DestructibleMesh(geometry, material);
scene.add(mesh);

// Define slice plane (normal + point on plane)
const sliceNormal = new THREE.Vector3(0, 1, 0);    // Horizontal cut
const sliceOrigin = new THREE.Vector3(0, 0, 0);    // At origin

const options = new SliceOptions();
options.enableReslicing = true;         // Allow slicing the sliced pieces
options.maxResliceCount = 3;            // Maximum number of times a piece can be resliced
options.detectFloatingFragments = true; // Split disconnected pieces (for non-convex meshes)

// Perform slice
const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

// Add pieces to scene
pieces.forEach(piece => scene.add(piece));

// Hide original mesh
mesh.visible = false;
```

#### World-Space Slicing

Slice using world-space coordinates instead of local coordinates:

```typescript
const worldNormal = new THREE.Vector3(1, 0, 0);  // World-space normal
const worldOrigin = new THREE.Vector3(5, 2, 0);  // World-space point

const pieces = mesh.sliceWorld(worldNormal, worldOrigin, options);
```

### Using DestructibleMesh

`DestructibleMesh` extends `THREE.Mesh` with built-in fracturing and slicing capabilities:

```typescript
import { DestructibleMesh, VoronoiFractureOptions } from "@dgreenheck/three-pinata";

const mesh = new DestructibleMesh(geometry, material);
mesh.castShadow = true;
mesh.position.set(0, 5, 0);
scene.add(mesh);

// Fracture the mesh
const options = new VoronoiFractureOptions({ fragmentCount: 30 });
const fragments = mesh.fracture(options);

// Add fragments to scene
fragments.forEach(fragment => scene.add(fragment));

// Hide original mesh
mesh.visible = false;
```

### Materials and Fragment Groups

Fragments support dual materials - one for the original outer surface, and another for the newly created internal faces:

```typescript
const outerMaterial = new THREE.MeshStandardMaterial({
  color: 0xff6644,
  roughness: 0.7,
  metalness: 0.1
});

const innerMaterial = new THREE.MeshStandardMaterial({
  color: 0xdddddd,
  roughness: 0.9,
  metalness: 0.0
});

const fragmentGeometries = fracture(geometry, options);

fragmentGeometries.forEach((fragmentGeometry) => {
  // Material array: [outer, inner]
  const fragment = new THREE.Mesh(fragmentGeometry, [outerMaterial, innerMaterial]);
  scene.add(fragment);
});
```

The geometry includes two material groups:
- **Group 0**: Original outer surface faces
- **Group 1**: Newly created internal fracture faces

## Using Callbacks for Custom Fragment Setup

The `DestructibleMesh` methods provide callbacks that are called for each generated fragment, making it easy to add physics, visual effects, or custom behaviors:

### Fracture Callbacks

```typescript
const mesh = new DestructibleMesh(geometry, material);

const options = new VoronoiFractureOptions({ fragmentCount: 50 });

const fragments = mesh.fracture(
  options,
  // onFragment callback - called for each fragment as it's created
  (fragment, index) => {
    // Setup custom materials
    fragment.material = [outerMaterial, innerMaterial];
    fragment.castShadow = true;
    fragment.receiveShadow = true;

    // Add physics (see physics section below)
    physics.add(fragment, {
      type: "dynamic",
      collider: "convexHull",
      restitution: 0.3,
      friction: 0.5
    });

    // Apply initial velocity or impulse
    const body = physics.getBody(fragment);
    if (body) {
      body.applyImpulse({ x: 0, y: 2, z: 0 });
    }

    // Store custom data
    fragment.userData.fragmentIndex = index;
    fragment.userData.spawnTime = Date.now();
  },
  // onComplete callback - called once after all fragments are created
  () => {
    console.log(`Created ${fragments.length} fragments`);
    playDestructionSound();
  }
);
```

### Slice Callbacks

```typescript
const mesh = new DestructibleMesh(geometry, material);

const pieces = mesh.slice(
  sliceNormal,
  sliceOrigin,
  options,
  // onSlice callback - called for each piece (typically 2 pieces)
  (piece, index) => {
    // Setup materials
    piece.material = [outerMaterial, innerMaterial];

    // Add physics
    physics.add(piece, {
      type: "dynamic",
      collider: "convexHull",
      restitution: 0.2
    });

    // Apply separation force
    const direction = index === 0 ? sliceNormal : sliceNormal.clone().negate();
    const body = physics.getBody(piece);
    if (body) {
      body.applyImpulse({
        x: direction.x * 2,
        y: direction.y * 2,
        z: direction.z * 2
      });
    }
  },
  // onComplete callback
  () => {
    console.log("Slice complete");
  }
);
```

## How Do I Add Physics to This?

Three-pinata handles the geometry, but physics integration is up to you. The demo uses [Rapier](https://rapier.rs/) - a high-performance physics engine - but you can use any physics library.

### Physics Integration Overview

The basic pattern:
1. Create a physics world
2. When fragments are created, add them to the physics world
3. Each frame, step the physics simulation and sync fragment positions

### Example Physics Setup (using Rapier)

Here's a simplified version of the physics code from the demo:

```typescript
import RAPIER from "@dimforge/rapier3d";

// Initialize Rapier
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); // Gravity

// Track physics bodies
const physicsMap = new WeakMap<THREE.Object3D, RAPIER.RigidBody>();

// Add physics to a fragment
function addPhysics(fragment: THREE.Mesh) {
  // Create rigid body
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(fragment.position.x, fragment.position.y, fragment.position.z)
    .setRotation({
      x: fragment.quaternion.x,
      y: fragment.quaternion.y,
      z: fragment.quaternion.z,
      w: fragment.quaternion.w
    })
    .setLinearDamping(0.5)    // Slow down over time
    .setAngularDamping(0.5);  // Slow rotation over time

  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // Create convex hull collider from mesh geometry
  const vertices = fragment.geometry.getAttribute("position").array;
  const colliderDesc = RAPIER.ColliderDesc.convexHull(vertices)
    .setRestitution(0.3)  // Bounciness
    .setFriction(0.5);     // Friction

  world.createCollider(colliderDesc, rigidBody);

  // Store reference
  physicsMap.set(fragment, rigidBody);
}

// Update physics each frame
function updatePhysics() {
  // Step simulation
  world.step();

  // Sync Three.js objects with physics
  physicsMap.forEach((rigidBody, fragment) => {
    const position = rigidBody.translation();
    const rotation = rigidBody.rotation();

    fragment.position.set(position.x, position.y, position.z);
    fragment.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  });
}

// Usage with DestructibleMesh
const mesh = new DestructibleMesh(geometry, material);
scene.add(mesh);

// When user clicks to fracture...
const options = new VoronoiFractureOptions({ fragmentCount: 50 });
const fragments = mesh.fracture(
  options,
  (fragment) => {
    // Add physics to each fragment
    addPhysics(fragment);
    fragment.castShadow = true;
  }
);

// Add fragments to scene
fragments.forEach(f => scene.add(f));
mesh.visible = false;

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  updatePhysics();
  renderer.render(scene, camera);
}
```

### Demo Physics Code

For a complete, production-ready implementation, check out these files in the demo:

**`demo/src/physics/PhysicsWorld.ts`** - Complete physics world wrapper
- Manages Rapier world instance
- Provides clean API for adding/removing physics bodies
- Handles convex hull generation with fallbacks
- Configures collision detection and solver parameters
- Automatic synchronization of Three.js objects with physics

**`demo/src/physics/PhysicsBody.ts`** - Physics body wrapper
- Wraps Rapier rigid body with clean interface
- Provides methods for applying forces, impulses, and velocities
- Handles parent-child transform hierarchies
- Auto-syncs position/rotation each frame

**`demo/src/scenes/SmashingScene.ts`** - Real-world fracturing example (lines 162-176, 370-376)
```typescript
// From SmashingScene.ts - Adding physics to fragments
this.fragments = this.object.fracture(
  this.voronoiFractureOptions,
  (fragment) => {
    fragment.material = [this.objectMaterial, this.insideMaterial];
    fragment.castShadow = true;

    // Add physics using the PhysicsWorld helper
    this.physics.add(fragment, {
      type: "dynamic",
      collider: "convexHull",  // Creates convex hull from geometry
      restitution: 0.3,         // Bounciness
    });
  }
);
```

The demo's `PhysicsWorld` class is designed to be copy-pasteable into your projects. Key features:
- Automatically creates convex hull colliders from mesh geometry
- Handles error cases (insufficient vertices, degenerate geometry)
- Falls back to sphere colliders if convex hull fails
- Supports dynamic, static, and kinematic body types
- Configurable damping, friction, and restitution

### Tips for Physics Integration

1. **Convex Hull Colliders**: Each fragment should use a convex hull collider derived from its geometry for accurate physics
2. **Damping**: Use linear/angular damping to slow down fragments over time (prevents endless bouncing)
3. **Sleeping**: Let physics bodies "sleep" when they're motionless to improve performance
4. **Mass**: For many small fragments, reduce individual mass to prevent overwhelming forces
5. **Collision Groups**: Use collision groups to prevent fragments from the same object from colliding initially
6. **Performance**: With 50+ fragments, consider despawning distant or stationary fragments after a delay

## Common Usage Scenarios

### Scenario 1: Click to Smash

Fracture an object when the user clicks on it:

```typescript
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {
  // Get mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Raycast to find clicked object
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(mesh);

  if (intersects.length > 0) {
    const impactPoint = mesh.worldToLocal(intersects[0].point.clone());

    // Fracture with impact at click location
    const options = new VoronoiFractureOptions({
      fragmentCount: 50,
      impactPoint: impactPoint,
      impactRadius: 0.8
    });

    const fragments = mesh.fracture(options, (fragment) => {
      fragment.material = [outerMaterial, innerMaterial];
      physics.add(fragment, { type: "dynamic", collider: "convexHull" });
    });

    fragments.forEach(f => scene.add(f));
    mesh.visible = false;
  }
});
```

### Scenario 2: Bullet Hit Detection

Fracture when a projectile hits an object:

```typescript
function onBulletHit(mesh: DestructibleMesh, hitPoint: THREE.Vector3) {
  const localHitPoint = mesh.worldToLocal(hitPoint.clone());

  const options = new VoronoiFractureOptions({
    fragmentCount: 30,
    mode: "2.5D",  // Faster for frequent hits
    impactPoint: localHitPoint,
    impactRadius: 0.5
  });

  const fragments = mesh.fracture(options, (fragment) => {
    fragment.material = [mesh.material, innerMaterial];

    // Add physics with initial velocity away from impact
    physics.add(fragment, {
      type: "dynamic",
      collider: "convexHull",
      restitution: 0.2
    });

    const body = physics.getBody(fragment);
    if (body) {
      const direction = fragment.position.clone().sub(hitPoint).normalize();
      body.applyImpulse({
        x: direction.x * 5,
        y: direction.y * 5,
        z: direction.z * 5
      });
    }
  });

  fragments.forEach(f => scene.add(f));
  scene.remove(mesh);
}
```

### Scenario 3: Sword Slash

Create a slicing effect along a blade's path:

```typescript
function performSlash(mesh: DestructibleMesh, slashStart: THREE.Vector3, slashEnd: THREE.Vector3) {
  // Calculate slice plane from slash motion
  const slashDirection = slashEnd.clone().sub(slashStart).normalize();
  const upVector = new THREE.Vector3(0, 1, 0);
  const sliceNormal = new THREE.Vector3().crossVectors(slashDirection, upVector).normalize();

  // Use midpoint as slice origin
  const sliceOrigin = slashStart.clone().add(slashEnd).multiplyScalar(0.5);

  const options = new SliceOptions();
  options.enableReslicing = true;

  const pieces = mesh.sliceWorld(sliceNormal, sliceOrigin, options, (piece, index) => {
    piece.material = [outerMaterial, innerMaterial];

    physics.add(piece, {
      type: "dynamic",
      collider: "convexHull"
    });

    // Apply force perpendicular to slash
    const body = physics.getBody(piece);
    if (body) {
      const force = sliceNormal.clone().multiplyScalar(index === 0 ? 3 : -3);
      body.applyImpulse({ x: force.x, y: force.y, z: force.z });
    }
  });

  pieces.forEach(p => scene.add(p));
  mesh.visible = false;
}
```

### Scenario 4: Progressive Destruction

Re-fracture fragments on subsequent hits:

```typescript
const fragments: THREE.Mesh[] = [];

function handleHit(object: THREE.Object3D, hitPoint: THREE.Vector3) {
  if (object instanceof DestructibleMesh) {
    // First hit - fracture into large pieces
    const options = new VoronoiFractureOptions({ fragmentCount: 10 });
    const newFragments = object.fracture(options, (fragment) => {
      fragment.material = [outerMaterial, innerMaterial];
      physics.add(fragment, { type: "dynamic", collider: "convexHull" });

      // Mark as destructible
      fragment.userData.canRefracture = true;
      fragment.userData.hitCount = 0;
    });

    newFragments.forEach(f => {
      scene.add(f);
      fragments.push(f);
    });

    object.visible = false;
  }
  else if (object.userData.canRefracture && object instanceof THREE.Mesh) {
    // Subsequent hit - fracture fragment further
    object.userData.hitCount++;

    if (object.userData.hitCount >= 2) {
      // Convert to smaller fragments
      const fragmentMesh = new DestructibleMesh(object.geometry, object.material);
      fragmentMesh.position.copy(object.position);
      fragmentMesh.quaternion.copy(object.quaternion);

      const options = new VoronoiFractureOptions({ fragmentCount: 8 });
      const localHit = fragmentMesh.worldToLocal(hitPoint.clone());
      options.impactPoint = localHit;

      const smallerFragments = fragmentMesh.fracture(options, (fragment) => {
        fragment.material = object.material;
        physics.add(fragment, { type: "dynamic", collider: "convexHull" });
        fragment.userData.canRefracture = false; // Can't break further
      });

      smallerFragments.forEach(f => {
        scene.add(f);
        fragments.push(f);
      });

      // Remove old fragment
      scene.remove(object);
      physics.remove(object);
      const index = fragments.indexOf(object);
      if (index > -1) fragments.splice(index, 1);
    }
  }
}
```

### Scenario 5: Exploding from Within

Create an explosion effect:

```typescript
function explode(mesh: DestructibleMesh, explosionCenter: THREE.Vector3, force: number = 10) {
  const options = new VoronoiFractureOptions({
    fragmentCount: 50,
    mode: "3D"
  });

  const fragments = mesh.fracture(options, (fragment) => {
    fragment.material = [outerMaterial, innerMaterial];
    physics.add(fragment, {
      type: "dynamic",
      collider: "convexHull",
      restitution: 0.4
    });

    // Apply radial impulse from explosion center
    const body = physics.getBody(fragment);
    if (body) {
      const direction = fragment.position.clone().sub(explosionCenter).normalize();
      const distance = fragment.position.distanceTo(explosionCenter);
      const impulse = direction.multiplyScalar(force / Math.max(distance, 0.5));

      body.applyImpulse({
        x: impulse.x,
        y: impulse.y,
        z: impulse.z
      });
    }
  });

  fragments.forEach(f => scene.add(f));
  mesh.visible = false;
}
```

## Performance Considerations

- **Fragment Count**: 10-50 fragments is optimal for real-time. 100+ fragments may cause lag on slower devices
- **Pre-fracturing**: Fracture objects ahead of time and keep fragments hidden for instant destruction effects
- **2.5D vs 3D**: Use 2.5D mode when possible - it's significantly faster
- **Convex Mode**: If your mesh is convex (sphere, cube), use `fractureMode: "Convex"` for better performance
- **Physics**: More fragments = more physics bodies. Consider despawning fragments after they settle
- **Approximation**: For very high fragment counts (>50), consider enabling `useApproximation` in VoronoiFractureOptions

## Limitations

- **Manifold Requirement**: Meshes must be watertight (no holes or self-intersecting geometry). Non-manifold meshes will produce erroneous results
- **Single Material Group**: Currently only supports `BufferGeometry` with a single material group (the library adds a second group for internal faces)
- **Memory**: Each fragment is a new geometry, which uses memory. Plan accordingly for games with many destructible objects
- **Physics Required**: The library only handles geometry - you must add your own physics integration for realistic motion

## Building the Library

The library can be built by running:

```bash
npm run build:lib
```

This generates several build products:
- `three-pinata.es.js` - ES Module for use with Three.js
- `three-pinata.umd.js` - UMD Module for use with Three.js
- `three-pinata.core.es.js` - Core fracture library without Three.js dependencies
- `three-pinata.core.umd.js` - Core library UMD build

The core libraries are for non-Three.js 3D applications (e.g., PlayCanvas).

## Running the Demo Locally

1. Clone the repository
2. Run the following commands in the root folder:

```bash
npm install
npm run dev
```

3. Open http://localhost:5173/ in your browser

## API Reference

### Functions

#### `fracture(geometry, options)`
Low-level function to fracture a BufferGeometry.
- **geometry**: THREE.BufferGeometry to fracture
- **options**: FractureOptions or VoronoiFractureOptions
- **returns**: Array of THREE.BufferGeometry fragments

### Classes

#### `DestructibleMesh`
Extends THREE.Mesh with fracturing and slicing capabilities.

**Methods:**
- `fracture(options, onFragment?, onComplete?)` - Fracture the mesh into fragments
- `slice(normal, origin, options?, onSlice?, onComplete?)` - Slice the mesh along a plane (local space)
- `sliceWorld(normal, origin, options?, onSlice?, onComplete?)` - Slice the mesh along a plane (world space)
- `dispose()` - Clean up geometry and materials

#### `VoronoiFractureOptions`
Configuration for Voronoi fracturing.

**Properties:**
- `fragmentCount: number` - Number of fragments (default: 50)
- `mode: "3D" | "2.5D"` - Fracture mode (default: "3D")
- `fractureMode: "Convex" | "Non-Convex"` - Optimization mode (default: "Non-Convex")
- `detectIsolatedFragments: boolean` - Split disconnected pieces (default: false)
- `impactPoint?: Vector3` - Optional impact location for density control
- `impactRadius?: number` - Radius around impact point
- `seedPoints?: Vector3[]` - Custom seed points for Voronoi cells
- `textureScale: Vector2` - UV scale for internal faces (default: 1,1)
- `textureOffset: Vector2` - UV offset for internal faces (default: 0,0)
- `seed?: number` - Random seed for reproducibility

#### `FractureOptions`
Configuration for simple plane-based fracturing.

**Properties:**
- `fragmentCount: number` - Number of fragments (default: 50)
- `fractureMode: "Convex" | "Non-Convex"` - Optimization mode (default: "Non-Convex")
- `fracturePlanes: {x, y, z}` - Which axes to fracture along (default: all true)
- `textureScale: Vector2` - UV scale for internal faces
- `textureOffset: Vector2` - UV offset for internal faces
- `seed?: number` - Random seed for reproducibility

#### `SliceOptions`
Configuration for slicing operations.

**Properties:**
- `enableReslicing: boolean` - Allow slicing pieces again (default: false)
- `maxResliceCount: number` - Maximum times a piece can be resliced (default: 1)
- `detectFloatingFragments: boolean` - Split disconnected pieces for non-convex meshes (default: false)
- `insideMaterial?: Material` - Material for internal faces
- `textureScale: Vector2` - UV scale for internal faces
- `textureOffset: Vector2` - UV offset for internal faces
- `invokeCallbacks: boolean` - Whether to invoke callbacks for reslicing (default: false)

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- Original [OpenFracture](https://github.com/dgreenheck/OpenFracture) Unity library
- [Three.js](https://threejs.org/) for 3D rendering
- [Rapier](https://www.rapier.rs/) for physics simulation in the demo

## Support

If you find any bugs or have feature requests, please create an issue in the [issue tracker](https://github.com/dgreenheck/three-pinata/issues).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
