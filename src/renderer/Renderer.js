/**
 * N3D Renderer (Forward)
 * Minimal but real WebGPU renderer. Focus on correctness and clear error paths.
 * Advanced features (deferred, full PBR, shadows, post) marked as not implemented where incomplete.
 */

import { ErrorSystem } from '../core/ErrorSystem.js';
import { Logger } from '../core/Logger.js';
import { Matrix4 } from '../math/Matrix4.js';

// Temporary identity / helpers
const _tempMatrix = new Matrix4();

export class Renderer {
  constructor(engine) {
    this.engine = engine;
    this.device = engine.gpuDevice;
    this.queue = engine.queue;
    this.context = engine.context;
    this.resources = engine.resources;

    this._scene = null;
    this._camera = null;

    // Clear color
    this.clearColor = { r: 0.1, g: 0.1, b: 0.12, a: 1 };

    // Depth texture (recreated on resize)
    this._depthTexture = null;
    this._depthTextureView = null;
    this._size = { width: 0, height: 0 };

    // Simple pipeline cache (key → GPURenderPipeline)
    this._pipelineCache = new Map();

    // Default sample count
    this.sampleCount = 1; // MSAA later

    this._frameUniformsBuffer = null;
    this._objectUniformsBuffer = null;

    this._initBuffers();
    this._onResize = (e) => this._handleResize(e);
    engine.events.on('resize', this._onResize);

    // Initial size
    this._handleResize({
      width: engine.canvas.width,
      height: engine.canvas.height
    });
  }

  _initBuffers() {
    // Frame uniforms: viewProjection (64) + cameraPos (16) = 80 → align 256
    this._frameUniformsBuffer = this.resources.createBuffer({
      label: 'FrameUniforms',
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Object uniforms: model matrix (64) + normal matrix etc. → 256
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
      this._depthTexture.destroy();
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

  /**
   * Set the scene and camera to render.
   */
  setScene(scene, camera) {
    this._scene = scene;
    this._camera = camera;
  }

  /**
   * Main render entry. Called by engine tick or manually.
   */
  render(scene = this._scene, camera = this._camera) {
    if (ErrorSystem.isFailed()) return;
    if (!scene || !camera) {
      // Silent skip if nothing to render yet
      return;
    }

    if (!this._depthTextureView) {
      this._handleResize({
        width: this.engine.canvas.width,
        height: this.engine.canvas.height
      });
    }

    // Update camera matrices
    camera.updateMatrixWorld();
    if (camera.isPerspectiveCamera || camera.isOrthographicCamera) {
      // aspect may need update
      const aspect = this._size.width / Math.max(this._size.height, 1);
      if (camera.isPerspectiveCamera && Math.abs(camera.aspect - aspect) > 1e-6) {
        camera.setAspect(aspect);
      }
    }

    // Update scene graph
    scene.update();

    // Build view-projection
    const viewProj = _tempMatrix;
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // Upload frame uniforms
    const frameData = new Float32Array(16 + 4);
    frameData.set(viewProj.elements, 0);
    frameData[16] = camera.worldMatrix.elements[12];
    frameData[17] = camera.worldMatrix.elements[13];
    frameData[18] = camera.worldMatrix.elements[14];
    frameData[19] = 1;
    this.queue.writeBuffer(this._frameUniformsBuffer, 0, frameData);

    // Acquire current swapchain texture
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

    // Simple scene traversal and draw
    let drawCalls = 0;
    let triangles = 0;

    scene.traverseVisible((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material) return;
      if (!obj.visible) return;

      try {
        this._drawMesh(renderPass, obj, viewProj);
        drawCalls++;
        if (obj.geometry.index) {
          triangles += obj.geometry.index.count / 3;
        }
      } catch (e) {
        if (!ErrorSystem.isFailed()) {
          ErrorSystem.fatal(
            ErrorSystem.ERROR_CODES.N3D_RENDER_PASS_FAILED,
            `Error drawing mesh "${obj.name}": ${e.message}`,
            { subsystem: 'Renderer', cause: e, frame: this.engine.frame, pass: 'OpaquePass', resource: obj.name }
          );
        }
      }
    });

    renderPass.end();

    this.queue.submit([encoder.finish()]);

    // Update stats
    this.engine.stats.drawCalls = drawCalls;
    this.engine.stats.triangles = Math.floor(triangles);
  }

  _drawMesh(pass, mesh, viewProj) {
    const geometry = mesh.geometry;
    const material = mesh.material;

    // Ensure geometry is uploaded
    geometry.upload(this.engine);

    const pipeline = this._getOrCreatePipeline(geometry, material);
    pass.setPipeline(pipeline);

    // Object uniforms: model matrix
    mesh.updateWorldMatrix(true, false);
    const modelData = new Float32Array(16);
    modelData.set(mesh.worldMatrix.elements);
    this.queue.writeBuffer(this._objectUniformsBuffer, 0, modelData);

    // Bind groups - for the simple shader we use two groups
    // Group 0: frame
    // Group 1: object
    // (In a real engine these would be cached)

    // For simplicity of this first version we create bind groups every frame
    // (performance optimization later)
    const frameLayout = pipeline.getBindGroupLayout(0);
    const objectLayout = pipeline.getBindGroupLayout(1);

    const frameBG = this.device.createBindGroup({
      layout: frameLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this._frameUniformsBuffer }
      }]
    });

