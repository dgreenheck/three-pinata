import { Vector3 } from "three";
import { EdgeConstraint } from "../entities/EdgeConstraint";
import { MeshVertex } from "../entities/MeshVertex";
import { Triangulator } from "./Triangulator";
import { linesIntersect } from "../utils/MathUtils";
import { hashi2 } from "../utils/MathUtils";
import Quad from "../entities/Quad";

// Constants for triangulation array indices
const V1 = 0; // Vertex 1
const V2 = 1; // Vertex 2
const V3 = 2; // Vertex 3
const E12 = 3; // Adjacency data for edge (V1 -> V2)
const E23 = 4; // Adjacency data for edge (V2 -> V3)
const E31 = 5; // Adjacency data for edge (V3 -> V1)

// Torus parameters for debugging
// Torus lies in X-Y plane (horizontal), with Z-axis going through the center
const TORUS_MAJOR_RADIUS = 1.0; // Distance from center to tube center
const TORUS_MINOR_RADIUS = 0.35; // Tube radius
const TORUS_TOLERANCE = 0.001; // Tolerance for detecting torus vertices

/**
 * Checks if a vertex is inside or on the torus volume
 * For a torus in the X-Y plane:
 * - Distance from Z-axis: d = sqrt(x^2 + y^2)
 * - Distance from torus center circle: torusDistance = sqrt((d - R)^2 + z^2)
 *
 * A vertex is valid if:
 * 1. It's within the tube: torusDistance <= r
 * 2. It's not in the hole: d >= (R - r)
 */
function isInsideTorusVolume(vertex: Vector3): boolean {
  const x = vertex.x;
  const y = vertex.y;
  const z = vertex.z;

  // Calculate distance from Z-axis (in X-Y plane)
  const distanceFromAxis = Math.sqrt(x * x + y * y);

  // Check if vertex is in the hole (inside the inner ring)
  const innerRadius = TORUS_MAJOR_RADIUS - TORUS_MINOR_RADIUS;
  if (distanceFromAxis < innerRadius - TORUS_TOLERANCE) {
    return false; // In the hole
  }

  // Calculate distance from the torus center circle
  const torusDistance = Math.sqrt(
    Math.pow(distanceFromAxis - TORUS_MAJOR_RADIUS, 2) + z * z,
  );

  // Check if vertex is within the tube (with tolerance)
  return torusDistance <= TORUS_MINOR_RADIUS + TORUS_TOLERANCE;
}

/**
 * Index for out of bounds triangle (boundary edge)
 */
const OUT_OF_BOUNDS = -1;

/**
 * Triangulates a set of 3D points with edge constraints.
 * Supports convex and non-convex polygons as well as polygons with holes.
 */
export class ConstrainedTriangulator extends Triangulator {
  /**
   * Instance storage for invalid vertices found during this triangulation
   */
  invalidVertices: Array<{
    index: number;
    position: Vector3;
    location: string;
    distFromAxis: number;
    torusDistance: number;
    planeNormal: Vector3;
  }> = [];

  /**
   * Given an edge E12, E23, E31, this returns the first vertex for that edge (V1, V2, V3, respectively)
   */
  edgeVertex1: number[] = [0, 0, 0, V1, V2, V3];

  /**
   * Given an edge E12, E23, E31, this returns the second vertex for that edge (V2, V3, V1, respectively)
   */
  edgeVertex2: number[] = [0, 0, 0, V2, V3, V1];

  /**
   * Given an edge E12, E23, E31, this returns the vertex opposite that edge (V3, V1, V2, respectively)
   */
  oppositePoint: number[] = [0, 0, 0, V3, V1, V2];

  /**
   * Given an edge E12, E23, E31, this returns the next clockwise edge (E23, E31, E12, respectively)
   */
  nextEdge: number[] = [0, 0, 0, E23, E31, E12];

  /**
   * Given an edge E12, E23, E31, this returns the previous clockwise edge (E31, E12, E23, respectively)
   */
  previousEdge: number[] = [0, 0, 0, E31, E12, E23];

  /**
   * List of edge constraints provided during initialization
   */
  constraints: EdgeConstraint[];

  /**
   * This array maps each vertex to a triangle in the triangulation that contains it. This helps
   * speed up the search when looking for intersecting edge. It isn't necessary to keep track of
   * every triangle for each vertex.
   */
  vertexTriangles: number[];

