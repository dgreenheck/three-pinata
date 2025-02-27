import { Vector2, Vector3 } from "three";
import * as MathUtils from "./MathUtils";
import { hashi2, hashv2, hash3 } from "./MathUtils";

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

describe("hashi2", () => {
  it("should generate unique hashes for different integer pairs", () => {
    expect(hashi2(1, 2)).not.toBe(hashi2(2, 1));
    expect(hashi2(0, 0)).not.toBe(hashi2(1, 0));
    expect(hashi2(-1, 1)).not.toBe(hashi2(1, -1));
  });

  it("should be consistent for the same inputs", () => {
    const hash1 = hashi2(5, 3);
    const hash2 = hashi2(5, 3);
    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes when only x component differs", () => {
    expect(hashi2(1, 5)).not.toBe(hashi2(2, 5));
  });

  it("should generate different hashes when only y component differs", () => {
    expect(hashi2(1, 5)).not.toBe(hashi2(1, 6));
  });
});

describe("hashv2", () => {
  it("should generate same hash for effectively equal Vector2s", () => {
    const tolerance = 1e-6;
    const offset = tolerance / 10;
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1 + offset, 2 + offset);
    expect(hashv2(v1, tolerance)).toBe(hashv2(v2, tolerance));
  });

  it("should generate different hashes for distinct Vector2s", () => {
    const tolerance = 1e-6;
    const offset = tolerance;
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1 + offset, 2 + offset);
    expect(hashv2(v1, tolerance)).not.toBe(hashv2(v2, tolerance));
  });

  it("should handle custom tolerance", () => {
    const tolerance = 1e-6;
    const v1 = new Vector2(1.1, 2.1);
    const v2 = new Vector2(1.2, 2.2);
    // Should be different with high precision
    expect(hashv2(v1, tolerance)).not.toBe(hashv2(v2, tolerance));
    // Should be same with low precision
    expect(hashv2(v1, 1)).toBe(hashv2(v2, 1));
  });

  it("should handle zero and negative values", () => {
    const v1 = new Vector2(0, 0);
    const v2 = new Vector2(-1, -1);
    const v3 = new Vector2(1, 1);

    expect(hashv2(v1)).not.toBe(hashv2(v2));
    expect(hashv2(v2)).not.toBe(hashv2(v3));
  });

  it("should generate different hashes when only x component differs", () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(2, 2);
    expect(hashv2(v1)).not.toBe(hashv2(v2));
  });

  it("should generate different hashes when only y component differs", () => {
    const v1 = new Vector2(1, 2);
    const v2 = new Vector2(1, 3);
    expect(hashv2(v1)).not.toBe(hashv2(v2));
  });
});

describe("hash3", () => {
  it("should generate same hash for effectively equal Vector3s", () => {
    const tolerance = 1e-6;
    const offset = tolerance / 10;
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(1 + offset, 2 + offset, 3 + offset);
    expect(hash3(v1, tolerance)).toBe(hash3(v2, tolerance));
  });

  it("should generate different hashes for distinct Vector3s", () => {
    const tolerance = 1e-6;
    const offset = tolerance;
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(1 + offset, 2 + offset, 3 + offset);
    expect(hash3(v1, tolerance)).not.toBe(hash3(v2, tolerance));
  });

  it("should handle custom tolerance", () => {
    const tolerance = 1e-6;
    const v1 = new Vector3(1.1, 2.1, 3.1);
    const v2 = new Vector3(1.2, 2.2, 3.2);
    // Should be different with high precision
    expect(hash3(v1, tolerance)).not.toBe(hash3(v2, tolerance));
    // Should be same with low precision
    expect(hash3(v1, 1)).toBe(hash3(v2, 1));
  });

  it("should handle zero and negative values", () => {
    const v1 = new Vector3(0, 0, 0);
    const v2 = new Vector3(-1, -1, -1);
    const v3 = new Vector3(1, 1, 1);

    expect(hash3(v1)).not.toBe(hash3(v2));
    expect(hash3(v2)).not.toBe(hash3(v3));
  });

  it("should generate different hashes when only x component differs", () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(2, 2, 3);
    expect(hash3(v1)).not.toBe(hash3(v2));
  });

  it("should generate different hashes when only y component differs", () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(1, 3, 3);
    expect(hash3(v1)).not.toBe(hash3(v2));
  });

  it("should generate different hashes when only z component differs", () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(1, 2, 4);
    expect(hash3(v1)).not.toBe(hash3(v2));
  });
});
