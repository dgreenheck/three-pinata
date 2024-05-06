import { Box3, Vector2, Vector3, BufferGeometry, BufferAttribute } from 'three';
import MeshVertex from './MeshVertex';
import EdgeConstraint from './EdgeConstraint';

// The enum can be directly translated
export enum SlicedMeshSubmesh {
  Default = 0,
  CutFace = 1,
}

// The class definition is translated into TypeScript
export class Fragment {
  /**
   * Array of vertices for geometry on the non-cut faces
   */
  vertices: MeshVertex[];

  /**
   * Array of vertices for geometry on the cut faces
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

  /**
   * Tracks which vertex a cut-face vertex maps. This is used for during the island
   * detection algorithm to connect non-cut-face geometry to the cut-face geometry.
   */
  vertexAdjacency: number[];

  constructor() {
    this.vertices = [];
    this.cutVertices = [];
    this.triangles = [[], []];
    this.constraints = [];
    this.indexMap = [];
    this.bounds = new Box3();
    this.vertexAdjacency = [];
  }

  static fromGeometry(geometry: BufferGeometry): Fragment {
    var positions = geometry.attributes.position.array as Float32Array;
    var normals = geometry.attributes.normal.array as Float32Array;
    var uvs = geometry.attributes.uv.array as Float32Array;

    const data = new Fragment();
    for (let i = 0; i < positions.length / 3; i++) {
      const position = new Vector3(
        positions[3 * i], 
        positions[3 * i + 1], 
        positions[3 * i + 2]);
    
      const normal = new Vector3(
        normals[3 * i], 
        normals[3 * i + 1], 
        normals[3 * i + 2]);

      const uv = new Vector2(
        uvs[2 * i], 
        uvs[2 * i + 1]);

      data.vertices.push(new MeshVertex(position, normal, uv));
    }

    data.triangles = [Array.from(geometry.index?.array as Uint32Array), []];
    data.calculateBounds();

    return data;
  }

  /**
   * Gets the total number of triangles across all sub meshes
   */
  get triangleCount(): number {
    return (this.triangles[0].length + this.triangles[1].length) / 3;
  }

  /**
   * Gets the total number of vertices in the geometry
   */
  get vertexCount(): number {
    return (this.vertices.length + this.cutVertices.length);
  }

  /**
   * Adds a new cut face vertex
   * @param position The vertex position
   * @param normal The vertex normal
   * @param uv The vertex UV coordinates
   */
  addCutFaceVertex(position: Vector3, normal: Vector3, uv: Vector2): void {
    const vertex = new MeshVertex(position, normal, uv);
    this.vertices.push(vertex);
    this.cutVertices.push(vertex);

    // Track which non-cut-face vertex this cut-face vertex is mapped to
    this.vertexAdjacency.push(this.vertices.length - 1);
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
    // Need to update adjacency as well
    const weldedVertsAdjacency: number[] = [];

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
        if (this.cutVertices[i].equals(weldedVerts[j])) {
          indexMap[i] = j;
          duplicate = true;
          break;
        }
      }

      if (!duplicate) {
        weldedVerts.push(this.cutVertices[i]);
        weldedVertsAdjacency.push(this.vertexAdjacency[i]);
        indexMap[i] = k;
        k++;
      }
    }

    // Update the edge constraints to point to the new welded vertices
    for (let i = 0; i < this.constraints.length; i++) {
      const edge = this.constraints[i];
      edge.v1 = indexMap[edge.v1];
      edge.v2 = indexMap[edge.v2];
    }

    // Update the cut vertices
    this.cutVertices = weldedVerts;
    this.vertexAdjacency = weldedVertsAdjacency;
  }

  /**
   * Calculates the bounds of the mesh data
   */
  calculateBounds() {
    // Initialize min and max vectors with the first vertex in the array
    let min = this.vertices[0].position.clone();
    let max = min.clone();

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

  /**
   * Converts this to a BufferGeometry object
   */
  toGeometry(): BufferGeometry {
    const geometry = new BufferGeometry();

    const vertexCount = (this.vertices.length + this.cutVertices.length);
    const positions = new Array<number>(vertexCount * 3);
    const normals = new Array<number>(vertexCount * 3);
    const uvs = new Array<number>(vertexCount * 2);
    
    let posIdx = 0;
    let normIdx = 0;
    let uvIdx = 0;
    
    // Add the positions, normals and uvs for the non-cut-face geometry
    for (const vert of this.vertices) {
      positions[posIdx++] = vert.position.x;
      positions[posIdx++] = vert.position.y;
      positions[posIdx++] = vert.position.z;

      normals[normIdx++] = vert.normal.x;
      normals[normIdx++] = vert.normal.y;
      normals[normIdx++] = vert.normal.z;

      uvs[uvIdx++] = vert.uv.x;
      uvs[uvIdx++] = vert.uv.y;
    }

    // Next, add the positions, normals and uvs for the cut-face geometry
    for (const vert of this.cutVertices) {
      positions[posIdx++] = vert.position.x;
      positions[posIdx++] = vert.position.y;
      positions[posIdx++] = vert.position.z;

      normals[normIdx++] = vert.normal.x;
      normals[normIdx++] = vert.normal.y;
      normals[normIdx++] = vert.normal.z;

      uvs[uvIdx++] = vert.uv.x;
      uvs[uvIdx++] = vert.uv.y;
    }

    geometry.addGroup(0, this.triangles[0].length, 0);
    geometry.addGroup(this.triangles[0].length, this.triangles[1].length, 1);

    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    geometry.setIndex(new BufferAttribute(new Uint32Array(this.triangles.flat()), 1));

    return geometry;
  }

  clone(): Fragment {
    const clone = new Fragment();
    clone.bounds = this.bounds.clone();
    clone.constraints = [...clone.constraints];
    clone.cutVertices = [...clone.cutVertices];
    clone.indexMap = [...clone.indexMap];
    clone.triangles = [...clone.triangles];
    clone.vertices = [...clone.vertices];
    return clone;
  }
}