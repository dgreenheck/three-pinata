import * as THREE from "three";

export interface Demo {
  scene: THREE.Scene;
  update: (dt: number) => void;
  destroy: () => void;
  loadScene: () => Promise<THREE.Scene>;
  initialize: () => Promise<void>;
}
