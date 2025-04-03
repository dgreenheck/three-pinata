// This file contains all library functionality that is not dependent on THREE.js

// Export main functionality
export { fractureRawData, fractureFragment } from "./fracture/FractureFragment";
export { sliceRawData, sliceFragment } from "./fracture/SliceFragment";

// Export entity types
export { Fragment, SlicedMeshSubmesh } from "./entities/Fragment";
export { FractureOptions } from "./entities/FractureOptions";
export { SliceOptions } from "./entities/SliceOptions";
export { default as MeshVertex } from "./entities/MeshVertex";
export { default as EdgeConstraint } from "./entities/EdgeConstraint";
export { default as Quad } from "./entities/Quad";
export { default as TriangulationPoint } from "./entities/TriangulationPoint";

// Export triangulators
export { Triangulator } from "./triangulators/Triangulator";
export { ConstrainedTriangulator } from "./triangulators/ConstrainedTriangulator";

// Export utility classes
export { Vector2 } from "./utils/Vector2";
export { Vector3 } from "./utils/Vector3";
export { Box3 } from "./utils/Box3";
export { UnionFind } from "./utils/UnionFind";

export {
  isPointAbovePlane,
  linePlaneIntersection,
  hash3,
} from "./utils/MathUtils";
