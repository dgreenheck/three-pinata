import { Mesh, Vector3 } from 'three';
import { FractureOptions } from './FractureOptions';
import { Fragment } from './Fragment';
import { slice } from './MeshSlicer';
import { findIsolatedGeometry } from '../utils/UnionFind';

/**
 * Fractures the mesh into multiple fragments
 * @param mesh The source mesh to fracture
 * @param options Options for fracturing
 */
export function fracture(mesh: Mesh, options: FractureOptions): Fragment[] {
  // We begin by fragmenting the source mesh, then process each fragment in a FIFO queue
  // until we achieve the target fragment count.
  let fragments = [Fragment.fromGeometry(mesh.geometry)];

  // Subdivide the mesh into multiple fragments until we reach the fragment limit
  while (fragments.length < options.fragmentCount) {
    const fragment = fragments.shift()!;
    if (!fragment) continue;

    fragment?.calculateBounds();

    // Select an arbitrary fracture plane normal
    const normal = new Vector3(
      options.xAxis ? (2.0 * Math.random() - 1) : 0,
      options.yAxis ? (2.0 * Math.random() - 1) : 0,
      options.zAxis ? (2.0 * Math.random() - 1) : 0
    ).normalize();
    
    const center = new Vector3();
    fragment.bounds.getCenter(center);

    // Slice and dice!
    const { topSlice, bottomSlice } = slice(fragment, normal, center, options.textureScale, options.textureOffset);

    const topfragments = findIsolatedGeometry(topSlice);
    const bottomfragments = findIsolatedGeometry(bottomSlice);

    // Check both slices for isolated fragments
    fragments.push(...topfragments)
    fragments.push(...bottomfragments);
  }

  return fragments;
}