/**
 * Bridge Race - Three.js Renderer
 *
 * Scene elements:
 *  - Arena: flat green ground plane, bridge gaps as dark void planes
 *  - Player: blue box mesh
 *  - Opponents: colored box meshes
 *  - Block piles: small colored cube stacks (height proportional to count)
 *  - Bridges: row of cube slots; filled = entity color, empty = translucent gray
 *  - Camera: top-down perspective, follows player z
 *  - Win animation: jump + confetti particles
 */

import * as THREE from 'three';
import {
  createThreeScene,
  resizeThreeRenderer,
  createBasicLights
} from '../../shared/three-setup.js';

// Camera settings
const CAMERA_HEIGHT   = 20;
const CAMERA_BACK     = 15;
const CAMERA_LOOKAHEAD = 10;

// Entity sizes
const ENTITY_HEIGHT = 1.6;
const ENTITY_WIDTH  = 0.8;

// Color map
const COLOR_HEX = {
  blue:   0x4DABF7,
  red:    0xFF6B6B,
  green:  0x69DB7C,
  yellow: 0xFFD93D,
  purple: 0xCC5DE8,
  orange: 0xFFA94D
};

function getColorHex(color) {
  return COLOR_HEX[color] || 0xffffff;
}

export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let playerMesh = null;
  let opponentMeshes = [];
  let pileMeshes = [];
  let bridgeGroups = [];
  let groundMesh = null;
  let finishLineMesh = null;
  let confettiParticles = [];
  let reducedMotion = false;

  // Track last state for lazy setup
  let lastBridgeCount = -1;
  let lastPileCount   = -1;
  let lastOpponentCount = -1;

  function init() {
    const result = createThreeScene(container, {
      fov: 50,
      backgroundColor: 0x87CEEB,
      antialias: true,
      cameraPosition: new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK)
    });

    scene    = result.scene;
    camera   = result.camera;
    renderer = result.renderer;
    canvas   = result.canvas;

    createBasicLights(scene, {
      ambientIntensity: 0.6,
      directionalIntensity: 0.9,
      directionalPosition: new THREE.Vector3(8, 15, -5)
    });

    buildGround();
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  function buildGround() {
    // Large ground plane
    const geo = new THREE.PlaneGeometry(30, 2000);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a9e4a });
    groundMesh = new THREE.Mesh(geo, mat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.05, 1000);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Side walls
    const wallGeo = new THREE.BoxGeometry(0.5, 2, 2000);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    [-12, 12].forEach(x => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, 1, 1000);
      scene.add(wall);
    });
  }

  // ── Setup bridges ─────────────────────────────────────────────────────────

  function setupBridges(bridges) {
    bridgeGroups.forEach(g => scene.remove(g));
    bridgeGroups = [];

    for (const bridge of bridges) {
      const group = buildBridgeGroup(bridge);
      scene.add(group);
      bridgeGroups.push(group);
    }
  }

  function buildBridgeGroup(bridge) {
    const group = new THREE.Group();
    group.userData.bridgeId = bridge.id;

    // Dark void gap beneath bridge
    const gapGeo = new THREE.PlaneGeometry(30, 3);
    const gapMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const gap = new THREE.Mesh(gapGeo, gapMat);
    gap.rotation.x = -Math.PI / 2;
    gap.position.set(0, -0.02, bridge.z);
    group.add(gap);

    // Cell slots - evenly spread across arena width
    const cellWidth = 22 / bridge.required;
    for (let i = 0; i < bridge.required; i++) {
      const cx = -11 + cellWidth * i + cellWidth / 2;
      const cellGeo = new THREE.BoxGeometry(cellWidth - 0.2, 0.2, 2.5);
      const cellMat = new THREE.MeshPhongMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.5
      });
      const cell = new THREE.Mesh(cellGeo, cellMat);
      cell.position.set(cx, 0.1, bridge.z);
      cell.userData.cellIdx = i;
      group.add(cell);
    }

    return group;
  }

  function updateBridgeCells(bridges) {
    for (let i = 0; i < bridges.length; i++) {
      const bridge = bridges[i];
      const group = bridgeGroups[i];
      if (!group) continue;

      // cell meshes start at index 1 (gap is index 0)
      const cellWidth = 22 / bridge.required;
      const cellMeshes = group.children.filter(c => c.userData.cellIdx !== undefined);

      for (let j = 0; j < bridge.cells.length; j++) {
        const cell = cellMeshes[j];
        if (!cell) continue;

        const color = bridge.cells[j];
        if (color) {
          cell.material.color.setHex(getColorHex(color));
          cell.material.transparent = false;
          cell.material.opacity = 1;
        } else {
          cell.material.color.setHex(0x888888);
          cell.material.transparent = true;
          cell.material.opacity = 0.5;
        }
      }
    }
  }

  // ── Block piles ───────────────────────────────────────────────────────────

  function setupPiles(piles) {
    pileMeshes.forEach(m => scene.remove(m));
    pileMeshes = [];

    for (const pile of piles) {
      const group = buildPileGroup(pile);
      scene.add(group);
      pileMeshes.push(group);
    }
  }

  function buildPileGroup(pile) {
    const group = new THREE.Group();
    group.userData.pileId = pile.id;
    group.position.set(pile.x, 0, pile.z);

    const maxCount = 10;
    const height = Math.max(0.3, (pile.count / maxCount) * 2.5);
    const geo = new THREE.BoxGeometry(0.8, height, 0.8);
    const mat = new THREE.MeshPhongMaterial({ color: getColorHex(pile.color) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, height / 2, 0);
    group.add(mesh);

    return group;
  }

  function updatePiles(piles) {
    for (let i = 0; i < piles.length; i++) {
      const pile = piles[i];
      const group = pileMeshes[i];
      if (!group) continue;

      group.visible = pile.count > 0;
      if (pile.count > 0) {
        const maxCount = 10;
        const height = Math.max(0.3, (pile.count / maxCount) * 2.5);
        const mesh = group.children[0];
        if (mesh) {
          mesh.scale.y = height / 2.5; // normalized
        }
      }
    }
  }

  // ── Entities ──────────────────────────────────────────────────────────────

  function buildEntityMesh(color, y = 0) {
    const geo = new THREE.BoxGeometry(ENTITY_WIDTH, ENTITY_HEIGHT, ENTITY_WIDTH);
    const mat = new THREE.MeshPhongMaterial({ color: getColorHex(color), shininess: 60 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = ENTITY_HEIGHT / 2;
    return mesh;
  }

  function setupPlayer(playerColor) {
    if (playerMesh) scene.remove(playerMesh);
    playerMesh = buildEntityMesh(playerColor);
    scene.add(playerMesh);
  }

  function setupOpponents(opponents) {
    opponentMeshes.forEach(m => scene.remove(m));
    opponentMeshes = [];

    for (const opp of opponents) {
      const mesh = buildEntityMesh(opp.color);
      scene.add(mesh);
      opponentMeshes.push(mesh);
    }
  }

  function setupFinishLine(finishZ) {
    if (finishLineMesh) scene.remove(finishLineMesh);
    const geo = new THREE.PlaneGeometry(24, 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFD700, side: THREE.DoubleSide });
    finishLineMesh = new THREE.Mesh(geo, mat);
    finishLineMesh.rotation.x = -Math.PI / 2;
    finishLineMesh.position.set(0, 0.05, finishZ);
    scene.add(finishLineMesh);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(state) {
    // Lazy setup
    if (lastBridgeCount !== state.bridges.length) {
      setupBridges(state.bridges);
      setupFinishLine(state.finishZ);
      lastBridgeCount = state.bridges.length;
    }
    if (lastPileCount !== state.blockPiles.length) {
      setupPiles(state.blockPiles);
      lastPileCount = state.blockPiles.length;
    }
    if (lastOpponentCount !== state.opponents.length) {
      setupPlayer(state.player.color);
      setupOpponents(state.opponents);
      lastOpponentCount = state.opponents.length;
    }

    // Update player mesh
    if (playerMesh) {
      playerMesh.position.set(state.player.x, ENTITY_HEIGHT / 2, state.player.z);
    }

    // Update opponent meshes
    for (let i = 0; i < state.opponents.length; i++) {
      const mesh = opponentMeshes[i];
      const opp  = state.opponents[i];
      if (mesh && opp) {
        mesh.position.set(opp.x, ENTITY_HEIGHT / 2, opp.z);
      }
    }

    // Update bridge cells
    updateBridgeCells(state.bridges);

    // Update piles
    updatePiles(state.blockPiles);

    // Camera follows player z from above and behind
    const targetZ = state.player.z - CAMERA_BACK;
    if (reducedMotion) {
      camera.position.set(state.player.x * 0.2, CAMERA_HEIGHT, targetZ);
    } else {
      camera.position.x += (state.player.x * 0.2 - camera.position.x) * 0.08;
      camera.position.y  = CAMERA_HEIGHT;
      camera.position.z += (targetZ - camera.position.z) * 0.12;
    }
    camera.lookAt(state.player.x * 0.1, 0, state.player.z + CAMERA_LOOKAHEAD);

    renderer.render(scene, camera);
  }

  // ── Win animation ─────────────────────────────────────────────────────────

  function animateResult(won, onComplete) {
    if (reducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    if (won) {
      spawnConfetti();
    }

    const startTime = performance.now();
    const duration  = won ? 1500 : 700;

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);

      // Player jump
      if (playerMesh && won) {
        playerMesh.position.y = ENTITY_HEIGHT / 2 + Math.sin(t * Math.PI * 3) * 2;
      }

      // Animate confetti
      updateConfetti(t);

      renderer.render(scene, camera);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // Clean up confetti
        confettiParticles.forEach(p => scene.remove(p));
        confettiParticles = [];
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function spawnConfetti() {
    const colors = [0xFF6B6B, 0x4DABF7, 0xFFD93D, 0x69DB7C, 0xCC5DE8, 0xFFA94D];
    for (let i = 0; i < 40; i++) {
      const geo = new THREE.BoxGeometry(0.3, 0.3, 0.05);
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 12,
        Math.random() * 6 + 2,
        (playerMesh ? playerMesh.position.z : 0) + (Math.random() - 0.5) * 8
      );
      mesh.userData.velocity = {
        x: (Math.random() - 0.5) * 0.1,
        y: (Math.random() - 0.3) * 0.08,
        z: (Math.random() - 0.5) * 0.1
      };
      scene.add(mesh);
      confettiParticles.push(mesh);
    }
  }

  function updateConfetti(t) {
    confettiParticles.forEach(p => {
      p.position.x += p.userData.velocity.x;
      p.position.y += p.userData.velocity.y - 0.02; // gravity
      p.position.z += p.userData.velocity.z;
      p.rotation.x += 0.05;
      p.rotation.z += 0.03;
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function resize(width, height) {
    resizeThreeRenderer(renderer, camera, width, height);
  }

  function setReducedMotion(value) {
    reducedMotion = value;
  }

  function resetLevel() {
    lastBridgeCount   = -1;
    lastPileCount     = -1;
    lastOpponentCount = -1;
  }

  function destroy() {
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    bridgeGroups.forEach(g => scene.remove(g));
    bridgeGroups = [];
    pileMeshes.forEach(m => scene.remove(m));
    pileMeshes = [];
    opponentMeshes.forEach(m => scene.remove(m));
    opponentMeshes = [];
    if (playerMesh) scene.remove(playerMesh);
  }

  return {
    init,
    render,
    resize,
    animateResult,
    setReducedMotion,
    resetLevel,
    destroy,
    get canvas() { return canvas; }
  };
}

export default { createRenderer };
