import * as THREE from "three";
import { FractureOptions } from "../entities/FractureOptions";
import { fractureFragment } from "./FractureFragment";
import {
  geometryToFragment,
  fragmentToGeometry,
} from "../utils/GeometryConversion";

/**
 * Fractures the mesh into multiple fragments
 * @param mesh The source mesh to fracture
 * @param options Options for fracturing
 */
export function fracture(
  geometry: THREE.BufferGeometry,
  options: FractureOptions,
): THREE.BufferGeometry[] {
  const fragments = fractureFragment(geometryToFragment(geometry), options);
  return fragments.map((fragment) => fragmentToGeometry(fragment));
}
