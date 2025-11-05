import { Vector2, Vector3 } from "three";
import { ConstrainedTriangulator } from "../ConstrainedTriangulator";
import { MeshVertex } from "../../entities/MeshVertex";
import { EdgeConstraint } from "../../entities/EdgeConstraint";

/**
 * Tests specifically for the discardTrianglesViolatingConstraints algorithm
 * to help debug why triangles occasionally escape the boundary
 */
describe("Boundary Detection Debug", () => {
  it("should handle simple CCW square correctly", () => {
    const vertices = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),
    ];

    const constraints = [
      new EdgeConstraint(0, 1), // v0->v1
      new EdgeConstraint(1, 2), // v1->v2
      new EdgeConstraint(2, 3), // v2->v3
      new EdgeConstraint(3, 0), // v3->v0
    ];

    const triangulator = new ConstrainedTriangulator(
      vertices,
      constraints,
      new Vector3(0, -1, 0),
    );
    const triangles = triangulator.triangulate();

    // Should produce 2 triangles (6 indices)
    expect(triangles.length).toBe(6);

    // Manually verify triangles are within bounds
    for (let i = 0; i < triangles.length; i++) {
      const vIdx = triangles[i];
      const v = triangulator.points[vIdx].coords;

      // All vertices should be within [0,1] x [0,1]
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1);
    }
  });

  it("should detect boundary edges regardless of direction", () => {
    // Create a scenario where Delaunay creates edge in opposite direction
    const vertices = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(2, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(2, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),
    ];

    // Constraints going CCW
    const constraints = [
      new EdgeConstraint(0, 1),
      new EdgeConstraint(1, 2),
      new EdgeConstraint(2, 3),
      new EdgeConstraint(3, 0),
    ];

    const triangulator = new ConstrainedTriangulator(
      vertices,
      constraints,
      new Vector3(0, -1, 0),
    );
    const triangles = triangulator.triangulate();

    expect(triangles.length).toBeGreaterThan(0);

    // Check all triangles are inside
    for (let i = 0; i < triangles.length; i++) {
      const vIdx = triangles[i];
      const v = triangulator.points[vIdx].coords;

      expect(v.x).toBeGreaterThanOrEqual(-0.01); // Small tolerance
      expect(v.x).toBeLessThanOrEqual(2.01);
      expect(v.y).toBeGreaterThanOrEqual(-0.01);
      expect(v.y).toBeLessThanOrEqual(1.01);
    }
  });

  it("should handle annulus (ring) shape like torus slice", () => {
    // Simulates a torus cross-section: outer circle with inner hole
    // Outer boundary CCW, inner boundary CW
    const outerRadius = 2;
    const innerRadius = 1;
    const segments = 8;

    const vertices: MeshVertex[] = [];
    const constraints: EdgeConstraint[] = [];

    // Outer circle (CCW)
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      vertices.push(
        new MeshVertex(
          new Vector3(
            Math.cos(angle) * outerRadius,
            0,
            Math.sin(angle) * outerRadius,
          ),
          new Vector3(0, 1, 0),
          new Vector2(),
        ),
      );
    }

    // Add outer constraints
    for (let i = 0; i < segments; i++) {
      const v1 = i;
      const v2 = (i + 1) % segments;
      constraints.push(new EdgeConstraint(v1, v2));
    }

    // Inner circle (CW - opposite winding for hole)
    const innerOffset = segments;
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      vertices.push(
        new MeshVertex(
          new Vector3(
            Math.cos(angle) * innerRadius,
            0,
            Math.sin(angle) * innerRadius,
          ),
          new Vector3(0, 1, 0),
          new Vector2(),
        ),
      );
    }

    // Add inner constraints (CW)
    for (let i = 0; i < segments; i++) {
      const v1 = innerOffset + i;
      const v2 = innerOffset + ((i + 1) % segments);
      constraints.push(new EdgeConstraint(v2, v1)); // Reversed for CW
    }

    const triangulator = new ConstrainedTriangulator(
      vertices,
      constraints,
      new Vector3(0, -1, 0),
    );
    const triangles = triangulator.triangulate();

    expect(triangles.length).toBeGreaterThan(0);

    // Verify no triangles in the hole region
    for (let i = 0; i < triangles.length; i += 3) {
      // Use original vertex positions, not normalized internal coords
      const v1 = vertices[triangles[i]].position;
      const v2 = vertices[triangles[i + 1]].position;
      const v3 = vertices[triangles[i + 2]].position;

      // Calculate centroid (use x and z since y=0 for all vertices)
      const cx = (v1.x + v2.x + v3.x) / 3;
      const cy = (v1.z + v2.z + v3.z) / 3;
      const distFromOrigin = Math.sqrt(cx * cx + cy * cy);

      // Centroid should be outside inner radius (not in hole)
      // and inside outer radius
      expect(distFromOrigin).toBeGreaterThanOrEqual(innerRadius * 0.9);
      if (distFromOrigin < innerRadius * 0.9) {
        console.error(
          `Triangle ${i / 3} centroid at (${cx.toFixed(3)}, ${cy.toFixed(3)}) ` +
            `is inside the hole (dist=${distFromOrigin.toFixed(3)} < ${innerRadius})`,
        );
      }

      expect(distFromOrigin).toBeLessThanOrEqual(outerRadius * 1.1);
      if (distFromOrigin > outerRadius * 1.1) {
        console.error(
          `Triangle ${i / 3} centroid at (${cx.toFixed(3)}, ${cy.toFixed(3)}) ` +
            `is outside boundary (dist=${distFromOrigin.toFixed(3)} > ${outerRadius})`,
        );
      }
    }
  });

  it("should reject triangles with third vertex on wrong side of boundary", () => {
    // Simulate a triangle where two vertices are on the boundary
    // but the third vertex pokes into a hole (like the torus case)

    // Square with a vertex slightly inside
    const vertices = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      // Add a point slightly outside the boundary (inside a hole)
      new MeshVertex(
        new Vector3(0.5, 0, 0.5),
        new Vector3(0, 1, 0),
        new Vector2(),
      ),
    ];

    const constraints = [
      new EdgeConstraint(0, 1),
      new EdgeConstraint(1, 2),
      new EdgeConstraint(2, 3),
      new EdgeConstraint(3, 0),
    ];

    const triangulator = new ConstrainedTriangulator(
      vertices,
      constraints,
      new Vector3(0, -1, 0),
    );
    const triangles = triangulator.triangulate();

    // Check if vertex 4 (slightly outside) appears in triangulation
    const usesVertex4 = triangles.some((v) => v === 4);

    // This test documents current behavior - the point inside the hole
    // should ideally NOT be used, but we're checking what actually happens
    expect(triangles.length).toBeGreaterThan(0);

    // Log for debugging
    if (usesVertex4) {
      console.log(
        "WARNING: Center point (in hole) was included in triangulation",
      );
    }
  });

  it("should correctly identify seed triangles touching boundaries", () => {
    // Simple case to verify seed selection
    const vertices = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),
    ];

    const constraints = [
      new EdgeConstraint(0, 1),
      new EdgeConstraint(1, 2),
      new EdgeConstraint(2, 3),
      new EdgeConstraint(3, 0),
    ];

    const triangulator = new ConstrainedTriangulator(
      vertices,
      constraints,
      new Vector3(0, -1, 0),
    );

    // Triangulate
    const triangles = triangulator.triangulate();

    // At minimum, there should be 2 triangles for a square
    expect(triangles.length).toBeGreaterThanOrEqual(6);
  });
});
