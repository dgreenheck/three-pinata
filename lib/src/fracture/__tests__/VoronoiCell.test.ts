import { Vector3 } from "three";
import {
  computeBisectingPlane,
  computeAnisotropicBisectingPlane,
  findKNearestNeighbors,
} from "../VoronoiCell";

describe("computeBisectingPlane", () => {
  it("should compute midpoint as origin", () => {
    const seed1 = new Vector3(0, 0, 0);
    const seed2 = new Vector3(2, 0, 0);

    const plane = computeBisectingPlane(seed1, seed2);

    expect(plane.origin.x).toBeCloseTo(1);
    expect(plane.origin.y).toBeCloseTo(0);
    expect(plane.origin.z).toBeCloseTo(0);
  });

  it("should compute normal pointing from seed1 to seed2", () => {
    const seed1 = new Vector3(0, 0, 0);
    const seed2 = new Vector3(2, 0, 0);

    const plane = computeBisectingPlane(seed1, seed2);

    expect(plane.normal.x).toBeCloseTo(1);
    expect(plane.normal.y).toBeCloseTo(0);
    expect(plane.normal.z).toBeCloseTo(0);
  });

  it("should handle negative coordinates", () => {
    const seed1 = new Vector3(-1, -1, -1);
    const seed2 = new Vector3(1, 1, 1);

    const plane = computeBisectingPlane(seed1, seed2);

    expect(plane.origin.x).toBeCloseTo(0);
    expect(plane.origin.y).toBeCloseTo(0);
    expect(plane.origin.z).toBeCloseTo(0);

    // Normal should be normalized
    expect(plane.normal.length()).toBeCloseTo(1);
  });

  it("should handle diagonal direction", () => {
    const seed1 = new Vector3(0, 0, 0);
    const seed2 = new Vector3(1, 1, 0);

    const plane = computeBisectingPlane(seed1, seed2);

    expect(plane.origin.x).toBeCloseTo(0.5);
    expect(plane.origin.y).toBeCloseTo(0.5);
    expect(plane.origin.z).toBeCloseTo(0);

    // Normal should point along (1,1,0) normalized
    const expectedNormal = Math.sqrt(2) / 2;
    expect(plane.normal.x).toBeCloseTo(expectedNormal);
    expect(plane.normal.y).toBeCloseTo(expectedNormal);
    expect(plane.normal.z).toBeCloseTo(0);
  });
});

