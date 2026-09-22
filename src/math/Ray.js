/**
 * N3D Ray
 * Used for raycasting / picking / collision queries.
 */

import { Vector3 } from './Vector3.js';

const _tmp = new Vector3();
const _tmp2 = new Vector3();

export class Ray {
  constructor(origin = null, direction = null) {
    this.origin = origin ? origin.clone() : new Vector3();
    this.direction = direction ? direction.clone().normalize() : new Vector3(0, 0, -1);
  }

  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction).normalize();
    return this;
  }

  copy(ray) {
    this.origin.copy(ray.origin);
    this.direction.copy(ray.direction);
    return this;
  }

  clone() {
    return new Ray().copy(this);
  }

  at(t, out = new Vector3()) {
    return out.copy(this.direction).multiplyScalar(t).add(this.origin);
  }

  lookAt(v) {
    this.direction.copy(v).sub(this.origin).normalize();
    return this;
  }

  /**
   * Ray-sphere intersection.
   * Returns distance t or null.
   */
  intersectSphere(sphere, outPoint = null) {
    _tmp.copy(sphere.center).sub(this.origin);
    const tca = _tmp.dot(this.direction);
    const d2 = _tmp.dot(_tmp) - tca * tca;
    const r2 = sphere.radius * sphere.radius;
    if (d2 > r2) return null;

    const thc = Math.sqrt(r2 - d2);
    let t0 = tca - thc;
    let t1 = tca + thc;

    if (t0 < 0) {
      t0 = t1;
      if (t0 < 0) return null;
    }

    if (outPoint) this.at(t0, outPoint);
    return t0;
  }

  /**
   * Ray-AABB intersection (slab method).
   * Returns distance t or null.
   */
  intersectBox(box, outPoint = null) {
    let tmin = -Infinity;
    let tmax = Infinity;

    const ox = this.origin.x, oy = this.origin.y, oz = this.origin.z;
    const dx = this.direction.x, dy = this.direction.y, dz = this.direction.z;

    // X slab
    if (Math.abs(dx) < 1e-12) {
      if (ox < box.min.x || ox > box.max.x) return null;
    } else {
      let t1 = (box.min.x - ox) / dx;
      let t2 = (box.max.x - ox) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    // Y slab
    if (Math.abs(dy) < 1e-12) {
      if (oy < box.min.y || oy > box.max.y) return null;
    } else {
      let t1 = (box.min.y - oy) / dy;
      let t2 = (box.max.y - oy) / dy;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    // Z slab
    if (Math.abs(dz) < 1e-12) {
      if (oz < box.min.z || oz > box.max.z) return null;
    } else {
      let t1 = (box.min.z - oz) / dz;
      let t2 = (box.max.z - oz) / dz;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }

    const t = tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
    if (t === null) return null;
    if (outPoint) this.at(t, outPoint);
    return t;
  }

  /**
   * Distance from ray to a point.
   */
  distanceToPoint(point) {
    _tmp.copy(point).sub(this.origin);
    const proj = _tmp.dot(this.direction);
    if (proj < 0) return this.origin.distanceTo(point);
    _tmp2.copy(this.direction).multiplyScalar(proj).add(this.origin);
    return _tmp2.distanceTo(point);
  }

  /**
   * Closest point on ray to a given point.
   */
  closestPointToPoint(point, out = new Vector3()) {
    _tmp.copy(point).sub(this.origin);
    const t = Math.max(0, _tmp.dot(this.direction));
    return this.at(t, out);
  }

  applyMatrix4(matrix) {
    this.origin.applyMatrix4(matrix);
    // Transform direction as vector (no translation)
    const e = matrix.elements;
    const x = this.direction.x, y = this.direction.y, z = this.direction.z;
    this.direction.set(
      e[0] * x + e[4] * y + e[8] * z,
      e[1] * x + e[5] * y + e[9] * z,
      e[2] * x + e[6] * y + e[10] * z
    ).normalize();
    return this;
  }
}

export default Ray;
