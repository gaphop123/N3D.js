/**
 * N3D Mesh
 * Geometry + Material.
 */

import { Object3D } from './Object3D.js';
import { ErrorSystem } from '../core/ErrorSystem.js';

export class Mesh extends Object3D {
  constructor(geometry = null, material = null) {
    super('Mesh');
    this.isMesh = true;

    this.geometry = geometry;
    this.material = material; // can be array for multi-material later

    this.castShadow = false;
    this.receiveShadow = false;
  }

  /**
   * Convenience factory
   */
  static box(options = {}) {
    // Lazy import would be better; for now simple
    ErrorSystem.notImplemented('Mesh.box convenience factory', { subsystem: 'Scene' });
  }

  dispose() {
    if (this.geometry && typeof this.geometry.dispose === 'function') {
      this.geometry.dispose();
    }
    if (this.material) {
      if (Array.isArray(this.material)) {
        for (const m of this.material) m.dispose?.();
      } else {
        this.material.dispose?.();
      }
    }
    super.dispose();
  }
}

export default Mesh;
