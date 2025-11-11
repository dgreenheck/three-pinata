import * as THREE from "three";
import { DestructibleMesh } from "../DestructibleMesh";
import { FractureOptions } from "../entities/FractureOptions";
import { SliceOptions } from "../entities/SliceOptions";

describe("DestructibleMesh", () => {
  let geometry: THREE.BufferGeometry;
  let outerMaterial: THREE.MeshStandardMaterial;
  let innerMaterial: THREE.MeshStandardMaterial;

  beforeEach(() => {
    // Create a simple sphere geometry for testing
    geometry = new THREE.SphereGeometry(1, 16, 16);
    outerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    innerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  });

  describe("Constructor", () => {
    it("should create mesh with both materials", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      expect(mesh).toBeInstanceOf(DestructibleMesh);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(outerMaterial);
    });

    it("should create mesh with only outer material", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial);

      expect(mesh).toBeInstanceOf(DestructibleMesh);
      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(outerMaterial);
    });

    it("should create mesh with no materials", () => {
      const mesh = new DestructibleMesh(geometry);

      expect(mesh).toBeInstanceOf(DestructibleMesh);
      expect(mesh.geometry).toBe(geometry);
    });

    it("should create mesh with no geometry", () => {
      const mesh = new DestructibleMesh();

      expect(mesh).toBeInstanceOf(DestructibleMesh);
    });
  });

  describe("Fracture", () => {
    it("should fracture mesh into fragments", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 5,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments.length).toBeLessThanOrEqual(5);
    });

    it("should create fragments with inherited materials", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      fragments.forEach((fragment) => {
        expect(fragment).toBeInstanceOf(DestructibleMesh);
        expect(Array.isArray(fragment.material)).toBe(true);
        if (Array.isArray(fragment.material)) {
          expect(fragment.material[0]).toBe(outerMaterial);
          expect(fragment.material[1]).toBe(innerMaterial);
        }
      });
    });

    it("should call onFragment callback for each fragment", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const callback = jest.fn();
      const fragments = mesh.fracture(options, callback);

      expect(callback).toHaveBeenCalledTimes(fragments.length);
      fragments.forEach((fragment, index) => {
        expect(callback).toHaveBeenCalledWith(fragment, index);
      });
    });

    it("should inherit rendering properties from parent", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 5;

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      fragments.forEach((fragment) => {
        expect(fragment.castShadow).toBe(true);
        expect(fragment.receiveShadow).toBe(true);
        expect(fragment.renderOrder).toBe(5);
      });
    });

    it("should apply parent transform to fragments", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);
      mesh.position.set(1, 2, 3);
      mesh.rotation.set(0.5, 0.5, 0.5);
      mesh.scale.set(2, 2, 2);
      mesh.updateMatrixWorld();

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      fragments.forEach((fragment) => {
        expect(fragment.quaternion.equals(mesh.quaternion)).toBe(true);
        expect(fragment.scale.equals(mesh.scale)).toBe(true);
      });
    });

    it("should handle 2.5D Voronoi fracture mode", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 5,
        voronoiOptions: {
          mode: "2.5D",
          projectionAxis: "y",
        },
      });

      const fragments = mesh.fracture(options);

      expect(fragments.length).toBeGreaterThan(0);
    });

    it("should handle custom seed points", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const seedPoints = [
        new THREE.Vector3(-0.5, 0, 0),
        new THREE.Vector3(0.5, 0, 0),
        new THREE.Vector3(0, 0.5, 0),
      ];

      const options = new FractureOptions({
        voronoiOptions: {
          mode: "3D",
          seedPoints: seedPoints,
        },
      });

      const fragments = mesh.fracture(options);

      expect(fragments.length).toBeGreaterThan(0);
    });

    it("should handle impact point", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 10,
        voronoiOptions: {
          mode: "3D",
          impactPoint: new THREE.Vector3(0, 1, 0),
          impactRadius: 0.5,
        },
      });

      const fragments = mesh.fracture(options);

      expect(fragments.length).toBeGreaterThan(0);
    });
  });

  describe("Slice", () => {
    it("should slice mesh into pieces", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      expect(pieces.length).toBe(2);
    });

    it("should create pieces with inherited materials", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      pieces.forEach((piece) => {
        expect(piece).toBeInstanceOf(DestructibleMesh);
        expect(Array.isArray(piece.material)).toBe(true);
        if (Array.isArray(piece.material)) {
          expect(piece.material[0]).toBe(outerMaterial);
          expect(piece.material[1]).toBe(innerMaterial);
        }
      });
    });

    it("should call onPiece callback for each piece", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const callback = jest.fn();
      const pieces = mesh.slice(sliceNormal, sliceOrigin, options, callback);

      expect(callback).toHaveBeenCalledTimes(pieces.length);
      pieces.forEach((piece, index) => {
        expect(callback).toHaveBeenCalledWith(piece, index);
      });
    });

    it("should inherit rendering properties from parent", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.renderOrder = 5;

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      pieces.forEach((piece) => {
        expect(piece.castShadow).toBe(true);
        expect(piece.receiveShadow).toBe(true);
        expect(piece.renderOrder).toBe(5);
      });
    });

    it("should apply parent transform to pieces", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);
      mesh.position.set(1, 2, 3);
      mesh.rotation.set(0.5, 0.5, 0.5);
      mesh.scale.set(2, 2, 2);
      mesh.updateMatrixWorld();

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      pieces.forEach((piece) => {
        expect(piece.position.equals(mesh.position)).toBe(true);
        expect(piece.quaternion.equals(mesh.quaternion)).toBe(true);
        expect(piece.scale.equals(mesh.scale)).toBe(true);
      });
    });

    it("should handle texture scale and offset options", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const sliceNormal = new THREE.Vector3(0, 1, 0);
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();
      options.textureScale.set(2, 2);
      options.textureOffset.set(0.5, 0.5);

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      expect(pieces.length).toBe(2);
    });

    it("should handle oblique slice planes", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const sliceNormal = new THREE.Vector3(1, 1, 0).normalize();
      const sliceOrigin = new THREE.Vector3(0, 0, 0);
      const options = new SliceOptions();

      const pieces = mesh.slice(sliceNormal, sliceOrigin, options);

      expect(pieces.length).toBe(2);
    });
  });

  describe("Refracturing", () => {
    it("should allow fragments to be fractured again", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options1 = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const firstGenFragments = mesh.fracture(options1);
      expect(firstGenFragments.length).toBeGreaterThan(0);

      const options2 = new FractureOptions({
        fragmentCount: 2,
        voronoiOptions: {
          mode: "3D",
        },
      });

      // Verify that fragments can be fractured again
      const secondGenFragments = firstGenFragments[0].fracture(options2);
      expect(secondGenFragments.length).toBeGreaterThan(0);
    });

    it("should preserve materials through multiple fractures", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options1 = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const firstGenFragments = mesh.fracture(options1);

      const options2 = new FractureOptions({
        fragmentCount: 2,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const secondGenFragments = firstGenFragments[0].fracture(options2);

      secondGenFragments.forEach((fragment) => {
        expect(Array.isArray(fragment.material)).toBe(true);
        if (Array.isArray(fragment.material)) {
          expect(fragment.material[0]).toBe(outerMaterial);
          expect(fragment.material[1]).toBe(innerMaterial);
        }
      });
    });
  });

  describe("Material Handling", () => {
    it("should work with single material", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial);

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      fragments.forEach((fragment) => {
        expect(fragment.material).toBe(outerMaterial);
      });
    });

    it("should handle geometries with material groups", () => {
      const mesh = new DestructibleMesh(geometry, outerMaterial, innerMaterial);

      const options = new FractureOptions({
        fragmentCount: 3,
        voronoiOptions: {
          mode: "3D",
        },
      });

      const fragments = mesh.fracture(options);

      fragments.forEach((fragment) => {
        expect(fragment.geometry.groups.length).toBeGreaterThan(0);
        // Verify material groups exist
        fragment.geometry.groups.forEach((group) => {
          expect(group.materialIndex).toBeDefined();
          expect(group.start).toBeDefined();
          expect(group.count).toBeDefined();
        });
      });
    });
  });
});
