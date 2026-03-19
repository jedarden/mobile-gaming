/**
 * Three.js bootstrap utilities
 *
 * Simplifies creating a basic 3D scene with PerspectiveCamera and WebGLRenderer.
 * All scenes use logical pixel dimensions for consistent sizing.
 */

import * as THREE from 'three';

/**
 * Active Three.js animation loops
 */
const activeLoops = new Map();

/**
 * Default configuration for Three.js scene creation
 */
const DEFAULTS = {
  fov: 45,
  near: 0.1,
  far: 1000,
  backgroundColor: 0x000000,
  antialias: true,
  alpha: false,
  pixelRatio: Math.min(window.devicePixelRatio || 1, 2) // Cap at 2 for performance
};

/**
 * Create a basic Three.js scene with camera and renderer
 *
 * @param {HTMLElement} container - Container element for the canvas
 * @param {Object} options - Configuration options
 * @param {number} options.fov - Camera field of view (default: 45)
 * @param {number} options.near - Camera near plane (default: 0.1)
 * @param {number} options.far - Camera far plane (default: 1000)
 * @param {number} options.logicalWidth - Logical width (default: container width)
 * @param {number} options.logicalHeight - Logical height (default: container height)
 * @param {number} options.backgroundColor - Background color hex (default: 0x000000)
 * @param {boolean} options.antialias - Enable antialiasing (default: true)
 * @param {boolean} options.alpha - Enable transparent background (default: false)
 * @param {number} options.pixelRatio - Custom pixel ratio (default: capped devicePixelRatio)
 * @param {THREE.Vector3} options.cameraPosition - Initial camera position (default: 0, 0, 100)
 * @returns {Object} { scene, camera, renderer, canvas }
 */
export function createThreeScene(container, options = {}) {
  const config = { ...DEFAULTS, ...options };

  // Get logical dimensions from container or options
  const logicalWidth = options.logicalWidth || container.clientWidth;
  const logicalHeight = options.logicalHeight || container.clientHeight;

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.backgroundColor);

  // Create camera
  const camera = new THREE.PerspectiveCamera(
    config.fov,
    logicalWidth / logicalHeight,
    config.near,
    config.far
  );

  // Set initial camera position
  if (options.cameraPosition) {
    camera.position.copy(options.cameraPosition);
  } else {
    camera.position.z = 100;
  }

  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: config.antialias,
    alpha: config.alpha
  });

  renderer.setPixelRatio(config.pixelRatio);
  renderer.setSize(logicalWidth, logicalHeight);

  // Prevent default touch actions
  renderer.domElement.style.touchAction = 'none';
  renderer.domElement.style.userSelect = 'none';

  // Add canvas to container
  container.appendChild(renderer.domElement);

  return {
    scene,
    camera,
    renderer,
    canvas: renderer.domElement
  };
}

/**
 * Resize a Three.js renderer and camera
 *
 * @param {THREE.WebGLRenderer} renderer - The renderer to resize
 * @param {THREE.PerspectiveCamera} camera - The camera to update
 * @param {number} logicalWidth - New logical width
 * @param {number} logicalHeight - New logical height
 */
export function resizeThreeRenderer(renderer, camera, logicalWidth, logicalHeight) {
  const aspect = logicalWidth / logicalHeight;

  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  renderer.setSize(logicalWidth, logicalHeight);
}

/**
 * Start a Three.js animation loop
 *
 * @param {Function} callback - Render function called each frame (timestamp)
 * @param {string} id - Unique identifier for this loop
 * @returns {string} The loop ID for cancellation
 */
export function startThreeLoop(callback, id) {
  // Cancel existing loop with same ID
  if (activeLoops.has(id)) {
    cancelAnimationFrame(activeLoops.get(id));
  }

  function loop(timestamp) {
    callback(timestamp);
    activeLoops.set(id, requestAnimationFrame(loop));
  }

  activeLoops.set(id, requestAnimationFrame(loop));
  return id;
}

/**
 * Stop a Three.js animation loop
 *
 * @param {string} id - Loop ID to cancel
 */
export function stopThreeLoop(id) {
  if (activeLoops.has(id)) {
    cancelAnimationFrame(activeLoops.get(id));
    activeLoops.delete(id);
  }
}

/**
 * Stop all active Three.js loops
 */
export function stopAllThreeLoops() {
  for (const id of activeLoops.keys()) {
    cancelAnimationFrame(activeLoops.get(id));
  }
  activeLoops.clear();
}

/**
 * Dispose of a Three.js scene and all its resources
 *
 * @param {THREE.Scene} scene - Scene to dispose
 * @param {THREE.WebGLRenderer} renderer - Renderer to dispose
 */
export function disposeThreeScene(scene, renderer) {
  // Traverse scene and dispose geometries and materials
  scene.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });

  // Dispose renderer
  renderer.dispose();
}

/**
 * Create a basic ambient + directional light setup
 *
 * @param {THREE.Scene} scene - Scene to add lights to
 * @param {Object} options - Light configuration
 * @param {number} options.ambientIntensity - Ambient light intensity (default: 0.5)
 * @param {number} options.directionalIntensity - Directional light intensity (default: 1.0)
 * @param {THREE.Vector3} options.directionalPosition - Directional light position (default: 10, 10, 10)
 * @returns {Object} { ambient, directional }
 */
export function createBasicLights(scene, options = {}) {
  const {
    ambientIntensity = 0.5,
    directionalIntensity = 1.0,
    directionalPosition
  } = options;

  const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xffffff, directionalIntensity);
  if (directionalPosition) {
    directional.position.copy(directionalPosition);
  } else {
    directional.position.set(10, 10, 10);
  }
  scene.add(directional);

  return { ambient, directional };
}

/**
 * Create a basic perspective camera positioned to view a target
 *
 * @param {number} fov - Field of view in degrees
 * @param {number} aspect - Aspect ratio (width / height)
 * @param {number} distance - Distance from target
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera(fov = 45, aspect = 1, distance = 100) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
  camera.position.z = distance;
  return camera;
}
