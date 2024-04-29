import { Mesh, MeshLambertMaterial, Vector3 } from 'three';
import { FractureOptions } from './FractureOptions';
import { Fragment } from './Fragment';
import { slice } from './MeshSlicer';

/**
 * Fractures the mesh into multiple fragments
 * @param mesh The source mesh to fracture
 * @param options Options for fracturing
 */
export function fracture(mesh: Mesh, options: FractureOptions): Mesh[] {
  // We begin by fragmenting the source mesh, then process each fragment in a FIFO queue
  // until we achieve the target fragment count.
  let fragments = [Fragment.fromGeometry(mesh.geometry)];

  // Subdivide the mesh into multiple fragments until we reach the fragment limit
  while (fragments.length < options.fragmentCount) {
    const fragment = fragments.shift();
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

    fragments.push(topSlice);
    fragments.push(bottomSlice);
  }

  const meshes = [];
  for (let i = 0; i < fragments.length; i++) {
    const fragmentMesh = createMesh(fragments[i], mesh, i);
    if (fragmentMesh) {
      meshes.push(fragmentMesh);
    }
  }

  return meshes;
}

/**
 * Creates a new Mesh from the fragment data
 * @param fragment The fragment data to generate a mesh from
 * @param parent The parent mesh to add the fragments to
 * @param detectFloatingFragments Whether or not to find fragments that are disconnected and create separate fragments for them
 * @param i Counter used for naming
 */
function createMesh(fragment: Fragment, parent: Mesh, i: number) {
  // If there is no mesh data, don't create an object
  if (fragment.triangles.length === 0) {
    return;
  }

  // If the "Detect Floating Fragments" option is enabled, take the fragment mesh and
  // identify disconnected sets of geometry within it, treating each of these as a
  // separate physical object

  /* TODO: IMPLEMENT
  if (detectFloatingFragments) {
    meshes = MeshUtils.FindDisconnectedMeshes(fragmentMesh);
  }
  else {
    meshes = new Mesh[] { fragmentMesh };
  }
  */

  const mesh = parent.clone();
  mesh.geometry = fragment.toGeometry();
  mesh.name = `${parent.name}_${i}`;
  mesh.material = [
    new MeshLambertMaterial({ color: 0xff0000, wireframe: true }),
    new MeshLambertMaterial({ color: 0x0000ff, wireframe: true })
  ]

  /*
  var size = fragmentMesh.bounds.size;
          float density = (parentSize.x * parentSize.y * parentSize.z) / parentMass;
  rigidBody.mass = (size.x * size.y * size.z) / density;
  */

  return mesh;
}