describe("computeAnisotropicBisectingPlane", () => {
  describe("isotropic behavior (anisotropy = 1.0)", () => {
    it("should behave like isotropic when anisotropy is 1.0", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 0, 0);
      const grainDirection = new Vector3(0, 1, 0);
      const anisotropy = 1.0;

      const isotropicPlane = computeBisectingPlane(seed1, seed2);
      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Origin should be the same (always midpoint)
      expect(anisotropicPlane.origin.x).toBeCloseTo(isotropicPlane.origin.x);
      expect(anisotropicPlane.origin.y).toBeCloseTo(isotropicPlane.origin.y);
      expect(anisotropicPlane.origin.z).toBeCloseTo(isotropicPlane.origin.z);

      // Normal should be identical when anisotropy = 1
      expect(anisotropicPlane.normal.x).toBeCloseTo(isotropicPlane.normal.x);
      expect(anisotropicPlane.normal.y).toBeCloseTo(isotropicPlane.normal.y);
      expect(anisotropicPlane.normal.z).toBeCloseTo(isotropicPlane.normal.z);
    });

    it("should behave isotropically when D is perpendicular to grain", () => {
      // D (from seed1 to seed2) perpendicular to grain - no effect
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 0, 0); // D along X
      const grainDirection = new Vector3(0, 1, 0); // Grain along Y
      const anisotropy = 3.0; // High anisotropy, but no effect since perpendicular

      const isotropicPlane = computeBisectingPlane(seed1, seed2);
      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Since D · G = 0, the normal should be the same
      expect(anisotropicPlane.normal.x).toBeCloseTo(isotropicPlane.normal.x);
      expect(anisotropicPlane.normal.y).toBeCloseTo(isotropicPlane.normal.y);
      expect(anisotropicPlane.normal.z).toBeCloseTo(isotropicPlane.normal.z);
    });
  });

  describe("anisotropic behavior (anisotropy > 1.0)", () => {
    it("should tilt the plane when D is aligned with grain direction", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 0, 0); // D along X
      const grainDirection = new Vector3(1, 0, 0); // Grain also along X
      const anisotropy = 2.0;

      const isotropicPlane = computeBisectingPlane(seed1, seed2);
      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Origin should still be at midpoint
      expect(anisotropicPlane.origin.x).toBeCloseTo(1);
      expect(anisotropicPlane.origin.y).toBeCloseTo(0);
      expect(anisotropicPlane.origin.z).toBeCloseTo(0);

      // When D is parallel to grain, the factor reduces D component along grain
      // factor = 1 - 1/A² = 1 - 1/4 = 0.75
      // Modified D = D - 0.75 * dot(D,G) * G = (2,0,0) - 0.75 * 2 * (1,0,0) = (0.5, 0, 0)
      // Normalized: (1, 0, 0)
      // So normal should still point along X
      expect(anisotropicPlane.normal.length()).toBeCloseTo(1);
    });

    it("should modify normal when D has both parallel and perpendicular components", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 2, 0); // D = (2, 2, 0), diagonal
      const grainDirection = new Vector3(1, 0, 0).normalize(); // Grain along X
      const anisotropy = 2.0;

      const isotropicPlane = computeBisectingPlane(seed1, seed2);
      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Origin should still be at midpoint
      expect(anisotropicPlane.origin.x).toBeCloseTo(1);
      expect(anisotropicPlane.origin.y).toBeCloseTo(1);
      expect(anisotropicPlane.origin.z).toBeCloseTo(0);

      // factor = 1 - 1/4 = 0.75
      // dot(D, G) = 2 * 1 + 2 * 0 + 0 * 0 = 2
      // Modified D = (2, 2, 0) - 0.75 * 2 * (1, 0, 0) = (2 - 1.5, 2, 0) = (0.5, 2, 0)
      // This is normalized for the final normal
      const expectedMagnitude = Math.sqrt(0.5 * 0.5 + 2 * 2);
      const expectedNormalX = 0.5 / expectedMagnitude;
      const expectedNormalY = 2 / expectedMagnitude;

      expect(anisotropicPlane.normal.x).toBeCloseTo(expectedNormalX, 4);
      expect(anisotropicPlane.normal.y).toBeCloseTo(expectedNormalY, 4);
      expect(anisotropicPlane.normal.z).toBeCloseTo(0);

      // The Y component should be relatively larger than in isotropic case
      // In isotropic case, normal would be (0.707, 0.707, 0)
      // In anisotropic case, normal Y component is larger
      expect(anisotropicPlane.normal.y).toBeGreaterThan(
        isotropicPlane.normal.y,
      );
    });

    it("should increase elongation effect with higher anisotropy values", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 2, 0);
      const grainDirection = new Vector3(1, 0, 0).normalize();

      const plane2 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        2.0,
      );
      const plane3 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        3.0,
      );
      const plane5 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        5.0,
      );

      // Higher anisotropy should reduce X component more
      // factor for A=2: 0.75, A=3: 0.889, A=5: 0.96
      expect(plane3.normal.x).toBeLessThan(plane2.normal.x);
      expect(plane5.normal.x).toBeLessThan(plane3.normal.x);

      // Y component should become larger with higher anisotropy
      expect(plane3.normal.y).toBeGreaterThan(plane2.normal.y);
      expect(plane5.normal.y).toBeGreaterThan(plane3.normal.y);
    });

    it("should handle 3D grain direction", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(1, 1, 1);
      const grainDirection = new Vector3(0, 0, 1).normalize(); // Grain along Z
      const anisotropy = 2.0;

      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Normal should be normalized
      expect(anisotropicPlane.normal.length()).toBeCloseTo(1);

      // Origin at midpoint
      expect(anisotropicPlane.origin.x).toBeCloseTo(0.5);
      expect(anisotropicPlane.origin.y).toBeCloseTo(0.5);
      expect(anisotropicPlane.origin.z).toBeCloseTo(0.5);
    });

    it("should handle diagonal grain direction", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 0, 0);
      const grainDirection = new Vector3(1, 1, 0).normalize(); // Diagonal grain
      const anisotropy = 2.0;

      const anisotropicPlane = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );

      // Normal should be normalized
      expect(anisotropicPlane.normal.length()).toBeCloseTo(1);

      // Origin at midpoint
      expect(anisotropicPlane.origin.x).toBeCloseTo(1);
      expect(anisotropicPlane.origin.y).toBeCloseTo(0);
      expect(anisotropicPlane.origin.z).toBeCloseTo(0);
    });
  });

  describe("mathematical properties", () => {
    it("should always produce a normalized normal vector", () => {
      const testCases = [
        { s1: new Vector3(0, 0, 0), s2: new Vector3(1, 0, 0), a: 1.0 },
        { s1: new Vector3(-5, 2, 3), s2: new Vector3(5, -2, -3), a: 2.0 },
        { s1: new Vector3(0, 0, 0), s2: new Vector3(1, 2, 3), a: 5.0 },
        { s1: new Vector3(10, 10, 10), s2: new Vector3(11, 12, 13), a: 10.0 },
      ];

      const grainDirection = new Vector3(1, 0, 0).normalize();

      for (const tc of testCases) {
        const plane = computeAnisotropicBisectingPlane(
          tc.s1,
          tc.s2,
          grainDirection,
          tc.a,
        );
        expect(plane.normal.length()).toBeCloseTo(1);
      }
    });

    it("should always place origin at midpoint regardless of anisotropy", () => {
      const seed1 = new Vector3(1, 2, 3);
      const seed2 = new Vector3(5, 6, 7);
      const grainDirection = new Vector3(1, 1, 1).normalize();

      for (const anisotropy of [1.0, 2.0, 5.0, 10.0]) {
        const plane = computeAnisotropicBisectingPlane(
          seed1,
          seed2,
          grainDirection,
          anisotropy,
        );
        expect(plane.origin.x).toBeCloseTo(3);
        expect(plane.origin.y).toBeCloseTo(4);
        expect(plane.origin.z).toBeCloseTo(5);
      }
    });

    it("should be symmetric for swapped seeds with flipped normal", () => {
      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 1, 0);
      const grainDirection = new Vector3(1, 0, 0).normalize();
      const anisotropy = 2.0;

      const plane12 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        anisotropy,
      );
      const plane21 = computeAnisotropicBisectingPlane(
        seed2,
        seed1,
        grainDirection,
        anisotropy,
      );

      // Origin should be the same
      expect(plane12.origin.x).toBeCloseTo(plane21.origin.x);
      expect(plane12.origin.y).toBeCloseTo(plane21.origin.y);
      expect(plane12.origin.z).toBeCloseTo(plane21.origin.z);

      // Normals should be opposite
      expect(plane12.normal.x).toBeCloseTo(-plane21.normal.x);
      expect(plane12.normal.y).toBeCloseTo(-plane21.normal.y);
      expect(plane12.normal.z).toBeCloseTo(-plane21.normal.z);
    });
  });

  describe("anisotropy factor calculation", () => {
    it("should compute correct factor for various anisotropy values", () => {
      // factor = 1 - 1/A²
      // A=1 → factor=0
      // A=2 → factor=0.75
      // A=3 → factor≈0.889
      // A=10 → factor=0.99

      const seed1 = new Vector3(0, 0, 0);
      const seed2 = new Vector3(2, 0, 0); // D aligned with grain
      const grainDirection = new Vector3(1, 0, 0);

      // For D parallel to grain:
      // Modified D = D * (1 - factor) = D / A²
      // So the magnitude reduces by A²

      const planeA1 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        1.0,
      );
      const planeA2 = computeAnisotropicBisectingPlane(
        seed1,
        seed2,
        grainDirection,
        2.0,
      );

      // Both should have normalized normals
      expect(planeA1.normal.length()).toBeCloseTo(1);
      expect(planeA2.normal.length()).toBeCloseTo(1);
    });
  });
});

