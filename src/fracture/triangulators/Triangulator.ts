import { Vector2 } from "../utils/Vector2";
import { Vector3 } from "../utils/Vector3";
import TriangulationPoint from "../entities/TriangulationPoint";
import MeshVertex from "../entities/MeshVertex";
import { BinSort } from "../utils/BinSort";
import { isPointOnRightSideOfLine } from "../utils/MathUtils";

// Constants for triangulation array indices
const V1 = 0; // Vertex 1
const V2 = 1; // Vertex 2
const V3 = 2; // Vertex 3
const E12 = 3; // Adjacency data for edge (V1 -> V2)
const E23 = 4; // Adjacency data for edge (V2 -> V3)
const E31 = 5; // Adjacency data for edge (V3 -> V1)

/**
 * Index for super triangle
 */
const SUPERTRIANGLE = 0;

/**
 * Index for out of bounds triangle (boundary edge)
 */
const OUT_OF_BOUNDS = -1;

/**
 * Logic for triangulating a set of 3D points. Only supports convex polygons.
 */
export class Triangulator {
  /**
   * Number of points to be triangulated (excluding super triangle vertices)
   */
  N: number;

  /**
   * Total number of triangles generated during triangulation
   */
  triangleCount: number;

  /**
   * Triangle vertex and adjacency data
   * Index 0 = Triangle index
   * Index 1 = [V1, V2, V3, E12, E23, E32]
   */
  triangulation: number[][];

  /**
   * Points on the plane to triangulate
   */
  points: TriangulationPoint[];

  /**
   * Array which tracks which triangles should be ignored in the final triangulation
   */
  skipTriangle: boolean[];

  /**
   * Normal of the plane on which the points lie
   */
  normal: Vector3;

  /**
   * Normalization scale factor
   */
  normalizationScaleFactor = 1.0;

  /**
   * Initializes the triangulator with the vertex data to be triangulated
   *
   * @param inputPoints The points to triangulate
   * @param normal The normal of the triangulation plane
   */
  constructor(inputPoints: MeshVertex[], normal: Vector3) {
    this.N = inputPoints.length;

    if (this.N >= 3) {
      this.triangleCount = 2 * this.N + 1;
      this.triangulation = Array.from({ length: this.triangleCount }, () =>
        new Array(6).fill(0),
      );
      this.skipTriangle = new Array<boolean>(this.triangleCount).fill(false);
      this.points = new Array<TriangulationPoint>(this.N + 3); // Extra 3 points used to store super triangle
      this.normal = normal.clone().normalize();

      // Choose two points in the plane as one basis vector
      let e1 = inputPoints[0].position
        .clone()
        .sub(inputPoints[1].position)
        .normalize();
      let e2 = this.normal.clone();
      let e3 = new Vector3();
      e3.crossVectors(e1, e2).normalize();

      // To find the 2nd basis vector, find the largest component and swap with the smallest, negating the largest

      // Project 3D vertex onto the 2D plane
      for (let i = 0; i < this.N; i++) {
        var position = inputPoints[i].position;
        var coords = new Vector2(position.dot(e1), position.dot(e3));
        this.points[i] = new TriangulationPoint(i, coords);
      }
    } else {
      this.triangleCount = 0;
      this.triangulation = [];
      this.skipTriangle = [];
      this.points = [];
      this.normal = new Vector3();
    }
  }

  /**
   * Performs the triangulation
   *
   * @returns Returns an array containing the indices of the triangles, mapped to the list of points passed in during initialization
   */
  triangulate(): number[] {
    // Need at least 3 vertices to triangulate
    if (this.N < 3) {
      return [];
    }

    this.addSuperTriangle();
    this.normalizeCoordinates();
    this.computeTriangulation();
    this.discardTrianglesWithSuperTriangleVertices();

    const triangles: number[] = [];
    for (let i = 0; i < this.triangleCount; i++) {
      // Add all triangles that don't contain a super-triangle vertex
      if (!this.skipTriangle[i]) {
        triangles.push(
          this.triangulation[i][V1],
          this.triangulation[i][V2],
          this.triangulation[i][V3],
        );
      }
    }

    return triangles;
  }

