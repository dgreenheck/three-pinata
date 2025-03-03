import * as THREE from "three";
import { Vector2 } from "./utils/Vector2";
import { Vector3 } from "./utils/Vector3";
import { Fragment, SlicedMeshSubmesh } from "./entities/Fragment";
import {
  geometryToFragment,
  fragmentToGeometry,
} from "./utils/GeometryConversion";
import { isPointAbovePlane, linePlaneIntersection } from "./utils/MathUtils";
import MeshVertex from "./entities/MeshVertex";
import EdgeConstraint from "./entities/EdgeConstraint";
import { Triangulator } from "./triangulators/Triangulator";
import { ConstrainedTriangulator } from "./triangulators/ConstrainedTriangulator";

/**
 * Slices the mesh by the plane specified by `sliceNormal` and `sliceOrigin`
 * @param geometry The geometry to slice
 * @param sliceNormal The normal of the slice plane (points towards the top slice)
 * @param sliceOrigin The origin of the slice plane
 * @param textureScale Scale factor to apply to UV coordinates
 * @param textureOffset Offset to apply to UV coordinates
 * @param convex Set to true if geometry is convex
 * @returns An object containing the geometries above and below the slice plane
 */
export function slice(
  geometry: THREE.BufferGeometry,
  sliceNormal: Vector3,
  sliceOrigin: Vector3,
  textureScale: Vector2,
  textureOffset: Vector2,
  convex: boolean,
): { topSlice: THREE.BufferGeometry; bottomSlice: THREE.BufferGeometry } {
  // Convert THREE.BufferGeometry to our internal Fragment representation
  const fragment = geometryToFragment(geometry);

  // Perform the slice operation using our existing code
  const { topSlice, bottomSlice } = sliceFragment(
    fragment,
    sliceNormal,
    sliceOrigin,
    textureScale,
    textureOffset,
    convex,
  );

  // Convert the fragments back to THREE.BufferGeometry
  return {
    topSlice: fragmentToGeometry(topSlice),
    bottomSlice: fragmentToGeometry(bottomSlice),
  };
}

/**
 * Slices the mesh by the plane specified by `sliceNormal` and `sliceOrigin`
    /// The sliced mesh data is return via out parameters.
 * @param fragment 
 * @param sliceNormal he normal of the slice plane (points towards the top slice)
 * @param sliceOrigin The origin of the slice plane
 * @param textureScale Scale factor to apply to UV coordinates
 * @param textureOffset Offset to apply to UV coordinates
 * @param convex Set to true if `fragment` is convex geometry. Setting this to
 * true will use a faster triangulation algorithm. Setting this to false will
 * allow non-convex geometry triangulated correctly at the expense of performance.
 * @returns An object containing the fragments above and below the slice plane
 */
export function sliceFragment(
  fragment: Fragment,
  sliceNormal: Vector3,
  sliceOrigin: Vector3,
  textureScale: Vector2,
  textureOffset: Vector2,
  convex: boolean,
): { topSlice: Fragment; bottomSlice: Fragment } {
  const topSlice = new Fragment();
  const bottomSlice = new Fragment();

  // Keep track of what side of the cutting plane each vertex is on
  const side: Array<boolean> = new Array<boolean>(fragment.vertexCount).fill(
    false,
  );

  // Go through and identify which vertices are above/below the split plane
  for (let i = 0; i < fragment.vertices.length; i++) {
    var vertex = fragment.vertices[i];
    side[i] = isPointAbovePlane(vertex.position, sliceNormal, sliceOrigin);
    var slice = side[i] ? topSlice : bottomSlice;
    slice.addMappedVertex(vertex, i);
  }

  const offset = fragment.vertices.length;
  for (let i = 0; i < fragment.cutVertices.length; i++) {
    var vertex = fragment.cutVertices[i];
    side[i + offset] = isPointAbovePlane(
      vertex.position,
      sliceNormal,
      sliceOrigin,
    );
    var slice = side[i + offset] ? topSlice : bottomSlice;
    slice.addMappedVertex(vertex, i + offset);
  }

  splitTriangles(
    fragment,
    topSlice,
    bottomSlice,
    sliceNormal,
    sliceOrigin,
    side,
    SlicedMeshSubmesh.Default,
  );
  splitTriangles(
    fragment,
    topSlice,
    bottomSlice,
    sliceNormal,
    sliceOrigin,
    side,
    SlicedMeshSubmesh.CutFace,
  );

  // Fill in the cut plane for each mesh.
  // The slice normal points to the "above" mesh, so the face normal for the cut face
  // on the above mesh is opposite of the slice normal. Conversely, normal for the
  // cut face on the "below" mesh is in the direction of the slice normal
  fillCutFaces(
    topSlice,
    bottomSlice,
    sliceNormal.clone().negate(),
    textureScale,
    textureOffset,
    convex,
  );

  return { topSlice, bottomSlice };
}