    const objectBG = this.device.createBindGroup({
      layout: objectLayout,
      entries: [{
        binding: 0,
        resource: { buffer: this._objectUniformsBuffer }
      }]
    });

    pass.setBindGroup(0, frameBG);
    pass.setBindGroup(1, objectBG);

    // Vertex buffers
    const posAttr = geometry.getAttribute('position');
    if (!posAttr || !posAttr._buffer) {
      ErrorSystem.fatal(
        ErrorSystem.ERROR_CODES.N3D_INVALID_GEOMETRY,
        'Mesh geometry missing position attribute or GPU buffer',
        { subsystem: 'Renderer', resource: mesh.name }
      );
    }

    pass.setVertexBuffer(0, posAttr._buffer);

    const normalAttr = geometry.getAttribute('normal');
    if (normalAttr && normalAttr._buffer) {
      pass.setVertexBuffer(1, normalAttr._buffer);
    }

    if (geometry.index && geometry.index._buffer) {
      const indexFormat = geometry.index.array instanceof Uint16Array ? 'uint16' : 'uint32';
      pass.setIndexBuffer(geometry.index._buffer, indexFormat);
      pass.drawIndexed(geometry.index.count);
    } else {
      pass.draw(posAttr.count);
    }
  }

  _getOrCreatePipeline(geometry, material) {
    // Simple key
    const key = `${material.type}_${material.side}_${material.transparent}`;

    if (this._pipelineCache.has(key)) {
      return this._pipelineCache.get(key);
    }

    const shaderModule = this._createDefaultShaderModule(material);

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
            attributes: [{
              shaderLocation: 0,
              offset: 0,
              format: 'float32x3'
            }]
          },
          {
            arrayStride: 12,
            attributes: [{
              shaderLocation: 1,
              offset: 0,
              format: 'float32x3'
            }]
          }
        ]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: presentationFormat,
          blend: material.transparent ? {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          } : undefined
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: material.side === 'double' ? 'none' : (material.side === 'back' ? 'front' : 'back'),
        frontFace: 'ccw'
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: material.depthWrite,
        depthCompare: 'less'
      }
    });

    this._pipelineCache.set(key, pipeline);
    return pipeline;
  }

  _createDefaultShaderModule(material) {
    // Basic lit shader (simple directional + ambient)
    const code = `
struct FrameUniforms {
  viewProj : mat4x4f,
  cameraPos : vec4f,
};

struct ObjectUniforms {
  model : mat4x4f,
};

@group(0) @binding(0) var<uniform> frame : FrameUniforms;
@group(1) @binding(0) var<uniform> object : ObjectUniforms;

struct VertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
};

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) worldNormal : vec3f,
  @location(1) worldPos : vec3f,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let worldPos = object.model * vec4f(input.position, 1.0);
  output.position = frame.viewProj * worldPos;
  // Assume uniform scale for normal transform simplicity
  output.worldNormal = normalize((object.model * vec4f(input.normal, 0.0)).xyz);
  output.worldPos = worldPos.xyz;
  return output;
}

@fragment
fn fs_main(input : VertexOutput) -> @location(0) vec4f {
  let N = normalize(input.worldNormal);
  let L = normalize(vec3f(0.4, 0.8, 0.3)); // fixed directional light
  let diffuse = max(dot(N, L), 0.0);
  let ambient = 0.15;
  let baseColor = vec3f(0.75, 0.75, 0.8);
  let color = baseColor * (ambient + diffuse * 0.85);
  return vec4f(color, 1.0);
}
`;

    // Create shader module with error checking
    const module = this.resources.createShaderModule({
      label: 'DefaultLitShader',
      code
    });

    // Note: actual compilation errors are reported asynchronously via getCompilationInfo
    // We should check it in debug mode
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
      this._depthTexture.destroy();
      this.resources.untrack(this._depthTexture);
      this._depthTexture = null;
    }
    this._pipelineCache.clear();
  }
}

export default Renderer;
