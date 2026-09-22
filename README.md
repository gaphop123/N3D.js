# N3D.js — Advanced WebGPU 3D Engine

**N3D.js** is a modern, WebGPU-first 3D engine for the web.  
Modular, engine-grade architecture focused on **correctness, stability, performance, and strict error handling**.

> Status: **v0.2.0**  
> Core systems + DirectionalLight (Sun), Ambient/Hemisphere lights, material-aware forward shading, and a real collision/raycast system.

## Design Principles

1. **WebGPU only** — No WebGL fallback. Feature detection is mandatory.
2. **Strict error handling** — Fatal errors stop the render/update loop immediately. No silent failures.
3. **Modular architecture** — Clear separation of Core, Scene, Geometry, Material, Lighting, Physics, Renderer.
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

  // Sun
  const sun = N3D.DirectionalLight.createSun({
    elevation: 45,
    azimuth: 40,
    intensity: 2.5
  });
  scene.add(sun);
  scene.add(new N3D.AmbientLight(0x6080c0, 0.2));

  const mesh = new N3D.Mesh(
    new N3D.BoxGeometry(1, 1, 1),
    new N3D.PBRMaterial({ baseColor: [0.2, 0.6, 1.0], metallic: 0.2, roughness: 0.4 })
  );
  scene.add(mesh);

  // Collision
  const physics = new N3D.PhysicsWorld();
  physics.addBoxCollider(mesh, new N3D.Vector3(1, 1, 1));

  renderer.setScene(scene, camera);
  engine.start();
</script>
```

## What’s New in v0.2

| Feature | Status |
|--------|--------|
| DirectionalLight (Sun) | ✅ `DirectionalLight.createSun()` |
| AmbientLight / HemisphereLight | ✅ |
| Material-aware lighting | ✅ baseColor, metallic, roughness in shader |
| Box3 / Sphere / Ray | ✅ |
| BoxCollider / SphereCollider | ✅ |
| PhysicsWorld | ✅ raycast, overlap, collision events |
| Color class | ✅ |

## Implemented Systems

| System | Status |
|--------|--------|
| Engine + Game Loop | ✅ |
| WebGPU Device/Adapter + capabilities | ✅ |
| Strict ErrorSystem | ✅ Fatal stops everything |
| ResourceManager | ✅ |
| Scene Graph | ✅ |
| Perspective / Orthographic Camera | ✅ |
| BoxGeometry / SphereGeometry | ✅ |
| Forward Renderer (lit) | ✅ |
| PBRMaterial (data + shading) | ✅ basic metallic-roughness |
| Directional / Ambient / Hemisphere lights | ✅ |
| Collision + Raycast | ✅ |
| Math (Vector3, Matrix4, Quaternion, Color, Box3, Sphere, Ray) | ✅ |

## Not Yet Implemented

- Full GGX PBR + IBL / environment maps
- Shadow maps / CSM
- Post-processing / RenderGraph
- Instancing / GPU culling / LOD
- Animation / Skinning
- GLTF loader
- Compute shaders / GPU particles
- Full rigid-body physics backend

Missing features throw a clear `N3D_NOT_IMPLEMENTED` error.

## Examples

- `examples/01_rotating_cube.html` — basic cube
- `examples/02_sun_and_collision.html` — sun lighting + physics/collision demo

## Browser Support

Requires **WebGPU** (Chrome 113+, Edge 113+, Firefox Nightly with flag, Safari TP).

## License

MIT
