import * as THREE from "three";
import { FolderApi, Pane } from "tweakpane";

export interface Demo {
  scene: THREE.Scene;
  update: (dt: number) => void;
  destroy: () => void;
  setupGUI: (pane: Pane) => FolderApi;
  load: () => Promise<void>;
}
