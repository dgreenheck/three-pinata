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
      // If they are the same rank, arbitrarily place P under Q
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
  const vertices = fragment.vertices;
  const indices = fragment.triangles;

  const uf = new UnionFind(vertices.length);
  const triangles: Record<number, number[][]> = {};

  // Group vertices using triangles
  for (let i = 0; i < fragment.triangles.length; i++) {
    for (let j = 0; j < indices[i].length; j += 3) {
      const a = indices[i][j];
      const b = indices[i][j + 1];
      const c = indices[i][j + 2];
      uf.union(a, b);
      uf.union(b, c);

      // Store triangles by root representative
      const root = uf.find(a);
      if (!triangles[root]) {
        triangles[root] = Array.from({ length: fragment.triangles.length }, () => []);
      }
      triangles[root][i].push(a, b, c);
    }
  }

  // Extract connected components and their triangles
  const fragments: Record<number, Fragment> = {};
  for (let i = 0; i < vertices.length; i++) {
    const root = uf.find(i);
    if (!fragments[root]) {
      fragments[root] = new Fragment();
    }
    fragments[root].vertices.push(vertices[i]);
  }

  // Assign triangles to their respective components
  for (const key of Object.keys(triangles)) {
    const root = Number(key);
    if (fragments[root]) {
      for (let j = 0; j < fragment.triangles.length; j++) {
        fragments[root].triangles[j].push(...triangles[root][j]);
      }
    }
  };

  return Object.values(fragments);
}
