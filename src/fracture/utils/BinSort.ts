/**
 * Defines an interface for an object that is sorted by bin number.
 */
export interface IBinSortable {
  bin: number;
}

/**
* Methods for sorting objects on an ordered grid by bin number.
* 
* The grid ordering is shown by example below. Even rows (row 0 = bottom row) are ordered
* right-to-left while odd rows are ordered left-to-right as depicted in the provided grid illustration.
*/
export class BinSort {
  /**
   * Computes the bin number for the set of grid coordinates.
   * 
   * @param i - Grid row
   * @param j - Grid column
   * @param n - Grid size
   * @returns The computed bin number based on row and column indices.
   */
  static getBinNumber(i: number, j: number, n: number): number {
      return (i % 2 === 0) ? (i * n) + j : ((i + 1) * n) - j - 1;
  }

  /**
   * Performs a counting sort of the input points based on their bin number. Only
   * sorts the elements in the index range [0, count]. If binCount is <= 1, no sorting
   * is performed. If lastIndex > input.length, the entire input array is sorted.
   * 
   * @param input - The input array to sort
   * @param lastIndex - The index of the last element in `input` to sort. Only the
   * elements [0, lastIndex) are sorted.
   * @param binCount - Number of bins
   * @returns The sorted array of points based on their bin number.
   */
  static sort<T extends IBinSortable>(input: T[], lastIndex: number, binCount: number): T[] {
      if (binCount <= 1) {
          return input; // Need at least two bins to sort
      }

      if (lastIndex > input.length) {
          lastIndex = input.length; // If lastIndex is out of range, sort the entire array
      }

      const count: number[] = new Array(binCount).fill(0);
      const output: T[] = new Array(input.length) as T[];

      for (let i = 0; i < lastIndex; i++) {
          count[input[i].bin]++;
      }

      for (let i = 1; i < binCount; i++) {
          count[i] += count[i - 1];
      }

      for (let i = lastIndex - 1; i >= 0; i--) {
          const binIndex = input[i].bin;
          count[binIndex]--;
          output[count[binIndex]] = input[i];
      }

      // Copy over the rest of the unsorted points
      for (let i = lastIndex; i < output.length; i++) {
          output[i] = input[i];
      }

      return output;
  }
}
