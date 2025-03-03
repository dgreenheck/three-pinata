import { Vector2 } from "../utils/Vector2";

/**
 * Options for the fracture operation
 */
export class FractureOptions {
  /**
   * Maximum number of times an object and its children are recursively fractured. Larger fragment counts will result in longer computation times.
   */
  public fragmentCount: number = 50;

  /**
   * Specify which planes to fracture in
   */
  public fracturePlanes: {
    x: boolean;
    y: boolean;
    z: boolean;
  } = { x: true, y: true, z: true };

  /**
   * Fracturing mode. If set to convex, a faster algorithm will be used under
   * the assumption the the geometry being fractured is convex. If set to
   * non-convex, an algorithm which can handle non-convex geometry will be used
   * at the expensive of performance.
   */
  public fractureMode: "Convex" | "Non-Convex" = "Non-Convex";

  /**
   * Scale factor to apply to texture coordinates
   */
  public textureScale: Vector2 = new Vector2(1, 1);

  /**
   * Offset to apply to texture coordinates
   */
  public textureOffset: Vector2 = new Vector2();

  constructor({
    fragmentCount,
    fracturePlanes,
    fractureMode,
    textureScale,
    textureOffset,
  }: {
    fragmentCount?: number;
    fracturePlanes?: {
      x: boolean;
      y: boolean;
      z: boolean;
    };
    fractureMode?: "Convex" | "Non-Convex";
    textureScale?: Vector2;
    textureOffset?: Vector2;
  } = {}) {
    if (fragmentCount) {
      this.fragmentCount = fragmentCount;
    }

    if (fracturePlanes) {
      this.fracturePlanes = fracturePlanes;
    }

    if (fractureMode) {
      this.fractureMode = fractureMode;
    }

    if (textureScale) {
      this.textureScale = textureScale;
    }

    if (textureOffset) {
      this.textureOffset = textureOffset;
    }
  }
}
