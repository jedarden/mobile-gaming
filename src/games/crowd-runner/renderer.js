/**
 * Crowd Runner - Three.js Renderer (polished)
 *
 * Visual improvements:
 * - Crowd personality: per-instance bounce/wobble + tiny eyes on each blob
 * - Swarming motion: position jitter seeded by instance index
 * - Growth pop: brief scale burst when crowd size increases
 * - Gate impact: camera shake on gate crossing
 * - Dust trail: small particle spheres drift behind the crowd
 * - Improved lighting with shadows
 */

import * as THREE from 'three';
import {
  createThreeScene,
  resizeThreeRenderer,
  createBasicLights
} from '../../shared/three-setup.js';

// World dimensions
const COURSE_HALF_WIDTH = 6;
const LANE_WORLD = 3.5;
const CAMERA_HEIGHT   = 10;
const CAMERA_BACK     = 14;
const CAMERA_LOOKAHEAD = 25;
const VIEW_DISTANCE    = 180;

// Crowd rendering
const MAX_CROWD = 300;
const CROWD_RADIUS = 0.3;
const CROWD_SPACING = 0.72;
const CROWD_Y = CROWD_RADIUS;

// Gate visuals
const GATE_HEIGHT    = 4.5;
const GATE_WIDTH     = 4.5;
const GATE_THICKNESS = 0.4;
const GATE_LEFT_X    = -COURSE_HALF_WIDTH / 2;
const GATE_RIGHT_X   =  COURSE_HALF_WIDTH / 2;

// Boss
const BOSS_BASE_RADIUS = 1.2;

// Dust trail
const MAX_DUST = 60;

/**
 * Hexagonal ring formation with per-instance jitter.
 */
function buildCrowdPositions(count, cx, cz, time) {
  const positions = [];
  let placed = 0;
  let ring = 0;

  while (placed < count) {
    if (ring === 0) {
      const bob = Math.sin(time * 0.004) * 0.06;
      positions.push({ x: cx, y: CROWD_Y + bob, z: cz });
      placed++;
      ring = 1;
    } else {
      const spotsInRing = 6 * ring;
      for (let i = 0; i < spotsInRing && placed < count; i++) {
        const angle = (i / spotsInRing) * Math.PI * 2;
        const r = ring * CROWD_SPACING;
        // Per-instance wobble using position-seeded sine
        const seed = placed * 0.41 + ring * 1.57;
        const bobY = Math.sin(time * 0.004 + seed) * 0.07;
        const jitterX = Math.sin(seed * 127.1) * 0.06;
        const jitterZ = Math.sin(seed * 311.7) * 0.06;
        positions.push({
          x: cx + Math.cos(angle) * r + jitterX,
          y: CROWD_Y + bobY,
          z: cz + Math.sin(angle) * r + jitterZ
        });
        placed++;
      }
      ring++;
    }
  }

  return positions;
}

function isGoodOp(op) {
  if (op.op === '+') return true;
  if (op.op === '×' && op.value > 1) return true;
  return false;
}

function formatOp(op) {
  return `${op.op}${op.value}`;
}

function makeOpTexture(op) {
  const good = isGoodOp(op);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Background with gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, good ? '#28bb28' : '#bb2828');
  grad.addColorStop(1, good ? '#145214' : '#521414');
  ctx.fillStyle = grad;
  ctx.roundRect(4, 4, 248, 120, 16);
  ctx.fill();

  // Sheen
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.roundRect(4, 4, 248, 60, [16, 16, 0, 0]);
  ctx.fill();

  // Text with shadow
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatOp(op), 128, 64);

  return new THREE.CanvasTexture(canvas);
}

