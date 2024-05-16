export class UnionFind {
  parent: number[];
  rank: number[];

  constructor(size: number) {
    this.parent = new Array(size);
    this.rank = new Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
      this.rank[i] = 1;
    }
  }

  find(p: number): number {
    // If the element isn't in its own group, find the root of that group
    // and set it to the parent of p to compress the path.
    if (this.parent[p] !== p) {
      this.parent[p] = this.find(this.parent[p]); // Path compression
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