  /**
   * Uniformly scales the 2D coordinates of all the points between [0, 1]
   */
  normalizeCoordinates() {
    // 1) Normalize coordinates. Coordinates are scaled so they lie between 0 and 1
    // The scaling should be uniform so relative positions of points are unchanged
    let xMin = Number.MAX_VALUE;
    let xMax = Number.MIN_VALUE;
    let yMin = Number.MAX_VALUE;
    let yMax = Number.MIN_VALUE;

    // Find min/max points in the set
    for (let i = 0; i < this.N; i++) {
      xMin = Math.min(xMin, this.points[i].coords.x);
      xMax = Math.max(xMax, this.points[i].coords.x);
      yMin = Math.min(yMin, this.points[i].coords.y);
      yMax = Math.max(yMax, this.points[i].coords.y);
    }

    // Normalization coefficient. Using same coefficient for both x & y
    // ensures uniform scaling
    const normalizationScaleFactor = Math.max(xMax - xMin, yMax - yMin);

    // Normalize each point
    for (let i = 0; i < this.N; i++) {
      var point = this.points[i];
      var normalizedPos = new Vector2(
        (point.coords.x - xMin) / normalizationScaleFactor,
        (point.coords.y - yMin) / normalizationScaleFactor,
      );

      this.points[i].coords = normalizedPos;
    }
  }

  /**
   * Sorts the points into bins using an ordered grid
   *
   * @returns Returns the array of sorted points
   */
  sortPointsIntoBins(): TriangulationPoint[] {
    // Compute the number of bins along each axis
    const n = Math.round(Math.pow(this.N, 0.25));

    // Total bin count
    const binCount = n * n;

    // Assign bin numbers to each point by taking the normalized coordinates
    // and dividing them into a n x n grid.
    for (let k = 0; k < this.N; k++) {
      var point = this.points[k];
      const i = Math.floor(0.99 * n * point.coords.y);
      const j = Math.floor(0.99 * n * point.coords.x);
      point.bin = BinSort.getBinNumber(i, j, n);
    }

    return BinSort.sort<TriangulationPoint>(this.points, this.N, binCount);
  }

  /**
   * Computes the triangulation of the point set.
   * @returns Returns true if the triangulation was successful.
   */
  computeTriangulation() {
    let tSearch = 0; // Index of the current triangle being searched
    let tLast = 0; // Index of the last triangle formed

    let sortedPoints = this.sortPointsIntoBins();

    // Loop through each point and insert it into the triangulation
    for (let i = 0; i < this.N; i++) {
      let point = sortedPoints[i];

      // Insert new point into the triangulation. Start by finding the triangle that contains the point `p`
      // Keep track of how many triangles we visited in case search fails and we get stuck in a loop
      let counter = 0;
      let pointInserted = false;
      while (!pointInserted) {
        if (counter++ > tLast || tSearch === OUT_OF_BOUNDS) {
          break;
        }

        // Get coordinates of triangle vertices
        let v1 = this.points[this.triangulation[tSearch][V1]].coords;
        let v2 = this.points[this.triangulation[tSearch][V2]].coords;
        let v3 = this.points[this.triangulation[tSearch][V3]].coords;

        // Verify that point is on the correct side of each edge of the triangle.
        // If a point is on the left side of an edge, move to the adjacent triangle and check again. The search
        // continues until a containing triangle is found or the point is outside of all triangles
        if (!isPointOnRightSideOfLine(v1, v2, point.coords)) {
          tSearch = this.triangulation[tSearch][E12];
        } else if (!isPointOnRightSideOfLine(v2, v3, point.coords)) {
          tSearch = this.triangulation[tSearch][E23];
        } else if (!isPointOnRightSideOfLine(v3, v1, point.coords)) {
          tSearch = this.triangulation[tSearch][E31];
        } else {
          this.insertPointIntoTriangle(point, tSearch, tLast);
          tLast += 2;
          tSearch = tLast;
          pointInserted = true;
        }
      }
    }
  }