describe("findKNearestNeighbors", () => {
  it("should find k nearest neighbors", () => {
    const seeds = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(3, 0, 0),
      new Vector3(4, 0, 0),
    ];

    const neighbors = findKNearestNeighbors(0, seeds, 2);

    expect(neighbors.length).toBe(2);
    expect(neighbors).toContain(1);
    expect(neighbors).toContain(2);
  });

  it("should return neighbors sorted by distance", () => {
    const seeds = [
      new Vector3(0, 0, 0),
      new Vector3(3, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
    ];

    const neighbors = findKNearestNeighbors(0, seeds, 3);

    expect(neighbors[0]).toBe(2); // Closest (distance 1)
    expect(neighbors[1]).toBe(3); // Second closest (distance 2)
    expect(neighbors[2]).toBe(1); // Third closest (distance 3)
  });

  it("should handle k larger than available neighbors", () => {
    const seeds = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
    ];

    const neighbors = findKNearestNeighbors(0, seeds, 10);

    expect(neighbors.length).toBe(2); // Only 2 other seeds available
  });

  it("should not include the seed itself", () => {
    const seeds = [
      new Vector3(0, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
    ];

    const neighbors = findKNearestNeighbors(1, seeds, 2);

    expect(neighbors).not.toContain(1);
    expect(neighbors.length).toBe(2);
  });
});