function buildGateMeshes(gate) {
  const group = new THREE.Group();
  group.position.set(0, 0, gate.z);

  const sides = [
    { side: 'left',  cx: GATE_LEFT_X,  op: gate.left  },
    { side: 'right', cx: GATE_RIGHT_X, op: gate.right }
  ];

  for (const { cx, op } of sides) {
    const good = isGoodOp(op);

    const panelGeo  = new THREE.BoxGeometry(GATE_WIDTH, GATE_HEIGHT, GATE_THICKNESS);
    const panelMat  = new THREE.MeshPhongMaterial({
      color: good ? 0x22aa22 : 0xaa2222,
      transparent: true,
      opacity: 0.78,
      shininess: 60
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(cx, GATE_HEIGHT / 2, 0);
    group.add(panel);

    const texture  = makeOpTexture(op);
    const spriteMat = new THREE.SpriteMaterial({ map: texture });
    const sprite   = new THREE.Sprite(spriteMat);
    sprite.scale.set(3.5, 1.75, 1);
    sprite.position.set(cx, GATE_HEIGHT / 2, GATE_THICKNESS);
    group.add(sprite);

    const postGeo = new THREE.BoxGeometry(0.3, GATE_HEIGHT, GATE_THICKNESS);
    const postMat = new THREE.MeshPhongMaterial({ color: good ? 0x145214 : 0x521414 });
    const lPost = new THREE.Mesh(postGeo, postMat);
    lPost.position.set(cx - GATE_WIDTH / 2, GATE_HEIGHT / 2, 0);
    group.add(lPost);

    const rPost = new THREE.Mesh(postGeo, postMat);
    rPost.position.set(cx + GATE_WIDTH / 2, GATE_HEIGHT / 2, 0);
    group.add(rPost);

    const barGeo = new THREE.BoxGeometry(GATE_WIDTH + 0.3, 0.4, GATE_THICKNESS);
    const bar = new THREE.Mesh(barGeo, postMat);
    bar.position.set(cx, GATE_HEIGHT, 0);
    group.add(bar);
  }

  const divGeo = new THREE.BoxGeometry(0.15, GATE_HEIGHT, GATE_THICKNESS);
  const divMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const div = new THREE.Mesh(divGeo, divMat);
  div.position.set(0, GATE_HEIGHT / 2, 0);
  group.add(div);

  return group;
}

function buildBossMesh(bossSize) {
  const group = new THREE.Group();
  const scale = Math.cbrt(bossSize) * 0.55;

  const bodyGeo = new THREE.SphereGeometry(BOSS_BASE_RADIUS, 24, 16);
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcc2222, shininess: 80 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, BOSS_BASE_RADIUS * scale, 0);
  body.scale.set(scale, scale, scale);
  group.add(body);

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
  ctx.fillText(`\u{1F480} ${bossSize}`, 128, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const labelMat = new THREE.SpriteMaterial({ map: texture });
  const label = new THREE.Sprite(labelMat);
  label.scale.set(4, 2, 1);
  label.position.set(0, BOSS_BASE_RADIUS * scale * 2 + 2, 0);
  group.add(label);

  return group;
}

export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let crowdMesh, eyeMesh, bossMesh;
  let gateMeshGroups = [];
  let dustMeshes = [];
  const dummy = new THREE.Object3D();
  let reducedMotion = false;

  // Camera shake
  let shakeUntil = 0;
  let shakeAmp = 0;

  // Growth pop
  let popUntil = 0;
  let prevCrowdSize = 0;

  // Dust state
  const dustParticles = []; // { x, y, z, life, r }

  function now() { return performance.now(); }

  function init() {
    const result = createThreeScene(container, {
      fov: 55,
      backgroundColor: 0x87CEEB,
      antialias: true,
      cameraPosition: new THREE.Vector3(0, CAMERA_HEIGHT, -CAMERA_BACK)
    });

    scene    = result.scene;
    camera   = result.camera;
    renderer = result.renderer;
    canvas   = result.canvas;

    createBasicLights(scene, {
      ambientIntensity: 0.5,
      directionalIntensity: 0.9,
      directionalPosition: new THREE.Vector3(8, 15, -8)
    });

    // Add second fill light for crowd depth
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.3);
    fillLight.position.set(-6, 6, 10);
    scene.add(fillLight);

    // Soft fog
    scene.fog = new THREE.Fog(0x87CEEB, 80, 250);

    buildGround();
    buildWalls();
    buildCrowd();
    buildDustPool();
  }

  // ── Ground ─────────────────────────────────────────────────────────────────
  function buildGround() {
    const geo = new THREE.PlaneGeometry(COURSE_HALF_WIDTH * 2, 2000);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a7a3a });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1000);
    ground.receiveShadow = true;
    scene.add(ground);

    const lineGeo = new THREE.PlaneGeometry(0.12, 2000);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.35
    });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.01, 1000);
    scene.add(line);
  }

  // ── Walls ──────────────────────────────────────────────────────────────────
  function buildWalls() {
    const wallGeo = new THREE.BoxGeometry(0.4, 2, 2000);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc8a050 });
    [-1, 1].forEach(side => {
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(side * COURSE_HALF_WIDTH, 1, 1000);
      scene.add(wall);
    });
  }

  // ── Crowd InstancedMesh (body + eyes) ──────────────────────────────────────
  function buildCrowd() {
    // Body spheres
    const bodyGeo = new THREE.SphereGeometry(CROWD_RADIUS, 8, 6);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x4DABF7, shininess: 80 });
    crowdMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, MAX_CROWD);
    crowdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Eye spheres (small black dots on the front of each blob)
    const eyeGeo = new THREE.SphereGeometry(0.07, 6, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    eyeMesh = new THREE.InstancedMesh(eyeGeo, eyeMat, MAX_CROWD * 2);
    eyeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < MAX_CROWD; i++) {
      dummy.position.set(0, -1000, 0);
      dummy.updateMatrix();
      crowdMesh.setMatrixAt(i, dummy.matrix);
      eyeMesh.setMatrixAt(i * 2,     dummy.matrix);
      eyeMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
    }

    crowdMesh.instanceMatrix.needsUpdate = true;
    eyeMesh.instanceMatrix.needsUpdate = true;
    scene.add(crowdMesh);
    scene.add(eyeMesh);
  }

  function updateCrowd(crowdSize, cx, cz, time) {
    const visCount = Math.min(crowdSize, MAX_CROWD);
    const positions = buildCrowdPositions(visCount, cx, cz, time);

    // Growth pop scale
    const popScale = popUntil > time
      ? 1 + 0.25 * Math.sin(((popUntil - time) / 350) * Math.PI)
      : 1;

    for (let i = 0; i < MAX_CROWD; i++) {
      if (i < visCount) {
        const pos = positions[i];
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.setScalar(popScale);
        dummy.updateMatrix();
        crowdMesh.setMatrixAt(i, dummy.matrix);

        // Eyes: two black dots at front-top of sphere
        const er = CROWD_RADIUS * 0.85;
        dummy.scale.setScalar(1);
        dummy.position.set(pos.x - 0.09, pos.y + er * 0.55, pos.z + er * 0.72);
        dummy.updateMatrix();
        eyeMesh.setMatrixAt(i * 2, dummy.matrix);

        dummy.position.set(pos.x + 0.09, pos.y + er * 0.55, pos.z + er * 0.72);
        dummy.updateMatrix();
        eyeMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        crowdMesh.setMatrixAt(i, dummy.matrix);
        eyeMesh.setMatrixAt(i * 2,     dummy.matrix);
        eyeMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      }
    }

    crowdMesh.instanceMatrix.needsUpdate = true;
    crowdMesh.count = visCount;
    eyeMesh.instanceMatrix.needsUpdate = true;
    eyeMesh.count = visCount * 2;
  }

  // ── Dust trail ─────────────────────────────────────────────────────────────
  function buildDustPool() {
    const dustGeo = new THREE.SphereGeometry(0.12, 4, 3);
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xbbaa88, transparent: true, opacity: 0.4
    });
    for (let i = 0; i < MAX_DUST; i++) {
      const m = new THREE.Mesh(dustGeo, dustMat);
      m.visible = false;
      scene.add(m);
      dustMeshes.push(m);
    }
  }

  function spawnDust(cx, cz) {
    for (let i = 0; i < 3; i++) {
      const slot = dustParticles.length < MAX_DUST
        ? dustParticles.length
        : dustParticles.findIndex(p => p.life <= 0);
      if (slot < 0 || slot >= MAX_DUST) return;
      const dp = {
        x: cx + (Math.random() - 0.5) * 2.5,
        y: 0.08 + Math.random() * 0.15,
        z: cz + 0.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.04,
        vy: 0.02 + Math.random() * 0.02,
        life: 1
      };
      if (slot === dustParticles.length) dustParticles.push(dp);
      else dustParticles[slot] = dp;
    }
  }

  function updateDust() {
    for (let i = 0; i < dustParticles.length; i++) {
      const p = dustParticles[i];
      if (p.life <= 0) {
        dustMeshes[i].visible = false;
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      const m = dustMeshes[i];
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      const sc = p.life * 0.9;
      m.scale.setScalar(sc);
      m.material.opacity = p.life * 0.35;
    }
  }

  // ── Gates ──────────────────────────────────────────────────────────────────
  function setupGates(gates) {
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

  // ── Boss ───────────────────────────────────────────────────────────────────
  function setupBoss(boss) {
    if (bossMesh) scene.remove(bossMesh);
    bossMesh = buildBossMesh(boss.size);
    bossMesh.position.set(0, 0, boss.z);
    scene.add(bossMesh);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  let lastBossSize = null;
  let lastGateCount = 0;
  let lastCrossedCount = 0;

  function render(state) {
    const t = now();
    const crowdX = state.laneOffset * LANE_WORLD;
    const crowdZ = state.position;

    if (lastBossSize !== state.boss.size) {
      setupBoss(state.boss);
      lastBossSize = state.boss.size;
    }
    if (lastGateCount !== state.gates.length) {
      setupGates(state.gates);
      lastGateCount = state.gates.length;
    }

    // Detect gate crossing → camera shake
    const crossedCount = state.gates.filter(g => g.crossed).length;
    if (crossedCount > lastCrossedCount && !reducedMotion) {
      shakeUntil = t + 300;
      shakeAmp = 0.25;
    }
    lastCrossedCount = crossedCount;

    // Detect crowd growth → scale pop
    if (state.crowdSize > prevCrowdSize && !reducedMotion) {
      popUntil = t + 350;
    }
    prevCrowdSize = state.crowdSize;

    // Update crowd with time for bounce
    updateCrowd(state.crowdSize, crowdX, crowdZ, t);

    // Spawn and update dust trail
    if (!reducedMotion && state.status === 'playing') {
      spawnDust(crowdX, crowdZ);
    }
    updateDust();

    updateGateVisibility(state.gates, crowdZ);

    // Camera shake
    let shakeX = 0, shakeY = 0;
    if (t < shakeUntil && !reducedMotion) {
      const decay = (shakeUntil - t) / 300;
      shakeX = Math.sin(t * 0.05) * shakeAmp * decay;
      shakeY = Math.cos(t * 0.04) * shakeAmp * decay * 0.5;
    }

    const camZ = crowdZ - CAMERA_BACK;
    const camX = crowdX * 0.3;
    if (reducedMotion) {
      camera.position.set(camX, CAMERA_HEIGHT, camZ);
    } else {
      camera.position.x += (camX - camera.position.x) * 0.08;
      camera.position.y  = CAMERA_HEIGHT + shakeY;
      camera.position.z += (camZ - camera.position.z) * 0.12;
      camera.position.x += shakeX;
    }
    camera.lookAt(crowdX * 0.2, 1, crowdZ + CAMERA_LOOKAHEAD);

    if (bossMesh && state.status === 'won') {
      const ts = t * 0.003;
      bossMesh.scale.setScalar(1 + 0.08 * Math.sin(ts));
    }

    renderer.render(scene, camera);
  }

  // ── Win/lose animation ─────────────────────────────────────────────────────
  function animateResult(won, onComplete) {
    if (reducedMotion) {
      if (onComplete) onComplete();
      return;
    }

    const startTime = now();
    const duration  = won ? 1200 : 600;

    function step(ts) {
      const t = Math.min((ts - startTime) / duration, 1);
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

  // ── Public API ─────────────────────────────────────────────────────────────
  function resize(width, height) {
    resizeThreeRenderer(renderer, camera, width, height);
  }

  function setReducedMotion(value) {
    reducedMotion = value;
  }

  function resetLevel() {
    lastBossSize  = null;
    lastGateCount = 0;
    lastCrossedCount = 0;
    prevCrowdSize = 0;
    dustParticles.length = 0;
    dustMeshes.forEach(m => { m.visible = false; });
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
