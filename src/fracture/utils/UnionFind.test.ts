import { Vector3 } from 'three';
import { findIsolatedGeometry } from './UnionFind';
import { Fragment } from '../fragment/Fragment';
import MeshVertex from '../fragment/MeshVertex';

describe('isPointAbovePlane', () => {
  test('point above plane returns true', () => {
    const fragment = new Fragment();
    fragment.vertices = [
      new MeshVertex(new Vector3(0, 0, 0)),
      new MeshVertex(new Vector3(1, 0, 0)),
      new MeshVertex(new Vector3(0, 1, 0)),
      new MeshVertex(new Vector3(1, 1, 0)),
      new MeshVertex(new Vector3(2, 0, 0)),
      new MeshVertex(new Vector3(2, 1, 0)),
    ];
    fragment.triangles[0] = [0, 1, 2, 1, 0, 2, 4, 5, 3];
    const fragments = findIsolatedGeometry(fragment);
    expect(fragments.length).toBe(2);
    expect(fragments[0].vertices.length).toBe(3);
    expect(fragments[1].vertices.length).toBe(3);
  });
});