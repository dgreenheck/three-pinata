import { Material, Vector2 } from "three";

export class SliceOptions {
  /**
   * Enables reslicing of fragments.
   */
  public enableReslicing: boolean;

  /**
   * Maximum number of times a fragment can be re-sliced.
   */
  public maxResliceCount: number;

  /**
   * Enables detection of "floating" fragments when slicing non-convex meshes. This setting has no effect for convex meshes and should be disabled.
   */
  public detectFloatingFragments: boolean;

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

  /**
   * Enable if re-slicing should also invoke the callback functions.
   */
  public invokeCallbacks: boolean;

  constructor() {
    this.enableReslicing = false;
    this.maxResliceCount = 1;
    this.detectFloatingFragments = false;
    this.insideMaterial = undefined;
    this.textureScale = new Vector2(1, 1);
    this.textureOffset = new Vector2();
    this.invokeCallbacks = false;
  }
}
