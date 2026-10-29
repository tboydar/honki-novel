import * as THREE from '../vendor/three.module.js';

export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// 3D value noise (0..1) with fbm helper
export function makeNoise(seed) {
  const r = mulberry32(seed);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const P = new Uint8Array(512);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = r();
  const f = (t) => t * t * (3 - 2 * t);
  const h = (a, b, c) => val[P[P[P[a & 255] + (b & 255)] + (c & 255)]];
  function n3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w);
  }
  function fbm(x, y, z, oct = 4) {
    let s = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) { s += a * n3(x, y, z); n += a; x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; }
    return s / n;
  }
  return { n3, fbm };
}

// Dispose every GPU resource under a scene (geometries, materials, textures).
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.isInstancedMesh) o.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
      m.dispose();
    }
  });
  scene.clear();
}

// Soft round sprite texture (white, alpha falloff)
export function glowTexture(hard = 0.35) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(hard, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Polar grid mesh with per-vertex height and colour: hfn(x,z)->y, colfn(color,x,y,z,r)
export function polarDisc(r0, r1, nr, ns, hfn, colfn) {
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  for (let i = 0; i <= nr; i++) {
    const r = r0 + (r1 - r0) * (i / nr);
    for (let j = 0; j <= ns; j++) {
      const a = (j / ns) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const y = hfn(x, z);
      pos.push(x, y, z);
      colfn(c, x, y, z, r);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < ns; j++) {
      const a = i * (ns + 1) + j, b = a + ns + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Orbit camera controller. drag/zoom are semantic inputs forwarded by main.js.
export function createOrbit({ target = new THREE.Vector3(), theta = 0.6, elev = 0.3, radius = 80, min = 20, max = 200, elevMin = 0.05, elevMax = 1.3, sway = true }) {
  const o = { target, theta, elev, radius, radiusGoal: radius, goal: null, last: -1e9 };
  o.touch = () => { o.last = performance.now(); };
  o.drag = (dx, dy) => {
    o.theta -= dx * 0.005;
    o.elev = clamp(o.elev + dy * 0.004, elevMin, elevMax);
    o.goal = null;
    o.touch();
  };
  o.zoom = (f) => { o.radiusGoal = clamp(o.radiusGoal * f, min, max); o.touch(); };
  o.apply = (camera, t, dt) => {
    if (sway && !reduced && !o.goal && performance.now() - o.last > 3000) o.theta += Math.cos(t * 0.15) * 0.09 * dt;
    if (o.goal) {
      let d = o.goal.theta - o.theta;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const k = Math.min(1, dt * 3);
      o.theta += d * k;
      o.elev += (o.goal.elev - o.elev) * k;
    }
    o.radius += (o.radiusGoal - o.radius) * Math.min(1, dt * 6);
    camera.position.set(
      o.target.x + Math.sin(o.theta) * Math.cos(o.elev) * o.radius,
      o.target.y + Math.sin(o.elev) * o.radius,
      o.target.z + Math.cos(o.theta) * Math.cos(o.elev) * o.radius,
    );
    camera.lookAt(o.target);
  };
  return o;
}

// Nearest projected point within a pixel threshold. items: [{pos:Vector3, rad:number(world)}]
const _v = new THREE.Vector3();
export function pickScreen(items, camera, canvas, cx, cy, coarse, minPx = 24) {
  const rect = canvas.getBoundingClientRect();
  const half = Math.tan((camera.fov * Math.PI) / 360);
  let best = null, bestScore = Infinity;
  for (const it of items) {
    _v.copy(it.pos).project(camera);
    if (_v.z > 1) continue;
    const dist = camera.position.distanceTo(it.pos);
    const rpx = (it.rad / (dist * half)) * (rect.height / 2);
    const thr = Math.max(rpx * 1.15, coarse ? minPx * 1.7 : minPx);
    const d = Math.hypot((_v.x * 0.5 + 0.5) * rect.width + rect.left - cx, (-_v.y * 0.5 + 0.5) * rect.height + rect.top - cy);
    if (d < thr && d / thr < bestScore) { bestScore = d / thr; best = it; }
  }
  return best;
}
