import { Vector2, Vector3 } from "three";

/**
 * Voronoi-specific fracture options
 */
export interface VoronoiOptions {
  /**
   * Voronoi fracture mode
   * - '3D': Full 3D Voronoi tessellation (more realistic, slower)
   * - '2.5D': 2D Voronoi pattern projected through mesh (faster, good for flat objects)
   */
  mode: "3D" | "2.5D";

  /**
   * Custom seed points for Voronoi cells. If not provided, seeds will be generated automatically.
   */
  seedPoints?: Vector3[];

  /**
   * Impact point for fracture in local space. When provided, generates more fragments near this location.
   */
  impactPoint?: Vector3;

  /**
   * Radius around impact point where fragment density is highest.
   * Only used when impactPoint is specified.
   */
  impactRadius?: number;

  /**
   * For 2.5D mode: the axis along which to project the 2D Voronoi pattern
   * 'auto' will choose based on mesh dimensions
   */
  projectionAxis?: "x" | "y" | "z" | "auto";

  /**
   * For 2.5D mode with impact: optional normal vector of the collision surface
   * If provided, determines the projection plane perpendicular to this normal
   * This overrides projectionAxis when both are specified
   */
  projectionNormal?: Vector3;

  /**
   * Use K-nearest neighbor approximation for performance optimization.
   * When true, only the nearest neighbors are considered for each Voronoi cell.
   *
   * WARNING: Enabling this may cause fragments to overlap!
   * - false (default): Accurate, no overlaps, but slower O(n²)
   * - true: Faster, but may cause overlapping fragments
   *
   * Recommended: Keep false for <30 seeds, enable for >50 seeds if performance is critical
   */
  useApproximation?: boolean;

  /**
   * Number of nearest neighbors to consider when useApproximation is enabled.
   * Higher values are more accurate but slower. Ignored if useApproximation is false.
   * Default: 12
   */
  approximationNeighborCount?: number;
}

/**
 * Options for the fracture operation
 */
export class FractureOptions {
  /**
   * Fracture method to use
   * - 'voronoi': Natural-looking fracture using Voronoi tessellation (requires voronoiOptions)
   * - 'simple': Simple plane-based fracturing (fast, lower quality)
   */
  public fractureMethod: "voronoi" | "simple" = "voronoi";

  /**
   * Number of fragments to generate
   */
  public fragmentCount: number = 50;

  /**
   * Voronoi-specific options (required when fractureMethod is 'voronoi')
   */
  public voronoiOptions?: VoronoiOptions;

  /**
   * Simple fracture: specify which planes to fracture in
   * Only used when fractureMethod is 'simple'
   */
  public fracturePlanes: {
    x: boolean;
    y: boolean;
    z: boolean;
  } = { x: true, y: true, z: true };

  /**
   * Scale factor to apply to texture coordinates on cut faces
   */
  public textureScale: Vector2 = new Vector2(1, 1);

  /**
   * Offset to apply to texture coordinates on cut faces
   */
  public textureOffset: Vector2 = new Vector2();

  /**
   * Seed value for random number generation. If not specified, a random seed will be generated.
   * Using the same seed will produce the same fracture pattern for reproducibility.
   */
  public seed?: number;

  /**
   * Refracture settings - allows fragments to be fractured multiple times
   */
  public refracture: {
    /**
     * Enable or disable refracturing functionality
     */
    enabled: boolean;
    /**
     * Maximum number of additional refractures after the initial fracture
     * (e.g., maxRefractures=1 means initial fracture + 1 refracture = 2 total fracture events)
     */
    maxRefractures: number;
    /**
     * Number of fragments to generate when refracturing
     */
    fragmentCount: number;
  } = {
    enabled: false,
    maxRefractures: 2,
    fragmentCount: 4,
  };

  constructor({
    fractureMethod,
    fragmentCount,
    voronoiOptions,
    fracturePlanes,
    textureScale,
    textureOffset,
    seed,
    refracture,
  }: {
    fractureMethod?: "voronoi" | "simple";
    fragmentCount?: number;
    voronoiOptions?: VoronoiOptions;
    fracturePlanes?: {
      x: boolean;
      y: boolean;
      z: boolean;
    };
    textureScale?: Vector2;
    textureOffset?: Vector2;
    seed?: number;
    refracture?: {
      enabled?: boolean;
      maxRefractures?: number;
      fragmentCount?: number;
    };
  } = {}) {
    if (fractureMethod !== undefined) {
      this.fractureMethod = fractureMethod;
    }

    if (fragmentCount !== undefined) {
      this.fragmentCount = fragmentCount;
    }

    if (voronoiOptions !== undefined) {
      this.voronoiOptions = voronoiOptions;
    }

    if (fracturePlanes !== undefined) {
      this.fracturePlanes = fracturePlanes;
    }

    if (textureScale !== undefined) {
      this.textureScale = textureScale;
    }

    if (textureOffset !== undefined) {
      this.textureOffset = textureOffset;
    }

    if (seed !== undefined) {
      this.seed = seed;
    }

    if (refracture !== undefined) {
      if (refracture.enabled !== undefined) {
        this.refracture.enabled = refracture.enabled;
      }
      if (refracture.maxRefractures !== undefined) {
        this.refracture.maxRefractures = refracture.maxRefractures;
      }
      if (refracture.fragmentCount !== undefined) {
        this.refracture.fragmentCount = refracture.fragmentCount;
      }
    }

    // Validate that voronoiOptions is provided when fractureMethod is 'voronoi'
    if (this.fractureMethod === "voronoi" && !this.voronoiOptions) {
      // Provide default voronoi options
      this.voronoiOptions = {
        mode: "3D",
      };
    }
  }
}