/**
 * Fills the cut faces for each sliced mesh. The `sliceNormal` is the normal for the plane and points
 * in the direction of `topfragment`
 * @param topSlice Fragment mesh data for slice above the slice plane
 * @param bottomSlice Fragment mesh data for slice above the slice plane
 * @param sliceNormal Normal of the slice plane (points towards the top slice)
 * @param textureScale Scale factor to apply to UV coordinates
 * @param textureOffset Offset to apply to UV coordinates
 * @param convex Set to true if fragments are convex
 * @returns
 */
function fillCutFaces(
  topSlice: Fragment,
  bottomSlice: Fragment,
  sliceNormal: Vector3,
  textureScale: Vector2,
  textureOffset: Vector2,
  convex: boolean,
): void {
  // Since the topSlice and bottomSlice both share the same cut face, we only need to calculate it
  // once. Then the same vertex/triangle data for the face will be used for both slices, except
  // with the normals reversed.

  // First need to weld the coincident vertices for the triangulation to work properly
  topSlice.weldCutFaceVertices();

  // Need at least 3 vertices to triangulate
  if (topSlice.cutVertices.length < 3) return;

  // Triangulate the cut face
  const triangulator = convex
    ? new Triangulator(topSlice.cutVertices, sliceNormal)
    : new ConstrainedTriangulator(
        topSlice.cutVertices,
        topSlice.constraints,
        sliceNormal,
      );

  const triangles: number[] = triangulator.triangulate();

  // Update normal and UV for the cut face vertices
  for (let i = 0; i < topSlice.cutVertices.length; i++) {
    var vertex = topSlice.cutVertices[i];
    var point = triangulator.points[i];

    // UV coordinates are based off of the 2D coordinates used for triangulation
    // During triangulation, coordinates are normalized to [0,1], so need to multiply
    // by normalization scale factor to get back to the appropritate scale
    const uv = new Vector2(
      triangulator.normalizationScaleFactor * point.coords.x * textureScale.x +
        textureOffset.x,
      triangulator.normalizationScaleFactor * point.coords.y * textureScale.y +
        textureOffset.y,
    );

    // Update normals and UV coordinates for the cut vertices
    const topVertex = new MeshVertex(
      vertex.position.clone(),
      sliceNormal.clone(),
      uv.clone(),
    );

    const bottomVertex = new MeshVertex(
      vertex.position.clone(),
      sliceNormal.clone().negate(),
      uv.clone(),
    );

    topSlice.cutVertices[i] = topVertex;
    bottomSlice.cutVertices[i] = bottomVertex;
  }

  // push the new triangles to the top/bottom slices
  let offsetTop = topSlice.vertices.length;
  let offsetBottom = bottomSlice.vertices.length;
  for (let i = 0; i < triangles.length; i += 3) {
    topSlice.addTriangle(
      offsetTop + triangles[i],
      offsetTop + triangles[i + 1],
      offsetTop + triangles[i + 2],
      SlicedMeshSubmesh.CutFace,
    );

    bottomSlice.addTriangle(
      offsetBottom + triangles[i],
      offsetBottom + triangles[i + 2],
      offsetBottom + triangles[i + 1],
      SlicedMeshSubmesh.CutFace,
    );
  }
}

/**
 * Identifies triangles that are intersected by the slice plane and splits them in two
 * @param fragment
 * @param topSlice Fragment mesh data for slice above the slice plane
 * @param bottomSlice Fragment mesh data for slice above the slice plane
 * @param sliceNormal The normal of the slice plane (points towards the top slice)
 * @param sliceOrigin The origin of the slice plane
 * @param side Array mapping each vertex to either the top/bottom slice
 * @param subMesh Index of the sub mesh
 */
