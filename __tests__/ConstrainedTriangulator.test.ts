import { Vector2, Vector3 } from 'three';
import { ConstrainedTriangulator } from '../src/fracture/triangulators/ConstrainedTriangulator';
import MeshVertex from '../src/fracture/entities/MeshVertex';
import EdgeConstraint from '../src/fracture/entities/EdgeConstraint';

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

  /*
  it('should correctly triangulate two separate triangles', () => {
    const inputPoints = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(2, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(2, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),
    ];

    const constraints = [
      new EdgeConstraint(0, 1),
      new EdgeConstraint(1, 5),
      new EdgeConstraint(5, 0),
      new EdgeConstraint(2, 3),
      new EdgeConstraint(3, 4),
      new EdgeConstraint(4, 2),
    ];

    const triangulator = new ConstrainedTriangulator(inputPoints, constraints, new Vector3(0, -1, 0));
    const triangles = triangulator.triangulate();

    // Verify the triangulation has the correct number of triangles
    expect(triangles.toString()).toEqual('4,2,3,1,5,0');
  });
*/
  it('should correctly triangulate two separate triangles', () => {
    const inputPoints = [
      new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0.5, 0, 0.5), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(0, 0, 1), new Vector3(0, 1, 0), new Vector2()),

      new MeshVertex(new Vector3(2, 0, 0), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(2, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0), new Vector2()),
      new MeshVertex(new Vector3(1.5, 0, 0.5), new Vector3(0, 1, 0), new Vector2()),
    ];

    const constraints = [
      new EdgeConstraint(0, 1),
      new EdgeConstraint(1, 2),
      new EdgeConstraint(2, 3),
      new EdgeConstraint(3, 0),
      new EdgeConstraint(4, 5),
      new EdgeConstraint(5, 6),
      new EdgeConstraint(6, 7),
      new EdgeConstraint(7, 4)
    ];

    const triangulator = new ConstrainedTriangulator(inputPoints, constraints, new Vector3(0, -1, 0));
    const triangles = triangulator.triangulate();

    // Verify the triangulation has the correct number of triangles
    expect(triangles.toString()).toEqual('7,4,5,7,5,6,2,0,1,3,0,2');
  });
});