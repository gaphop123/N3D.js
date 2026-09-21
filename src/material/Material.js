/**
 * N3D Material base
 */

import { ErrorSystem } from '../core/ErrorSystem.js';

export class Material {
  constructor(params = {}) {
    this.uuid = crypto.randomUUID?.() || `mat_${Math.random().toString(36).slice(2)}`;
    this.name = params.name || '';
    this.type = 'Material';

    this.opacity = params.opacity ?? 1;
    this.transparent = params.transparent ?? false;
    this.side = params.side || 'front'; // 'front' | 'back' | 'double'
    this.depthTest = params.depthTest !== false;
    this.depthWrite = params.depthWrite !== false;
    this.colorWrite = params.colorWrite !== false;
    this.blending = params.blending || 'normal';
    this.alphaTest = params.alphaTest ?? 0;

    this.visible = true;
    this.needsUpdate = true;
    this.version = 0;

    this._pipelineCacheKey = null;
    this._disposed = false;
  }

  /**
   * Force pipeline / bind group rebuild.
   */
  markNeedsUpdate() {
    this.needsUpdate = true;
    this.version++;
    this._pipelineCacheKey = null;
  }

  dispose() {
    this._disposed = true;
  }
}

/**
 * Simple Unlit material
 */
export class UnlitMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.type = 'UnlitMaterial';
    this.baseColor = params.baseColor ? [...params.baseColor] : [1, 1, 1, 1];
    if (this.baseColor.length === 3) this.baseColor.push(1);
    this.baseColorMap = params.baseColorMap || null;
  }
}

/**
 * PBR Material (metallic-roughness workflow)
 */
export class PBRMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.type = 'PBRMaterial';

    this.baseColor = params.baseColor ? [...params.baseColor] : [1, 1, 1, 1];
    if (this.baseColor.length === 3) this.baseColor.push(1);

    this.metallic = params.metallic ?? 0;
    this.roughness = params.roughness ?? 0.5;
    this.emissive = params.emissive ? [...params.emissive] : [0, 0, 0];
    this.emissiveIntensity = params.emissiveIntensity ?? 1;

    this.baseColorMap = params.baseColorMap || null;
    this.metallicRoughnessMap = params.metallicRoughnessMap || null;
    this.normalMap = params.normalMap || null;
    this.occlusionMap = params.occlusionMap || null;
    this.emissiveMap = params.emissiveMap || null;

    this.normalScale = params.normalScale ?? 1;
    this.occlusionStrength = params.occlusionStrength ?? 1;

    // Advanced
    this.reflectivity = params.reflectivity ?? 0.5;
    this.ior = params.ior ?? 1.5;
  }
}

/**
 * ShaderMaterial - custom WGSL
 */
export class ShaderMaterial extends Material {
  constructor(params = {}) {
    super(params);
    this.type = 'ShaderMaterial';

    this.vertexShader = params.vertex || params.vertexShader || '';
    this.fragmentShader = params.fragment || params.fragmentShader || '';
    this.uniforms = params.uniforms || {};
    this.defines = params.defines || {};

    if (!this.vertexShader || !this.fragmentShader) {
      ErrorSystem.warn(
        ErrorSystem.ERROR_CODES.N3D_INVALID_MATERIAL,
        'ShaderMaterial created without vertex or fragment shader code.',
        { subsystem: 'Material' }
      );
    }
  }
}

export default Material;