  /**
   * Initializes the triangulator with the vertex data to be triangulated given a set of edge constraints
   * @param inputPoints The of points to triangulate
   * @param constraints The list of edge constraints which defines how the vertices in `inputPoints` are connected.
   * @param normal The normal of the plane in which the `inputPoints` lie.
   */
  constructor(
    inputPoints: MeshVertex[],
    constraints: EdgeConstraint[],
    normal: Vector3,
  ) {
    super(inputPoints, normal);
    this.constraints = constraints;
    this.vertexTriangles = [];

    // Debug: Check for vertices outside the torus volume and accumulate them
    // NOTE: This check happens BEFORE coordinate normalization, on the original 3D positions
    // Vertices are in the fragment's local coordinate space (NOT world space)
    // The torus is assumed to be centered at origin in X-Y plane (Z-axis vertical)

    for (let i = 0; i < inputPoints.length; i++) {
      if (!isInsideTorusVolume(inputPoints[i].position)) {
        const pos = inputPoints[i].position;
        const distanceFromAxis = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        const innerRadius = TORUS_MAJOR_RADIUS - TORUS_MINOR_RADIUS;
        const torusDistance = Math.sqrt(
          Math.pow(distanceFromAxis - TORUS_MAJOR_RADIUS, 2) + pos.z * pos.z,
        );

        let location = "";
        if (distanceFromAxis < innerRadius - TORUS_TOLERANCE) {
          location = "IN HOLE";
        } else if (torusDistance > TORUS_MINOR_RADIUS + TORUS_TOLERANCE) {
          location = "OUTSIDE TUBE";
        }

        // Store in instance property
        this.invalidVertices.push({
          index: i,
          position: pos.clone(),
          location,
          distFromAxis: distanceFromAxis,
          torusDistance,
          planeNormal: normal.clone(),
        });
      }
    }
  }

  /**
   * Calculates the triangulation
   * @returns Returns an array containing the indices of the triangles, mapped to the list of points passed in during initialization.
   */
  triangulate(): number[] {
    // Need at least 3 vertices to triangulate
    if (this.N < 3) {
      return [];
    }

    this.addSuperTriangle();
    this.normalizeCoordinates();
    this.computeTriangulation();

    if (this.constraints.length > 0) {
      this.applyConstraints();
      this.discardTrianglesViolatingConstraints();
    }

    this.discardTrianglesWithSuperTriangleVertices();

    let triangles: number[] = [];
    for (let i = 0; i < this.triangleCount; i++) {
      // Add all triangles that don't contain a super-triangle vertex
      if (!this.skipTriangle[i]) {
        triangles.push(this.triangulation[i][V1]);
        triangles.push(this.triangulation[i][V2]);
        triangles.push(this.triangulation[i][V3]);
      }
    }

    return triangles;
  }

  /**
   * Applys the edge constraints to the triangulation
   */
  applyConstraints(): void {
    // Map each vertex to a triangle that contains it
    this.vertexTriangles = new Array<number>(this.N + 3).fill(0);
    for (let i = 0; i < this.triangulation.length; i++) {
      this.vertexTriangles[this.triangulation[i][V1]] = i;
      this.vertexTriangles[this.triangulation[i][V2]] = i;
      this.vertexTriangles[this.triangulation[i][V3]] = i;
    }

    // Loop through each edge constraint
    for (let constraint of this.constraints) {
      // Ignore degenerate constraints
      if (constraint.v1 === constraint.v2) continue;

      // We find the edges of the triangulation that intersect the constraint edge and remove them
      // For each intersecting edge, we identify the triangles that share that edge (which form a quad)
      // The diagonal of this quad is flipped.
      const intersectingEdges = this.findIntersectingEdges(
        constraint,
        this.vertexTriangles,
      );
      this.removeIntersectingEdges(constraint, intersectingEdges);
    }
  }

