import * as THREE from '../../vendor/three.module.js';
import { disposeScene, glowTexture, makeNoise, mulberry32, smoothstep, clamp, polarDisc, reduced } from '../util.js';

// Infinite zoom: stage k is drawn at scale exp(L*u), u = z - k (wrapped). Each stage's focal
// "gem" (radius 0.6 at the origin) contains the next stage, shrunk by 1/FACTOR.
const FACTOR = 20;
const L = Math.log(FACTOR);
const N = 3;
const CAPTIONS = ['海灘黃昏', '一粒沙裡的星系', '星系裡的小城'];

export function create({ camera, ui }) {
  camera.near = 0.05; camera.far = 9000; camera.updateProjectionMatrix();
  const rand = mulberry32(9999);
  const noise = makeNoise(9999);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  const glow = glowTexture(0.3);
  const glowHard = glowTexture(0.12);

  // every stage material is registered so its opacity can be driven per frame
  function reg(list, mat) {
    mat.transparent = true;
    list.push({ m: mat, o: mat.opacity });
    return mat;
  }
  const additive = (map, color, opacity) => new THREE.SpriteMaterial({ map, color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  function skyGeo(radius, stops) {
    const g = new THREE.SphereGeometry(radius, 24, 16);
    const p = g.attributes.position, col = new Float32Array(p.count * 3);
    const c = new THREE.Color(), a = new THREE.Color(), b = new THREE.Color();
    const seg = stops.length - 1;
    for (let i = 0; i < p.count; i++) {
      const f = clamp(p.getY(i) / radius, 0, 1) * seg, idx = Math.min(seg - 1, Math.floor(f));
      a.set(stops[idx]); b.set(stops[idx + 1]);
      c.copy(a).lerp(b, smoothstep(0, 1, f - idx));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }

  // focal translucent gem (radius 0.6, centred at origin) that contains the next stage
  function addGem(g, core, color, glowColor) {
    const ico = new THREE.IcosahedronGeometry(0.6, 1);
    const shell = new THREE.Mesh(ico, reg(core, new THREE.MeshBasicMaterial({ color, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })));
    shell.renderOrder = 20; g.add(shell);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(ico), reg(core, new THREE.LineBasicMaterial({ color, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })));
    edges.renderOrder = 21; g.add(edges);
    const h1 = new THREE.Sprite(reg(core, additive(glow, glowColor, 0.85))); h1.scale.set(3.4, 3.4, 1); h1.renderOrder = 22; g.add(h1);
    const h2 = new THREE.Sprite(reg(core, additive(glow, glowColor, 0.3))); h2.scale.set(8, 8, 1); h2.renderOrder = 22; g.add(h2);
  }

  // ---------------- stage 0: beach at sunset ----------------
  const dune = (x, z) => {
    const r = Math.hypot(x, z);
    const n = noise.fbm(x * 0.1, 0.5, z * 0.1, 3);
    return -0.6 + smoothstep(0, 5, r) * (n * 1.1 + 0.12 * Math.sin(z * 0.55 + n * 5));
  };
  const SUNDIR = new THREE.Vector3(-0.25, 0.25, -1).normalize();
  const duneLo = new THREE.Color(0x6b4a3a), duneHi = new THREE.Color(0xf2c47e);
  const duneCol = (c, x, y, z) => {
    const e = 0.4;
    const nrm = new THREE.Vector3(dune(x - e, z) - dune(x + e, z), 2 * e, dune(x, z - e) - dune(x, z + e)).normalize();
    c.copy(duneLo).lerp(duneHi, clamp(nrm.dot(SUNDIR) * 0.8 + 0.35, 0, 1));
  };
  function stage0() {
    const g = new THREE.Group(), core = [], bg = [];
    const sky = new THREE.Mesh(skyGeo(250, [0xf2a65a, 0xd9895a, 0x3b4f6e, 0x14243f]), reg(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false })));
    sky.renderOrder = -100; g.add(sky);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(280, 32).rotateX(-Math.PI / 2), reg(bg, new THREE.MeshBasicMaterial({ color: 0x24505f })));
    sea.position.y = -1.4; sea.renderOrder = -90; g.add(sea);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(40, 260).rotateX(-Math.PI / 2), reg(bg, new THREE.MeshBasicMaterial({ map: glow, color: 0xffc27a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 })));
    path.position.set(-34, -1.3, -150); path.renderOrder = -85; g.add(path);
    const ring = new THREE.Mesh(polarDisc(12, 90, 14, 64, dune, duneCol), reg(bg, new THREE.MeshBasicMaterial({ vertexColors: true })));
    ring.renderOrder = -80; g.add(ring);
    const sun = new THREE.Sprite(reg(bg, additive(glowHard, 0xffe2a8, 1)));
    sun.scale.set(34, 34, 1); sun.position.copy(SUNDIR).multiplyScalar(240); sun.renderOrder = -70; g.add(sun);
    const halo = new THREE.Sprite(reg(bg, additive(glow, 0xff9a50, 0.8)));
    halo.scale.set(190, 190, 1); halo.position.copy(sun.position); halo.renderOrder = -71; g.add(halo);
    const disc = new THREE.Mesh(polarDisc(0, 12, 8, 64, dune, duneCol), reg(core, new THREE.MeshBasicMaterial({ vertexColors: true })));
    g.add(disc);
    const sp = [];
    for (let i = 0; i < 90; i++) { const a = rand() * 6.283, r = 1.5 + rand() * 10.5, x = Math.cos(a) * r, zz = Math.sin(a) * r; sp.push(new THREE.Vector3(x, dune(x, zz) + 0.05, zz)); }
    g.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(sp), reg(core, new THREE.PointsMaterial({ map: glow, color: 0xffe9b8, size: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }))));
    addGem(g, core, 0xfff0c8, 0xffd28a);
    return { g, core, bg };
  }

  // ---------------- stage 1: micro galaxy ----------------
  let galaxySpin = null;
  function stage1() {
    const g = new THREE.Group(), core = [], bg = [];
    const gal = new THREE.Group();
    const PN = 7000, p = new Float32Array(PN * 3), c = new Float32Array(PN * 3);
    const col = new THREE.Color(), warm = new THREE.Color(0xffe2a8), cool = new THREE.Color(0x6fb8ff);
    for (let i = 0; i < PN; i++) {
      const r = 11 * Math.pow(rand(), 0.62), arm = Math.floor(rand() * 3);
      const ang = arm * 2.094 + r * 0.55 + (rand() + rand() - 1) * (0.25 + r * 0.05);
      p[i * 3] = Math.cos(ang) * r; p[i * 3 + 1] = (rand() + rand() - 1) * 0.7 * (1 - r / 14); p[i * 3 + 2] = Math.sin(ang) * r;
      col.copy(warm).lerp(cool, smoothstep(1, 9, r)).multiplyScalar(0.55 + rand() * 0.6);
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    gal.add(new THREE.Points(geo, reg(core, new THREE.PointsMaterial({ map: glow, size: 0.22, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }))));
    const bp = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const r = 2.2 * Math.pow(rand(), 1.4), a = rand() * 6.283, e = Math.acos(2 * rand() - 1);
      bp[i * 3] = r * Math.sin(e) * Math.cos(a); bp[i * 3 + 1] = r * Math.cos(e) * 0.6; bp[i * 3 + 2] = r * Math.sin(e) * Math.sin(a);
    }
    const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    gal.add(new THREE.Points(bgeo, reg(core, new THREE.PointsMaterial({ map: glow, size: 0.2, color: 0xffd9a0, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }))));
    gal.rotation.set(-1.05, 0, 0.25);
    g.add(gal);
    galaxySpin = gal;
    addGem(g, core, 0x9ff6ff, 0x7fe8ff);
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u); sp[i * 3] = Math.cos(a) * s * 220; sp[i * 3 + 1] = u * 220; sp[i * 3 + 2] = Math.sin(a) * s * 220; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const stars = new THREE.Points(sg, reg(bg, new THREE.PointsMaterial({ color: 0xdfe9ff, size: 1.6, sizeAttenuation: false, depthWrite: false, opacity: 0.85 })));
    stars.frustumCulled = false; g.add(stars);
    const neb = new THREE.Sprite(reg(bg, additive(glow, 0x1f7a8c, 0.35))); neb.scale.set(300, 300, 1); neb.position.set(-90, 30, -150); neb.renderOrder = -50; g.add(neb);
    const neb2 = new THREE.Sprite(reg(bg, additive(glow, 0xc4622d, 0.25))); neb2.scale.set(260, 260, 1); neb2.position.set(110, -20, -140); neb2.renderOrder = -50; g.add(neb2);
    return { g, core, bg };
  }

  // ---------------- stage 2: tiny city with the gold tower ----------------
  let clockRing = null;
  function stage2() {
    const g = new THREE.Group(), core = [], bg = [];
    const sky = new THREE.Mesh(skyGeo(250, [0x1b3b5a, 0x0f2240, 0x070f24]), reg(bg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false })));
    sky.renderOrder = -100; g.add(sky);
    const farGround = new THREE.Mesh(new THREE.RingGeometry(12, 260, 48, 1).rotateX(-Math.PI / 2), reg(bg, new THREE.MeshBasicMaterial({ color: 0x0a1428, side: THREE.DoubleSide })));
    farGround.position.y = -4; farGround.renderOrder = -90; g.add(farGround);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 48).rotateX(-Math.PI / 2), reg(core, new THREE.MeshBasicMaterial({ color: 0x0b1a33, side: THREE.DoubleSide })));
    ground.position.y = -4; g.add(ground);
    const grid = new THREE.GridHelper(24, 24, 0x5ef0ff, 0x5ef0ff);
    grid.material.opacity = 0.18; grid.material.depthWrite = false;
    reg(core, grid.material);
    grid.position.y = -3.98; g.add(grid);
    const cells = [];
    for (let i = 0; i < 130 && cells.length < 110; i++) {
      const a = rand() * 6.283, r = 2.8 + Math.sqrt(rand()) * 8.4;
      cells.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w: 0.5 + rand() * 0.7, d: 0.5 + rand() * 0.7, h: 0.5 + rand() * rand() * 2.8 * (1.2 - r / 14) });
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const bld = new THREE.InstancedMesh(boxGeo, reg(core, new THREE.MeshBasicMaterial({ color: 0xffffff })), cells.length);
    const wins = [], wcol = [], d = new THREE.Object3D(), cc = new THREE.Color(), c1 = new THREE.Color(0x12285a), c2 = new THREE.Color(0x0a1633);
    cells.forEach((b, i) => {
      d.position.set(b.x, -4, b.z); d.scale.set(b.w, b.h, b.d); d.updateMatrix();
      bld.setMatrixAt(i, d.matrix);
      bld.setColorAt(i, cc.copy(c1).lerp(c2, rand()));
      for (let k = 0; k < 7; k++) {
        const side = Math.floor(rand() * 4), u = (rand() - 0.5) * 0.8, y = 0.1 + rand() * 0.85;
        const px = side < 2 ? (side === 0 ? -0.5 : 0.5) * b.w : u * b.w;
        const pz = side < 2 ? u * b.d : (side === 2 ? -0.5 : 0.5) * b.d;
        wins.push(new THREE.Vector3(b.x + px * 1.02, -4 + y * b.h, b.z + pz * 1.02));
        cc.setHex(rand() < 0.25 ? 0x5ef0ff : 0xffc864); wcol.push(cc.r, cc.g, cc.b);
      }
    });
    g.add(bld);
    const wg = new THREE.BufferGeometry().setFromPoints(wins);
    wg.setAttribute('color', new THREE.Float32BufferAttribute(wcol, 3));
    g.add(new THREE.Points(wg, reg(core, new THREE.PointsMaterial({ map: glow, size: 0.2, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }))));
    // gold tower: base at y=-4, tip stays below the focal gem
    const goldM = reg(core, new THREE.MeshBasicMaterial({ color: 0xf5c451 })), bandM = reg(core, new THREE.MeshBasicMaterial({ color: 0xffe6a0 }));
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.5, 8), goldM); pod.position.y = -3.75; g.add(pod);
    let y = -3.5;
    for (let i = 0; i < 4; i++) {
      const rb = 0.95 - i * 0.14;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.12, rb, 0.62, 8), goldM); seg.position.y = y + 0.31; g.add(seg);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.18, rb * 1.18, 0.07, 8), bandM); band.position.y = y + 0.62; g.add(band);
      y += 0.65;
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.2, 0.7, 6), bandM); spire.position.y = y + 0.3; g.add(spire);
    clockRing = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.035, 6, 96), reg(core, new THREE.MeshBasicMaterial({ color: 0x5ef0ff, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
    clockRing.rotation.x = Math.PI / 2 - 0.3; clockRing.position.y = -2.3; g.add(clockRing);
    addGem(g, core, 0xffe6a0, 0xf5c451);
    const fl = [];
    for (let i = 0; i < 200; i++) { const a = rand() * 6.283, r = 20 + rand() * 200; fl.push(new THREE.Vector3(Math.cos(a) * r, -3.5 + rand() * 3, Math.sin(a) * r)); }
    g.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(fl), reg(bg, new THREE.PointsMaterial({ map: glow, color: 0xffc864, size: 2.2, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }))));
    return { g, core, bg };
  }

  const stages = [stage0(), stage1(), stage2()];
  stages.forEach((s) => { s.g.visible = false; scene.add(s.g); s.bg.forEach((e) => { e.m.depthWrite = false; }); });

  // ---------------- control ----------------
  const camR = 28;
  let theta = 0;
  const phi = 0.12;
  let z = 0, zGoal = 0, lastInteract = -1e9;
  const touch = () => { lastInteract = performance.now(); };
  const idleSpeed = reduced ? 0.008 : 0.03;
  const wrap = (v) => (((v + 1.5) % N) + N) % N - 1.5;
  const setA = (list, a) => { for (const e of list) { e.m.opacity = e.o * a; e.m.visible = a > 0.004; } };

  return {
    scene,
    update(t, dt) {
      if (performance.now() - lastInteract > 2500) zGoal += idleSpeed * dt;
      z += (zGoal - z) * Math.min(1, dt * 4);
      let dom = 0, domU = 9;
      stages.forEach((s, k) => {
        const u = wrap(z - k);
        s.g.visible = u > -1.3 && u < 1.02;
        if (!s.g.visible) return;
        s.g.scale.setScalar(Math.exp(L * u));
        setA(s.core, smoothstep(-1.3, -1.0, u) * (1 - smoothstep(0.8, 1.0, u)));
        setA(s.bg, smoothstep(-0.55, -0.05, u) * (1 - smoothstep(0.6, 0.95, u)));
        if (Math.abs(u) < domU) { domU = Math.abs(u); dom = k; }
      });
      ui.setStageCaption(CAPTIONS[dom]);
      if (galaxySpin) galaxySpin.rotation.y += dt * 0.06 * (reduced ? 0.3 : 1);
      if (clockRing) clockRing.rotation.z -= dt * 0.3 * (reduced ? 0.3 : 1);
      const th = theta + (reduced ? 0 : Math.sin(t * 0.2) * 0.05);
      camera.position.set(Math.sin(th) * Math.cos(phi) * camR, Math.sin(phi) * camR, Math.cos(th) * Math.cos(phi) * camR);
      camera.lookAt(0, 0, 0);
    },
    drag(dx, dy) {
      theta = clamp(theta - dx * 0.004, -0.9, 0.9);
      zGoal += -dy * 0.004;
      touch();
    },
    zoom(f) { zGoal += -Math.log(f) * 0.5; touch(); },
    nudge() { zGoal += 0.3; touch(); },
    pick() { touch(); },
    setViewport() {},
    dispose() { galaxySpin = null; clockRing = null; disposeScene(scene); },
  };
}
