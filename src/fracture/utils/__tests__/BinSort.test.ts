import { BinSort, IBinSortable } from "./BinSort";

class BinnedObjectMock implements IBinSortable {
  bin: number;

  constructor(bin: number) {
    this.bin = bin;
  }

  toString() {
    return `Bin = ${this.bin}`;
  }
}

describe("BinSort", () => {
  test("get bin number from single bin", () => {
    const n = 1;
    expect(BinSort.getBinNumber(0, 0, n)).toBe(0);
  });

  test("get bin number on even grid", () => {
    const n = 2;
    expect(BinSort.getBinNumber(0, 0, n)).toBe(0);
    expect(BinSort.getBinNumber(0, 1, n)).toBe(1);
    expect(BinSort.getBinNumber(1, 1, n)).toBe(2);
    expect(BinSort.getBinNumber(1, 0, n)).toBe(3);
  });

  test("get bin number on odd grid", () => {
    const n = 3;
    expect(BinSort.getBinNumber(0, 0, n)).toBe(0);
    expect(BinSort.getBinNumber(0, 1, n)).toBe(1);
    expect(BinSort.getBinNumber(0, 2, n)).toBe(2);
    expect(BinSort.getBinNumber(1, 2, n)).toBe(3);
    expect(BinSort.getBinNumber(1, 1, n)).toBe(4);
    expect(BinSort.getBinNumber(1, 0, n)).toBe(5);
    expect(BinSort.getBinNumber(2, 0, n)).toBe(6);
    expect(BinSort.getBinNumber(2, 1, n)).toBe(7);
    expect(BinSort.getBinNumber(2, 2, n)).toBe(8);
  });

  test("sort empty point list", () => {
    const binCount = 1;
    const input: BinnedObjectMock[] = [];
    const output = BinSort.sort(input, input.length, binCount);

    expect(output).toEqual(input);
  });

  test("sort zero bin count", () => {
    const binCount = 0;
    const input: BinnedObjectMock[] = [];
    const output = BinSort.sort(input, input.length, binCount);

    expect(output).toEqual(input);
  });

  test("sort single bin", () => {
    const binCount = 1;
    const input = [new BinnedObjectMock(0)];
    const output = BinSort.sort(input, input.length, binCount);

    expect(output).toEqual(input);
  });

  test("sort multiple bins partial sort", () => {
    const binCount = 10;
    const lastIndex = 5;
    const input: BinnedObjectMock[] = [];

    for (let i = 0; i < binCount; i++) {
      input.unshift(new BinnedObjectMock(i));
    }

    const output = BinSort.sort(input, lastIndex, binCount);

    expect(output).not.toEqual(input);
    expect(output.length).toBe(input.length);

    for (let i = 0; i < lastIndex; i++) {
      expect(output[i].bin).toBe(i + lastIndex);
    }

    for (let i = lastIndex; i < output.length; i++) {
      expect(output[i].bin).toBe(output.length - i - 1);
    }
  });

  test("sort multiple bins full sort", () => {
    const binCount = 10;
    const input: BinnedObjectMock[] = [];

    for (let i = 0; i < binCount; i++) {
      input.unshift(new BinnedObjectMock(i));
    }

    const output = BinSort.sort(input, input.length, binCount);

    expect(output).not.toEqual(input);
    expect(output.length).toBe(input.length);

    for (let i = 0; i < output.length; i++) {
      expect(output[i].bin).toBe(i);
    }
  });

  test("last index out of range", () => {
    const binCount = 10;
    const lastIndex = binCount + 1;
    const input: BinnedObjectMock[] = [];

    for (let i = 0; i < binCount; i++) {
      input.unshift(new BinnedObjectMock(i));
    }

    const output = BinSort.sort(input, lastIndex, binCount);

    expect(output).not.toEqual(input);
    expect(output.length).toBe(input.length);

    for (let i = 0; i < output.length; i++) {
      expect(output[i].bin).toBe(i);
    }
  });
});
