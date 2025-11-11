import { MeshVertex } from "../MeshVertex";
import { Vector2, Vector3 } from "three";

describe("MeshVertex", () => {
  test("should create vertex with default parameters", () => {
    const vertex = new MeshVertex();

    expect(vertex.position).toEqual(new Vector3(0, 0, 0));
    expect(vertex.normal).toEqual(new Vector3(0, 0, 0));
    expect(vertex.uv).toEqual(new Vector2(0, 0));
  });

  test("same positions are equal", () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 2, 3));

    expect(vertexA.equals(vertexB)).toBe(true);
  });

  test("different x positions are not equal", () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(2, 2, 3));

    expect(vertexA.equals(vertexB)).toBe(false);
  });

  test("different y positions are not equal", () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 3, 3));

    expect(vertexA.equals(vertexB)).toBe(false);
  });

  test("different z positions are not equal", () => {
    let vertexA = new MeshVertex(new Vector3(1, 2, 3));
    let vertexB = new MeshVertex(new Vector3(1, 2, 4));

    expect(vertexA.equals(vertexB)).toBe(false);
  });

  test("should clone vertex with all properties", () => {
    const vertex = new MeshVertex(
      new Vector3(1, 2, 3),
      new Vector3(0, 1, 0),
      new Vector2(0.5, 0.5),
    );
    const cloned = vertex.clone();

    expect(cloned).not.toBe(vertex);
    expect(cloned.position).not.toBe(vertex.position);
    expect(cloned.normal).not.toBe(vertex.normal);
    expect(cloned.uv).not.toBe(vertex.uv);
    expect(cloned.position.equals(vertex.position)).toBe(true);
    expect(cloned.normal.equals(vertex.normal)).toBe(true);
    expect(cloned.uv.equals(vertex.uv)).toBe(true);
  });

  test("should convert to string", () => {
    const vertex = new MeshVertex(
      new Vector3(1, 2, 3),
      new Vector3(0, 1, 0),
      new Vector2(0.5, 0.75),
    );
    const str = vertex.toString();

    expect(str).toBe(
      "Position = 1, 2, 3, Normal = 0, 1, 0, UV = 0.5, 0.75",
    );
  });
});
