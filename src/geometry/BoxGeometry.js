/**
 * N3D BoxGeometry
 */

import { Geometry, BufferAttribute } from './Geometry.js';

export class BoxGeometry extends Geometry {
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} depth
   * @param {number} [widthSegments=1]
   * @param {number} [heightSegments=1]
   * @param {number} [depthSegments=1]
   */
  constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
    super();
    this.name = 'BoxGeometry';

    // Simple non-segmented box for correctness and performance
    // (segmented version can be added later)

    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;

    // 24 vertices (4 per face) so we can have correct normals/uvs
    const positions = new Float32Array([
      // +X
       w, -h, -d,  w,  h, -d,  w,  h,  d,  w, -h,  d,
      // -X
      -w, -h,  d, -w,  h,  d, -w,  h, -d, -w, -h, -d,
      // +Y
      -w,  h, -d, -w,  h,  d,  w,  h,  d,  w,  h, -d,
      // -Y
      -w, -h,  d, -w, -h, -d,  w, -h, -d,  w, -h,  d,
      // +Z
      -w, -h,  d,  w, -h,  d,  w,  h,  d, -w,  h,  d,
      // -Z
       w, -h, -d, -w, -h, -d, -w,  h, -d,  w,  h, -d
    ]);

    const normals = new Float32Array([
       1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
       0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
       0,-1, 0,  0,-1, 0,  0,-1, 0,  0,-1, 0,
       0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
       0, 0,-1,  0, 0,-1,  0, 0,-1,  0, 0,-1
    ]);

    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1
    ]);

    const indices = new Uint16Array([
       0,  1,  2,  0,  2,  3,
       4,  5,  6,  4,  6,  7,
       8,  9, 10,  8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]);

    this.setAttribute('position', new BufferAttribute(positions, 3));
    this.setAttribute('normal', new BufferAttribute(normals, 3));
    this.setAttribute('uv', new BufferAttribute(uvs, 2));
    this.setIndex(indices);
  }
}

export default BoxGeometry;
