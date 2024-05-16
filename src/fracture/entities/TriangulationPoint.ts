import { Vector2 } from "three";
import { IBinSortable } from "../utils/BinSort";

/**
 * This data structure is used to represent a point during triangulation.
 */
export default class TriangulationPoint implements IBinSortable {
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
  index: number;

  /**
   * Instantiates a new triangulation point
   * @param index The index of the point in the original point list
   * @param coords The 2D coordinates of the point in the triangulation plane
   */
  constructor(index: number, coords: Vector2) {
    this.index = index;
    this.coords = coords;
    this.bin = 0;
  }

  toString() {
    return `${this.coords} -> ${this.bin}`;
  }
}
