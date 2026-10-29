import * as THREE from '../vendor/three.module.js';

export const TOWER_H = 46;
const BG = 0x050b1f;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addMat = (color, opacity) => new THREE.MeshBasicMaterial({
  color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
});

const CITY_VERT = `
attribute float aSeed;
varying vec3 vW; varying vec3 vN; varying float vS; varying float vD;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vS = aSeed;
  vec4 mv = viewMatrix * w;
  vD = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const CITY_FRAG = `
uniform vec3 uFog; uniform float uTime;
varying vec3 vW; varying vec3 vN; varying float vS; varying float vD;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 col = vec3(0.03, 0.06, 0.13) + vS * 0.03;
  if (abs(vN.y) < 0.5) {
    float u = abs(vN.x) > 0.5 ? vW.z : vW.x;
    vec2 cell = vec2(u * 0.9, vW.y * 0.7);
    vec2 id = floor(cell); vec2 f = fract(cell);
    float win = step(0.2, f.x) * step(f.x, 0.75) * step(0.25, f.y) * step(f.y, 0.7);
    float r = h(id + vS * 37.0 + floor(vN.x * 2.0 + vN.z * 5.0));
    float on = step(0.55, r);
    vec3 wc = mix(vec3(1.0, 0.78, 0.35), vec3(0.37, 0.94, 1.0), step(0.8, fract(r * 7.0)));
    float tw = 0.85 + 0.15 * sin(uTime * 1.5 + r * 40.0);
    col += win * on * wc * 0.85 * tw;
  } else if (vN.y > 0.5) {
    col += vec3(0.02, 0.05, 0.1);
  }
  float f = 1.0 - exp(-pow(vD * 0.006, 2.0));
  gl_FragColor = vec4(mix(col, uFog, f), 1.0);
}`;

const STREAM_VERT = `
uniform float uTime; uniform float uScale;
attribute vec4 aSeed; attribute float aCol;
varying vec3 vC; varying float vA;
void main(){
  float life = fract(aSeed.w + uTime * (0.025 + aSeed.z * 0.03));
  float ang = aSeed.x * 6.2831;
  float rad = 8.0 + aSeed.y * 62.0;
  float back = smoothstep(0.35, 1.0, life);
  float a2 = ang - back * 1.6;
  float rr = rad * (1.0 - back * 0.25);
  vec3 p = vec3(cos(a2) * rr, life * 70.0, sin(a2) * rr);
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.5, uScale * (0.3 + aSeed.z * 0.5) / -mv.z);
  vC = mix(vec3(0.37, 0.94, 1.0), vec3(0.96, 0.77, 0.32), aCol);
  vA = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.8, 1.0, life));
}`;
const STREAM_FRAG = `
varying vec3 vC; varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vC, vA * (1.0 - d * 2.0));
}`;

function towerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f5c451'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,240,180,0.35)';
  for (let y = 4; y < 64; y += 16) for (let x = 3; x < 64; x += 16) g.fillRect(x, y, 10, 9);
  g.fillStyle = 'rgba(90,50,0,0.55)';
  for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 2);
  for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 2, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 2);
  return t;
}

export function createWorld() {
  const rand = mulberry32(2061);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.006);
  const uTime = { value: 0 };
  const uScale = { value: 500 };

  // ---- city ----
  const cells = [];
  const S = 6.5;
  for (let ix = -15; ix <= 15; ix++) {
    for (let iz = -15; iz <= 15; iz++) {
      const x = ix * S + (rand() - 0.5) * 2.2;
      const z = iz * S + (rand() - 0.5) * 2.2;
      const d = Math.hypot(x, z);
      if (d < 13 || d > 100 || rand() < 0.12) continue;
      const w = 2.2 + rand() * 2.6;
      const dp = 2.2 + rand() * 2.6;
      const hgt = (3 + rand() * rand() * 24) * Math.max(0.35, 1.25 - d / 110);
      cells.push([x, z, w, hgt, dp, rand()]);
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const seeds = new Float32Array(cells.length);
  const cityMat = new THREE.ShaderMaterial({
    vertexShader: CITY_VERT, fragmentShader: CITY_FRAG,
    uniforms: { uFog: { value: new THREE.Vector3(0.02, 0.043, 0.122) }, uTime },
  });
  const city = new THREE.InstancedMesh(boxGeo, cityMat, cells.length);
  const dummy = new THREE.Object3D();
  cells.forEach((c, i) => {
    dummy.position.set(c[0], 0, c[1]);
    dummy.scale.set(c[2], c[3], c[4]);
    dummy.updateMatrix();
    city.setMatrixAt(i, dummy.matrix);
    seeds[i] = c[5];
  });
  boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  city.frustumCulled = false;
  scene.add(city);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x07102a }));
  ground.position.y = -0.05;
  scene.add(ground);
  const grid = new THREE.GridHelper(200, 40, 0x5ef0ff, 0x5ef0ff);
  grid.material.transparent = true; grid.material.opacity = 0.07; grid.material.depthWrite = false;
  grid.position.y = 0.02;
  scene.add(grid);
  const groundRing = new THREE.Mesh(new THREE.RingGeometry(10.5, 11, 64).rotateX(-Math.PI / 2), addMat(0xf5c451, 0.6));
  groundRing.position.y = 0.05;
  scene.add(groundRing);

  // ---- tower ----
  const tower = new THREE.Group();
  const tex = towerTexture();
  const segMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 7, 3, 8), segMat);
  podium.position.y = 1.5;
  tower.add(podium);
  let y = 3;
  const SEG_H = 4.4;
  for (let i = 0; i < 8; i++) {
    const rb = 3.7 - i * 0.28;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.16, rb, SEG_H, 8), segMat);
    seg.position.y = y + SEG_H / 2;
    tower.add(seg);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(rb * 1.2, rb * 1.2, 0.35, 8), bandMat);
    band.position.y = y + SEG_H;
    tower.add(band);
    y += SEG_H;
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.6, 8, 8), bandMat);
  spire.position.y = y + 4;
  tower.add(spire);
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.6, y, 16, 1, true).translate(0, y / 2 + 1, 0), addMat(0xf5c451, 0.1));
  tower.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.8, 110, 12, 1, true).translate(0, y + 8 + 55, 0), addMat(0x5ef0ff, 0.22));
  tower.add(beam);
  scene.add(tower);

  // ---- clock rings ----
  const hands = [];
  const rings = [];
  function makeClock(R, rx, ry, py, color, speed) {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    const m = addMat(color, 0.5);
    inner.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 160), m));
    inner.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.9, 0.05, 6, 160), addMat(color, 0.3)));
    const tg = new THREE.BoxGeometry(0.14, 1, 0.14);
    const ticks = new THREE.InstancedMesh(tg, m, 60);
    const d = new THREE.Object3D();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const big = i % 5 === 0;
      const len = big ? 2.6 : 1.1;
      const r = R * 0.9 + len / 2;
      d.position.set(Math.sin(a) * r, Math.cos(a) * r, 0);
      d.rotation.set(0, 0, -a);
      d.scale.set(big ? 1.8 : 1, len, 1);
      d.updateMatrix();
      ticks.setMatrixAt(i, d.matrix);
    }
    ticks.frustumCulled = false;
    inner.add(ticks);
    for (const [len, k] of [[R * 0.5, 1], [R * 0.78, 12]]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.3, len, 0.1).translate(0, len / 2, 0), m);
      hand.rotation.z = Math.random() * 6;
      hands.push({ m: hand, k: k * speed });
      inner.add(hand);
    }
    g.rotation.set(rx, ry, 0);
    g.position.y = py;
    scene.add(g);
    rings.push({ inner, speed });
  }
  makeClock(34, Math.PI / 2 - 0.2, 0, 30, 0x5ef0ff, 0.12);
  makeClock(44, 0.6, 0.8, 28, 0xf5c451, 0.08);
  makeClock(56, -0.5, -0.6, 26, 0x5ef0ff, 0.05);

  // ---- data streams ----
  const N = 2200;
  const sg = new THREE.BufferGeometry();
  const seed = new Float32Array(N * 4);
  const col = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    seed[i * 4] = rand(); seed[i * 4 + 1] = rand(); seed[i * 4 + 2] = rand(); seed[i * 4 + 3] = rand();
    col[i] = rand() < 0.5 ? 0 : 1;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  sg.setAttribute('aCol', new THREE.BufferAttribute(col, 1));
  const streams = new THREE.Points(sg, new THREE.ShaderMaterial({
    vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG, uniforms: { uTime, uScale },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  streams.frustumCulled = false;
  scene.add(streams);

  // ---- stars ----
  const SN = 500;
  const sp = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const a = rand() * Math.PI * 2, e = 0.1 + rand() * 1.4;
    sp[i * 3] = Math.cos(a) * Math.cos(e) * 400; sp[i * 3 + 1] = Math.sin(e) * 400; sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 400;
  }
  const stg = new THREE.BufferGeometry();
  stg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(stg, new THREE.PointsMaterial({ color: 0xcfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7, fog: false }));
  stars.frustumCulled = false;
  scene.add(stars);

  // ---- Iris (hologram) ----
  const iris = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 6, 16), addMat(0xbff8ff, 0.5));
  body.scale.set(1.25, 1, 1.1);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), addMat(0xffffff, 0.4));
  hood.position.set(0, 1.0, -0.2); hood.rotation.x = -0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), addMat(0xe8ffff, 0.6));
  head.position.y = 1.6;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.57, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), addMat(0xffd84a, 0.85));
  hair.position.set(0, 1.68, -0.06);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a1630 });
  const eyeGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-0.18, 1.58, 0.45);
  const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(0.18, 1.58, 0.45);
  const tailGeo = new THREE.SphereGeometry(0.3, 10, 10);
  const hairMat = addMat(0xffd84a, 0.8);
  const tL = new THREE.Mesh(tailGeo, hairMat); tL.scale.set(0.7, 2.2, 0.7); tL.position.set(-0.72, 1.25, -0.1);
  const tR = new THREE.Mesh(tailGeo, hairMat); tR.scale.set(0.7, 2.2, 0.7); tR.position.set(0.72, 1.25, -0.1);
  const base = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 32).rotateX(-Math.PI / 2), addMat(0x5ef0ff, 0.7));
  base.position.y = -1.3;
  iris.add(body, hood, head, hair, eL, eR, tL, tR, base);
  iris.scale.setScalar(2.2);
  scene.add(iris);

  function update(t, dt, camera) {
    uTime.value = t;
    for (const r of rings) r.inner.rotation.z -= dt * r.speed;
    for (const h of hands) h.m.rotation.z -= dt * h.k;
    beam.material.opacity = 0.18 + Math.sin(t * 2) * 0.04;
    const a = t * 0.12;
    const ix = Math.cos(a) * 11, iz = Math.sin(a) * 11;
    iris.position.set(ix, 17 + Math.sin(t * 1.6) * 0.6, iz);
    iris.rotation.y = Math.atan2(camera.position.x - ix, camera.position.z - iz);
    iris.rotation.z = Math.sin(t * 1.1) * 0.06;
  }

  function setViewport(heightPx, fovDeg) {
    uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  return { scene, update, setViewport };
}
