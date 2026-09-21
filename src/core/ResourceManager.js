/**
 * N3D ResourceManager
 * Tracks all GPU resources for lifetime management and leak detection.
 */

import { ErrorSystem } from './ErrorSystem.js';
import { Logger } from './Logger.js';

let _resourceIdCounter = 1;

export class ResourceManager {
  constructor(engine) {
    this.engine = engine;
    this._resources = new Map(); // id → { type, resource, label, size, createdAt }
    this._byType = {
      buffer: new Set(),
      texture: new Set(),
      sampler: new Set(),
      bindGroup: new Set(),
      bindGroupLayout: new Set(),
      pipeline: new Set(),
      pipelineLayout: new Set(),
      shaderModule: new Set(),
      querySet: new Set(),
      other: new Set()
    };
  }

  /**
   * Register a GPU resource for tracking.
   * @returns {number} resource id
   */
  track(type, resource, label = '', sizeEstimate = 0) {
    if (!resource) return -1;

    const id = _resourceIdCounter++;
    const entry = {
      id,
      type,
      resource,
      label: label || `${type}_${id}`,
      size: sizeEstimate,
      createdAt: performance.now(),
      disposed: false
    };

    this._resources.set(id, entry);

    if (this._byType[type]) {
      this._byType[type].add(id);
    } else {
      this._byType.other.add(id);
    }

    // Attach id to the resource object for reverse lookup (non-enumerable)
    try {
      Object.defineProperty(resource, '__n3dId', {
        value: id,
        writable: false,
        enumerable: false,
        configurable: true
      });
    } catch (_) {
      // Some objects may be frozen
    }

    return id;
  }

  /**
   * Mark resource as disposed and remove from tracking.
   */
  untrack(idOrResource) {
    let id = idOrResource;
    if (typeof idOrResource === 'object' && idOrResource !== null) {
      id = idOrResource.__n3dId;
    }
    if (id == null || !this._resources.has(id)) return;

    const entry = this._resources.get(id);
    entry.disposed = true;
    this._resources.delete(id);

    if (this._byType[entry.type]) {
      this._byType[entry.type].delete(id);
    } else {
      this._byType.other.delete(id);
    }
  }

  /**
   * Create and track a buffer.
   */
  createBuffer(descriptor) {
    if (ErrorSystem.isFailed()) {
      ErrorSystem.fatal(ErrorSystem.ERROR_CODES.N3D_ENGINE_ALREADY_FAILED, 'Cannot create buffer: engine failed', { subsystem: 'ResourceManager' });
    }

    let buffer;
    try {
      buffer = this.engine.gpuDevice.createBuffer(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_BUFFER,
        `Failed to create GPUBuffer: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }

    const size = descriptor.size || 0;
    this.track('buffer', buffer, descriptor.label, size);
    return buffer;
  }

  /**
   * Create and track a texture.
   */
  createTexture(descriptor) {
    if (ErrorSystem.isFailed()) {
      ErrorSystem.fatal(ErrorSystem.ERROR_CODES.N3D_ENGINE_ALREADY_FAILED, 'Cannot create texture: engine failed', { subsystem: 'ResourceManager' });
    }

    let texture;
    try {
      texture = this.engine.gpuDevice.createTexture(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_TEXTURE,
        `Failed to create GPUTexture: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }

    const size = (descriptor.size?.width || 1) * (descriptor.size?.height || 1) * (descriptor.size?.depthOrArrayLayers || 1) * 4; // rough
    this.track('texture', texture, descriptor.label, size);
    return texture;
  }

  createSampler(descriptor = {}) {
    if (ErrorSystem.isFailed()) return null;
    let sampler;
    try {
      sampler = this.engine.gpuDevice.createSampler(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_SAMPLER,
        `Failed to create GPUSampler: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e }
      );
    }
    this.track('sampler', sampler, descriptor.label);
    return sampler;
  }

  createShaderModule(descriptor) {
    if (ErrorSystem.isFailed()) return null;
    let module;
    try {
      module = this.engine.gpuDevice.createShaderModule(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_SHADER_MODULE,
        `Failed to create ShaderModule: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }
    this.track('shaderModule', module, descriptor.label);
    return module;
  }

  createBindGroupLayout(descriptor) {
    if (ErrorSystem.isFailed()) return null;
    let layout;
    try {
      layout = this.engine.gpuDevice.createBindGroupLayout(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_BIND_GROUP,
        `Failed to create BindGroupLayout: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e }
      );
    }
    this.track('bindGroupLayout', layout, descriptor.label);
    return layout;
  }

  createBindGroup(descriptor) {
    if (ErrorSystem.isFailed()) return null;
    let bg;
    try {
      bg = this.engine.gpuDevice.createBindGroup(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_BIND_GROUP,
        `Failed to create BindGroup: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }
    this.track('bindGroup', bg, descriptor.label);
    return bg;
  }

  createRenderPipeline(descriptor) {
    if (ErrorSystem.isFailed()) return null;
    let pipeline;
    try {
      pipeline = this.engine.gpuDevice.createRenderPipeline(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_PIPELINE_CREATION_FAILED,
        `Failed to create RenderPipeline: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }
    this.track('pipeline', pipeline, descriptor.label);
    return pipeline;
  }

  createComputePipeline(descriptor) {
    if (ErrorSystem.isFailed()) return null;
    let pipeline;
    try {
      pipeline = this.engine.gpuDevice.createComputePipeline(descriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_PIPELINE_CREATION_FAILED,
        `Failed to create ComputePipeline: ${e.message}`,
        { subsystem: 'ResourceManager', cause: e, label: descriptor.label }
      );
    }
    this.track('pipeline', pipeline, descriptor.label);
    return pipeline;
  }

  /**
   * Statistics
   */
  getStats() {
    let bufferMemory = 0;
    let textureMemory = 0;
    for (const entry of this._resources.values()) {
      if (entry.type === 'buffer') bufferMemory += entry.size;
      if (entry.type === 'texture') textureMemory += entry.size;
    }
    return {
      total: this._resources.size,
      buffers: this._byType.buffer.size,
      textures: this._byType.texture.size,
      samplers: this._byType.sampler.size,
      bindGroups: this._byType.bindGroup.size,
      pipelines: this._byType.pipeline.size,
      shaderModules: this._byType.shaderModule.size,
      bufferMemory,
      textureMemory
    };
  }

  /**
   * Dispose all tracked resources.
   */
  dispose() {
    // Best-effort destroy
    for (const entry of this._resources.values()) {
      try {
        if (entry.resource && typeof entry.resource.destroy === 'function') {
          entry.resource.destroy();
        }
      } catch (e) {
        Logger.warn(`Error destroying resource ${entry.label}:`, e);
      }
    }
    this._resources.clear();
    for (const set of Object.values(this._byType)) {
      set.clear();
    }
    Logger.info('ResourceManager disposed all resources.');
  }
}

export default ResourceManager;
