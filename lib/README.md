# three-pinata

![NPM Version](https://img.shields.io/npm/v/%40dgreenheck%2Fthree-pinata)
![NPM Downloads](https://img.shields.io/npm/dw/%40dgreenheck%2Fthree-pinata)
![GitHub Repo stars](https://img.shields.io/github/stars/dgreenheck/three-pinata)
![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/dangreenheck)
![YouTube Channel Subscribers](https://img.shields.io/youtube/channel/subscribers/UCrdx_EU_Wx8_uBfqO0cI-9Q)

<p align="center">
<img src="https://github.com/user-attachments/assets/abf37715-d631-4cc6-b31a-1ea9a784f215" />
</p>

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

## Building the Library

The library can be built by running `npm run build:lib`.

This will generate several build products.

- `three-pinata.core.es.js` - The core fracture library packaged as an ES Module without Three.js dependencies
- `three-pinata.core.umd.js` - The core fracture library packaged as a UMD Module without Three.js dependencies
- `three-pinata.es.js` - The fracture library packaged as an ES Module for use with Three.js
- `three-pinata.umd.js` - The fracture library packaged as a UMD Module for use with Three.js

The primary difference is the `three-pinata` (non-core) library includes some additional helper methods
for fracturing and slicing `THREE.Geometry` directly to avoid needing to pass in the raw geometry data.

The core libraries are for 3D applications that do not use Three.js, e.g., PlayCanvas.

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

<p align="center">
<img src="https://github.com/user-attachments/assets/4427f2ab-4e6d-4eb1-8f6a-f549feb1c9d0" style="width:600px;" />
</p>

Below is a minimal working example of a sphere being fractured into many pieces and the positon of the fragments are animated over time.

```typescript
import * as THREE from "three";
import * as PINATA from "@dgreenheck/three-pinata";

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.z = 5;

const geometry = new THREE.SphereGeometry(1, 32, 32);

const outerMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
const innerMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

const fragmentGroup = new THREE.Group();

const options = new PINATA.FractureOptions();
options.fragmentCount = 50;

// Fracture sphere
PINATA.fracture(geometry, options).forEach((fragment) => {
  const fragmentMesh = new THREE.Mesh(fragment, [outerMaterial, innerMaterial]);
  fragment.computeBoundingBox();
  fragment.boundingBox.getCenter(fragmentMesh.position);
  // Store fragment position in user data so it can be animated later
  fragmentMesh.userData.center = fragmentMesh.position.clone();
  fragmentGroup.add(fragmentMesh);
});

scene.add(fragmentGroup);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

function animate() {
  requestAnimationFrame(animate);
  fragmentGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.position
        .copy(child.userData.center)
        .multiplyScalar(1 + Math.sin(clock.getElapsedTime()));
    }
  });
  renderer.render(scene, camera);
}

animate();
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
