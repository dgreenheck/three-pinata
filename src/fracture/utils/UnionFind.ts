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
    uf.union(fragment.vertexAdjacency[i], i + N);
  }
  
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      if (fragment.vertices[i].equals(fragment.vertices[j])) {
        uf.union(i, j);
      }
    }
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

  for (let i = 0; i < M; i++) {
    const root = uf.find(i + N);
    rootFragments[root].cutVertices.push(fragment.cutVertices[i]);
    vertexMap[i + N] = rootFragments[root].vertices.length + rootFragments[root].cutVertices.length - 1;
  }

  console.log(rootFragments);

  // Do the same with the triangles. Each index needs to be mapped to its new array position
  for (const key of Object.keys(rootTriangles)) {
    let i = Number(key);
    let root = uf.find(i);
    for (let submeshIndex = 0; submeshIndex < fragment.triangles.length; submeshIndex++) {
      for (const vertexIndex of rootTriangles[i][submeshIndex]) {
        const mappedIndex = vertexMap[vertexIndex];
        console.log(`${vertexIndex}->${mappedIndex}`);
        rootFragments[root].triangles[submeshIndex].push(mappedIndex);
      }
    }
  };

  console.log(rootFragments);
  
  return Object.values(rootFragments);
}
