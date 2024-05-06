import { Fragment } from '../fragment/Fragment';

class UnionFind {
  parent: number[];
  rank: number[];

  constructor(size: number) {
    // All elements are in separate groups to begin with
    this.parent = new Array(size).fill(0).map((_, index) => index);
    this.rank = new Array(size).fill(1);
  }

  find(p: number): number {
    // If the element isn't in its own group, find the root of that group
    // and set it to the parent of p to compress the path.
    if (this.parent[p] !== p) {
      this.parent[p] = this.find(this.parent[p]);  // Path compression
    }
    return this.parent[p];
  }

  union(p: number, q: number): void {
    const rootP = this.find(p);
    const rootQ = this.find(q);
    if (rootP === rootQ) return;

    // When merging sets, choosing the root with the higher rank to keep
    // the height of the tree as flat as possible
    if (this.rank[rootP] > this.rank[rootQ]) {
      this.parent[rootQ] = rootP;
    } else if (this.rank[rootP] < this.rank[rootQ]) {
      this.parent[rootP] = rootQ;
    } else {
      // If they are the same rank, make p the root of q
      this.parent[rootQ] = rootP;
      this.rank[rootP] += 1;
    }
  }
}

/**
 * Uses the union-find algorithm to find isolated groups of geometry
 * within a fragment that are not connected together. These groups
 * are identified and split into separate fragments.
 * @param fragment The fragment to search for islands
 * @returns An array of fragments
 */
export function findIsolatedGeometry(fragment: Fragment): Fragment[] {
  // Initialize the union-find data structure
  const uf = new UnionFind(fragment.vertexCount);
  // Triangles for each submesh are stored separately
  const rootTriangles: Record<number, number[][]> = {};

  // First, union each cut-face vertex with its coincident non-cut-face vertex
  // The union is performed so no cut-face vertex can be a root.
  const N = fragment.vertices.length;
  const M = fragment.cutVertices.length;
  for (let i = 0; i < M; i++) {
    const j = fragment.vertexAdjacency[i];
    uf.union(j, i + N);
  }
  
  // Group vertices by analyzing which vertices are connected via triangles
  const indices = fragment.triangles;
  for (let i = 0; i < fragment.triangles.length; i++) {
    // Analyze the triangles of each submesh separately
    for (let j = 0; j < indices[i].length; j += 3) {
      const a = (i === 0) ? indices[i][j] : indices[i][j] + N;
      const b = (i === 0) ? indices[i][j + 1] : indices[i][j + 1] + N;
      const c = (i === 0) ? indices[i][j + 2] : indices[i][j + 2] + N;
      uf.union(a, b);
      uf.union(b, c);

      // Store triangles by root representative
      const root = uf.find(a);
      if (!rootTriangles[root]) {
        rootTriangles[root] = [[], []]
      }

      rootTriangles[root][i].push(a, b, c);
    }
  }

  // New fragments created from geometry, mapped by root index
  const rootFragments: Record<number, Fragment> = {};
  const vertexMap: number[] = Array(fragment.vertexCount);

  for (let i = 0; i < fragment.vertexCount; i++) {
    const root = uf.find(i);
    if (!rootFragments[root]) {
      rootFragments[root] = new Fragment();
    }
    
    // [0...(N - 1)] - Non-cut-face vertices
    // [N...(N + M)] - Cut-face vertices
    if (i < N) {
      rootFragments[root].vertices.push(fragment.vertices[i]);
      vertexMap[i] = rootFragments[root].vertices.length - 1;
    } else {
      rootFragments[root].cutVertices.push(fragment.cutVertices[i - N]);
      vertexMap[i] = rootFragments[root].cutVertices.length - 1;
    }
  }

  // Do the same with the triangles. Each index needs to be mapped to its new array position
  for (const key of Object.keys(rootTriangles)) {
    const root = Number(key);
    if (rootFragments[root]) {
      for (let submeshIndex = 0; submeshIndex < fragment.triangles.length; submeshIndex++) {
        for (const vertexIndex of rootTriangles[root][submeshIndex]) {
          const mappedIndex = vertexMap[vertexIndex];
          rootFragments[root].triangles[submeshIndex].push(mappedIndex);
        }
      }
    }
  };

  return Object.values(rootFragments);
}
