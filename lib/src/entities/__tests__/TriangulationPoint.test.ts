import { Vector2 } from "three";
import TriangulationPoint from "../TriangulationPoint";

describe("TriangulationPoint", () => {
  test("should create point with index and coords", () => {
    const coords = new Vector2(1.5, 2.5);
    const point = new TriangulationPoint(42, coords);

    expect(point.index).toBe(42);
    expect(point.coords).toBe(coords);
    expect(point.bin).toBe(0);
  });

  test("should initialize bin to 0", () => {
    const point = new TriangulationPoint(0, new Vector2(0, 0));

    expect(point.bin).toBe(0);
  });

  test("should allow bin to be modified", () => {
    const point = new TriangulationPoint(0, new Vector2(0, 0));
    point.bin = 5;

    expect(point.bin).toBe(5);
  });

  test("should convert to string", () => {
    const coords = new Vector2(1.5, 2.5);
    const point = new TriangulationPoint(42, coords);
    point.bin = 7;

    const str = point.toString();

    expect(str).toContain("7");
  });
});
