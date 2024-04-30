import { Vector2, Material, MeshBasicMaterial } from 'three';

export class FractureOptions {
  /**
   * Maximum number of times an object and its children are recursively fractured. Larger fragment counts will result in longer computation times.
   */
  public fragmentCount: number;

  /**
   * Enables fracturing in the local X plane
   */
  public xAxis: boolean;

  /**
   * Enables fracturing in the local Y plane
   */
  public yAxis: boolean;

  /**
   * Enables fracturing in the local Z plane
   */
  public zAxis: boolean;

  /**
   * Enables detection of "floating" fragments when fracturing non-convex meshes. This setting has no effect for convex meshes and should be disabled.
   */
  public detectFloatingFragments: boolean;

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
    this.fragmentCount = 10;
    this.xAxis = true;
    this.yAxis = true;
    this.zAxis = true;
    this.detectFloatingFragments = false;
    this.insideMaterial = new MeshBasicMaterial({ color: 0x0000ff });
    this.textureScale = new Vector2(1, 1);
    this.textureOffset = new Vector2();
  }
}