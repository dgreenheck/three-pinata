import { Vector3 } from "./Vector3";

export class Box3 {
  min: Vector3;
  max: Vector3;

  constructor(
    min: Vector3 = new Vector3(Infinity, Infinity, Infinity),
    max: Vector3 = new Vector3(-Infinity, -Infinity, -Infinity),
  ) {
    this.min = min;
    this.max = max;
  }

  set(min: Vector3, max: Vector3): this {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }

  setFromPoints(points: Vector3[]): this {
    this.makeEmpty();

    for (let i = 0; i < points.length; i++) {
      this.expandByPoint(points[i]);
    }

    return this;
  }

  makeEmpty(): this {
    this.min.x = this.min.y = this.min.z = Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  }

  isEmpty(): boolean {
    return (
      this.max.x < this.min.x ||
      this.max.y < this.min.y ||
      this.max.z < this.min.z
    );
  }

  getCenter(target: Vector3): Vector3 {
    if (this.isEmpty()) {
      return target.set(0, 0, 0);
    }
    return target.copy(this.min).add(this.max).multiplyScalar(0.5);
  }

  getSize(): Vector3 {
    return this.isEmpty()
      ? new Vector3(0, 0, 0)
      : new Vector3().sub(this.max).sub(this.min);
  }

  expandByPoint(point: Vector3): this {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);
    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
    return this;
  }

  expandByVector(vector: Vector3): this {
    this.min.sub(vector);
    this.max.add(vector);
    return this;
  }

  expandByScalar(scalar: number): this {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }

  containsPoint(point: Vector3): boolean {
    return !(
      point.x < this.min.x ||
      point.x > this.max.x ||
      point.y < this.min.y ||
      point.y > this.max.y ||
      point.z < this.min.z ||
      point.z > this.max.z
    );
  }

  containsBox(box: Box3): boolean {
    return (
      this.min.x <= box.min.x &&
      box.max.x <= this.max.x &&
      this.min.y <= box.min.y &&
      box.max.y <= this.max.y &&
      this.min.z <= box.min.z &&
      box.max.z <= this.max.z
    );
  }

  intersectsBox(box: Box3): boolean {
    return !(
      box.max.x < this.min.x ||
      box.min.x > this.max.x ||
      box.max.y < this.min.y ||
      box.min.y > this.max.y ||
      box.max.z < this.min.z ||
      box.min.z > this.max.z
    );
  }

  clone(): Box3 {
    return new Box3().copy(this);
  }

  copy(box: Box3): this {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
}