  /**
   * Searches through the triangulation to find intersecting edges
   * @param constraint
   * @param vertexTriangles
   * @returns Array of edges that are intersecting
   */
  findIntersectingEdges(
    constraint: EdgeConstraint,
    vertexTriangles: number[],
  ): EdgeConstraint[] {
    const intersectingEdges: EdgeConstraint[] = [];

    // Need to find the first edge that the constraint crosses.
    const startEdge = this.findStartingEdge(vertexTriangles, constraint);

    if (startEdge) {
      intersectingEdges.push(startEdge);
    } else {
      return intersectingEdges;
    }

    // Search for all triangles that intersect the constraint. Stop when we find a triangle that contains v_j
    let t = startEdge.t1;
    let edgeIndex = startEdge.t1Edge;
    let lastTriangle = t;
    let finalTriangleFound = false;
    while (!finalTriangleFound) {
      // Cross the last intersecting edge and inspect the next triangle
      lastTriangle = t;
      t = this.triangulation[t][edgeIndex];

      // Get coordinates of constraint end points and triangle vertices
      const v_i = this.points[constraint.v1].coords;
      const v_j = this.points[constraint.v2].coords;
      const v1 = this.points[this.triangulation[t][V1]].coords;
      const v2 = this.points[this.triangulation[t][V2]].coords;
      const v3 = this.points[this.triangulation[t][V3]].coords;

      // If triangle contains the endpoint of the constraint, the search is done
      if (this.triangleContainsVertex(t, constraint.v2)) {
        finalTriangleFound = true;
        // Otherwise, the constraint must intersect one edge of this triangle. Ignore the edge that we entered from
      } else if (
        this.triangulation[t][E12] !== lastTriangle &&
        linesIntersect(v_i, v_j, v1, v2)
      ) {
        edgeIndex = E12;
        var edge = new EdgeConstraint(
          this.triangulation[t][V1],
          this.triangulation[t][V2],
          t,
          this.triangulation[t][E12],
          edgeIndex,
        );
        intersectingEdges.push(edge);
      } else if (
        this.triangulation[t][E23] !== lastTriangle &&
        linesIntersect(v_i, v_j, v2, v3)
      ) {
        edgeIndex = E23;
        var edge = new EdgeConstraint(
          this.triangulation[t][V2],
          this.triangulation[t][V3],
          t,
          this.triangulation[t][E23],
          edgeIndex,
        );
        intersectingEdges.push(edge);
      } else if (
        this.triangulation[t][E31] !== lastTriangle &&
        linesIntersect(v_i, v_j, v3, v1)
      ) {
        edgeIndex = E31;
        var edge = new EdgeConstraint(
          this.triangulation[t][V3],
          this.triangulation[t][V1],
          t,
          this.triangulation[t][E31],
          edgeIndex,
        );
        intersectingEdges.push(edge);
      } else {
        // Shouldn't reach this point
        console.warn("Failed to find final triangle, exiting early.");
        break;
      }
    }

    return intersectingEdges;
  }

  /**
   * Finds the starting edge for the search to find all edges that intersect the constraint
   * @param vertexTriangles
   * @param constraint The constraint being used to check for intersections
   * @param startingEdge
   * @returns
   */
  findStartingEdge(
    vertexTriangles: number[],
    constraint: EdgeConstraint,
  ): EdgeConstraint | null {
    // Initialize out parameter to default value
    let startingEdge = new EdgeConstraint(-1, -1);

    let v_i = constraint.v1;

    // Start the search with an initial triangle that contains v1
    let tSearch = vertexTriangles[v_i];

    // Circle v_i until we find a triangle that contains an edge which intersects the constraint edge
    // This will be the starting triangle in the search for finding all triangles that intersect the constraint
    let noCandidatesFound = false;
    let intersectingEdgeIndex: number | null = null;
    let tE12: number, tE23: number, tE31: number;
    const visited = new Array<boolean>(this.triangulation.length);
    while (!intersectingEdgeIndex && !noCandidatesFound) {
      visited[tSearch] = true;

      // Triangulation already contains the constraint so we ignore the constraint
      if (this.triangleContainsConstraint(tSearch, constraint)) {
        return null;
      }

      intersectingEdgeIndex = this.edgeConstraintIntersectsTriangle(
        tSearch,
        constraint,
      );

      // Check if the constraint intersects any edges of this triangle
      if (intersectingEdgeIndex) {
        break;
      }

      tE12 = this.triangulation[tSearch][E12];
      tE23 = this.triangulation[tSearch][E23];
      tE31 = this.triangulation[tSearch][E31];

      // If constraint does not intersect this triangle, check adjacent
      // triangles by crossing edges that have v1 as a vertex
      // Avoid triangles that we have previously visited in the search
      if (
        tE12 !== OUT_OF_BOUNDS &&
        !visited[tE12] &&
        this.triangleContainsVertex(tE12, v_i)
      ) {
        tSearch = tE12;
      } else if (
        tE23 !== OUT_OF_BOUNDS &&
        !visited[tE23] &&
        this.triangleContainsVertex(tE23, v_i)
      ) {
        tSearch = tE23;
      } else if (
        tE31 !== OUT_OF_BOUNDS &&
        !visited[tE31] &&
        this.triangleContainsVertex(tE31, v_i)
      ) {
        tSearch = tE31;
      } else {
        noCandidatesFound = true;
        break;
      }
    }

    if (intersectingEdgeIndex) {
      const v_k =
        this.triangulation[tSearch][this.edgeVertex1[intersectingEdgeIndex]];
      const v_l =
        this.triangulation[tSearch][this.edgeVertex2[intersectingEdgeIndex]];
      const triangle2 = this.triangulation[tSearch][intersectingEdgeIndex];
      startingEdge = new EdgeConstraint(
        v_k,
        v_l,
        tSearch,
        triangle2,
        intersectingEdgeIndex,
      );

      return startingEdge;
    }

    return null;
  }

