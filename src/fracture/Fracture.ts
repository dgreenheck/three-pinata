import * as THREE from "three";
import { FractureOptions } from "./entities/FractureOptions";
import { Fragment } from "./entities/Fragment";
import { slice } from "./Slice";
import { UnionFind } from "./utils/UnionFind";
import { Vector3 } from "./utils/Vector3";
import MeshVertex from "./entities/MeshVertex";
import { Vector2 } from "./utils/Vector2";

/**
 * Fractures the mesh into multiple fragments
 * @param mesh The source mesh to fracture
 * @param options Options for fracturing
 */
export function fracture(
  geometry: THREE.BufferGeometry,
  options: FractureOptions,
): THREE.BufferGeometry[] {
  // We begin by fragmenting the source mesh, then process each fragment in a FIFO queue
  // until we achieve the target fragment count.
  let fragments = [fragmentFromGeometry(geometry)];

  // Subdivide the mesh into multiple fragments until we reach the fragment limit
  while (fragments.length < options.fragmentCount) {
    const fragment = fragments.shift()!;
    if (!fragment) continue;

    fragment?.calculateBounds();

    // Select an arbitrary fracture plane normal
    const normal = new Vector3(
      options.fracturePlanes.x ? 2.0 * Math.random() - 1 : 0,
      options.fracturePlanes.y ? 2.0 * Math.random() - 1 : 0,
      options.fracturePlanes.z ? 2.0 * Math.random() - 1 : 0,
    ).normalize();

    const center = new Vector3();
    fragment.bounds.getCenter(center);

    if (options.fractureMode === "Non-Convex") {
      const { topSlice, bottomSlice } = slice(
        fragment,
        normal,
        center,
        options.textureScale,
        options.textureOffset,
        false,
      );

      const topfragments = findIsolatedGeometry(topSlice);
      const bottomfragments = findIsolatedGeometry(bottomSlice);

      // Check both slices for isolated fragments
      fragments.push(...topfragments);
      fragments.push(...bottomfragments);
    } else {
      const { topSlice, bottomSlice } = slice(
        fragment,
        normal,
        center,
        options.textureScale,
        options.textureOffset,
        true,
      );

      fragments.push(topSlice);
      fragments.push(bottomSlice);
    }
  }

  return fragments.map((fragment) => fragmentToGeometry(fragment));
}

/**
 * Uses the union-find algorithm to find isolated groups of geometry
 * within a fragment that are not connected together. These groups
 * are identified and split into separate fragments.
 * @returns An array of fragments
 */
