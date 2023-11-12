/**
 * Represents an edge constraint between two vertices in the triangulation
 */
export default class EdgeConstraint {
  /**
   * Index of the first end point of the constraint
   */
  v1: number;

  /**
   * Index of the second end point of the constraint
   */
  v2: number;

  /**
   * Index of the triangle prior to the edge crossing (v1 -> v2)
   */
  t1: number;

  /**
   * Index of the triangle after the edge crossing (v1 -> v2)
   */
  t2: number;

  /**
   * Index of the edge on the t1 side
   */
  t1Edge: number;

  /**
   * Creates a new edge constraint with the given end points
   */
  constructor(v1: number, v2: number, triangle1?: number, triangle2?: number, edge1?: number) {
    this.v1 = v1;
    this.v2 = v2;
    this.t1 = triangle1 ?? -1;
    this.t2 = triangle2 ?? - 1;
    this.t1Edge = edge1 ?? 0;
  }

  /**
   * Determines whether the specified object is equal to the current object
   */
  equals(other: EdgeConstraint): boolean {
    return (this.v1 === other.v1 && this.v2 === other.v2) ||
      (this.v1 === other.v2 && this.v2 === other.v1);
  }

  /**
   * Serves as the default hash function
   */
  getHashCode(): number {
    let smaller = Math.min(this.v1, this.v2);
    let larger = Math.max(this.v1, this.v2);

    // Prime numbers for hash calculation
    let hash = 17;
    hash = hash * 31 + smaller; // Assuming v1, v2 are numbers, no need for .getHashCode()
    hash = hash * 31 + larger;
    return hash;
  }

  /**
   * Returns a string that represents the current object
   */
  toString(): string {
    return `Edge: T${this.t1}->T${this.t2} (V${this.v1}->V${this.v2})`;
  }
}