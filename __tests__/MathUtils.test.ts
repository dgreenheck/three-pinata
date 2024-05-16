import { Vector2, Vector3 } from "three";
import * as MathUtils from "../src/fracture/utils/MathUtils";

describe("isPointAbovePlane", () => {
  test("point above plane returns true", () => {
    var p = new Vector3(0, 1, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    MathUtils.isPointAbovePlane(p, n, o);
  });

  test("point below plane returns false", () => {
    var p = new Vector3(0, -1, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    MathUtils.isPointAbovePlane(p, n, o);
  });

  test("point on plane returns true", () => {
    var p = new Vector3(1, 0, 0);
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    MathUtils.isPointAbovePlane(p, n, o);
  });

  test("point on origin returns true", () => {
    var p = new Vector3();
    var n = new Vector3(0, 1, 0);
    var o = new Vector3();
    MathUtils.isPointAbovePlane(p, n, o);
  });
});

describe("isPointOnRightSideOfLine", () => {
  test("test point on right side returns true", () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(1, 0);
    expect(MathUtils.isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test("test point on left side returns false", () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0, 1);
    expect(MathUtils.isPointOnRightSideOfLine(a, b, p)).not.toBe(true);
  });

  test("test point is equal to first vertex of line returns true", () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0, 0);
    expect(MathUtils.isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test("test point is equal to second vertex of line returns true", () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(1, 1);
    expect(MathUtils.isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });

  test("test point is equal to midpoint returns true", () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(1, 1);
    const p = new Vector2(0.5, 0.5);
    expect(MathUtils.isPointOnRightSideOfLine(a, b, p)).toBe(true);
  });
});

describe("isQuadConvex", () => {
  test("a1 == b1 is convex", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a1;
    const b2 = new Vector2(1, 0);
    expect(MathUtils.isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test("a1 == b2 is convex", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a1;
    expect(MathUtils.isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test("a2 == b1 is convex", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a2;
    const b2 = new Vector2(1, 0);
    expect(MathUtils.isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });

  test("a2 == b2 is convex", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a2;
    expect(MathUtils.isQuadConvex(a1, a2, b1, b2)).toBe(true);
  });
});

describe("linePlaneIntersection", () => {
  test("degenerate line returns null", () => {
    const a = new Vector3(1, 1, 1);
    const b = new Vector3(1, 1, 1);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(MathUtils.linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test("zero length normal returns null", () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(1, 1, 1);
    const n = new Vector3(0, 0, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(MathUtils.linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test("line above plane returns null", () => {
    const a = new Vector3(0, 1, 0);
    const b = new Vector3(0, 2, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(MathUtils.linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test("line below plane returns null", () => {
    const a = new Vector3(0, -1, 0);
    const b = new Vector3(0, -2, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    expect(MathUtils.linePlaneIntersection(a, b, n, p0)).toBeNull();
  });

  test("line cross plane returns true", () => {
    const a = new Vector3(0, -1, 0);
    const b = new Vector3(0, 1, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = MathUtils.linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBeCloseTo(0.5);
  });

  test("line start point coincident with plane returns intersection", () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(0, 1, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = MathUtils.linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBe(0);
  });

  test("line endpoint coincident with plane returns intersection", () => {
    const a = new Vector3(0, 1, 0);
    const b = new Vector3(0, 0, 0);
    const n = new Vector3(0, 1, 0);
    const p0 = new Vector3(0, 0, 0);
    const result = MathUtils.linePlaneIntersection(a, b, n, p0);
    expect(result).not.toBeNull();
    expect(result?.x.x).toEqual(0);
    expect(result?.x.y).toEqual(0);
    expect(result?.x.z).toEqual(0);
    expect(result?.s).toBe(1);
  });
});

describe("linesIntersect", () => {
  test("intersection exists", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = new Vector2(1, 0);
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(true);
  });

  test("no intersection", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = new Vector2(1, 2);
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test("a1 == b1 intersect", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a1;
    const b2 = new Vector2(1, 0);
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test("a1 == b2 intersect", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a1;
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test("a2 == b1 intersect", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = a2;
    const b2 = new Vector2(1, 0);
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(false);
  });

  test("a2 == b2 intersect", () => {
    const a1 = new Vector2(0, 0);
    const a2 = new Vector2(1, 1);
    const b1 = new Vector2(0, 1);
    const b2 = a2;
    expect(MathUtils.linesIntersect(a1, a2, b1, b2)).toBe(false);
  });
});
