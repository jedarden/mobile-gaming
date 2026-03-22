/**
 * Makeover Run - Three.js Renderer
 *
 * Scene elements:
 *  - Runway with pink/gold lane markings
 *  - Articulated character with tier-based appearance (hair, outfit, makeup, accessories)
 *  - Station arches: green (+) for upgrades, red (-) for downgrades
 *  - Finish line arch
 *  - Chase camera from behind and above
 */

import * as THREE from 'three';
import {
  createThreeScene,
  resizeThreeRenderer,
  createBasicLights
} from '../../shared/three-setup.js';

// World dimensions
const LANE_WORLD       = 2.5;   // state.x * LANE_WORLD = world x
const COURSE_HALF_WIDTH = 4.5;
const CAMERA_HEIGHT    = 9;
const CAMERA_BACK      = 12;
const CAMERA_LOOKAHEAD = 20;
const VIEW_DISTANCE    = 160;

// Character proportions
const CHAR_Y_OFFSET = 0;  // feet at y=0

// Tier colours
const OUTFIT_COLORS = [0x888888, 0xFF9ECD, 0xC71585, 0xFFD700];
const FACE_COLORS   = [0xFFDBB5, 0xFFB0B0, 0xFF8C8C, 0xFF6080];
const HAIR_COLORS   = [0x4A3728, 0x8B6347, 0xDAA520, 0xF5F5DC];

/**
 * Build the player character group.
 * Returns { group, update(appearance) } where update swaps tier visuals.
 */
function buildCharacter() {
  const group = new THREE.Group();

  // — Legs
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.65, 8);
  const legMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
  const leftLeg  = new THREE.Mesh(legGeo, legMat);
  const rightLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.18, 0.325, 0);
  rightLeg.position.set( 0.18, 0.325, 0);
  group.add(leftLeg, rightLeg);

  // — Torso (outfit-coloured)
  const torsoGeo = new THREE.CylinderGeometry(0.32, 0.38, 1.0, 12);
  const torsoMat = new THREE.MeshPhongMaterial({ color: OUTFIT_COLORS[0] });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(0, 1.15, 0);
  group.add(torso);

  // — Arms
  const armGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.6, 8);
  const armMat = new THREE.MeshPhongMaterial({ color: FACE_COLORS[0] });
  const leftArm  = new THREE.Mesh(armGeo, armMat.clone());
  const rightArm = new THREE.Mesh(armGeo, armMat.clone());
  leftArm.rotation.z  =  0.4;
  rightArm.rotation.z = -0.4;
  leftArm.position.set(-0.52, 1.1, 0);
  rightArm.position.set( 0.52, 1.1, 0);
  group.add(leftArm, rightArm);

  // — Neck
  const neckGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.25, 8);
  const neckMat = new THREE.MeshPhongMaterial({ color: FACE_COLORS[0] });
  const neck = new THREE.Mesh(neckGeo, neckMat);
  neck.position.set(0, 1.78, 0);
  group.add(neck);

  // — Head (face-coloured)
  const headGeo = new THREE.SphereGeometry(0.36, 16, 12);
  const headMat = new THREE.MeshPhongMaterial({ color: FACE_COLORS[0] });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 2.28, 0);
  group.add(head);

  // — Eyes (fixed)
  const eyeGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  [-0.14, 0.14].forEach(xOff => {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(xOff, 2.32, 0.32);
    group.add(eye);
  });

  // — Smile
  const smileGeo = new THREE.TorusGeometry(0.1, 0.025, 6, 10, Math.PI);
  const smileMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const smile = new THREE.Mesh(smileGeo, smileMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, 2.16, 0.33);
  group.add(smile);

  // — Hair groups (tier 0–3)
  const hairGroups = buildHairGroups();
  hairGroups.forEach(g => group.add(g));

  // — Accessories groups (tier 0–3)
  const accGroups = buildAccessoriesGroups();
  accGroups.forEach(g => group.add(g));

  // Show only tier-0 visuals initially
  hairGroups.forEach((g, i) => { g.visible = (i === 0); });
  accGroups.forEach((g, i)  => { g.visible = (i === 0); });

  function update(appearance) {
    // Outfit tier → torso colour
    torsoMat.color.setHex(OUTFIT_COLORS[appearance.outfit] || OUTFIT_COLORS[0]);

    // Makeup tier → face / skin colour
    const faceColor = FACE_COLORS[appearance.makeup] || FACE_COLORS[0];
    headMat.color.setHex(faceColor);
    neckMat.color.setHex(faceColor);
    armMat.color.setHex(faceColor);
    leftArm.material.color.setHex(faceColor);
    rightArm.material.color.setHex(faceColor);

    // Hair tier → show correct group
    hairGroups.forEach((g, i) => { g.visible = (i === appearance.hair); });

    // Accessories tier → show correct group
    accGroups.forEach((g, i) => { g.visible = (i === appearance.accessories); });
  }

  return { group, update };
}

