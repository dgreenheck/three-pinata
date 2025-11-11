import { Vector2, Vector3 } from "three";
import { VoronoiFractureOptions } from "../VoronoiFractureOptions";

describe("VoronoiFractureOptions", () => {
  describe("Constructor - Default Values", () => {
    it("should initialize with default values when no arguments provided", () => {
      const options = new VoronoiFractureOptions();

      expect(options.fragmentCount).toBe(50);
      expect(options.mode).toBe("3D");
      expect(options.seedPoints).toBeUndefined();
      expect(options.impactPoint).toBeUndefined();
      expect(options.impactRadius).toBeUndefined();
      expect(options.projectionAxis).toBe("auto");
      expect(options.projectionNormal).toBeUndefined();
      expect(options.useApproximation).toBe(false);
      expect(options.approximationNeighborCount).toBe(12);
      expect(options.textureScale).toEqual(new Vector2(1, 1));
      expect(options.textureOffset).toEqual(new Vector2(0, 0));
      expect(options.seed).toBeUndefined();
    });
  });

  describe("Constructor - Custom Values", () => {
    it("should set fragmentCount when provided", () => {
      const options = new VoronoiFractureOptions({ fragmentCount: 10 });

      expect(options.fragmentCount).toBe(10);
    });

    it("should set mode to 3D when provided", () => {
      const options = new VoronoiFractureOptions({ mode: "3D" });

      expect(options.mode).toBe("3D");
    });

    it("should set mode to 2.5D when provided", () => {
      const options = new VoronoiFractureOptions({ mode: "2.5D" });

      expect(options.mode).toBe("2.5D");
    });

    it("should set seedPoints when provided", () => {
      const seedPoints = [
        new Vector3(0, 0, 0),
        new Vector3(1, 1, 1),
        new Vector3(2, 2, 2),
      ];
      const options = new VoronoiFractureOptions({ seedPoints });

      expect(options.seedPoints).toBe(seedPoints);
      expect(options.seedPoints?.length).toBe(3);
    });

    it("should set impactPoint when provided", () => {
      const impactPoint = new Vector3(5, 5, 5);
      const options = new VoronoiFractureOptions({ impactPoint });

      expect(options.impactPoint).toBe(impactPoint);
    });

    it("should set impactRadius when provided", () => {
      const options = new VoronoiFractureOptions({ impactRadius: 2.5 });

      expect(options.impactRadius).toBe(2.5);
    });

    it("should set projectionAxis to x when provided", () => {
      const options = new VoronoiFractureOptions({ projectionAxis: "x" });

      expect(options.projectionAxis).toBe("x");
    });

    it("should set projectionAxis to y when provided", () => {
      const options = new VoronoiFractureOptions({ projectionAxis: "y" });

      expect(options.projectionAxis).toBe("y");
    });

    it("should set projectionAxis to z when provided", () => {
      const options = new VoronoiFractureOptions({ projectionAxis: "z" });

      expect(options.projectionAxis).toBe("z");
    });

    it("should set projectionAxis to auto when provided", () => {
      const options = new VoronoiFractureOptions({ projectionAxis: "auto" });

      expect(options.projectionAxis).toBe("auto");
    });

    it("should set projectionNormal when provided", () => {
      const projectionNormal = new Vector3(0, 1, 0);
      const options = new VoronoiFractureOptions({ projectionNormal });

      expect(options.projectionNormal).toBe(projectionNormal);
    });

    it("should set useApproximation to true when provided", () => {
      const options = new VoronoiFractureOptions({ useApproximation: true });

      expect(options.useApproximation).toBe(true);
    });

    it("should set useApproximation to false when provided", () => {
      const options = new VoronoiFractureOptions({ useApproximation: false });

      expect(options.useApproximation).toBe(false);
    });

    it("should set approximationNeighborCount when provided", () => {
      const options = new VoronoiFractureOptions({
        approximationNeighborCount: 20,
      });

      expect(options.approximationNeighborCount).toBe(20);
    });

    it("should set textureScale when provided", () => {
      const textureScale = new Vector2(2, 3);
      const options = new VoronoiFractureOptions({ textureScale });

      expect(options.textureScale).toBe(textureScale);
    });

    it("should set textureOffset when provided", () => {
      const textureOffset = new Vector2(0.5, 0.25);
      const options = new VoronoiFractureOptions({ textureOffset });

      expect(options.textureOffset).toBe(textureOffset);
    });

    it("should set seed when provided", () => {
      const options = new VoronoiFractureOptions({ seed: 12345 });

      expect(options.seed).toBe(12345);
    });

    it("should set all values when all provided", () => {
      const seedPoints = [new Vector3(0, 0, 0)];
      const impactPoint = new Vector3(1, 1, 1);
      const projectionNormal = new Vector3(0, 1, 0);
      const textureScale = new Vector2(2, 2);
      const textureOffset = new Vector2(0.5, 0.5);

      const options = new VoronoiFractureOptions({
        fragmentCount: 25,
        mode: "2.5D",
        seedPoints,
        impactPoint,
        impactRadius: 3.5,
        projectionAxis: "y",
        projectionNormal,
        useApproximation: true,
        approximationNeighborCount: 15,
        textureScale,
        textureOffset,
        seed: 99999,
      });

      expect(options.fragmentCount).toBe(25);
      expect(options.mode).toBe("2.5D");
      expect(options.seedPoints).toBe(seedPoints);
      expect(options.impactPoint).toBe(impactPoint);
      expect(options.impactRadius).toBe(3.5);
      expect(options.projectionAxis).toBe("y");
      expect(options.projectionNormal).toBe(projectionNormal);
      expect(options.useApproximation).toBe(true);
      expect(options.approximationNeighborCount).toBe(15);
      expect(options.textureScale).toBe(textureScale);
      expect(options.textureOffset).toBe(textureOffset);
      expect(options.seed).toBe(99999);
    });
  });
});
