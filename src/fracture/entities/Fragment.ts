import { Vector2 } from "../utils/Vector2";
import { Vector3 } from "../utils/Vector3";
import { Box3 } from "../utils/Box3";
import MeshVertex from "./MeshVertex";
import EdgeConstraint from "./EdgeConstraint";

// The enum can be directly translated
export enum SlicedMeshSubmesh {
  Default = 0,
  CutFace = 1,
}

type FragmentArgs = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
};

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

  /**
   * Constructor for a Fragment object
   * @param args The arguments for the Fragment object
   */
  constructor(args: FragmentArgs | undefined = undefined) {
    this.vertices = [];
    this.cutVertices = [];
    this.triangles = [[], []];
    this.constraints = [];
    this.indexMap = [];
    this.bounds = new Box3();
    this.vertexAdjacency = [];

    if (!args) {
      return;
    }

    const { positions, normals, uvs, indices } = args;

    for (let i = 0; i < positions.length / 3; i++) {
      const position = new Vector3(
        positions[3 * i],
        positions[3 * i + 1],
        positions[3 * i + 2],
      );

      const normal = new Vector3(
        normals[3 * i],
        normals[3 * i + 1],
        normals[3 * i + 2],
      );

      const uv = new Vector2(uvs[2 * i], uvs[2 * i + 1]);

      this.vertices.push(new MeshVertex(position, normal, uv));
    }

    this.triangles = [Array.from(indices)];
    this.calculateBounds();
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
    return this.vertices.length + this.cutVertices.length;
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
  addTriangle(
    v1: number,
    v2: number,
    v3: number,
    subMesh: SlicedMeshSubmesh,
  ): void {
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
  addMappedTriangle(
    v1: number,
    v2: number,
    v3: number,
    subMesh: SlicedMeshSubmesh,
  ): void {
    this.triangles[subMesh].push(
      this.indexMap[v1],
      this.indexMap[v2],
      this.indexMap[v3],
    );
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

    // Perform spatial hashing of vertices
    const adjacencyMap = new Map<number, number>();
    this.cutVertices.forEach((vertex, i) => {
      const key = vertex.hash();
      if (!adjacencyMap.has(key)) {
        indexMap[i] = k;
        adjacencyMap.set(key, k);
        weldedVerts.push(this.cutVertices[i]);
        weldedVertsAdjacency.push(this.vertexAdjacency[i]);
        k++;
      } else {
        indexMap[i] = adjacencyMap.get(key)!;
      }
    });

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
    this.vertices.forEach((vertex) => {
      min.x = Math.min(min.x, vertex.position.x);
      min.y = Math.min(min.y, vertex.position.y);
      min.z = Math.min(min.z, vertex.position.z);

      max.x = Math.max(max.x, vertex.position.x);
      max.y = Math.max(max.y, vertex.position.y);
      max.z = Math.max(max.z, vertex.position.z);
    });

    this.bounds = new Box3(min, max);
  }
}
