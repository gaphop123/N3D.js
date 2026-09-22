/**
 * N3D Collider
 * Lightweight collision shapes attached to Object3D nodes.
 * This is a real math-based system, not a full physics engine.
 */

import { Vector3 } from '../math/Vector3.js';
import { Box3 } from '../math/Box3.js';
import { Sphere } from '../math/Sphere.js';
import { Ray } from '../math/Ray.js';

let _colliderId = 1;

/**
 * Base collider
 */
export class Collider {
  constructor(object3d = null) {
    this.id = _colliderId++;
    this.object = object3d; // owning Object3D / Mesh
    this.enabled = true;
    this.isTrigger = false; // trigger = no physical response, only events
    this.layers = 1; // bitmask for filtering

    // World-space bounds (updated by PhysicsWorld)
    this.worldBox = new Box3();
    this.worldSphere = new Sphere();
    this._dirty = true;
  }

  markDirty() {
    this._dirty = true;
  }

  /**
   * Update world bounds from local shape + object transform.
   * Override in subclasses.
   */
  updateWorldBounds() {
    this._dirty = false;
  }
}

/**
 * Axis-aligned box collider (local space, transformed to world AABB)
 */
export class BoxCollider extends Collider {
  constructor(object3d = null, size = null, center = null) {
    super(object3d);
    this.isBoxCollider = true;
    this.size = size ? size.clone() : new Vector3(1, 1, 1);
    this.center = center ? center.clone() : new Vector3(0, 0, 0); // local offset
    this._localBox = new Box3();
  }

  updateWorldBounds() {
    if (!this.object) {
      this._dirty = false;
      return;
    }
    this.object.updateWorldMatrix(true, false);

    const half = this.size.clone().multiplyScalar(0.5);
    this._localBox.min.set(
      this.center.x - half.x,
      this.center.y - half.y,
      this.center.z - half.z
    );
    this._localBox.max.set(
      this.center.x + half.x,
      this.center.y + half.y,
      this.center.z + half.z
    );

    this.worldBox.copy(this._localBox).applyMatrix4(this.object.worldMatrix);
    this.worldBox.getCenter(this.worldSphere.center);
    const size = this.worldBox.getSize();
    this.worldSphere.radius = size.length() * 0.5;
    this._dirty = false;
  }
}

/**
 * Sphere collider
 */
export class SphereCollider extends Collider {
  constructor(object3d = null, radius = 0.5, center = null) {
    super(object3d);
    this.isSphereCollider = true;
    this.radius = radius;
    this.center = center ? center.clone() : new Vector3(0, 0, 0);
  }

  updateWorldBounds() {
    if (!this.object) {
      this._dirty = false;
      return;
    }
    this.object.updateWorldMatrix(true, false);

    const e = this.object.worldMatrix.elements;
    // Transform local center
    const x = this.center.x, y = this.center.y, z = this.center.z;
    this.worldSphere.center.set(
      e[0] * x + e[4] * y + e[8] * z + e[12],
      e[1] * x + e[5] * y + e[9] * z + e[13],
      e[2] * x + e[6] * y + e[10] * z + e[14]
    );

    // Max scale axis
    const sx = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
    const sy = Math.sqrt(e[4] * e[4] + e[5] * e[5] + e[6] * e[6]);
    const sz = Math.sqrt(e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);
    this.worldSphere.radius = this.radius * Math.max(sx, sy, sz);

    // Approximate world box
    const r = this.worldSphere.radius;
    this.worldBox.min.set(
      this.worldSphere.center.x - r,
      this.worldSphere.center.y - r,
      this.worldSphere.center.z - r
    );
    this.worldBox.max.set(
      this.worldSphere.center.x + r,
      this.worldSphere.center.y + r,
      this.worldSphere.center.z + r
    );
    this._dirty = false;
  }
}

/**
 * Result of a raycast query
 */
export class RaycastHit {
  constructor() {
    this.collider = null;
    this.object = null;
    this.point = new Vector3();
    this.normal = new Vector3();
    this.distance = 0;
  }
}

/**
 * Test two colliders for intersection (world space).
 */
export function collidersIntersect(a, b) {
  if (!a.enabled || !b.enabled) return false;
  if (a._dirty) a.updateWorldBounds();
  if (b._dirty) b.updateWorldBounds();

  // Layer filter
  if ((a.layers & b.layers) === 0) return false;

  // Broad phase: sphere
  if (!a.worldSphere.intersectsSphere(b.worldSphere)) return false;

  // Narrow phase
  if (a.isSphereCollider && b.isSphereCollider) {
    return true; // sphere test already passed
  }
  if (a.isBoxCollider && b.isBoxCollider) {
    return a.worldBox.intersectsBox(b.worldBox);
  }
  // Mixed: box vs sphere
  if (a.isBoxCollider && b.isSphereCollider) {
    return a.worldBox.intersectsSphere(b.worldSphere);
  }
  if (a.isSphereCollider && b.isBoxCollider) {
    return b.worldBox.intersectsSphere(a.worldSphere);
  }
  return a.worldBox.intersectsBox(b.worldBox);
}

/**
 * Raycast against a single collider.
 * Returns distance or null.
 */
export function raycastCollider(ray, collider, outHit = null) {
  if (!collider.enabled) return null;
  if (collider._dirty) collider.updateWorldBounds();

  let t = null;
  if (collider.isSphereCollider) {
    t = ray.intersectSphere(collider.worldSphere, outHit ? outHit.point : null);
  } else {
    t = ray.intersectBox(collider.worldBox, outHit ? outHit.point : null);
  }

  if (t === null || t < 0) return null;

  if (outHit) {
    outHit.collider = collider;
    outHit.object = collider.object;
    outHit.distance = t;
    // Approximate normal (from center for sphere, or axis for box)
    if (collider.isSphereCollider) {
      outHit.normal.copy(outHit.point).sub(collider.worldSphere.center).normalize();
    } else {
      // Simple: push from box center
      outHit.normal.copy(outHit.point).sub(collider.worldBox.getCenter()).normalize();
    }
  }
  return t;
}

export default Collider;
