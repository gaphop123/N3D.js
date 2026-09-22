/**
 * N3D GLTFLoader
 * glTF 2.0 loader (JSON + separate buffers/images, and binary .glb).
 * Supports: meshes, materials (PBR metallic-roughness), textures,
 * node hierarchy, scenes. Animations/skins parsed into data structures
 * when present (playback requires Animation system).
 *
 * API:
 *   const result = await N3D.GLTFLoader.load(url, engine);
 *   scene.add(result.scene);
 */

import { ErrorSystem } from '../core/ErrorSystem.js';
import { Logger } from '../core/Logger.js';
import { Geometry, BufferAttribute } from '../geometry/Geometry.js';
import { Mesh } from '../scene/Mesh.js';
import { Object3D } from '../scene/Object3D.js';
import { Scene } from '../scene/Scene.js';
import { PBRMaterial } from '../material/Material.js';
import { Texture2D } from '../texture/Texture.js';
import { Vector3 } from '../math/Vector3.js';
import { Quaternion } from '../math/Quaternion.js';
import { Matrix4 } from '../math/Matrix4.js';

const COMPONENT_TYPE = {
  5120: { type: Int8Array, size: 1 },
  5121: { type: Uint8Array, size: 1 },
  5122: { type: Int16Array, size: 2 },
  5123: { type: Uint16Array, size: 2 },
  5125: { type: Uint32Array, size: 4 },
  5126: { type: Float32Array, size: 4 }
};

const TYPE_SIZE = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16
};

const ATTR_MAP = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'uv',
  TEXCOORD_1: 'uv1',
  COLOR_0: 'color',
  JOINTS_0: 'skinIndex',
  WEIGHTS_0: 'skinWeight'
};

/**
 * Result of a successful load.
 */
export class GLTFResult {
  constructor() {
    this.scene = null;       // root Object3D / Scene
    this.scenes = [];
    this.meshes = [];
    this.materials = [];
    this.textures = [];
    this.nodes = [];
    this.animations = [];    // raw animation data (clips when Animation system exists)
    this.skins = [];
    this.asset = null;
    this.parser = null;
  }
}

export class GLTFLoader {
  /**
   * @param {Object} [options]
   * @param {boolean} [options.uploadTextures=true] - upload textures to GPU if engine provided
   */
  constructor(options = {}) {
    this.options = {
      uploadTextures: options.uploadTextures !== false
    };
  }