  /**
   * Initializes the triangulation by inserting the super triangle
   */
  addSuperTriangle(): void {
    // Add new points to the end of the points array
    this.points[this.N] = new TriangulationPoint(
      this.N,
      new Vector2(-100, -100),
    );
    this.points[this.N + 1] = new TriangulationPoint(
      this.N + 1,
      new Vector2(0, 100),
    );
    this.points[this.N + 2] = new TriangulationPoint(
      this.N + 2,
      new Vector2(100, -100),
    );

    // Store supertriangle in the first column of the vertex and adjacency data
    this.triangulation[SUPERTRIANGLE][V1] = this.N;
    this.triangulation[SUPERTRIANGLE][V2] = this.N + 1;
    this.triangulation[SUPERTRIANGLE][V3] = this.N + 2;

    // Zeros signify boundary edges
    this.triangulation[SUPERTRIANGLE][E12] = OUT_OF_BOUNDS;
    this.triangulation[SUPERTRIANGLE][E23] = OUT_OF_BOUNDS;
    this.triangulation[SUPERTRIANGLE][E31] = OUT_OF_BOUNDS;
  }

  /**
   * Inserts the point `p` into triangle `t`, replacing it with three new triangles
   *
   * @param p The index of the point to insert
   * @param t The index of the triangle
   * @param triangleCount Total number of triangles created so far
   */
  insertPointIntoTriangle(
    p: TriangulationPoint,
    t: number,
    triangleCount: number,
  ) {
    //                         V1
    //                         *
    //                        /|\
    //                       /3|2\
    //                      /  |  \
    //                     /   |   \
    //                    /    |    \
    //                   /     |     \
    //                  /  t1  |  t3  \
    //                 /       |       \
    //                /      1 * 1      \
    //               /      __/1\__      \
    //              /    __/       \__    \
    //             / 2__/     t2      \__3 \
    //            / _/3                 2\_ \
    //           *---------------------------*
    //         V3                             V2

    const t1 = t;
    const t2 = triangleCount + 1;
    const t3 = triangleCount + 2;

    // Add the vertex & adjacency information for the two new triangles
    // New vertex is set to first vertex of each triangle to help with
    // restoring the triangulation later on
    this.triangulation[t2][V1] = p.index;
    this.triangulation[t2][V2] = this.triangulation[t][V2];
    this.triangulation[t2][V3] = this.triangulation[t][V3];

    this.triangulation[t2][E12] = t3;
    this.triangulation[t2][E23] = this.triangulation[t][E23];
    this.triangulation[t2][E31] = t1;

    this.triangulation[t3][V1] = p.index;
    this.triangulation[t3][V2] = this.triangulation[t][V1];
    this.triangulation[t3][V3] = this.triangulation[t][V2];

    this.triangulation[t3][E12] = t1;
    this.triangulation[t3][E23] = this.triangulation[t][E12];
    this.triangulation[t3][E31] = t2;

    // Triangle index remains the same for E12, no need to update adjacency
    this.updateAdjacency(this.triangulation[t][E12], t, t3);
    this.updateAdjacency(this.triangulation[t][E23], t, t2);

    // Replace existing triangle `t` with `t1`
    this.triangulation[t1][V2] = this.triangulation[t][V3];
    this.triangulation[t1][V3] = this.triangulation[t][V1];
    this.triangulation[t1][V1] = p.index;

    this.triangulation[t1][E23] = this.triangulation[t][E31];
    this.triangulation[t1][E12] = t2;
    this.triangulation[t1][E31] = t3;

    // After the triangles have been inserted, restore the Delauney triangulation
    this.restoreDelauneyTriangulation(p, t1, t2, t3);
  }

  /**
   * Restores the triangulation to a Delauney triangulation after new triangles have been added.
   *
   * @param p Index of the inserted point
   * @param t1 Index of first triangle to check
   * @param t2 Index of second triangle to check
   * @param t3 Index of third triangle to check
   */
  restoreDelauneyTriangulation(
    p: TriangulationPoint,
    t1: number,
    t2: number,
    t3: number,
  ): void {
    const s: [t1: number, t2: number][] = [];

    s.push([t1, this.triangulation[t1][E23]]);
    s.push([t2, this.triangulation[t2][E23]]);
    s.push([t3, this.triangulation[t3][E23]]);

    while (s.length > 0) {
      // Pop next triangle and its adjacent triangle off the stack
      // t1 contains the newly added vertex at V1
      // t2 is adjacent to t1 along the opposite edge of V1
      [t1, t2] = s.pop() ?? [OUT_OF_BOUNDS, OUT_OF_BOUNDS];

      if (t2 == OUT_OF_BOUNDS) {
        continue;
      }
      // If t2 circumscribes p, the quadrilateral formed by t1+t2 has the
      // diagonal drawn in the wrong direction and needs to be swapped
      else {
        const swap = this.swapQuadDiagonalIfNeeded(p.index, t1, t2);
        if (swap) {
          // Push newly formed triangles onto the stack to see if their diagonals
          // need to be swapped
          s.push([t1, swap.t3]);
          s.push([t2, swap.t4]);
        }
      }
    }
  }

