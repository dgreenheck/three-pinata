import { Vector2 } from "../utils/Vector2";
import { Vector3 } from "../utils/Vector3";
import { hash3 } from "../utils/MathUtils";

/**
 * Data structure containing position/normal/UV data for a single vertex
 */
export default class MeshVertex {
  position: Vector3;
  normal: Vector3;
  uv: Vector2;

  constructor(
    position: Vector3 = new Vector3(),
    normal: Vector3 = new Vector3(),
    uv: Vector2 = new Vector2(),
  ) {
    this.position = position;
    this.normal = normal;
    this.uv = uv;
  }

  /**
   * Returns true if this vertex and another vertex share the same position
   * @param other
   * @returns
   */
  equals(other: MeshVertex): boolean {
    return hash3(this.position) === hash3(other.position);
  }

  toString(): string {
    return `Position = ${this.position.x}, ${this.position.y}, ${this.position.z}, Normal = ${this.normal.x}, ${this.normal.y}, ${this.normal.z}, UV = ${this.uv.x}, ${this.uv.y}`;
  }
}
