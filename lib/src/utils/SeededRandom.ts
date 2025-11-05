/**
 * Seeded pseudo-random number generator
 * Uses a simple Linear Congruential Generator (LCG) algorithm
 */
export class SeededRandom {
  private seed: number;
  private current: number;

  constructor(seed?: number) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
    this.current = this.seed;
  }

  /**
   * Returns the seed value used by this random number generator
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Returns a pseudo-random number between 0 (inclusive) and 1 (exclusive)
   */
  random(): number {
    // LCG using parameters from Numerical Recipes
    this.current = (this.current * 1664525 + 1013904223) % 4294967296;
    return this.current / 4294967296;
  }
}
