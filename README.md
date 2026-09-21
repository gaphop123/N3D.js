# N3D.js — Advanced WebGPU 3D Engine

**N3D.js** is a modern, WebGPU-first 3D engine for the web. It is designed with a modular, engine-grade architecture focusing on **correctness, stability, performance, and clear error handling**.

> Status: **Early foundation (v0.1.0)**  
> Core systems (Device, Engine, Scene Graph, Geometry, Materials, basic Forward Renderer, strict Error System) are implemented. Advanced features (full PBR lighting, shadows, post-processing, RenderGraph, animation, physics, particles, GLTF, etc.) are architected but many are not yet fully implemented.

## Design Principles

1. **WebGPU only** — No WebGL fallback. Feature detection is mandatory.
2. **Strict error handling** — Fatal errors stop the render/update loop immediately. No silent failures.
3. **Modular architecture** — Clear separation of Core, Scene, Geometry, Material, Renderer, Shader, etc.
4. **Resource lifetime tracking** — All GPU resources are tracked and disposable.
5. **High-level + Low-level API** — Easy scene API on top of explicit WebGPU control.
6. **No fake features** — Incomplete features throw `N3D_NOT_IMPLEMENTED` instead of pretending to work.

## Quick Start

```html
<canvas id="c"></canvas>
<script type="module">
  import N3D from './src/index.js';

  const canvas = document.getElementById('c');

  const engine = await N3D.Engine.create({
    canvas,
    debug: true,
    powerPreference: 'high-performance'
  });

  const renderer = new N3D.Renderer(engine);
  engine.renderer = renderer;

  const scene = new N3D.Scene();
  const camera = new N3D.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 1.5, 4);

  const geometry = new N3D.BoxGeometry(1, 1, 1);
  const material = new N3D.PBRMaterial({
    baseColor: [0.2, 0.6, 1.0],
    metallic: 0.1,
    roughness: 0.4
  });

  const mesh = new N3D.Mesh(geometry, material);
  scene.add(mesh);

  renderer.setScene(scene, camera);
  engine.start();
</script>
```

## Architecture Overview

```
N3D
├── Core          Engine, Device, ResourceManager, ErrorSystem, EventSystem, Logger
├── Scene         Scene, Node, Object3D, Mesh, Camera
├── Geometry      Geometry, BufferGeometry, BoxGeometry, ...
├── Material      Material, PBRMaterial, UnlitMaterial, ShaderMaterial
├── Texture       (planned)
├── Shader        WGSL modules, Pipeline cache (partial)
├── Renderer      Forward renderer (basic), RenderGraph (planned)
├── Lighting      (planned)
├── PostProcessing(planned)
├── Animation     (planned)
├── Physics       Interface only (planned)
├── Assets        (planned)
├── Math          Vector3, Matrix4, Quaternion, ...
├── Input         (planned)
└── Debug         Stats, GPU profiler (partial)
```

## Error System (Critical)

Fatal errors **stop the engine**:

```js
// Example of what appears in DevTools
[N3D FATAL ERROR]
Code: N3D_GPU_DEVICE_LOST
Subsystem: Device
Message: GPU device was lost during render execution.
Frame: 1834
...
```

There is **no silent recovery**. Explicit recovery is available via:

```js
await engine.recover(); // Application must re-create resources
```

## Current Implemented Features

| System              | Status                          |
|---------------------|---------------------------------|
| Engine + Game Loop  | ✅ Working                      |
| WebGPU Device/Adapter | ✅ With capability detection  |
| Strict ErrorSystem  | ✅ Fatal stops everything       |
| ResourceManager     | ✅ Tracking + dispose           |
| Scene Graph         | ✅ Node hierarchy, transforms   |
| PerspectiveCamera   | ✅                              |
| BoxGeometry         | ✅                              |
| Basic Forward Renderer | ✅ Lit cube                  |
| PBRMaterial (data)  | ✅ (lighting model still simple)|
| Math (Vector3/Mat4/Quat) | ✅                         |
| Resize + DPR        | ✅                              |

## Not Yet Implemented (will throw or be incomplete)

- Full GGX PBR + IBL
- Shadows / CSM
- Post-processing stack / RenderGraph
- Instancing / LOD / Frustum culling (structure ready)
- Animation / Skinning
- GLTF / Asset loaders
- Compute shaders / GPU particles
- Physics integration
- Advanced materials & effects

When a feature is missing you will see a clear `N3D_NOT_IMPLEMENTED` error rather than broken behavior.

## Browser Support

Requires a browser with **WebGPU** enabled (Chrome 113+, Edge 113+, Firefox Nightly with flag, Safari Technology Preview).

## Project Structure

```
N3D.js/
├── src/           Source modules
├── examples/      Live demos
├── shaders/       WGSL sources (future)
├── tests/         Unit / integration tests
├── docs/          Documentation
├── dist/          Built bundles
├── package.json
├── index.d.ts     TypeScript definitions
└── README.md
```

## License

MIT

---

**N3D.js** aims to become a serious WebGPU-native alternative for games, visualization, simulation and interactive 3D on the web. The foundation prioritizes long-term architectural correctness over feature quantity.
