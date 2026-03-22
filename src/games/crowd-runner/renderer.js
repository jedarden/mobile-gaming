/**
 * Crowd Runner - Three.js Renderer
 *
 * Scene elements:
 *  - Ground plane with center divider
 *  - Side walls
 *  - Crowd: InstancedMesh of spheres (count = crowdSize, up to MAX_CROWD)
 *  - Gates: colored arch panels with canvas-texture operation labels
 *  - Boss: large red sphere cluster
 *  - Camera: chase-cam behind and above the crowd
 */

import * as THREE from 'three';
import {
  createThreeScene,
  resizeThreeRenderer,
  createBasicLights
} from '../../shared/three-setup.js';

// World dimensions
const COURSE_HALF_WIDTH = 6;   // total width = 12 units
const LANE_WORLD = 3.5;        // crowd X = laneOffset * LANE_WORLD
const CAMERA_HEIGHT   = 10;
const CAMERA_BACK     = 14;
const CAMERA_LOOKAHEAD = 25;
const VIEW_DISTANCE    = 180;  // show gates within this range ahead

// Crowd rendering
const MAX_CROWD = 300;
const CROWD_RADIUS = 0.3;
const CROWD_SPACING = 0.72;
const CROWD_Y = CROWD_RADIUS;

// Gate visuals
const GATE_HEIGHT    = 4.5;
const GATE_WIDTH     = 4.5;
const GATE_THICKNESS = 0.4;
const GATE_LEFT_X    = -COURSE_HALF_WIDTH / 2;   // center of left lane
const GATE_RIGHT_X   =  COURSE_HALF_WIDTH / 2;   // center of right lane

// Boss
const BOSS_BASE_RADIUS = 1.2;

/**
 * Hexagonal ring formation: returns array of {x, y, z} for `count` crowd members.
 */
function buildCrowdPositions(count, cx, cz) {
  const positions = [];
  let placed = 0;
  let ring = 0;

  while (placed < count) {
    if (ring === 0) {
      positions.push({ x: cx, y: CROWD_Y, z: cz });
      placed++;
      ring = 1;
    } else {
      const spotsInRing = 6 * ring;
      for (let i = 0; i < spotsInRing && placed < count; i++) {
        const angle = (i / spotsInRing) * Math.PI * 2;
        const r = ring * CROWD_SPACING;
        positions.push({
          x: cx + Math.cos(angle) * r,
          y: CROWD_Y,
          z: cz + Math.sin(angle) * r
        });
        placed++;
      }
      ring++;
    }
  }

  return positions;
}

/**
 * Determine whether an op is "good" (boosts crowd) vs "bad".
 * Used for gate colour.
 */
function isGoodOp(op) {
  if (op.op === '+') return true;
  if (op.op === '×' && op.value > 1) return true;
  return false;
}

/**
 * Format an operation as a display string: "+10", "×3", "−5", "÷2"
 */
function formatOp(op) {
  return `${op.op}${op.value}`;
}

/**
 * Create a canvas texture with operation text.
 */
function makeOpTexture(op) {
  const good = isGoodOp(op);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = good ? '#1a7a1a' : '#7a1a1a';
  ctx.roundRect(4, 4, 248, 120, 16);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatOp(op), 128, 64);

  return new THREE.CanvasTexture(canvas);
}

/**
 * Build a gate group (left + right arches) for a level gate.
 */
