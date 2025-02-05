export class Vector2 {
  x: number;
  y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  copy(v: Vector2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v: Vector2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  addScalar(s: number): this {
    this.x += s;
    this.y += s;
    return this;
  }

  sub(v: Vector2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  multiplyScalar(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  divideScalar(scalar: number): this {
    return this.multiplyScalar(1 / scalar);
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): this {
    return this.divideScalar(this.length() || 1);
  }
}
