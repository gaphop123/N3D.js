/**
 * N3D.js TypeScript Definitions (v0.1.0)
 * Early foundation — types will expand as modules are completed.
 */

export as namespace N3D;

export class N3DError extends Error {
  code: string;
  details: Record<string, any>;
  timestamp: number;
  isFatal: boolean;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  antialias?: boolean;
  powerPreference?: GPUPowerPreference;
  debug?: boolean;
  maxPixelRatio?: number;
  alphaMode?: GPUCanvasAlphaMode;
}

export interface EngineStats {
  fps: number;
  frameTime: number;
  cpuTime: number;
  gpuTime: number;
  drawCalls: number;
  triangles: number;
  textureMemory: number;
  bufferMemory: number;
}

export class Engine {
  static create(options: EngineOptions): Promise<Engine>;
  canvas: HTMLCanvasElement;
  device: any;
  gpuDevice: GPUDevice;
  queue: GPUQueue;
  context: GPUCanvasContext;
  capabilities: any;
  resources: ResourceManager;
  events: EventSystem;
  renderer: Renderer | null;
  stats: EngineStats;
  options: EngineOptions;
  readonly frame: number;
  readonly delta: number;
  readonly elapsed: number;
  readonly isRunning: boolean;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  resize(): void;
  recover(): Promise<void>;
  dispose(): void;
}

export class ResourceManager {
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
  getStats(): any;
  dispose(): void;
}

export class EventSystem {
  on(event: string, callback: (...args: any[]) => void, context?: any): this;
  once(event: string, callback: (...args: any[]) => void, context?: any): this;
  off(event: string, callback?: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): this;
  clear(): void;
}

export class Vector3 {
  x: number; y: number; z: number;
  constructor(x?: number, y?: number, z?: number);
  set(x: number, y: number, z: number): this;
  copy(v: Vector3): this;
  clone(): Vector3;
  add(v: Vector3): this;
  sub(v: Vector3): this;
  multiplyScalar(s: number): this;
  normalize(): this;
  length(): number;
  lengthSq(): number;
  dot(v: Vector3): number;
  cross(v: Vector3): this;
  lerp(v: Vector3, t: number): this;
  distanceTo(v: Vector3): number;
  fromArray(arr: ArrayLike<number>, offset?: number): this;
  toArray(arr?: number[], offset?: number): number[];
}

export class Matrix4 {
  elements: Float32Array;
  identity(): this;
  copy(m: Matrix4): this;
  clone(): Matrix4;
  compose(position: Vector3, quaternion: Quaternion, scale: Vector3): this;
  multiply(m: Matrix4): this;
  multiplyMatrices(a: Matrix4, b: Matrix4): this;
  makePerspective(fovYRadians: number, aspect: number, near: number, far: number): this;
  makeOrthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): this;
  lookAt(eye: Vector3, target: Vector3, up: Vector3): this;
  invert(): this;
  transpose(): this;
}

export class Quaternion {
  x: number; y: number; z: number; w: number;
  constructor(x?: number, y?: number, z?: number, w?: number);
  set(x: number, y: number, z: number, w: number): this;
  copy(q: Quaternion): this;
  clone(): Quaternion;
  identity(): this;
  setFromAxisAngle(axis: Vector3, angle: number): this;
  setFromEuler(x: number, y: number, z: number, order?: string): this;
  multiply(q: Quaternion): this;
  normalize(): this;
  slerp(qb: Quaternion, t: number): this;
}

export class Node {
  id: number;
  name: string;
  parent: Node | null;
  children: Node[];
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  matrix: Matrix4;
  worldMatrix: Matrix4;
  visible: boolean;
  layers: number;
  tags: Set<string>;
  userData: Record<string, any>;
  add(child: Node): this;
  remove(child: Node): this;
  updateMatrix(): void;
  updateWorldMatrix(updateParents?: boolean, updateChildren?: boolean): void;
  updateMatrixWorld(force?: boolean): void;
  traverse(callback: (node: Node) => void): void;
  traverseVisible(callback: (node: Node) => void): void;
  clone(recursive?: boolean): Node;
  dispose(): void;
}

