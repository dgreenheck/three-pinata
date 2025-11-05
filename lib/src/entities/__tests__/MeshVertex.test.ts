import { MeshVertex } from "../MeshVertex";
import { Vector3 } from "three";

describe("MeshVertex", () => {
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
});
