/**
 * N3D Node
 * Base of the scene graph. Handles hierarchy and transforms.
 */

import { Vector3 } from '../math/Vector3.js';
import { Quaternion } from '../math/Quaternion.js';
import { Matrix4 } from '../math/Matrix4.js';
import { ErrorSystem } from '../core/ErrorSystem.js';

let _nodeId = 1;

export class Node {
  constructor(name = '') {
    this.id = _nodeId++;
    this.name = name || `Node_${this.id}`;
    this.parent = null;
    this.children = [];

    this.position = new Vector3();
    this.rotation = new Quaternion(); // preferred
    this.scale = new Vector3(1, 1, 1);

    this.matrix = new Matrix4();          // local
    this.worldMatrix = new Matrix4();     // world
    this.matrixWorldNeedsUpdate = true;
    this.matrixAutoUpdate = true;

    this.visible = true;
    this.layers = 1; // bitmask
    this.tags = new Set();
    this.userData = {};

    this._disposed = false;
  }

  add(child) {
    if (child === this) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_SCENE,
        'Cannot add a node as a child of itself.',
        { subsystem: 'Scene', node: this.name }
      );
    }
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
    child.matrixWorldNeedsUpdate = true;
    return this;
  }

  remove(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parent = null;
      child.matrixWorldNeedsUpdate = true;
    }
    return this;
  }

  removeFromParent() {
    if (this.parent) {
      this.parent.remove(this);
    }
    return this;
  }

  clear() {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
    return this;
  }

  /**
   * Update local matrix from position/rotation/scale if needed.
   */
  updateMatrix() {
    if (this.matrixAutoUpdate) {
      this.matrix.compose(this.position, this.rotation, this.scale);
    }
    this.matrixWorldNeedsUpdate = true;
  }

  /**
   * Update world matrix, optionally updating parents first.
   * Optimized: only recompute when dirty.
   */
  updateWorldMatrix(updateParents = false, updateChildren = false) {
    if (updateParents && this.parent) {
      this.parent.updateWorldMatrix(true, false);
    }

    if (this.matrixAutoUpdate) {
      this.updateMatrix();
    }

    if (this.matrixWorldNeedsUpdate) {
      if (this.parent) {
        this.worldMatrix.multiplyMatrices(this.parent.worldMatrix, this.matrix);
      } else {
        this.worldMatrix.copy(this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
    }

    if (updateChildren) {
      for (const child of this.children) {
        child.updateWorldMatrix(false, true);
      }
    }
  }

  /**
   * Force update of this node and all descendants.
   */
  updateMatrixWorld(force = false) {
    if (this.matrixAutoUpdate) this.updateMatrix();

    if (this.matrixWorldNeedsUpdate || force) {
      if (this.parent) {
        this.worldMatrix.multiplyMatrices(this.parent.worldMatrix, this.matrix);
      } else {
        this.worldMatrix.copy(this.matrix);
      }
      this.matrixWorldNeedsUpdate = false;
      force = true; // children need update too
    }

    for (const child of this.children) {
      child.updateMatrixWorld(force);
    }
  }

  traverse(callback) {
    callback(this);
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  traverseVisible(callback) {
    if (!this.visible) return;
    callback(this);
    for (const child of this.children) {
      child.traverseVisible(callback);
    }
  }

  getObjectByName(name) {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.getObjectByName(name);
      if (found) return found;
    }
    return null;
  }

  getObjectById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.getObjectById(id);
      if (found) return found;
    }
    return null;
  }

  clone(recursive = true) {
    const node = new this.constructor();
    node.name = this.name + '_clone';
    node.position.copy(this.position);
    node.rotation.copy(this.rotation);
    node.scale.copy(this.scale);
    node.visible = this.visible;
    node.layers = this.layers;
    node.userData = { ...this.userData };
    for (const tag of this.tags) node.tags.add(tag);

    if (recursive) {
      for (const child of this.children) {
        node.add(child.clone(true));
      }
    }
    return node;
  }

  /**
   * Debug validation of transforms.
   */
  validateTransforms() {
    this.position.validate(`${this.name}.position`);
    this.rotation.validate(`${this.name}.rotation`);
    this.scale.validate(`${this.name}.scale`);
    this.matrix.validate(`${this.name}.matrix`);
    this.worldMatrix.validate(`${this.name}.worldMatrix`);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.removeFromParent();
    for (const child of [...this.children]) {
      child.dispose();
    }
    this.children.length = 0;
  }
}

export default Node;