function findIsolatedGeometry(fragment: Fragment): Fragment[] {
  // Initialize the union-find data structure
  const uf = new UnionFind(fragment.vertexCount);
  // Triangles for each submesh are stored separately
  const rootTriangles: Record<number, number[][]> = {};

  const N = fragment.vertices.length;
  const M = fragment.cutVertices.length;

  const adjacencyMap = new Map<number, number>();

  // Hash each vertex based on its position. If a vertex already exists
  // at that location, union this vertex with the existing vertex so they are
  // included in the same geometry group.
  fragment.vertices.forEach((vertex, index) => {
    const key = vertex.hash();
    const existingIndex = adjacencyMap.get(key);
    if (existingIndex === undefined) {
      adjacencyMap.set(key, index);
    } else {
      uf.union(existingIndex, index);
    }
  });

  // First, union each cut-face vertex with its coincident non-cut-face vertex
  // The union is performed so no cut-face vertex can be a root.
  for (let i = 0; i < M; i++) {
    uf.union(fragment.vertexAdjacency[i], i + N);
  }

  // Group vertices by analyzing which vertices are connected via triangles
  // Analyze the triangles of each submesh separately
  const indices = fragment.triangles;
  for (let submeshIndex = 0; submeshIndex < indices.length; submeshIndex++) {
    for (let i = 0; i < indices[submeshIndex].length; i += 3) {
      const a = indices[submeshIndex][i];
      const b = indices[submeshIndex][i + 1];
      const c = indices[submeshIndex][i + 2];
      uf.union(a, b);
      uf.union(b, c);

      // Store triangles by root representative
      const root = uf.find(a);
      if (!rootTriangles[root]) {
        rootTriangles[root] = [[], []];
      }

      rootTriangles[root][submeshIndex].push(a, b, c);
    }
  }

  // New fragments created from geometry, mapped by root index
  const rootFragments: Record<number, Fragment> = {};
  const vertexMap: number[] = Array(fragment.vertexCount);

  // Iterate over each vertex and add it to correct mesh
  for (let i = 0; i < N; i++) {
    const root = uf.find(i);

    // If there is no fragment for this root yet, create it
    if (!rootFragments[root]) {
      rootFragments[root] = new Fragment();
    }

    rootFragments[root].vertices.push(fragment.vertices[i]);
    vertexMap[i] = rootFragments[root].vertices.length - 1;
  }

  // Do the same for the cut-face vertices
  for (let i = 0; i < M; i++) {
    const root = uf.find(i + N);
    rootFragments[root].cutVertices.push(fragment.cutVertices[i]);
    vertexMap[i + N] =
      rootFragments[root].vertices.length +
      rootFragments[root].cutVertices.length -
      1;
  }

  // Iterate over triangles and add to the correct mesh
  for (const key of Object.keys(rootTriangles)) {
    let i = Number(key);

    // Minor optimization here:
    // Access the parent directly rather than using find() since the paths
    // for all indices have been compressed in the last two for loops
    let root = uf.parent[i];

    for (
      let submeshIndex = 0;
      submeshIndex < fragment.triangles.length;
      submeshIndex++
    ) {
      for (const vertexIndex of rootTriangles[i][submeshIndex]) {
        const mappedIndex = vertexMap[vertexIndex];
        rootFragments[root].triangles[submeshIndex].push(mappedIndex);
      }
    }
  }

  return Object.values(rootFragments);
}

/**
 * Converts this to a BufferGeometry object
 */
function fragmentToGeometry(fragment: Fragment): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const vertexCount = fragment.vertices.length + fragment.cutVertices.length;
  const positions = new Array<number>(vertexCount * 3);
  const normals = new Array<number>(vertexCount * 3);
  const uvs = new Array<number>(vertexCount * 2);

  let posIdx = 0;
  let normIdx = 0;
  let uvIdx = 0;

  // Add the positions, normals and uvs for the non-cut-face geometry
  for (const vert of fragment.vertices) {
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
  for (const vert of fragment.cutVertices) {
    positions[posIdx++] = vert.position.x;
    positions[posIdx++] = vert.position.y;
    positions[posIdx++] = vert.position.z;

    normals[normIdx++] = vert.normal.x;
    normals[normIdx++] = vert.normal.y;
    normals[normIdx++] = vert.normal.z;

    uvs[uvIdx++] = vert.uv.x;
    uvs[uvIdx++] = vert.uv.y;
  }

  geometry.addGroup(0, fragment.triangles[0].length, 0);
  geometry.addGroup(
    fragment.triangles[0].length,
    fragment.triangles[1].length,
    1,
  );

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(uvs), 2),
  );
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(fragment.triangles.flat()), 1),
  );

  return geometry;
}

function fragmentFromGeometry(geometry: THREE.BufferGeometry): Fragment {
  var positions = geometry.attributes.position.array as Float32Array;
  var normals = geometry.attributes.normal.array as Float32Array;
  var uvs = geometry.attributes.uv.array as Float32Array;

  const data = new Fragment();
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

    data.vertices.push(new MeshVertex(position, normal, uv));
  }

  data.triangles = [Array.from(geometry.index?.array as Uint32Array), []];
  data.calculateBounds();

  return data;
}
