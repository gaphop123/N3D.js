/**
 * N3D Sphere — Bounding sphere
 */

import { Vector3 } from './Vector3.js';

export class Sphere {
  constructor(center = null, radius = 0) {
    this.center = center ? center.clone() : new Vector3();
    this.radius = radius;
  }

  set(center, radius) {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }

  setFromPoints(points, optionalCenter = null) {
    if (optionalCenter) {
      this.center.copy(optionalCenter);
    } else {
      // Simple centroid
      this.center.set(0, 0, 0);
      for (const p of points) this.center.add(p);
      if (points.length > 0) this.center.multiplyScalar(1 / points.length);
    }

    let maxRadiusSq = 0;
    for (const p of points) {
      maxRadiusSq = Math.max(maxRadiusSq, this.center.distanceToSquared(p));
    }
    this.radius = Math.sqrt(maxRadiusSq);
    return this;
  }

  copy(sphere) {
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    return this;
  }

  clone() {
    return new Sphere().copy(this);
  }

  isEmpty() {
    return this.radius < 0;
  }

  containsPoint(point) {
    return this.center.distanceToSquared(point) <= this.radius * this.radius;
  }

  intersectsSphere(sphere) {
    const r = this.radius + sphere.radius;
    return this.center.distanceToSquared(sphere.center) <= r * r;
  }

  intersectsBox(box) {
    return box.intersectsSphere(this);
  }

  clampPoint(point, out = new Vector3()) {
    const distSq = this.center.distanceToSquared(point);
    out.copy(point);
    if (distSq > this.radius * this.radius) {
      out.sub(this.center).normalize().multiplyScalar(this.radius).add(this.center);
    }
    return out;
  }

  distanceToPoint(point) {
    return this.center.distanceTo(point) - this.radius;
  }

  translate(offset) {
    this.center.add(offset);
    return this;
  }

  applyMatrix4(matrix) {
    this.center.applyMatrix4?.(matrix) || _applyMatrix4Point(this.center, matrix);
    // Approximate scale (max axis scale)
    const e = matrix.elements;
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);
    const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
    this.radius *= Math.max(sx, sy, sz);
    return this;
  }
}

function _applyMatrix4Point(v, m) {
  const e = m.elements;
  const x = v.x, y = v.y, z = v.z;
  const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
  v.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
  v.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
  v.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
  return v;
}

// Add applyMatrix4 to Vector3 if missing
if (!Vector3.prototype.applyMatrix4) {
  Vector3.prototype.applyMatrix4 = function(m) {
    return _applyMatrix4Point(this, m);
  };
}

export default Sphere;