  /// <summary>
  /// Remove the edges from the triangulation that intersect the constraint. Find two triangles that
  /// share the intersecting edge, swap the diagonal and repeat until no edges intersect the constraint.
  /// </summary>
  /// <param name="constraint">The constraint to check against</param>
  /// <param name="intersectingEdges">A queue containing the previously found edges that intersect the constraint</param>
  removeIntersectingEdges(
    constraint: EdgeConstraint,
    intersectingEdges: EdgeConstraint[],
  ): void {
    // Remove intersecting edges. Keep track of the new edges that we create
    let newEdges: EdgeConstraint[] = [];
    let edge: EdgeConstraint | undefined;

    // Mark the number of times we have been through the loop. If no new edges
    // have been added after all edges have been visited, stop the loop. Every
    // time an edge is added to newEdges, reset the counter.
    let counter = 0;

    // Loop through all intersecting edges until they have been properly resolved
    // or they have all been visited with no diagonal swaps.
    while (
      intersectingEdges.length > 0 &&
      counter <= intersectingEdges.length
    ) {
      edge = intersectingEdges.shift()!;

      let quad = this.findQuadFromSharedEdge(edge.t1, edge.t1Edge);

      if (quad) {
        // If the quad is convex, we swap the diagonal (a quad is convex if the diagonals intersect)
        // Otherwise push it back into the queue so we can swap the diagonal later on.
        if (
          linesIntersect(
            this.points[quad.q4].coords,
            this.points[quad.q3].coords,
            this.points[quad.q1].coords,
            this.points[quad.q2].coords,
          )
        ) {
          // Swap diagonals of the convex quads whose diagonals intersect the constraint
          this.swapQuadDiagonal(
            quad,
            intersectingEdges,
            newEdges,
            this.constraints,
          );

          // The new diagonal is between Q3 and Q4
          let newEdge = new EdgeConstraint(
            quad.q3,
            quad.q4,
            quad.t1,
            quad.t2,
            E31,
          );

          // If the new diagonal still intersects the constraint edge v_i->v_j,
          // put back on the list of intersecting eddges
          if (
            linesIntersect(
              this.points[constraint.v1].coords,
              this.points[constraint.v2].coords,
              this.points[quad.q3].coords,
              this.points[quad.q4].coords,
            )
          ) {
            intersectingEdges.push(newEdge);
          }
          // Otherwise record in list of new edges
          else {
            counter = 0;
            newEdges.push(newEdge);
          }
        } else {
          intersectingEdges.push(edge);
        }
      }

      counter++;
    }

    // If any new edges were formed due to a diagonal being swapped, restore the Delauney condition
    // of the triangulation while respecting the constraints
    if (newEdges.length > 0) {
      this.restoreConstrainedDelauneyTriangulation(constraint, newEdges);
    }
  }