function buildGateMeshes(gate) {
  const group = new THREE.Group();
  group.position.set(0, 0, gate.z);

  const sides = [
    { side: 'left',  cx: GATE_LEFT_X,  op: gate.left  },
    { side: 'right', cx: GATE_RIGHT_X, op: gate.right }
  ];

  for (const { cx, op } of sides) {
    const good = isGoodOp(op);

    // Main panel
    const panelGeo  = new THREE.BoxGeometry(GATE_WIDTH, GATE_HEIGHT, GATE_THICKNESS);
    const panelMat  = new THREE.MeshPhongMaterial({
      color: good ? 0x22aa22 : 0xaa2222,
      transparent: true,
      opacity: 0.75
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(cx, GATE_HEIGHT / 2, 0);
    group.add(panel);

    // Text sprite
    const texture  = makeOpTexture(op);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite   = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.5, 1.75, 1);
    sprite.position.set(cx, GATE_HEIGHT / 2, GATE_THICKNESS);
    group.add(sprite);

    // Left post
    const postGeo = new THREE.BoxGeometry(0.3, GATE_HEIGHT, GATE_THICKNESS);
    const postMat = new THREE.MeshPhongMaterial({ color: good ? 0x145214 : 0x521414 });
    const lPost = new THREE.Mesh(postGeo, postMat);
    lPost.position.set(cx - GATE_WIDTH / 2, GATE_HEIGHT / 2, 0);
    group.add(lPost);

    // Right post
    const rPost = new THREE.Mesh(postGeo, postMat);
    rPost.position.set(cx + GATE_WIDTH / 2, GATE_HEIGHT / 2, 0);
    group.add(rPost);

    // Top bar
    const barGeo = new THREE.BoxGeometry(GATE_WIDTH + 0.3, 0.4, GATE_THICKNESS);
    const bar = new THREE.Mesh(barGeo, postMat);
    bar.position.set(cx, GATE_HEIGHT, 0);
    group.add(bar);
  }

  // Center divider (thin vertical rod between arches)
  const divGeo = new THREE.BoxGeometry(0.15, GATE_HEIGHT, GATE_THICKNESS);
  const divMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const div = new THREE.Mesh(divGeo, divMat);
  div.position.set(0, GATE_HEIGHT / 2, 0);
  group.add(div);

  return group;
}

/**
 * Build a boss sphere cluster mesh.
 * Size scales with boss.size (cube-root for radius).
 */
function buildBossMesh(bossSize) {
  const group = new THREE.Group();
  const scale = Math.cbrt(bossSize) * 0.55;

  // Main body
  const bodyGeo = new THREE.SphereGeometry(BOSS_BASE_RADIUS, 24, 16);
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcc2222, shininess: 80 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, BOSS_BASE_RADIUS * scale, 0);
  body.scale.set(scale, scale, scale);
  group.add(body);

  // Angry eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const eyeGeo = new THREE.SphereGeometry(0.18, 8, 8);
  [-0.5, 0.5].forEach(xOff => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(
      xOff * scale * BOSS_BASE_RADIUS,
      (BOSS_BASE_RADIUS + 0.6) * scale,
      BOSS_BASE_RADIUS * scale * 0.9
    );
    group.add(eye);
  });

  // Size label above boss
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cc2222';
  ctx.roundRect(4, 4, 248, 120, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`💀 ${bossSize}`, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({ map: texture });
  const label = new THREE.Sprite(labelMat);
  label.scale.set(4, 2, 1);
  label.position.set(0, BOSS_BASE_RADIUS * scale * 2 + 2, 0);
  group.add(label);

  return group;
}

/**
 * Create and return a renderer instance.
 */
