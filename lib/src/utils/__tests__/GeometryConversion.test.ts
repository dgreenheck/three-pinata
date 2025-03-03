import * as THREE from "three";
import { geometryToFragment, fragmentToGeometry } from "../GeometryConversion";
import { Fragment } from "../../entities/Fragment";
import { Vector2 } from "../Vector2";
import { Vector3 } from "../Vector3";
import MeshVertex from "../../entities/MeshVertex";

describe("GeometryConversion", () => {
  let cube: THREE.BufferGeometry;

  beforeEach(() => {
    // Create a simple cube geometry for testing
    cube = new THREE.BoxGeometry(1, 1, 1);
  });

  describe("geometryToFragment", () => {
    it("should convert BufferGeometry to Fragment", () => {
      const fragment = geometryToFragment(cube);

      expect(fragment).toBeInstanceOf(Fragment);
      expect(fragment.vertices.length).toBe(24); // Cube has 24 vertices (4 per face * 6 faces)
      expect(fragment.triangles[0].length).toBe(36); // 12 triangles * 3 vertices
      expect(fragment.triangles[1].length).toBe(0); // No cut faces yet
    });

    it("should preserve vertex attributes", () => {
      const fragment = geometryToFragment(cube);
      const positions = cube.attributes.position;
      const normals = cube.attributes.normal;
      const uvs = cube.attributes.uv;

      // Check first vertex
      expect(fragment.vertices[0].position.x).toBeCloseTo(positions.getX(0));
      expect(fragment.vertices[0].position.y).toBeCloseTo(positions.getY(0));
      expect(fragment.vertices[0].position.z).toBeCloseTo(positions.getZ(0));

      expect(fragment.vertices[0].normal.x).toBeCloseTo(normals.getX(0));
      expect(fragment.vertices[0].normal.y).toBeCloseTo(normals.getY(0));
      expect(fragment.vertices[0].normal.z).toBeCloseTo(normals.getZ(0));

      expect(fragment.vertices[0].uv.x).toBeCloseTo(uvs.getX(0));
      expect(fragment.vertices[0].uv.y).toBeCloseTo(uvs.getY(0));
    });
  });

  describe("fragmentToGeometry", () => {
    it("should convert Fragment back to BufferGeometry", () => {
      const fragment = new Fragment();

      // Add some test vertices
      fragment.vertices.push(
        new MeshVertex(
          new Vector3(0, 0, 0),
          new Vector3(0, 1, 0),
          new Vector2(0, 0),
        ),
        new MeshVertex(
          new Vector3(1, 0, 0),
          new Vector3(0, 1, 0),
          new Vector2(1, 0),
        ),
        new MeshVertex(
          new Vector3(0, 1, 0),
          new Vector3(0, 1, 0),
          new Vector2(0, 1),
        ),
      );

      // Add a triangle
      fragment.triangles[0] = [0, 1, 2];

      const geometry = fragmentToGeometry(fragment);

      expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(geometry.attributes.position.count).toBe(3);
      expect(geometry.attributes.normal.count).toBe(3);
      expect(geometry.attributes.uv.count).toBe(3);
      expect(geometry.index!.count).toBe(3);
    });

    it("should handle cut faces correctly", () => {
      const fragment = new Fragment();

      // Add regular vertices
      fragment.vertices.push(
        new MeshVertex(
          new Vector3(0, 0, 0),
          new Vector3(0, 1, 0),
          new Vector2(0, 0),
        ),
      );

      // Add cut face vertices
      fragment.cutVertices.push(
        new MeshVertex(
          new Vector3(1, 0, 0),
          new Vector3(0, 1, 0),
          new Vector2(1, 0),
        ),
      );

      // Add triangles for both submeshes
      fragment.triangles = [[0], [0]];

      const geometry = fragmentToGeometry(fragment);

      expect(geometry.groups.length).toBe(2);
      expect(geometry.groups[0].start).toBe(0);
      expect(geometry.groups[0].count).toBe(1);
      expect(geometry.groups[1].start).toBe(1);
      expect(geometry.groups[1].count).toBe(1);
    });
  });
});