function buildHairGroups() {
  const groups = [];

  // Tier 0: flat cap
  const g0 = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.07, 16),
    new THREE.MeshPhongMaterial({ color: HAIR_COLORS[0] })
  );
  cap.position.set(0, 2.62, 0);
  g0.add(cap);
  groups.push(g0);

  // Tier 1: short dome
  const g1 = new THREE.Group();
  const dome1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: HAIR_COLORS[1] })
  );
  dome1.position.set(0, 2.62, 0);
  g1.add(dome1);
  groups.push(g1);

  // Tier 2: fuller dome with waves
  const g2 = new THREE.Group();
  const dome2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65),
    new THREE.MeshPhongMaterial({ color: HAIR_COLORS[2] })
  );
  dome2.position.set(0, 2.62, 0);
  g2.add(dome2);
  // Side strands
  [-0.28, 0.28].forEach(xOff => {
    const strand = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshPhongMaterial({ color: HAIR_COLORS[2] })
    );
    strand.position.set(xOff, 2.28, 0.1);
    g2.add(strand);
  });
  groups.push(g2);

  // Tier 3: glamorous — large dome + front wave + highlights
  const g3 = new THREE.Group();
  const dome3 = new THREE.Mesh(
    new THREE.SphereGeometry(0.50, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7),
    new THREE.MeshPhongMaterial({ color: HAIR_COLORS[3], shininess: 80 })
  );
  dome3.position.set(0, 2.62, 0);
  g3.add(dome3);
  // Voluminous sides
  [-0.38, 0.38].forEach(xOff => {
    const vol = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshPhongMaterial({ color: HAIR_COLORS[3], shininess: 80 })
    );
    vol.position.set(xOff, 2.24, 0.0);
    g3.add(vol);
  });
  // Crown sparkle
  const sparkGeo = new THREE.OctahedronGeometry(0.08);
  const sparkMat = new THREE.MeshPhongMaterial({ color: 0xFFE066, shininess: 120 });
  [[-0.15, 3.12, 0], [0, 3.16, 0], [0.15, 3.12, 0]].forEach(([x, y, z]) => {
    const sp = new THREE.Mesh(sparkGeo, sparkMat);
    sp.position.set(x, y, z);
    g3.add(sp);
  });
  groups.push(g3);

  return groups;
}

function buildAccessoriesGroups() {
  const groups = [];

  // Tier 0: nothing
  groups.push(new THREE.Group());

  // Tier 1: earrings
  const g1 = new THREE.Group();
  const earGeo = new THREE.SphereGeometry(0.065, 6, 6);
  const earMat = new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 100 });
  [-0.42, 0.42].forEach(xOff => {
    const ear = new THREE.Mesh(earGeo, earMat);
    ear.position.set(xOff, 2.22, 0.04);
    g1.add(ear);
  });
  groups.push(g1);

  // Tier 2: earrings + necklace
  const g2 = new THREE.Group();
  [-0.42, 0.42].forEach(xOff => {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 6, 6),
      new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 100 })
    );
    ear.position.set(xOff, 2.22, 0.04);
    g2.add(ear);
  });
  // Necklace ring
  const neckRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.04, 6, 16),
    new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 100 })
  );
  neckRing.rotation.x = Math.PI / 2;
  neckRing.position.set(0, 1.72, 0.15);
  g2.add(neckRing);
  groups.push(g2);

  // Tier 3: earrings + necklace + crown
  const g3 = new THREE.Group();
  [-0.42, 0.42].forEach(xOff => {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 120 })
    );
    ear.position.set(xOff, 2.22, 0.04);
    g3.add(ear);
  });
  const neckRing3 = new THREE.Mesh(
    new THREE.TorusGeometry(0.30, 0.045, 6, 16),
    new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 120 })
  );
  neckRing3.rotation.x = Math.PI / 2;
  neckRing3.position.set(0, 1.72, 0.15);
  g3.add(neckRing3);
  // Crown band
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.045, 6, 16),
    new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 120 })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.set(0, 2.72, 0);
  g3.add(crown);
  // Crown points
  const pointGeo = new THREE.ConeGeometry(0.055, 0.22, 6);
  const pointMat = new THREE.MeshPhongMaterial({ color: 0xFFD700 });
  [-0.28, 0, 0.28].forEach(xOff => {
    const pt = new THREE.Mesh(pointGeo, pointMat);
    pt.position.set(xOff, 2.98, 0);
    g3.add(pt);
  });
  groups.push(g3);

  return groups;
}

