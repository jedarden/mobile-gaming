/**
 * Bridge Race - Three.js Renderer (polished)
 *
 * Visual improvements:
 * - Character with head, eyes, and bounce run cycle
 * - Carried bricks stack visually behind character
 * - Collection pop when picking up a brick
 * - Bridge cells scale-pop when placed
 * - Camera shake on bridge completion
 * - Fog + fill light for depth
 * - Improved ground with grass/road contrast
 */

import * as THREE from 'three';
import {
  createThreeScene,
  resizeThreeRenderer,
  createBasicLights
} from '../../shared/three-setup.js';

const CAMERA_HEIGHT   = 20;
const CAMERA_BACK     = 15;
const CAMERA_LOOKAHEAD = 10;

const ENTITY_BODY_H = 1.2;
const ENTITY_WIDTH  = 0.8;
const HEAD_R        = 0.38;

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

// ── Character factory ────────────────────────────────────────────────────────
function buildCharacterGroup(color) {
  const group = new THREE.Group();
  const colorHex = getColorHex(color);

  // Body
  const bodyGeo = new THREE.BoxGeometry(ENTITY_WIDTH, ENTITY_BODY_H, ENTITY_WIDTH);
  const bodyMat = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 70 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = ENTITY_BODY_H / 2;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(HEAD_R, 10, 8);
  const headMat = new THREE.MeshPhongMaterial({ color: 0xf5c87a, shininess: 40 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = ENTITY_BODY_H + HEAD_R;
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.055, 6, 4);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.13, 0.13].forEach(xOff => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(xOff, ENTITY_BODY_H + HEAD_R * 0.6, HEAD_R * 0.88);
    group.add(eye);
  });

  // Brick carry stack (child group, filled dynamically)
  const brickStack = new THREE.Group();
  brickStack.name = 'brickStack';
  brickStack.position.set(0, 0, -0.5); // behind character
  group.add(brickStack);

  return group;
}

