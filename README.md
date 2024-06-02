# three-pinata

Three.js library for fracturing and slicing non-convex meshes in real time.

This is a Typescript port of the [OpenFracture](https://github.com/dgreenheck/OpenFracture) library I wrote for Unity several years ago.

The demo app utilizes [Rapier](https://www.rapier.rs/docs/user_guides/javascript/getting_started_js) for the collision detection and physics.

# Live Demo

https://dgreenheck.github.io/three-pinata/

# Running Demo Locally

1. Clone the repo
2. Run the following commands in the root folder

```
npm install
npm run dev
```

2. Go to http://127.0.0.1:5173/three-pinata/ in your browser.

# Documentation

Coming soon!

# Todo

- Improved demo
- Offload computation to web workers
- Handle multiple geometry groups
- Support for meshes with tangent data
