import { fracture } from "./Fracture";
import { FractureOptions } from "./entities/FractureOptions";
import { Fragment } from "./entities/Fragment";

interface FractureWorkerMessage {
  objectId: number;
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  options: FractureOptions;
}

onmessage = (e) => {
  console.log("Worker received message");
  console.log(performance.now());

  const m: FractureWorkerMessage = e.data;
  const fragment = Fragment.fromGeometry(
    m.vertices,
    m.normals,
    m.uvs,
    m.indices,
  );

  console.log(
    `Fracturing object ${m.objectId} (vertex count = ${fragment.vertices.length}, triangle count = ${fragment.triangleCount})...`,
  );

  const start = performance.now();

  const fragments = fracture(fragment, m.options);

  console.log(`Done (elapsed time = ${performance.now() - start}ms)`);

  postMessage({ objectId: m.objectId, fragments });
};
