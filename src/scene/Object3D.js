/**
 * N3D Object3D
 * Base for renderable / light / camera objects.
 */

import { Node } from './Node.js';

export class Object3D extends Node {
  constructor(name = '') {
    super(name);
    this.isObject3D = true;

    this.frustumCulled = true;
    this.renderOrder = 0;

    // Bounding volumes (updated by geometry or manually)
    this.boundingSphere = null;
    this.boundingBox = null;
  }
}

export default Object3D;
