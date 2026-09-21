/**
 * N3D Geometry / BufferGeometry
 * Attribute-based geometry with GPU buffer caching.
 */

import { ErrorSystem } from '../core/ErrorSystem.js';

export class BufferAttribute {
  constructor(array, itemSize, normalized = false) {
    this.array = array; // TypedArray
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.normalized = normalized;
    this.usage = 'static'; // 'static' | 'dynamic' | 'stream'
    this.needsUpdate = true;
    this.version = 0;

    // GPU side
    this._buffer = null; // GPUBuffer
    this._engine = null;
  }

  setUsage(usage) {
    this.usage = usage;
    return this;
  }

  /**
   * Mark that CPU data changed → needs re-upload.
   */
  markNeedsUpdate() {
    this.needsUpdate = true;
    this.version++;
  }
}

export class Geometry {
  constructor() {
    this.uuid = crypto.randomUUID?.() || `geo_${Math.random().toString(36).slice(2)}`;
    this.name = '';
    this.attributes = {};
    this.index = null;
    this.groups = []; // for multi-material
    this.boundingBox = null;
    this.boundingSphere = null;
    this._disposed = false;
  }

  setAttribute(name, attribute) {
    if (!(attribute instanceof BufferAttribute) && attribute.array && attribute.itemSize) {
      // Accept plain objects too
      attribute = new BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized);
    }
    this.attributes[name] = attribute;
    return this;
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  setIndex(index) {
    if (Array.isArray(index) || ArrayBuffer.isView(index)) {
      const array = index instanceof Uint32Array || index instanceof Uint16Array
        ? index
        : new Uint32Array(index);
      this.index = new BufferAttribute(array, 1);
    } else if (index instanceof BufferAttribute) {
      this.index = index;
    } else {
      this.index = null;
    }
    return this;
  }

  /**
   * Ensure GPU buffers exist and are up to date for the given engine.
   * Does not re-upload if data has not changed.
   */
  upload(engine) {
    if (this._disposed) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_RESOURCE_DISPOSED,
        'Cannot upload disposed geometry',
        { subsystem: 'Geometry' }
      );
    }

    const device = engine.gpuDevice;
    const resources = engine.resources;

    for (const [name, attr] of Object.entries(this.attributes)) {
      if (!attr.needsUpdate && attr._buffer) continue;

      const byteLength = attr.array.byteLength;
      // Align to 4 bytes
      const size = Math.ceil(byteLength / 4) * 4;

      if (attr._buffer) {
        // Destroy old if size changed significantly (simple strategy)
        try { attr._buffer.destroy(); } catch (_) {}
        resources.untrack(attr._buffer);
      }

      attr._buffer = resources.createBuffer({
        label: `GeometryAttr_${name}_${this.uuid.slice(0, 8)}`,
        size,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false
      });

      device.queue.writeBuffer(attr._buffer, 0, attr.array);
      attr.needsUpdate = false;
      attr._engine = engine;
    }

    if (this.index) {
      const attr = this.index;
      if (attr.needsUpdate || !attr._buffer) {
        const byteLength = attr.array.byteLength;
        const size = Math.ceil(byteLength / 4) * 4;

        if (attr._buffer) {
          try { attr._buffer.destroy(); } catch (_) {}
          resources.untrack(attr._buffer);
        }

        attr._buffer = resources.createBuffer({
          label: `GeometryIndex_${this.uuid.slice(0, 8)}`,
          size,
          usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
          mappedAtCreation: false
        });

        device.queue.writeBuffer(attr._buffer, 0, attr.array);
        attr.needsUpdate = false;
        attr._engine = engine;
      }
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    for (const attr of Object.values(this.attributes)) {
      if (attr._buffer) {
        try { attr._buffer.destroy(); } catch (_) {}
        if (attr._engine?.resources) attr._engine.resources.untrack(attr._buffer);
        attr._buffer = null;
      }
    }
    if (this.index?._buffer) {
      try { this.index._buffer.destroy(); } catch (_) {}
      if (this.index._engine?.resources) this.index._engine.resources.untrack(this.index._buffer);
      this.index._buffer = null;
    }
    this.attributes = {};
    this.index = null;
  }
}

export default Geometry;
