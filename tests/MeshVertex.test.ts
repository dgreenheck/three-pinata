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
    let vertexA = new MeshVertex(new Vector3(1, 2, 3), new Vector3(0, 1, 0), new Vector2());
    let vertexB = new MeshVertex(new Vector3(1, 2, 3), new Vector3(0, 1, 0), new Vector2());

    expect(vertexA.equals(vertexB)).toBe(true);
  })
})