function splitTriangles(
  fragment: Fragment,
  topSlice: Fragment,
  bottomSlice: Fragment,
  sliceNormal: Vector3,
  sliceOrigin: Vector3,
  side: boolean[],
  subMesh: SlicedMeshSubmesh,
): void {
  const triangles: number[] = fragment.triangles[subMesh];

  // Keep track of vertices that lie on the intersection plane
  let a: number;
  let b: number;
  let c: number;
  for (let i = 0; i < triangles.length; i += 3) {
    // Get vertex indexes for this triangle
    a = triangles[i];
    b = triangles[i + 1];
    c = triangles[i + 2];

    // Triangle is contained completely within mesh A
    if (side[a] && side[b] && side[c]) {
      topSlice.addMappedTriangle(a, b, c, subMesh);
    }
    // Triangle is contained completely within mesh B
    else if (!side[a] && !side[b] && !side[c]) {
      bottomSlice.addMappedTriangle(a, b, c, subMesh);
    }
    // Triangle is intersected by the slicing plane. Need to subdivide it
    else {
      // In these cases, two vertices of the triangle are above the cut plane and one vertex is below
      if (side[b] && side[c] && !side[a]) {
        splitTriangle(
          b,
          c,
          a,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          true,
        );
      } else if (side[c] && side[a] && !side[b]) {
        splitTriangle(
          c,
          a,
          b,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          true,
        );
      } else if (side[a] && side[b] && !side[c]) {
        splitTriangle(
          a,
          b,
          c,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          true,
        );
      }
      // In these cases, two vertices of the triangle are below the cut plane and one vertex is above
      else if (!side[b] && !side[c] && side[a]) {
        splitTriangle(
          b,
          c,
          a,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          false,
        );
      } else if (!side[c] && !side[a] && side[b]) {
        splitTriangle(
          c,
          a,
          b,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          false,
        );
      } else if (!side[a] && !side[b] && side[c]) {
        splitTriangle(
          a,
          b,
          c,
          sliceNormal,
          sliceOrigin,
          fragment,
          topSlice,
          bottomSlice,
          subMesh,
          false,
        );
      }
    }
  }
}

/**
 * Splits triangle defined by the points (v1,v2,v3)
 * @param v1_idx Index of first vertex in triangle
 * @param v2_idx Index of second vertex in triangle
 * @param v3_idx Index of third vertex in triangle
 * @param sliceNormal The normal of the slice plane (points towards the top slice)
 * @param sliceOrigin The origin of the slice plane
 * @param fragment Original mesh data
 * @param topSlice Mesh data for top slice
 * @param bottomSlice Mesh data for bottom slice
 * @param subMesh Index of the submesh that the triangle belongs to
 * @param v3BelowCutPlane Boolean indicating whether v3 is above or below the slice plane.
 */
