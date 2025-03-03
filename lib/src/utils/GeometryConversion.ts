import * as THREE from "three";
import { Fragment } from "../entities/Fragment";
import { Vector2 } from "./Vector2";
import { Vector3 } from "./Vector3";
import MeshVertex from "../entities/MeshVertex";

/**
 * Converts a THREE.BufferGeometry to our internal Fragment representation
 */
export function geometryToFragment(geometry: THREE.BufferGeometry): Fragment {
  const positions = geometry.attributes.position.array as Float32Array;
  const normals = geometry.attributes.normal.array as Float32Array;
  const uvs = geometry.attributes.uv.array as Float32Array;

  const fragment = new Fragment();
  for (let i = 0; i < positions.length / 3; i++) {
    const position = new Vector3(
      positions[3 * i],
      positions[3 * i + 1],
      positions[3 * i + 2],
    );

    const normal = new Vector3(
      normals[3 * i],
      normals[3 * i + 1],
      normals[3 * i + 2],
    );

    const uv = new Vector2(uvs[2 * i], uvs[2 * i + 1]);

    fragment.vertices.push(new MeshVertex(position, normal, uv));
  }

  fragment.triangles = [Array.from(geometry.index?.array as Uint32Array), []];
  fragment.calculateBounds();

  return fragment;
}

/**
 * Converts our internal Fragment representation to a THREE.BufferGeometry
 */
export function fragmentToGeometry(fragment: Fragment): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const vertexCount = fragment.vertices.length + fragment.cutVertices.length;
  const positions = new Array<number>(vertexCount * 3);
  const normals = new Array<number>(vertexCount * 3);
  const uvs = new Array<number>(vertexCount * 2);

  let posIdx = 0;
  let normIdx = 0;
  let uvIdx = 0;

  // Add the positions, normals and uvs for the non-cut-face geometry
  for (const vert of fragment.vertices) {
    positions[posIdx++] = vert.position.x;
    positions[posIdx++] = vert.position.y;
    positions[posIdx++] = vert.position.z;

    normals[normIdx++] = vert.normal.x;
    normals[normIdx++] = vert.normal.y;
    normals[normIdx++] = vert.normal.z;

    uvs[uvIdx++] = vert.uv.x;
    uvs[uvIdx++] = vert.uv.y;
  }

  // Next, add the positions, normals and uvs for the cut-face geometry
  for (const vert of fragment.cutVertices) {
    positions[posIdx++] = vert.position.x;
    positions[posIdx++] = vert.position.y;
    positions[posIdx++] = vert.position.z;

    normals[normIdx++] = vert.normal.x;
    normals[normIdx++] = vert.normal.y;
    normals[normIdx++] = vert.normal.z;

    uvs[uvIdx++] = vert.uv.x;
    uvs[uvIdx++] = vert.uv.y;
  }

  geometry.addGroup(0, fragment.triangles[0].length, 0);
  geometry.addGroup(
    fragment.triangles[0].length,
    fragment.triangles[1].length,
    1,
  );

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array(normals), 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(uvs), 2),
  );
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(fragment.triangles.flat()), 1),
  );

  return geometry;
}
