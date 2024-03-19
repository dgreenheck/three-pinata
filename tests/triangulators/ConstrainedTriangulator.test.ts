import { Vector3 } from 'three';
import ConstrainedTriangulator from '../../src/ triangulators/ConstrainedTriangulator';
import MeshVertex from '../../src/fragment/MeshVertex';

// Helper function for getting an adjacent vertex, translated to TypeScript
function getAdjacentVertex(i: number, n: number): number {
  if ((i + 1) < n) {
    return i + 1;
  } else {
    // If i == n, adjacent vertex is i == 1
    return ((i + 1) % n) + 1;
  }
}

describe('ConstrainedTriangulator', () => {

  it('should handle empty input points and constraints', () => {
    var triangulator = new ConstrainedTriangulator([], [], new Vector3(1, 0, 0));
    let triangles = triangulator.triangulate();
    expect(triangles.length).toBe(0);
  });

  it('should not triangulate less than three input points', () => {
    let points = [
      new MeshVertex(new Vector3()),
      new MeshVertex(new Vector3(1, 1, 1))
    ];

    let triangulator = new ConstrainedTriangulator(points, [], new Vector3(1, 0, 0));
    let triangles = triangulator.triangulate();
    expect(triangles.length).toBe(0);
  });

  it('should correctly triangulate for n = 3 to n = 20', () => {
    for (let n = 3; n <= 20; n++) {
      let points: MeshVertex[] = [];
      // Add an additional center point
      points.push(new MeshVertex(new Vector3(0, 0, 0)));

      for (let i = 0; i < n; i++) {
        let angle = (i / n) * 2 * Math.PI;
        points.push(new MeshVertex(new Vector3(Math.cos(angle), Math.sin(angle), 0)));
      }

      const triangulator = new ConstrainedTriangulator(points, [], new Vector3(0, 0, 1));
      const triangles = triangulator.triangulate();

      // Verify the triangulation has the correct number of triangles
      expect(triangles.length).toEqual(3 * n);

      for (let i = 0; i < triangles.length; i += 3) {
        // Verify each contains the origin point
        expect(triangles[i] === 0 || triangles[i + 1] === 0 || triangles[i + 2] === 0).toBeTruthy();

        // Verify the other two vertices are adjacent and wound clockwise
        if (triangles[i] === 0) {
          expect(triangles[i + 2]).toEqual(getAdjacentVertex(triangles[i + 1], points.length));
        } else if (triangles[i + 1] === 0) {
          expect(triangles[i]).toEqual(getAdjacentVertex(triangles[i + 2], points.length));
        } else if (triangles[i + 2] === 0) {
          expect(triangles[i + 1]).toEqual(getAdjacentVertex(triangles[i], points.length));
        }
      }
    }
  });
});