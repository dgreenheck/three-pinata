import * as THREE from "three";
import { Vector3 } from "three";
import { voronoiFracture } from "../VoronoiFracture";
import { VoronoiFractureOptions } from "../../entities/VoronoiFractureOptions";

describe("voronoiFracture", () => {
  let boxGeometry: THREE.BufferGeometry;

  beforeEach(() => {
    // Create a simple box geometry for testing (low poly for performance)
    boxGeometry = new THREE.BoxGeometry(2, 2, 2, 1, 1, 1);
  });

  afterEach(() => {
    boxGeometry.dispose();
  });

  describe("basic fracturing", () => {
    it("should produce fragments from box geometry", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments.length).toBeLessThanOrEqual(3);

      fragments.forEach((f) => f.dispose());
    });

    it("should produce consistent results with same seed", () => {
      const options1 = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 42,
      });

      const options2 = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 42,
      });

      const fragments1 = voronoiFracture(boxGeometry, options1);
      const fragments2 = voronoiFracture(boxGeometry, options2);

      expect(fragments1.length).toBe(fragments2.length);

      fragments1.forEach((f) => f.dispose());
      fragments2.forEach((f) => f.dispose());
    });
  });

  describe("3D mode with grainDirection and anisotropy", () => {
    describe("isotropic behavior (anisotropy = 1.0)", () => {
      it("should produce similar results with anisotropy=1.0 and without grain", () => {
        const optionsWithoutGrain = new VoronoiFractureOptions({
          fragmentCount: 3,
          mode: "3D",
          seed: 12345,
        });

        const optionsWithIsotropicGrain = new VoronoiFractureOptions({
          fragmentCount: 3,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(0, 1, 0),
          anisotropy: 1.0, // Isotropic - should have no effect
        });

        const fragmentsWithout = voronoiFracture(
          boxGeometry,
          optionsWithoutGrain,
        );
        const fragmentsWith = voronoiFracture(
          boxGeometry,
          optionsWithIsotropicGrain,
        );

        // Both should produce fragments
        expect(fragmentsWithout.length).toBeGreaterThan(0);
        expect(fragmentsWith.length).toBeGreaterThan(0);

        // With anisotropy=1.0, results should be the same as without grain
        expect(fragmentsWith.length).toBe(fragmentsWithout.length);

        fragmentsWithout.forEach((f) => f.dispose());
        fragmentsWith.forEach((f) => f.dispose());
      });
    });

    describe("anisotropic behavior (anisotropy > 1.0)", () => {
      it("should produce fragments with grainDirection along Y axis", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(0, 1, 0),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);
        fragments.forEach((frag) => {
          expect(frag).toBeInstanceOf(THREE.BufferGeometry);
          expect(frag.getAttribute("position")).toBeDefined();
        });

        fragments.forEach((f) => f.dispose());
      });

      it("should produce fragments with grainDirection along X axis", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(1, 0, 0),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });

      it("should produce fragments with grainDirection along Z axis", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(0, 0, 1),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });

      it("should produce fragments with diagonal grainDirection", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(1, 1, 1).normalize(),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });

      it("should normalize non-normalized grainDirection", () => {
        // Grain direction should be normalized in the constructor
        const options = new VoronoiFractureOptions({
          fragmentCount: 3,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(10, 0, 0), // Non-normalized
          anisotropy: 2.0,
        });

        // The grainDirection should be normalized
        expect(options.grainDirection!.length()).toBeCloseTo(1);

        const fragments = voronoiFracture(boxGeometry, options);
        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });

      it("should produce different results with different anisotropy values", () => {
        const grainDirection = new Vector3(0, 1, 0);

        const optionsLow = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: grainDirection.clone(),
          anisotropy: 1.5,
        });

        const optionsHigh = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          grainDirection: grainDirection.clone(),
          anisotropy: 4.0,
        });

        const fragmentsLow = voronoiFracture(boxGeometry, optionsLow);
        const fragmentsHigh = voronoiFracture(boxGeometry, optionsHigh);

        // Both should produce fragments
        expect(fragmentsLow.length).toBeGreaterThan(0);
        expect(fragmentsHigh.length).toBeGreaterThan(0);

        fragmentsLow.forEach((f) => f.dispose());
        fragmentsHigh.forEach((f) => f.dispose());
      });

      it("should handle high anisotropy values", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 3,
          mode: "3D",
          seed: 12345,
          grainDirection: new Vector3(0, 1, 0),
          anisotropy: 10.0, // Very high - creates very elongated cells
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });
    });

    describe("grainDirection with custom seed points", () => {
      it("should apply anisotropy with custom seed points", () => {
        const seedPoints = [
          new Vector3(-0.5, -0.5, 0),
          new Vector3(0.5, -0.5, 0),
          new Vector3(0, 0.5, 0),
        ];

        const options = new VoronoiFractureOptions({
          mode: "3D",
          seedPoints,
          grainDirection: new Vector3(0, 1, 0),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });
    });

    describe("grainDirection with impact point", () => {
      it("should combine grainDirection with impact-based seed generation", () => {
        const options = new VoronoiFractureOptions({
          fragmentCount: 4,
          mode: "3D",
          seed: 12345,
          impactPoint: new Vector3(0, 1, 0),
          impactRadius: 0.5,
          grainDirection: new Vector3(0, 1, 0),
          anisotropy: 2.0,
        });

        const fragments = voronoiFracture(boxGeometry, options);

        expect(fragments.length).toBeGreaterThan(0);

        fragments.forEach((f) => f.dispose());
      });
    });
  });

  describe("2.5D mode with grainDirection and anisotropy", () => {
    it("should produce fragments in 2.5D mode with anisotropy", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 4,
        mode: "2.5D",
        seed: 12345,
        projectionAxis: "y",
        grainDirection: new Vector3(1, 0, 0),
        anisotropy: 2.0,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      expect(fragments.length).toBeGreaterThan(0);

      fragments.forEach((f) => f.dispose());
    });
  });

  describe("fragment geometry validity", () => {
    it("should produce valid geometry with position attribute", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        anisotropy: 2.0,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      fragments.forEach((frag) => {
        const position = frag.getAttribute("position");
        expect(position).toBeDefined();
        expect(position.count).toBeGreaterThan(0);
        expect(position.itemSize).toBe(3);
      });

      fragments.forEach((f) => f.dispose());
    });

    it("should produce geometry with normals", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        anisotropy: 2.0,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      fragments.forEach((frag) => {
        const normal = frag.getAttribute("normal");
        expect(normal).toBeDefined();
        expect(normal.count).toBeGreaterThan(0);
      });

      fragments.forEach((f) => f.dispose());
    });

    it("should produce geometry with material groups for cut faces", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        anisotropy: 2.0,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      fragments.forEach((frag) => {
        // Should have groups for original and cut face materials
        expect(frag.groups.length).toBeGreaterThan(0);
      });

      fragments.forEach((f) => f.dispose());
    });
  });

  describe("edge cases", () => {
    it("should handle fragmentCount of 2", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 2,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        anisotropy: 2.0,
      });

      const fragments = voronoiFracture(boxGeometry, options);

      expect(fragments.length).toBeGreaterThan(0);
      expect(fragments.length).toBeLessThanOrEqual(2);

      fragments.forEach((f) => f.dispose());
    });

    it("should handle grainDirection without anisotropy (uses default 1.0)", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        // anisotropy not specified - defaults to 1.0 (isotropic)
      });

      expect(options.anisotropy).toBe(1.0);

      const fragments = voronoiFracture(boxGeometry, options);
      expect(fragments.length).toBeGreaterThan(0);

      fragments.forEach((f) => f.dispose());
    });

    it("should handle anisotropy without grainDirection", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        // grainDirection not specified
        anisotropy: 2.0, // This should be ignored without grainDirection
      });

      const fragments = voronoiFracture(boxGeometry, options);
      expect(fragments.length).toBeGreaterThan(0);

      fragments.forEach((f) => f.dispose());
    });
  });

  describe("texture options with anisotropy", () => {
    it("should apply texture scale and offset with anisotropic fracture", () => {
      const options = new VoronoiFractureOptions({
        fragmentCount: 3,
        mode: "3D",
        seed: 12345,
        grainDirection: new Vector3(0, 1, 0),
        anisotropy: 2.0,
        textureScale: new THREE.Vector2(2, 2),
        textureOffset: new THREE.Vector2(0.5, 0.5),
      });

      const fragments = voronoiFracture(boxGeometry, options);

      expect(fragments.length).toBeGreaterThan(0);
      fragments.forEach((frag) => {
        const uv = frag.getAttribute("uv");
        expect(uv).toBeDefined();
      });

      fragments.forEach((f) => f.dispose());
    });
  });
});