  /// <summary>
  /// Restores the Delauney triangulation after the constraint has been inserted
  /// </summary>
  /// <param name="constraint">The constraint that was added to the triangulation</param>
  /// <param name="newEdges">The list of new edges that were added</param>
  restoreConstrainedDelauneyTriangulation(
    constraint: EdgeConstraint,
    newEdges: EdgeConstraint[],
  ): void {
    // Iterate over the list of newly created edges and swap
    // non-constraint diagonals until no more swaps take place
    let swapOccurred = true;
    let counter = 0;
    while (swapOccurred) {
      counter++;
      swapOccurred = false;

      for (let i = 0; i < newEdges.length; i++) {
        const edge = newEdges[i];

        // If newly added edge is equal to constraint, we don't want to flip this edge so skip it
        if (edge.equals(constraint)) {
          continue;
        }

        let quad = this.findQuadFromSharedEdge(edge.t1, edge.t1Edge);
        if (quad) {
          if (
            this.swapTest(
              this.points[quad.q1].coords,
              this.points[quad.q2].coords,
              this.points[quad.q3].coords,
              this.points[quad.q4].coords,
            )
          ) {
            this.swapQuadDiagonal(quad, newEdges, this.constraints, null);

            // Enqueue the new diagonal
            const v_m = quad.q3;
            const v_n = quad.q4;
            newEdges[i] = new EdgeConstraint(v_m, v_n, quad.t1, quad.t2, E31);

            swapOccurred = true;
          }
        }
      }
    }
  }

  /**
   * Discards triangles that violate the any of the edge constraints
   */
  discardTrianglesViolatingConstraints(): void {
    // Initialize to all triangles being skipped
    this.skipTriangle.fill(true);

    // Identify the boundary edges (directional)
    let boundaries = new Set<number>();
    for (let i = 0; i < this.constraints.length; i++) {
      const constraint = this.constraints[i];
      boundaries.add(hashi2(constraint.v1, constraint.v2));
    }

    // Search frontier
    let frontier: number[] = [];

    let v1: number, v2: number, v3: number;
    let boundaryE12: boolean, boundaryE23: boolean, boundaryE31: boolean;
    let reverseE12: boolean, reverseE23: boolean, reverseE31: boolean;
    const visited = new Array<boolean>(this.triangulation.length);
    for (let i = 0; i < this.triangleCount; i++) {
      if (visited[i]) continue;

      v1 = this.triangulation[i][V1];
      v2 = this.triangulation[i][V2];
      v3 = this.triangulation[i][V3];

      // Check if edges match constraint direction (forward)
      boundaryE12 = boundaries.has(hashi2(v1, v2));
      boundaryE23 = boundaries.has(hashi2(v2, v3));
      boundaryE31 = boundaries.has(hashi2(v3, v1));

      // Check if edges match reverse of constraint direction
      reverseE12 = boundaries.has(hashi2(v2, v1));
      reverseE23 = boundaries.has(hashi2(v3, v2));
      reverseE31 = boundaries.has(hashi2(v1, v3));

      // If this triangle has a reverse edge, it's outside the valid region - skip it
      if (reverseE12 || reverseE23 || reverseE31) {
        continue;
      }

      // If this triangle has a forward boundary edge, start searching for adjacent triangles
      if (!(boundaryE12 || boundaryE23 || boundaryE31)) continue;
      this.skipTriangle[i] = false;

      // Search along edges that are not boundary edges
      frontier = [];
      if (!boundaryE12) {
        frontier.push(this.triangulation[i][E12]);
      }
      if (!boundaryE23) {
        frontier.push(this.triangulation[i][E23]);
      }
      if (!boundaryE31) {
        frontier.push(this.triangulation[i][E31]);
      }

      // Recursively search along all non-boundary edges, marking the
      // adjacent triangles as "keep"
      while (frontier.length > 0) {
        const k = frontier.shift();

        if (k === undefined || k === OUT_OF_BOUNDS || visited[k]) {
          continue;
        }

        v1 = this.triangulation[k][V1];
        v2 = this.triangulation[k][V2];
        v3 = this.triangulation[k][V3];

        // Check for reverse edges - if found, this triangle is outside
        reverseE12 = boundaries.has(hashi2(v2, v1));
        reverseE23 = boundaries.has(hashi2(v3, v2));
        reverseE31 = boundaries.has(hashi2(v1, v3));

        if (reverseE12 || reverseE23 || reverseE31) {
          visited[k] = true;
          continue;
        }

        this.skipTriangle[k] = false;
        visited[k] = true;

        // Continue searching along non-boundary edges
        if (!boundaries.has(hashi2(v1, v2))) {
          frontier.push(this.triangulation[k][E12]);
        }
        if (!boundaries.has(hashi2(v2, v3))) {
          frontier.push(this.triangulation[k][E23]);
        }
        if (!boundaries.has(hashi2(v3, v1))) {
          frontier.push(this.triangulation[k][E31]);
        }
      }
    }
  }