export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let crowdMesh, bossMesh;
  let gateMeshGroups = [];
  const dummy = new THREE.Object3D();
  let reducedMotion = false;

  function init() {
    const result = createThreeScene(container, {
      fov: 55,
      backgroundColor: 0x87CEEB,   // sky blue
      antialias: true,
      cameraPosition: new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK)
    });

    scene    = result.scene;
    camera   = result.camera;
    renderer = result.renderer;
    canvas   = result.canvas;

    createBasicLights(scene, {
      ambientIntensity: 0.55,
      directionalIntensity: 0.85,
      directionalPosition: new THREE.Vector3(6, 12, -5)
    });

    buildGround();
    buildWalls();
    buildCrowd();
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  function buildGround() {
    const geo = new THREE.PlaneGeometry(COURSE_HALF_WIDTH * 2, 2000);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1000);
    ground.receiveShadow = true;
    scene.add(ground);

    // Center lane divider line
    const lineGeo = new THREE.PlaneGeometry(0.12, 2000);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.35
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.01, 1000);
    scene.add(line);
  }

  // ── Side walls ────────────────────────────────────────────────────────────

  function buildWalls() {
    const wallGeo = new THREE.BoxGeometry(0.4, 2, 2000);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc8a050 });
    [-1, 1].forEach(side => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(side * COURSE_HALF_WIDTH, 1, 1000);
      scene.add(wall);
    });
  }

  // ── Crowd InstancedMesh ───────────────────────────────────────────────────

  function buildCrowd() {
    const geo = new THREE.SphereGeometry(CROWD_RADIUS, 8, 6);
    const mat = new THREE.MeshPhongMaterial({ color: 0x4DABF7, shininess: 60 });
    crowdMesh = new THREE.InstancedMesh(geo, mat, MAX_CROWD);
    crowdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Hide all instances initially
    for (let i = 0; i < MAX_CROWD; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(i, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
    scene.add(crowdMesh);
  }

  function updateCrowd(crowdSize, cx, cz) {
    const visCount = Math.min(crowdSize, MAX_CROWD);
    const positions = buildCrowdPositions(visCount, cx, cz);

    for (let i = 0; i < MAX_CROWD; i++) {
      if (i < visCount) {
        dummy.position.set(positions[i].x, positions[i].y, positions[i].z);
        dummy.scale.setScalar(1);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(i, dummy.matrix);
    }
    crowdMesh.instanceMatrix.needsUpdate = true;
    crowdMesh.count = visCount;
  }

  // ── Gates ─────────────────────────────────────────────────────────────────

  function setupGates(gates) {
    // Remove old gates
    gateMeshGroups.forEach(g => scene.remove(g));
    gateMeshGroups = [];

    gates.forEach(gate => {
      const group = buildGateMeshes(gate);
      scene.add(group);
      gateMeshGroups.push(group);
    });
  }

  function updateGateVisibility(gates, position) {
    gates.forEach((gate, idx) => {
      const group = gateMeshGroups[idx];
      if (!group) return;
      const inView = gate.z >= position - 20 && gate.z <= position + VIEW_DISTANCE;
      group.visible = inView && !gate.crossed;
    });
  }

  // ── Boss ──────────────────────────────────────────────────────────────────

  function setupBoss(boss) {
    if (bossMesh) scene.remove(bossMesh);
    bossMesh = buildBossMesh(boss.size);
    bossMesh.position.set(0, 0, boss.z);
    scene.add(bossMesh);
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  let lastBossSize = null;
  let lastGateCount = 0;

  function render(state) {
    const crowdX = state.laneOffset * LANE_WORLD;
    const crowdZ = state.position;

    // Lazily set up boss and gates on first render with this level
    if (lastBossSize !== state.boss.size) {
      setupBoss(state.boss);
      lastBossSize = state.boss.size;
    }
    if (lastGateCount !== state.gates.length) {
      setupGates(state.gates);
      lastGateCount = state.gates.length;
    }

    // Update crowd instances
    updateCrowd(state.crowdSize, crowdX, crowdZ);

    // Gate visibility
    updateGateVisibility(state.gates, crowdZ);

    // Camera: follow crowd from behind and above
    const camZ = crowdZ - CAMERA_BACK;
    const camX = crowdX * 0.3;
    if (reducedMotion) {
      camera.position.set(camX, CAMERA_HEIGHT, camZ);
    } else {
      camera.position.x += (camX - camera.position.x) * 0.08;
      camera.position.y  = CAMERA_HEIGHT;
      camera.position.z += (camZ - camera.position.z) * 0.12;
    }
    camera.lookAt(crowdX * 0.2, 1, crowdZ + CAMERA_LOOKAHEAD);

    // Boss pulse on win
    if (bossMesh && state.status === 'won') {
      const t = Date.now() * 0.003;
      bossMesh.scale.setScalar(1 + 0.08 * Math.sin(t));
    }

    renderer.render(scene, camera);
  }

  // ── Win / lose animation ──────────────────────────────────────────────────

  function animateResult(won, onComplete) {
    if (reducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    const startTime = performance.now();
    const duration  = won ? 1200 : 600;

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      if (bossMesh) {
        if (won) {
          bossMesh.scale.setScalar(1 + t * 0.4 * Math.sin(t * Math.PI * 6));
        } else {
          bossMesh.scale.setScalar(1 + t * 0.15);
        }
      }
      renderer.render(scene, camera);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function resize(width, height) {
    resizeThreeRenderer(renderer, camera, width, height);
  }

  function setReducedMotion(value) {
    reducedMotion = value;
  }

  function resetLevel() {
    lastBossSize  = null;
    lastGateCount = 0;
  }

  function destroy() {
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    gateMeshGroups.forEach(g => scene.remove(g));
    gateMeshGroups = [];
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
