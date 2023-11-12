import MeshVertex from '../src/fragment/MeshVertex'
import { Vector2, Vector3 } from 'three';

/*
public class MeshVertexTests
{
    [Test]
    public void EqualPositionsEqual()
    {
        MeshVertex vertexA = new MeshVertex();
        MeshVertex vertexB = new MeshVertex(new Vector3(1, 2, 3), Vector3.up, Vector2.zero);
        Assert.True(vertexA == vertexB);
    }
    
    [Test]
    public void DifferentPositionsNotEqual()
    {
        MeshVertex vertexA = new MeshVertex(new Vector3(1, 2, 3), Vector3.up, Vector2.zero);
        MeshVertex vertexB = new MeshVertex(new Vector3(1, 2, 3), Vector3.up, Vector2.zero);
        Assert.True(vertexA == vertexB);
    }
}
*/
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