  /**
   * Load a .gltf or .glb from URL.
   * @param {string} url
   * @param {import('../core/Engine.js').Engine} [engine] - optional; used to upload textures
   * @returns {Promise<GLTFResult>}
   */
  async load(url, engine = null) {
    let response;
    try {
      response = await fetch(url);
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
        `Failed to fetch glTF: ${url} — ${e.message}`,
        { subsystem: 'Assets', cause: e, resource: url }
      );
    }
    if (!response.ok) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
        `HTTP ${response.status} loading glTF: ${url}`,
        { subsystem: 'Assets', resource: url }
      );
    }

    const basePath = url.replace(/[^/]*$/, '');
    const isGLB = url.toLowerCase().endsWith('.glb') ||
      (response.headers.get('content-type') || '').includes('model/gltf-binary');

    if (isGLB) {
      const buffer = await response.arrayBuffer();
      return this.parseGLB(buffer, basePath, engine);
    }

    let json;
    try {
      json = await response.json();
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
        `Invalid glTF JSON: ${url} — ${e.message}`,
        { subsystem: 'Assets', cause: e, resource: url }
      );
    }
    return this.parse(json, basePath, null, engine);
  }

  /**
   * Parse binary GLB.
   */
  async parseGLB(arrayBuffer, basePath, engine) {
    const dataView = new DataView(arrayBuffer);
    const magic = dataView.getUint32(0, true);
    if (magic !== 0x46546C67) { // "glTF"
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
        'Invalid GLB magic header',
        { subsystem: 'Assets' }
      );
    }
    const version = dataView.getUint32(4, true);
    if (version !== 2) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_UNSUPPORTED,
        `Unsupported GLB version: ${version} (only 2.0 supported)`,
        { subsystem: 'Assets' }
      );
    }

    let offset = 12;
    let json = null;
    let binaryChunk = null;

    while (offset < arrayBuffer.byteLength) {
      const chunkLength = dataView.getUint32(offset, true);
      const chunkType = dataView.getUint32(offset + 4, true);
      const chunkData = arrayBuffer.slice(offset + 8, offset + 8 + chunkLength);
      offset += 8 + chunkLength;

      if (chunkType === 0x4E4F534A) { // JSON
        const text = new TextDecoder().decode(chunkData);
        try {
          json = JSON.parse(text);
        } catch (e) {
          ErrorSystem.fatal(
            ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
            `Invalid JSON chunk in GLB: ${e.message}`,
            { subsystem: 'Assets', cause: e }
          );
        }
      } else if (chunkType === 0x004E4942) { // BIN
        binaryChunk = chunkData;
      }
    }

    if (!json) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
        'GLB missing JSON chunk',
        { subsystem: 'Assets' }
      );
    }

    return this.parse(json, basePath, binaryChunk, engine);
  }

  /**
   * Parse glTF JSON (+ optional embedded binary).
   */
  async parse(json, basePath, binaryChunk, engine) {
    if (json.asset?.version && !String(json.asset.version).startsWith('2.')) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_UNSUPPORTED,
        `Unsupported glTF version: ${json.asset.version}`,
        { subsystem: 'Assets' }
      );
    }

    const ctx = {
      json,
      basePath,
      binaryChunk,
      engine,
      buffers: [],
      bufferViews: [],
      accessors: [],
      images: [],
      textures: [],
      materials: [],
      meshes: [],
      nodes: [],
      skins: [],
      animations: []
    };

    // 1. Load buffers
    await this._loadBuffers(ctx);

    // 2. Images → Texture2D
    await this._loadImages(ctx);

    // 3. Textures (sampler + source)
    this._loadTextures(ctx);

    // 4. Materials
    this._loadMaterials(ctx);

    // 5. Meshes
    this._loadMeshes(ctx);

    // 6. Nodes + hierarchy
    this._loadNodes(ctx);

    // 7. Skins (data only)
    this._loadSkins(ctx);

    // 8. Animations (data only — playback needs Animation system)
    this._loadAnimations(ctx);

    // 9. Build scene graph
    const result = new GLTFResult();
    result.asset = json.asset || {};
    result.materials = ctx.materials;
    result.textures = ctx.textures;
    result.meshes = ctx.meshes;
    result.nodes = ctx.nodes;
    result.skins = ctx.skins;
    result.animations = ctx.animations;
    result.parser = ctx;

    const sceneIndex = json.scene ?? 0;
    const sceneDef = json.scenes?.[sceneIndex];
    const root = new Object3D();
    root.name = sceneDef?.name || 'GLTFScene';
    root.isGLTFRoot = true;

    if (sceneDef?.nodes) {
      for (const nodeIndex of sceneDef.nodes) {
        const node = ctx.nodes[nodeIndex];
        if (node) root.add(node);
      }
    }

    result.scene = root;
    result.scenes = [root];

    Logger.info(`glTF loaded: ${ctx.meshes.length} meshes, ${ctx.materials.length} materials, ${ctx.textures.length} textures, ${ctx.animations.length} animations`);
    return result;
  }

  async _loadBuffers(ctx) {
    const { json, basePath, binaryChunk } = ctx;
    if (!json.buffers) return;

    for (let i = 0; i < json.buffers.length; i++) {
      const def = json.buffers[i];
      if (def.uri) {
        if (def.uri.startsWith('data:')) {
          const base64 = def.uri.split(',')[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          ctx.buffers[i] = bytes.buffer;
        } else {
          const url = basePath + def.uri;
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            ctx.buffers[i] = await res.arrayBuffer();
          } catch (e) {
            ErrorSystem.fatal(
              ErrorSystem.ERROR_CODES.N3D_ASSET_LOAD_FAILED,
              `Failed to load buffer ${i}: ${url} — ${e.message}`,
              { subsystem: 'Assets', cause: e, resource: url }
            );
          }
        }
      } else if (binaryChunk) {
        ctx.buffers[i] = binaryChunk;
      } else {
        ErrorSystem.fatal(
          ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
          `Buffer ${i} has no URI and no GLB binary chunk`,
          { subsystem: 'Assets' }
        );
      }
    }
  }

  async _loadImages(ctx) {
    const { json, basePath, engine } = ctx;
    if (!json.images) return;

    for (let i = 0; i < json.images.length; i++) {
      const def = json.images[i];
      let bitmap = null;

      try {
        if (def.uri) {
          if (def.uri.startsWith('data:')) {
            const res = await fetch(def.uri);
            const blob = await res.blob();
            bitmap = await createImageBitmap(blob);
          } else {
            const url = basePath + def.uri;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            bitmap = await createImageBitmap(blob, {
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'none'
            });
          }
        } else if (def.bufferView !== undefined) {
          const bv = json.bufferViews[def.bufferView];
          const buffer = ctx.buffers[bv.buffer];
          const offset = bv.byteOffset || 0;
          const length = bv.byteLength;
          const slice = buffer.slice(offset, offset + length);
          const mime = def.mimeType || 'image/png';
          const blob = new Blob([slice], { type: mime });
          bitmap = await createImageBitmap(blob);
        }
      } catch (e) {
        ErrorSystem.fatal(
          ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
          `Failed to decode image ${i}: ${e.message}`,
          { subsystem: 'Assets', cause: e }
        );
      }

      if (bitmap) {
        const tex = new Texture2D(bitmap, { flipY: false });
        tex.name = def.name || `Image_${i}`;
        if (engine && this.options.uploadTextures) {
          tex.upload(engine);
        }
        ctx.images[i] = tex;
      }
    }
  }

  _loadTextures(ctx) {
    const { json } = ctx;
    if (!json.textures) return;

    for (let i = 0; i < json.textures.length; i++) {
      const def = json.textures[i];
      const sourceIndex = def.source ?? def.source === 0 ? def.source : (def.extensions?.EXT_texture_webp?.source);
      const image = ctx.images[sourceIndex];
      if (image) {
        // Sampler settings
        if (def.sampler !== undefined && json.samplers) {
          const samp = json.samplers[def.sampler];
          if (samp) {
            const wrapMap = { 33071: 'clamp', 33648: 'mirror', 10497: 'repeat' };
            image.wrapS = wrapMap[samp.wrapS] || 'repeat';
            image.wrapT = wrapMap[samp.wrapT] || 'repeat';
            image.addressModeU = image.wrapS === 'clamp' ? 'clamp-to-edge' :
              image.wrapS === 'mirror' ? 'mirror-repeat' : 'repeat';
            image.addressModeV = image.wrapT === 'clamp' ? 'clamp-to-edge' :
              image.wrapT === 'mirror' ? 'mirror-repeat' : 'repeat';
          }
        }
        ctx.textures[i] = image;
      }
    }
  }

  _loadMaterials(ctx) {
    const { json } = ctx;
    if (!json.materials) {
      ctx.materials.push(new PBRMaterial({ baseColor: [0.8, 0.8, 0.8] }));
      return;
    }

    for (let i = 0; i < json.materials.length; i++) {
      const def = json.materials[i];
      const pbr = def.pbrMetallicRoughness || {};
      const baseColorFactor = pbr.baseColorFactor || [1, 1, 1, 1];
      const mat = new PBRMaterial({
        name: def.name || `Material_${i}`,
        baseColor: baseColorFactor.slice(0, 4),
        metallic: pbr.metallicFactor ?? 1,
        roughness: pbr.roughnessFactor ?? 1,
        emissive: def.emissiveFactor || [0, 0, 0]
      });

      if (pbr.baseColorTexture !== undefined) {
        mat.baseColorMap = ctx.textures[pbr.baseColorTexture.index] || null;
      }
      if (pbr.metallicRoughnessTexture !== undefined) {
        mat.metallicRoughnessMap = ctx.textures[pbr.metallicRoughnessTexture.index] || null;
      }
      if (def.normalTexture !== undefined) {
        mat.normalMap = ctx.textures[def.normalTexture.index] || null;
        mat.normalScale = def.normalTexture.scale ?? 1;
      }
      if (def.occlusionTexture !== undefined) {
        mat.occlusionMap = ctx.textures[def.occlusionTexture.index] || null;
        mat.occlusionStrength = def.occlusionTexture.strength ?? 1;
      }
      if (def.emissiveTexture !== undefined) {
        mat.emissiveMap = ctx.textures[def.emissiveTexture.index] || null;
      }

      if (def.alphaMode === 'BLEND') {
        mat.transparent = true;
        mat.depthWrite = false;
      } else if (def.alphaMode === 'MASK') {
        mat.alphaTest = def.alphaCutoff ?? 0.5;
      }
      if (def.doubleSided) {
        mat.side = 'double';
      }

      ctx.materials[i] = mat;
    }
  }

  _getAccessorData(ctx, accessorIndex) {
    const { json } = ctx;
    const accessor = json.accessors[accessorIndex];
    if (!accessor) return null;

    const itemSize = TYPE_SIZE[accessor.type];
    const comp = COMPONENT_TYPE[accessor.componentType];
    if (!comp || !itemSize) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_ASSET_CORRUPTION,
        `Unsupported accessor componentType/type: ${accessor.componentType}/${accessor.type}`,
        { subsystem: 'Assets' }
      );
    }

    let array;
    if (accessor.bufferView !== undefined) {
      const bv = json.bufferViews[accessor.bufferView];
      const buffer = ctx.buffers[bv.buffer];
      const byteOffset = (bv.byteOffset || 0) + (accessor.byteOffset || 0);
      const byteStride = bv.byteStride || (comp.size * itemSize);
      const count = accessor.count;

      if (byteStride === comp.size * itemSize) {
        array = new comp.type(buffer, byteOffset, count * itemSize);
      } else {
        // Interleaved — deinterleave
        array = new comp.type(count * itemSize);
        const src = new DataView(buffer, byteOffset);
        for (let i = 0; i < count; i++) {
          for (let j = 0; j < itemSize; j++) {
            const offset = i * byteStride + j * comp.size;
            let value;
            switch (accessor.componentType) {
              case 5120: value = src.getInt8(offset); break;
              case 5121: value = src.getUint8(offset); break;
              case 5122: value = src.getInt16(offset, true); break;
              case 5123: value = src.getUint16(offset, true); break;
              case 5125: value = src.getUint32(offset, true); break;
              case 5126: value = src.getFloat32(offset, true); break;
              default: value = 0;
            }
            array[i * itemSize + j] = value;
          }
        }
      }
    } else {
      array = new comp.type(accessor.count * itemSize);
    }

    // Normalized integer attributes
    if (accessor.normalized && !(array instanceof Float32Array)) {
      const out = new Float32Array(array.length);
      const max = array instanceof Int8Array ? 127 :
                  array instanceof Uint8Array ? 255 :
                  array instanceof Int16Array ? 32767 : 65535;
      for (let i = 0; i < array.length; i++) out[i] = array[i] / max;
      array = out;
    }

    return { array, itemSize, count: accessor.count, accessor };
  }

  _loadMeshes(ctx) {
    const { json } = ctx;
    if (!json.meshes) return;

    for (let i = 0; i < json.meshes.length; i++) {
      const def = json.meshes[i];
      const primitives = [];

      for (let p = 0; p < def.primitives.length; p++) {
        const prim = def.primitives[p];
        const geometry = new Geometry();
        geometry.name = `${def.name || 'Mesh'}_${i}_${p}`;

        for (const [gltfAttr, accessorIndex] of Object.entries(prim.attributes)) {
          const name = ATTR_MAP[gltfAttr] || gltfAttr.toLowerCase();
          const data = this._getAccessorData(ctx, accessorIndex);
          if (data) {
            geometry.setAttribute(name, new BufferAttribute(data.array, data.itemSize));
          }
        }

        if (prim.indices !== undefined) {
          const data = this._getAccessorData(ctx, prim.indices);
          if (data) {
            // Prefer Uint16/Uint32 for index buffer
            let indexArray = data.array;
            if (!(indexArray instanceof Uint16Array) && !(indexArray instanceof Uint32Array)) {
              const maxIndex = Math.max(...indexArray);
              indexArray = maxIndex > 65535
                ? new Uint32Array(indexArray)
                : new Uint16Array(indexArray);
            }
            geometry.setIndex(indexArray);
          }
        }

        // Generate normals if missing
        if (!geometry.getAttribute('normal') && geometry.getAttribute('position')) {
          this._computeVertexNormals(geometry);
        }

        const materialIndex = prim.material ?? 0;
        const material = ctx.materials[materialIndex] || new PBRMaterial();

        primitives.push({ geometry, material, mode: prim.mode ?? 4 });
      }

      ctx.meshes[i] = {
        name: def.name || `Mesh_${i}`,
        primitives
      };
    }
  }

  _computeVertexNormals(geometry) {
    const pos = geometry.getAttribute('position');
    if (!pos) return;
    const positions = pos.array;
    const normals = new Float32Array(positions.length);

    const index = geometry.index;
    const indices = index ? index.array : null;
    const triCount = indices ? indices.length / 3 : positions.length / 9;

    const cb = new Vector3(), ab = new Vector3();
    for (let i = 0; i < triCount; i++) {
      let ia, ib, ic;
      if (indices) {
        ia = indices[i * 3];
        ib = indices[i * 3 + 1];
        ic = indices[i * 3 + 2];
      } else {
        ia = i * 3;
        ib = i * 3 + 1;
        ic = i * 3 + 2;
      }
      const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
      const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
      const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];

      cb.set(cx - bx, cy - by, cz - bz);
      ab.set(ax - bx, ay - by, az - bz);
      cb.cross(ab).normalize();

      normals[ia * 3] += cb.x; normals[ia * 3 + 1] += cb.y; normals[ia * 3 + 2] += cb.z;
      normals[ib * 3] += cb.x; normals[ib * 3 + 1] += cb.y; normals[ib * 3 + 2] += cb.z;
      normals[ic * 3] += cb.x; normals[ic * 3 + 1] += cb.y; normals[ic * 3 + 2] += cb.z;
    }

    // Normalize
    for (let i = 0; i < normals.length; i += 3) {
      const x = normals[i], y = normals[i + 1], z = normals[i + 2];
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      normals[i] = x / len;
      normals[i + 1] = y / len;
      normals[i + 2] = z / len;
    }

    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  }

  _loadNodes(ctx) {
    const { json } = ctx;
    if (!json.nodes) return;

    // First pass: create nodes
    for (let i = 0; i < json.nodes.length; i++) {
      const def = json.nodes[i];
      let node;

      if (def.mesh !== undefined) {
        const meshDef = ctx.meshes[def.mesh];
        if (meshDef && meshDef.primitives.length === 1) {
          node = new Mesh(meshDef.primitives[0].geometry, meshDef.primitives[0].material);
          node.name = def.name || meshDef.name;
        } else if (meshDef) {
          // Multi-primitive: group
          node = new Object3D();
          node.name = def.name || meshDef.name;
          for (const prim of meshDef.primitives) {
            const m = new Mesh(prim.geometry, prim.material);
            node.add(m);
          }
        } else {
          node = new Object3D();
          node.name = def.name || `Node_${i}`;
        }
      } else {
        node = new Object3D();
        node.name = def.name || `Node_${i}`;
      }

      // Transform
      if (def.matrix) {
        const m = new Matrix4();
        m.elements.set(def.matrix);
        // Decompose would be ideal; for now set matrix and disable auto update
        node.matrix.copy(m);
        node.matrixAutoUpdate = false;
        // Extract position roughly
        node.position.set(def.matrix[12], def.matrix[13], def.matrix[14]);
      } else {
        if (def.translation) {
          node.position.set(def.translation[0], def.translation[1], def.translation[2]);
        }
        if (def.rotation) {
          node.rotation.set(def.rotation[0], def.rotation[1], def.rotation[2], def.rotation[3]);
        }
        if (def.scale) {
          node.scale.set(def.scale[0], def.scale[1], def.scale[2]);
        }
      }

      if (def.skin !== undefined) {
        node.skinIndex = def.skin;
      }

      node.userData.gltfIndex = i;
      ctx.nodes[i] = node;
    }

    // Second pass: hierarchy
    for (let i = 0; i < json.nodes.length; i++) {
      const def = json.nodes[i];
      const node = ctx.nodes[i];
      if (def.children) {
        for (const childIndex of def.children) {
          const child = ctx.nodes[childIndex];
          if (child) node.add(child);
        }
      }
    }
  }

  _loadSkins(ctx) {
    const { json } = ctx;
    if (!json.skins) return;

    for (let i = 0; i < json.skins.length; i++) {
      const def = json.skins[i];
      const skin = {
        name: def.name || `Skin_${i}`,
        joints: def.joints || [],
        inverseBindMatrices: null,
        skeleton: def.skeleton
      };

      if (def.inverseBindMatrices !== undefined) {
        const data = this._getAccessorData(ctx, def.inverseBindMatrices);
        if (data) {
          skin.inverseBindMatrices = data.array; // Float32Array of mat4s
        }
      }

      ctx.skins[i] = skin;
    }
  }

  _loadAnimations(ctx) {
    const { json } = ctx;
    if (!json.animations) return;

    for (let i = 0; i < json.animations.length; i++) {
      const def = json.animations[i];
      const channels = [];
      const samplers = [];

      for (const s of (def.samplers || [])) {
        const input = this._getAccessorData(ctx, s.input);
        const output = this._getAccessorData(ctx, s.output);
        samplers.push({
          input: input?.array || null,
          output: output?.array || null,
          interpolation: s.interpolation || 'LINEAR'
        });
      }

      for (const ch of (def.channels || [])) {
        channels.push({
          sampler: ch.sampler,
          targetNode: ch.target?.node,
          path: ch.target?.path // translation | rotation | scale | weights
        });
      }

      ctx.animations[i] = {
        name: def.name || `Animation_${i}`,
        channels,
        samplers
      };
    }
  }

  /**
   * Static convenience.
   */
  static async load(url, engine = null, options = {}) {
    const loader = new GLTFLoader(options);
    return loader.load(url, engine);
  }
}

export default GLTFLoader;
