import { Vector2 } from "three";
import { FractureOptions } from "../FractureOptions";

describe("FractureOptions", () => {
  describe("Constructor - Default Values", () => {
    it("should initialize with default values when no arguments provided", () => {
      const options = new FractureOptions();

      expect(options.fractureMethod).toBe("voronoi");
      expect(options.fragmentCount).toBe(50);
      expect(options.voronoiOptions).toBeDefined();
      expect(options.voronoiOptions?.mode).toBe("3D");
      expect(options.fracturePlanes).toEqual({ x: true, y: true, z: true });
      expect(options.textureScale).toEqual(new Vector2(1, 1));
      expect(options.textureOffset).toEqual(new Vector2(0, 0));
      expect(options.seed).toBeUndefined();
      expect(options.refracture.enabled).toBe(false);
      expect(options.refracture.maxRefractures).toBe(2);
      expect(options.refracture.fragmentCount).toBe(4);
    });
  });

  describe("Constructor - Custom Values", () => {
    it("should set fractureMethod to voronoi when provided", () => {
      const options = new FractureOptions({ fractureMethod: "voronoi" });

      expect(options.fractureMethod).toBe("voronoi");
    });

    it("should set fractureMethod to simple when provided", () => {
      const options = new FractureOptions({ fractureMethod: "simple" });

      expect(options.fractureMethod).toBe("simple");
    });

    it("should set fragmentCount when provided", () => {
      const options = new FractureOptions({ fragmentCount: 20 });

      expect(options.fragmentCount).toBe(20);
    });

    it("should set voronoiOptions when provided", () => {
      const voronoiOptions = { mode: "2.5D" as const };
      const options = new FractureOptions({ voronoiOptions });

      expect(options.voronoiOptions).toBe(voronoiOptions);
    });

    it("should set fracturePlanes when provided", () => {
      const fracturePlanes = { x: false, y: true, z: false };
      const options = new FractureOptions({ fracturePlanes });

      expect(options.fracturePlanes).toBe(fracturePlanes);
    });

    it("should set textureScale when provided", () => {
      const textureScale = new Vector2(2, 3);
      const options = new FractureOptions({ textureScale });

      expect(options.textureScale).toBe(textureScale);
    });

    it("should set textureOffset when provided", () => {
      const textureOffset = new Vector2(0.5, 0.25);
      const options = new FractureOptions({ textureOffset });

      expect(options.textureOffset).toBe(textureOffset);
    });

    it("should set seed when provided", () => {
      const options = new FractureOptions({ seed: 54321 });

      expect(options.seed).toBe(54321);
    });

    it("should set refracture.enabled when provided", () => {
      const options = new FractureOptions({
        refracture: { enabled: true },
      });

      expect(options.refracture.enabled).toBe(true);
      expect(options.refracture.maxRefractures).toBe(2); // Default
      expect(options.refracture.fragmentCount).toBe(4); // Default
    });

    it("should set refracture.maxRefractures when provided", () => {
      const options = new FractureOptions({
        refracture: { maxRefractures: 5 },
      });

      expect(options.refracture.enabled).toBe(false); // Default
      expect(options.refracture.maxRefractures).toBe(5);
      expect(options.refracture.fragmentCount).toBe(4); // Default
    });

    it("should set refracture.fragmentCount when provided", () => {
      const options = new FractureOptions({
        refracture: { fragmentCount: 10 },
      });

      expect(options.refracture.enabled).toBe(false); // Default
      expect(options.refracture.maxRefractures).toBe(2); // Default
      expect(options.refracture.fragmentCount).toBe(10);
    });

    it("should set all refracture properties when provided", () => {
      const options = new FractureOptions({
        refracture: {
          enabled: true,
          maxRefractures: 3,
          fragmentCount: 8,
        },
      });

      expect(options.refracture.enabled).toBe(true);
      expect(options.refracture.maxRefractures).toBe(3);
      expect(options.refracture.fragmentCount).toBe(8);
    });

    it("should set all values when all provided", () => {
      const voronoiOptions = { mode: "2.5D" as const };
      const fracturePlanes = { x: true, y: false, z: true };
      const textureScale = new Vector2(3, 3);
      const textureOffset = new Vector2(0.1, 0.2);

      const options = new FractureOptions({
        fractureMethod: "simple",
        fragmentCount: 15,
        voronoiOptions,
        fracturePlanes,
        textureScale,
        textureOffset,
        seed: 11111,
        refracture: {
          enabled: true,
          maxRefractures: 4,
          fragmentCount: 6,
        },
      });

      expect(options.fractureMethod).toBe("simple");
      expect(options.fragmentCount).toBe(15);
      expect(options.voronoiOptions).toBe(voronoiOptions);
      expect(options.fracturePlanes).toBe(fracturePlanes);
      expect(options.textureScale).toBe(textureScale);
      expect(options.textureOffset).toBe(textureOffset);
      expect(options.seed).toBe(11111);
      expect(options.refracture.enabled).toBe(true);
      expect(options.refracture.maxRefractures).toBe(4);
      expect(options.refracture.fragmentCount).toBe(6);
    });
  });

  describe("Voronoi Options Validation", () => {
    it("should provide default voronoiOptions when fractureMethod is voronoi and none provided", () => {
      const options = new FractureOptions({
        fractureMethod: "voronoi",
      });

      expect(options.voronoiOptions).toBeDefined();
      expect(options.voronoiOptions?.mode).toBe("3D");
    });

    it("should not override provided voronoiOptions", () => {
      const voronoiOptions = { mode: "2.5D" as const };
      const options = new FractureOptions({
        fractureMethod: "voronoi",
        voronoiOptions,
      });

      expect(options.voronoiOptions).toBe(voronoiOptions);
      expect(options.voronoiOptions?.mode).toBe("2.5D");
    });

    it("should provide default voronoiOptions when using default constructor", () => {
      const options = new FractureOptions();

      expect(options.fractureMethod).toBe("voronoi");
      expect(options.voronoiOptions).toBeDefined();
      expect(options.voronoiOptions?.mode).toBe("3D");
    });
  });
});
