/**
 * N3D Box3 — Axis-Aligned Bounding Box
 */

import { Vector3 } from './Vector3.js';

export class Box3 {
  constructor(min = null, max = null) {
    this.min = min ? min.clone() : new Vector3(+Infinity, +Infinity, +Infinity);
    this.max = max ? max.clone() : new Vector3(-Infinity, -Infinity, -Infinity);
  }

  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }

  setFromCenterAndSize(center, size) {
    const half = size.clone().multiplyScalar(0.5);
    this.min.copy(center).sub(half);
    this.max.copy(center).add(half);
    return this;
  }

  setFromPoints(points) {
    this.makeEmpty();
    for (const p of points) {
      this.expandByPoint(p);
    }
    return this;
  }

  makeEmpty() {
    this.min.set(+Infinity, +Infinity, +Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    return this;
  }

  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }

  getCenter(out = new Vector3()) {
    return out.set(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5
    );
  }

  getSize(out = new Vector3()) {
    return out.set(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z
    );
  }

  expandByPoint(point) {
    this.min.x = Math.min(this.min.x, point.x);
    this.min.y = Math.min(this.min.y, point.y);
    this.min.z = Math.min(this.min.z, point.z);
    this.max.x = Math.max(this.max.x, point.x);
    this.max.y = Math.max(this.max.y, point.y);
    this.max.z = Math.max(this.max.z, point.z);
    return this;
  }

  expandByScalar(s) {
    this.min.addScalar(-s);
    this.max.addScalar(s);
    return this;
  }

  expandByVector(v) {
    this.min.sub(v);
    this.max.add(v);
    return this;
  }

  containsPoint(point) {
    return point.x >= this.min.x && point.x <= this.max.x &&
           point.y >= this.min.y && point.y <= this.max.y &&
           point.z >= this.min.z && point.z <= this.max.z;
  }

  containsBox(box) {
    return this.min.x <= box.min.x && box.max.x <= this.max.x &&
           this.min.y <= box.min.y && box.max.y <= this.max.y &&
           this.min.z <= box.min.z && box.max.z <= this.max.z;
  }

  intersectsBox(box) {
    return !(box.max.x < this.min.x || box.min.x > this.max.x ||
             box.max.y < this.min.y || box.min.y > this.max.y ||
             box.max.z < this.min.z || box.min.z > this.max.z);
  }

  intersectsSphere(sphere) {
    // Closest point on box to sphere center
    const x = Math.max(this.min.x, Math.min(sphere.center.x, this.max.x));
    const y = Math.max(this.min.y, Math.min(sphere.center.y, this.max.y));
    const z = Math.max(this.min.z, Math.min(sphere.center.z, this.max.z));
    const dx = x - sphere.center.x;
    const dy = y - sphere.center.y;
    const dz = z - sphere.center.z;
    return (dx * dx + dy * dy + dz * dz) <= (sphere.radius * sphere.radius);
  }

  clampPoint(point, out = new Vector3()) {
    out.x = Math.max(this.min.x, Math.min(this.max.x, point.x));
    out.y = Math.max(this.min.y, Math.min(this.max.y, point.y));
    out.z = Math.max(this.min.z, Math.min(this.max.z, point.z));
    return out;
  }

  distanceToPoint(point) {
    const clamped = this.clampPoint(point);
    return clamped.distanceTo(point);
  }

  copy(box) {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }

  clone() {
    return new Box3().copy(this);
  }

  /**
   * Transform AABB by matrix (conservative — may grow).
   */
  applyMatrix4(matrix) {
    if (this.isEmpty()) return this;

    const points = [
      new Vector3(this.min.x, this.min.y, this.min.z),
      new Vector3(this.min.x, this.min.y, this.max.z),
      new Vector3(this.min.x, this.max.y, this.min.z),
      new Vector3(this.min.x, this.max.y, this.max.z),
      new Vector3(this.max.x, this.min.y, this.min.z),
      new Vector3(this.max.x, this.min.y, this.max.z),
      new Vector3(this.max.x, this.max.y, this.min.z),
      new Vector3(this.max.x, this.max.y, this.max.z)
    ];

    const e = matrix.elements;
    this.makeEmpty();
    for (const p of points) {
      const x = p.x, y = p.y, z = p.z;
      p.x = e[0] * x + e[4] * y + e[8] * z + e[12];
      p.y = e[1] * x + e[5] * y + e[9] * z + e[13];
      p.z = e[2] * x + e[6] * y + e[10] * z + e[14];
      this.expandByPoint(p);
    }
    return this;
  }
}

export default Box3;
