import { Vector2, Vector3 } from "three";

/**
 * Options for Voronoi fracture operation
 */
export class VoronoiFractureOptions {
  /**
   * Number of Voronoi cells (fragments) to generate
   */
  public fragmentCount: number = 50;

  /**
   * Voronoi fracture mode
   * - '3D': Full 3D Voronoi tessellation (more realistic, slower)
   * - '2.5D': 2D Voronoi pattern projected through mesh (faster, good for flat objects)
   */
  public mode: "3D" | "2.5D" = "3D";

  /**
   * Custom seed points for Voronoi cells. If not provided, seeds will be generated automatically.
   */
  public seedPoints?: Vector3[];

  /**
   * Impact point for fracture. When provided, generates more fragments near this location.
   */
  public impactPoint?: Vector3;

  /**
   * Radius around impact point where fragment density is highest.
   * Only used when impactPoint is specified.
   */
  public impactRadius?: number;

  /**
   * For 2.5D mode: the axis along which to project the 2D Voronoi pattern
   * 'auto' will choose based on mesh dimensions
   */
  public projectionAxis?: "x" | "y" | "z" | "auto" = "auto";

  /**
   * For 2.5D mode with impact: optional normal vector of the collision surface
   * If provided, determines the projection plane perpendicular to this normal
   * This overrides projectionAxis when both are specified
   */
  public projectionNormal?: Vector3;

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
  public useApproximation: boolean = false;

  /**
   * Number of nearest neighbors to consider when useApproximation is enabled.
   * Higher values are more accurate but slower. Ignored if useApproximation is false.
   * Default: 12
   */
  public approximationNeighborCount: number = 12;

  /**
   * Fracturing mode. If set to convex, a faster algorithm will be used under
   * the assumption that the geometry being fractured is convex.
   */
  public fractureMode: "Convex" | "Non-Convex" = "Non-Convex";

  /**
   * Enables detection of isolated fragments within each Voronoi cell.
   * When enabled for non-convex meshes, each Voronoi cell is analyzed to detect
   * disconnected pieces and split them into separate fragments.
   * This setting has no effect for convex meshes and should be disabled for performance.
   */
  public detectIsolatedFragments: boolean = false;

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
   * Remove degenerate edge constraints (edges where both vertices are the same after welding).
   * When enabled, degenerate edges are filtered out while preserving edge graph connectivity.
   * This can help prevent triangulation issues caused by zero-length constraints.
   * Default: false
   */
  public removeDegenerateEdges: boolean = false;

  /**
   * Callback function to receive invalid vertices found during triangulation.
   * This is useful for debugging and visualization of vertices that fall outside the expected geometry.
   */
  public onInvalidVertex?: (data: {
    index: number;
    position: Vector3;
    location: string;
    distFromAxis: number;
    torusDistance: number;
    planeNormal: Vector3;
  }) => void;

  constructor({
    fragmentCount,
    mode,
    seedPoints,
    impactPoint,
    impactRadius,
    projectionAxis,
    projectionNormal,
    useApproximation,
    approximationNeighborCount,
    fractureMode,
    detectIsolatedFragments,
    textureScale,
    textureOffset,
    seed,
    removeDegenerateEdges,
    onInvalidVertex,
  }: {
    fragmentCount?: number;
    mode?: "3D" | "2.5D";
    seedPoints?: Vector3[];
    impactPoint?: Vector3;
    impactRadius?: number;
    projectionAxis?: "x" | "y" | "z" | "auto";
    projectionNormal?: Vector3;
    useApproximation?: boolean;
    approximationNeighborCount?: number;
    fractureMode?: "Convex" | "Non-Convex";
    detectIsolatedFragments?: boolean;
    textureScale?: Vector2;
    textureOffset?: Vector2;
    seed?: number;
    removeDegenerateEdges?: boolean;
    onInvalidVertex?: (data: {
      index: number;
      position: Vector3;
      location: string;
      distFromAxis: number;
      torusDistance: number;
      planeNormal: Vector3;
    }) => void;
  } = {}) {
    if (fragmentCount !== undefined) {
      this.fragmentCount = fragmentCount;
    }

    if (mode !== undefined) {
      this.mode = mode;
    }

    if (seedPoints !== undefined) {
      this.seedPoints = seedPoints;
    }

    if (impactPoint !== undefined) {
      this.impactPoint = impactPoint;
    }

    if (impactRadius !== undefined) {
      this.impactRadius = impactRadius;
    }

    if (projectionAxis !== undefined) {
      this.projectionAxis = projectionAxis;
    }

    if (projectionNormal !== undefined) {
      this.projectionNormal = projectionNormal;
    }

    if (useApproximation !== undefined) {
      this.useApproximation = useApproximation;
    }

    if (approximationNeighborCount !== undefined) {
      this.approximationNeighborCount = approximationNeighborCount;
    }

    if (fractureMode !== undefined) {
      this.fractureMode = fractureMode;
    }

    if (detectIsolatedFragments !== undefined) {
      this.detectIsolatedFragments = detectIsolatedFragments;
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

    if (removeDegenerateEdges !== undefined) {
      this.removeDegenerateEdges = removeDegenerateEdges;
    }

    if (onInvalidVertex !== undefined) {
      this.onInvalidVertex = onInvalidVertex;
    }
  }
}
