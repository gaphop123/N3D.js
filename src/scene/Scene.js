/**
 * N3D Scene
 * Root container for the scene graph. Holds fog, environment, etc.
 */

import { Node } from './Node.js';
import { EventSystem } from '../core/EventSystem.js';

export class Scene extends Node {
  constructor(name = 'Scene') {
    super(name);
    this.isScene = true;

    this.background = null;      // Color or Texture
    this.environment = null;     // CubeTexture / IBL
    this.fog = null;

    this.overrideMaterial = null;

    this._events = new EventSystem();
  }

  add(object) {
    super.add(object);
    this._events.emit('objectAdded', object);
    return this;
  }

  remove(object) {
    super.remove(object);
    this._events.emit('objectRemoved', object);
    return this;
  }

  on(event, cb) {
    this._events.on(event, cb);
    return this;
  }

  off(event, cb) {
    this._events.off(event, cb);
    return this;
  }

  /**
   * Update the entire scene graph world matrices.
   */
  update() {
    this.updateMatrixWorld(true);
  }

  dispose() {
    this.traverse((obj) => {
      if (obj !== this && typeof obj.dispose === 'function') {
        obj.dispose();
      }
    });
    this.clear();
    this._events.clear();
    super.dispose();
  }
}

export default Scene;
