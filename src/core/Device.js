/**
 * N3D Device
 * Manages GPUAdapter, GPUDevice, Queue, and capability detection.
 * Strict: any failure is fatal.
 */

import { ErrorSystem } from './ErrorSystem.js';
import { Logger } from './Logger.js';

export class Device {
  constructor() {
    this.adapter = null;
    this.device = null;
    this.queue = null;
    this.capabilities = null;
    this._lost = false;
    this._lostReason = null;
  }

  /**
   * Request adapter and create device.
   * @param {Object} options
   * @param {GPUPowerPreference} [options.powerPreference='high-performance']
   * @param {boolean} [options.forceFallbackAdapter=false]
   * @param {string[]} [options.requiredFeatures=[]]
   * @param {Object} [options.requiredLimits={}]
   */
  async init(options = {}) {
    if (!navigator.gpu) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_NOT_SUPPORTED,
        'WebGPU is not supported in this browser/environment. navigator.gpu is undefined.',
        { subsystem: 'Device' }
      );
    }

    const adapterOptions = {
      powerPreference: options.powerPreference || 'high-performance',
      forceFallbackAdapter: options.forceFallbackAdapter || false
    };

    try {
      this.adapter = await navigator.gpu.requestAdapter(adapterOptions);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_ADAPTER_FAILED,
        `Failed to request GPUAdapter: ${e.message}`,
        { subsystem: 'Device', cause: e }
      );
    }

    if (!this.adapter) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_ADAPTER_FAILED,
        'requestAdapter returned null. No suitable GPU adapter found.',
        { subsystem: 'Device' }
      );
    }

    // Collect capabilities
    this.capabilities = await this._detectCapabilities(this.adapter);

    // Request device with optional features
    const requiredFeatures = options.requiredFeatures || [];
    const availableFeatures = [];
    for (const f of requiredFeatures) {
      if (this.adapter.features.has(f)) {
        availableFeatures.push(f);
      } else {
        Logger.warn(`Requested feature "${f}" is not supported by this adapter.`);
      }
    }

    // Common useful optional features
    const optionalFeatures = [
      'timestamp-query',
      'texture-compression-bc',
      'texture-compression-etc2',
      'texture-compression-astc',
      'depth-clip-control',
      'depth32float-stencil8',
      'indirect-first-instance',
      'shader-f16',
      'rg11b10ufloat-renderable',
      'bgra8unorm-storage',
      'float32-filterable'
    ];

    for (const f of optionalFeatures) {
      if (this.adapter.features.has(f) && !availableFeatures.includes(f)) {
        availableFeatures.push(f);
      }
    }

    const deviceDescriptor = {
      requiredFeatures: availableFeatures,
      requiredLimits: options.requiredLimits || {},
      defaultQueue: { label: 'N3D Default Queue' }
    };

    try {
      this.device = await this.adapter.requestDevice(deviceDescriptor);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_DEVICE_CREATION_FAILED,
        `Failed to create GPUDevice: ${e.message}`,
        { subsystem: 'Device', cause: e }
      );
    }

    this.queue = this.device.queue;

    // Device lost handling - critical
    this.device.lost.then((info) => {
      this._lost = true;
      this._lostReason = info;
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_DEVICE_LOST,
        `GPU device was lost. Reason: ${info.reason || 'unknown'}. Message: ${info.message || 'none'}`,
        {
          subsystem: 'Device',
          reason: info.reason,
          message: info.message,
          resource: 'GPUDevice'
        }
      );
    });

    // Uncaptured error handling
    this.device.addEventListener('uncapturederror', (event) => {
      const error = event.error;
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_STATE,
        `Uncaptured WebGPU error: ${error.message}`,
        {
          subsystem: 'Device',
          cause: error,
          errorType: error.constructor?.name
        }
      );
    });

    Logger.info('GPU Device initialized successfully.', {
      vendor: this.capabilities.adapterInfo?.vendor,
      architecture: this.capabilities.adapterInfo?.architecture,
      features: availableFeatures.length
    });

    return this;
  }

  async _detectCapabilities(adapter) {
    const info = adapter.info || {};
    const limits = adapter.limits;

    const features = [];
    for (const f of adapter.features) {
      features.push(f);
    }

    return {
      webgpu: true,
      adapterInfo: {
        vendor: info.vendor || 'unknown',
        architecture: info.architecture || 'unknown',
        device: info.device || 'unknown',
        description: info.description || 'unknown'
      },
      features,
      limits: {
        maxTextureDimension1D: limits.maxTextureDimension1D,
        maxTextureDimension2D: limits.maxTextureDimension2D,
        maxTextureDimension3D: limits.maxTextureDimension3D,
        maxTextureArrayLayers: limits.maxTextureArrayLayers,
        maxBindGroups: limits.maxBindGroups,
        maxBindGroupsPlusVertexBuffers: limits.maxBindGroupsPlusVertexBuffers,
        maxBindingsPerBindGroup: limits.maxBindingsPerBindGroup,
        maxDynamicUniformBuffersPerPipelineLayout: limits.maxDynamicUniformBuffersPerPipelineLayout,
        maxDynamicStorageBuffersPerPipelineLayout: limits.maxDynamicStorageBuffersPerPipelineLayout,
        maxSampledTexturesPerShaderStage: limits.maxSampledTexturesPerShaderStage,
        maxSamplersPerShaderStage: limits.maxSamplersPerShaderStage,
        maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage,
        maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage,
        maxUniformBuffersPerShaderStage: limits.maxUniformBuffersPerShaderStage,
        maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
        maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
        minUniformBufferOffsetAlignment: limits.minUniformBufferOffsetAlignment,
        minStorageBufferOffsetAlignment: limits.minStorageBufferOffsetAlignment,
        maxVertexBuffers: limits.maxVertexBuffers,
        maxBufferSize: limits.maxBufferSize,
        maxVertexAttributes: limits.maxVertexAttributes,
        maxVertexBufferArrayStride: limits.maxVertexBufferArrayStride,
        maxInterStageShaderVariables: limits.maxInterStageShaderVariables,
        maxColorAttachments: limits.maxColorAttachments,
        maxColorAttachmentBytesPerSample: limits.maxColorAttachmentBytesPerSample,
        maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize,
        maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
        maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
        maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
        maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
        maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension
      },
      // Convenience flags
      hasTimestampQuery: adapter.features.has('timestamp-query'),
      hasBC: adapter.features.has('texture-compression-bc'),
      hasETC2: adapter.features.has('texture-compression-etc2'),
      hasASTC: adapter.features.has('texture-compression-astc'),
      hasShaderF16: adapter.features.has('shader-f16'),
      hasFloat32Filterable: adapter.features.has('float32-filterable'),
      preferredCanvasFormat: navigator.gpu.getPreferredCanvasFormat()
    };
  }

  isLost() {
    return this._lost;
  }

  destroy() {
    if (this.device) {
      this.device.destroy();
      this.device = null;
      this.queue = null;
    }
    this.adapter = null;
  }
}

export default Device;
