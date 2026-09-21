/**
 * N3D EventSystem
 * Lightweight event dispatcher.
 */

export class EventSystem {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback, context = null) {
    if (typeof callback !== 'function') return this;
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push({ callback, context });
    return this;
  }

  once(event, callback, context = null) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback.apply(context, args);
    };
    return this.on(event, wrapper, context);
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return this;
    if (!callback) {
      this._listeners.delete(event);
      return this;
    }
    const list = this._listeners.get(event);
    const idx = list.findIndex(l => l.callback === callback);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) this._listeners.delete(event);
    return this;
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list || list.length === 0) return this;
    // Copy to allow removal during emit
    const snapshot = list.slice();
    for (const { callback, context } of snapshot) {
      callback.apply(context, args);
    }
    return this;
  }

  clear() {
    this._listeners.clear();
  }

  listenerCount(event) {
    return this._listeners.has(event) ? this._listeners.get(event).length : 0;
  }
}

export default EventSystem;
