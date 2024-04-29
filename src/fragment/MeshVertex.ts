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

  equals(other: MeshVertex): boolean {
    return Math.abs(this.position.x - other.position.x) < 1E-9 &&
           Math.abs(this.position.y - other.position.y) < 1E-9 &&
           Math.abs(this.position.z - other.position.z) < 1E-9;
  }

  getHashCode(): number {
    // Simple hash code function based on position.
    // This is a placeholder implementation.
    const hash = (this.position.x * 397) ^ (this.position.y * 397) ^ (this.position.z * 397);
    return hash;
  }

  toString(): string {
    return `Position = ${this.position.x}, ${this.position.y}, ${this.position.z}, Normal = ${this.normal.x}, ${this.normal.y}, ${this.normal.z}, UV = ${this.uv.x}, ${this.uv.y}`;
  }
}