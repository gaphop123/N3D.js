/**
 * N3D Color
 * RGB color with optional alpha. Values in 0..1 range.
 */

import { ErrorSystem } from '../core/ErrorSystem.js';

export class Color {
  constructor(r = 1, g = 1, b = 1, a = 1) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  set(r, g, b, a = this.a) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
    return this;
  }

  setHex(hex) {
    hex = Math.floor(hex);
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }

  setRGB(r, g, b) {
    this.r = r;
    this.g = g;
    this.b = b;
    return this;
  }

  setHSL(h, s, l) {
    // h in 0..1, s/l in 0..1
    if (s === 0) {
      this.r = this.g = this.b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      this.r = hue2rgb(p, q, h + 1 / 3);
      this.g = hue2rgb(p, q, h);
      this.b = hue2rgb(p, q, h - 1 / 3);
    }
    return this;
  }

  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    this.a = c.a;
    return this;
  }

  clone() {
    return new Color(this.r, this.g, this.b, this.a);
  }

  multiplyScalar(s) {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }

  lerp(c, t) {
    this.r += (c.r - this.r) * t;
    this.g += (c.g - this.g) * t;
    this.b += (c.b - this.b) * t;
    this.a += (c.a - this.a) * t;
    return this;
  }

  toArray(arr = [], offset = 0) {
    arr[offset] = this.r;
    arr[offset + 1] = this.g;
    arr[offset + 2] = this.b;
    arr[offset + 3] = this.a;
    return arr;
  }

  fromArray(arr, offset = 0) {
    this.r = arr[offset];
    this.g = arr[offset + 1];
    this.b = arr[offset + 2];
    if (arr[offset + 3] !== undefined) this.a = arr[offset + 3];
    return this;
  }

  validate(name = 'Color') {
    ErrorSystem.assertFinite(this.r, `${name}.r`);
    ErrorSystem.assertFinite(this.g, `${name}.g`);
    ErrorSystem.assertFinite(this.b, `${name}.b`);
    ErrorSystem.assertFinite(this.a, `${name}.a`);
    return this;
  }
}

export default Color;