function splitTriangle(
  v1_idx: number,
  v2_idx: number,
  v3_idx: number,
  sliceNormal: Vector3,
  sliceOrigin: Vector3,
  fragment: Fragment,
  topSlice: Fragment,
  bottomSlice: Fragment,
  subMesh: SlicedMeshSubmesh,
  v3BelowCutPlane: boolean,
): void {
  // - `v1`, `v2`, `v3` are the indexes of the triangle relative to the original mesh data
  // - `v1` and `v2` are on the the side of split plane that belongs to meshA
  // - `v3` is on the side of the split plane that belongs to meshB
  // - `vertices`, `normals`, `uv` are the original mesh data used for interpolation
  //
  // v3BelowCutPlane = true
  // ======================
  //
  //     v1 *_____________* v2   .
  //         \           /      /|\  cutNormal
  //          \         /        |
  //       ----*-------*---------*--
  //        v13 \     /  v23       cutOrigin
  //             \   /
  //              \ /
  //               *  v3         triangle normal out of screen
  //
  // v3BelowCutPlane = false
  // =======================
  //
  //               *  v3         .
  //              / \           /|\  cutNormal
  //         v23 /   \ v13       |
  //       -----*-----*----------*--
  //           /       \         cut origin
  //          /         \
  //      v2 *___________* v1    triangle normal out of screen
  //

  let v1: MeshVertex =
    v1_idx < fragment.vertices.length
      ? fragment.vertices[v1_idx]
      : fragment.cutVertices[v1_idx - fragment.vertices.length];

  let v2: MeshVertex =
    v2_idx < fragment.vertices.length
      ? fragment.vertices[v2_idx]
      : fragment.cutVertices[v2_idx - fragment.vertices.length];

  let v3: MeshVertex =
    v3_idx < fragment.vertices.length
      ? fragment.vertices[v3_idx]
      : fragment.cutVertices[v3_idx - fragment.vertices.length];

  const v13 = linePlaneIntersection(
    v1.position,
    v3.position,
    sliceNormal,
    sliceOrigin,
  );
  const v23 = linePlaneIntersection(
    v2.position,
    v3.position,
    sliceNormal,
    sliceOrigin,
  );

  if (v13 && v23) {
    // Interpolate normals and UV coordinates
    const norm13 = new Vector3(
      v1.normal.x + v13.s * (v3.normal.x - v1.normal.x),
      v1.normal.y + v13.s * (v3.normal.y - v1.normal.y),
      v1.normal.z + v13.s * (v3.normal.z - v1.normal.z),
    ).normalize();

    const norm23 = new Vector3(
      v2.normal.x + v23.s * (v3.normal.x - v2.normal.x),
      v2.normal.y + v23.s * (v3.normal.y - v2.normal.y),
      v2.normal.z + v23.s * (v3.normal.z - v2.normal.z),
    ).normalize();

    const uv13 = new Vector2(
      v1.uv.x + v13.s * (v3.uv.x - v1.uv.x),
      v1.uv.y + v13.s * (v3.uv.y - v1.uv.y),
    );

    const uv23 = new Vector2(
      v2.uv.x + v23.s * (v3.uv.x - v2.uv.x),
      v2.uv.y + v23.s * (v3.uv.y - v2.uv.y),
    );

    // push vertices/normals/uv for the intersection points to each mesh
    topSlice.addCutFaceVertex(v13.x, norm13, uv13);
    topSlice.addCutFaceVertex(v23.x, norm23, uv23);
    bottomSlice.addCutFaceVertex(v13.x, norm13, uv13);
    bottomSlice.addCutFaceVertex(v23.x, norm23, uv23);

    // Indices for the intersection vertices (for the original mesh data)
    const index13_A: number = topSlice.vertices.length - 2;
    const index23_A: number = topSlice.vertices.length - 1;
    const index13_B: number = bottomSlice.vertices.length - 2;
    const index23_B: number = bottomSlice.vertices.length - 1;

    if (v3BelowCutPlane) {
      // Triangle slice above the cutting plane is a quad, so divide into two triangles
      topSlice.addTriangle(
        index23_A,
        index13_A,
        topSlice.indexMap[v2_idx],
        subMesh,
      );
      topSlice.addTriangle(
        index13_A,
        topSlice.indexMap[v1_idx],
        topSlice.indexMap[v2_idx],
        subMesh,
      );

      // One triangle must be added to mesh 2
      bottomSlice.addTriangle(
        bottomSlice.indexMap[v3_idx],
        index13_B,
        index23_B,
        subMesh,
      );

      // When looking at the cut-face, the edges should wind counter-clockwise
      topSlice.constraints.push(
        new EdgeConstraint(
          topSlice.cutVertices.length - 2,
          topSlice.cutVertices.length - 1,
        ),
      );
      bottomSlice.constraints.push(
        new EdgeConstraint(
          bottomSlice.cutVertices.length - 1,
          bottomSlice.cutVertices.length - 2,
        ),
      );
    } else {
      // Triangle slice above the cutting plane is a simple triangle
      topSlice.addTriangle(
        index13_A,
        index23_A,
        topSlice.indexMap[v3_idx],
        subMesh,
      );

      // Triangle slice below the cutting plane is a quad, so divide into two triangles
      bottomSlice.addTriangle(
        bottomSlice.indexMap[v1_idx],
        bottomSlice.indexMap[v2_idx],
        index13_B,
        subMesh,
      );
      bottomSlice.addTriangle(
        bottomSlice.indexMap[v2_idx],
        index23_B,
        index13_B,
        subMesh,
      );

      // When looking at the cut-face, the edges should wind counter-clockwise
      topSlice.constraints.push(
        new EdgeConstraint(
          topSlice.cutVertices.length - 1,
          topSlice.cutVertices.length - 2,
        ),
      );
      bottomSlice.constraints.push(
        new EdgeConstraint(
          bottomSlice.cutVertices.length - 2,
          bottomSlice.cutVertices.length - 1,
        ),
      );
    }
  }
}
