/**
 * N3D Renderer (Forward)
 * Real WebGPU forward renderer with directional light (sun) support,
 * material colors, and ambient term.
 * Focus: correctness, clear error paths, no silent failures.
 */

import { ErrorSystem } from '../core/ErrorSystem.js';
import { Logger } from '../core/Logger.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Vector3 } from '../math/Vector3.js';

const _tempMatrix = new Matrix4();
const _lightDir = new Vector3();
const _lightColor = new Float32Array(4);
const _ambientColor = new Float32Array(4);

export class Renderer {
  constructor(engine) {
    this.engine = engine;
    this.device = engine.gpuDevice;
    this.queue = engine.queue;
    this.context = engine.context;
    this.resources = engine.resources;

    this._scene = null;
    this._camera = null;

    this.clearColor = { r: 0.08, g: 0.09, b: 0.12, a: 1 };

    this._depthTexture = null;
    this._depthTextureView = null;
    this._size = { width: 0, height: 0 };

    this._pipelineCache = new Map();
    this.sampleCount = 1;

    // Uniform buffers
    // Frame: viewProj(64) + cameraPos(16) + lightDir(16) + lightColor(16) + ambient(16) = 128 → 256
    this._frameUniformsBuffer = null;
    // Object: model(64) + baseColor(16) + materialParams(16) = 96 → 256
    this._objectUniformsBuffer = null;

    this._frameData = new Float32Array(64); // 256 bytes
    this._objectData = new Float32Array(64);

    // Default lighting when no lights in scene
    this.defaultSunDirection = new Vector3(-0.4, -0.8, -0.3).normalize();
    this.defaultSunColor = [1.0, 0.96, 0.9];
    this.defaultSunIntensity = 2.0;
    this.defaultAmbient = [0.12, 0.14, 0.18];

    this._initBuffers();
    this._onResize = (e) => this._handleResize(e);
    engine.events.on('resize', this._onResize);

    this._handleResize({
      width: engine.canvas.width,
      height: engine.canvas.height
    });
  }

