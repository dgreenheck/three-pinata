/// 
/**
 * Data structure that holds triangulation adjacency data for a quad
 */
export default class Quad {
  //               q3        
  //      *---------*---------*
  //       \       / \       /
  //        \ t2L /   \ t2R /
  //         \   /     \   /
  //          \ /   t2  \ /
  //        q1 *---------* q2 
  //          / \   t1  / \    
  //         /   \     /   \     
  //        / t1L \   / t1R \   
  //       /       \ /       \  
  //      *---------*---------*
  //               q4           

  // The indices of the quad vertices
  q1: number;
  q2: number;
  q3: number;
  q4: number;

  // The triangles that make up the quad
  t1: number;
  t2: number;

  // Triangle adjacency data
  t1L: number;
  t1R: number;
  t2L: number;
  t2R: number;

  constructor(
    q1: number,
    q2: number,
    q3: number,
    q4: number,
    t1: number,
    t2: number,
    t1L: number,
    t1R: number,
    t2L: number,
    t2R: number,
  ) {
    this.q1 = q1;
    this.q2 = q2;
    this.q3 = q3;
    this.q4 = q4;
    this.t1 = t1;
    this.t2 = t2;
    this.t1L = t1L;
    this.t1R = t1R;
    this.t2L = t2L;
    this.t2R = t2R;
  }

  toString() {
    return `T${this.t1}/T${this.t2} (V${this.q1},V${this.q2},V${this.q3},V${this.q4})`;
  }
}