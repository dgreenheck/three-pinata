# three-pinata

Three.js library for fracturing and slicing non-convex meshes in real time.

The library provides a simple way to fracture 3D meshes in real-time. The `fracture` function takes a geometry and options, returning an array of fragment geometries that you can use to create individual meshes. The fragments support different materials for outer and inner surfaces.

For physics-based interactions, check out the demo source code which shows how to integrate with Rapier physics engine.

## Live Demo

https://dgreenheck.github.io/three-pinata/

### Running Demo Locally

1. Clone the repo
2. Run the following commands in the root folder

```bash
npm install
npm run dev
```

3. Go to http://localhost:5173/ in your browser.

## Features

- Real-time mesh fracturing and slicing
- Support for non-convex meshes
- Customizable material for fractured faces
- Configurable number of fragments
- TypeScript support

## Installation

To use three-pinata in your project:

```bash
npm install @dgreenheck/three-pinata
```

## Usage

```typescript
import * as THREE from "three";
import { fracture, FractureOptions } from "@dgreenheck/three-pinata";

// Replace with your mesh
const mesh = new THREE.Mesh();

const options = new FractureOption({
  // Maximum number of fragments
  fragmentCount: 50,
  // The local model axes to fracture along
  fracturePlanes: {
    x: true,
    y: true,
    z: true,
  },
  // CONVEX or NON_CONVEX
  fractureMode: FractureMode.NON_CONVEX,
  // Scale factor for texture coordinates
  textureScale: new THREE.Vector2(1, 1),
  // Offset for texture coordinates
  textureOffset: new THREE.Vector2(0, 0),
});

// Fracture the geometry into fragments
const fragments = fracture(mesh.geometry, options);

// Each fragment is a THREE.BufferGeometry that you can use to create meshes
fragments.forEach((fragment) => {
  const mesh = new THREE.Mesh(
    fragment,
    // Use an array of materials for outside/inside
    [outerMaterial, innerMaterial],
  );
  scene.add(mesh);
});
```

## Restrictions

- Mesh geometry must be "watertight" i.e., no holes or self-intersecting geometry. Non-watertight geometry will result in erroneous faces being generated during the fragmentation process.
- Currently only supports `BufferGeometry` with a single group. The generated fragment `BufferGeometry` will contain two groups—the first group containing the subset of original geometry for that fragment and the second group the new fractured geometry.

## License

This project is licensed under the [MIT License](LICENSE).

## Acknowledgments

- Original [OpenFracture](https://github.com/dgreenheck/OpenFracture) Unity library
- [Three.js](https://threejs.org/) for 3D rendering
- [Rapier](https://www.rapier.rs/) for physics simulation

## Support

If you find any bugs or have feature requests, please create an issue in the [issue tracker](https://github.com/dgreenheck/three-pinata/issues).
