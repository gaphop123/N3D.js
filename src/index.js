/**
 * N3D.js - Advanced WebGPU 3D Engine
 * Main entry point.
 */

// Core
export { Engine } from './core/Engine.js';
export { Device } from './core/Device.js';
export { ErrorSystem, N3DError } from './core/ErrorSystem.js';
export { Logger } from './core/Logger.js';
export { ResourceManager } from './core/ResourceManager.js';
export { EventSystem } from './core/EventSystem.js';

// Math
export { Vector3, VECTOR3_ZERO, VECTOR3_ONE, VECTOR3_UP } from './math/Vector3.js';
export { Matrix4 } from './math/Matrix4.js';
export { Quaternion } from './math/Quaternion.js';

// Scene
export { Node } from './scene/Node.js';
export { Object3D } from './scene/Object3D.js';
export { Scene } from './scene/Scene.js';
export { Mesh } from './scene/Mesh.js';
export { Camera, PerspectiveCamera, OrthographicCamera } from './scene/Camera.js';

// Geometry
export { Geometry, BufferAttribute } from './geometry/Geometry.js';
export { BoxGeometry } from './geometry/BoxGeometry.js';
export { SphereGeometry } from './geometry/SphereGeometry.js';

// Material
export { Material, UnlitMaterial, PBRMaterial, ShaderMaterial } from './material/Material.js';

// Renderer
export { Renderer } from './renderer/Renderer.js';

// Namespace convenience
import { Engine } from './core/Engine.js';
import { Scene } from './scene/Scene.js';
import { PerspectiveCamera, OrthographicCamera } from './scene/Camera.js';
import { Mesh } from './scene/Mesh.js';
import { BoxGeometry } from './geometry/BoxGeometry.js';
import { SphereGeometry } from './geometry/SphereGeometry.js';
import { PBRMaterial, UnlitMaterial, ShaderMaterial } from './material/Material.js';
import { Vector3 } from './math/Vector3.js';
import { Matrix4 } from './math/Matrix4.js';
import { Quaternion } from './math/Quaternion.js';
import { Renderer } from './renderer/Renderer.js';
import { ErrorSystem } from './core/ErrorSystem.js';
import { Logger } from './core/Logger.js';

const N3D = {
  Engine,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  PBRMaterial,
  UnlitMaterial,
  ShaderMaterial,
  Vector3,
  Matrix4,
  Quaternion,
  Renderer,
  ErrorSystem,
  Logger,
  // Version
  REVISION: '0.1.0',
  version: '0.1.0'
};

export default N3D;