/**
 * Build a station arch mesh.
 * positive=true → green arch;  positive=false → red arch
 */
function buildStationMesh(station) {
  const group = new THREE.Group();
  const isPos  = station.positive;
  const color  = isPos ? 0x22CC22 : 0xCC2222;
  const dark   = isPos ? 0x147A14 : 0x7A1414;

  // Arch panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 3.6, 0.35),
    new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.8 })
  );
  panel.position.set(0, 1.8, 0);
  group.add(panel);

  // Posts
  const postMat = new THREE.MeshPhongMaterial({ color: dark });
  [-0.9, 0.9].forEach(xOff => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 0.35), postMat);
    post.position.set(xOff, 1.8, 0);
    group.add(post);
  });

  // Top bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 0.35), postMat);
  bar.position.set(0, 3.6, 0);
  group.add(bar);

  // Label texture
  const label = makeStationLabel(station);
  label.position.set(0, 1.9, 0.22);
  group.add(label);

  group.position.set(station.x * LANE_WORLD, 0, station.z);
  return group;
}

/**
 * Create canvas-texture sprite for a station label.
 */
function makeStationLabel(station) {
  const canvas = document.createElement('canvas');
  canvas.width  = 192;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = station.positive ? '#1a7a1a' : '#7a1a1a';
  ctx.roundRect(4, 4, 184, 120, 14);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const sign = station.positive ? '+' : '-';
  const cat  = station.positive ? station.type : (station.downgrade || 'looks');
  const icon = { hair: '💇', outfit: '👗', makeup: '💄', accessories: '💍' }[cat] || '✨';
  ctx.fillText(`${sign} ${icon}`, 96, 54);

  if (station.positive) {
    ctx.font = '22px Arial';
    ctx.fillText(`Tier ${station.upgrade}`, 96, 95);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const mat  = new THREE.SpriteMaterial({ map: texture });
  const spr  = new THREE.Sprite(mat);
  spr.scale.set(2.4, 1.6, 1);
  return spr;
}

/**
 * Build finish line arch.
 */
function buildFinishArch(courseLength) {
  const group = new THREE.Group();
  const mat   = new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 100 });

  // Two posts
  [-COURSE_HALF_WIDTH + 0.3, COURSE_HALF_WIDTH - 0.3].forEach(xOff => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 10), mat);
    post.position.set(xOff, 2.5, 0);
    group.add(post);
  });

  // Top crossbar
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, COURSE_HALF_WIDTH * 2, 10), mat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 5, 0);
  group.add(bar);

  // Checkered pattern
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#FFFFFF';
    ctx.fillRect(i * 16, 0, 16, 32);
    ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#000000';
    ctx.fillRect(i * 16, 32, 16, 32);
  }
  const checkTex = new THREE.CanvasTexture(canvas);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(COURSE_HALF_WIDTH * 2, 0.8),
    new THREE.MeshBasicMaterial({ map: checkTex })
  );
  banner.position.set(0, 4.5, 0);
  group.add(banner);

  group.position.z = courseLength;
  return group;
}

/**
 * Create and return a renderer instance.
 */
