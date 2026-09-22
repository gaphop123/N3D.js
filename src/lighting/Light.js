/**
 * N3D Light base classes
 * DirectionalLight is the primary "Sun" light.
 */

import { Object3D } from '../scene/Object3D.js';
import { Color } from '../math/Color.js';
import { Vector3 } from '../math/Vector3.js';

export class Light extends Object3D {
  constructor(color = 0xffffff, intensity = 1) {
    super('Light');
    this.isLight = true;

    this.color = new Color();
    if (typeof color === 'number') {
      this.color.setHex(color);
    } else if (Array.isArray(color)) {
      this.color.set(color[0], color[1], color[2], color[3] ?? 1);
    } else if (color && color.isColor) {
      this.color.copy(color);
    } else {
      this.color.setHex(0xffffff);
    }

    this.intensity = intensity;
    this.castShadow = false;
  }

  /**
   * Returns linear RGB * intensity for GPU upload.
   */
  getColorIntensity(out = new Float32Array(4)) {
    out[0] = this.color.r * this.intensity;
    out[1] = this.color.g * this.intensity;
    out[2] = this.color.b * this.intensity;
    out[3] = 1;
    return out;
  }
}

/**
 * Directional light — infinite parallel rays (Sun).
 * Direction is derived from the light's world orientation (-Z axis).
 */
export class DirectionalLight extends Light {
  /**
   * @param {number|Array|Color} [color=0xffffff]
   * @param {number} [intensity=1]
   */
  constructor(color = 0xffffff, intensity = 1) {
    super(color, intensity);
    this.isDirectionalLight = true;
    this.name = 'DirectionalLight';

    // Target point the light looks at (for convenience)
    this.target = new Object3D();
    this.target.name = 'DirectionalLightTarget';

    // Shadow parameters (structure ready; full shadow map later)
    this.shadow = {
      enabled: false,
      mapSize: 1024,
      bias: 0.005,
      normalBias: 0.0,
      radius: 1.0, // PCF radius
      camera: {
        near: 0.5,
        far: 500,
        left: -50,
        right: 50,
        top: 50,
        bottom: -50
      }
    };

    // Default: light coming from above-right
    this.position.set(5, 10, 7);
  }

  /**
   * Direction the light rays travel (from light toward scene).
   * Computed from position → target, or from orientation.
   */
  getDirection(out = new Vector3()) {
    // Prefer target-based direction
    const tx = this.target.position.x;
    const ty = this.target.position.y;
    const tz = this.target.position.z;
    out.set(
      tx - this.position.x,
      ty - this.position.y,
      tz - this.position.z
    );
    if (out.lengthSq() < 1e-10) {
      // Fallback: -Z of world matrix
      this.updateWorldMatrix(true, false);
      const e = this.worldMatrix.elements;
      out.set(-e[8], -e[9], -e[10]);
    }
    return out.normalize();
  }

  /**
   * Convenience: set as a sun-like light.
   * @param {Object} options
   * @param {number} [options.elevation=45] degrees above horizon
   * @param {number} [options.azimuth=45] degrees around Y
   * @param {number} [options.intensity]
   * @param {number|Array} [options.color]
   */
  static createSun(options = {}) {
    const light = new DirectionalLight(
      options.color ?? 0xfff4e0,
      options.intensity ?? 2.5
    );
    light.name = 'Sun';

    const elev = (options.elevation ?? 45) * (Math.PI / 180);
    const azim = (options.azimuth ?? 45) * (Math.PI / 180);
    const dist = options.distance ?? 50;

    // Position sun on a sphere around origin
    light.position.set(
      dist * Math.cos(elev) * Math.sin(azim),
      dist * Math.sin(elev),
      dist * Math.cos(elev) * Math.cos(azim)
    );
    light.target.position.set(0, 0, 0);

    return light;
  }
}

/**
 * Point light — emits in all directions from a point.
 */
export class PointLight extends Light {
  constructor(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    super(color, intensity);
    this.isPointLight = true;
    this.name = 'PointLight';
    this.distance = distance; // 0 = infinite
    this.decay = decay;
  }
}

/**
 * Ambient light — constant illumination (no direction).
 * Usually added to scene as a simple fill.
 */
export class AmbientLight extends Light {
  constructor(color = 0x404040, intensity = 1) {
    super(color, intensity);
    this.isAmbientLight = true;
    this.name = 'AmbientLight';
  }
}

/**
 * Hemisphere light — sky + ground gradient.
 */
export class HemisphereLight extends Light {
  constructor(skyColor = 0xffffff, groundColor = 0x444444, intensity = 1) {
    super(skyColor, intensity);
    this.isHemisphereLight = true;
    this.name = 'HemisphereLight';
    this.groundColor = new Color();
    if (typeof groundColor === 'number') {
      this.groundColor.setHex(groundColor);
    } else if (Array.isArray(groundColor)) {
      this.groundColor.set(groundColor[0], groundColor[1], groundColor[2]);
    }
  }
}

export default Light;
