import { Vector3 } from 'three';
import { Triangulator } from './Triangulator';
import MeshVertex from '../fragment/MeshVertex';

function getAdjacentVertex(i: number, n: number): number {
  if ((i + 1) < n) {
    return i + 1;
  } else {
    return ((i + 1) % n) + 1;
  }
}

describe('Triangulator', () => {

  test('empty input points returns empty triangulation', () => {
    const triangulator = new Triangulator([], new Vector3(0, 0, 1));
    const triangles = triangulator.triangulate();
    expect(triangles.length).toBe(0);
  });

  test('less than three input points returns empty triangulation', () => {
    const points = [new MeshVertex(new Vector3()), new MeshVertex(new Vector3(1, 1, 1))];
    const triangulator = new Triangulator(points, new Vector3(0, 0, 1));
    const triangles = triangulator.triangulate();
    expect(triangles.length).toBe(0);
  });

  test('triangulate convex polygons (n = 3 to 20)', () => {
    // This test generates points for regular convex polygons of n = 3 to n = 20
    // and verifies the triangulation is correct. Each polygon has a vertex in its
    // center as well to ensure the triangulation is identical between runs.
    for (let n = 3; n <= 20; n++) {
      // Create the points of the polygon, starting with the center point
      const points = [new MeshVertex(new Vector3())];

      for (let i = 0; i < n; i++) {
        const angle = (i / n) * 2 * Math.PI;
        points.push(new MeshVertex(new Vector3(Math.cos(angle), Math.sin(angle), 0)));
      }

      const triangulator = new Triangulator(points, new Vector3(0, 0, 1));
      const triangles = triangulator.triangulate();

      expect(triangles.length).toBe(3 * n);

      for (let i = 0; i < triangles.length; i += 3) {
        const containsOrigin = (triangles[i] === 0 || triangles[i + 1] === 0 || triangles[i + 2] === 0);
        expect(containsOrigin).toBeTruthy();

        // Verify the other two vertices are adjacent and wound clockwise
        if (triangles[i] == 0) {
          expect(triangles[i + 2]).toBe(getAdjacentVertex(triangles[i + 1], points.length));
        }
        else if (triangles[i + 1] == 0) {
          expect(triangles[i]).toBe(getAdjacentVertex(triangles[i + 2], points.length));
        }
        else if (triangles[i + 2] == 0) {
          expect(triangles[i + 1]).toBe(getAdjacentVertex(triangles[i], points.length));
        }
      }
    }
  });
});
