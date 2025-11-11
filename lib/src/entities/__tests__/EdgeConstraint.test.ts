import { EdgeConstraint } from "../EdgeConstraint";

describe("EdgeConstraint", () => {
  test("indentical edges are equal", () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(1, 2);

    expect(edgeA.equals(edgeB)).toBe(true);
  });

  test("different v1 edge are not equal", () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(3, 2);

    expect(edgeA.equals(edgeB)).toBe(false);
  });

  test("different v2 edge are not equal", () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(1, 3);

    expect(edgeA.equals(edgeB)).toBe(false);
  });

  test("edges in opposite directions are equal", () => {
    const edgeA = new EdgeConstraint(1, 2);
    const edgeB = new EdgeConstraint(2, 1);

    expect(edgeA.equals(edgeB)).toBe(true);
  });

  test("should clone edge with all properties", () => {
    const edge = new EdgeConstraint(1, 2, 10, 20, 3);
    const cloned = edge.clone();

    expect(cloned).not.toBe(edge);
    expect(cloned.v1).toBe(1);
    expect(cloned.v2).toBe(2);
    expect(cloned.t1).toBe(10);
    expect(cloned.t2).toBe(20);
    expect(cloned.t1Edge).toBe(3);
  });

  test("should convert to string", () => {
    const edge = new EdgeConstraint(1, 2, 10, 20, 3);
    const str = edge.toString();

    expect(str).toBe("Edge: T10->T20 (V1->V2)");
  });
});
