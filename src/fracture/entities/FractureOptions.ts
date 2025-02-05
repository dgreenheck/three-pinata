import { Vector2 } from "../utils/Vector2";
import { Material, MeshBasicMaterial } from "three";

export class FractureOptions {
  /**
   * Maximum number of times an object and its children are recursively fractured. Larger fragment counts will result in longer computation times.
   */
  public fragmentCount: number;

  /**
   * Specify which planes to fracture in
   */
  public fracturePlanes: {
    x: boolean;
    y: boolean;
    z: boolean;
  };

  /**
   * Fracturing mode. If set to convex, a faster algorithm will be used under
   * the assumption the the geometry being fractured is convex. If set to
   * non-convex, an algorithm which can handle non-convex geometry will be used
   * at the expensive of performance.
   */
  public fractureMode: "Convex" | "Non-Convex";

  /**
   * The material to use for the inside faces
   */
  public insideMaterial: Material | undefined;

  /**
   * Scale factor to apply to texture coordinates
   */
  public textureScale: Vector2;

  /**
   * Offset to apply to texture coordinates
   */
  public textureOffset: Vector2;

  constructor() {
    this.fragmentCount = 50;
    this.fracturePlanes = { x: true, y: true, z: true };
    this.fractureMode = "Non-Convex";
    this.insideMaterial = new MeshBasicMaterial({ color: 0x0000ff });
    this.textureScale = new Vector2(1, 1);
    this.textureOffset = new Vector2();
  }
}