  /**
   * Swaps the diagonal of the quadrilateral formed by triangle `t` and the
   * triangle adjacent to the edge that is opposite of the newly added point
   *
   * @param p The index of the inserted point
   * @param t1 Index of the triangle containing p
   * @param t2 Index of the triangle opposite t1 that shares edge E23 with t1
   * @returns Returns an object containing
   *   - `t3`: Index of triangle adjacent to t1 after swap
   *   - `t4`: Index of triangle adjacent to t2 after swap
   */
  swapQuadDiagonalIfNeeded(
    p: number,
    t1: number,
    t2: number,
  ): { t3: number; t4: number } | null {
    // 1) Form quadrilateral from t1 + t2 (q0->q1->q2->q3)
    // 2) Swap diagonal between q1->q3 to q0->q2
    //
    //               BEFORE                            AFTER
    //
    //                 q3                                q3
    //    *-------------*-------------*    *-------------*-------------*
    //     \           / \           /      \           /|\           /
    //      \   t3    /   \   t4    /        \   t3    /3|2\   t4    /
    //       \       /     \       /          \       /  |  \       /
    //        \     /       \     /            \     /   |   \     /
    //         \   /   t2    \   /              \   /    |    \   /
    //          \ /           \ /                \ /     |     \ /
    //        q1 *-------------*  q2           q1 * 2 t1 | t2 3 * q2
    //            \2         3/                    \     |     /
    //             \         /                      \    |    /
    //              \  t1   /                        \   |   /
    //               \     /                          \  |  /
    //                \   /                            \1|1/
    //                 \1/                              \|/
    //                  *  q4 == p                       *  q4 == p
    //

    // Get the vertices of the quad. The new vertex is always located at V1 of the triangle
    let q1 = 0;
    let q2 = 0;
    let q3 = 0;
    let q4 = p;
    let t3 = 0;
    let t4 = 0;

    // Since t2 might be oriented in any direction, find which edge is adjacent to `t`
    // The 4th vertex of the quad will be opposite this edge. We also need the two triangles
    // t3 and t3 that are adjacent to t2 along the other edges since the adjacency information
    // needs to be updated for those triangles.
    if (this.triangulation[t2][E12] === t1) {
      q1 = this.triangulation[t2][V2];
      q2 = this.triangulation[t2][V1];
      q3 = this.triangulation[t2][V3];

      t3 = this.triangulation[t2][E23];
      t4 = this.triangulation[t2][E31];
    } else if (this.triangulation[t2][E23] === t1) {
      q1 = this.triangulation[t2][V3];
      q2 = this.triangulation[t2][V2];
      q3 = this.triangulation[t2][V1];

      t3 = this.triangulation[t2][E31];
      t4 = this.triangulation[t2][E12];
    } // (this.triangulation[t2][E31] == t1)
    else {
      q1 = this.triangulation[t2][V1];
      q2 = this.triangulation[t2][V3];
      q3 = this.triangulation[t2][V2];

      t3 = this.triangulation[t2][E12];
      t4 = this.triangulation[t2][E23];
    }

    // Perform test to see if p lies in the circumcircle of t2
    const swap = this.swapTest(
      this.points[q1].coords,
      this.points[q2].coords,
      this.points[q3].coords,
      this.points[q4].coords,
    );

    if (swap) {
      // Update adjacency for triangles adjacent to t1 and t2
      this.updateAdjacency(t3, t2, t1);
      this.updateAdjacency(this.triangulation[t1][E31], t1, t2);

      // Perform the swap. As always, put the new vertex as the first vertex of the triangle
      this.triangulation[t1][V1] = q4;
      this.triangulation[t1][V2] = q1;
      this.triangulation[t1][V3] = q3;

      this.triangulation[t2][V1] = q4;
      this.triangulation[t2][V2] = q3;
      this.triangulation[t2][V3] = q2;

      // Update adjacency information (order of operations is important here since we
      // are overwriting data).
      this.triangulation[t2][E12] = t1;
      this.triangulation[t2][E23] = t4;
      this.triangulation[t2][E31] = this.triangulation[t1][E31];

      // triangulation[t1][E12] = t2;
      this.triangulation[t1][E23] = t3;
      this.triangulation[t1][E31] = t2;

      return { t3, t4 };
    } else {
      return null;
    }
  }