  /// <summary>
  /// Determines if the triangle contains the edge constraint
  /// </summary>
  /// <param name="t">The triangle to test</param>
  /// <param name="constraint">The edge constraint</param>
  /// <returns>True if the triangle contains one or both of the endpoints of the constraint</returns>
  triangleContainsConstraint(t: number, constraint: EdgeConstraint): boolean {
    if (t >= this.triangulation.length) return false;

    return (
      (this.triangulation[t][V1] === constraint.v1 ||
        this.triangulation[t][V2] === constraint.v1 ||
        this.triangulation[t][V3] === constraint.v1) &&
      (this.triangulation[t][V1] === constraint.v2 ||
        this.triangulation[t][V2] === constraint.v2 ||
        this.triangulation[t][V3] === constraint.v2)
    );
  }

  /**
   * Returns true if the edge constraint intersects an edge of triangle `t`
   * @param t The triangle to test
   * @param constraint The edge constraint
   * @param intersectingEdgeIndex The index of the intersecting edge (E12, E23, E31)
   * @returns Returns true if an intersection is found, otherwise false.
   */
  edgeConstraintIntersectsTriangle(
    t: number,
    constraint: EdgeConstraint,
  ): number | null {
    const v_i = this.points[constraint.v1].coords;
    const v_j = this.points[constraint.v2].coords;
    const v1 = this.points[this.triangulation[t][V1]].coords;
    const v2 = this.points[this.triangulation[t][V2]].coords;
    const v3 = this.points[this.triangulation[t][V3]].coords;

    if (linesIntersect(v_i, v_j, v1, v2)) {
      return E12;
    } else if (linesIntersect(v_i, v_j, v2, v3)) {
      return E23;
    } else if (linesIntersect(v_i, v_j, v3, v1)) {
      return E31;
    } else {
      return null;
    }
  }

  /**
   *
   * @param t1 Base triangle
   * @param t1SharedEdge Edge index that is being intersected<
   * @returns Returns the quad formed by triangle `t1` and the other triangle that shares the intersecting edge
   */
  findQuadFromSharedEdge(t1: number, t1SharedEdge: number): Quad | null {
    //               q3
    //      *---------*---------*
    //       \       / \       /
    //        \ t2L /   \ t2R /
    //         \   /     \   /
    //          \ /   t2  \ /
    //        q1 *---------* q2
    //          / \   t1  / \
    //         /   \     /   \
    //        / t1L \   / t1R \
    //       /       \ /       \
    //      *---------*---------*
    //               q4

    let q1: number, q2: number, q3: number, q4: number;
    let t1L: number, t1R: number, t2L: number, t2R: number;

    // t2 is adjacent to t1 along t1Edge
    let t2 = this.triangulation[t1][t1SharedEdge];
    let t2SharedEdge = this.findSharedEdge(t2, t1);
    if (t2SharedEdge) {
      // Get the top 3 vertices of the quad from t2
      if (t2SharedEdge === E12) {
        q2 = this.triangulation[t2][V1];
        q1 = this.triangulation[t2][V2];
        q3 = this.triangulation[t2][V3];
      } else if (t2SharedEdge === E23) {
        q2 = this.triangulation[t2][V2];
        q1 = this.triangulation[t2][V3];
        q3 = this.triangulation[t2][V1];
      } // (t2SharedEdge == E31)
      else {
        q2 = this.triangulation[t2][V3];
        q1 = this.triangulation[t2][V1];
        q3 = this.triangulation[t2][V2];
      }

      // q4 is the point in t1 opposite of the shared edge
      q4 = this.triangulation[t1][this.oppositePoint[t1SharedEdge]];

      // Get the adjacent triangles to make updating adjacency easier
      t1L = this.triangulation[t1][this.previousEdge[t1SharedEdge]];
      t1R = this.triangulation[t1][this.nextEdge[t1SharedEdge]];
      t2L = this.triangulation[t2][this.nextEdge[t2SharedEdge]];
      t2R = this.triangulation[t2][this.previousEdge[t2SharedEdge]];

      return new Quad(q1, q2, q3, q4, t1, t2, t1L, t1R, t2L, t2R);
    }

    return null;
  }

