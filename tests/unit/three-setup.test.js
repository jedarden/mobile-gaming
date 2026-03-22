/**
 * Three Setup — Unit Tests
 *
 * Tests the pure-logic functions in src/shared/three-setup.js that
 * do not require a WebGL context or a DOM:
 *   - createCamera         (PerspectiveCamera construction)
 *   - createBasicLights    (adds ambient + directional to scene)
 *   - resizeThreeRenderer  (updates camera aspect + calls setSize)
 *   - disposeThreeScene    (traverses scene and calls dispose)
 *   - startThreeLoop / stopThreeLoop / stopAllThreeLoops (RAF lifecycle)
 *
 * createThreeScene is NOT tested here — it requires WebGLRenderer which
 * needs a canvas/WebGL context unavailable in Node.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  createCamera,
  createBasicLights,
  resizeThreeRenderer,
  disposeThreeScene,
  startThreeLoop,
  stopThreeLoop,
  stopAllThreeLoops,
} from '../../src/shared/three-setup.js';

// ── createCamera ──────────────────────────────────────────────────────────────

describe('createCamera', () => {
  it('returns a PerspectiveCamera', () => {
    const camera = createCamera();
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
  });

  it('defaults: fov=45, aspect=1, distance=100', () => {
    const camera = createCamera();
    expect(camera.fov).toBe(45);
    expect(camera.aspect).toBe(1);
    expect(camera.position.z).toBe(100);
  });

  it('applies custom fov', () => {
    const camera = createCamera(60, 1, 50);
    expect(camera.fov).toBe(60);
  });

  it('applies custom aspect ratio', () => {
    const camera = createCamera(45, 16 / 9, 100);
    expect(camera.aspect).toBeCloseTo(16 / 9);
  });

  it('positions camera at provided distance along z-axis', () => {
    const camera = createCamera(45, 1, 200);
    expect(camera.position.z).toBe(200);
  });

  it('uses near=0.1 and far=1000', () => {
    const camera = createCamera();
    expect(camera.near).toBe(0.1);
    expect(camera.far).toBe(1000);
  });
});

// ── createBasicLights ─────────────────────────────────────────────────────────

describe('createBasicLights', () => {
  it('returns an object with ambient and directional keys', () => {
    const scene = new THREE.Scene();
    const lights = createBasicLights(scene);
    expect(lights).toHaveProperty('ambient');
    expect(lights).toHaveProperty('directional');
  });

  it('ambient is an AmbientLight', () => {
    const scene = new THREE.Scene();
    const { ambient } = createBasicLights(scene);
    expect(ambient).toBeInstanceOf(THREE.AmbientLight);
  });

  it('directional is a DirectionalLight', () => {
    const scene = new THREE.Scene();
    const { directional } = createBasicLights(scene);
    expect(directional).toBeInstanceOf(THREE.DirectionalLight);
  });

  it('adds both lights to the scene', () => {
    const scene = new THREE.Scene();
    createBasicLights(scene);
    expect(scene.children.length).toBe(2);
  });

  it('default ambient intensity is 0.5', () => {
    const scene = new THREE.Scene();
    const { ambient } = createBasicLights(scene);
    expect(ambient.intensity).toBe(0.5);
  });

  it('default directional intensity is 1.0', () => {
    const scene = new THREE.Scene();
    const { directional } = createBasicLights(scene);
    expect(directional.intensity).toBe(1.0);
  });

  it('custom ambientIntensity is applied', () => {
    const scene = new THREE.Scene();
    const { ambient } = createBasicLights(scene, { ambientIntensity: 0.2 });
    expect(ambient.intensity).toBe(0.2);
  });

  it('custom directionalIntensity is applied', () => {
    const scene = new THREE.Scene();
    const { directional } = createBasicLights(scene, { directionalIntensity: 0.8 });
    expect(directional.intensity).toBe(0.8);
  });

  it('default directional position is (10, 10, 10)', () => {
    const scene = new THREE.Scene();
    const { directional } = createBasicLights(scene);
    expect(directional.position.x).toBe(10);
    expect(directional.position.y).toBe(10);
    expect(directional.position.z).toBe(10);
  });

  it('custom directional position is applied', () => {
    const scene = new THREE.Scene();
    const pos = new THREE.Vector3(5, 20, -3);
    const { directional } = createBasicLights(scene, { directionalPosition: pos });
    expect(directional.position.x).toBe(5);
    expect(directional.position.y).toBe(20);
    expect(directional.position.z).toBe(-3);
  });
});

// ── resizeThreeRenderer ───────────────────────────────────────────────────────

describe('resizeThreeRenderer', () => {
  it('updates camera aspect ratio', () => {
    const camera = createCamera(45, 1, 100);
    const renderer = { setSize: vi.fn() };
    resizeThreeRenderer(renderer, camera, 800, 400);
    expect(camera.aspect).toBeCloseTo(2.0);
  });

  it('calls updateProjectionMatrix on the camera', () => {
    const camera = createCamera();
    const spy = vi.spyOn(camera, 'updateProjectionMatrix');
    const renderer = { setSize: vi.fn() };
    resizeThreeRenderer(renderer, camera, 400, 300);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls renderer.setSize with the new logical dimensions', () => {
    const camera = createCamera();
    const renderer = { setSize: vi.fn() };
    resizeThreeRenderer(renderer, camera, 1280, 720);
    expect(renderer.setSize).toHaveBeenCalledWith(1280, 720);
  });
});

// ── disposeThreeScene ─────────────────────────────────────────────────────────

describe('disposeThreeScene', () => {
  it('calls renderer.dispose()', () => {
    const scene = new THREE.Scene();
    const renderer = { dispose: vi.fn() };
    disposeThreeScene(scene, renderer);
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('disposes geometry on scene meshes', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    const geoDispose = vi.spyOn(geo, 'dispose');
    const matDispose = vi.spyOn(mat, 'dispose');
    disposeThreeScene(scene, { dispose: vi.fn() });

    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
  });

  it('disposes array materials on scene meshes', () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat1 = new THREE.MeshBasicMaterial();
    const mat2 = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geo, [mat1, mat2]);
    scene.add(mesh);

    const spy1 = vi.spyOn(mat1, 'dispose');
    const spy2 = vi.spyOn(mat2, 'dispose');
    disposeThreeScene(scene, { dispose: vi.fn() });

    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
  });

  it('handles an empty scene without throwing', () => {
    const scene = new THREE.Scene();
    const renderer = { dispose: vi.fn() };
    expect(() => disposeThreeScene(scene, renderer)).not.toThrow();
  });
});

// ── startThreeLoop / stopThreeLoop / stopAllThreeLoops ────────────────────────

describe('startThreeLoop / stopThreeLoop / stopAllThreeLoops', () => {
  let rafCounter = 0;
  const rafCallbacks = new Map();

  beforeEach(() => {
    rafCounter = 0;
    rafCallbacks.clear();
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      const id = ++rafCounter;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id) => {
      rafCallbacks.delete(id);
    });
  });

  afterEach(() => {
    stopAllThreeLoops();
    vi.unstubAllGlobals();
  });

  // Helper: fire all pending RAF callbacks once
  function flushRAF() {
    const pending = [...rafCallbacks.entries()];
    for (const [id, cb] of pending) {
      rafCallbacks.delete(id);
      cb(performance.now());
    }
  }

  it('startThreeLoop returns the provided id', () => {
    const id = startThreeLoop(() => {}, 'three-test');
    expect(id).toBe('three-test');
  });

  it('callback fires when RAF flushes one frame', () => {
    const callback = vi.fn();
    startThreeLoop(callback, 'three-fire');
    flushRAF();
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('stopThreeLoop halts the loop', () => {
    const callback = vi.fn();
    startThreeLoop(callback, 'three-stop');
    stopThreeLoop('three-stop');
    const count = callback.mock.calls.length;
    flushRAF();
    expect(callback.mock.calls.length).toBe(count);
  });

  it('stopThreeLoop on unknown id is a no-op', () => {
    expect(() => stopThreeLoop('unknown-loop')).not.toThrow();
  });

  it('stopAllThreeLoops halts all active loops', () => {
    const cbA = vi.fn();
    const cbB = vi.fn();
    startThreeLoop(cbA, 'three-a');
    startThreeLoop(cbB, 'three-b');
    stopAllThreeLoops();
    const countA = cbA.mock.calls.length;
    const countB = cbB.mock.calls.length;
    flushRAF();
    expect(cbA.mock.calls.length).toBe(countA);
    expect(cbB.mock.calls.length).toBe(countB);
  });

  it('stopAllThreeLoops is idempotent', () => {
    startThreeLoop(() => {}, 'idem-three');
    stopAllThreeLoops();
    expect(() => stopAllThreeLoops()).not.toThrow();
  });

  it('replacing a loop id cancels the previous loop', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    startThreeLoop(cb1, 'replace-me');
    const before = cb1.mock.calls.length;
    startThreeLoop(cb2, 'replace-me');
    flushRAF();
    expect(cb1.mock.calls.length).toBe(before);
    expect(cb2.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
