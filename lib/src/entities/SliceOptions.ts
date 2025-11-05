import { Material, Vector2 } from "three";

export class SliceOptions {
  /**
   * The material to use for the inside faces.
   */
  public insideMaterial: Material | undefined;

  /**
   * Scale factor to apply to texture coordinates.
   */
  public textureScale: Vector2;

  /**
   * Offset to apply to texture coordinates.
   */
  public textureOffset: Vector2;

  constructor() {
    this.insideMaterial = undefined;
    this.textureScale = new Vector2(1, 1);
    this.textureOffset = new Vector2();
  }
}
