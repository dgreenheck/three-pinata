import * as THREE from "three";
import { Vector2, Vector3 } from "three";
import { Fragment } from "../../entities/Fragment";
import { MeshVertex } from "../../entities/MeshVertex";
import { EdgeConstraint } from "../../entities/EdgeConstraint";
import {
  packSourceFragment,
  unpackSourceFragment,
  packSeeds,
  unpackSeeds,
  packFragmentResult,
} from "../FragmentTransfer";

/**
 * Creates a simple Fragment from a BoxGeometry for testing.
 */
function createBoxFragment(): Fragment {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const positions = geometry.attributes.position.array as Float32Array;
  const normals = geometry.attributes.normal.array as Float32Array;
  const uvs = geometry.attributes.uv.array as Float32Array;

  const fragment = new Fragment();
  for (let i = 0; i < positions.length / 3; i++) {
    fragment.vertices.push(
      new MeshVertex(
        new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]),
        new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]),
        uvs
          ? new Vector2(uvs[i * 2], uvs[i * 2 + 1])
          : new Vector2(0, 0),
      ),
    );
  }

  if (geometry.index) {
    fragment.triangles = [Array.from(geometry.index.array as Uint32Array), []];
  } else {
    const count = positions.length / 3;
    fragment.triangles = [Array.from({ length: count }, (_, i) => i), []];
  }

  fragment.calculateBounds();
  geometry.dispose();
  return fragment;
}

/**
 * Creates a Fragment with cut vertices (simulates a sliced fragment).
 */
function createSlicedFragment(): Fragment {
  const fragment = createBoxFragment();

  // Add some cut vertices (simulating what sliceFragment produces)
  const cutVert1 = new MeshVertex(
    new Vector3(0.5, 0.0, 0.0),
    new Vector3(0, 1, 0),
    new Vector2(0.25, 0.5),
  );
  const cutVert2 = new MeshVertex(
    new Vector3(-0.5, 0.0, 0.0),
    new Vector3(0, 1, 0),
    new Vector2(0.75, 0.5),
  );
  const cutVert3 = new MeshVertex(
    new Vector3(0.0, 0.0, 0.5),
    new Vector3(0, 1, 0),
    new Vector2(0.5, 0.75),
  );

  fragment.addCutFaceVertex(cutVert1.position, cutVert1.normal, cutVert1.uv);
  fragment.addCutFaceVertex(cutVert2.position, cutVert2.normal, cutVert2.uv);
  fragment.addCutFaceVertex(cutVert3.position, cutVert3.normal, cutVert3.uv);

  // Add a triangle for the cut face submesh
  const baseIdx = fragment.vertices.length - 3;
  fragment.triangles[1].push(baseIdx, baseIdx + 1, baseIdx + 2);

  // Add some constraints
  fragment.constraints.push(new EdgeConstraint(0, 1));
  fragment.constraints.push(new EdgeConstraint(1, 2));

  return fragment;
}

