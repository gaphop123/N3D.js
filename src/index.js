/**
 * N3D.js - Advanced WebGPU 3D Engine
 * Main entry point. v0.3.0
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
export { Color } from './math/Color.js';
export { Box3 } from './math/Box3.js';
export { Sphere } from './math/Sphere.js';
export { Ray } from './math/Ray.js';

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

// Texture
export { Texture, Texture2D } from './texture/Texture.js';

// Lighting
export {
  Light,
  DirectionalLight,
  PointLight,
  AmbientLight,
  HemisphereLight
} from './lighting/Light.js';

// Physics / Collision
export {
  Collider,
  BoxCollider,
  SphereCollider,
  RaycastHit,
  collidersIntersect,
  raycastCollider
} from './physics/Collider.js';
export { PhysicsWorld } from './physics/PhysicsWorld.js';

// Assets
export { GLTFLoader, GLTFResult } from './assets/GLTFLoader.js';

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
import { Texture2D } from './texture/Texture.js';
import { Vector3 } from './math/Vector3.js';
import { Matrix4 } from './math/Matrix4.js';
import { Quaternion } from './math/Quaternion.js';
import { Color } from './math/Color.js';
import { Box3 } from './math/Box3.js';
import { Sphere } from './math/Sphere.js';
import { Ray } from './math/Ray.js';
import { Renderer } from './renderer/Renderer.js';
import { ErrorSystem } from './core/ErrorSystem.js';
import { Logger } from './core/Logger.js';
import {
  Light,
  DirectionalLight,
  PointLight,
  AmbientLight,
  HemisphereLight
} from './lighting/Light.js';
import { PhysicsWorld } from './physics/PhysicsWorld.js';
import { BoxCollider, SphereCollider } from './physics/Collider.js';
import { GLTFLoader } from './assets/GLTFLoader.js';

const N3D = {
  Engine,
  ErrorSystem,
  Logger,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  PBRMaterial,
  UnlitMaterial,
  ShaderMaterial,
  Texture2D,
  Light,
  DirectionalLight,
  PointLight,
  AmbientLight,
  HemisphereLight,
  PhysicsWorld,
  BoxCollider,
  SphereCollider,
  GLTFLoader,
  Vector3,
  Matrix4,
  Quaternion,
  Color,
  Box3,
  Sphere,
  Ray,
  Renderer,
  REVISION: '0.3.0',
  version: '0.3.0'
};

export default N3D;