  /**
   * Swaps the diagonal of the quadrilateral q0->q1->q2->q3 formed by t1 and t2
   */
  swapQuadDiagonal(
    quad: Quad,
    edges1: EdgeConstraint[],
    edges2: EdgeConstraint[],
    edges3: EdgeConstraint[] | null,
  ): void {
    // BEFORE
    //               q3
    //      *---------*---------*
    //       \       / \       /
    //        \ t2L /   \ t2R /
    //         \   /     \   /
    //          \ /   t2  \ /
    //        q1 *---------* q2
    //          / \   t1  / \
    //         /   \     /   \
    //        / t1L \   / t1R \
    //       /       \ /       \
    //      *---------*---------*
    //               q4

    // AFTER
    //               q3
    //      *---------*---------*
    //       \       /|\       /
    //        \ t2L / | \ t2R /
    //         \   /  |  \   /
    //          \ /   |   \ /
    //        q1 * t1 | t2 * q2
    //          / \   |   / \
    //         /   \  |  /   \
    //        / t1L \ | / t1R \
    //       /       \|/       \
    //      *---------*---------*
    //               q4

    const t1 = quad.t1;
    const t2 = quad.t2;
    const t1R = quad.t1R;
    const t1L = quad.t1L;
    const t2R = quad.t2R;
    const t2L = quad.t2L;

    // Perform the swap. As always, put the new vertex as the first vertex of the triangle
    this.triangulation[t1][V1] = quad.q4;
    this.triangulation[t1][V2] = quad.q1;
    this.triangulation[t1][V3] = quad.q3;

    this.triangulation[t2][V1] = quad.q4;
    this.triangulation[t2][V2] = quad.q3;
    this.triangulation[t2][V3] = quad.q2;

    this.triangulation[t1][E12] = t1L;
    this.triangulation[t1][E23] = t2L;
    this.triangulation[t1][E31] = t2;

    this.triangulation[t2][E12] = t1;
    this.triangulation[t2][E23] = t2R;
    this.triangulation[t2][E31] = t1R;

    // Update adjacency for the adjacent triangles
    this.updateAdjacency(t2L, t2, t1);
    this.updateAdjacency(t1R, t1, t2);

    // Now that triangles have moved, need to update edges as well
    this.updateEdgesAfterSwap(edges1, t1, t2, t1L, t1R, t2L, t2R);
    this.updateEdgesAfterSwap(edges2, t1, t2, t1L, t1R, t2L, t2R);
    this.updateEdgesAfterSwap(edges3, t1, t2, t1L, t1R, t2L, t2R);

    // Also need to update the vertexTriangles array since the vertices q1 and q2
    // may have been referencing t2/t1 respectively and they are no longer.
    this.vertexTriangles[quad.q1] = t1;
    this.vertexTriangles[quad.q2] = t2;
  }

  /**
   * Update the edges
   */
  updateEdgesAfterSwap(
    edges: EdgeConstraint[] | null,
    t1: number,
    t2: number,
    t1L: number,
    t1R: number,
    t2L: number,
    t2R: number,
  ) {
    if (!edges) {
      return;
    }

    // Update edges to reflect changes in triangles
    for (let edge of edges) {
      if (edge.t1 === t1 && edge.t2 === t1R) {
        edge.t1 = t2;
        edge.t2 = t1R;
        edge.t1Edge = E31;
      } else if (edge.t1 === t1 && edge.t2 === t1L) {
        // Triangles stay the same
        edge.t1Edge = E12;
      } else if (edge.t1 === t1R && edge.t2 === t1) {
        edge.t2 = t2;
      } else if (edge.t1 === t1L && edge.t2 === t1) {
        // Unchanged
      } else if (edge.t1 === t2 && edge.t2 === t2R) {
        // Triangles stay the same
        edge.t1Edge = E23;
      } else if (edge.t1 === t2 && edge.t2 === t2L) {
        edge.t1 = t1;
        edge.t2 = t2L;
        edge.t1Edge = E23;
      } else if (edge.t1 === t2R && edge.t2 === t2) {
        // Unchanged
      } else if (edge.t1 === t2L && edge.t2 === t2) {
        edge.t2 = t1;
      }
    }
  }
}
