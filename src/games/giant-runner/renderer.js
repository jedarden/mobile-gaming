/**
 * Giant Runner - Three.js Renderer (polished)
 *
 * Visual improvements:
 * - Decorative cone trees lining the course sides
 * - Player power aura (ring) that expands with scale milestones
 * - Collectibles bob + rotate for juiciness
 * - Camera shake on obstacle hit
 * - Scale milestone flash: brief emissive pulse on player at integer thresholds
 * - Animated sky gradient via fog
 * - Boss fight scale comparison ring
 */

import * as THREE from 'three';
import { createThreeScene, resizeThreeRenderer, createBasicLights, stopThreeLoop, disposeThreeScene } from '../../shared/three-setup.js';
import { PLAYER_COLORS, COLLECTIBLE_COLORS } from './state.js';

// Visual constants
const GROUND_COLOR = 0x2D5A27;
const LANE_MARKER_COLOR = 0xFFFFFF;
const TREE_SPACING = 15;
const TREE_COUNT = 30;

/**
 * Create a renderer instance
 */
export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let playerMesh, bossMesh, playerAura;
  let collectibleMeshes = [];
  let obstacleMeshes = [];
  let treeMeshes = [];
  let animationLoopId = null;
  let reducedMotion = false;

  // Target scale for smooth animation
  let targetScale = 1.0;
  let currentScale = 1.0;
  const SCALE_LERP_SPEED = 0.1;

  // Camera shake
  let shakeUntil = 0;
  let shakeAmp = 0;

  // Scale milestone tracking
  let lastMilestone = 0;
  let milestoneFlashUntil = 0;

  // Previous scale for hit detection
  let prevScale = 1.0;

  // Last rendered state (used by animateBossFight)
  let lastRenderedState = null;

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

    // Subtle fog for depth
    scene.fog = new THREE.Fog(0x87CEEB, 60, 200);

    // Create ground plane
    createGround();

    // Create decorative trees
    createTrees();

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
   * Create decorative cone trees along both sides of the course
   */
  function createTrees() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const darkLeafMat = new THREE.MeshLambertMaterial({ color: 0x145214 });

    for (let i = 0; i < TREE_COUNT; i++) {
      const z = i * TREE_SPACING + 10;
      const side = i % 2 === 0 ? -1 : 1;
      const xBase = (4.5 + (i % 3) * 0.8) * side;

      const group = new THREE.Group();

      // Trunk
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 0.6, 6),
        trunkMat
      );
      trunk.position.y = 0.3;
      group.add(trunk);

      // Leaf cone (2 layers)
      const mat = i % 3 === 0 ? darkLeafMat : leafMat;
      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 7), mat);
      cone1.position.y = 1.2;
      group.add(cone1);

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 7), mat);
      cone2.position.y = 1.8;
      group.add(cone2);

      group.position.set(xBase, 0, z);
      // Slight scale variety
      const sc = 0.8 + (i % 5) * 0.1;
      group.scale.setScalar(sc);

      scene.add(group);
      treeMeshes.push(group);
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

    // Power aura ring
    const auraGeom = new THREE.TorusGeometry(0.6, 0.06, 8, 32);
    const auraMat = new THREE.MeshBasicMaterial({
      color: PLAYER_COLORS[color] || 0x4488FF,
      transparent: true,
      opacity: 0.0
    });
    playerAura = new THREE.Mesh(auraGeom, auraMat);
    playerAura.rotation.x = Math.PI / 2;
    playerAura.position.y = 0.05;
    group.add(playerAura);

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
    lastRenderedState = state;
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

    const now = performance.now();

    // Smooth scale animation
    targetScale = state.player.scale;
    if (!reducedMotion) {
      currentScale += (targetScale - currentScale) * SCALE_LERP_SPEED;
    } else {
      currentScale = targetScale;
    }

    // Scale milestone detection (integer thresholds)
    const milestone = Math.floor(state.player.scale);
    if (milestone > lastMilestone && milestone > 1) {
      lastMilestone = milestone;
      milestoneFlashUntil = now + 400;
    }

    // Obstacle hit detection (scale decreased)
    if (state.player.scale < prevScale - 0.5 && !reducedMotion) {
      shakeUntil = now + 350;
      shakeAmp = 0.3;
    }
    prevScale = state.player.scale;

    // Update player position and scale
    playerMesh.position.set(state.player.x, 0, state.player.z);
    playerMesh.scale.set(currentScale, currentScale, currentScale);

    // Milestone flash — make player emissive briefly
    if (playerMesh.children[0] && playerMesh.children[0].material) {
      const bodyMat = playerMesh.children[0].material;
      if (now < milestoneFlashUntil) {
        const t = (milestoneFlashUntil - now) / 400;
        bodyMat.emissive = new THREE.Color(1, 1, 0.2);
        bodyMat.emissiveIntensity = t * 0.8;
      } else {
        bodyMat.emissiveIntensity = 0;
      }
    }

    // Power aura: visible and scaled when above threshold
    if (playerAura) {
      const auraStrength = Math.min((currentScale - 1) / 4, 1);
      playerAura.material.opacity = auraStrength * 0.65;
      playerAura.scale.setScalar(1 + auraStrength * 0.3);
      // Pulse rotation
      playerAura.rotation.z = now * 0.001;
    }

    // Camera shake
    let shakeX = 0, shakeY = 0;
    if (now < shakeUntil && !reducedMotion) {
      const decay = (shakeUntil - now) / 350;
      shakeX = Math.sin(now * 0.04) * shakeAmp * decay;
      shakeY = Math.cos(now * 0.03) * shakeAmp * decay;
    }

    // Update camera to follow player
    const camDist = Math.max(10, 10 + currentScale * 2);
    camera.position.set(shakeX, 8 + shakeY, state.player.z - camDist);
    camera.lookAt(0, 0, state.player.z + 50);

    // Create collectible meshes
    state.collectibles.forEach(collectible => {
      if (!collectible.collected) {
        const mesh = createCollectibleMesh(collectible, state.player.color);
        collectibleMeshes.push(mesh);
        scene.add(mesh);
        // Bob offset based on Z position for variety
        if (!reducedMotion) {
          mesh.position.y = 0.5 + Math.sin(now * 0.003 + collectible.z * 0.5) * 0.12;
          mesh.rotation.y = now * 0.002 + collectible.z;
        }
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
        const scale = (lastRenderedState ? lastRenderedState.boss.scale : 1) * (1 - progress);
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