function updateBrickStack(charGroup, brickCount, colorHex) {
  const stack = charGroup.getObjectByName('brickStack');
  if (!stack) return;

  // Remove old bricks
  while (stack.children.length > 0) stack.remove(stack.children[0]);

  // Add up to 8 visible carried bricks
  const vis = Math.min(brickCount, 8);
  const brickGeo = new THREE.BoxGeometry(0.6, 0.18, 0.55);
  const brickMat = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 30 });
  for (let i = 0; i < vis; i++) {
    const brick = new THREE.Mesh(brickGeo, brickMat);
    brick.position.y = 0.1 + i * 0.18;
    stack.add(brick);
  }
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

  // Track last state
  let lastBridgeCount  = -1;
  let lastPileCount    = -1;
  let lastOpponentCount = -1;

  // Collection pop
  let playerPopUntil = 0;
  let prevPlayerBricks = 0;

  // Bridge completion shake
  let shakeUntil = 0;
  let shakeAmp = 0;

  // Track previous bridge filled counts for detecting completion
  let prevBridgesFilled = 0;

  // Bridge cell scale pops: Map<bridgeIdx_cellIdx, {until}>
  const cellPops = new Map();

  function now() { return performance.now(); }

  function init() {
    const result = createThreeScene(container, {
      fov: 50,
      backgroundColor: 0x7ec8e3,
      antialias: true,
      cameraPosition: new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK)
    });

    scene    = result.scene;
    camera   = result.camera;
    renderer = result.renderer;
    canvas   = result.canvas;

    createBasicLights(scene, {
      ambientIntensity: 0.55,
      directionalIntensity: 0.9,
      directionalPosition: new THREE.Vector3(8, 15, -5)
    });

    // Fill light
    const fill = new THREE.DirectionalLight(0xaaddff, 0.25);
    fill.position.set(-5, 8, 10);
    scene.add(fill);

    // Fog for depth
    scene.fog = new THREE.Fog(0x7ec8e3, 60, 200);

    buildGround();
  }

  // ── Ground ─────────────────────────────────────────────────────────────────
  function buildGround() {
    // Grass
    const geo = new THREE.PlaneGeometry(30, 2000);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a9e4a });
    groundMesh = new THREE.Mesh(geo, mat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.05, 1000);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Road lane (center strip)
    const roadGeo = new THREE.PlaneGeometry(14, 2000);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x5a8a5a });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.04, 1000);
    scene.add(road);

    // Side walls
    const wallGeo = new THREE.BoxGeometry(0.5, 2, 2000);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
    [-12, 12].forEach(x => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(x, 1, 1000);
      scene.add(wall);
    });
  }

  // ── Bridges ────────────────────────────────────────────────────────────────
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

    const gapGeo = new THREE.PlaneGeometry(30, 3);
    const gapMat = new THREE.MeshBasicMaterial({ color: 0x0a1a2a });
    const gap = new THREE.Mesh(gapGeo, gapMat);
    gap.rotation.x = -Math.PI / 2;
    gap.position.set(0, -0.02, bridge.z);
    group.add(gap);

    const cellWidth = 22 / bridge.required;
    for (let i = 0; i < bridge.required; i++) {
      const cx = -11 + cellWidth * i + cellWidth / 2;
      const cellGeo = new THREE.BoxGeometry(cellWidth - 0.2, 0.22, 2.5);
      const cellMat = new THREE.MeshPhongMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.5,
        shininess: 30
      });
      const cell = new THREE.Mesh(cellGeo, cellMat);
      cell.position.set(cx, 0.1, bridge.z);
      cell.userData.cellIdx = i;
      group.add(cell);
    }

    return group;
  }

  function updateBridgeCells(bridges, t) {
    let totalFilled = 0;
    for (let i = 0; i < bridges.length; i++) {
      const bridge = bridges[i];
      const group = bridgeGroups[i];
      if (!group) continue;

      const cellMeshes = group.children.filter(c => c.userData.cellIdx !== undefined);

      for (let j = 0; j < bridge.cells.length; j++) {
        const cell = cellMeshes[j];
        if (!cell) continue;

        const color = bridge.cells[j];
        const popKey = `${i}_${j}`;

        if (color) {
          totalFilled++;
          // Detect newly placed cell
          if (cell.material.transparent && !reducedMotion) {
            cellPops.set(popKey, { until: t + 300 });
          }
          cell.material.color.setHex(getColorHex(color));
          cell.material.transparent = false;
          cell.material.opacity = 1;

          // Scale pop on recently placed cell
          const pop = cellPops.get(popKey);
          if (pop && t < pop.until) {
            const prog = (pop.until - t) / 300;
            cell.scale.y = 1 + 0.4 * Math.sin(prog * Math.PI);
          } else {
            cell.scale.y = 1;
            if (pop) cellPops.delete(popKey);
          }
        } else {
          cell.material.color.setHex(0x888888);
          cell.material.transparent = true;
          cell.material.opacity = 0.5;
          cell.scale.y = 1;
        }
      }
    }

    // Detect bridge completion → shake
    if (totalFilled > prevBridgesFilled + 2 && !reducedMotion) {
      shakeUntil = t + 280;
      shakeAmp = 0.2;
    }
    prevBridgesFilled = totalFilled;
  }

  // ── Block piles ────────────────────────────────────────────────────────────
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
    const mat = new THREE.MeshPhongMaterial({
      color: getColorHex(pile.color),
      shininess: 40
    });
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
        if (mesh) mesh.scale.y = height / 2.5;
      }
    }
  }

  // ── Entities ──────────────────────────────────────────────────────────────
  function setupPlayer(playerColor) {
    if (playerMesh) scene.remove(playerMesh);
    playerMesh = buildCharacterGroup(playerColor);
    scene.add(playerMesh);
  }

  function setupOpponents(opponents) {
    opponentMeshes.forEach(m => scene.remove(m));
    opponentMeshes = [];

    for (const opp of opponents) {
      const mesh = buildCharacterGroup(opp.color);
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

  // ── Render ─────────────────────────────────────────────────────────────────
  function render(state) {
    const t = now();

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

    // Detect brick collection pop
    if (state.player.bricks > prevPlayerBricks && !reducedMotion) {
      playerPopUntil = t + 280;
    }
    prevPlayerBricks = state.player.bricks;

    // Update player
    if (playerMesh) {
      const isMoving = state.status === 'playing';
      const bobY = isMoving && !reducedMotion
        ? Math.abs(Math.sin(t * 0.006)) * 0.22
        : 0;

      const popScale = playerPopUntil > t
        ? 1 + 0.2 * Math.sin(((playerPopUntil - t) / 280) * Math.PI)
        : 1;

      playerMesh.position.set(state.player.x, bobY, state.player.z);
      playerMesh.scale.setScalar(popScale);

      // Update brick stack
      updateBrickStack(playerMesh, state.player.bricks, getColorHex(state.player.color));
    }

    // Update opponents
    for (let i = 0; i < state.opponents.length; i++) {
      const mesh = opponentMeshes[i];
      const opp  = state.opponents[i];
      if (mesh && opp) {
        const bobY = !reducedMotion
          ? Math.abs(Math.sin(t * 0.0055 + i * 1.3)) * 0.18
          : 0;
        mesh.position.set(opp.x, bobY, opp.z);
        updateBrickStack(mesh, opp.bricks || 0, getColorHex(opp.color));
      }
    }

    updateBridgeCells(state.bridges, t);
    updatePiles(state.blockPiles);

    // Camera shake on bridge fill
    let shakeX = 0, shakeY = 0;
    if (t < shakeUntil && !reducedMotion) {
      const decay = (shakeUntil - t) / 280;
      shakeX = Math.sin(t * 0.06) * shakeAmp * decay;
      shakeY = Math.cos(t * 0.05) * shakeAmp * decay * 0.5;
    }

    const targetZ = state.player.z - CAMERA_BACK;
    if (reducedMotion) {
      camera.position.set(state.player.x * 0.2, CAMERA_HEIGHT, targetZ);
    } else {
      camera.position.x += (state.player.x * 0.2 + shakeX - camera.position.x) * 0.08;
      camera.position.y  = CAMERA_HEIGHT + shakeY;
      camera.position.z += (targetZ - camera.position.z) * 0.12;
    }
    camera.lookAt(state.player.x * 0.1, 0, state.player.z + CAMERA_LOOKAHEAD);

    renderer.render(scene, camera);
  }

  // ── Win animation ──────────────────────────────────────────────────────────
  function animateResult(won, onComplete) {
    if (reducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    if (won) spawnConfetti();

    const startTime = performance.now();
    const duration  = won ? 1500 : 700;

    function step(ts) {
      const t = Math.min((ts - startTime) / duration, 1);

      if (playerMesh && won) {
        playerMesh.position.y = Math.sin(t * Math.PI * 3) * 2.5;
        playerMesh.rotation.y = t * Math.PI * 4;
      }

      updateConfetti();
      renderer.render(scene, camera);

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        confettiParticles.forEach(p => scene.remove(p));
        confettiParticles = [];
        if (playerMesh) playerMesh.rotation.y = 0;
        if (onComplete) onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function spawnConfetti() {
    const colors = [0xFF6B6B, 0x4DABF7, 0xFFD93D, 0x69DB7C, 0xCC5DE8, 0xFFA94D];
    for (let i = 0; i < 50; i++) {
      const geo = new THREE.BoxGeometry(0.3, 0.3, 0.06);
      const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 14,
        Math.random() * 8 + 2,
        (playerMesh ? playerMesh.position.z : 0) + (Math.random() - 0.5) * 10
      );
      mesh.userData.velocity = {
        x: (Math.random() - 0.5) * 0.12,
        y: (Math.random() - 0.3) * 0.1,
        z: (Math.random() - 0.5) * 0.12
      };
      scene.add(mesh);
      confettiParticles.push(mesh);
    }
  }

  function updateConfetti() {
    confettiParticles.forEach(p => {
      p.position.x += p.userData.velocity.x;
      p.position.y += p.userData.velocity.y - 0.025;
      p.position.z += p.userData.velocity.z;
      p.rotation.x += 0.06;
      p.rotation.z += 0.04;
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
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
    prevPlayerBricks  = 0;
    prevBridgesFilled = 0;
    cellPops.clear();
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
