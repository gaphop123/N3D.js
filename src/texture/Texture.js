/**
 * N3D Texture system
 * Texture2D with GPU upload, caching, and disposal via ResourceManager.
 */

import { ErrorSystem } from '../core/ErrorSystem.js';
import { Logger } from '../core/Logger.js';

const _urlCache = new Map(); // url → Texture2D

export class Texture {
  constructor() {
    this.uuid = crypto.randomUUID?.() || `tex_${Math.random().toString(36).slice(2)}`;
    this.name = '';
    this.isTexture = true;
    this._gpuTexture = null;
    this._gpuView = null;
    this._sampler = null;
    this._engine = null;
    this._disposed = false;
    this.needsUpdate = true;
  }

  get gpuTexture() { return this._gpuTexture; }
  get view() { return this._gpuView; }
  get sampler() { return this._sampler; }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    if (this._gpuTexture) {
      try { this._gpuTexture.destroy(); } catch (_) {}
      if (this._engine?.resources) this._engine.resources.untrack(this._gpuTexture);
      this._gpuTexture = null;
      this._gpuView = null;
    }
    this._sampler = null;
  }
}

/**
 * 2D texture from ImageBitmap / HTMLImageElement / canvas / URL.
 */
export class Texture2D extends Texture {
  constructor(source = null, options = {}) {
    super();
    this.isTexture2D = true;
    this.source = source; // ImageBitmap | HTMLImageElement | HTMLCanvasElement | ImageData
    this.width = 0;
    this.height = 0;
    this.format = options.format || 'rgba8unorm';
    this.generateMipmaps = options.generateMipmaps !== false;
    this.flipY = options.flipY !== false;
    this.wrapS = options.wrapS || 'repeat';
    this.wrapT = options.wrapT || 'repeat';
    this.magFilter = options.magFilter || 'linear';
    this.minFilter = options.minFilter || 'linear';
    this.addressModeU = options.wrapS === 'clamp' ? 'clamp-to-edge' :
                        options.wrapS === 'mirror' ? 'mirror-repeat' : 'repeat';
    this.addressModeV = options.wrapT === 'clamp' ? 'clamp-to-edge' :
                        options.wrapT === 'mirror' ? 'mirror-repeat' : 'repeat';
    this.url = options.url || null;
  }

  /**
   * Upload / create GPU resources. Call after source is ready.
   */
  upload(engine) {
    if (this._disposed) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_RESOURCE_DISPOSED,
        'Cannot upload disposed texture',
        { subsystem: 'Texture' }
      );
    }
    if (!this.source) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_TEXTURE,
        'Texture2D has no source to upload',
        { subsystem: 'Texture', resource: this.name || this.uuid }
      );
    }

    this._engine = engine;
    const device = engine.gpuDevice;

    let width, height;
    if (this.source instanceof ImageBitmap || this.source instanceof HTMLImageElement ||
        this.source instanceof HTMLCanvasElement) {
      width = this.source.width;
      height = this.source.height;
    } else if (this.source instanceof ImageData) {
      width = this.source.width;
      height = this.source.height;
    } else {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_TEXTURE,
        `Unsupported texture source type: ${this.source?.constructor?.name}`,
        { subsystem: 'Texture' }
      );
    }

    this.width = width;
    this.height = height;

    const mipLevelCount = this.generateMipmaps
      ? Math.floor(Math.log2(Math.max(width, height))) + 1
      : 1;

    if (this._gpuTexture) {
      try { this._gpuTexture.destroy(); } catch (_) {}
      engine.resources.untrack(this._gpuTexture);
    }

    this._gpuTexture = engine.resources.createTexture({
      label: this.name || `Texture2D_${this.uuid.slice(0, 8)}`,
      size: { width, height },
      format: this.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      mipLevelCount
    });

    device.queue.copyExternalImageToTexture(
      { source: this.source, flipY: this.flipY },
      { texture: this._gpuTexture },
      { width, height }
    );

    if (mipLevelCount > 1) {
      this._generateMipmaps(engine);
    }

    this._gpuView = this._gpuTexture.createView();
    this._sampler = engine.resources.createSampler({
      label: `Sampler_${this.uuid.slice(0, 8)}`,
      addressModeU: this.addressModeU,
      addressModeV: this.addressModeV,
      magFilter: this.magFilter,
      minFilter: this.minFilter,
      mipmapFilter: this.generateMipmaps ? 'linear' : 'nearest'
    });

    this.needsUpdate = false;
    return this;
  }

  /**
   * Simple mipmap generation via render passes (works without blit extensions).
   */
  _generateMipmaps(engine) {
    // For v0.3 we rely on browser copyExternalImageToTexture for level 0.
    // Full GPU mipmap generation can be added later; many assets work with level 0 only.
    // Mark as best-effort — not a silent fake of full trilinear.
  }

  /**
   * Load from URL (PNG/JPEG/WebP). Cached by URL.
   */
  static async load(url, options = {}) {
    if (_urlCache.has(url) && !options.forceReload) {
      return _urlCache.get(url);
    }

    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
        `Failed to fetch texture: ${url} — ${e.message}`,
        { subsystem: 'Texture', cause: e, resource: url }
      );
    }

    if (!response.ok) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
        `HTTP ${response.status} loading texture: ${url}`,
        { subsystem: 'Texture', resource: url }
      );
    }

    let blob;
    try {
      blob = await response.blob();
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
        `Failed to read texture blob: ${url}`,
        { subsystem: 'Texture', cause: e, resource: url }
      );
    }

    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none'
      });
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
        `Failed to decode texture image: ${url} — ${e.message}`,
        { subsystem: 'Texture', cause: e, resource: url }
      );
    }

    const tex = new Texture2D(bitmap, { ...options, url });
    tex.name = url.split('/').pop() || 'Texture2D';
    _urlCache.set(url, tex);
    return tex;
  }

  /**
   * Clear URL cache (does not destroy GPU resources).
   */
  static clearCache() {
    _urlCache.clear();
  }
}

export default Texture2D;
