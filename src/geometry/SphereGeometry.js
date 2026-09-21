/**
 * N3D SphereGeometry
 */

import { Geometry, BufferAttribute } from './Geometry.js';

export class SphereGeometry extends Geometry {
  /**
   * @param {number} radius
   * @param {number} [widthSegments=32]
   * @param {number} [heightSegments=16]
   */
  constructor(radius = 1, widthSegments = 32, heightSegments = 16) {
    super();
    this.name = 'SphereGeometry';

    widthSegments = Math.max(3, Math.floor(widthSegments));
    heightSegments = Math.max(2, Math.floor(heightSegments));

    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    for (let iy = 0; iy <= heightSegments; iy++) {
      const v = iy / heightSegments;
      const phi = v * Math.PI;

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;
        const theta = u * Math.PI * 2;

        const x = -radius * Math.cos(theta) * Math.sin(phi);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(theta) * Math.sin(phi);

        positions.push(x, y, z);
        normals.push(x / radius, y / radius, z / radius);
        uvs.push(u, 1 - v);
      }
    }

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = iy * (widthSegments + 1) + ix;
        const b = a + widthSegments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    this.setIndex(new Uint32Array(indices));
  }
}

export default SphereGeometry;
