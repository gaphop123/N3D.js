/**
 * N3D PhysicsWorld
 * Lightweight collision detection + raycasting.
 * This is NOT a full rigid-body physics engine.
 * It provides real intersection tests and a clean interface
 * for integrating external physics backends later.
 */

import { Vector3 } from '../math/Vector3.js';
import { Ray } from '../math/Ray.js';
import {
  Collider,
  BoxCollider,
  SphereCollider,
  RaycastHit,
  collidersIntersect,
  raycastCollider
} from './Collider.js';
import { EventSystem } from '../core/EventSystem.js';
import { Logger } from '../core/Logger.js';

export class PhysicsWorld {
  constructor(options = {}) {
    this.gravity = options.gravity
      ? new Vector3().copy(options.gravity)
      : new Vector3(0, -9.81, 0);

    this.colliders = [];
    this._events = new EventSystem();
    this._ray = new Ray();
    this._hit = new RaycastHit();

    // Simple collision pair cache for events
    this._prevPairs = new Set();
    this._currPairs = new Set();
  }

  /**
   * Register a collider.
   */
  addCollider(collider) {
    if (!collider || this.colliders.includes(collider)) return this;
    this.colliders.push(collider);
    collider.markDirty();
    return this;
  }

  /**
   * Create and attach a BoxCollider to an Object3D.
   */
  addBoxCollider(object3d, size = null, center = null) {
    const c = new BoxCollider(object3d, size, center);
    // Auto-size from geometry if available
    if (!size && object3d.geometry) {
      // Rough default; proper AABB from geometry can be added later
      c.size.set(1, 1, 1);
    }
    object3d.collider = c;
    this.addCollider(c);
    return c;
  }

  /**
   * Create and attach a SphereCollider.
   */
  addSphereCollider(object3d, radius = 0.5, center = null) {
    const c = new SphereCollider(object3d, radius, center);
    object3d.collider = c;
    this.addCollider(c);
    return c;
  }

  removeCollider(collider) {
    const idx = this.colliders.indexOf(collider);
    if (idx !== -1) {
      this.colliders.splice(idx, 1);
      if (collider.object) collider.object.collider = null;
    }
    return this;
  }

  /**
   * Step collision detection (call once per frame or fixed update).
   * Detects enter / stay / exit and emits events.
   */
  step(deltaTime = 1 / 60) {
    // Update all world bounds
    for (const c of this.colliders) {
      if (c.enabled) c.updateWorldBounds();
    }

    this._currPairs.clear();
    const n = this.colliders.length;

    for (let i = 0; i < n; i++) {
      const a = this.colliders[i];
      if (!a.enabled) continue;

      for (let j = i + 1; j < n; j++) {
        const b = this.colliders[j];
        if (!b.enabled) continue;

        if (collidersIntersect(a, b)) {
          const key = a.id < b.id ? `${a.id}_${b.id}` : `${b.id}_${a.id}`;
          this._currPairs.add(key);

          if (!this._prevPairs.has(key)) {
            // Enter
            this._events.emit('collisionEnter', { a, b });
            this._events.emit('triggerEnter', { a, b });
          } else {
            this._events.emit('collisionStay', { a, b });
          }
        }
      }
    }

    // Exit events
    for (const key of this._prevPairs) {
      if (!this._currPairs.has(key)) {
        const [idA, idB] = key.split('_').map(Number);
        const a = this.colliders.find(c => c.id === idA);
        const b = this.colliders.find(c => c.id === idB);
        if (a && b) {
          this._events.emit('collisionExit', { a, b });
          this._events.emit('triggerExit', { a, b });
        }
      }
    }

    // Swap
    const tmp = this._prevPairs;
    this._prevPairs = this._currPairs;
    this._currPairs = tmp;
  }

  /**
   * Raycast against all colliders.
   * @returns {RaycastHit|null}
   */
  raycast(origin, direction, maxDistance = Infinity, layerMask = 0xffffffff) {
    this._ray.set(origin, direction);

    let closestT = maxDistance;
    let closestHit = null;

    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if ((c.layers & layerMask) === 0) continue;

      const t = raycastCollider(this._ray, c, this._hit);
      if (t !== null && t < closestT) {
        closestT = t;
        if (!closestHit) closestHit = new RaycastHit();
        closestHit.collider = this._hit.collider;
        closestHit.object = this._hit.object;
        closestHit.point.copy(this._hit.point);
        closestHit.normal.copy(this._hit.normal);
        closestHit.distance = t;
      }
    }

    return closestHit;
  }

  /**
   * RaycastAll — returns all hits sorted by distance.
   */
  raycastAll(origin, direction, maxDistance = Infinity, layerMask = 0xffffffff) {
    this._ray.set(origin, direction);
    const hits = [];

    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if ((c.layers & layerMask) === 0) continue;

      const hit = new RaycastHit();
      const t = raycastCollider(this._ray, c, hit);
      if (t !== null && t <= maxDistance) {
        hit.distance = t;
        hits.push(hit);
      }
    }

    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  /**
   * Overlap sphere query.
   */
  overlapSphere(center, radius, layerMask = 0xffffffff) {
    const results = [];
    const testSphere = { center, radius, intersectsSphere(s) {
      const r = radius + s.radius;
      return center.distanceToSquared(s.center) <= r * r;
    }};

    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if ((c.layers & layerMask) === 0) continue;
      if (c._dirty) c.updateWorldBounds();
      if (testSphere.intersectsSphere(c.worldSphere)) {
        results.push(c);
      }
    }
    return results;
  }

  on(event, cb) {
    this._events.on(event, cb);
    return this;
  }

  off(event, cb) {
    this._events.off(event, cb);
    return this;
  }

  clear() {
    this.colliders.length = 0;
    this._prevPairs.clear();
    this._currPairs.clear();
  }

  dispose() {
    this.clear();
    this._events.clear();
  }
}

export default PhysicsWorld;
