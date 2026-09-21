/**
 * N3D Engine
 * Central entry point. Manages Device, Context, ResourceManager, Game Loop, Input, etc.
 * Strict lifecycle and error handling.
 */

import { Device } from './Device.js';
import { ErrorSystem } from './ErrorSystem.js';
import { Logger } from './Logger.js';
import { ResourceManager } from './ResourceManager.js';
import { EventSystem } from './EventSystem.js';

export class Engine {
  /**
   * Create and initialize the engine.
   * @param {Object} options
   * @param {HTMLCanvasElement} options.canvas - Required
   * @param {boolean} [options.antialias=true]
   * @param {string} [options.powerPreference='high-performance']
   * @param {boolean} [options.debug=false]
   * @param {number} [options.maxPixelRatio=2]
   * @param {string} [options.alphaMode='opaque']
   */
  static async create(options = {}) {
    if (!options.canvas) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_STATE,
        'Engine.create requires a canvas element in options.canvas',
        { subsystem: 'Engine' }
      );
    }

    const engine = new Engine(options);
    await engine._init();
    return engine;
  }

  constructor(options) {
    this.options = {
      antialias: options.antialias !== false,
      powerPreference: options.powerPreference || 'high-performance',
      debug: !!options.debug,
      maxPixelRatio: options.maxPixelRatio ?? 2,
      alphaMode: options.alphaMode || 'opaque',
      ...options
    };

    this.canvas = options.canvas;
    this.device = null;           // Device wrapper
    this.gpuDevice = null;        // raw GPUDevice
    this.queue = null;
    this.context = null;          // GPUCanvasContext
    this.capabilities = null;
    this.resources = null;
    this.events = new EventSystem();

    this._running = false;
    this._paused = false;
    this._rafId = null;
    this._lastTime = 0;
    this._frame = 0;
    this._delta = 0;
    this._elapsed = 0;
    this._fixedTimestep = 1 / 60;
    this._accumulator = 0;

    this.stats = {
      fps: 0,
      frameTime: 0,
      cpuTime: 0,
      gpuTime: 0,
      drawCalls: 0,
      triangles: 0,
      textureMemory: 0,
      bufferMemory: 0
    };

    this._fpsFrames = 0;
    this._fpsLastTime = 0;

    // Placeholders for systems (filled during init / later)
    this.renderer = null;
    this.input = null;
    this.assets = null;
    this.physics = null;
    this.debug = null;

    // Internal flags
    this._disposed = false;
  }

  async _init() {
    Logger.setLevel(this.options.debug ? 'DEBUG' : 'INFO');
    Logger.info('Initializing N3D Engine...', { debug: this.options.debug });

    // 1. Device
    this.device = new Device();
    await this.device.init({
      powerPreference: this.options.powerPreference
    });

    this.gpuDevice = this.device.device;
    this.queue = this.device.queue;
    this.capabilities = this.device.capabilities;

    // 2. Canvas context
    this.context = this.canvas.getContext('webgpu');
    if (!this.context) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_GPU_CONTEXT_FAILED,
        'Failed to get WebGPU context from canvas. getContext("webgpu") returned null.',
        { subsystem: 'Engine' }
      );
    }

    const presentationFormat = this.capabilities.preferredCanvasFormat;
    this.context.configure({
      device: this.gpuDevice,
      format: presentationFormat,
      alphaMode: this.options.alphaMode,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    // 3. Resource Manager
    this.resources = new ResourceManager(this);

    // 4. Resize handling
    this._setupResize();

    // Initial size
    this.resize();

    // Fatal error → stop loop
    ErrorSystem.onFatal(() => {
      this._stopInternal('Fatal error');
    });

    Logger.info('N3D Engine initialized.', {
      format: presentationFormat,
      maxTextureDim2D: this.capabilities.limits.maxTextureDimension2D
    });

    this.events.emit('initialized', this);
  }

  _setupResize() {
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this._resizeObserver.observe(this.canvas);
    }

    // Also listen to window resize as fallback
    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
  }

  /**
   * Update canvas size, DPR, viewport.
   */
  resize() {
    if (this._disposed || ErrorSystem.isFailed()) return;

    const dpr = Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio);
    const width = Math.floor(this.canvas.clientWidth * dpr);
    const height = Math.floor(this.canvas.clientHeight * dpr);

    if (width === 0 || height === 0) return;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;

      // Reconfigure context if needed (some implementations require it)
      // Usually not necessary after initial configure, but safe for size changes.

      this.events.emit('resize', {
        width,
        height,
        pixelRatio: dpr
      });
    }
  }

  /**
   * Start the main game / render loop.
   */
  start() {
    if (this._disposed) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_STATE,
        'Cannot start a disposed engine.',
        { subsystem: 'Engine' }
      );
    }
    if (ErrorSystem.isFailed()) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ENGINE_ALREADY_FAILED,
        'Cannot start engine that is in failed state.',
        { subsystem: 'Engine' }
      );
    }
    if (this._running) return;

    this._running = true;
    this._paused = false;
    this._lastTime = performance.now();
    this._fpsLastTime = this._lastTime;
    this._frame = 0;

    Logger.info('Engine started.');
    this.events.emit('start');

    const loop = (now) => {
      if (!this._running || ErrorSystem.isFailed()) return;

      this._rafId = requestAnimationFrame(loop);

      if (this._paused) {
        this._lastTime = now;
        return;
      }

      const deltaMs = now - this._lastTime;
      this._lastTime = now;
      this._delta = Math.min(deltaMs / 1000, 0.1); // clamp large spikes
      this._elapsed += this._delta;
      this._frame++;

      // FPS calculation
      this._fpsFrames++;
      if (now - this._fpsLastTime >= 1000) {
        this.stats.fps = Math.round((this._fpsFrames * 1000) / (now - this._fpsLastTime));
        this._fpsFrames = 0;
        this._fpsLastTime = now;
      }
      this.stats.frameTime = deltaMs;

      try {
        this._tick(this._delta, this._elapsed, this._frame);
      } catch (e) {
        // ErrorSystem.fatal already throws; any other unexpected error also stops us
        if (!ErrorSystem.isFailed()) {
          ErrorSystem.fatal(
            ErrorSystem.ERROR_CODES.N3D_UNKNOWN,
            `Unhandled exception in engine tick: ${e.message}`,
            { subsystem: 'Engine', cause: e, frame: this._frame }
          );
        }
      }
    };

    this._rafId = requestAnimationFrame(loop);
  }

  /**
   * Internal tick. Override / extend via events or custom systems.
   * Order:
   *   Input → Fixed Update → Animation → Scene Update → Culling → Render → Post → Present
   */
  _tick(delta, elapsed, frame) {
    // Input update would go here
    this.events.emit('beforeUpdate', { delta, elapsed, frame });

    // Fixed timestep accumulator (for physics etc.)
    this._accumulator += delta;
    while (this._accumulator >= this._fixedTimestep) {
      this.events.emit('fixedUpdate', { timestep: this._fixedTimestep, frame });
      this._accumulator -= this._fixedTimestep;
    }

    this.events.emit('update', { delta, elapsed, frame });

    // Render (if renderer is attached)
    if (this.renderer) {
      this.events.emit('beforeRender', { delta, frame });
      this.renderer.render(); // Renderer decides scene/camera
      this.events.emit('afterRender', { delta, frame });
    }

    this.events.emit('afterUpdate', { delta, elapsed, frame });
  }

  pause() {
    this._paused = true;
    this.events.emit('pause');
  }

  resume() {
    if (ErrorSystem.isFailed()) return;
    this._paused = false;
    this._lastTime = performance.now();
    this.events.emit('resume');
  }

  stop() {
    this._stopInternal('User requested stop');
  }

  _stopInternal(reason) {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    Logger.info(`Engine stopped. Reason: ${reason}`);
    this.events.emit('stop', { reason });
  }

  /**
   * Explicit recovery API. Does NOT happen automatically.
   * Developer must call this after handling device-lost etc.
   */
  async recover() {
    if (!ErrorSystem.isFailed()) {
      Logger.warn('recover() called but engine is not in failed state.');
      return;
    }

    Logger.info('Attempting engine recovery...');
    // Full recovery is complex; for now we only reset the flag and require re-init.
    // Real recovery would re-create device, re-upload all resources, etc.
    ErrorSystem._resetForRecovery();
    this._running = false;

    // Re-init device
    this.device.destroy();
    this.device = new Device();
    await this.device.init({ powerPreference: this.options.powerPreference });
    this.gpuDevice = this.device.device;
    this.queue = this.device.queue;
    this.capabilities = this.device.capabilities;

    // Reconfigure context
    this.context.configure({
      device: this.gpuDevice,
      format: this.capabilities.preferredCanvasFormat,
      alphaMode: this.options.alphaMode,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });

    // Resources must be recreated by the application
    Logger.warn('Recovery completed for device. Application must re-create all GPU resources and scene.');
    this.events.emit('recovered');
  }

  get frame() {
    return this._frame;
  }

  get delta() {
    return this._delta;
  }

  get elapsed() {
    return this._elapsed;
  }

  get isRunning() {
    return this._running && !this._paused;
  }

  /**
   * Dispose everything. Engine becomes unusable.
   */
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    this._stopInternal('Dispose');

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    window.removeEventListener('resize', this._onWindowResize);

    if (this.renderer) {
      this.renderer.dispose?.();
      this.renderer = null;
    }

    if (this.resources) {
      this.resources.dispose();
      this.resources = null;
    }

    if (this.context) {
      // Context is owned by canvas; just null it
      this.context = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.gpuDevice = null;
    this.queue = null;

    this.events.emit('dispose');
    this.events.clear();

    Logger.info('Engine disposed.');
  }
}

export default Engine;