  _initBuffers() {
    this._frameUniformsBuffer = this.resources.createBuffer({
      label: 'FrameUniforms',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this._objectUniformsBuffer = this.resources.createBuffer({
      label: 'ObjectUniforms',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  _handleResize({ width, height }) {
    if (width === 0 || height === 0) return;
    if (this._size.width === width && this._size.height === height) return;

    this._size.width = width;
    this._size.height = height;

    if (this._depthTexture) {
      try { this._depthTexture.destroy(); } catch (_) {}
      this.resources.untrack(this._depthTexture);
    }

    this._depthTexture = this.resources.createTexture({
      label: 'DepthTexture',
      size: { width, height },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this._depthTextureView = this._depthTexture.createView();
  }

  setScene(scene, camera) {
    this._scene = scene;
    this._camera = camera;
  }

  /**
   * Collect lights from scene (first directional = sun, ambient lights summed).
   */
  _collectLights(scene) {
    let sun = null;
    let ambientR = this.defaultAmbient[0];
    let ambientG = this.defaultAmbient[1];
    let ambientB = this.defaultAmbient[2];

    scene.traverseVisible((obj) => {
      if (obj.isDirectionalLight && !sun) {
        sun = obj;
      }
      if (obj.isAmbientLight) {
        ambientR += obj.color.r * obj.intensity;
        ambientG += obj.color.g * obj.intensity;
        ambientB += obj.color.b * obj.intensity;
      }
      if (obj.isHemisphereLight) {
        // Approximate as ambient average of sky + ground
        ambientR += (obj.color.r + obj.groundColor.r) * 0.5 * obj.intensity;
        ambientG += (obj.color.g + obj.groundColor.g) * 0.5 * obj.intensity;
        ambientB += (obj.color.b + obj.groundColor.b) * 0.5 * obj.intensity;
      }
    });

    if (sun) {
      sun.getDirection(_lightDir);
      // Light direction in shader = direction rays travel (from sun toward scene)
      // getDirection already returns that.
      const c = sun.getColorIntensity(_lightColor);
      _lightColor[0] = c[0];
      _lightColor[1] = c[1];
      _lightColor[2] = c[2];
    } else {
      _lightDir.copy(this.defaultSunDirection);
      _lightColor[0] = this.defaultSunColor[0] * this.defaultSunIntensity;
      _lightColor[1] = this.defaultSunColor[1] * this.defaultSunIntensity;
      _lightColor[2] = this.defaultSunColor[2] * this.defaultSunIntensity;
    }

    _ambientColor[0] = ambientR;
    _ambientColor[1] = ambientG;
    _ambientColor[2] = ambientB;
    _ambientColor[3] = 1;
  }

  render(scene = this._scene, camera = this._camera) {
    if (ErrorSystem.isFailed()) return;
    if (!scene || !camera) return;

    if (!this._depthTextureView) {
      this._handleResize({
        width: this.engine.canvas.width,
        height: this.engine.canvas.height
      });
    }

    camera.updateMatrixWorld();
    if (camera.isPerspectiveCamera) {
      const aspect = this._size.width / Math.max(this._size.height, 1);
      if (Math.abs(camera.aspect - aspect) > 1e-6) {
        camera.setAspect(aspect);
      }
    }

    scene.update();
    this._collectLights(scene);

    // View-projection
    const viewProj = _tempMatrix;
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // Pack frame uniforms
    // offset 0:  viewProj mat4 (16 floats)
    // offset 16: cameraPos vec3 + pad
    // offset 20: lightDir vec3 + pad
    // offset 24: lightColor vec3 + pad
    // offset 28: ambient vec3 + pad
    const fd = this._frameData;
    fd.set(viewProj.elements, 0);
    fd[16] = camera.worldMatrix.elements[12];
    fd[17] = camera.worldMatrix.elements[13];
    fd[18] = camera.worldMatrix.elements[14];
    fd[19] = 1;
    fd[20] = _lightDir.x;
    fd[21] = _lightDir.y;
    fd[22] = _lightDir.z;
    fd[23] = 0;
    fd[24] = _lightColor[0];
    fd[25] = _lightColor[1];
    fd[26] = _lightColor[2];
    fd[27] = 1;
    fd[28] = _ambientColor[0];
    fd[29] = _ambientColor[1];
    fd[30] = _ambientColor[2];
    fd[31] = 1;

    this.queue.writeBuffer(this._frameUniformsBuffer, 0, fd.buffer, 0, 128);

    let colorTexture;
    try {
      colorTexture = this.context.getCurrentTexture();
    } catch (e) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_PRESENT_FAILED,
        `Failed to get current swapchain texture: ${e.message}`,
        { subsystem: 'Renderer', cause: e, frame: this.engine.frame }
      );
    }

    const colorView = colorTexture.createView();
    const encoder = this.device.createCommandEncoder({ label: 'N3D Frame Encoder' });

    const renderPass = encoder.beginRenderPass({
      label: 'MainPass',
      colorAttachments: [{
        view: colorView,
        clearValue: this.clearColor,
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this._depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    let drawCalls = 0;
    let triangles = 0;

    scene.traverseVisible((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material) return;
      if (!obj.visible) return;

      try {
        this._drawMesh(renderPass, obj);
        drawCalls++;
        if (obj.geometry.index) {
          triangles += obj.geometry.index.count / 3;
        } else {
          const pos = obj.geometry.getAttribute('position');
          if (pos) triangles += pos.count / 3;
        }
      } catch (e) {
        if (!ErrorSystem.isFailed()) {
          ErrorSystem.fatal(
            ErrorSystem.ERROR_CODES.N3D_RENDER_PASS_FAILED,
            `Error drawing mesh "${obj.name}": ${e.message}`,
            {
              subsystem: 'Renderer',
              cause: e,
              frame: this.engine.frame,
              pass: 'OpaquePass',
              resource: obj.name
            }
          );
        }
      }
    });

    renderPass.end();
    this.queue.submit([encoder.finish()]);

    this.engine.stats.drawCalls = drawCalls;
    this.engine.stats.triangles = Math.floor(triangles);
  }

  _drawMesh(pass, mesh) {
    const geometry = mesh.geometry;
    const material = mesh.material;

    geometry.upload(this.engine);

    const pipeline = this._getOrCreatePipeline(geometry, material);
    pass.setPipeline(pipeline);

    mesh.updateWorldMatrix(true, false);

    // Object uniforms: model matrix + baseColor + material params
    const od = this._objectData;
    od.set(mesh.worldMatrix.elements, 0);

    // baseColor
    let br = 0.8, bg = 0.8, bb = 0.8, ba = 1;
    if (material.baseColor) {
      br = material.baseColor[0] ?? 0.8;
      bg = material.baseColor[1] ?? 0.8;
      bb = material.baseColor[2] ?? 0.8;
      ba = material.baseColor[3] ?? 1;
    }
    od[16] = br;
    od[17] = bg;
    od[18] = bb;
    od[19] = ba * (material.opacity ?? 1);

    // material params: metallic, roughness, unused, unused
    od[20] = material.metallic ?? 0;
    od[21] = material.roughness ?? 0.5;
    od[22] = 0;
    od[23] = 0;

    this.queue.writeBuffer(this._objectUniformsBuffer, 0, od.buffer, 0, 96);

    // Bind groups (created per draw for simplicity; cache later)
    const frameBG = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this._frameUniformsBuffer }
      }]
    });

    const objectBG = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: this._objectUniformsBuffer }
      }]
    });

    pass.setBindGroup(0, frameBG);
    pass.setBindGroup(1, objectBG);

    const posAttr = geometry.getAttribute('position');
    if (!posAttr?._buffer) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_GEOMETRY,
        'Mesh geometry missing position attribute or GPU buffer',
        { subsystem: 'Renderer', resource: mesh.name }
      );
    }

    pass.setVertexBuffer(0, posAttr._buffer);

    const normalAttr = geometry.getAttribute('normal');
    if (normalAttr?._buffer) {
      pass.setVertexBuffer(1, normalAttr._buffer);
    }

    if (geometry.index?._buffer) {
      const indexFormat = geometry.index.array instanceof Uint16Array ? 'uint16' : 'uint32';
      pass.setIndexBuffer(geometry.index._buffer, indexFormat);
      pass.drawIndexed(geometry.index.count);
    } else {
      pass.draw(posAttr.count);
    }
  }

  _getOrCreatePipeline(geometry, material) {
    const key = `${material.type}_${material.side}_${material.transparent}_${material.depthWrite}`;

    if (this._pipelineCache.has(key)) {
      return this._pipelineCache.get(key);
    }

    const shaderModule = this._createLitShaderModule();
    const presentationFormat = this.engine.capabilities.preferredCanvasFormat;

    const pipeline = this.resources.createRenderPipeline({
      label: `Pipeline_${key}`,
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
          },
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: presentationFormat,
          blend: material.transparent ? {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add'
            }
          } : undefined
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: material.side === 'double' ? 'none' :
                  (material.side === 'back' ? 'front' : 'back'),
        frontFace: 'ccw'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: material.depthWrite !== false,
        depthCompare: 'less'
      }
    });

    this._pipelineCache.set(key, pipeline);
    return pipeline;
  }

  _createLitShaderModule() {
    const code = `
struct FrameUniforms {
  viewProj   : mat4x4f,
  cameraPos  : vec4f,
  lightDir   : vec4f,
  lightColor : vec4f,
  ambient    : vec4f,
};

struct ObjectUniforms {
  model      : mat4x4f,
  baseColor  : vec4f,
  params     : vec4f, // metallic, roughness, _, _
};

@group(0) @binding(0) var<uniform> frame  : FrameUniforms;
@group(1) @binding(0) var<uniform> object : ObjectUniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
};

struct VertexOutput {
  @builtin(position) position    : vec4f,
  @location(0) worldNormal       : vec3f,
  @location(1) worldPos          : vec3f,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let worldPos4 = object.model * vec4f(input.position, 1.0);
  output.position = frame.viewProj * worldPos4;
  // Assume uniform scale for normal (adequate for basic lighting)
  output.worldNormal = normalize((object.model * vec4f(input.normal, 0.0)).xyz);
  output.worldPos = worldPos4.xyz;
  return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4f {
  let N = normalize(input.worldNormal);
  // lightDir is direction rays travel; L is toward the light
  let L = normalize(-frame.lightDir.xyz);
  let V = normalize(frame.cameraPos.xyz - input.worldPos);

  let NdotL = max(dot(N, L), 0.0);

  // Simple Blinn-Phong style specular for visual richness
  let H = normalize(L + V);
  let NdotH = max(dot(N, H), 0.0);
  let roughness = max(object.params.y, 0.04);
  let specPower = mix(128.0, 8.0, roughness);
  let specular = pow(NdotH, specPower) * (1.0 - roughness) * 0.35;

  let metallic = object.params.x;
  let base = object.baseColor.rgb;

  // Metallic workflow approximation
  let diffuseColor = base * (1.0 - metallic);
  let diffuse = diffuseColor * NdotL;
  let ambient = base * frame.ambient.rgb;

  var color = ambient + diffuse * frame.lightColor.rgb
              + specular * frame.lightColor.rgb * mix(vec3f(1.0), base, metallic);

  // Soft tone-map style clamp
  color = color / (color + vec3f(1.0));

  return vec4f(color, object.baseColor.a);
}
`;

    const module = this.resources.createShaderModule({
      label: 'ForwardLitShader',
      code
    });

    if (this.engine.options.debug) {
      module.getCompilationInfo().then((info) => {
        for (const msg of info.messages) {
          if (msg.type === 'error') {
            ErrorSystem.fatal(
              ErrorSystem.ERROR_CODES.N3D_SHADER_COMPILATION_FAILED,
              `WGSL compilation error: ${msg.message} (line ${msg.lineNum})`,
              { subsystem: 'Shader', line: msg.lineNum, offset: msg.linePos }
            );
          } else if (msg.type === 'warning') {
            Logger.warn(`WGSL warning: ${msg.message}`);
          }
        }
      });
    }

    return module;
  }

  dispose() {
    this.engine.events.off('resize', this._onResize);
    if (this._depthTexture) {
      try { this._depthTexture.destroy(); } catch (_) {}
      this.resources.untrack(this._depthTexture);
      this._depthTexture = null;
    }
    this._pipelineCache.clear();
  }
}

export default Renderer;
