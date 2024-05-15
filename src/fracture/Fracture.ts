import { Mesh, Vector3 } from 'three';
import { FractureOptions } from './entities/FractureOptions';
import { Fragment } from './entities/Fragment';
import { slice } from './Slice';
import { UnionFind } from './utils/UnionFind';

/**
 * Fractures the mesh into multiple fragments
 * @param mesh The source mesh to fracture
 * @param options Options for fracturing
 */
export function fracture(mesh: Mesh, options: FractureOptions): Fragment[] {
  // We begin by fragmenting the source mesh, then process each fragment in a FIFO queue
  // until we achieve the target fragment count.
  let fragments = [Fragment.fromGeometry(mesh.geometry)];

  // Subdivide the mesh into multiple fragments until we reach the fragment limit
  while (fragments.length < options.fragmentCount) {
    const fragment = fragments.shift()!;
    if (!fragment) continue;

    fragment?.calculateBounds();

    // Select an arbitrary fracture plane normal
    const normal = new Vector3(
      options.fracturePlanes.x ? (2.0 * Math.random() - 1) : 0,
      options.fracturePlanes.y ? (2.0 * Math.random() - 1) : 0,
      options.fracturePlanes.z ? (2.0 * Math.random() - 1) : 0
    ).normalize();

    const center = new Vector3();
    fragment.bounds.getCenter(center);

    if (options.fractureMode === 'Non-Convex') {
      const { topSlice, bottomSlice } = slice(
        fragment,
        normal,
        center,
        options.textureScale,
        options.textureOffset,
        false
      );

      const topfragments = findIsolatedGeometry(topSlice);
      const bottomfragments = findIsolatedGeometry(bottomSlice);

      // Check both slices for isolated fragments
      fragments.push(...topfragments)
      fragments.push(...bottomfragments);
    } else {
      const { topSlice, bottomSlice } = slice(
        fragment,
        normal,
        center,
        options.textureScale,
        options.textureOffset,
        true
      );

      fragments.push(topSlice);
      fragments.push(bottomSlice);
    }
  }

  return fragments;
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
    if (!existingIndex) {
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
        rootTriangles[root] = [[], []]
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
    vertexMap[i + N] = rootFragments[root].vertices.length + rootFragments[root].cutVertices.length - 1;
  }

  // Iterate over triangles and add to the correct mesh
  for (const key of Object.keys(rootTriangles)) {
    let i = Number(key);
    let root = uf.find(i);
    for (let submeshIndex = 0; submeshIndex < fragment.triangles.length; submeshIndex++) {
      for (const vertexIndex of rootTriangles[i][submeshIndex]) {
        const mappedIndex = vertexMap[vertexIndex];
        rootFragments[root].triangles[submeshIndex].push(mappedIndex);
      }
    }
  };

  return Object.values(rootFragments);
}