import { init } from "./app";

// Dynamically import the Rapier WASM module
import("@dimforge/rapier3d").then((RAPIER) => {
  init(RAPIER);
});