export class Scene extends Node {
  background: any;
  environment: any;
  fog: any;
  update(): void;
}

export class Object3D extends Node {
  frustumCulled: boolean;
  renderOrder: number;
}

export class Mesh extends Object3D {
  geometry: Geometry | null;
  material: Material | null;
  castShadow: boolean;
  receiveShadow: boolean;
  constructor(geometry?: Geometry | null, material?: Material | null);
}

export class Camera extends Object3D {
  near: number;
  far: number;
  matrixWorldInverse: Matrix4;
  projectionMatrix: Matrix4;
  projectionMatrixInverse: Matrix4;
}

export class PerspectiveCamera extends Camera {
  fov: number;
  aspect: number;
  constructor(fov?: number, aspect?: number, near?: number, far?: number);
  updateProjectionMatrix(): void;
  setAspect(aspect: number): void;
}

export class OrthographicCamera extends Camera {
  left: number; right: number; top: number; bottom: number;
  constructor(left?: number, right?: number, top?: number, bottom?: number, near?: number, far?: number);
  updateProjectionMatrix(): void;
}

export class BufferAttribute {
  array: ArrayBufferView;
  itemSize: number;
  count: number;
  normalized: boolean;
  needsUpdate: boolean;
  constructor(array: ArrayBufferView, itemSize: number, normalized?: boolean);
  markNeedsUpdate(): void;
}

export class Geometry {
  attributes: Record<string, BufferAttribute>;
  index: BufferAttribute | null;
  setAttribute(name: string, attribute: BufferAttribute | { array: ArrayBufferView; itemSize: number }): this;
  getAttribute(name: string): BufferAttribute | null;
  setIndex(index: ArrayLike<number> | BufferAttribute | null): this;
  upload(engine: Engine): void;
  dispose(): void;
}

export class BoxGeometry extends Geometry {
  constructor(width?: number, height?: number, depth?: number, widthSegments?: number, heightSegments?: number, depthSegments?: number);
}

export class Material {
  opacity: number;
  transparent: boolean;
  side: 'front' | 'back' | 'double';
  depthTest: boolean;
  depthWrite: boolean;
  visible: boolean;
  dispose(): void;
}

export class UnlitMaterial extends Material {
  baseColor: number[];
  baseColorMap: any;
  constructor(params?: any);
}

export class PBRMaterial extends Material {
  baseColor: number[];
  metallic: number;
  roughness: number;
  emissive: number[];
  baseColorMap: any;
  normalMap: any;
  constructor(params?: any);
}

export class ShaderMaterial extends Material {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, any>;
  constructor(params?: any);
}

export class Renderer {
  constructor(engine: Engine);
  clearColor: { r: number; g: number; b: number; a: number };
  setScene(scene: Scene, camera: Camera): void;
  render(scene?: Scene, camera?: Camera): void;
  dispose(): void;
}

export const ErrorSystem: {
  ERROR_CODES: Record<string, string>;
  fatal(code: string, message: string, details?: any): never;
  warn(code: string, message: string, details?: any): void;
  info(code: string, message: string, details?: any): void;
  assert(condition: any, code?: string, message?: string, details?: any): void;
  isFailed(): boolean;
  notImplemented(feature: string, details?: any): never;
};

export const Logger: {
  setLevel(level: string | number): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
};

declare const N3D: {
  Engine: typeof Engine;
  Scene: typeof Scene;
  PerspectiveCamera: typeof PerspectiveCamera;
  OrthographicCamera: typeof OrthographicCamera;
  Mesh: typeof Mesh;
  BoxGeometry: typeof BoxGeometry;
  PBRMaterial: typeof PBRMaterial;
  UnlitMaterial: typeof UnlitMaterial;
  ShaderMaterial: typeof ShaderMaterial;
  Vector3: typeof Vector3;
  Matrix4: typeof Matrix4;
  Quaternion: typeof Quaternion;
  Renderer: typeof Renderer;
  ErrorSystem: typeof ErrorSystem;
  Logger: typeof Logger;
  REVISION: string;
  version: string;
};

