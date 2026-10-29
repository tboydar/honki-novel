import * as THREE from '../vendor/three.module.js';
import { CHAPTERS, IRIS_LINES, STORAGE_KEY, WIN_KILLS } from './data.js';
import { showToast, openCard, closeCard } from './ui.js';

const MAX_FAKES = 12;
const SPAWN_EVERY = 1.5;
const $ = (id) => document.getElementById(id);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { shards: Array.isArray(s.shards) ? s.shards : [], won: !!s.won };
  } catch (e) { return { shards: [], won: false }; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

function fakeTexture(seed) {
  const W = 256, H = 320;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#3a0716'); grd.addColorStop(1, '#16030a');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ff3b5c'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.fillStyle = '#ff3b5c'; g.beginPath(); g.arc(24, 24, 7, 0, 7); g.fill();
  g.fillRect(40, 19, 50, 10);
  // generic face icon
  g.fillStyle = 'rgba(255,59,92,0.28)'; g.strokeStyle = '#ff6b84'; g.lineWidth = 5;
  g.beginPath(); g.ellipse(128, 215, 78, 52, 0, Math.PI, 0); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(128, 128, 58, 70, 0, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#ffd1d9';
  g.fillRect(96, 112, 26, 14); g.fillRect(138, 112 + (r() * 8 - 4), 26, 14);
  g.beginPath(); g.moveTo(94, 160);
  for (let i = 0; i < 6; i++) g.lineTo(94 + (i + 1) * 12, 160 + (i % 2 ? -8 : 8));
  g.lineWidth = 5; g.stroke();
  // glitch slices
  for (let i = 0; i < 7; i++) {
    const y = Math.floor(r() * (H - 30)), h = 6 + Math.floor(r() * 18), dx = Math.floor((r() - 0.5) * 44);
    g.drawImage(c, 0, y, W, h, dx, y, W, h);
  }
  g.fillStyle = 'rgba(94,240,255,0.55)'; g.fillRect(0, Math.floor(r() * H), W, 3);
  g.fillStyle = '#ff3b5c';
  g.fillRect(30, 270, 120, 9); g.fillRect(30, 288, 80, 9);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function numberSprite(label) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(5,11,31,0.9)'; g.strokeText(label, 32, 34);
  g.fillStyle = '#fff3c4'; g.fillText(label, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
}

export function createGame({ scene, camera, canvas, sfx = () => {} }) {
  const state = loadState();
  const collected = new Set(state.shards);
  let kills = 0;
  let spawnT = SPAWN_EVERY - 0.3;
  let lastLine = -1;
  let winTimer = 0;

  const killsEl = $('kills'), shardsEl = $('shards');
  const overlay = $('overlay');
  function updateHud() {
    killsEl.textContent = String(kills);
    shardsEl.textContent = `${collected.size} / ${CHAPTERS.length}`;
  }

  // ---- shatter particles (pooled) ----
  const PN = 900;
  const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3);
  const pVel = new Float32Array(PN * 3), pBase = new Float32Array(PN * 3), pLife = new Float32Array(PN);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.7, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  particles.frustumCulled = false;
  scene.add(particles);
  let pHead = 0;
  const tmpC = new THREE.Color();
  function burst(pos, hex, n, speed) {
    tmpC.set(hex);
    for (let k = 0; k < n; k++) {
      const i = pHead; pHead = (pHead + 1) % PN;
      pPos[i * 3] = pos.x; pPos[i * 3 + 1] = pos.y; pPos[i * 3 + 2] = pos.z;
      const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), sp = speed * (0.3 + Math.random());
      pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      pVel[i * 3 + 1] = Math.cos(ph) * sp + 2;
      pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      pBase[i * 3] = tmpC.r; pBase[i * 3 + 1] = tmpC.g; pBase[i * 3 + 2] = tmpC.b;
      pLife[i] = 0.7 + Math.random() * 0.6;
    }
  }
  function updateParticles(dt) {
    for (let i = 0; i < PN; i++) {
      if (pLife[i] <= 0) { pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; continue; }
      pLife[i] -= dt;
      pVel[i * 3 + 1] -= 7 * dt;
      pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      const f = Math.max(0, Math.min(1, pLife[i]));
      pCol[i * 3] = pBase[i * 3] * f; pCol[i * 3 + 1] = pBase[i * 3 + 1] * f; pCol[i * 3 + 2] = pBase[i * 3 + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  // ---- fakes ----
  const fakeTex = [0, 1, 2, 3].map((i) => fakeTexture(i + 3));
  const planeGeo = new THREE.PlaneGeometry(3.6, 4.5);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const fakes = [];
  function spawnFake(t) {
    const mat = new THREE.MeshBasicMaterial({
      map: fakeTex[Math.floor(Math.random() * fakeTex.length)], transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(planeGeo, mat);
    const hit = new THREE.Mesh(planeGeo, hitMat);
    hit.scale.set(1.5, 1.4, 1);
    const f = {
      mesh, mat, hit, kind: 'fake', born: t, seed: Math.random() * 100,
      ang: Math.random() * 6.283, rad: 18 + Math.random() * 18, y: 7 + Math.random() * 20,
      spd: (Math.random() < 0.5 ? -1 : 1) * (0.03 + Math.random() * 0.05),
    };
    hit.userData.owner = f;
    mesh.add(hit);
    mesh.scale.setScalar(0.001);
    scene.add(mesh);
    fakes.push(f);
  }
  function killFake(f) {
    burst(f.mesh.position, 0xff3b5c, 40, 9);
    burst(f.mesh.position, 0x5ef0ff, 10, 7);
    sfx('shatter');
    scene.remove(f.mesh);
    f.mat.dispose();
    fakes.splice(fakes.indexOf(f), 1);
    kills++;
    updateHud();
    let i;
    do { i = Math.floor(Math.random() * IRIS_LINES.length); } while (i === lastLine);
    lastLine = i;
    showToast(IRIS_LINES[i]);
    if (kills === WIN_KILLS && !state.won) {
      state.won = true; saveState({ shards: [...collected], won: true });
      winTimer = setTimeout(() => { overlay.hidden = false; }, 500);
    }
  }

  // ---- shards ----
  const octGeo = new THREE.OctahedronGeometry(0.9);
  const hitGeo = new THREE.SphereGeometry(2.1, 8, 6);
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xf5c451 });
  const doneMat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff });
  const glowGold = new THREE.MeshBasicMaterial({ color: 0xf5c451, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowDone = new THREE.MeshBasicMaterial({ color: 0x5ef0ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  const shards = CHAPTERS.map((ch, i) => {
    const mesh = new THREE.Mesh(octGeo, collected.has(ch.id) ? doneMat : goldMat);
    const glow = new THREE.Mesh(octGeo, collected.has(ch.id) ? glowDone : glowGold);
    glow.scale.setScalar(1.8);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    const label = numberSprite(ch.id);
    label.position.y = 1.9; label.scale.set(1.8, 1.8, 1);
    const sh = {
      mesh, glow, kind: 'shard', ch, i,
      a0: (i / CHAPTERS.length) * Math.PI * 2, rad: 12 + (i % 3) * 2.2,
      h: 8 + ((i * 7) % 13) * 2, spd: 0.12 + (i % 4) * 0.02, tilt: Math.random() * 6,
    };
    hit.userData.owner = sh;
    mesh.add(glow, hit, label);
    scene.add(mesh);
    return sh;
  });
  function markDone(sh) { sh.mesh.material = doneMat; sh.glow.material = glowDone; }

  function openChapter(ch) {
    openCard({ label: ch.label, title: ch.title, line: ch.line, href: `../s${ch.id}.html` });
  }
  function collect(sh) {
    burst(sh.mesh.position, 0xf5c451, 30, 7);
    sfx('chime');
    if (!collected.has(sh.ch.id)) {
      collected.add(sh.ch.id);
      markDone(sh);
      saveState({ shards: [...collected], won: state.won });
      updateHud();
      showToast(collected.size === CHAPTERS.length ? '「十三塊記憶碎片，全部找回來了！」' : '【叮！取得記憶碎片】');
    }
    openChapter(sh.ch);
  }

  // ---- picking ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmpV = new THREE.Vector3();
  function pick(cx, cy, coarse) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = fakes.map((f) => f.hit).concat(shards.map((s) => s.mesh.children[1]));
    const hits = ray.intersectObjects(objs, false);
    let target = hits.length ? hits[0].object.userData.owner : null;
    if (!target) {
      let best = coarse ? 56 : 30;
      for (const o of [...fakes, ...shards]) {
        tmpV.copy(o.mesh.position).project(camera);
        if (tmpV.z > 1) continue;
        const d = Math.hypot((tmpV.x * 0.5 + 0.5) * rect.width + rect.left - cx, (-tmpV.y * 0.5 + 0.5) * rect.height + rect.top - cy);
        if (d < best) { best = d; target = o; }
      }
    }
    if (!target) return;
    if (target.kind === 'fake') killFake(target); else collect(target);
  }

  function update(t, dt) {
    spawnT += dt;
    if (spawnT >= SPAWN_EVERY) {
      spawnT = 0;
      if (fakes.length < MAX_FAKES) spawnFake(t);
    }
    for (const f of fakes) {
      f.ang += f.spd * dt;
      f.mesh.position.set(Math.cos(f.ang) * f.rad, f.y + Math.sin(t * 0.8 + f.seed) * 0.9, Math.sin(f.ang) * f.rad);
      f.mesh.quaternion.copy(camera.quaternion);
      const age = t - f.born;
      const grow = Math.min(1, age / 0.4);
      const flick = Math.sin(t * 37 + f.seed) > 0.85 || Math.sin(t * 11 + f.seed * 3) > 0.95;
      f.mat.opacity = (flick ? 0.35 : 0.85) * grow;
      f.mesh.scale.set(Math.max(0.001, grow) * (flick ? 1.08 : 1), Math.max(0.001, grow), 1);
    }
    for (const s of shards) {
      const a = s.a0 - t * s.spd;
      s.mesh.position.set(Math.cos(a) * s.rad, s.h + Math.sin(t * 0.9 + s.i) * 0.7, Math.sin(a) * s.rad);
      s.mesh.rotation.set(t * 0.7 + s.tilt, t * 1.1, 0);
      s.glow.scale.setScalar(1.8 + Math.sin(t * 3 + s.i) * 0.15);
    }
    // keep number sprites readable: sprites are billboards by nature
    updateParticles(dt);
  }

  const keepBtn = $('overlay-keep');
  const onKeep = () => { overlay.hidden = true; };
  const onKey = (e) => { if (e.key === 'Escape') overlay.hidden = true; };
  keepBtn.addEventListener('click', onKeep);
  window.addEventListener('keydown', onKey);
  updateHud();

  function dispose() {
    keepBtn.removeEventListener('click', onKeep);
    window.removeEventListener('keydown', onKey);
    clearTimeout(winTimer);
    overlay.hidden = true;
    fakeTex.forEach((t) => t.dispose());
  }

  return { update, pick, dispose };
}