  /**
   * Marks any triangles that contain super-triangle vertices as discarded
   */
  discardTrianglesWithSuperTriangleVertices(): void {
    for (let i = 0; i < this.triangleCount; i++) {
      // Add all triangles that don't contain a super-triangle vertex
      if (
        this.triangleContainsVertex(i, this.N) ||
        this.triangleContainsVertex(i, this.N + 1) ||
        this.triangleContainsVertex(i, this.N + 2)
      ) {
        this.skipTriangle[i] = true;
      }
    }
  }

  /**
   * Checks to see if the triangle formed by points v1->v2->v3 circumscribes point v4.
   *
   * @param {Vector3} v1 - Coordinates of 1st vertex of triangle.
   * @param {Vector3} v2 - Coordinates of 2nd vertex of triangle.
   * @param {Vector3} v3 - Coordinates of 3rd vertex of triangle.
   * @param {Vector3} v4 - Coordinates of test point.
   * @returns {boolean} Returns true if the triangle formed by v1->v2->v3 circumscribes point v4.
   */
  swapTest(v1: Vector2, v2: Vector2, v3: Vector2, v4: Vector2): boolean {
    const x13 = v1.x - v3.x;
    const x23 = v2.x - v3.x;
    const y13 = v1.y - v3.y;
    const y23 = v2.y - v3.y;
    const x14 = v1.x - v4.x;
    const x24 = v2.x - v4.x;
    const y14 = v1.y - v4.y;
    const y24 = v2.y - v4.y;

    const cosA = x13 * x23 + y13 * y23;
    const cosB = x24 * x14 + y24 * y14;

    if (cosA >= 0 && cosB >= 0) {
      return false;
    } else if (cosA < 0 && cosB < 0) {
      return true;
    } else {
      const sinA = x13 * y23 - x23 * y13;
      const sinB = x24 * y14 - x14 * y24;
      const sinAB = sinA * cosB + sinB * cosA;
      return sinAB < 0;
    }
  }

  /**
   * Checks if the triangle `t` contains the specified vertex `v`.
   *
   * @param {number} t - The index of the triangle.
   * @param {number} v - The index of the vertex.
   * @returns {boolean} Returns true if the triangle `t` contains the vertex `v`.
   */
  triangleContainsVertex(t: number, v: number): boolean {
    return (
      this.triangulation[t][V1] === v ||
      this.triangulation[t][V2] === v ||
      this.triangulation[t][V3] === v
    );
  }

  /**
   * Updates the adjacency information in triangle `t`. Any references to `tOld` are
   * replaced with `tNew`.
   *
   * @param {number} t - The index of the triangle to update.
   * @param {number} tOld - The index to be replaced.
   * @param {number} tNew - The new index to replace with.
   */
  updateAdjacency(t: number, tOld: number, tNew: number) {
    // Boundary edge, no triangle exists
    if (t === OUT_OF_BOUNDS) {
      return;
    }

    const sharedEdge = this.findSharedEdge(t, tOld);
    if (sharedEdge) {
      this.triangulation[t][sharedEdge] = tNew;
    }
  }

  /**
   * Finds the edge index for triangle `tOrigin` that is adjacent to triangle `tAdjacent`.
   *
   * @param {number} tOrigin - The origin triangle to search.
   * @param {number} tAdjacent - The triangle index to search for.
   * @param {number} edgeIndex - Edge index returned as an out parameter (by reference).
   * @returns {boolean} True if `tOrigin` is adjacent to `tAdjacent` and supplies the
   * shared edge index via the out parameter. False if `tOrigin` is an invalid index or
   * `tAdjacent` is not adjacent to `tOrigin`.
   */
  findSharedEdge(tOrigin: number, tAdjacent: number): number | null {
    if (tOrigin === OUT_OF_BOUNDS) {
      return null;
    } else if (this.triangulation[tOrigin][E12] === tAdjacent) {
      return E12;
    } else if (this.triangulation[tOrigin][E23] === tAdjacent) {
      return E23;
    } else if (this.triangulation[tOrigin][E31] === tAdjacent) {
      return E31;
    } else {
      return null;
    }
  }
}
