/**
 * Jelly Shift - Three.js Renderer
 *
 * Renders the game with:
 * - Tunnel corridor geometry
 * - Soft-body jelly blob with vertex displacement
 * - Wall planes with colored hole cutouts
 * - Pass squish animation + particle burst
 * - Fail splat + screen shake
 */

import * as THREE from 'three';
import { createThreeScene, resizeThreeRenderer, createBasicLights, disposeThreeScene } from '../../shared/three-setup.js';

// Visual constants — candy palette
const CORRIDOR_WIDTH = 6;
const CORRIDOR_HEIGHT = 4;
const CORRIDOR_LENGTH = 300;
const CORRIDOR_COLOR = 0x0d1040;
const CORRIDOR_FLOOR_COLOR = 0x080c2e;
const WALL_COLOR = 0x2a2060;
const HOLE_COLORS = {
  tall: 0x00ffcc,
  wide: 0xff3090,
  plus: 0xffe000
};
const BLOB_COLOR = 0xff2d78;    // candy hot pink
const BLOB_GLOW_COLOR = 0xff80c0;
const BLOB_OPACITY = 0.88;

export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let blobMesh, blobGlow, blobLight, corridorGroup;
  let wallMeshes = [];
  let particleSystem = null;
  let reducedMotion = false;

  // Animation state
  let shakeIntensity = 0;
  let shakeDecay = 0.9;
  let blobSquish = { x: 1, y: 1, z: 1 };
  let blobSquishTarget = { x: 1, y: 1, z: 1 };

  /**
   * Initialize the Three.js scene
   */
  function init() {
    const result = createThreeScene(container, {
      fov: 50,
      backgroundColor: 0x0a0a1a,
      antialias: true,
      cameraPosition: new THREE.Vector3(0, 1.5, -5)
    });

    scene = result.scene;
    camera = result.camera;
    renderer = result.renderer;
    canvas = result.canvas;

    // Add lights
    createBasicLights(scene, {
      ambientIntensity: 0.4,
      directionalIntensity: 0.8,
      directionalPosition: new THREE.Vector3(2, 5, 2)
    });

    // Add point light near blob for glow effect
    blobLight = new THREE.PointLight(BLOB_COLOR, 1.2, 20);
    blobLight.position.set(0, 1, 0);
    scene.add(blobLight);

    // Create corridor
    createCorridor();

    // Create blob
    createBlob();

    return canvas;
  }

  /**
   * Create the tunnel corridor
   */
  function createCorridor() {
    corridorGroup = new THREE.Group();

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(CORRIDOR_WIDTH, CORRIDOR_LENGTH);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: CORRIDOR_FLOOR_COLOR });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -CORRIDOR_HEIGHT / 2, CORRIDOR_LENGTH / 2);
    floor.receiveShadow = true;
    corridorGroup.add(floor);

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(CORRIDOR_WIDTH, CORRIDOR_LENGTH);
    const ceilingMaterial = new THREE.MeshLambertMaterial({ color: CORRIDOR_COLOR, side: THREE.BackSide });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CORRIDOR_HEIGHT / 2, CORRIDOR_LENGTH / 2);
    corridorGroup.add(ceiling);

    // Left wall
    const sideWallGeometry = new THREE.PlaneGeometry(CORRIDOR_LENGTH, CORRIDOR_HEIGHT);
    const sideWallMaterial = new THREE.MeshLambertMaterial({ color: CORRIDOR_COLOR, side: THREE.BackSide });
    const leftWall = new THREE.Mesh(sideWallGeometry, sideWallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-CORRIDOR_WIDTH / 2, 0, CORRIDOR_LENGTH / 2);
    corridorGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(sideWallGeometry.clone(), sideWallMaterial.clone());
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(CORRIDOR_WIDTH / 2, 0, CORRIDOR_LENGTH / 2);
    corridorGroup.add(rightWall);

    // Lane lines on floor for depth perception
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2a4e, transparent: true, opacity: 0.5 });
    for (let i = -1; i <= 1; i += 2) {
      const lineGeo = new THREE.PlaneGeometry(0.05, CORRIDOR_LENGTH);
      const line = new THREE.Mesh(lineGeo, lineMaterial);
      line.rotation.x = -Math.PI / 2;
      line.position.set(i * CORRIDOR_WIDTH / 4, -CORRIDOR_HEIGHT / 2 + 0.01, CORRIDOR_LENGTH / 2);
      corridorGroup.add(line);
    }

    scene.add(corridorGroup);
  }

  /**
   * Create the jelly blob mesh
   */
  function createBlob() {
    const geometry = new THREE.SphereGeometry(0.5, 32, 24);

    const material = new THREE.MeshPhysicalMaterial({
      color: BLOB_COLOR,
      transparent: true,
      opacity: BLOB_OPACITY,
      roughness: 0.2,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.3,
      thickness: 0.5,
      envMapIntensity: 0.5,
    });

    blobMesh = new THREE.Mesh(geometry, material);
    blobMesh.position.set(0, 0, 0);
    blobMesh.castShadow = true;
    scene.add(blobMesh);

    // Inner glow sphere (slightly larger, emissive)
    const glowGeo = new THREE.SphereGeometry(0.62, 20, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: BLOB_GLOW_COLOR,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide
    });
    blobGlow = new THREE.Mesh(glowGeo, glowMat);
    blobMesh.add(blobGlow);
  }

  /**
   * Update blob shape based on width/height
   */
  function updateBlobShape(width, height) {
    if (!blobMesh) return;

    const scaleX = width;
    const scaleY = height;
    const scaleZ = width; // Keep depth proportional to width

    blobMesh.scale.set(
      scaleX * blobSquish.x,
      scaleY * blobSquish.y,
      scaleZ * blobSquish.z
    );

    // Slight wobble effect based on deformation
    const deformation = Math.abs(width - 1.0);
    if (!reducedMotion) {
      const time = performance.now() * 0.003;
      const wobbleX = 1 + Math.sin(time * 2) * deformation * 0.03;
      const wobbleY = 1 + Math.cos(time * 2.5) * deformation * 0.03;
      blobMesh.scale.x *= wobbleX;
      blobMesh.scale.y *= wobbleY;
    }
  }

  /**
   * Create wall mesh with hole cutout
   */
  function createWallMesh(wall) {
    const group = new THREE.Group();
    const hole = wall.hole;
    const holeColor = HOLE_COLORS[hole.shape] || 0xffffff;
    const wallThickness = 0.3;

    // Full wall plane (background)
    const wallGeo = new THREE.PlaneGeometry(CORRIDOR_WIDTH, CORRIDOR_HEIGHT);
    const wallMat = new THREE.MeshLambertMaterial({
      color: WALL_COLOR,
      side: THREE.DoubleSide
    });
    const wallPlane = new THREE.Mesh(wallGeo, wallMat);
    wallPlane.position.z = 0;
    group.add(wallPlane);

    // Hole cutout - rendered as a colored plane in front
    if (hole.shape === 'tall' || hole.shape === 'wide') {
      const holeGeo = new THREE.PlaneGeometry(hole.width, hole.height);
      const holeMat = new THREE.MeshBasicMaterial({
        color: holeColor,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      });
      const holeMesh = new THREE.Mesh(holeGeo, holeMat);
      holeMesh.position.z = 0.01;
      group.add(holeMesh);

      // Hole border glow
      const borderGeo = new THREE.EdgesGeometry(holeGeo);
      const borderMat = new THREE.LineBasicMaterial({ color: holeColor, linewidth: 2 });
      const border = new THREE.LineSegments(borderGeo, borderMat);
      border.position.z = 0.02;
      group.add(border);
    } else if (hole.shape === 'plus') {
      // Horizontal rectangle
      const hGeo = new THREE.PlaneGeometry(hole.widthH, hole.heightH);
      const hMat = new THREE.MeshBasicMaterial({
        color: holeColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const hMesh = new THREE.Mesh(hGeo, hMat);
      hMesh.position.z = 0.01;
      group.add(hMesh);

      // Vertical rectangle
      const vGeo = new THREE.PlaneGeometry(hole.widthV, hole.heightV);
      const vMat = new THREE.MeshBasicMaterial({
        color: holeColor,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      });
      const vMesh = new THREE.Mesh(vGeo, vMat);
      vMesh.position.z = 0.02;
      group.add(vMesh);

      // Borders
      const hBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(hGeo),
        new THREE.LineBasicMaterial({ color: holeColor })
      );
      hBorder.position.z = 0.03;
      group.add(hBorder);

      const vBorder = new THREE.LineSegments(
        new THREE.EdgesGeometry(vGeo),
        new THREE.LineBasicMaterial({ color: holeColor })
      );
      vBorder.position.z = 0.04;
      group.add(vBorder);
    }

    group.position.z = wall.z;
    return group;
  }

  /**
   * Spawn particle burst (pass effect)
   */
  function spawnParticles(position, color) {
    if (reducedMotion) return;

    // Remove old particles
    if (particleSystem) {
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
    }

    const count = 60;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      velocities.push({
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 4,
        z: (Math.random() - 0.5) * 2
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.1,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });

    particleSystem = new THREE.Points(geometry, material);
    particleSystem._velocities = velocities;
    particleSystem._life = 1.0;
    scene.add(particleSystem);
  }

  /**
   * Update particles
   */
  function updateParticles(dt) {
    if (!particleSystem) return;

    particleSystem._life -= dt * 2;
    if (particleSystem._life <= 0) {
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
      particleSystem = null;
      return;
    }

    const positions = particleSystem.geometry.attributes.position.array;
    const velocities = particleSystem._velocities;

    for (let i = 0; i < velocities.length; i++) {
      positions[i * 3] += velocities[i].x * dt;
      positions[i * 3 + 1] += velocities[i].y * dt;
      positions[i * 3 + 2] += velocities[i].z * dt;
      velocities[i].y -= 5 * dt; // gravity
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.material.opacity = particleSystem._life;
  }

  /**
   * Trigger squish animation (on wall pass)
   */
  function triggerSquish() {
    if (reducedMotion) return;
    // Anticipation: briefly stretch vertically, then squash hard
    blobSquishTarget = { x: 0.85, y: 1.3, z: 0.85 };
    setTimeout(() => {
      blobSquishTarget = { x: 1.45, y: 0.55, z: 0.9 };
      setTimeout(() => {
        blobSquishTarget = { x: 0.9, y: 1.15, z: 0.9 };
        setTimeout(() => { blobSquishTarget = { x: 1, y: 1, z: 1 }; }, 120);
      }, 100);
    }, 60);
  }

  /**
   * Trigger splat animation (on wall fail)
   */
  function triggerSplat() {
    if (reducedMotion) return;
    blobSquishTarget = { x: 2.2, y: 0.22, z: 0.55 };
    shakeIntensity = 0.5;
  }

  /**
   * Update screen shake
   */
  function updateShake() {
    if (shakeIntensity > 0.001) {
      shakeIntensity *= shakeDecay;
    } else {
      shakeIntensity = 0;
    }
  }

  /**
   * Update blob squish interpolation
   */
  function updateBlobSquish() {
    const lerp = 0.15;
    blobSquish.x += (blobSquishTarget.x - blobSquish.x) * lerp;
    blobSquish.y += (blobSquishTarget.y - blobSquish.y) * lerp;
    blobSquish.z += (blobSquishTarget.z - blobSquish.z) * lerp;
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
  function render(state, dt = 1 / 60) {
    // Update animations
    updateBlobSquish();
    updateShake();
    updateParticles(dt);

    // Update blob
    if (blobMesh) {
      blobMesh.position.set(0, 0, state.blob.z);
      updateBlobShape(state.blob.width, state.blob.height);

      // Pulse glow based on deformation
      if (blobGlow && !reducedMotion) {
        const deform = Math.abs(state.blob.width - 1.0);
        const pulse = 0.15 + deform * 0.25 + Math.sin(performance.now() * 0.004) * 0.04;
        blobGlow.material.opacity = pulse;
      }
      if (blobLight) {
        blobLight.position.set(0, 0, state.blob.z);
        const deform = Math.abs(state.blob.width - 1.0);
        blobLight.intensity = 1.0 + deform * 0.8;
      }
    }

    // Move corridor to follow blob
    if (corridorGroup) {
      corridorGroup.position.z = state.blob.z - 10;
    }

    // Update walls - remove passed ones, add new ones in view
    updateWalls(state);

    // Camera follows blob
    camera.position.set(0, 1.5, state.blob.z - 5);

    // Apply screen shake
    if (shakeIntensity > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    }

    camera.lookAt(0, 0, state.blob.z + 15);

    renderer.render(scene, camera);
  }

  /**
   * Update wall meshes - only show walls near the blob
   */
  function updateWalls(state) {
    const viewRange = 40;

    // Remove walls too far behind or too far ahead
    wallMeshes = wallMeshes.filter(wm => {
      const wallZ = wm.userData.wallZ;
      if (state.blob.z - wallZ > 10 || wallZ - state.blob.z > viewRange) {
        scene.remove(wm);
        return false;
      }
      return true;
    });

    // Add walls coming into view
    for (const wall of state.walls) {
      const inView = wall.z - state.blob.z <= viewRange && wall.z - state.blob.z > -10;
      const alreadyAdded = wallMeshes.some(wm => wm.userData.wallZ === wall.z);

      if (inView && !alreadyAdded) {
        const mesh = createWallMesh(wall);
        mesh.userData.wallZ = wall.z;
        wallMeshes.push(mesh);
        scene.add(mesh);
      }
    }
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
    wallMeshes.forEach(wm => scene.remove(wm));
    wallMeshes = [];

    if (particleSystem) {
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
      particleSystem = null;
    }

    if (corridorGroup) {
      scene.remove(corridorGroup);
    }

    if (blobMesh) {
      scene.remove(blobMesh);
    }

    disposeThreeScene(scene, renderer);
  }

  return {
    init,
    resize,
    render,
    triggerSquish,
    triggerSplat,
    spawnParticles,
    setReducedMotion,
    destroy,
    get canvas() { return canvas; }
  };
}

export default { createRenderer };
