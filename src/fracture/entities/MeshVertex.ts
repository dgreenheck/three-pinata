import { Vector2, Vector3 } from 'three';

/**
 * Data structure containing position/normal/UV data for a single vertex
 */
export default class MeshVertex {
  position: Vector3;
  normal: Vector3;
  uv: Vector2;

  constructor(position: Vector3 = new Vector3(), normal: Vector3 = new Vector3(), uv: Vector2 = new Vector2()) {
    this.position = position;
    this.normal = normal;
    this.uv = uv;
  }

  /**
   * Uses Cantor pairing to hash vertex position into a unique integer
   * @param tolerance The tolerance used for spatial hashing
   * @returns 
   */
  hash(tolerance: number = 1E-9): number {
    const x = Math.floor(this.position.x / tolerance);
    const y = Math.floor(this.position.y / tolerance);
    const z = Math.floor(this.position.z / tolerance);
    const xy = ((x + y) * (x + y + 1) / 2) + y; // Pairing x and y
    return (((xy + z) * (xy + z + 1) / 2) + z);
  }
  
  /**
   * Returns true if this vertex and another vertex share the same position
   * @param other 
   * @returns 
   */
  equals(other: MeshVertex, tolerance: number = 1E-9): boolean {
    return this.hash(tolerance) === other.hash(tolerance);
    /*
    return Math.abs(this.position.x - other.position.x) < 1E-9 &&
           Math.abs(this.position.y - other.position.y) < 1E-9 &&
           Math.abs(this.position.z - other.position.z) < 1E-9;
           */
  }

  toString(): string {
    return `Position = ${this.position.x}, ${this.position.y}, ${this.position.z}, Normal = ${this.normal.x}, ${this.normal.y}, ${this.normal.z}, UV = ${this.uv.x}, ${this.uv.y}`;
  }
}