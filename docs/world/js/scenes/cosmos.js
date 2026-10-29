import * as THREE from '../../vendor/three.module.js';
import { CHAPTERS } from '../data.js';
import { createOrbit, disposeScene, glowTexture, makeNoise, mulberry32, smoothstep, pickScreen, reduced } from '../util.js';

// c: three palette colours; k: surface kind; r: radius; ring/moon flags
const LOOKS = [
  { k: 'rock', c: [0x3b2a20, 0x8a5a3a, 0xc9a27a], r: 1.6 },
  { k: 'ocean', c: [0x1c4f86, 0x4c8a47, 0xc9b27a], r: 2.2, atmo: 0x6fb4ff },
  { k: 'gas', c: [0xe3b26a, 0xb8683c, 0xf4e2b8], r: 3.3, ring: true, atmo: 0xffc88a },
  { k: 'ice', c: [0x9cc7dc, 0xe8f4f8, 0x5f93b3], r: 2.0, atmo: 0xcfeaff },
  { k: 'lava', c: [0x2a1a18, 0x4a2a22, 0xff6a2a], r: 2.4, atmo: 0xff7a40 },
  { k: 'gas', c: [0x3f8f8a, 0x1f5a66, 0xa8e0d0], r: 3.0, atmo: 0x7fe8dc, moon: true },
  { k: 'rock', c: [0x5c4a6a, 0x8d7aa0, 0xd0c0a0], r: 1.8, ring: true },
  { k: 'ocean', c: [0x13607a, 0x6a9a3c, 0xe0d6a0], r: 2.6, atmo: 0x8fe0ff },
  { k: 'gas', c: [0xc2563a, 0x7a2f26, 0xf0b890], r: 3.5, atmo: 0xff9a6a },
  { k: 'ice', c: [0xb8d8e8, 0xf4fbff, 0x7aa8c4], r: 1.7, ring: true, atmo: 0xe0f4ff },
  { k: 'rock', c: [0x4a4f3a, 0x8f9a5a, 0xd8d09a], r: 2.2, moon: true },
  { k: 'lava', c: [0x1a1a24, 0x3a2f4a, 0x40e0d0], r: 2.0, atmo: 0x40e0d0 },
  { k: 'gas', c: [0xf4d58a, 0xc9962e, 0xfff3c8], r: 3.2, ring: true, atmo: 0xffe6a0 },
];

const ATMO_VERT = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const ATMO_FRAG = `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(clamp(-dot(vN, vV), 0.0, 1.0), 1.8); gl_FragColor = vec4(uColor, f * 1.2); }`;

