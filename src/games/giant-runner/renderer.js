/**
 * Giant Runner - Three.js Renderer
 *
 * Renders the game with:
 * - Ground plane with lane markers
 * - Player capsule with dynamic scale
 * - Collectible orbs
 * - Obstacles
 * - Boss capsule at end
 * - Smooth scale animations
 */

import * as THREE from 'three';
import { createThreeScene, resizeThreeRenderer, createBasicLights, stopThreeLoop, disposeThreeScene } from '../../shared/three-setup.js';
import { PLAYER_COLORS, COLLECTIBLE_COLORS } from './state.js';

// Visual constants
const GROUND_COLOR = 0x2D5A27;
const LANE_MARKER_COLOR = 0xFFFFFF;
const LANE_COUNT = 5;

/**
 * Create a renderer instance
 */
export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let playerMesh, bossMesh;
  let collectibleMeshes = [];
  let obstacleMeshes = [];
  let animationLoopId = null;
  let reducedMotion = false;

  // Target scale for smooth animation
  let targetScale = 1.0;
  let currentScale = 1.0;
  const SCALE_LERP_SPEED = 0.1;

  /**
   * Initialize the Three.js scene
   */
  function init() {
    const result = createThreeScene(container, {
      fov: 60,
      backgroundColor: 0x87CEEB, // Sky blue
      antialias: true,
      cameraPosition: new THREE.Vector3(0, 8, -10)
    });

    scene = result.scene;
    camera = result.camera;
    renderer = result.renderer;
    canvas = result.canvas;

    // Add lights
    createBasicLights(scene, {
      ambientIntensity: 0.6,
      directionalIntensity: 0.8,
      directionalPosition: new THREE.Vector3(5, 10, 5)
    });

    // Create ground plane
    createGround();

    // Look down at the course
    camera.lookAt(0, 0, 50);

    return canvas;
  }

  /**
   * Create the ground plane with lane markers
   */
  function createGround() {
    // Main ground
    const groundGeometry = new THREE.PlaneGeometry(20, 500);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: GROUND_COLOR });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 250);
    ground.receiveShadow = true;
    scene.add(ground);

    // Lane markers
    const markerMaterial = new THREE.MeshBasicMaterial({ color: LANE_MARKER_COLOR, transparent: true, opacity: 0.3 });
    const laneWidth = 1.2;

    for (let i = -2; i <= 2; i++) {
      const markerGeometry = new THREE.PlaneGeometry(0.1, 500);
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(i * laneWidth, 0.01, 250);
      scene.add(marker);
    }
  }

  /**
   * Create player capsule mesh
   */
  function createPlayerMesh(color) {
    const playerColor = PLAYER_COLORS[color] || PLAYER_COLORS.blue;

    // Use a capsule-like shape (cylinder + spheres)
    const group = new THREE.Group();

    // Body (capsule shape approximation with cylinder)
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.6, 8, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: playerColor,
      shininess: 100
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.5;
    group.add(body);

    // Add simple "face" features
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 0.7, 0.25);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 0.7, 0.25);
    group.add(rightEye);

    group.castShadow = true;

    return group;
  }

  /**
   * Create boss mesh
   */
  function createBossMesh(scale) {
    const group = new THREE.Group();

    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 0.8, 8, 16);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF4444,
      shininess: 50
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    group.add(body);

    // Angry eyes
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
    const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.15, 0.9, 0.35);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.15, 0.9, 0.35);
    group.add(rightEye);

    group.scale.set(scale, scale, scale);
    group.castShadow = true;

    return group;
  }

  /**
   * Create collectible orb mesh
   */
  function createCollectibleMesh(collectible, playerColor) {
    const isMatching = collectible.color === playerColor;
    const color = COLLECTIBLE_COLORS[collectible.color] || COLLECTIBLE_COLORS.blue;

    const geometry = new THREE.SphereGeometry(0.25, 16, 16);
    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 100,
      transparent: !isMatching,
      opacity: isMatching ? 1 : 0.7
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(collectible.x, 0.5, collectible.z);

    // Add glow effect for matching
    if (isMatching) {
      const glowGeometry = new THREE.SphereGeometry(0.35, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    }

    return mesh;
  }

  /**
   * Create obstacle mesh
   */
  function createObstacleMesh(obstacle) {
    const geometry = new THREE.BoxGeometry(obstacle.width, 1.5, 0.3);
    const material = new THREE.MeshPhongMaterial({
      color: 0x8B4513,
      shininess: 30
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(obstacle.x, 0.75, obstacle.z);

    return mesh;
  }

  /**
   * Resize the renderer
   */
  function resize(width, height) {
    resizeThreeRenderer(renderer, camera, width, height);
  }

  /**
   * Render the game state
   */
  function render(state) {
    // Clear old meshes
    collectibleMeshes.forEach(m => scene.remove(m));
    obstacleMeshes.forEach(m => scene.remove(m));
    collectibleMeshes = [];
    obstacleMeshes = [];

    // Create or update player mesh
    if (!playerMesh) {
      playerMesh = createPlayerMesh(state.player.color);
      scene.add(playerMesh);
    }

    // Smooth scale animation
    targetScale = state.player.scale;
    if (!reducedMotion) {
      currentScale += (targetScale - currentScale) * SCALE_LERP_SPEED;
    } else {
      currentScale = targetScale;
    }

    // Update player position and scale
    playerMesh.position.set(state.player.x, 0, state.player.z);
    playerMesh.scale.set(currentScale, currentScale, currentScale);

    // Update camera to follow player
    camera.position.z = state.player.z - 10;
    camera.lookAt(0, 0, state.player.z + 50);

    // Create collectible meshes
    state.collectibles.forEach(collectible => {
      if (!collectible.collected) {
        const mesh = createCollectibleMesh(collectible, state.player.color);
        collectibleMeshes.push(mesh);
        scene.add(mesh);
      }
    });

    // Create obstacle meshes
    if (state.obstacles) {
      state.obstacles.forEach(obstacle => {
        if (!obstacle.hit) {
          const mesh = createObstacleMesh(obstacle);
          obstacleMeshes.push(mesh);
          scene.add(mesh);
        }
      });
    }

    // Create or update boss mesh
    if (!bossMesh) {
      bossMesh = createBossMesh(state.boss.scale);
      scene.add(bossMesh);
    }
    bossMesh.position.set(0, 0, state.boss.z);

    // Render
    renderer.render(scene, camera);
  }

  /**
   * Animate boss fight result
   */
  function animateBossFight(won, onComplete) {
    if (reducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    const duration = won ? 1000 : 500;
    const startTime = performance.now();

    function animate(time) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);

      if (won) {
        // Boss shrinks and disappears
        const scale = state.boss.scale * (1 - progress);
        bossMesh.scale.set(scale, scale, scale);
        bossMesh.rotation.y = progress * Math.PI * 2;
      } else {
        // Player bounces back
        const bounce = Math.sin(progress * Math.PI) * 0.5;
        playerMesh.position.z -= bounce;
      }

      renderer.render(scene, camera);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(animate);
  }

  /**
   * Set reduced motion preference
   */
  function setReducedMotion(value) {
    reducedMotion = value;
  }

  /**
   * Dispose of all resources
   */
  function destroy() {
    if (animationLoopId) {
      stopThreeLoop(animationLoopId);
    }
    disposeThreeScene(scene, renderer);
  }

  /**
   * Get canvas element
   */
  function getCanvas() {
    return canvas;
  }

  return {
    init,
    resize,
    render,
    animateBossFight,
    setReducedMotion,
    destroy,
    get canvas() { return canvas; }
  };
}

export default { createRenderer };
