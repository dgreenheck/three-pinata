import { Mesh } from 'three';
import { Fragment } from '../entities/Fragment';

/**
 * Identifies all disconnected sets of geometry contained within the mesh.
 * Each set of geometry is split into a separate meshes. 
 * @param mesh The mesh to search
 * @returns Returns an array of all disconnected meshes found.
 */
function findDisconnectedFragments(fragment: Fragment): Fragment[] {
  // Each disconnected set of geometry is referred to as an "island"
  const islands: Fragment[] = [];

  // Extract mesh data
  const positions = fragment.vertices.map((vertex) => vertex.position);
  const triangles = fragment.triangles;
  const normals = fragment.vertices.map((vertex) => vertex.normal);
  const uvs = fragment.vertices.map((vertex) => vertex.uv);

  // For each triangle, find the corresponding sub-mesh index. (Mesh.triangles contains  the triangles for all sub-meshes)
  const triangleSubMesh = new Array<number>(fragment.triangleCount);
  triangleSubMesh.fill(0, 0, fragment.triangles[0].length);
  triangleSubMesh.fill(1, fragment.triangles[0].length, fragment.triangles[1].length);

  const vertexTriangles: number[][] = new Array(positions.length);
  for (let i = 0; i < positions.length; i++) {
    vertexTriangles[i] = [];
  }

  let v1, v2, v3;
  for (let i = 0; i < triangles.length; i += 3) {
    const t = i / 3;
    v1 = triangles[i];
    v2 = triangles[i + 1];
    v3 = triangles[i + 2];
    vertexTriangles[v1].push(t);
    vertexTriangles[v2].push(t);
    vertexTriangles[v3].push(t);
  }

  // Search the mesh geometry and identify all islands
  const visitedVertices: boolean[] = new Array(positions.length).fill(false);
  const visitedTriangles: boolean[] = new Array(triangles.length).fill(false);
  const frontier: number[] = [];

  const islandVertices = new NativeArray<MeshVertex>(positions.length, Allocator.Temp, NativeArrayOptions.UninitializedMemory);

  const islandTriangles: number[][] = [];
  for (let i = 0; i < mesh.subMeshCount; i++) {
    islandTriangles[i] = new Array(triangles.length);
  }

  let vertexCount = 0;
  let totalIndexCount = 0;
  const subMeshIndexCounts: number[] = new Array(mesh.subMeshCount).fill(0);

  for (let i = 0; i < positions.length; i++) {
    if (visitedVertices[i]) continue;
    vertexCount = 0;
    totalIndexCount = 0;
    for (let j = 0; j < mesh.subMeshCount; j++) {
      subMeshIndexCounts[j] = 0;
    }

    frontier.push(i);
    const vertexMap: number[] = new Array(positions.length).fill(-1);

    while (frontier.length > 0) {
      const k = frontier.shift() as number;
      if (visitedVertices[k]) {
        continue;
      } else {
        visitedVertices[k] = true;
      }
      vertexMap[k] = vertexCount;
      islandVertices[vertexCount++] = new MeshVertex(positions[k], normals[k], uvs[k]);
      for (const t of vertexTriangles[k]) {
        if (!visitedTriangles[t]) {
          visitedTriangles[t] = true;
          for (let m = t * 3; m < t * 3 + 3; m++) {
            const v = triangles[m];
            subMeshIndex = triangleSubMesh[t];
            islandTriangles[subMeshIndex][subMeshIndexCounts[subMeshIndex]++] = v;
            totalIndexCount++;
            frontier.push(v);
            for (const cv of coincidentVertices[v]) {
              frontier.push(cv);
            }
          }
        }
      }
    }

    if (vertexCount > 0) {
      const island = new Mesh();
      island.SetIndexBufferParams(totalIndexCount, IndexFormat.UInt32);
      island.SetVertexBufferParams(vertexCount, MeshUtils.layout);
      island.SetVertexBufferData(islandVertices, 0, 0, vertexCount);
      island.subMeshCount = mesh.subMeshCount;
      let indexStart = 0;
      for (subMeshIndex = 0; subMeshIndex < mesh.subMeshCount; subMeshIndex++) {
        const subMeshIndexBuffer = islandTriangles[subMeshIndex];
        const subMeshIndexCount = subMeshIndexCounts[subMeshIndex];
        for (let k = 0; k < subMeshIndexCount; k++) {
          const originalIndex = subMeshIndexBuffer[k];
          subMeshIndexBuffer[k] = vertexMap[originalIndex];
        }
        island.SetIndexBufferData(subMeshIndexBuffer, 0, indexStart, subMeshIndexCount);
        island.SetSubMesh(subMeshIndex, new SubMeshDescriptor(indexStart, subMeshIndexCount));
        indexStart += subMeshIndexCount;
      }
      island.RecalculateBounds();
      islands.push(island);
    }
  }
  return islands;
}