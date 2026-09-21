/**
 * N3D Camera
 * Perspective and Orthographic cameras.
 */

import { Object3D } from './Object3D.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Vector3 } from '../math/Vector3.js';

export class Camera extends Object3D {
  constructor() {
    super('Camera');
    this.isCamera = true;

    this.matrixWorldInverse = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();

    this.near = 0.1;
    this.far = 2000;
  }

  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    this.matrixWorldInverse.copy(this.worldMatrix).invert();
  }

  getWorldDirection(out = new Vector3()) {
    // -Z axis of world matrix
    const e = this.worldMatrix.elements;
    out.set(-e[8], -e[9], -e[10]).normalize();
    return out;
  }
}

export class PerspectiveCamera extends Camera {
  /**
   * @param {number} fov - vertical FOV in degrees
   * @param {number} aspect
   * @param {number} near
   * @param {number} far
   */
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
    super();
    this.isPerspectiveCamera = true;
    this.name = 'PerspectiveCamera';

    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;

    this.zoom = 1;
    this.filmGauge = 35;
    this.filmOffset = 0;

    this.updateProjectionMatrix();
  }

  updateProjectionMatrix() {
    const near = this.near;
    const top = near * Math.tan((Math.PI / 180) * 0.5 * this.fov) / this.zoom;
    const height = 2 * top;
    const width = this.aspect * height;
    const left = -0.5 * width;

    // Simple version without film offset for now
    this.projectionMatrix.makePerspective(
      (this.fov * Math.PI) / 180,
      this.aspect,
      this.near,
      this.far
    );
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }

  setAspect(aspect) {
    this.aspect = aspect;
    this.updateProjectionMatrix();
  }
}

export class OrthographicCamera extends Camera {
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2000) {
    super();
    this.isOrthographicCamera = true;
    this.name = 'OrthographicCamera';

    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    this.zoom = 1;

    this.updateProjectionMatrix();
  }

  updateProjectionMatrix() {
    const dx = (this.right - this.left) / (2 * this.zoom);
    const dy = (this.top - this.bottom) / (2 * this.zoom);
    const cx = (this.right + this.left) / 2;
    const cy = (this.top + this.bottom) / 2;

    this.projectionMatrix.makeOrthographic(
      cx - dx, cx + dx,
      cy - dy, cy + dy,
      this.near, this.far
    );
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}

export default Camera;