export default N3D;

/* ===== v0.3 additions ===== */

export class Texture {
  uuid: string;
  name: string;
  isTexture: boolean;
  readonly gpuTexture: GPUTexture | null;
  readonly view: GPUTextureView | null;
  readonly sampler: GPUSampler | null;
  dispose(): void;
}

export class Texture2D extends Texture {
  isTexture2D: boolean;
  width: number;
  height: number;
  format: string;
  url: string | null;
  upload(engine: Engine): this;
  static load(url: string, options?: any): Promise<Texture2D>;
  static clearCache(): void;
}

export class GLTFResult {
  scene: Object3D;
  scenes: Object3D[];
  meshes: any[];
  materials: PBRMaterial[];
  textures: Texture2D[];
  nodes: Object3D[];
  animations: any[];
  skins: any[];
  asset: any;
}

export class GLTFLoader {
  constructor(options?: { uploadTextures?: boolean });
  load(url: string, engine?: Engine | null): Promise<GLTFResult>;
  static load(url: string, engine?: Engine | null, options?: any): Promise<GLTFResult>;
}

export class DirectionalLight {
  static createSun(options?: {
    elevation?: number;
    azimuth?: number;
    intensity?: number;
    color?: number | number[];
    distance?: number;
  }): DirectionalLight;
  getDirection(out?: Vector3): Vector3;
  color: Color;
  intensity: number;
  castShadow: boolean;
  target: Object3D;
  shadow: any;
}

export class AmbientLight {
  constructor(color?: number | number[], intensity?: number);
}

export class PhysicsWorld {
  constructor(options?: { gravity?: Vector3 });
  gravity: Vector3;
  colliders: any[];
  addBoxCollider(object3d: Object3D, size?: Vector3, center?: Vector3): any;
  addSphereCollider(object3d: Object3D, radius?: number, center?: Vector3): any;
  removeCollider(collider: any): this;
  step(deltaTime?: number): void;
  raycast(origin: Vector3, direction: Vector3, maxDistance?: number, layerMask?: number): any;
  raycastAll(origin: Vector3, direction: Vector3, maxDistance?: number, layerMask?: number): any[];
  overlapSphere(center: Vector3, radius: number, layerMask?: number): any[];
  on(event: string, cb: Function): this;
  clear(): void;
  dispose(): void;
}

export class Box3 {
  min: Vector3;
  max: Vector3;
  constructor(min?: Vector3, max?: Vector3);
  setFromCenterAndSize(center: Vector3, size: Vector3): this;
  containsPoint(point: Vector3): boolean;
  intersectsBox(box: Box3): boolean;
  intersectsSphere(sphere: Sphere): boolean;
  applyMatrix4(matrix: Matrix4): this;
  clone(): Box3;
}

export class Sphere {
  center: Vector3;
  radius: number;
  constructor(center?: Vector3, radius?: number);
  containsPoint(point: Vector3): boolean;
  intersectsSphere(sphere: Sphere): boolean;
  clone(): Sphere;
}

export class Ray {
  origin: Vector3;
  direction: Vector3;
  constructor(origin?: Vector3, direction?: Vector3);
  at(t: number, out?: Vector3): Vector3;
  intersectSphere(sphere: Sphere, outPoint?: Vector3): number | null;
  intersectBox(box: Box3, outPoint?: Vector3): number | null;
}

export class Color {
  r: number; g: number; b: number; a: number;
  constructor(r?: number, g?: number, b?: number, a?: number);
  setHex(hex: number): this;
  setRGB(r: number, g: number, b: number): this;
  clone(): Color;
}