function nebulaTexture(hex) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const col = new THREE.Color(hex);
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const r = mulberry32(hex);
  for (let i = 0; i < 12; i++) {
    const x = 28 + r() * 72, y = 28 + r() * 72, rad = 22 + r() * 36;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(${rgb},0.35)`); grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function create({ camera, canvas, sfx, ui }) {
  camera.near = 0.5; camera.far = 5000; camera.updateProjectionMatrix();
  const rand = mulberry32(2061);
  const noise = makeNoise(2061);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  const glow = glowTexture(0.25);

  scene.add(new THREE.AmbientLight(0x6a7a9a, 1.1));
  scene.add(new THREE.PointLight(0xffe2b0, 5, 0, 0));

  // ---- star ----
  const star = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffd28a }));
  scene.add(star);
  const glowA = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb060, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowA.scale.set(44, 44, 1);
  const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff8a40, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  glowB.scale.set(120, 120, 1);
  scene.add(glowA, glowB);

  // ---- starfield + nebulae ----
  {
    const N = 3000, p = new Float32Array(N * 3), c = new Float32Array(N * 3), col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rand() * 2 - 1, a = rand() * 6.283, s = Math.sqrt(1 - u * u), r = 1500 + rand() * 500;
      p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = u * r; p[i * 3 + 2] = Math.sin(a) * s * r;
      col.setHex([0xffffff, 0xcfe0ff, 0xffe3c0][Math.floor(rand() * 3)]).multiplyScalar(0.4 + rand() * 0.6);
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, fog: false }));
    pts.frustumCulled = false;
    scene.add(pts);
  }
  const nebulae = [];
  [0x1f7a8c, 0xc4622d, 0x2b4f9f].forEach((hex, i) => {
    const tex = nebulaTexture(hex + i);
    for (let j = 0; j < 3; j++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, rotation: rand() * 6 });
      const s = new THREE.Sprite(m);
      const a = rand() * 6.283, e = (rand() - 0.5) * 1.2;
      s.position.set(Math.cos(a) * Math.cos(e) * 1100, Math.sin(e) * 1100, Math.sin(a) * Math.cos(e) * 1100);
      const sz = 700 + rand() * 500;
      s.scale.set(sz, sz, 1);
      scene.add(s);
      nebulae.push(m);
    }
  });

  // ---- planets ----
  const planetGeo = new THREE.SphereGeometry(1, 24, 16);
  const atmoGeo = new THREE.SphereGeometry(1, 20, 14);
  const moonGeo = new THREE.SphereGeometry(1, 12, 8);
  const moonMat = new THREE.MeshLambertMaterial({ color: 0xb8b2a8, flatShading: true });
  const dirV = new THREE.Vector3(), cA = new THREE.Color(), cB = new THREE.Color(), cC = new THREE.Color(), cOut = new THREE.Color();

  function paint(geo, look, seed) {
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    cA.setHex(look.c[0]); cB.setHex(look.c[1]); cC.setHex(look.c[2]);
    for (let i = 0; i < p.count; i++) {
      dirV.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const n = noise.fbm(dirV.x * 2.2 + seed, dirV.y * 2.2 + seed * 0.5, dirV.z * 2.2, 4);
      if (look.k === 'gas') {
        const t = 0.5 + 0.5 * Math.sin((dirV.y * 7 + (n - 0.5) * 2.6) * Math.PI);
        cOut.copy(cA).lerp(cB, t).lerp(cC, smoothstep(0.55, 0.8, n) * 0.7);
      } else if (look.k === 'ocean') {
        if (n > 0.52) cOut.copy(cB).lerp(cC, smoothstep(0.58, 0.7, n)); else cOut.copy(cA).lerp(cC, smoothstep(0.44, 0.52, n) * 0.4);
        if (Math.abs(dirV.y) > 0.86) cOut.lerp(new THREE.Color(0xffffff), 0.8);
      } else if (look.k === 'ice') {
        cOut.copy(cB).lerp(cA, n);
        if (Math.abs(n - 0.5) < 0.03) cOut.copy(cC);
      } else if (look.k === 'lava') {
        cOut.copy(cA).lerp(cB, n);
        if (Math.abs(n - 0.5) < 0.035) cOut.copy(cC);
      } else {
        cOut.copy(cA).lerp(cB, smoothstep(0.35, 0.6, n)).lerp(cC, smoothstep(0.6, 0.85, n));
      }
      col[i * 3] = cOut.r; col[i * 3 + 1] = cOut.g; col[i * 3 + 2] = cOut.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }

  function labelSprite(text) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(20,18,16,0.95)'; g.strokeText(text, 32, 34);
    g.fillStyle = '#f4ecdc'; g.fillText(text, 32, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, sizeAttenuation: false, depthTest: false }));
  }

  const ringTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = '#ffd27a'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, 6.3); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const selector = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
  selector.visible = false;
  scene.add(selector);

  const planets = CHAPTERS.map((ch, i) => {
    const look = LOOKS[i];
    const a = 16 + i * 6.2;
    const holder = new THREE.Group();
    holder.rotation.set((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12);
    scene.add(holder);
    const pts = [];
    for (let j = 0; j < 160; j++) { const q = (j / 160) * 6.2832; pts.push(new THREE.Vector3(Math.cos(q) * a, 0, Math.sin(q) * a)); }
    holder.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.09 })));
    const body = new THREE.Group();
    holder.add(body);
    const geo = planetGeo.clone();
    paint(geo, look, i * 7.3);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: false }));
    mesh.scale.setScalar(look.r);
    mesh.rotation.z = (rand() - 0.5) * 0.6;
    body.add(mesh);
    if (look.atmo) {
      const am = new THREE.Mesh(atmoGeo, new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, uniforms: { uColor: { value: new THREE.Color(look.atmo) } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
      }));
      am.scale.setScalar(look.r * 1.16);
      body.add(am);
    }
    if (look.ring) {
      const rg = new THREE.RingGeometry(look.r * 1.45, look.r * 2.4, 56, 1).rotateX(-Math.PI / 2);
      const pp = rg.attributes.position, cc = new Float32Array(pp.count * 3), tint = new THREE.Color(look.c[2]);
      for (let v = 0; v < pp.count; v++) {
        const rr = Math.hypot(pp.getX(v), pp.getZ(v)) / look.r;
        const b = 0.45 + 0.55 * Math.abs(Math.sin(rr * 11 + i));
        cc[v * 3] = tint.r * b; cc[v * 3 + 1] = tint.g * b; cc[v * 3 + 2] = tint.b * b;
      }
      rg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.set(0.35 + (i % 3) * 0.15, 0, 0.25);
      body.add(ring);
    }
    let moon = null;
    if (look.moon) { moon = new THREE.Mesh(moonGeo, moonMat); moon.scale.setScalar(look.r * 0.3); body.add(moon); }
    const label = labelSprite(ch.id);
    label.scale.set(0.045, 0.045, 1);
    label.position.y = look.r * 1.7 + 0.8;
    body.add(label);
    return { ch, i, look, a, w: 2.2 / Math.pow(a, 1.2), ph: i * 2.4, body, mesh, moon, pos: new THREE.Vector3(), rad: look.r * 1.2 };
  });

  const target = new THREE.Vector3();
  const orbit = createOrbit({ target, theta: 0.5, elev: 0.55, radius: 150, min: 6, max: 380, elevMin: -1.2, elevMax: 1.45 });
  let focus = null;
  const k = reduced ? 0.3 : 1;
  const tmp = new THREE.Vector3();

  function unfocus() {
    focus = null;
    orbit.radiusGoal = 150;
    selector.visible = false;
  }

  return {
    scene,
    update(t, dt) {
      star.scale.setScalar(1 + Math.sin(t * 1.3) * 0.015);
      glowA.material.opacity = 0.65 + Math.sin(t * 0.9) * 0.08;
      for (const m of nebulae) m.rotation += dt * 0.002 * k;
      for (const p of planets) {
        const ang = p.ph + t * p.w * k;
        p.body.position.set(Math.cos(ang) * p.a, 0, Math.sin(ang) * p.a);
        p.mesh.rotation.y += dt * 0.25 * k;
        if (p.moon) { const mm = t * 0.9 * k + p.i; p.moon.position.set(Math.cos(mm) * p.look.r * 2.1, 0.2, Math.sin(mm) * p.look.r * 2.1); }
        p.body.getWorldPosition(p.pos);
      }
      if (focus) { target.lerp(focus.pos, Math.min(1, dt * 4)); }
      else target.lerp(tmp.set(0, 0, 0), Math.min(1, dt * 3));
      if (focus) {
        selector.visible = true;
        selector.position.copy(focus.pos);
        const s = focus.look.r * 3.4 * (1 + Math.sin(t * 4) * 0.05);
        selector.scale.set(s, s, 1);
      }
      orbit.apply(camera, t, dt);
    },
    drag: orbit.drag,
    zoom: orbit.zoom,
    pick(x, y, coarse) {
      orbit.touch();
      const p = pickScreen(planets, camera, canvas, x, y, coarse, 36);
      if (!p) { ui.closeCard(); return; }
      sfx('chime');
      focus = p;
      orbit.radiusGoal = Math.max(10, p.look.r * 5.5);
      ui.openCard({
        label: p.ch.label, title: p.ch.title, line: p.ch.line, href: `../s${p.ch.id}.html`, linkText: '閱讀本章 →',
        onClose: () => { if (focus === p) unfocus(); },
      });
    },
    setViewport() {},
    dispose() { disposeScene(scene); },
  };
}
