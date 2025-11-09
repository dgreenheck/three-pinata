import { Vector2, Vector3 } from "three";
import { Fragment, SlicedMeshSubmesh } from "../Fragment";
import { MeshVertex } from "../MeshVertex";

describe("Fragment", () => {
  describe("Constructor", () => {
    it("should create empty fragment when no args provided", () => {
      const fragment = new Fragment();

      expect(fragment.vertices.length).toBe(0);
      expect(fragment.cutVertices.length).toBe(0);
      expect(fragment.triangles.length).toBe(2);
      expect(fragment.triangles[0].length).toBe(0);
      expect(fragment.triangles[1].length).toBe(0);
      expect(fragment.constraints.length).toBe(0);
      expect(fragment.indexMap.length).toBe(0);
      expect(fragment.bounds).toBeDefined();
      expect(fragment.vertexAdjacency.length).toBe(0);
    });

    it("should create fragment from positions and normals with indices", () => {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
      const indices = new Uint32Array([0, 1, 2]);

      const fragment = new Fragment({ positions, normals, uvs, indices });

      expect(fragment.vertices.length).toBe(3);
      expect(fragment.triangles[0]).toEqual([0, 1, 2]);
      expect(fragment.triangles[1]).toEqual([]);
    });

    it("should create fragment from positions and normals without UVs", () => {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

      const fragment = new Fragment({ positions, normals });

      expect(fragment.vertices.length).toBe(3);
      expect(fragment.vertices[0].uv.equals(new Vector2(0, 0))).toBe(true);
      expect(fragment.vertices[1].uv.equals(new Vector2(0, 0))).toBe(true);
      expect(fragment.vertices[2].uv.equals(new Vector2(0, 0))).toBe(true);
    });

    it("should create fragment from positions and normals without indices", () => {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);

      const fragment = new Fragment({ positions, normals });

      expect(fragment.vertices.length).toBe(3);
      expect(fragment.triangles[0]).toEqual([0, 1, 2]);
      expect(fragment.triangles[1]).toEqual([]);
    });

    it("should preserve vertex attributes when creating from arrays", () => {
      const positions = new Float32Array([1.5, 2.5, 3.5]);
      const normals = new Float32Array([0.1, 0.9, 0.1]);
      const uvs = new Float32Array([0.25, 0.75]);

      const fragment = new Fragment({ positions, normals, uvs });

      expect(fragment.vertices[0].position.x).toBeCloseTo(1.5);
      expect(fragment.vertices[0].position.y).toBeCloseTo(2.5);
      expect(fragment.vertices[0].position.z).toBeCloseTo(3.5);
      expect(fragment.vertices[0].normal.x).toBeCloseTo(0.1);
      expect(fragment.vertices[0].normal.y).toBeCloseTo(0.9);
      expect(fragment.vertices[0].normal.z).toBeCloseTo(0.1);
      expect(fragment.vertices[0].uv.x).toBeCloseTo(0.25);
      expect(fragment.vertices[0].uv.y).toBeCloseTo(0.75);
    });
  });

  describe("Getters", () => {
    it("should calculate triangleCount correctly", () => {
      const fragment = new Fragment();
      fragment.triangles[0] = [0, 1, 2, 3, 4, 5]; // 2 triangles
      fragment.triangles[1] = [0, 1, 2]; // 1 triangle

      expect(fragment.triangleCount).toBe(3);
    });

    it("should calculate vertexCount correctly", () => {
      const fragment = new Fragment();
      fragment.vertices = [
        new MeshVertex(new Vector3()),
        new MeshVertex(new Vector3()),
      ];
      fragment.cutVertices = [
        new MeshVertex(new Vector3()),
        new MeshVertex(new Vector3()),
        new MeshVertex(new Vector3()),
      ];

      expect(fragment.vertexCount).toBe(5);
    });
  });

  describe("addCutFaceVertex", () => {
    it("should add cut face vertex", () => {
      const fragment = new Fragment();
      const position = new Vector3(1, 2, 3);
      const normal = new Vector3(0, 1, 0);
      const uv = new Vector2(0.5, 0.5);

      fragment.addCutFaceVertex(position, normal, uv);

      expect(fragment.vertices.length).toBe(1);
      expect(fragment.cutVertices.length).toBe(1);
      expect(fragment.vertexAdjacency.length).toBe(1);
      expect(fragment.vertexAdjacency[0]).toBe(0);
    });

    it("should track vertex adjacency for multiple cut vertices", () => {
      const fragment = new Fragment();

      fragment.addCutFaceVertex(
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(2, 0, 0),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );

      expect(fragment.vertices.length).toBe(2);
      expect(fragment.cutVertices.length).toBe(2);
      expect(fragment.vertexAdjacency).toEqual([0, 1]);
    });
  });

  describe("addMappedVertex", () => {
    it("should add mapped vertex", () => {
      const fragment = new Fragment();
      const vertex = new MeshVertex(
        new Vector3(1, 2, 3),
        new Vector3(0, 1, 0),
        new Vector2(0.5, 0.5),
      );

      fragment.addMappedVertex(vertex, 10);

      expect(fragment.vertices.length).toBe(1);
      expect(fragment.indexMap[10]).toBe(0);
    });

    it("should map multiple vertices correctly", () => {
      const fragment = new Fragment();
      const v1 = new MeshVertex(new Vector3(1, 0, 0));
      const v2 = new MeshVertex(new Vector3(2, 0, 0));

      fragment.addMappedVertex(v1, 5);
      fragment.addMappedVertex(v2, 10);

      expect(fragment.vertices.length).toBe(2);
      expect(fragment.indexMap[5]).toBe(0);
      expect(fragment.indexMap[10]).toBe(1);
    });
  });

  describe("addTriangle", () => {
    it("should add triangle to default submesh", () => {
      const fragment = new Fragment();

      fragment.addTriangle(0, 1, 2, SlicedMeshSubmesh.Default);

      expect(fragment.triangles[0]).toEqual([0, 1, 2]);
      expect(fragment.triangles[1]).toEqual([]);
    });

    it("should add triangle to cut face submesh", () => {
      const fragment = new Fragment();

      fragment.addTriangle(0, 1, 2, SlicedMeshSubmesh.CutFace);

      expect(fragment.triangles[0]).toEqual([]);
      expect(fragment.triangles[1]).toEqual([0, 1, 2]);
    });

    it("should add multiple triangles to same submesh", () => {
      const fragment = new Fragment();

      fragment.addTriangle(0, 1, 2, SlicedMeshSubmesh.Default);
      fragment.addTriangle(2, 3, 4, SlicedMeshSubmesh.Default);

      expect(fragment.triangles[0]).toEqual([0, 1, 2, 2, 3, 4]);
    });
  });

  describe("addMappedTriangle", () => {
    it("should add mapped triangle", () => {
      const fragment = new Fragment();
      fragment.indexMap[10] = 0;
      fragment.indexMap[20] = 1;
      fragment.indexMap[30] = 2;

      fragment.addMappedTriangle(10, 20, 30, SlicedMeshSubmesh.Default);

      expect(fragment.triangles[0]).toEqual([0, 1, 2]);
    });

    it("should add mapped triangle to cut face submesh", () => {
      const fragment = new Fragment();
      fragment.indexMap[5] = 0;
      fragment.indexMap[6] = 1;
      fragment.indexMap[7] = 2;

      fragment.addMappedTriangle(5, 6, 7, SlicedMeshSubmesh.CutFace);

      expect(fragment.triangles[1]).toEqual([0, 1, 2]);
    });
  });

  describe("weldCutFaceVertices", () => {
    it("should weld duplicate cut face vertices", () => {
      const fragment = new Fragment();

      // Add duplicate vertices at same position
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(2, 2, 2),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );

      expect(fragment.cutVertices.length).toBe(3);

      fragment.weldCutFaceVertices();

      expect(fragment.cutVertices.length).toBe(2);
    });

    it("should update vertex adjacency when welding", () => {
      const fragment = new Fragment();

      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );

      expect(fragment.vertexAdjacency.length).toBe(2);

      fragment.weldCutFaceVertices();

      expect(fragment.vertexAdjacency.length).toBe(1);
    });

    it("should filter degenerate constraints after welding", () => {
      const fragment = new Fragment();
      const { EdgeConstraint } = require("../EdgeConstraint");

      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );

      // Add constraint between the duplicate vertices (will become degenerate)
      fragment.constraints.push(new EdgeConstraint(0, 1));

      fragment.weldCutFaceVertices();

      // Degenerate constraint should be filtered out
      expect(fragment.constraints.length).toBe(0);
    });

    it("should preserve non-degenerate constraints after welding", () => {
      const fragment = new Fragment();
      const { EdgeConstraint } = require("../EdgeConstraint");

      // Add three distinct vertices
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );
      fragment.addCutFaceVertex(
        new Vector3(1, 1, 1),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      ); // Duplicate
      fragment.addCutFaceVertex(
        new Vector3(2, 2, 2),
        new Vector3(0, 1, 0),
        new Vector2(0, 0),
      );

      // Add constraint between vertex 0 and 2 (non-degenerate after welding)
      fragment.constraints.push(new EdgeConstraint(0, 2));

      fragment.weldCutFaceVertices();

      // Non-degenerate constraint should be preserved
      expect(fragment.constraints.length).toBe(1);
    });
  });

  describe("calculateBounds", () => {
    it("should calculate bounds correctly", () => {
      const fragment = new Fragment();

      fragment.vertices.push(
        new MeshVertex(new Vector3(0, 0, 0)),
        new MeshVertex(new Vector3(5, 3, 2)),
        new MeshVertex(new Vector3(-1, -2, -3)),
      );

      fragment.calculateBounds();

      expect(fragment.bounds.min.x).toBe(-1);
      expect(fragment.bounds.min.y).toBe(-2);
      expect(fragment.bounds.min.z).toBe(-3);
      expect(fragment.bounds.max.x).toBe(5);
      expect(fragment.bounds.max.y).toBe(3);
      expect(fragment.bounds.max.z).toBe(2);
    });
  });
});
