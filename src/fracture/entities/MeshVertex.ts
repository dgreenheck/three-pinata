import { Vector2, Vector3 } from "three";

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
   * Uses Cantor pairing to hash vertex position into a unique integer
   * @param inverseTolerance The inverse of the tolerance used for spatial hashing
   * @returns
   */
  hash(inverseTolerance: number = 1e6): number {
    // Use inverse so we can multiply instead of divide to save a few ops
    const x = Math.floor(this.position.x * inverseTolerance);
    const y = Math.floor(this.position.y * inverseTolerance);
    const z = Math.floor(this.position.z * inverseTolerance);
    const xy = 0.5 * ((x + y) * (x + y + 1)) + y; // Pairing x and y
    return (0.5 * ((xy + z) * (xy + z + 1))) / 2 + z;
  }

  /**
   * Returns true if this vertex and another vertex share the same position
   * @param other
   * @returns
   */
  equals(other: MeshVertex, tolerance: number = 1e-9): boolean {
    return this.hash(tolerance) === other.hash(tolerance);
  }

  toString(): string {
    return `Position = ${this.position.x}, ${this.position.y}, ${this.position.z}, Normal = ${this.normal.x}, ${this.normal.y}, ${this.normal.z}, UV = ${this.uv.x}, ${this.uv.y}`;
  }
}
