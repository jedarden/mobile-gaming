import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock THREE.js before importing the module under test
const mockScene = {
  add: vi.fn(),
  traverse: vi.fn(),
  background: null
};
const mockCamera = {
  aspect: 0,
  position: { z: 0, copy: vi.fn() },
  updateProjectionMatrix: vi.fn()
};
const mockRenderer = {
  setPixelRatio: vi.fn(),
  setSize: vi.fn(),
  domElement: { style: {}, appendChild: vi.fn() },
  dispose: vi.fn()
};

vi.mock('three', () => ({
  Scene: vi.fn(() => mockScene),
  PerspectiveCamera: vi.fn(() => mockCamera),
  WebGLRenderer: vi.fn(() => mockRenderer),
  Color: vi.fn((c) => c),
  AmbientLight: vi.fn((c, i) => ({ type: 'AmbientLight' })),
  DirectionalLight: vi.fn((c, i) => ({
    type: 'DirectionalLight',
    position: { copy: vi.fn(), set: vi.fn() }
  })),
  Vector3: vi.fn((x, y, z) => ({ x, y, z, copy: vi.fn() }))
}));

import {
  createThreeScene, resizeThreeRenderer,
  startThreeLoop, stopThreeLoop, stopAllThreeLoops,
  disposeThreeScene, createBasicLights, createCamera
} from '../../src/shared/three-setup.js';
import * as THREE from 'three';

describe('three-setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCamera.aspect = 0;
    mockCamera.position.z = 0;
    global.window = { devicePixelRatio: 1 };
  });

  describe('createThreeScene', () => {
    it('creates a scene with camera and renderer', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      const result = createThreeScene(container);

      expect(result.scene).toBeDefined();
      expect(result.camera).toBeDefined();
      expect(result.renderer).toBeDefined();
      expect(result.canvas).toBeDefined();
    });

    it('uses container dimensions by default', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      createThreeScene(container);

      expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(
        45, 390 / 844, 0.1, 1000
      );
      expect(mockRenderer.setSize).toHaveBeenCalledWith(390, 844);
    });

    it('uses custom dimensions when provided', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      createThreeScene(container, { logicalWidth: 200, logicalHeight: 400 });

      expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(
        45, 200 / 400, 0.1, 1000
      );
    });

    it('sets camera position to z:100 by default', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      const result = createThreeScene(container);
      // The constructor creates camera at z:0, then createThreeScene sets z:100
      expect(mockCamera.position.z).toBe(100);
    });

    it('uses custom camera position when provided', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      createThreeScene(container, { cameraPosition: { x: 0, y: 5, z: 50, copy: vi.fn() } });
      // With custom cameraPosition, copy() is called
      expect(mockCamera.position.copy).toHaveBeenCalled();
    });

    it('prevents default touch actions', () => {
      const container = { clientWidth: 390, clientHeight: 844, appendChild: vi.fn() };
      const result = createThreeScene(container);
      expect(result.canvas.style.touchAction).toBe('none');
      expect(result.canvas.style.userSelect).toBe('none');
    });
  });

  describe('resizeThreeRenderer', () => {
    it('updates camera aspect and renderer size', () => {
      const camera = { aspect: 0, updateProjectionMatrix: vi.fn() };
      const renderer = { setSize: vi.fn() };

      resizeThreeRenderer(renderer, camera, 200, 400);

      expect(camera.aspect).toBe(0.5);
      expect(camera.updateProjectionMatrix).toHaveBeenCalled();
      expect(renderer.setSize).toHaveBeenCalledWith(200, 400);
    });
  });

  describe('animation loops', () => {
    let rafCallbacks;
    let rafId;

    beforeEach(() => {
      rafCallbacks = {};
      rafId = 0;
      global.requestAnimationFrame = vi.fn((cb) => {
        const id = ++rafId;
        rafCallbacks[id] = cb;
        return id;
      });
      global.cancelAnimationFrame = vi.fn((id) => {
        delete rafCallbacks[id];
      });
    });

    it('startThreeLoop returns the id', () => {
      const id = startThreeLoop(() => {}, 'test');
      expect(id).toBe('test');
    });

    it('callback receives only timestamp', () => {
      const callback = vi.fn();
      startThreeLoop(callback, 'test');

      // Simulate one frame
      const frameCallback = Object.values(rafCallbacks)[0];
      frameCallback(16.67);

      expect(callback).toHaveBeenCalledWith(16.67);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('stopThreeLoop cancels the animation frame', () => {
      startThreeLoop(() => {}, 'test');
      stopThreeLoop('test');
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('stopThreeLoop is a no-op for unknown id', () => {
      expect(() => stopThreeLoop('unknown')).not.toThrow();
    });

    it('stopAllThreeLoops cancels all loops', () => {
      startThreeLoop(() => {}, 'a');
      startThreeLoop(() => {}, 'b');
      stopAllThreeLoops();
      expect(global.cancelAnimationFrame).toHaveBeenCalledTimes(2);
    });

    it('replacing a loop with same id cancels the old one', () => {
      startThreeLoop(() => {}, 'test');
      startThreeLoop(() => {}, 'test');
      expect(global.cancelAnimationFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe('disposeThreeScene', () => {
    it('traverses scene and disposes renderer', () => {
      const geo = { dispose: vi.fn() };
      const mat = { dispose: vi.fn() };
      const scene = { traverse: vi.fn((fn) => fn({ geometry: geo, material: mat })) };
      const renderer = { dispose: vi.fn() };

      disposeThreeScene(scene, renderer);

      expect(scene.traverse).toHaveBeenCalled();
      expect(geo.dispose).toHaveBeenCalled();
      expect(mat.dispose).toHaveBeenCalled();
      expect(renderer.dispose).toHaveBeenCalled();
    });

    it('handles material arrays', () => {
      const mat1 = { dispose: vi.fn() };
      const mat2 = { dispose: vi.fn() };
      const scene = { traverse: vi.fn((fn) => fn({ geometry: null, material: [mat1, mat2] })) };
      const renderer = { dispose: vi.fn() };

      disposeThreeScene(scene, renderer);

      expect(mat1.dispose).toHaveBeenCalled();
      expect(mat2.dispose).toHaveBeenCalled();
    });
  });

  describe('createBasicLights', () => {
    it('creates ambient and directional lights', () => {
      const scene = { add: vi.fn() };
      const result = createBasicLights(scene);

      expect(result.ambient).toBeDefined();
      expect(result.directional).toBeDefined();
      expect(scene.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('createCamera', () => {
    it('creates a camera with default settings', () => {
      createCamera();
      expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(45, 1, 0.1, 1000);
    });

    it('creates a camera with custom settings', () => {
      createCamera(60, 1.5, 200);
      expect(THREE.PerspectiveCamera).toHaveBeenCalledWith(60, 1.5, 0.1, 1000);
    });
  });
});
