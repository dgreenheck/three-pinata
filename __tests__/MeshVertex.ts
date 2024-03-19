import MeshVertex from '../src/fragment/MeshVertex'
import { Vector3 } from 'three';

describe('MeshVertex', () => {
  it('same positions are equal', () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 2, 3));

    expect(vertexA.equals(vertexB)).toBe(true);
  })

  it('different x are not equal', () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(2, 2, 3));

    expect(vertexA.equals(vertexB)).toBe(false);
  })

  it('different y are not equal', () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 3, 3));

    expect(vertexA.equals(vertexB)).toBe(false);
  })

  it('different z are not equal', () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 2, 2));

    expect(vertexA.equals(vertexB)).toBe(false);
  })
})