# three-pinata

![NPM Version](https://img.shields.io/npm/v/%40dgreenheck%2Fthree-pinata)
![NPM Downloads](https://img.shields.io/npm/dw/%40dgreenheck%2Fthree-pinata)
![GitHub Repo stars](https://img.shields.io/github/stars/dgreenheck/three-pinata)
![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/dangreenheck)
![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCrdx_EU_Wx8_uBfqO0cI-9Q)

<p align="center">
<img src="https://github.com/user-attachments/assets/66876fed-9779-462b-a02f-b9da54ad5176" />
</p>

**Real-time mesh fracturing and slicing for Three.js**

Three-pinata is a library that enables you to fracture and slice 3D meshes in real-time directly in the browser. Whether you're building a destruction physics game, an interactive art piece, or a scientific visualization, three-pinata provides the tools you need to break things beautifully.

## Features

- **Voronoi Fracturing** - Natural-looking fracture patterns with 3D and 2.5D modes
- **Impact-Based Fracturing** - Concentrate fragments around impact points for realistic destruction
- **Refracturing** - Fracture fragments multiple times for progressive destruction
- **Plane Slicing** - Slice meshes along arbitrary planes in local or world space
- **Dual Materials** - Separate materials for outer surfaces and internal fracture faces
- **Custom Seed Points** - Full control over fracture patterns with custom Voronoi seeds
- **UV Mapping** - Automatic UV generation for internal faces with configurable scale and offset
- **TypeScript Support** - Full type definitions included
- **Zero Dependencies** - Only requires Three.js as a peer dependency

## Live Demo

Check out the interactive demo: https://three-pinata-demo.vercel.app/

## Installation

```bash
npm install @dgreenheck/three-pinata
```

Requires Three.js >= 0.158.0 as a peer dependency.

## Quick Start

```typescript
import * as THREE from "three";
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

// Setup scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create materials
const outerMaterial = new THREE.MeshStandardMaterial({ color: 0x4a90e2 });
const innerMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b6b });

// Create destructible mesh
const geometry = new THREE.SphereGeometry(1, 32, 32);
const mesh = new DestructibleMesh(geometry, outerMaterial);
scene.add(mesh);

// Fracture the mesh
const options = new FractureOptions({
  fractureMethod: "voronoi",
  fragmentCount: 50,
  voronoiOptions: {
    mode: "3D",
  },
});
const fragments = mesh.fracture(
  options,
  (fragment) => {
    // Setup each fragment
    fragment.material = [outerMaterial, innerMaterial];
    scene.add(fragment);
  }
);

// Hide original mesh
mesh.visible = false;

// Render
renderer.render(scene, camera);
```

## API Reference

### Classes

#### `DestructibleMesh`
Extends `THREE.Mesh` with built-in fracturing and slicing capabilities.

**Constructor:**
```typescript
new DestructibleMesh(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[])
```

**Properties:**
- `refractureCount: number` - Read-only property indicating the number of times this mesh has been refractured (0 for the original mesh, 1 for first generation fragments, etc.)

**Methods:**

##### `fracture(options, onFragment?, onComplete?)`
Fractures the mesh into fragments.
- **Parameters:**
  - `options: FractureOptions` - Fracture configuration
  - `onFragment?: (fragment: DestructibleMesh, index: number) => void` - Optional callback for each fragment
  - `onComplete?: () => void` - Optional callback when fracturing is complete
- **Returns:** `DestructibleMesh[]` - Array of fragment meshes (NOT added to scene)

##### `slice(sliceNormal, sliceOrigin, options?, onSlice?, onComplete?)`
Slices the mesh along a plane (local space).
- **Parameters:**
  - `sliceNormal: THREE.Vector3` - Slice plane normal (local space)
  - `sliceOrigin: THREE.Vector3` - Point on slice plane (local space)
  - `options?: SliceOptions` - Slice configuration
  - `onSlice?: (piece: DestructibleMesh, index: number) => void` - Optional callback for each piece
  - `onComplete?: () => void` - Optional callback when slicing is complete
- **Returns:** `DestructibleMesh[]` - Array of sliced pieces (NOT added to scene)

##### `sliceWorld(worldNormal, worldOrigin, options?, onSlice?, onComplete?)`
Slices the mesh along a plane (world space).
- **Parameters:**
  - `worldNormal: THREE.Vector3` - Slice plane normal (world space)
  - `worldOrigin: THREE.Vector3` - Point on slice plane (world space)
  - `options?: SliceOptions` - Slice configuration
  - `onSlice?: (piece: DestructibleMesh, index: number) => void` - Optional callback for each piece
  - `onComplete?: () => void` - Optional callback when slicing is complete
- **Returns:** `DestructibleMesh[]` - Array of sliced pieces (NOT added to scene)

##### `dispose()`
Disposes the mesh geometry and material to free up memory.
- **Parameters:** None
- **Returns:** `void`

### Options

#### `FractureOptions`
Configuration for fracturing operations. Supports both Voronoi and simple plane-based fracturing.

**Constructor:**
```typescript
new FractureOptions({
  fractureMethod?: "voronoi" | "simple";
  fragmentCount?: number;
  voronoiOptions?: VoronoiOptions;
  fracturePlanes?: { x: boolean; y: boolean; z: boolean };
  textureScale?: THREE.Vector2;
  textureOffset?: THREE.Vector2;
  seed?: number;
  refracture?: {
    enabled?: boolean;
    maxRefractures?: number;
    fragmentCount?: number;
  };
})
```

**Properties:**
- `fractureMethod: "voronoi" | "simple"` - Fracture method to use (default: "voronoi")
  - `"voronoi"`: Natural-looking fracture using Voronoi tessellation (requires voronoiOptions)
  - `"simple"`: Simple plane-based fracturing (fast, lower quality)
- `fragmentCount: number` - Number of fragments to create (default: 50)
- `voronoiOptions?: VoronoiOptions` - Voronoi-specific options (required when fractureMethod is "voronoi")
- `fracturePlanes: { x: boolean; y: boolean; z: boolean }` - Simple fracture: which axes to fracture along (default: all true)
- `textureScale: THREE.Vector2` - UV scale for internal faces (default: 1,1)
- `textureOffset: THREE.Vector2` - UV offset for internal faces (default: 0,0)
- `seed?: number` - Random seed for reproducibility
- `refracture?: object` - Refracture settings for progressive destruction
  - `enabled: boolean` - Enable refracturing functionality (default: false)
  - `maxRefractures: number` - Maximum number of additional refractures after initial fracture (default: 2)
  - `fragmentCount: number` - Number of fragments to generate when refracturing (default: 25)

#### `VoronoiOptions`
Voronoi-specific fracture configuration (used within FractureOptions).

**Interface:**
```typescript
{
  mode: "3D" | "2.5D";
  seedPoints?: THREE.Vector3[];
  impactPoint?: THREE.Vector3;
  impactRadius?: number;
  projectionAxis?: "x" | "y" | "z" | "auto";
  projectionNormal?: THREE.Vector3;
  useApproximation?: boolean;
  approximationNeighborCount?: number;
}
```

**Properties:**
- `mode: "3D" | "2.5D"` - Voronoi fracture mode (required)
  - `"3D"`: Full 3D Voronoi tessellation - most realistic, slower
  - `"2.5D"`: 2D Voronoi projected through mesh - faster, good for flat objects
- `seedPoints?: THREE.Vector3[]` - Custom seed points for Voronoi cells (auto-generated if not provided)
- `impactPoint?: THREE.Vector3` - Impact location to concentrate fragments around
- `impactRadius?: number` - Radius around impact point for fragment density
- `projectionAxis?: "x" | "y" | "z" | "auto"` - For 2.5D mode: projection axis (default: "auto")
- `projectionNormal?: THREE.Vector3` - For 2.5D mode: optional projection plane normal
- `useApproximation?: boolean` - Use K-nearest neighbor approximation for performance (default: false)
  - **Warning:** May cause fragment overlap when enabled
- `approximationNeighborCount?: number` - Neighbors to consider when using approximation (default: 12)

#### `SliceOptions`
Configuration for slicing operations.

**Constructor:**
```typescript
new SliceOptions()
```

**Properties:**
- `insideMaterial?: THREE.Material` - Material for internal faces (default: undefined)
- `textureScale: THREE.Vector2` - UV scale for internal faces (default: 1,1)
- `textureOffset: THREE.Vector2` - UV offset for internal faces (default: 0,0)

## Usage Examples

### Basic Fracturing

```typescript
import { DestructibleMesh, FractureOptions } from "@dgreenheck/three-pinata";

const mesh = new DestructibleMesh(geometry, material);
scene.add(mesh);

const options = new FractureOptions({
  fractureMethod: "voronoi",
  fragmentCount: 50,
  voronoiOptions: {
    mode: "3D",
  },
});
const fragments = mesh.fracture(options);

fragments.forEach(fragment => scene.add(fragment));
mesh.visible = false;
```

### Fracturing with Impact Point

```typescript
const options = new FractureOptions({
  fractureMethod: "voronoi",
  fragmentCount: 50,
  voronoiOptions: {
    mode: "3D",
    impactPoint: new THREE.Vector3(0, 1, 0), // Local space
    impactRadius: 0.5,  // Smaller = more concentrated
  },
});

const fragments = mesh.fracture(options);
```

### Refracturing (Progressive Destruction)

Enable refracturing to allow fragments to be fractured again when clicked or hit:

```typescript
const options = new FractureOptions({
  fractureMethod: "voronoi",
  fragmentCount: 50,
  voronoiOptions: {
    mode: "3D",
  },
  refracture: {
    enabled: true,
    maxRefractures: 2,      // Allow up to 2 additional refractures
    fragmentCount: 25,      // Use fewer fragments when refracturing
  },
});

const fragments = mesh.fracture(options);

// Later, you can fracture a fragment again
fragments.forEach(fragment => {
  // Check if fragment can still be refractured
  if (fragment.refractureCount < options.refracture.maxRefractures) {
    const subFragments = fragment.fracture(options);
    // Add sub-fragments to scene...
  }
});
```

### Simple Fracturing

```typescript
const options = new FractureOptions({
  fractureMethod: "simple",
  fragmentCount: 50,
  fracturePlanes: { x: true, y: true, z: true },
});

const fragments = mesh.fracture(options);
```

### Slicing

```typescript
const sliceNormal = new THREE.Vector3(0, 1, 0);  // Horizontal cut
const sliceOrigin = new THREE.Vector3(0, 0, 0);  // At origin

const options = new SliceOptions();
const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

pieces.forEach(piece => scene.add(piece));
mesh.visible = false;
```

### Using Callbacks

```typescript
const fragments = mesh.fracture(
  options,
  (fragment, index) => {
    // Called for each fragment
    fragment.material = [outerMaterial, innerMaterial];
    fragment.castShadow = true;

    // Add physics, apply forces, etc.
    physics.add(fragment, { type: "dynamic" });
  },
  () => {
    // Called when complete
    console.log("Fracturing complete!");
  }
);
```

### Dual Materials

Fragments support two materials - one for the original surface, one for internal fracture faces:

```typescript
const outerMaterial = new THREE.MeshStandardMaterial({ color: 0xff6644 });
const innerMaterial = new THREE.MeshStandardMaterial({ color: 0xdddddd });

const fragments = mesh.fracture(options, (fragment) => {
  // Assign material array: [outer, inner]
  fragment.material = [outerMaterial, innerMaterial];
  scene.add(fragment);
});
```

The fragment geometries include two material groups:
- **Group 0**: Original outer surface faces
- **Group 1**: Newly created internal fracture faces

## Important Requirements

### Manifold/Watertight Meshes

The library requires **manifold (watertight)** meshes - 3D models that form a completely closed, solid volume with no holes or self-intersecting geometry.

**Valid meshes:**
- Sphere, cube, cylinder, torus
- Closed character models
- Properly modeled objects with no gaps

**Invalid meshes:**
- Planes or single-sided surfaces
- Meshes with holes or missing faces
- Open-ended cylinders or boxes
- Overlapping geometry

**How to check/fix in Blender:**
1. Select mesh in Edit mode
2. `Mesh > Clean Up > Make Manifold`
3. Use "3D Print Toolbox" addon to check for issues

**Why this matters:**
- Fracturing algorithms need to determine "inside" vs "outside"
- Non-manifold meshes create ambiguity leading to missing faces, holes, and visual artifacts
- Physics colliders will behave unpredictably with non-manifold fragments

## Physics Integration

The library handles geometry only. For realistic destruction, integrate with a physics engine like [Rapier](https://rapier.rs/).

### Basic Physics Pattern

```typescript
import RAPIER from "@dimforge/rapier3d";

// Initialize physics world
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// Add physics to fragments
const fragments = mesh.fracture(options, (fragment) => {
  // Create rigid body
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(fragment.position.x, fragment.position.y, fragment.position.z);
  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // Create convex hull collider
  const vertices = fragment.geometry.getAttribute("position").array;
  const colliderDesc = RAPIER.ColliderDesc.convexHull(vertices)
    .setRestitution(0.3)
    .setFriction(0.5);
  world.createCollider(colliderDesc, rigidBody);
});

// Update physics each frame
function animate() {
  world.step();
  // Sync Three.js objects with physics...
}
```

For a complete implementation, see:
- `demo/src/physics/PhysicsWorld.ts` - Complete physics wrapper
- `demo/src/physics/PhysicsBody.ts` - Physics body wrapper
- `demo/src/scenes/SmashingScene.ts` - Real-world example

## Performance Tips

- **Fragment Count**: 10-50 fragments is optimal. 100+ may cause lag on slower devices
- **2.5D vs 3D**: Use 2.5D mode when possible - significantly faster
- **Pre-fracture**: Fracture ahead of time and keep fragments hidden for instant destruction
- **Approximation**: For high fragment counts (>50), enable `useApproximation` (may cause overlap)
- **Physics**: More fragments = more physics bodies. Despawn fragments after they settle

## Limitations

- **Manifold Requirement**: Meshes must be watertight (no holes or self-intersecting geometry)
- **Single Material Group**: Only supports BufferGeometry with one material group initially
- **Memory**: Each fragment is a new geometry. Plan accordingly for many destructible objects
- **Physics Required**: Library only handles geometry - you must add physics integration

## Building

```bash
npm run build:lib
```

Generates:
- `three-pinata.es.js` - ES Module
- `three-pinata.umd.js` - UMD Module
- Type declarations

## Running the Demo

```bash
npm install
npm run dev
```

Open http://localhost:5173/

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- Original [OpenFracture](https://github.com/dgreenheck/OpenFracture) Unity library
- [Three.js](https://threejs.org/) for 3D rendering
- [Rapier](https://www.rapier.rs/) for physics in the demo

## Support

For bugs or feature requests, create an issue in the [issue tracker](https://github.com/dgreenheck/three-pinata/issues).

## Contributing

Contributions welcome! Please submit a Pull Request.
