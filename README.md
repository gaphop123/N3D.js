# N3D.js — Advanced WebGPU 3D Engine

**N3D.js** is a modern, WebGPU-first 3D engine for the web.  
Modular, engine-grade architecture focused on **correctness, stability, performance, and strict error handling**.

> Status: **v0.3.0**  
> Core + lighting + collision + **glTF 2.0 loader** + Texture2D.

## Design Principles

1. **WebGPU only** — No WebGL fallback. Feature detection is mandatory.
2. **Strict error handling** — Fatal errors stop the render/update loop immediately. No silent failures.
3. **Modular architecture** — Clear separation of Core, Scene, Geometry, Material, Lighting, Physics, Assets, Renderer.
4. **Resource lifetime tracking** — All GPU resources are tracked and disposable.
5. **High-level + Low-level API** — Easy scene API on top of explicit WebGPU control.
6. **No fake features** — Incomplete features throw `N3D_NOT_IMPLEMENTED` instead of pretending to work.

## Quick Start

```html
<canvas id="c"></canvas>
<script type="module">
  import N3D from './src/index.js';

  const canvas = document.getElementById('c');
  const engine = await N3D.Engine.create({ canvas, debug: true });
  const renderer = new N3D.Renderer(engine);
  engine.renderer = renderer;

  const scene = new N3D.Scene();
  const camera = new N3D.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 2, 6);

  const sun = N3D.DirectionalLight.createSun({ elevation: 45, intensity: 2.5 });
  scene.add(sun);
  scene.add(new N3D.AmbientLight(0x6080c0, 0.2));

  // Load a glTF / GLB model
  const gltf = await N3D.GLTFLoader.load('model.glb', engine);
  scene.add(gltf.scene);

  renderer.setScene(scene, camera);
  engine.start();
</script>
```

## What's New in v0.3

| Feature | Status |
|--------|--------|
| **GLTFLoader** (2.0, .gltf + .glb) | ✅ meshes, materials, textures, hierarchy |
| Texture2D + URL load + cache | ✅ |
| glTF PBR material import | ✅ baseColor, metallic, roughness, maps |
| glTF animation **data** parse | ✅ stored on result (playback = not yet) |
| glTF skin **data** parse | ✅ joints + inverse bind matrices (skinning = not yet) |

## Implemented Systems

| System | Status |
|--------|--------|
| Engine + Game Loop | ✅ |
| WebGPU Device/Adapter + capabilities | ✅ |
| Strict ErrorSystem | ✅ |
| ResourceManager | ✅ |
| Scene Graph | ✅ |
| Perspective / Orthographic Camera | ✅ |
| BoxGeometry / SphereGeometry | ✅ |
| Forward Renderer (lit) | ✅ |
| PBRMaterial (basic metallic-roughness) | ✅ |
| Directional / Ambient / Hemisphere lights | ✅ |
| Collision + Raycast (PhysicsWorld) | ✅ |
| Texture2D | ✅ |
| **GLTFLoader** | ✅ |
| Math library | ✅ |

## Not Yet Implemented

| Feature | Notes |
|--------|--------|
| Skeletal animation + skinning playback | Data parsed from glTF; mixer/skinning not wired |
| Shadow maps | — |
| Full GGX PBR + IBL | Basic MR shading only |
| Post-processing / RenderGraph | — |
| Instancing / GPU culling / LOD | — |
| Compute shaders / GPU particles | — |
| Full rigid-body physics | Collision/raycast only |

Missing features throw a clear `N3D_NOT_IMPLEMENTED` error when invoked as incomplete APIs.

## Examples

- `examples/01_rotating_cube.html` — basic cube
- `examples/02_sun_and_collision.html` — sun + physics/collision
- `examples/03_gltf_loader.html` — load DamagedHelmet.glb (network)

## GLTFLoader API

```js
const result = await N3D.GLTFLoader.load(url, engine);
// result.scene      — Object3D root to add to your scene
// result.meshes     — mesh definitions
// result.materials  — PBRMaterial instances
// result.textures   — Texture2D instances
// result.animations — raw animation clips (channels/samplers)
// result.skins      — skin data (joints, inverseBindMatrices)
```

Supports:
- Binary `.glb` and JSON `.gltf` + external buffers/images
- Embedded base64 buffers/images
- Interleaved and non-interleaved accessors
- PBR metallic-roughness materials + texture maps
- Node hierarchy, TRS / matrix transforms
- Multi-primitive meshes

## Browser Support

Requires **WebGPU** (Chrome 113+, Edge 113+, Firefox Nightly with flag, Safari TP).

## License

MIT