describe("FragmentTransfer", () => {
  describe("packSourceFragment / unpackSourceFragment", () => {
    it("round-trips vertex positions correctly", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.vertices.length).toBe(original.vertices.length);
      for (let i = 0; i < original.vertices.length; i++) {
        expect(unpacked.vertices[i].position.x).toBeCloseTo(
          original.vertices[i].position.x,
          10,
        );
        expect(unpacked.vertices[i].position.y).toBeCloseTo(
          original.vertices[i].position.y,
          10,
        );
        expect(unpacked.vertices[i].position.z).toBeCloseTo(
          original.vertices[i].position.z,
          10,
        );
      }
    });

    it("round-trips vertex normals correctly", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      for (let i = 0; i < original.vertices.length; i++) {
        expect(unpacked.vertices[i].normal.x).toBeCloseTo(
          original.vertices[i].normal.x,
          10,
        );
        expect(unpacked.vertices[i].normal.y).toBeCloseTo(
          original.vertices[i].normal.y,
          10,
        );
        expect(unpacked.vertices[i].normal.z).toBeCloseTo(
          original.vertices[i].normal.z,
          10,
        );
      }
    });

    it("round-trips vertex UVs correctly", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      for (let i = 0; i < original.vertices.length; i++) {
        expect(unpacked.vertices[i].uv.x).toBeCloseTo(
          original.vertices[i].uv.x,
          10,
        );
        expect(unpacked.vertices[i].uv.y).toBeCloseTo(
          original.vertices[i].uv.y,
          10,
        );
      }
    });

    it("round-trips submesh 0 indices correctly", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.triangles[0]).toEqual(original.triangles[0]);
    });

    it("round-trips submesh 1 indices correctly (empty submesh)", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.triangles[1]).toEqual(original.triangles[1]);
      expect(unpacked.triangles[1]).toEqual([]);
    });

    it("round-trips bounds correctly", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.bounds.min.x).toBeCloseTo(original.bounds.min.x, 10);
      expect(unpacked.bounds.min.y).toBeCloseTo(original.bounds.min.y, 10);
      expect(unpacked.bounds.min.z).toBeCloseTo(original.bounds.min.z, 10);
      expect(unpacked.bounds.max.x).toBeCloseTo(original.bounds.max.x, 10);
      expect(unpacked.bounds.max.y).toBeCloseTo(original.bounds.max.y, 10);
      expect(unpacked.bounds.max.z).toBeCloseTo(original.bounds.max.z, 10);
    });

    it("preserves vertex count through round-trip", () => {
      const original = createBoxFragment();
      const packed = packSourceFragment(original);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.vertices.length).toBe(original.vertices.length);
      expect(packed.vertexCount).toBe(original.vertices.length);
    });

    it("handles geometry with non-empty submesh 1", () => {
      const fragment = createBoxFragment();
      // Move some indices to submesh 1
      const moved = fragment.triangles[0].splice(-6);
      fragment.triangles[1] = moved;

      const packed = packSourceFragment(fragment);
      const unpacked = unpackSourceFragment(packed);

      expect(unpacked.triangles[0]).toEqual(fragment.triangles[0]);
      expect(unpacked.triangles[1]).toEqual(fragment.triangles[1]);
    });

    it("produces SharedArrayBuffers when available", () => {
      const fragment = createBoxFragment();
      const packed = packSourceFragment(fragment);

      // In Node.js with SharedArrayBuffer available
      if (typeof SharedArrayBuffer !== "undefined") {
        expect(packed.positions).toBeInstanceOf(SharedArrayBuffer);
        expect(packed.normals).toBeInstanceOf(SharedArrayBuffer);
        expect(packed.uvs).toBeInstanceOf(SharedArrayBuffer);
        expect(packed.indices0).toBeInstanceOf(SharedArrayBuffer);
        expect(packed.indices1).toBeInstanceOf(SharedArrayBuffer);
      }
    });
  });

  describe("packSeeds / unpackSeeds", () => {
    it("round-trips seed positions correctly", () => {
      const seeds = [
        new Vector3(1.0, 2.0, 3.0),
        new Vector3(-0.5, 0.7, -1.2),
        new Vector3(0.0, 0.0, 0.0),
        new Vector3(100.123, -50.456, 0.789),
      ];

      const packed = packSeeds(seeds);
      const unpacked = unpackSeeds(packed);

      expect(unpacked.length).toBe(seeds.length);
      for (let i = 0; i < seeds.length; i++) {
        expect(unpacked[i].x).toBeCloseTo(seeds[i].x, 10);
        expect(unpacked[i].y).toBeCloseTo(seeds[i].y, 10);
        expect(unpacked[i].z).toBeCloseTo(seeds[i].z, 10);
      }
    });

    it("preserves seed count", () => {
      const seeds = [
        new Vector3(1, 2, 3),
        new Vector3(4, 5, 6),
      ];

      const packed = packSeeds(seeds);
      expect(packed.count).toBe(2);
    });

    it("handles single seed", () => {
      const seeds = [new Vector3(42, 0, -1)];
      const packed = packSeeds(seeds);
      const unpacked = unpackSeeds(packed);

      expect(unpacked.length).toBe(1);
      expect(unpacked[0].x).toBeCloseTo(42, 10);
    });

    it("handles many seeds", () => {
      const seeds: Vector3[] = [];
      for (let i = 0; i < 100; i++) {
        seeds.push(new Vector3(i * 0.1, i * -0.2, i * 0.3));
      }

      const packed = packSeeds(seeds);
      const unpacked = unpackSeeds(packed);

      expect(unpacked.length).toBe(100);
      for (let i = 0; i < 100; i++) {
        expect(unpacked[i].x).toBeCloseTo(seeds[i].x, 10);
        expect(unpacked[i].y).toBeCloseTo(seeds[i].y, 10);
        expect(unpacked[i].z).toBeCloseTo(seeds[i].z, 10);
      }
    });
  });

  describe("packFragmentResult", () => {
    it("produces correct position layout for vertices only", () => {
      const fragment = new Fragment();
      fragment.vertices.push(
        new MeshVertex(new Vector3(1, 2, 3), new Vector3(0, 1, 0), new Vector2(0.5, 0.5)),
      );
      fragment.vertices.push(
        new MeshVertex(new Vector3(4, 5, 6), new Vector3(1, 0, 0), new Vector2(0.0, 1.0)),
      );
      fragment.triangles = [[0, 1, 0], []];

      const result = packFragmentResult(fragment);

      expect(result.positions.length).toBe(6); // 2 verts * 3
      expect(result.positions[0]).toBeCloseTo(1);
      expect(result.positions[1]).toBeCloseTo(2);
      expect(result.positions[2]).toBeCloseTo(3);
      expect(result.positions[3]).toBeCloseTo(4);
      expect(result.positions[4]).toBeCloseTo(5);
      expect(result.positions[5]).toBeCloseTo(6);
    });

    it("produces correct normal layout", () => {
      const fragment = new Fragment();
      fragment.vertices.push(
        new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2(0, 0)),
      );
      fragment.triangles = [[], []];

      const result = packFragmentResult(fragment);

      expect(result.normals[0]).toBeCloseTo(0);
      expect(result.normals[1]).toBeCloseTo(1);
      expect(result.normals[2]).toBeCloseTo(0);
    });

    it("produces correct UV layout", () => {
      const fragment = new Fragment();
      fragment.vertices.push(
        new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 0, 1), new Vector2(0.3, 0.7)),
      );
      fragment.triangles = [[], []];

      const result = packFragmentResult(fragment);

      expect(result.uvs[0]).toBeCloseTo(0.3);
      expect(result.uvs[1]).toBeCloseTo(0.7);
    });

    it("includes cut vertices after regular vertices in output", () => {
      const fragment = createSlicedFragment();
      const regularCount = fragment.vertices.length;
      const cutCount = fragment.cutVertices.length;

      const result = packFragmentResult(fragment);

      // Total vertex count includes both regular and cut vertices
      expect(result.positions.length).toBe((regularCount + cutCount) * 3);
      expect(result.normals.length).toBe((regularCount + cutCount) * 3);
      expect(result.uvs.length).toBe((regularCount + cutCount) * 2);
    });

    it("correctly reports group counts", () => {
      const fragment = createSlicedFragment();

      const result = packFragmentResult(fragment);

      expect(result.group0Count).toBe(fragment.triangles[0].length);
      expect(result.group1Count).toBe(fragment.triangles[1].length);
      expect(result.indices.length).toBe(
        fragment.triangles[0].length + fragment.triangles[1].length,
      );
    });

    it("concatenates submesh indices in correct order", () => {
      const fragment = new Fragment();
      fragment.vertices.push(
        new MeshVertex(new Vector3(0, 0, 0), new Vector3(0, 1, 0), new Vector2(0, 0)),
        new MeshVertex(new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector2(1, 0)),
        new MeshVertex(new Vector3(0, 1, 0), new Vector3(0, 1, 0), new Vector2(0, 1)),
        new MeshVertex(new Vector3(1, 1, 0), new Vector3(0, 1, 0), new Vector2(1, 1)),
      );
      fragment.triangles = [
        [0, 1, 2],     // submesh 0
        [1, 3, 2],     // submesh 1
      ];

      const result = packFragmentResult(fragment);

      expect(result.group0Count).toBe(3);
      expect(result.group1Count).toBe(3);
      // Indices should be concatenated: submesh0 first, then submesh1
      expect(Array.from(result.indices)).toEqual([0, 1, 2, 1, 3, 2]);
    });

    it("produces Float32Array typed arrays", () => {
      const fragment = createBoxFragment();
      const result = packFragmentResult(fragment);

      expect(result.positions).toBeInstanceOf(Float32Array);
      expect(result.normals).toBeInstanceOf(Float32Array);
      expect(result.uvs).toBeInstanceOf(Float32Array);
      expect(result.indices).toBeInstanceOf(Uint32Array);
    });
  });
});
