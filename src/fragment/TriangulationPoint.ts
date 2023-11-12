import { Vector2 } from 'three';

/**
 * This data structure is used to represent a point during triangulation.
 */
export default class TriangulationPoint {
  /**
   * 2D coordinates of the point on the triangulation plane
   */
  coords: Vector2;

  /**
   * Bin used for sorting points in grid
   */
  bin: number;

  /**
   * Original index prior to sorting
   */
  index: number = 0;

  /**
   * Instantiates a new triangulation point
   * @param index The index of the point in the original point list
   * @param coords The 2D coordinates of the point in the triangulation plane
   */
  constructor(index: number, coords: Vector2) {
    this.index = index;
    this.coords = coords;
  }

  toString() {
    return `${this.coords} -> ${this.bin}`;
  }
}