export function createRenderer(container) {
  let scene, camera, renderer, canvas;
  let character, charGroup;
  let stationMeshes = [];
  let finishArch    = null;
  let reducedMotion = false;

  let lastCourseLength = null;
  let lastStationCount = 0;

  const dummy = new THREE.Object3D();

  function init() {
    const result = createThreeScene(container, {
      fov: 55,
      backgroundColor: 0xFFE4F0,
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
      directionalPosition: new THREE.Vector3(5, 14, -6)
    });

    buildRunway();
    buildWalls();

    character = buildCharacter();
    charGroup = character.group;
    scene.add(charGroup);
  }

  // ── Ground ────────────────────────────────────────────────────────────────

  function buildRunway() {
    // Pink runway
    const geo = new THREE.PlaneGeometry(COURSE_HALF_WIDTH * 2, 2000);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFCCE0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 1000);
    ground.receiveShadow = true;
    scene.add(ground);

    // Centre stripe
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 2000),
      new THREE.MeshBasicMaterial({ color: 0xFF69B4, transparent: true, opacity: 0.5 })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(0, 0.01, 1000);
    scene.add(stripe);

    // Side lane stripes
    [-LANE_WORLD * 0.92, LANE_WORLD * 0.92].forEach(xOff => {
      const lane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.08, 2000),
        new THREE.MeshBasicMaterial({ color: 0xFFB6D9, transparent: true, opacity: 0.6 })
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(xOff, 0.01, 1000);
      scene.add(lane);
    });
  }

  function buildWalls() {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xFF69B4 });
    [-1, 1].forEach(side => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 2000), wallMat);
      wall.position.set(side * COURSE_HALF_WIDTH, 0.75, 1000);
      scene.add(wall);
    });
  }

  // ── Station arches ────────────────────────────────────────────────────────

  function setupStations(stations) {
    stationMeshes.forEach(m => scene.remove(m));
    stationMeshes = [];
    stations.forEach(s => {
      const mesh = buildStationMesh(s);
      scene.add(mesh);
      stationMeshes.push(mesh);
    });
  }

  function updateStationVisibility(stations, playerZ) {
    stations.forEach((s, i) => {
      const mesh = stationMeshes[i];
      if (!mesh) return;
      const inView = s.z >= playerZ - 15 && s.z <= playerZ + VIEW_DISTANCE;
      mesh.visible = inView && !s.triggered;
    });
  }

  // ── Finish arch ───────────────────────────────────────────────────────────

  function setupFinish(courseLength) {
    if (finishArch) scene.remove(finishArch);
    finishArch = buildFinishArch(courseLength);
    scene.add(finishArch);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function render(state) {
    // Lazy setup of stations and finish line
    if (lastCourseLength !== state.courseLength) {
      setupFinish(state.courseLength);
      lastCourseLength = state.courseLength;
    }
    if (lastStationCount !== state.stations.length) {
      setupStations(state.stations);
      lastStationCount = state.stations.length;
    }

    // Update character position and appearance
    const worldX = state.x * LANE_WORLD;
    charGroup.position.set(worldX, CHAR_Y_OFFSET, state.z);
    character.update(state.appearance);

    // Gentle bob animation
    if (!reducedMotion && state.status === 'running') {
      const t = Date.now() * 0.008;
      charGroup.position.y = CHAR_Y_OFFSET + Math.abs(Math.sin(t)) * 0.06;
    }

    // Station visibility
    updateStationVisibility(state.stations, state.z);

    // Camera chase
    const camZ = state.z - CAMERA_BACK;
    const camX = worldX * 0.25;
    if (reducedMotion) {
      camera.position.set(camX, CAMERA_HEIGHT, camZ);
    } else {
      camera.position.x += (camX - camera.position.x) * 0.08;
      camera.position.y  = CAMERA_HEIGHT;
      camera.position.z += (camZ - camera.position.z) * 0.12;
    }
    camera.lookAt(worldX * 0.2, 1.5, state.z + CAMERA_LOOKAHEAD);

    renderer.render(scene, camera);
  }

  // ── Win animation ─────────────────────────────────────────────────────────

  function animateWin(onComplete) {
    if (reducedMotion) { if (onComplete) onComplete(); return; }

    const startTime = performance.now();
    const duration  = 1200;

    function step(now) {
      const t = Math.min((now - startTime) / duration, 1);
      charGroup.rotation.y = Math.sin(t * Math.PI * 4) * 0.5;
      charGroup.position.y = CHAR_Y_OFFSET + Math.sin(t * Math.PI) * 0.8;
      renderer.render(scene, camera);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        charGroup.rotation.y = 0;
        charGroup.position.y = CHAR_Y_OFFSET;
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
    lastCourseLength = null;
    lastStationCount = 0;
  }

  function destroy() {
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    stationMeshes.forEach(m => scene.remove(m));
    stationMeshes = [];
  }

  return {
    init,
    render,
    resize,
    animateWin,
    setReducedMotion,
    resetLevel,
    destroy,
    get canvas() { return canvas; }
  };
}

export default { createRenderer };
