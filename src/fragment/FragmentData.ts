import { Box3, Vector2, Vector3, BufferGeometry } from 'three';
import MeshVertex from './MeshVertex';
import EdgeConstraint from './EdgeConstraint';

// The enum can be directly translated
enum SlicedMeshSubmesh {
  Default = 0,
  CutFace = 1,
}

// The class definition is translated into TypeScript
export default class FragmentData {
  /**
   * Vertex buffer for the non-cut mesh faces
   */
  vertices: MeshVertex[];

  /**
   * Vertex buffer for the cut mesh faces
   */
  cutVertices: MeshVertex[];

  /**
   * Index buffer for each submesh
   */
  triangles: number[][];

  /**
   * List of edges constraints for the cut-face triangulation
   */
  constraints: EdgeConstraint[];

  /**
   * Map between vertex indices in the source mesh and new indices for the sliced mesh
   */
  indexMap: number[];

  /**
   * The bounds of the vertex data (must manually call UpdateBounds() to update)
   */
  bounds: Box3;

  constructor() {
    this.vertices = [];
    this.cutVertices = [];
    this.triangles = [[], []];
    this.constraints = [];
    this.indexMap = [];
    this.bounds = new Box3();
  }

  static fromGeometry(geometry: BufferGeometry): FragmentData {
    var positions = geometry.attributes.position.array as Float32Array;
    var normals = geometry.attributes.normal.array as Float32Array;
    var uvs = geometry.attributes.uv.array as Float32Array;

    const data = new FragmentData();
    data.vertices = [];
    data.cutVertices = [];
    data.constraints = [];
    data.indexMap = [];

    let posIdx = 0;
    let normIdx = 0;
    let uvIdx = 0;
    for (let i = 0; i < positions.length; i++) {
      const position = new Vector3(positions[posIdx++], positions[posIdx++], positions[posIdx++]);
      const normal = new Vector3(normals[normIdx++], normals[normIdx++], normals[normIdx++]);
      const uv = new Vector2(uvs[uvIdx++], uvs[uvIdx++]);
      data.vertices.push(new MeshVertex(position, normal, uv));
    }

    data.triangles = [];
    geometry.groups.forEach((group) => {
      const groupTriangles = geometry.index?.array.slice(group.start, group.start + group.count) as Uint32Array;
      data.triangles.push(Array.from(groupTriangles));
    })

    data.calculateBounds();

    return data;
  }

  /**
   * Gets the total number of triangles across all sub meshes
   */
  get triangleCount(): number {
    return this.triangles.reduce((count, submesh) => count + submesh.length, 0);
  }

  /**
   * Gets the total number of vertices in the mesh
   */
  get vertexCount(): number {
    return this.vertices.length + this.cutVertices.length;
  }

  /**
   * Adds a new cut face vertex
   * @param position The vertex position
   * @param normal The vertex normal
   * @param uv The vertex UV coordinates
   * @returns Returns the index of the vertex in the cutVertices array
   */
  addCutFaceVertex(position: Vector3, normal: Vector3, uv: Vector2): number {
    const vertex = new MeshVertex(position, normal, uv);
    this.vertices.push(vertex);
    this.cutVertices.push(vertex);
    // The return type is void in the original C# but asks for index, adjust accordingly if needed.
    return this.cutVertices.length - 1;
  }

  /**
   * Adds a new vertex to this mesh that is mapped to the source mesh
   * @param vertex Vertex data
   * @param sourceIndex Index of the vertex in the source mesh
   */
  addMappedVertex(vertex: MeshVertex, sourceIndex: number): void {
    this.vertices.push(vertex);
    this.indexMap[sourceIndex] = this.vertices.length - 1;
  }

  /**
   * Adds a new triangle to this mesh. The arguments v1, v2, v3 are the indexes of the
   * vertices relative to this mesh's list of vertices; no mapping is performed.
   * @param v1 Index of the first vertex
   * @param v2 Index of the second vertex
   * @param v3 Index of the third vertex
   * @param subMesh The sub-mesh to add the triangle to
   */
  addTriangle(v1: number, v2: number, v3: number, subMesh: SlicedMeshSubmesh): void {
    this.triangles[subMesh].push(v1, v2, v3);
  }

  /**
   * Adds a new triangle to this mesh. The arguments v1, v2, v3 are the indices of the
   * vertices in the original mesh. These vertices are mapped to the indices in the sliced mesh.
   * @param v1 Index of the first vertex
   * @param v2 Index of the second vertex
   * @param v3 Index of the third vertex
   * @param subMesh The sub-mesh to add the triangle to
   */
  addMappedTriangle(v1: number, v2: number, v3: number, subMesh: SlicedMeshSubmesh): void {
    this.triangles[subMesh].push(this.indexMap[v1], this.indexMap[v2], this.indexMap[v3]);
  }

  /**
   * Finds coincident vertices on the cut face and welds them together.
   */
  weldCutFaceVertices(): void {
    // Temporary array containing the unique (welded) vertices
    // Initialize capacity to current number of cut vertices to prevent
    // unnecessary reallocations
    const weldedVerts: MeshVertex[] = [];

    // We also keep track of the index mapping between the skipped vertices
    // and the index of the welded vertex so we can update the edges
    const indexMap: number[] = new Array(this.cutVertices.length);

    // Number of welded vertices in the temp array
    let k = 0;

    // Loop through each vertex, identifying duplicates. Must compare directly
    // because floating point inconsistencies cause a hashtable to be unreliable
    // for vertices that are very close together but not directly coincident
    for (let i = 0; i < this.cutVertices.length; i++) {
      let duplicate = false;
      for (let j = 0; j < weldedVerts.length; j++) {
        if (this.cutVertices[i].position.equals(weldedVerts[j].position)) {
          indexMap[i] = j;
          duplicate = true;
          break;
        }
      }

      if (!duplicate) {
        weldedVerts.push(this.cutVertices[i]);
        indexMap[i] = k;
        k++;
      }
    }

    // Update the edges
    for (let i = 0; i < this.constraints.length; i++) {
      const edge = this.constraints[i];
      edge.v1 = indexMap[edge.v1];
      edge.v2 = indexMap[edge.v2];
    }

    // Update the cut vertices
    this.cutVertices = [...weldedVerts];
  }

  getTriangles(subMeshIndex: number): number[] {
    return this.triangles[subMeshIndex];
  }

  /**
   * Calculates the bounds of the mesh data
   */
  calculateBounds() {
    // Initialize min and max vectors with the first vertex in the array
    let min = new Vector3(
      this.vertices[0].position.x,
      this.vertices[0].position.y,
      this.vertices[0].position.z
    );

    let max = new Vector3(
      this.vertices[0].position.x,
      this.vertices[0].position.y,
      this.vertices[0].position.z
    );

    // Iterate over the vertices to find the min and max x, y, and z
    this.vertices.forEach(vertex => {
      min.x = Math.min(min.x, vertex.position.x);
      min.y = Math.min(min.y, vertex.position.y);
      min.z = Math.min(min.z, vertex.position.z);

      max.x = Math.max(max.x, vertex.position.x);
      max.y = Math.max(max.y, vertex.position.y);
      max.z = Math.max(max.z, vertex.position.z);
    });

    this.bounds = new Box3(min, max);
  }

  toMesh(): BufferGeometry {
    const geometry = new BufferGeometry();

    return geometry;
  }
}
