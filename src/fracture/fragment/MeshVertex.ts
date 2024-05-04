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

  toString(): string {
    return `Position = ${this.position.x}, ${this.position.y}, ${this.position.z}, Normal = ${this.normal.x}, ${this.normal.y}, ${this.normal.z}, UV = ${this.uv.x}, ${this.uv.y}`;
  }
}